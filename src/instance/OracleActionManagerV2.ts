/**
 * OracleActionManager V2 - Oracle 数据库适配器
 * 继承自 AbstractActionManager，减少代码重复
 * 支持 Oracle 11g+, 12c+, 19c+
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
 * OracleDB 连接池接口
 */
interface OraclePool {
  getConnection(): Promise<OracleConnection>;
  close(drainTime?: number): Promise<void>;
}

/**
 * OracleDB 连接接口
 */
interface OracleConnection {
  execute(sql: string, params?: any[], options?: any): Promise<OracleResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

/**
 * OracleDB 查询结果接口
 */
interface OracleResult {
  rows?: any[];
  metaData?: Array<{ name: string }>;
  rowsAffected?: number;
  lastRowid?: string;
  outBinds?: any;
}

/**
 * Oracle 操作管理器（重构版）
 */
export class OracleActionManagerV2 extends AbstractActionManager {
  protected dbType = 'oracle';
  private static _pool: OraclePool | null = null;
  private static _oracledb: any = null;
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 初始化连接池
   * @param config Oracle 配置
   * @param oracledbModule oracledb 模块
   */
  static async init(config: any, oracledbModule?: any): Promise<void> {
    let oracledb = oracledbModule;

    // 动态导入 oracledb
    if (!oracledb) {
      try {
        oracledb = await import('oracledb');
      } catch {
        throw new Error('oracledb module not found. Install it: npm install oracledb');
      }
    }

    this._oracledb = oracledb;

    // 设置 Oracle 客户端输出模式为对象
    if (oracledb.OUT_FORMAT_OBJECT !== undefined) {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    }

    // 情况1: 传入已创建的连接池
    if (config?.getConnection && config?.close) {
      this._pool = config as unknown as OraclePool;
      return;
    }

    // 情况2: 创建连接池
    const poolConfig = {
      user: config.user,
      password: config.password,
      connectString: config.connectString || `${config.host || 'localhost'}:${config.port || 1521}/${config.database || config.sid || 'XE'}`,
      poolMin: config.poolMin || 2,
      poolMax: config.poolMax || 10,
      poolIncrement: config.poolIncrement || 1,
    };

    this._pool = await oracledb.createPool(poolConfig);
  }

  /**
   * 实例方法：初始化
   */
  init(config: any, moduleOrPool?: any): void | Promise<void> {
    return OracleActionManagerV2.init(config, moduleOrPool);
  }

  /**
   * 获取连接池
   */
  private static getPool(): OraclePool {
    if (!this._pool) {
      throw new Error('Oracle connection pool not initialized. Call OracleActionManagerV2.init() first.');
    }
    return this._pool;
  }

  /**
   * 创建事务
   */
  static async createTransaction(): Promise<Transaction> {
    const pool = this.getPool();
    const connection = await pool.getConnection();

    // Oracle 默认自动提交关闭，事务自动开始
    const transaction: Transaction = {
      client: connection,
      begin: async () => {
        // Oracle 事务隐式开始，无需显式 BEGIN
      },
      commit: async () => {
        try {
          await connection.commit();
          return 'Transaction committed';
        } finally {
          await connection.close();
        }
      },
      rollback: async () => {
        try {
          await connection.rollback();
          return 'Transaction rolled back';
        } finally {
          await connection.close();
        }
      },
    };

    return transaction;
  }

  /**
   * 实例方法：创建事务
   */
  createTransaction(): Promise<Transaction> {
    return OracleActionManagerV2.createTransaction();
  }

  /**
   * 执行 SQL 查询
   * Oracle 使用 :1, :2 格式的占位符
   */
  protected async execute(sql: string, params: any[]): Promise<any> {
    const pool = OracleActionManagerV2.getPool();
    const connection = await pool.getConnection();
    try {
      const options: any = {
        outFormat: OracleActionManagerV2._oracledb?.OUT_FORMAT_OBJECT,
      };

      // DML 语句需要自动提交
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (!isSelect) {
        options.autoCommit = true;
      }

      const result = await connection.execute(sql, params, options);
      return result;
    } finally {
      await connection.close();
    }
  }

  /**
   * 静态执行方法
   */
  private static async executeSQL(sql: string, params: any[]): Promise<any> {
    const pool = this.getPool();
    const connection = await pool.getConnection();
    try {
      const options: any = {
        outFormat: this._oracledb?.OUT_FORMAT_OBJECT,
      };

      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (!isSelect) {
        options.autoCommit = true;
      }

      return await connection.execute(sql, params, options);
    } finally {
      await connection.close();
    }
  }

  /**
   * 在事务中执行 SQL
   */
  protected async executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any> {
    const connection = transaction.client as OracleConnection;
    const options: any = {
      outFormat: OracleActionManagerV2._oracledb?.OUT_FORMAT_OBJECT,
      autoCommit: false,
    };
    return connection.execute(sql, params, options);
  }

  /**
   * 静态事务执行方法
   */
  private static async executeInTx(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any> {
    const connection = transaction.client as OracleConnection;
    const options: any = {
      outFormat: this._oracledb?.OUT_FORMAT_OBJECT,
      autoCommit: false,
    };
    return connection.execute(sql, params, options);
  }

  /**
   * 规范化查询结果
   */
  protected normalizeQueryResult(rawResult: any): QueryResultData {
    const rows = rawResult?.rows || [];
    return {
      rows,
      affectedRows: rawResult?.rowsAffected,
    };
  }

  /**
   * 规范化插入结果
   */
  protected normalizeInsertResult(rawResult: any, data: any): InsertResult {
    return {
      ...data,
      affectedRows: rawResult?.rowsAffected ?? 1,
      _returns: rawResult,
    };
  }

  /**
   * 规范化修改结果
   */
  protected normalizeModifyResult(rawResult: any): ModifyResult {
    return {
      affectedRows: rawResult?.rowsAffected ?? 0,
    };
  }

  /**
   * 关闭连接池
   */
  static async close(): Promise<void> {
    if (this._pool) {
      await this._pool.close(0);
      this._pool = null;
    }
  }

  async close(): Promise<void> {
    return OracleActionManagerV2.close();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.execute('SELECT 1 FROM DUAL', []);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== 静态方法（保持向后兼容） ====================

  static async findAll(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.findAll(params, option);
  }

  static async findList(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.findList(params, option);
  }

  static async find(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.find(params, option);
  }

  static async insert(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.insert(params, option);
  }

  static async inserts(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.inserts(params, option);
  }

  static async delete(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.delete(params, option);
  }

  static async update(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
    return instance.update(params, option);
  }

  static async aggregate(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new OracleActionManagerV2();
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
export { OracleActionManagerV2 as OracleActionManager };
