/**
 * PostgreSQL 对象关系实例
 * 单例数据库操作管理者，负责 PostgreSQL 的基本 CRUD
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarPostgres from '../grammar/postgresql.js';
import type {
  Transaction,
  QueryParams,
  QueryOption,
  UpdateParams,
  UpdateResult,
  UpdateCaseItem,
  UpdateCaseField,
  InsertParams,
  DeleteParams,
  AggregateItem
} from '../types/onela.js';

/**
 * PostgreSQL 单例操作管理器
 * 支持动态注入 pg 模块或 Pool 实例（不强制依赖）
 */
class PostgreSQLActionManager extends BaseActionManager {
  private static conn: any = null;

  /**
   * 初始化连接池（单例）
   * 支持三种方式：
   * 1. 传入 { Pool } 对象
   * 2. 传入 Pool 类
   * 3. 传入已创建的 Pool 实例
   * 4. 无参数 → 动态 import('pg')
   */
  static init(config: any, pgModuleOrPool?: any): void | Promise<void> {
    let Pool: any;

    // 情况1: 传入 pg 模块 { Pool }
    if (pgModuleOrPool?.Pool) {
      Pool = pgModuleOrPool.Pool;
    }
    // 情况2: 传入 Pool 类
    else if (typeof pgModuleOrPool === 'function' && pgModuleOrPool.prototype?.connect) {
      Pool = pgModuleOrPool;
    }
    // 情况3: 传入已创建的 Pool 实例
    else if (pgModuleOrPool?.connect && pgModuleOrPool?.query) {
      this.conn = pgModuleOrPool;
      return;
    }

    // 情况4: 动态导入 pg
    if (!Pool) {
      return import('pg')
        .then((module) => {
          Pool = module.Pool;
          const pool = new Pool(config);
          this.conn = pool;
        })
        .catch((err) => {
          console.error('Failed to import pg. Please install it: npm install pg');
          throw new Error('pg module not found. Install it in your project: npm install pg');
        });
    }

    // 使用传入的 Pool 类创建实例
    const pool = new Pool(config);
    this.conn = pool;
  }

  /**
   * 强制设置 Pool 实例（测试/高级用法）
   */
  static setPoolInstance(pool: any): void {
    this.conn = pool;
  }

  /**
   * 创建事务连接
   */
  static createTransaction(): Promise<Transaction> {
    const self = this;

    return new Promise((resolve, reject) => {
      if (!self.conn) {
        return reject(new Error('Connection pool not initialized. Call PostgreSQLActionManager.init() first.'));
      }

      // 兼容 Promise 和回调两种风格
      const connectResult = self.conn.connect();

      if (connectResult && typeof connectResult.then === 'function') {
        // Promise 风格
        connectResult
          .then((client: any) => {
            resolve(self.buildTransaction(client));
          })
          .catch(reject);
      } else {
        // 回调风格
        self.conn.connect((err: any, client: any, done: () => void) => {
          if (err) {
            console.error('Error creating transaction connection', err);
            return reject(new Error('Failed to create transaction connection'));
          }
          resolve(self.buildTransaction(client, done));
        });
      }
    });
  }

  /**
   * 构建事务对象
   */
  private static buildTransaction(client: any, done?: () => void): Transaction {
    const transaction: Partial<Transaction> = { client };

    transaction.begin = () => {
      return new Promise<void>((res, rej) => {
        client.query('BEGIN', (err: any) => {
          if (err) {
            client.query('ROLLBACK', () => {});
            rej(new Error('Transaction BEGIN failed'));
          } else {
            res();
          }
        });
      });
    };

    transaction.commit = () => {
      return new Promise<string>((res, rej) => {
        client.query('COMMIT', (err: any) => {
          if (err) {
            console.error('COMMIT error', err);
            rej(err);
          } else {
            done?.();
            res('Transaction committed');
          }
        });
      });
    };

    transaction.rollback = () => {
      return new Promise<string>((res, rej) => {
        client.query('ROLLBACK', (err: any) => {
          if (err) {
            console.error('ROLLBACK error', err);
            rej(new Error('ROLLBACK failed: ' + err.message));
          } else {
            done?.();
            res('Transaction rolled back');
          }
        });
      });
    };

    return transaction as Transaction;
  }

  /**
   * 执行 SQL（连接池）
   */
  private static execute(sql: string, parameters: any[] = []): Promise<any> {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }
    return this.conn.query({ text: sql, values: parameters });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(sql: string, parameters: any[], transaction: Transaction): Promise<any> {
    if (!transaction?.client) {
      throw new Error('Invalid transaction');
    }
    return transaction.client.query({ text: sql, values: parameters });
  }

  // ====================== CRUD 方法 ======================

  static findAll(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarPostgres.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters)
    ).catch((err) => {
        console.error('Query entity error:', err);
        return Promise.reject(err);
      });
  }

  static findList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; recordsTotal: any }> {
    const p = GrammarPostgres.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy} ${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return Promise.all([
      exec(sql, p.parameters!),
      exec(countSql, p.parameters!),
    ]).then(([dataRes, countRes]) => ({
        data: dataRes.rows,
        recordsTotal: countRes.rows[0]?.total ?? 0,
      })).catch((err) => {
          console.error('Query list error:', err);
          return Promise.reject(err);
        });
  }

  static find(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarPostgres.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;
    console.log(`[find] SQL: ${sql}`);
    console.log(`[find] parameters: ${p.parameters!.length}, ${JSON.stringify(p.parameters!)}`);

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return exec(sql, p.parameters!)
      .then((data: any) => {
        const rows = data.rows;
        const isLastPage = rows.length <= limit[1];
        // 返回数据
        const result = {
          data: isLastPage ? rows : rows.slice(0, -1),
          isLastPage,
        }
        console.log(`查询数据库数据: ${JSON.stringify(result)}`)
        return Promise.resolve(result);
        
      })
      .catch((err) => {
        console.error('Waterfall query error:', err);
        return Promise.reject(err);
      });
  }

  static insert(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const insertion = params.insertion as Record<string, any>;
    const p: any[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (const key in insertion) {
      f.push(key);
      index++;
      s.push(`$${index}`);
      p.push(insertion[key]);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;

    return (option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p)
    ).then((data: any) => ({ ...insertion, _returns: data }));
  }

  static inserts(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const list = params.insertion as Array<Record<string, any>>;
    const p: any[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const s2: string[] = [];
      for (const key in item) {
        if (i === 0) f.push(key);
        index++;
        s2.push(`$${index}`);
        p.push(item[key]);
      }
      s.push(`(${s2.join(', ')})`);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;

    return option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p);
  }

  static delete(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions required to prevent full table deletion.');
    }

    const p = GrammarPostgres.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static update(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarPostgres.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ` LIMIT $${p.parameters.length + 1}`;
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where} ${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static aggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarPostgres.getParameters(params);
    const check: Record<string, string> = { count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG' };
    const show: string[] = [];

    for (const agg of params.aggregate) {
      const fn = check[agg.function.toLowerCase()];
      if (fn) show.push(`${fn}(${agg.field}) AS ${agg.name}`);
    }

    const sql = `SELECT ${show.join(', ')} FROM ${params.configs.tableName} ${p.where} ${p.limit};`;

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return exec(sql, p.parameters!).then((result: any) => result.rows);
  }

  static sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    return (option.transaction
      ? this.executeTransaction(sql, parameters, option.transaction)
      : this.execute(sql, parameters)
    )
      .then((result: any) => result.rows)
      .catch((err) => {
        console.error('Custom SQL error:', err);
        return Promise.reject(err);
      });
  }
}

export { PostgreSQLActionManager };