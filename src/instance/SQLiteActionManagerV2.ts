/**
 * SQLiteActionManager V2 - 重构后的 SQLite 适配器
 * 继承自 AbstractActionManager，减少代码重复
 * 支持 SQLite 3.x（基于文件的轻量级数据库）
 */

import { AbstractActionManager } from '../abstract/AbstractActionManager.js';
import type {
  QueryResultData,
  InsertResult,
  ModifyResult,
} from '../interfaces/IActionManager.js';
import type { Transaction, QueryOption } from '../types/onela.js';
import { SQLBuilder } from '../builders/SQLBuilder.js';

/**
 * SQLite Database 接口
 */
interface SQLiteDB {
  run(sql: string, params: any[], callback: (this: any, err: any) => void): void;
  get(sql: string, params: any[], callback: (err: any, row: any) => void): void;
  all(sql: string, params: any[], callback: (err: any, rows: any[]) => void): void;
  close(callback?: (err: any) => void): void;
}

/**
 * SQLite 操作管理器（重构版）
 */
export class SQLiteActionManagerV2 extends AbstractActionManager {
  protected dbType = 'sqlite';
  private static _db: SQLiteDB | null = null;
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 初始化数据库连接
   * @param config SQLite 配置 { host: '数据库文件路径' }
   * @param sqlite3ModuleOrDb sqlite3 模块或已创建的 Database 实例
   */
  static init(config: { host: string }, sqlite3ModuleOrDb?: any): void | Promise<void> {
    // 情况1: 传入 sqlite3 模块 { Database, verbose }
    if (sqlite3ModuleOrDb?.Database && sqlite3ModuleOrDb?.verbose) {
      const SQLite3 = sqlite3ModuleOrDb.verbose();
      this._db = new SQLite3.Database(config.host) as unknown as SQLiteDB;
      return;
    }

    // 情况2: 传入 Database 类（构造函数）
    if (typeof sqlite3ModuleOrDb === 'function' && sqlite3ModuleOrDb.prototype?.run) {
      this._db = new sqlite3ModuleOrDb(config.host) as unknown as SQLiteDB;
      return;
    }

    // 情况3: 传入已创建的 Database 实例
    if (sqlite3ModuleOrDb?.run && sqlite3ModuleOrDb?.get && sqlite3ModuleOrDb?.all) {
      this._db = sqlite3ModuleOrDb as SQLiteDB;
      return;
    }

    // 情况4: 动态导入 sqlite3
    return import('sqlite3')
      .then((module) => {
        const SQLite3 = module.verbose();
        this._db = new SQLite3.Database(config.host) as unknown as SQLiteDB;
      })
      .catch(() => {
        throw new Error('sqlite3 module not found. Install it: npm install sqlite3');
      });
  }

  /**
   * 实例方法：初始化
   */
  init(config: any, moduleOrPool?: any): void | Promise<void> {
    return SQLiteActionManagerV2.init(config, moduleOrPool);
  }

  /**
   * 获取数据库实例
   */
  private static getDB(): SQLiteDB {
    if (!this._db) {
      throw new Error('SQLite not initialized. Call SQLiteActionManagerV2.init() first.');
    }
    return this._db;
  }

  /**
   * 创建事务
   */
  static createTransaction(): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const db = this.getDB();

      const transaction: Transaction = {
        client: db,
        begin: () => {
          return new Promise<void>((res, rej) => {
            db.run('BEGIN', [], function (err) {
              if (err) rej(err);
              else res();
            });
          });
        },
        commit: () => {
          return new Promise<string>((res, rej) => {
            db.run('COMMIT', [], function (err) {
              if (err) rej(err);
              else res('Transaction committed');
            });
          });
        },
        rollback: () => {
          return new Promise<string>((res, rej) => {
            db.run('ROLLBACK', [], function (err) {
              if (err) rej(err);
              else res('Transaction rolled back');
            });
          });
        },
      };

      resolve(transaction);
    });
  }

  /**
   * 实例方法：创建事务
   */
  createTransaction(): Promise<Transaction> {
    return SQLiteActionManagerV2.createTransaction();
  }

  /**
   * 执行 SQL 查询
   * SQLite 根据 SQL 类型自动选择 run/all
   */
  protected execute(sql: string, params: any[]): Promise<any> {
    const db = SQLiteActionManagerV2.getDB();
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

    return new Promise((resolve, reject) => {
      if (isSelect) {
        db.all(sql, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        db.run(sql, params, function (this: any, err: any) {
          if (err) reject(err);
          else resolve({
            lastID: this?.lastID,
            changes: this?.changes,
          });
        });
      }
    });
  }

  /**
   * 静态执行方法
   */
  private static execute(sql: string, params: any[]): Promise<any> {
    const db = this.getDB();
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

    return new Promise((resolve, reject) => {
      if (isSelect) {
        db.all(sql, params, (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        db.run(sql, params, function (this: any, err: any) {
          if (err) reject(err);
          else resolve({
            lastID: this?.lastID,
            changes: this?.changes,
          });
        });
      }
    });
  }

  /**
   * 在事务中执行 SQL（SQLite 单连接，事务内执行等同普通执行）
   */
  protected executeInTransaction(
    sql: string,
    params: any[],
    _transaction: Transaction
  ): Promise<any> {
    return this.execute(sql, params);
  }

  /**
   * 静态事务执行方法
   */
  private static executeInTransaction(
    sql: string,
    params: any[],
    _transaction: Transaction
  ): Promise<any> {
    return this.execute(sql, params);
  }

  /**
   * 规范化查询结果
   * SQLite all() 返回数组，run() 返回 { lastID, changes }
   */
  protected normalizeQueryResult(rawResult: any): QueryResultData {
    const rows = Array.isArray(rawResult) ? rawResult : [];
    return {
      rows,
      affectedRows: rawResult?.changes,
      insertId: rawResult?.lastID,
    };
  }

  /**
   * 规范化插入结果
   */
  protected normalizeInsertResult(rawResult: any, data: any): InsertResult {
    return {
      ...data,
      insertId: rawResult?.lastID,
      affectedRows: rawResult?.changes ?? 1,
      _returns: rawResult,
    };
  }

  /**
   * 规范化修改结果
   */
  protected normalizeModifyResult(rawResult: any): ModifyResult {
    return {
      affectedRows: rawResult?.changes ?? 0,
    };
  }

  /**
   * 关闭数据库连接
   */
  static close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._db) {
        this._db.close((err: any) => {
          if (err) reject(err);
          else {
            this._db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async close(): Promise<void> {
    return SQLiteActionManagerV2.close();
  }

  /**
   * 健康检查（覆盖默认实现）
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.execute('SELECT 1', []);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== 静态方法（保持向后兼容） ====================

  static async findAll(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.findAll(params, option);
  }

  static async findList(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.findList(params, option);
  }

  static async find(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.find(params, option);
  }

  static async insert(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.insert(params, option);
  }

  static async inserts(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.inserts(params, option);
  }

  static async delete(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.delete(params, option);
  }

  static async update(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.update(params, option);
  }

  static async aggregate(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new SQLiteActionManagerV2();
    return instance.aggregate(params, option);
  }

  static async sql(sql: string, parameters: any[] = [], option: QueryOption = { transaction: null }): Promise<any> {
    if (option.transaction) {
      return this.executeInTransaction(sql, parameters, option.transaction);
    }
    return this.execute(sql, parameters);
  }
}

// 导出别名
export { SQLiteActionManagerV2 as SQLiteActionManager };
