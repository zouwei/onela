/**
 * SQL Server 对象关系实例
 * 单例数据库操作管理者，负责 SQL Server 的基本 CRUD
 * @deprecated 请使用 V2 版本 SQLServerActionManagerV2，V1 版本将在未来版本移除
 */

import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarParameter from '../grammar/sqlserver.js';
import type {
  FieldConfig,
  Transaction,
  QueryParams,
  QueryOption,
  UpdateParams,
  UpdateFieldItem,
  UpdateCaseItem,
  UpdateCaseField,
  InsertParams,
  DeleteParams,
  AggregateItem,
  Parameter
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
 * SQL Server 单例操作管理器
 * 支持动态注入 tedious 模块（不强制依赖）
 * @deprecated 请使用 SQLServerActionManagerV2，V1 版本将在未来版本移除
 */
class SQLServerActionManager extends BaseActionManager {
  private static ConnectionClass: any = null;
  private static RequestClass: any = null;
  private static TYPES: any = null;
  private static connectionCfg: any = null;

  /**
   * 初始化连接配置（单例）
   * 支持：
   * 1. 传入 tedious 模块 { Connection, Request, TYPES }
   * 2. 传入 { Connection, Request, TYPES } 对象
   * 3. 无参数 → 动态 import('tedious')
   */
  static init(
    config: {
      host: string;
      user: string;
      password: string;
      database: string;
      port?: number;
      encrypt?: boolean;
    },
    tediousModule?: any
  ): void | Promise<void> {
    let Connection: any, Request: any, TYPES: any;

    // 情况1: 传入 tedious 模块
    if (tediousModule?.Connection && tediousModule?.Request && tediousModule?.TYPES) {
      Connection = tediousModule.Connection;
      Request = tediousModule.Request;
      TYPES = tediousModule.TYPES;
    }
    // 情况2: 传入 { Connection, Request, TYPES }
    else if (tediousModule?.Connection && tediousModule?.Request && tediousModule?.TYPES) {
      Connection = tediousModule.Connection;
      Request = tediousModule.Request;
      TYPES = tediousModule.TYPES;
    }

    // 情况3: 动态导入 tedious
    if (!Connection || !Request || !TYPES) {
      return import('tedious')
        .then((module) => {
          Connection = module.Connection;
          Request = module.Request;
          TYPES = module.TYPES;

          this.setupConnection(config, Connection, Request, TYPES);
        })
        .catch((err) => {
          console.error('Failed to import tedious. Please install it: npm install tedious');
          throw new Error('tedious module not found. Install it: npm install tedious');
        });
    }

    // 立即设置
    this.setupConnection(config, Connection, Request, TYPES);
  }

  private static setupConnection(
    config: any,
    Connection: any,
    Request: any,
    TYPES: any
  ): void {
    this.ConnectionClass = Connection;
    this.RequestClass = Request;
    this.TYPES = TYPES;

    this.connectionCfg = {
      server: config.host,
      authentication: {
        type: 'default',
        options: {
          userName: config.user,
          password: config.password,
        },
      },
      options: {
        encrypt: config.encrypt ?? false,
        port: config.port ?? 1433,
        database: config.database,
      },
    };
  }

  /**
   * 创建事务连接
   */
  static createTransaction(): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      if (!this.ConnectionClass || !this.connectionCfg) {
        return reject(new Error('SQL Server not initialized. Call SQLServerActionManager.init() first.'));
      }

      const conn = new this.ConnectionClass(this.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) {
          console.error('SQL Server transaction connection error:', err);
          return reject(err);
        }

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
          return new Promise<string>((res, rej) => {
            conn.commitTransaction((err: any) => {
              if (err) rej(err);
              else {
                conn.close();
                res('Transaction committed');
              }
            });
          });
        };

        transaction.rollback = () => {
          return new Promise<string>((res, rej) => {
            conn.rollbackTransaction((err: any) => {
              if (err) rej(err);
              else {
                conn.close();
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
   * 执行 SQL（每次新建连接）
   */
  private static execute(sql: string, parameters: Parameter[] = []): Promise<{ rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      if (!this.ConnectionClass || !this.connectionCfg) {
        return reject(new Error('SQL Server not initialized'));
      }

      const conn = new this.ConnectionClass(this.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) {
          console.error('SQL Server connection error:', err);
          return reject(err);
        }

        const rows: any[] = [];
        let rowCount = 0;

        const request = new this.RequestClass!(sql, (err: any, rc: number) => {
          if (err) {
            conn.close();
            return reject(err);
          }
          rowCount = rc;
          conn.close();
          resolve({ rows, rowCount });
        });

        parameters.forEach(p => {
          const type = this.TYPES[p.sqlType] || this.TYPES.VarChar;
          request.addParameter(p.name, type, p.value);
        });

        request.on('row', (columns: any[]) => {
          const row: any = {};
          columns.forEach(col => {
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
  private static executeTransaction(
    sql: string,
    parameters: Parameter[],
    transaction: Transaction
  ): Promise<{ rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      let rowCount = 0;

      const request = new this.RequestClass!(sql, (err: any, rc: number) => {
        if (err) return reject(err);
        rowCount = rc;
        resolve({ rows, rowCount });
      });

      parameters.forEach(p => {
        const type = this.TYPES[p.sqlType] || this.TYPES.VarChar;
        request.addParameter(p.name, type, p.value);
      });

      request.on('row', (columns: any[]) => {
        const row: any = {};
        columns.forEach(col => {
          row[col.metadata.colName] = col.value;
        });
        rows.push(row);
      });

      transaction.client.execSql(request);
    });
  }

  // ====================== CRUD 方法 ======================

  static findAll(params: QueryParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarParameter.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters)
    ).catch(err => {
        console.error('Query entity error:', err);
        return Promise.reject(err);
      });
  }

  static findList(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; recordsTotal: any }> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarParameter.getParameters(params);
    const sql = `SELECT ${p.select} FROM ${tableName} t ${p.where} ${p.orderBy} ${p.limit};`;
    const countSql = `SELECT COUNT(0) AS total FROM ${tableName} t ${p.where};`;

    const exec = option.transaction
      ? (q: string, params: Parameter[]) => this.executeTransaction(q, params, option.transaction!)
      : this.execute.bind(this);

    return Promise.all([
      exec(sql, p.parameters!),
      exec(countSql, p.parameters),
    ]).then(([dataRes, countRes]) => ({
        data: dataRes.rows,
        recordsTotal: countRes.rows[0]?.total ?? 0,
      }))
      .catch(err => {
        console.error('Query list error:', err);
        return Promise.reject(err);
      });
  }

  static find(params: QueryParams, option: QueryOption = { transaction: null }): Promise<{ data: any[]; isLastPage: boolean }> {
    const tableName = validateIdentifier(params.configs.tableName);
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1;
    const p = GrammarParameter.getParameters({ ...params, limit: [limit[0], fetchCount] });
    const sql = `SELECT ${p.select} FROM ${tableName} AS t ${p.where} ${p.orderBy} ${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction)
      : this.execute(sql, p.parameters)
    )
      .then(result => {
        const rows = result.rows;
        const isLastPage = rows.length <= limit[1];
        return {
          data: isLastPage ? rows : rows.slice(0, -1),
          isLastPage,
        };
      })
      .catch(err => {
        console.error('Waterfall query error:', err);
        return Promise.reject(err);
      });
  }

  static insert(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const insertion = params.insertion as Record<string, any>;
    const p: Parameter[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (const key in insertion) {
      f.push(validateIdentifier(key));
      index++;
      const paramName = `${key}${index}`;
      s.push(`@${paramName}`);
      p.push({
        name: paramName,
        sqlType: this.getSqlType(key, params.configs.fields || []),
        value: insertion[key],
      });
    }

    const sql = `INSERT INTO ${tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;

    return (option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p)
    ).then(data => ({ ...insertion, _returns: data }));
  }

  static inserts(params: InsertParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const list = params.insertion as Array<Record<string, any>>;
    const p: Parameter[] = [], f: string[] = [], s: string[] = [];
    let index = 0;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const s2: string[] = [];
      for (const key in item) {
        if (i === 0) f.push(validateIdentifier(key));
        index++;
        const paramName = `${key}${index}`;
        s2.push(`@${paramName}`);
        p.push({
          name: paramName,
          sqlType: this.getSqlType(key, params.configs.fields || []),
          value: item[key],
        });
      }
      s.push(`(${s2.join(', ')})`);
    }

    const sql = `INSERT INTO ${tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;

    return option.transaction
      ? this.executeTransaction(sql, p, option.transaction)
      : this.execute(sql, p);
  }

  static delete(params: DeleteParams, option: QueryOption = { transaction: null }): Promise<any> {
    if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
      return Promise.reject('Deletion conditions required to prevent full table deletion.');
    }

    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarParameter.getDeleteParameters(params);
    const sql = `DELETE FROM ${tableName} WHERE ${p.where};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static update(params: UpdateParams, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarParameter.getUpdateParameters(params);
    const sql = `UPDATE ${tableName} SET ${p.set.join(', ')} WHERE ${p.where}${p.limit};`;

    return option.transaction
      ? this.executeTransaction(sql, p.parameters, option.transaction)
      : this.execute(sql, p.parameters);
  }

  static aggregate(params: QueryParams & { aggregate: AggregateItem[] }, option: QueryOption = { transaction: null }): Promise<any> {
    const tableName = validateIdentifier(params.configs.tableName);
    const p = GrammarParameter.getParameters(params);
    const check: Record<string, string> = { count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG' };
    const show: string[] = [];

    for (const agg of params.aggregate) {
      const fn = check[agg.function.toLowerCase()];
      if (fn) show.push(`${fn}(${validateIdentifier(agg.field)}) AS ${validateIdentifier(agg.name)}`);
    }

    const sql = `SELECT ${show.join(', ')} FROM ${tableName} ${p.where}${p.limit};`;

    return (option.transaction
      ? this.executeTransaction(sql, p.parameters!, option.transaction).then(r => r.rows)
      : this.execute(sql, p.parameters).then(r => r.rows)
    );
  }

  static sql(sql: string, parameters: Parameter[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    return (option.transaction
      ? this.executeTransaction(sql, parameters, option.transaction).then(r => r.rows)
      : this.execute(sql, parameters).then(r => r.rows)
    ).catch(err => {
      console.error('Custom SQL error:', err);
      return Promise.reject(err);
    });
  }

  private static getSqlType(fieldName: string, fields: FieldConfig[]): string {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return 'VarChar';
    return GrammarParameter.sqlTypeHandle(field.type);
  }
}

export { SQLServerActionManager };