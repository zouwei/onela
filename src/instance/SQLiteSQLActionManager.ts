/**
 * SQLite 对象关系实例
 * 单例数据库操作管理者，负责 SQLite 的基本 CRUD
 * @deprecated 请使用 V2 版本 SQLiteActionManagerV2，V1 版本将在未来版本移除
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarSqlite from '../grammar/sqlite.js';
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
 * 校验标识符，防止 SQL 注入
 */
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_*][a-zA-Z0-9_.*]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}

/**
 * SQLite 单例操作管理器
 * 支持动态注入 sqlite3 模块或 Database 实例（不强制依赖）
 * @deprecated 请使用 SQLiteActionManagerV2，V1 版本将在未来版本移除
 */
class SQLiteActionManager extends BaseActionManager {
  private static conn: any = null;
  private static host: string = '';

  /**
   * 初始化数据库（单例）
   * 支持：
   * 1. 传入 sqlite3 模块 { Database, verbose }
   * 2. 传入 Database 类
   * 3. 传入已创建的 Database 实例
   * 4. 无参数 → 动态 import('sqlite3')
   */
  static init(config: { host: string }, sqlite3ModuleOrDb?: any): void | Promise<void> {
    let SQLite3: any;

    // 情况1: 传入 sqlite3 模块 { Database, verbose }
    if (sqlite3ModuleOrDb?.Database && sqlite3ModuleOrDb?.verbose) {
      SQLite3 = sqlite3ModuleOrDb.verbose();
    }
    // 情况2: 传入 Database 类
    else if (typeof sqlite3ModuleOrDb === 'function' && sqlite3ModuleOrDb.prototype?.run) {
      SQLite3 = sqlite3ModuleOrDb;
    }
    // 情况3: 传入已创建的 Database 实例
    else if (sqlite3ModuleOrDb?.run && sqlite3ModuleOrDb?.get && sqlite3ModuleOrDb?.all) {
      this.conn = sqlite3ModuleOrDb;
      this.host = config.host;
      return;
    }

    // 情况4: 动态导入 sqlite3
    if (!SQLite3) {
      return import('sqlite3')
        .then((module) => {
          SQLite3 = module.verbose();
          this.host = config.host;
          this.conn = new SQLite3.Database(config.host, (err: any) => {
            if (err) {
              console.error('SQLite connection failed:', err);
            } else {
              console.log('SQLite connected:', config.host);
            }
          });
        })
        .catch((err) => {
          console.error('Failed to import sqlite3. Please install it: npm install sqlite3');
          throw new Error('sqlite3 module not found. Install it: npm install sqlite3');
        });
    }

    // 使用传入的 SQLite3 类创建实例
    this.host = config.host;
    this.conn = new SQLite3.Database(config.host, (err: any) => {
      if (err) {
        console.error('SQLite connection failed:', err);
      } else {
        console.log('SQLite connected:', config.host);
      }
    });
  }

  /**
   * 强制设置 Database 实例（测试/高级用法）
   */
  static setDatabaseInstance(db: any): void {
    this.conn = db;
  }

  /**
   * 创建事务连接（SQLite 事务基于单连接）
   */
  static createTransaction(): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      if (!this.conn) {
        return reject(new Error('SQLite not initialized. Call SQLiteActionManager.init() first.'));
      }

      const transaction: Partial<Transaction> = { client: this.conn };

      transaction.begin = () => {
        return new Promise<void>((res, rej) => {
          this.conn.run('BEGIN', (err: any) => {
            if (err) rej(err);
            else res();
          });
        });
      };

      transaction.commit = () => {
        return new Promise<string>((res, rej) => {
          this.conn.run('COMMIT', (err: any) => {
            if (err) rej(err);
            else res('Transaction committed');
          });
        });
      };

      transaction.rollback = () => {
        return new Promise<string>((res, rej) => {
          this.conn.run('ROLLBACK', (err: any) => {
            if (err) rej(err);
            else res('Transaction rolled back');
          });
        });
      };

      resolve(transaction as Transaction);
    });
  }

  /**
   * 执行 SQL（自动选择 run/get/all）
   */
  private static execute(
    sql: string,
    parameters: any[] = [],
    mode: 'run' | 'get' | 'all' = 'run'
  ): Promise<any> {
    if (!this.conn) {
      throw new Error('SQLite not initialized');
    }

    return new Promise((resolve, reject) => {
      console.time('【onela】SQL execution time');
      this.conn[mode](sql, parameters, function (this: any, err: any, data: any) {
        console.timeEnd('【onela】SQL execution time');
        if (err) reject(err);
        else resolve(data !== undefined ? data : 'success');
      });
    });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(
    sql: string,
    parameters: any[],
    transaction: Transaction,
    mode: 'run' | 'get' | 'all' = 'run'
  ): Promise<any> {
    if (!transaction?.client) {
      throw new Error('Invalid transaction');
    }

    return new Promise((resolve, reject) => {
      console.time('【onela】SQL execution time');
      transaction.client[mode](sql, parameters, function (this: any, err: any, data: any) {
        console.timeEnd('【onela】SQL execution time');
        if (err) reject(err);
        else resolve(data !== undefined ? data : 'success');
      });
    });
  }

  // ====================== CRUD 方法 ======================

  static findAll(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarSqlite.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction, 'get')
      : this.execute(sql, p.parameters, 'get')
    ).catch((err) => {
      console.error('Query entity error:', err);
      return Promise.reject(err);
    });
  }

  static findList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; recordsTotal: any }> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarSqlite.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${tableName} t ${p.where} ${p.orderBy} ${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: any[], mode: 'all' | 'get') => this.executeTransaction(q, params, option.transaction!, mode)
      : (q: string, params: any[], mode: 'all' | 'get') => this.execute(q, params, mode);

    return Promise.all([
      exec(sql, p.parameters!, 'all'),
      exec(countSql, p.parameters!, 'get'),
    ]).then(([data, count]) => ({
        data,
        recordsTotal: count?.total ?? 0,
      }))
      .catch((err) => {
        console.error('Query list error:', err);
        return Promise.reject(err);
      });
  }

  static find(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const tableName = validateIdentifier(params.configs.tableName);
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarSqlite.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction, 'all')
      : this.execute(sql, p.parameters!, 'all')
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
    const tableName = validateIdentifier(params.configs.tableName);
    const insertion = params.insertion as Record<string, any>;
    const p: any[] = [], f: string[] = [], s: string[] = [];

    for (const key in insertion) {
      f.push(`\`${validateIdentifier(key)}\``);
      s.push('?');
      p.push(insertion[key]);
    }

    const sql = `INSERT INTO ${tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;

    return (option.transaction
      ? this.executeTransaction(sql, p, option.transaction, 'run')
      : this.execute(sql, p, 'run')
    ).then((data: any) => ({ ...insertion, _returns: data }));
  }

  static inserts(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const list = params.insertion as Array<Record<string, any>>;
    const p: any[] = [], f: string[] = [], s: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const s2: string[] = [];
      for (const key in item) {
        if (i === 0) f.push(`\`${validateIdentifier(key)}\``);
        p.push(item[key]);
        s2.push('?');
      }
      s.push(`(${s2.join(', ')})`);
    }

    const sql = `INSERT INTO ${tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;

    return option.transaction
      ? this.executeTransaction(sql, p, option.transaction, 'run')
      : this.execute(sql, p, 'run');
  }

  static delete(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions required to prevent full table deletion.');
    }

    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarSqlite.getDeleteParameters(params);
    const sql = `DELETE FROM ${tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
      : this.execute(sql, p.parameters, 'run');
  }

  static update(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarSqlite.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ' LIMIT ?';
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${tableName} SET ${p.set.join(', ')} WHERE ${p.where} ${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
      : this.execute(sql, p.parameters, 'run');
  }

  static aggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarSqlite.getParameters(params);
    const check: Record<string, string> = { count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG' };
    const show: string[] = [];

    for (const agg of params.aggregate) {
      const fn = check[agg.function.toLowerCase()];
      if (fn) show.push(`${fn}(${validateIdentifier(agg.field)}) AS ${validateIdentifier(agg.name)}`);
    }

    const sql = `SELECT ${show.join(', ')} FROM ${tableName} ${p.where} ${p.limit};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction, 'all')
      : this.execute(sql, p.parameters!, 'all');
  }

  static sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    const isSelect = sql.trim().toLowerCase().startsWith('select');
    const mode = isSelect ? 'all' : 'run';

    return (option.transaction
      ? this.executeTransaction(sql, parameters, option.transaction, mode)
      : this.execute(sql, parameters, mode)
    ).catch((err) => {
      console.error('Custom SQL error:', err);
      return Promise.reject(err);
    });
  }
}

export { SQLiteActionManager };