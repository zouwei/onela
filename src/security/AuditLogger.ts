/**
 * AuditLogger - 操作审计日志
 * 记录所有数据库操作，支持审计追踪
 * 适用于安全审计和 AI 操作追踪
 */

import type { OperationType } from './OperationGuard.js';

/**
 * 审计日志条目
 */
export interface AuditEntry {
  /** 唯一ID */
  id: string;
  /** 时间戳 */
  timestamp: Date;
  /** 操作类型 */
  operation: OperationType;
  /** 表名 */
  tableName: string;
  /** 引擎标识 */
  engine: string;
  /** 操作者标识（可选） */
  operator?: string;
  /** SQL 语句（脱敏后） */
  sql?: string;
  /** 影响行数 */
  affectedRows?: number;
  /** 执行耗时（毫秒） */
  duration?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 审计日志存储接口
 */
export interface IAuditStore {
  /** 写入日志 */
  write(entry: AuditEntry): void | Promise<void>;
  /** 查询日志 */
  query?(filter: AuditFilter): Promise<AuditEntry[]>;
}

/**
 * 审计日志过滤条件
 */
export interface AuditFilter {
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 操作类型 */
  operation?: OperationType;
  /** 表名 */
  tableName?: string;
  /** 操作者 */
  operator?: string;
  /** 仅失败 */
  failedOnly?: boolean;
  /** 最大条数 */
  limit?: number;
}

/**
 * 审计日志配置
 */
export interface AuditLoggerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 需要审计的操作类型（默认全部） */
  operations?: OperationType[];
  /** 需要审计的表（不设置则全部） */
  tables?: string[];
  /** 是否记录 SQL */
  logSQL: boolean;
  /** SQL 最大长度（超出截断） */
  maxSQLLength: number;
  /** 存储后端 */
  store: IAuditStore;
}

/**
 * 内存审计日志存储（默认实现）
 */
export class MemoryAuditStore implements IAuditStore {
  private entries: AuditEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  write(entry: AuditEntry): void {
    this.entries.push(entry);
    // 超出上限时淘汰最早的记录
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(-this.maxSize);
    }
  }

  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    let result = [...this.entries];

    if (filter.startTime) {
      result = result.filter((e) => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      result = result.filter((e) => e.timestamp <= filter.endTime!);
    }
    if (filter.operation) {
      result = result.filter((e) => e.operation === filter.operation);
    }
    if (filter.tableName) {
      result = result.filter((e) => e.tableName === filter.tableName);
    }
    if (filter.operator) {
      result = result.filter((e) => e.operator === filter.operator);
    }
    if (filter.failedOnly) {
      result = result.filter((e) => !e.success);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 获取所有条目（用于调试）
   */
  getAll(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * 清空
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 获取条目数量
   */
  get size(): number {
    return this.entries.length;
  }
}

/**
 * 审计日志器
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private idCounter: number = 0;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      enabled: true,
      logSQL: true,
      maxSQLLength: 2000,
      store: new MemoryAuditStore(),
      ...config,
    };
  }

  /**
   * 记录操作
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return;

    // 检查是否需要审计此操作
    if (this.config.operations && !this.config.operations.includes(entry.operation)) {
      return;
    }

    // 检查是否需要审计此表
    if (this.config.tables && !this.config.tables.includes(entry.tableName)) {
      return;
    }

    const fullEntry: AuditEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // SQL 截断
    if (fullEntry.sql && fullEntry.sql.length > this.config.maxSQLLength) {
      fullEntry.sql = fullEntry.sql.substring(0, this.config.maxSQLLength) + '...[TRUNCATED]';
    }

    // SQL 脱敏（不记录 SQL 时）
    if (!this.config.logSQL) {
      delete fullEntry.sql;
    }

    await this.config.store.write(fullEntry);
  }

  /**
   * 查询审计日志
   */
  async query(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    if (this.config.store.query) {
      return this.config.store.query(filter);
    }
    return [];
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    this.idCounter++;
    return `audit_${Date.now()}_${this.idCounter}`;
  }

  /**
   * 启用/禁用审计
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 获取配置
   */
  getConfig(): AuditLoggerConfig {
    return { ...this.config };
  }
}

/**
 * 工厂函数
 */
export function createAuditLogger(
  config?: Partial<AuditLoggerConfig>
): AuditLogger {
  return new AuditLogger(config);
}
