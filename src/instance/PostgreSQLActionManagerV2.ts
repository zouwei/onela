/**
 * PostgreSQLActionManager V2 - 重构后的 PostgreSQL 适配器
 * 继承自 AbstractActionManager，减少代码重复
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
 * PostgreSQL 连接池类型
 */
interface PGPool {
  connect(): Promise<PGClient>;
  query(sql: string, params?: any[]): Promise<PGResult>;
  end(): Promise<void>;
}

/**
 * PostgreSQL 客户端类型
 */
interface PGClient {
  query(sql: string, params?: any[]): Promise<PGResult>;
  release(): void;
}

/**
 * PostgreSQL 查询结果类型
 */
interface PGResult {
  rows: any[];
  rowCount: number;
  fields?: any[];
}

/**
 * PostgreSQL 操作管理器（重构版）
 */
export class PostgreSQLActionManagerV2 extends AbstractActionManager {
  protected dbType = 'postgresql';
  private static _pool: PGPool | null = null;
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 初始化连接池
   * @param config PostgreSQL 配置
   * @param pgModuleOrPool pg 模块或已创建的连接池
   */
  static init(config: any, pgModuleOrPool?: any): void | Promise<void> {
    // 情况1: 传入 pg 模块 { Pool }
    if (pgModuleOrPool?.Pool) {
      this._pool = new pgModuleOrPool.Pool(config);
      return;
    }

    // 情况2: 传入 Pool 类
    if (typeof pgModuleOrPool === 'function') {
      this._pool = new pgModuleOrPool(config);
      return;
    }

    // 情况3: 传入已创建的 Pool 实例
    if (pgModuleOrPool?.connect && pgModuleOrPool?.query) {
      this._pool = pgModuleOrPool;
      return;
    }

    // 情况4: 动态导入 pg
    return import('pg')
      .then((module) => {
        const Pool = module.Pool;
        this._pool = new Pool(config) as unknown as PGPool;
      })
      .catch(() => {
        throw new Error('pg module not found. Install it: npm install pg');
      });
  }

  /**
   * 实例方法：初始化
   */
  init(config: any, moduleOrPool?: any): void | Promise<void> {
    return PostgreSQLActionManagerV2.init(config, moduleOrPool);
  }

  /**
   * 获取连接池
   */
  private static getPool(): PGPool {
    if (!this._pool) {
      throw new Error('PostgreSQL connection pool not initialized. Call PostgreSQLActionManagerV2.init() first.');
    }
    return this._pool;
  }

  /**
   * 创建事务
   */
  static async createTransaction(): Promise<Transaction> {
    const pool = this.getPool();
    const client = await pool.connect();

    const transaction: Transaction = {
      client,
      begin: async () => {
        await client.query('BEGIN');
      },
      commit: async () => {
        try {
          await client.query('COMMIT');
          return 'Transaction committed';
        } finally {
          client.release();
        }
      },
      rollback: async () => {
        try {
          await client.query('ROLLBACK');
          return 'Transaction rolled back';
        } finally {
          client.release();
        }
      },
    };

    return transaction;
  }

  /**
   * 实例方法：创建事务
   */
  createTransaction(): Promise<Transaction> {
    return PostgreSQLActionManagerV2.createTransaction();
  }

  /**
   * 执行 SQL 查询
   */
  protected async execute(sql: string, params: any[]): Promise<PGResult> {
    const pool = PostgreSQLActionManagerV2.getPool();
    return pool.query(sql, params);
  }

  /**
   * 静态执行方法
   */
  private static async execute(sql: string, params: any[]): Promise<PGResult> {
    const pool = this.getPool();
    return pool.query(sql, params);
  }

  /**
   * 在事务中执行 SQL
   */
  protected async executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<PGResult> {
    const client = transaction.client as PGClient;
    return client.query(sql, params);
  }

  /**
   * 静态事务执行方法
   */
  private static async executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<PGResult> {
    const client = transaction.client as PGClient;
    return client.query(sql, params);
  }

  /**
   * 规范化查询结果
   * PostgreSQL 返回 { rows, rowCount, fields }
   */
  protected normalizeQueryResult(rawResult: any): QueryResultData {
    return {
      rows: rawResult?.rows || [],
      fields: rawResult?.fields,
      affectedRows: rawResult?.rowCount,
    };
  }

  /**
   * 规范化插入结果
   * PostgreSQL 需要使用 RETURNING 获取插入的 ID
   */
  protected normalizeInsertResult(rawResult: any, data: any): InsertResult {
    const rows = rawResult?.rows || [];
    const firstRow = rows[0] || {};

    return {
      ...data,
      ...firstRow, // 包含 RETURNING 返回的字段
      insertId: firstRow.id || firstRow.ID || rawResult?.insertId,
      affectedRows: rawResult?.rowCount ?? 1,
      _returns: rawResult,
    };
  }

  /**
   * 规范化修改结果
   */
  protected normalizeModifyResult(rawResult: any): ModifyResult {
    return {
      affectedRows: rawResult?.rowCount ?? 0,
    };
  }

  /**
   * 关闭连接池
   */
  static async close(): Promise<void> {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
    }
  }

  async close(): Promise<void> {
    return PostgreSQLActionManagerV2.close();
  }

  // ==================== 静态方法（保持向后兼容） ====================

  static async findAll(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.findAll(params, option);
  }

  static async findList(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.findList(params, option);
  }

  static async find(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.find(params, option);
  }

  static async insert(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.insert(params, option);
  }

  static async inserts(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.inserts(params, option);
  }

  static async delete(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.delete(params, option);
  }

  static async update(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
    return instance.update(params, option);
  }

  static async aggregate(params: any, option: QueryOption = { transaction: null }): Promise<any> {
    const instance = new PostgreSQLActionManagerV2();
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
export { PostgreSQLActionManagerV2 as PostgreSQLActionManager };
