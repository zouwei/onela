/**
 * MySQLActionManager V2 - 重构后的 MySQL 适配器
 * 继承自 AbstractActionManager，减少代码重复
 * 支持 MySQL 5.7+, 8.0+, MariaDB, TiDB, OceanBase, PolarDB
 */

import {
  AbstractActionManager,
  type ConnectionPool,
} from '../abstract/AbstractActionManager.js';
import type {
  QueryResultData,
  InsertResult,
  ModifyResult,
} from '../interfaces/IActionManager.js';
import type { Transaction, QueryOption } from '../types/onela.js';
import { SQLBuilder } from '../builders/SQLBuilder.js';

/**
 * MySQL 连接池类型
 */
interface MySQLPool {
  getConnection(callback: (err: any, connection: MySQLConnection) => void): void;
  query(sql: string, params: any[], callback: (err: any, results: any) => void): void;
  end(callback?: (err: any) => void): void;
}

/**
 * MySQL 连接类型
 */
interface MySQLConnection {
  query(sql: string, params: any[], callback: (err: any, results: any) => void): void;
  beginTransaction(callback: (err: any) => void): void;
  commit(callback: (err: any) => void): void;
  rollback(callback: (err: any) => void): void;
  release(): void;
}

/**
 * MySQL 操作管理器（重构版）
 */
export class MySQLActionManagerV2 extends AbstractActionManager {
  protected dbType = 'mysql';
  private static _pool: MySQLPool | null = null;
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 初始化连接池
   * @param config MySQL 配置
   * @param mysqlModuleOrPool mysql 模块或已创建的连接池
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
      this._pool = mysqlModuleOrPool;
      return;
    }

    // 情况4: 动态导入 mysql 或 mysql2
    if (!createPool) {
      return import('mysql')
        .catch(() => import('mysql2'))
        .then((module: any) => {
          createPool = module.createPool || module.default?.createPool;
          if (!createPool) throw new Error('Invalid mysql module');
          this._pool = createPool(config);
        })
        .catch(() => {
          throw new Error('mysql module not found. Install it: npm install mysql or npm install mysql2');
        });
    }

    // 使用传入的 createPool 创建实例
    this._pool = createPool(config);
  }

  /**
   * 实例方法：初始化（委托给静态方法）
   */
  init(config: any, moduleOrPool?: any): void | Promise<void> {
    return MySQLActionManagerV2.init(config, moduleOrPool);
  }

  /**
   * 获取连接池
   */
  private static getPool(): MySQLPool {
    if (!this._pool) {
      throw new Error('MySQL connection pool not initialized. Call MySQLActionManagerV2.init() first.');
    }
    return this._pool;
  }

  /**
   * 创建事务
   */
  static createTransaction(): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const pool = this.getPool();

      pool.getConnection((err: any, connection: MySQLConnection) => {
        if (err) {
          return reject(new Error(`Failed to get MySQL connection: ${err.message}`));
        }

        const transaction: Transaction = {
          client: connection,
          begin: () => {
            return new Promise<void>((res, rej) => {
              connection.beginTransaction((err: any) => {
                if (err) rej(err);
                else res();
              });
            });
          },
          commit: () => {
            return new Promise<string>((res, rej) => {
              connection.commit((err: any) => {
                if (err) {
                  rej(err);
                } else {
                  connection.release();
                  res('Transaction committed');
                }
              });
            });
          },
          rollback: () => {
            return new Promise<string>((res, rej) => {
              connection.rollback((err: any) => {
                if (err) {
                  rej(err);
                } else {
                  connection.release();
                  res('Transaction rolled back');
                }
              });
            });
          },
        };

        resolve(transaction);
      });
    });
  }

  /**
   * 实例方法：创建事务
   */
  createTransaction(): Promise<Transaction> {
    return MySQLActionManagerV2.createTransaction();
  }

  /**
   * 执行 SQL 查询
   */
  protected execute(sql: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pool = MySQLActionManagerV2.getPool();
      pool.query(sql, params, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * 静态执行方法
   */
  private static execute(sql: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pool = this.getPool();
      pool.query(sql, params, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
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
    return new Promise((resolve, reject) => {
      const connection = transaction.client as MySQLConnection;
      connection.query(sql, params, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * 静态事务执行方法
   */
  private static executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const connection = transaction.client as MySQLConnection;
      connection.query(sql, params, (err: any, results: any) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  /**
   * 规范化查询结果
   * MySQL 直接返回数组
   */
  protected normalizeQueryResult(rawResult: any): QueryResultData {
    // MySQL 返回的是数组
    const rows = Array.isArray(rawResult) ? rawResult : [];
    return {
      rows,
      affectedRows: rawResult?.affectedRows,
      insertId: rawResult?.insertId,
    };
  }

  /**
   * 规范化插入结果
   */
  protected normalizeInsertResult(rawResult: any, data: any): InsertResult {
    return {
      ...data,
      insertId: rawResult?.insertId,
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
      changedRows: rawResult?.changedRows,
    };
  }

  /**
   * 关闭连接池
   */
  static close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._pool) {
        this._pool.end((err: any) => {
          if (err) reject(err);
          else {
            this._pool = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async close(): Promise<void> {
    return MySQLActionManagerV2.close();
  }

  // ==================== 静态方法（保持向后兼容） ====================

  static async findAll(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    const result = await instance.findAll(params, option);
    // 返回带 rows 的格式以保持兼容性
    return result;
  }

  static async findList(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.findList(params, option);
  }

  static async find(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.find(params, option);
  }

  static async insert(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.insert(params, option);
  }

  static async inserts(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.inserts(params, option);
  }

  static async delete(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.delete(params, option);
  }

  static async update(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.update(params, option);
  }

  static async aggregate(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new MySQLActionManagerV2();
    return instance.aggregate(params, option);
  }

  static async sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeInTransaction(sql, parameters, option.transaction);
    }
    return this.execute(sql, parameters);
  }
}

// 导出别名以保持兼容性
export { MySQLActionManagerV2 as MySQLActionManager };
