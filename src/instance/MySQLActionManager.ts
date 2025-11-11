/**
 * MySQL 对象关系实例
 * 单例数据库操作管理者，负责 MySQL 的基本 CRUD
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarMysql from '../grammar/mysql.js';
import type {
  Transaction,
  QueryParams,
  QueryOption,
  UpdateParams,
  UpdateFieldItem,
  UpdateCaseItem,
  UpdateCaseField,
  InsertParams,
  DeleteParams,
  AggregateItem
} from '../types/onela.js';

/**
 * MySQL 单例操作管理器
 * 支持动态注入 mysql 模块或 Pool 实例（不强制依赖）
 */
class MySQLActionManager extends BaseActionManager {
  private static conn: any = null;

  /**
   * 初始化连接池（单例）
   * 支持：
   * 1. 传入 mysql 模块 { createPool }
   * 2. 传入 createPool 函数
   * 3. 传入已创建的 Pool 实例
   * 4. 无参数 → 动态 import('mysql')
   */
  static init(config: any, mysqlModuleOrPool?: any): void | Promise<void> {
    let createPool: any;

    // 情况1: 传入 mysql 模块 { createPool }
    if (mysqlModuleOrPool?.createPool) {
      createPool = mysqlModuleOrPool.createPool;
    }
    // 情况2: 传入 createPool 函数
    else if (typeof mysqlModuleOrPool === 'function') {
      createPool = mysqlModuleOrPool;
    }
    // 情况3: 传入已创建的 Pool 实例
    else if (mysqlModuleOrPool?.getConnection && mysqlModuleOrPool?.query) {
      this.conn = mysqlModuleOrPool;
      return;
    }

    // 情况4: 动态导入 mysql
    if (!createPool) {
      return import('mysql')
        .then((module) => {
          createPool = module.createPool;
          const pool = createPool(config);
          this.conn = pool;
        })
        .catch((err) => {
          console.error('Failed to import mysql. Please install it: npm install mysql');
          throw new Error('mysql module not found. Install it in your project: npm install mysql');
        });
    }

    // 使用传入的 createPool 创建实例
    const pool = createPool(config);
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
        return reject(new Error('Connection pool not initialized. Call MySQLActionManager.init() first.'));
      }

      self.conn.getConnection((err: any, connection: any) => {
        if (err) {
          console.error('Error getting connection for transaction', err);
          return reject(new Error('Failed to get connection'));
        }

        const transaction: Partial<Transaction> = { client: connection };

        transaction.begin = () => {
          return new Promise<void>((res, rej) => {
            connection.beginTransaction((err: any) => {
              if (err) rej(err);
              else res();
            });
          });
        };

        transaction.commit = () => {
          return new Promise<string>((res, rej) => {
            connection.commit((err: any) => {
              if (err) {
                console.error('COMMIT error', err);
                rej(err);
              } else {
                connection.release();
                res('Transaction committed');
              }
            });
          });
        };

        transaction.rollback = () => {
          return new Promise<string>((res, rej) => {
            connection.rollback((err: any) => {
              if (err) {
                console.error('ROLLBACK error', err);
                rej(err);
              } else {
                connection.release();
                res('Transaction rolled back');
              }
            });
          });
        };

        resolve(transaction as Transaction);
      });
    });
  }

  /**
   * 执行 SQL（连接池）
   */
  private static execute(sql: string, parameters: any[] = []): Promise<any> {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }
    return new Promise((resolve, reject) => {
      this.conn.query(sql, parameters, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(sql: string, parameters: any[], transaction: Transaction): Promise<any> {
    if (!transaction?.client) {
      throw new Error('Invalid transaction');
    }
    return new Promise((resolve, reject) => {
      transaction.client.query(sql, parameters, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  // ====================== CRUD 方法 ======================

  static findAll(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarMysql.getParameters(params);
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
    const p = GrammarMysql.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy} ${p.limit};`;
    const countSql = `SELECT COUNT(0) total FROM ${params.configs.tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return Promise.all([
      exec(sql, p.parameters!),
      exec(countSql, p.parameters!),
    ])
      .then(([data, count]) => ({
        data,
        recordsTotal: count[0]?.total ?? 0,
      }))
      .catch((err) => {
        console.error('Query list error:', err);
        return Promise.reject(err);
      });
  }

  static find(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarMysql.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters)
    )
      .then((data: any[]) => {
        const isLastPage = data.length <= limit[1];
        return {
          data: isLastPage ? data : data.slice(0, -1),
          isLastPage,
        };
      })
      .catch((err) => {
        console.error('Waterfall query error:', err);
        return Promise.reject(err);
      });
  }

  static insert(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const insertion = params.insertion as Record<string, any>;
    const p: any[] = [], f: string[] = [], s: string[] = [];

    for (const key in insertion) {
      f.push(`\`${key}\``);
      s.push('?');
      p.push(insertion[key]);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(',')}) VALUES (${s.join(',')});`;

    return (option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p)
    ).then((data: any) => ({ ...insertion, _returns: data }));
  }

  static inserts(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const list = params.insertion as Array<Record<string, any>>;
    const p: any[] = [], f: string[] = [], s: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const s2: string[] = [];
      for (const key in item) {
        if (i === 0) f.push(`\`${key}\``);
        p.push(item[key]);
        s2.push('?');
      }
      s.push(`(${s2.join(',')})`);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(',')}) VALUES ${s.join(',')};`;

    return option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p);
  }

  static delete(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions required to prevent full table deletion.');
    }

    const p = GrammarMysql.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static update(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarMysql.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ' LIMIT ?';
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static aggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarMysql.getParameters(params);
    const check: Record<string, string> = { count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG' };
    const show: string[] = [];

    for (const agg of params.aggregate) {
      const fn = check[agg.function.toLowerCase()];
      if (fn) show.push(`${fn}(${agg.field}) AS ${agg.name}`);
    }

    const sql = `SELECT ${show.join(', ')} FROM ${params.configs.tableName} ${p.where} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters)
    );
  }

  static sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    return (option.transaction
      ? this.executeTransaction(sql, parameters, option.transaction)
      : this.execute(sql, parameters)
    ).catch((err) => {
      console.error('Custom SQL error:', err);
      return Promise.reject(err);
    });
  }
}

export { MySQLActionManager };