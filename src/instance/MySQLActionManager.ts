/**
 * MySQL 对象关系实例
 * 单例数据库操作管理者，负责 MySQL 的基本 CRUD
 */
import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarMysql from '../grammar/mysql.js';
import type {Transaction, QueryParams,QueryOption, UpdateParams, UpdateFieldItem , UpdateCaseItem, UpdateCaseField,InsertParams, DeleteParams, AggregateItem } from '../types/onela.js';


/**
 * MySQL 单例操作管理器
 */
class MySQLActionManager extends BaseActionManager {
  private static conn: any;

  /**
   * 初始化连接池（单例）
   */
  static init(config: any): void {
    const mysql = require('mysql');
    const connPool = mysql.createPool(config);
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

      self.conn.getConnection((err: any, connection: any) => {
        if (err) {
          console.log('An exception occurred when creating a transaction connection', err);
          return reject(new Error('An exception occurred when creating a transaction connection'));
        }

        const transaction: Partial<Transaction> = { client: connection };

        // 开始事务
        transaction.begin = () => {
          return new Promise((res, rej) => {
            connection.beginTransaction((err: any) => {
              if (err) rej(err);
              else res();
            });
          });
        };

        // 提交事务
        transaction.commit = () => {
          return new Promise<string>((res) => {
            connection.commit(() => {
              res('Transaction submitted successfully');
              connection.release();
            });
          });
        };

        // 回滚事务
        transaction.rollback = () => {
          return new Promise<string>((res) => {
            connection.rollback(() => {
              res('Transaction rolled back');
              connection.release();
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
        self.conn.query(sql, parameters, (err: any, doc: any) => {
          if (err) reject(err);
          else resolve(doc);
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
        transaction.client.query(sql, parameters, (err: any, doc: any) => {
          if (err) reject(err);
          else resolve(doc);
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
    const p = GrammarMysql.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;

    if (option.transaction) {
      return this.executeTransaction(sql, p.parameters!, option.transaction).catch(err => {
        console.log('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    } else {
      return this.execute(sql, p.parameters).catch(err => {
        console.error('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    }
  }

  /**
   * 分页查询 + 总数
   */
  static queryEntityList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; recordsTotal: number }> {
    const p = GrammarMysql.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
    const countSql = `SELECT COUNT(0) total FROM ${params.configs.tableName} t ${p.where};`;

    if (option.transaction) {
      return Promise.all([
        this.executeTransaction(sql, p.parameters!, option.transaction),
        this.executeTransaction(countSql, p.parameters!, option.transaction),
      ]).then(([data, count]) => {
        return { data, recordsTotal: count[0]?.total ?? 0 };
      }).catch(err => {
        console.log('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    } else {
      return Promise.all([
        this.execute(sql, p.parameters),
        this.execute(countSql, p.parameters),
      ]).then(([data, count]) => {
        return { data, recordsTotal: count[0]?.total ?? 0 };
      }).catch(err => {
        console.error('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    }
  }

  /**
   * 瀑布流查询（判断末尾）
   */
  static queryWaterfallList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarMysql.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = [`SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} LIMIT ?, ?;`];
    p.parameters!.push(limit[0], fetchCount);

    if (option.transaction) {
      return this.executeTransaction(sql.join(''), p.parameters!, option.transaction).then(data => {
        const result = { data, isLastPage: false };
        if (data.length === 0) {
          result.isLastPage = true;
        } else if (data.length < limit[1]) {
          result.isLastPage = true;
        } else if (data.length > limit[1]) {
          result.data.pop();
        }
        return result;
      }).catch(err => {
        console.error('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    } else {
      return this.execute(sql.join(''), p.parameters).then(data => {
        const result = { data, isLastPage: false };
        if (data.length === 0) {
          result.isLastPage = true;
        } else if (data.length < limit[1]) {
          result.isLastPage = true;
        } else if (data.length > limit[1]) {
          result.data.pop();
        }
        return result;
      }).catch(err => {
        console.error('Error when executing execute query data list', err);
        return Promise.reject(err);
      });
    }
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

    const sql = `INSERT INTO ${params.configs.tableName} (${f.join(',')}) VALUES (${s.join(',')});`;

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

  /**
   * 物理删除
   */
  static deleteEntity(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');
    }

    const p = GrammarMysql.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 更新
   */
  static updateEntity(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarMysql.getUpdateParameters(params);
    let limitSql = '';
    if (params.limit) {
      limitSql = ' LIMIT ?';
      p.parameters.push(params.limit);
    }

    const sql = `UPDATE ${params.configs!.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 聚合统计
   */
  static statsByAggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarMysql.getParameters(params);
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
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 自定义 SQL（谨慎使用）
   */
  static streak(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeTransaction(sql, parameters, option.transaction).catch(err => {
        console.error('Exception when executing execute query data list', err);
        return Promise.reject(err);
      });
    } else {
      return this.execute(sql, parameters).catch(err => {
        console.error('Exception when executing execute query data list', err);
        return Promise.reject(err);
      });
    }
  }
}

export { MySQLActionManager };