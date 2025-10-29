/**
 * SQL Server 对象关系实例
 * 单例数据库操作管理者，负责 SQL Server 的基本 CRUD
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarParameter from '../grammar/sqlserver.js';
import type { FieldConfig, Transaction, QueryParams,QueryOption, UpdateParams, UpdateFieldItem , UpdateCaseItem, UpdateCaseField,InsertParams, DeleteParams, AggregateItem,Parameter } from '../interface/onelaType.js';


/**
 * SQL Server 单例操作管理器
 */
class SQLServerActionManager extends BaseActionManager {
  private static Connection: any;
  private static Request: any;
  private static TYPES: any;
  private static connectionCfg: any;

  /**
   * 初始化连接配置（单例）
   */
  static init(config: {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    encrypt?: boolean;
  }): void {
    const tedious = require('tedious');
    const Connection = tedious.Connection;
    this.Request = tedious.Request;
    this.TYPES = tedious.TYPES;

    const connectionCfg = {
      server: config.host,
      authentication: {
        type: 'default',
        options: {
          userName: config.user,
          password: config.password,
        },
      },
      options: {
        encrypt: config.encrypt || false,
        port: config.port || 1433,
        database: config.database,
      },
    };

    this.Connection = Connection;
    this.connectionCfg = connectionCfg;
  }

  /**
   * 创建事务连接
   */
  static createTransaction(): Promise<Transaction> {
    const self = this;

    return new Promise((resolve, reject) => {
      const conn = new self.Connection(self.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) {
          console.error('Error creating SQL Server transaction access connection', err);
          return reject(err);
        }

        console.log('SQL Server transaction access connection has been created');

        const transaction: Partial<Transaction> = { client: conn };

        transaction.begin = () => {
          return new Promise<void>((res, rej) => {
            conn.beginTransaction((err: any) => {
              if (err) rej(err);
              else res();
            });
          });
        };

        transaction.commit = () => {
          return new Promise<string>((res) => {
            conn.commitTransaction(() => {
              conn.close();
              res('Transaction submitted successfully');
            });
          });
        };

        transaction.rollback = () => {
          return new Promise<string>((res) => {
            conn.rollbackTransaction(() => {
              conn.close();
              res('Transaction rolled back');
            });
          });
        };

        resolve(transaction as Transaction);
      });
    });
  }

  /**
   * 执行 SQL（每次新建连接）
   */
  private static execute(sql: string, parameters: Parameter[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const self = this;
    return new Promise((resolve, reject) => {
      const conn = new self.Connection(self.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) {
          console.error('SQL Server access connection error', err);
          return reject(err);
        }

        console.log('SQL Server access connection has been created');

        const rows: any[] = [];
        let rowCount = 0;

        const request = new self.Request(sql, (err: any, rc: number) => {
          if (err) {
            console.log('Error creating SQL execution request', err);
            conn.close();
            return reject(err);
          }
          rowCount = rc;
          conn.close();
          resolve({ rows, rowCount });
        });

        // 添加参数
        parameters.forEach(p => {
          const type = self.TYPES[p.sqlType] || self.TYPES.VarChar;
          request.addParameter(p.name, type, p.value);
        });

        request.on('row', (columns: any) => {
          const row: any = {};
          columns.forEach((col: any) => {
            row[col.metadata.colName] = col.value;
          });
          rows.push(row);
        });

        conn.execSql(request);
      });
    });
  }

  /**
   * 执行事务 SQL
   */
  private static executeTransaction(sql: string, parameters: Parameter[], transaction: Transaction): Promise<{ rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      let rowCount = 0;

      const request = new this.Request(sql, (err: any, rc: number) => {
        if (err) {
          return reject(err);
        }
        rowCount = rc;
        resolve({ rows, rowCount });
      });

      parameters.forEach(p => {
        const type = this.TYPES[p.sqlType] || this.TYPES.VarChar;
        request.addParameter(p.name, type, p.value);
      });

      request.on('row', (columns: any) => {
        const row: any = {};
        columns.forEach((col: any) => {
          row[col.metadata.colName] = col.value;
        });
        rows.push(row);
      });

      transaction.client.execSql(request);
    });
  }

  /**
   * 查询单条记录
   */
  static queryEntity(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarParameter.getParameters(params);
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
    const p = GrammarParameter.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: Parameter[]) => this.executeTransaction(q, params, option.transaction!)
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
    const p = GrammarParameter.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} OFFSET ${limit[0]} ROWS FETCH NEXT ${fetchCount} ROWS ONLY;`;

    const exec = option.transaction
      ? (q: string, params: Parameter[]) => this.executeTransaction(q, params, option.transaction!)
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
    const p: Parameter[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (const key in insertion) {
      f.push(key);
      index++;
      s.push(`@${key}${index}`);
      p.push({
        name: `${key}${index}`,
        sqlType: this.getSqlType(key, params.configs.fields || []),
        value: insertion[key],
      });
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
    const p: Parameter[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const s2: string[] = [];

      for (const key in item) {
        if (i === 0) f.push(key);
        index++;
        s2.push(`@${key}${i}`);
        p.push({
          name: `${key}${i}`,
          sqlType: this.getSqlType(key, params.configs.fields || []),
          value: item[key],
        });
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

    const p = GrammarParameter.getDeleteParameters(params);
    const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 更新
   */
  static updateEntity(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarParameter.getUpdateParameters(params);
    const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${p.limit};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  /**
   * 聚合统计
   */
  static statsByAggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const p = GrammarParameter.getParameters(params);
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
      ? this.executeTransaction(sql, p.parameters!, option.transaction).then(r => r.rows)
      : this.execute(sql, p.parameters).then(r => r.rows);
  }

  /**
   * 自定义 SQL（谨慎使用）
   */
  static streak(sql: string, parameters: Parameter[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeTransaction(sql, parameters, option.transaction)
        .then(r => r.rows)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    } else {
      return this.execute(sql, parameters)
        .then(r => r.rows)
        .catch(err => {
          console.error('Exception when executing execute query data list', err);
          return Promise.reject(err);
        });
    }
  }

  /**
   * 字段类型映射
   */
  private static getSqlType(fieldName: string, fields: FieldConfig[]): string {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return 'VarChar';
    return GrammarParameter.sqlTypeHandle(field.type);
  }
}

export { SQLServerActionManager };