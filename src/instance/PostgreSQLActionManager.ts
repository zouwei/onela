/**
 * PostgreSQL 对象关系实例
 * 单例数据库操作管理者，负责 PostgreSQL 的基本 CRUD
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarPostgres from '../grammar/postgresql.js';
import type {Transaction, QueryParams,QueryOption, UpdateParams, UpdateResult , UpdateCaseItem, UpdateCaseField,InsertParams, DeleteParams, AggregateItem } from '../interface/onelaType.js';


/**
 * PostgreSQL 单例操作管理器
 */
class PostgreSQLActionManager extends BaseActionManager {
  private static conn: any;

  /**
   * 初始化连接池（单例）
   */
  static init(config: any): void {
    const { Pool } = require('pg');
    const connPool = new Pool(config);
    this.conn = connPool;
  }

  /**
   * 创建事务连接
   */
  static createTransaction(): Promise<Transaction> {
    const self = this;

    return new Promise((resolve, reject) => {
      if (!self.conn) {
        return reject(new Error('Connection pool not initialized'));
      }

      self.conn.connect((err: any, client: any, done: () => void) => {
        if (err) {
          console.error('An exception occurred when creating a transaction connection', err);
          return reject(new Error('An exception occurred when creating a transaction connection'));
        }

        const transaction: Partial<Transaction> = { client};

        // 开始事务
        transaction.begin = () => {
          return new Promise((res, rej) => {
            client.query('BEGIN', (ex: any) => {
              if (ex) {
                client.query('ROLLBACK', (err: any) => {
                  console.error('Transaction exception!', err);
                  rej(new Error('Transaction exception!'));
                });
              } else {
                res();
              }
            });
          });
        };

        // 提交事务
        transaction.commit = () => {
          return new Promise<string>((res, rej) => {
            client.query('COMMIT', (err: any) => {
              if (err) {
                console.error('Error committing transaction', err.stack);
                rej(err);
              } else {
                done();
                res('Transaction submitted successfully!');
              }
            });
          });
        };

        // 回滚事务
        transaction.rollback = () => {
          return new Promise<string>((res, rej) => {
            client.query('ROLLBACK', (err: any) => {
              if (err) {
                console.error('Error rolling back client', err.stack);
                rej(new Error('Error rolling back client ' + err.stack));
              } else {
                done();
                res('Transaction rolled back!');
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
    const self = this;
    return new Promise((resolve, reject) => {
      if (self.conn) {
        const query = { text: sql, values: parameters };
        self.conn.query(query, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      } else {
        reject(new Error('The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig.'));
      }
    });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(sql: string, parameters: any[], transaction: Transaction): Promise<any> {
    return new Promise((resolve, reject) => {
      if (transaction && transaction.client) {
        const query = { text: sql, values: parameters };
        transaction.client.query(query, (err: any, result: any) => {
          if (err) {
            console.error('Execution transaction exception!', err);
            reject(err);
          } else {
            resolve(result);
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
    const p = GrammarPostgres.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;

    if (option.transaction) {
      return this.executeTransaction(sql, p.parameters!, option.transaction)
        .then(result => result.rows[0] || null)
        .catch(err => {
          console.log('Error when executing execute query data list', err);
          return Promise.reject(err);
        });
    } else {
      return this.execute(sql, p.parameters)
        .then(result => result.rows[0] || null)
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
    const p = GrammarPostgres.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return Promise.all([
      exec(sql, p.parameters),
      exec(countSql, p.parameters),
    ]).then(([dataRes, countRes]) => {
      return {
        data: dataRes.rows,
        recordsTotal: countRes.rows[0]?.total ?? 0,
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
    const p = GrammarPostgres.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} LIMIT $${p.parameters!.length + 1} OFFSET $${p.parameters!.length + 2};`;
    p.parameters!.push(fetchCount, limit[0]);

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return exec(sql, p.parameters).then(result => {
      const rows = result.rows;
      const isLastPage = rows.length <= limit[1];
      return {
        data: isLastPage ? rows : rows.slice(0, -1),
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
    let index = 0;

    for (const key in insertion) {
      f.push(key);
      index++;
      s.push(`$${index}`);
      p.push(insertion[key]);
    }

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;

    const executeFn = option.transaction
      ? () => this.executeTransaction(sql, p, option.transaction!)
      : () => this.execute(sql, p);

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

  /**
   * 物理删除
   */
  static deleteEntity(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');
    }

    const p = GrammarPostgres.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 更新
   */
  static updateEntity(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarPostgres.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ` LIMIT $${p.parameters.length + 1}`;
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 聚合统计
   */
  static statsByAggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarPostgres.getParameters(params);
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

    const exec = option.transaction
      ? (q: string, params: any[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return exec(sql, p.parameters).then(result => result.rows);
  }

  /**
   * 自定义 SQL（谨慎使用）
   */
  static streak(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeTransaction(sql, parameters, option.transaction)
        .then(result => result.rows)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    } else {
      return this.execute(sql, parameters)
        .then(result => result.rows)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    }
  }
}

export { PostgreSQLActionManager };