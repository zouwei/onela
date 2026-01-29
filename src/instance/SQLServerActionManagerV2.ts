/**
 * SQLServerActionManager V2 - 重构后的 SQL Server 适配器
 * 继承自 AbstractActionManager，减少代码重复
 * 支持 SQL Server 2012+
 */

import { AbstractActionManager } from '../abstract/AbstractActionManager.js';
import type {
  QueryResultData,
  InsertResult,
  ModifyResult,
} from '../interfaces/IActionManager.js';
import type { Transaction, QueryOption, FieldConfig } from '../types/onela.js';
import { SQLBuilder } from '../builders/SQLBuilder.js';

/**
 * SQL Server 连接配置
 */
interface SQLServerConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  encrypt?: boolean;
}

/**
 * SQL Server 操作管理器（重构版）
 */
export class SQLServerActionManagerV2 extends AbstractActionManager {
  protected dbType = 'sqlserver';
  private static ConnectionClass: any = null;
  private static RequestClass: any = null;
  private static TYPES: any = null;
  private static connectionCfg: any = null;
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 初始化连接配置
   * @param config SQL Server 配置
   * @param tediousModule tedious 模块
   */
  static init(config: SQLServerConfig, tediousModule?: any): void | Promise<void> {
    // 情况1: 传入 tedious 模块
    if (tediousModule?.Connection && tediousModule?.Request && tediousModule?.TYPES) {
      this.setupConnection(config, tediousModule.Connection, tediousModule.Request, tediousModule.TYPES);
      return;
    }

    // 情况2: 动态导入 tedious
    return import('tedious')
      .then((module) => {
        this.setupConnection(config, module.Connection, module.Request, module.TYPES);
      })
      .catch(() => {
        throw new Error('tedious module not found. Install it: npm install tedious');
      });
  }

  /**
   * 设置连接配置
   */
  private static setupConnection(
    config: SQLServerConfig,
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
        trustServerCertificate: true,
      },
    };
  }

  /**
   * 实例方法：初始化
   */
  init(config: any, moduleOrPool?: any): void | Promise<void> {
    return SQLServerActionManagerV2.init(config, moduleOrPool);
  }

  /**
   * 创建事务
   */
  static createTransaction(): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      if (!this.ConnectionClass || !this.connectionCfg) {
        return reject(new Error('SQL Server not initialized. Call SQLServerActionManagerV2.init() first.'));
      }

      const conn = new this.ConnectionClass(this.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) return reject(err);

        const transaction: Transaction = {
          client: conn,
          begin: () => {
            return new Promise<void>((res, rej) => {
              conn.beginTransaction((err: any) => {
                if (err) rej(err);
                else res();
              });
            });
          },
          commit: () => {
            return new Promise<string>((res, rej) => {
              conn.commitTransaction((err: any) => {
                if (err) rej(err);
                else {
                  conn.close();
                  res('Transaction committed');
                }
              });
            });
          },
          rollback: () => {
            return new Promise<string>((res, rej) => {
              conn.rollbackTransaction((err: any) => {
                if (err) rej(err);
                else {
                  conn.close();
                  res('Transaction rolled back');
                }
              });
            });
          },
        };

        resolve(transaction);
      });

      conn.connect();
    });
  }

  /**
   * 实例方法：创建事务
   */
  createTransaction(): Promise<Transaction> {
    return SQLServerActionManagerV2.createTransaction();
  }

  /**
   * 执行 SQL 查询（每次新建连接）
   * SQL Server 使用 tedious 的 Connection + Request 模式
   */
  protected execute(sql: string, params: any[]): Promise<any> {
    return SQLServerActionManagerV2.executeSQL(sql, params);
  }

  /**
   * 静态执行方法
   * SQL Server 使用 @pn 占位符，需要将 ? 转换为 @p1, @p2 格式
   */
  private static executeSQL(sql: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ConnectionClass || !this.connectionCfg) {
        return reject(new Error('SQL Server not initialized'));
      }

      const conn = new this.ConnectionClass(this.connectionCfg);
      conn.on('connect', (err: any) => {
        if (err) return reject(err);

        const rows: any[] = [];
        let rowCount = 0;

        // 将 SQLBuilder 生成的 @p1, @p2 占位符格式的 SQL 直接执行
        const request = new this.RequestClass(sql, (err: any, rc: number) => {
          if (err) {
            conn.close();
            return reject(err);
          }
          rowCount = rc;
          conn.close();

          // SELECT 返回行数组，其他返回影响行数
          const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
          if (isSelect) {
            resolve(rows);
          } else {
            resolve({ affectedRows: rowCount, rows });
          }
        });

        // 添加参数（使用 @p1, @p2... 格式）
        params.forEach((value, index) => {
          const paramName = `p${index + 1}`;
          const type = this.inferType(value);
          request.addParameter(paramName, type, value);
        });

        request.on('row', (columns: any[]) => {
          const row: any = {};
          columns.forEach((col) => {
            row[col.metadata.colName] = col.value;
          });
          rows.push(row);
        });

        conn.execSql(request);
      });

      conn.connect();
    });
  }

  /**
   * 在事务中执行 SQL
   */
  protected executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any> {
    return SQLServerActionManagerV2.executeInTx(sql, params, transaction);
  }

  /**
   * 静态事务执行方法
   */
  private static executeInTx(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      let rowCount = 0;

      const request = new this.RequestClass(sql, (err: any, rc: number) => {
        if (err) return reject(err);
        rowCount = rc;

        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
        if (isSelect) {
          resolve(rows);
        } else {
          resolve({ affectedRows: rowCount, rows });
        }
      });

      params.forEach((value, index) => {
        const paramName = `p${index + 1}`;
        const type = this.inferType(value);
        request.addParameter(paramName, type, value);
      });

      request.on('row', (columns: any[]) => {
        const row: any = {};
        columns.forEach((col) => {
          row[col.metadata.colName] = col.value;
        });
        rows.push(row);
      });

      transaction.client.execSql(request);
    });
  }

  /**
   * 根据值推断 tedious 类型
   */
  private static inferType(value: any): any {
    if (!this.TYPES) return null;
    if (value === null || value === undefined) return this.TYPES.NVarChar;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? this.TYPES.Int : this.TYPES.Float;
    }
    if (typeof value === 'boolean') return this.TYPES.Bit;
    if (value instanceof Date) return this.TYPES.DateTime;
    return this.TYPES.NVarChar;
  }

  /**
   * 规范化查询结果
   */
  protected normalizeQueryResult(rawResult: any): QueryResultData {
    const rows = Array.isArray(rawResult) ? rawResult : (rawResult?.rows || []);
    return {
      rows,
      affectedRows: rawResult?.affectedRows,
    };
  }

  /**
   * 规范化插入结果
   */
  protected normalizeInsertResult(rawResult: any, data: any): InsertResult {
    return {
      ...data,
      affectedRows: rawResult?.affectedRows ?? 1,
      _returns: rawResult,
    };
  }

  /**
   * 规范化修改结果
   */
  protected normalizeModifyResult(rawResult: any): ModifyResult {
    return {
      affectedRows: rawResult?.affectedRows ?? 0,
    };
  }

  /**
   * 关闭连接（SQL Server 每次创建新连接，无需池管理）
   */
  static close(): Promise<void> {
    this.ConnectionClass = null;
    this.RequestClass = null;
    this.TYPES = null;
    this.connectionCfg = null;
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return SQLServerActionManagerV2.close();
  }

  // ==================== 静态方法（保持向后兼容） ====================

  static async findAll(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.findAll(params, option);
  }

  static async findList(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.findList(params, option);
  }

  static async find(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.find(params, option);
  }

  static async insert(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.insert(params, option);
  }

  static async inserts(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.inserts(params, option);
  }

  static async delete(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.delete(params, option);
  }

  static async update(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.update(params, option);
  }

  static async aggregate(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLServerActionManagerV2();
    return instance.aggregate(params, option);
  }

  static async sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeInTx(sql, parameters, option.transaction);
    }
    return this.executeSQL(sql, parameters);
  }
}

// 导出别名
export { SQLServerActionManagerV2 as SQLServerActionManager };
