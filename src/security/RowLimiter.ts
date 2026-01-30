/**
 * RowLimiter - 行级操作限制
 * 限制单次操作影响的最大行数，防止误操作
 * 适用于 AI 场景下的安全防护
 */

import type { OperationType } from './OperationGuard.js';

/**
 * 行限制配置
 */
export interface RowLimitConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 全局默认限制 */
  defaultLimits: Partial<Record<OperationType, number>>;
  /** 表级别限制（覆盖全局） */
  tableLimits?: Record<string, Partial<Record<OperationType, number>>>;
  /** 违规时的回调 */
  onViolation?: (tableName: string, operation: OperationType, requested: number, limit: number) => void;
}

/**
 * 行限制检查结果
 */
export interface RowLimitResult {
  /** 是否通过 */
  allowed: boolean;
  /** 限制值 */
  limit: number;
  /** 请求值 */
  requested: number;
  /** 原因 */
  reason?: string;
}

/**
 * 行级操作限制器
 */
export class RowLimiter {
  private config: RowLimitConfig;

  constructor(config: Partial<RowLimitConfig> = {}) {
    this.config = {
      enabled: true,
      defaultLimits: {
        select: 10000,
        delete: 1000,
        update: 1000,
        insert: 5000,
      },
      ...config,
    };
  }

  /**
   * 检查行数是否在限制内
   */
  check(tableName: string, operation: OperationType, rowCount: number): RowLimitResult {
    if (!this.config.enabled) {
      return { allowed: true, limit: Infinity, requested: rowCount };
    }

    const limit = this.getLimit(tableName, operation);
    if (limit === undefined || limit === Infinity) {
      return { allowed: true, limit: Infinity, requested: rowCount };
    }

    if (rowCount > limit) {
      this.config.onViolation?.(tableName, operation, rowCount, limit);
      return {
        allowed: false,
        limit,
        requested: rowCount,
        reason: `Operation "${operation}" on table "${tableName}" would affect ${rowCount} rows, exceeding limit of ${limit}`,
      };
    }

    return { allowed: true, limit, requested: rowCount };
  }

  /**
   * 断言行数在限制内
   */
  assert(tableName: string, operation: OperationType, rowCount: number): void {
    const result = this.check(tableName, operation, rowCount);
    if (!result.allowed) {
      throw new Error(result.reason);
    }
  }

  /**
   * 获取指定表和操作的行限制
   */
  getLimit(tableName: string, operation: OperationType): number | undefined {
    // 表级别限制优先
    const tableLimit = this.config.tableLimits?.[tableName]?.[operation];
    if (tableLimit !== undefined) return tableLimit;

    // 全局限制
    return this.config.defaultLimits[operation];
  }

  /**
   * 设置全局操作限制
   */
  setDefaultLimit(operation: OperationType, limit: number): void {
    this.config.defaultLimits[operation] = limit;
  }

  /**
   * 设置表级别操作限制
   */
  setTableLimit(tableName: string, operation: OperationType, limit: number): void {
    if (!this.config.tableLimits) {
      this.config.tableLimits = {};
    }
    if (!this.config.tableLimits[tableName]) {
      this.config.tableLimits[tableName] = {};
    }
    this.config.tableLimits[tableName][operation] = limit;
  }

  /**
   * 获取用于 SELECT 查询的安全 LIMIT 值
   * 确保查询不会超过限制
   */
  getSafeSelectLimit(tableName: string, requestedLimit?: number): number {
    const maxLimit = this.getLimit(tableName, 'select') || 10000;
    if (requestedLimit === undefined || requestedLimit > maxLimit) {
      return maxLimit;
    }
    return requestedLimit;
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 获取配置
   */
  getConfig(): RowLimitConfig {
    return { ...this.config };
  }
}

/**
 * 工厂函数
 */
export function createRowLimiter(
  config?: Partial<RowLimitConfig>
): RowLimiter {
  return new RowLimiter(config);
}
