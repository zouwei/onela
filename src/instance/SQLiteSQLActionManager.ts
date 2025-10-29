/**
 * SQLite 对象关系实例
 * 单例数据库操作管理者，负责 SQLite 的基本 CRUD
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarSqlite from '../grammar/sqlite.js';
import type {Transaction, QueryParams,QueryOption, UpdateParams, UpdateFieldItem , UpdateCaseItem, UpdateCaseField,InsertParams, DeleteParams, AggregateItem } from '../interface/onelaType.js';


// // === 类型定义 ===
// interface Transaction {
//   client: any;
//   begin: () => Promise<void>;
//   commit: () => Promise<string>;
//   rollback: () => Promise<string>;
// }

// interface QueryOption {
//   transaction?: Transaction | null;
// }

// interface AggregateItem {
//   function: 'count' | 'sum' | 'max' | 'min' | 'abs' | 'avg';
//   field: string;
//   name: string;
// }

// interface QueryParams {
//   configs: { tableName: string };
//   select?: string[];
//   keyword?: Array<{
//     key: string;
//     value: any;
//     logic?: 'and' | 'or';
//     operator?: '=' | '>' | '<' | '<>' | '>=' | '<=' | 'in' | 'not in' | '%' | 'x%' | '%%' | 'is';
//   }>;
//   where?: any[];
//   orderBy?: Record<string, 'ASC' | 'DESC'>;
//   limit?: [number, number];
//   aggregate?: AggregateItem[];
// }

// interface InsertParams {
//   configs: { tableName: string };
//   insertion: Record<string, any> | Array<Record<string, any>>;
// }

// interface UpdateParams extends QueryParams {
//   update: Array<{
//     key: string;
//     value: any;
//     operator?: 'replace' | 'plus' | 'reduce';
//     case_field?: string;
//     case_item?: Array<{
//       case_value: any;
//       value: any;
//       operator?: 'replace' | 'plus' | 'reduce';
//     }>;
//   }>;
// }

// interface DeleteParams extends QueryParams {
//   keyword?: any[];
//   where?: any[];
// }

/**
 * SQLite 单例操作管理器
 */
class SQLiteActionManager extends BaseActionManager {
  private static conn: any;
  private static host: string;

  /**
   * 初始化数据库（单例）
   */
  static init(config: { host: string }): void {
    const SQLite3 = require('sqlite3').verbose();
    this.host = config.host;

    this.conn = new SQLite3.Database(config.host, (err: any) => {
      if (err) {
        console.log('SQLite database connection exception', err);
      } else {
        console.log('SQLite database connection successful');
      }
    });
  }

  /**
   * 连接数据库（延迟初始化）
   */
  private static connectDataBase(): Promise<any> {
    const self = this;
    return new Promise((resolve, reject) => {
      if (!self.conn) {
        const SQLite3 = require('sqlite3').verbose();
        self.conn = new SQLite3.Database(self.host, (err: any) => {
          if (err) reject(new Error(err));
          else resolve(self.conn);
        });
      } else {
        resolve(self.conn);
      }
    });
  }

  /**
   * 创建事务连接（共享单例连接）
   */
  static createTransaction(): Promise<Transaction> {
    const self = this;

    return new Promise((resolve, reject) => {
      if (!self.conn) {
        return reject(new Error('SQLite connection not initialized'));
      }

      const transaction: Partial<Transaction> = { client: self.conn };

      transaction.begin = () => {
        return new Promise<void>((res) => {
          transaction.client!.run('BEGIN');
          res();
        });
      };

      transaction.commit = () => {
        return new Promise<string>((res) => {
          transaction.client!.run('COMMIT');
          res('Transaction submitted successfully');
        });
      };

      transaction.rollback = () => {
        return new Promise<string>((res) => {
          transaction.client!.run('ROLLBACK');
          res('Transaction rolled back');
        });
      };

      resolve(transaction as Transaction);
    });
  }

  /**
   * 执行 SQL（自动选择 run/get/all）
   */
  private static execute(sql: string, parameters: any[] = [], mode: 'run' | 'get' | 'all' = 'run'): Promise<any> {
    const self = this;
    return new Promise((resolve, reject) => {
      if (self.conn) {
        console.time('【onela】SQL execution time');
        self.conn[mode](sql, parameters, function (err: any, data: any) {
          console.timeEnd('【onela】SQL execution time');
          if (err) {
            reject(err);
          } else {
            resolve(data !== undefined ? data : 'success');
          }
        });
      } else {
        reject(new Error('The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig.'));
      }
    });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(sql: string, parameters: any[], transaction: Transaction, mode: 'run' | 'get' | 'all' = 'run'): Promise<any> {
    return new Promise((resolve, reject) => {
      if (transaction && transaction.client) {
        console.time('【onela】SQL execution time');
        transaction.client[mode](sql, parameters, function (err: any, data: any) {
          console.timeEnd('【onela】SQL execution time');
          if (err) {
            reject(err);
          } else {
            resolve(data !== undefined ? data : 'success');
          }
        });
      } else {
        reject(new Error('The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig.'));
      }
    });
  }

  /**
   * 查询单条记录
   */
  static queryEntity(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarSqlite.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;

    if (option.transaction) {
      return this.executeTransaction(sql, p.parameters!, option.transaction, 'get')
        .catch(err => {
          console.log('Error when executing execute query data list', err);
          return Promise.reject(err);
        });
    } else {
      return this.execute(sql, p.parameters, 'get')
        .catch(err => {
          console.error('Error when executing execute query data list', err);
          return Promise.reject(err);
        });
    }
  }

  /**
   * 分页查询 + 总数
   */
  static queryEntityList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; recordsTotal: number }> {
    const p = GrammarSqlite.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: any[], mode: 'all' | 'get') => this.executeTransaction(q, params, option.transaction!, mode)
      : (q: string, params: any[], mode: 'all' | 'get') => this.execute(q, params, mode);

    return Promise.all([
      exec(sql, p.parameters!, 'all'),
      exec(countSql, p.parameters!, 'get'),
    ]).then(([data, count]) => {
      return {
        data,
        recordsTotal: count?.total ?? 0,
      };
    }).catch(err => {
      console.log('Error when executing execute query data list', err);
      return Promise.reject(err);
    });
  }

  /**
   * 瀑布流查询（判断末尾）
   */
  static queryWaterfallList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarSqlite.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} LIMIT ? OFFSET ?;`;
    p.parameters!.push(fetchCount, limit[0]);

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!, 'all')
      : (q: string, params: any[]) => this.execute(q, params, 'all');

    return exec(sql, p.parameters!).then(data => {
      const isLastPage = data.length <= limit[1];
      return {
        data: isLastPage ? data : data.slice(0, -1),
        isLastPage,
      };
    }).catch(err => {
      console.error('Error when executing execute query data list', err);
      return Promise.reject(err);
    });
  }

  /**
   * 新增
   */
  static insert(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const insertion = params.insertion as Record<string, any>;
    const p: any[] = [], f: string[] = [], s: string[] = [];

    for (const key in insertion) {
      f.push(key);
      s.push('?');
      p.push(insertion[key]);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;

    const executeFn = option.transaction
      ? () => this.executeTransaction(sql, p, option.transaction!, 'run')
      : () => this.execute(sql, p, 'run');

    return executeFn().then(data => {
      return { ...insertion, _returns: data };
    });
  }

  /**
   * 批量新增
   */
  static insertBatch(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
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
      s.push(`(${s2.join(', ')})`);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;

    return option.transaction
      ? this.executeTransaction(sql, p, option.transaction, 'run')
      : this.execute(sql, p, 'run');
  }

  /**
   * 物理删除
   */
  static deleteEntity(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');
    }

    const p = GrammarSqlite.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
      : this.execute(sql, p.parameters, 'run');
  }

  /**
   * 更新
   */
  static updateEntity(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarSqlite.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ' LIMIT ?';
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
      : this.execute(sql, p.parameters, 'run');
  }

  /**
   * 聚合统计
   */
  static statsByAggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarSqlite.getParameters(params);
    const check: Record<string, string> = {
      count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG',
    };
    const show: string[] = [];

    for (const agg of params.aggregate) {
      const fn = check[agg.function.toLowerCase()];
      if (fn) {
        show.push(`${fn}(${agg.field}) AS ${agg.name}`);
      }
    }

    const sql = `SELECT ${show.join(', ')} FROM ${params.configs.tableName} ${p.where}${p.limit};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction, 'all')
      : this.execute(sql, p.parameters, 'all');
  }

  /**
   * 自定义 SQL（谨慎使用）
   */
  static streak(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    const mode = sql.trim().toLowerCase().startsWith('select') ? 'all' : 'run';

    if (option.transaction) {
      return this.executeTransaction(sql, parameters, option.transaction, mode)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    } else {
      return this.execute(sql, parameters, mode)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    }
  }
}

export { SQLiteActionManager };