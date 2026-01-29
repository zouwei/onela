/**
 * OnelaError - 统一错误系统
 * 提供结构化错误码和分类，便于错误处理和国际化
 */

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 连接错误 (1xxx)
  CONNECTION_FAILED = 1001,
  CONNECTION_TIMEOUT = 1002,
  CONNECTION_POOL_EXHAUSTED = 1003,
  CONNECTION_CLOSED = 1004,
  NO_AVAILABLE_NODE = 1005,

  // 查询错误 (2xxx)
  QUERY_FAILED = 2001,
  QUERY_TIMEOUT = 2002,
  INVALID_SQL = 2003,
  INVALID_PARAMS = 2004,
  EMPTY_RESULT = 2005,

  // 配置错误 (3xxx)
  INVALID_CONFIG = 3001,
  MISSING_ENGINE = 3002,
  UNSUPPORTED_DB_TYPE = 3003,
  MISSING_FIELD = 3004,
  INVALID_TABLE_NAME = 3005,

  // 安全错误 (4xxx)
  SQL_INJECTION_DETECTED = 4001,
  OPERATION_NOT_ALLOWED = 4002,
  FIELD_ACCESS_DENIED = 4003,
  ROW_LIMIT_EXCEEDED = 4004,
  SECURITY_VIOLATION = 4005,

  // 事务错误 (5xxx)
  TRANSACTION_FAILED = 5001,
  TRANSACTION_TIMEOUT = 5002,
  TRANSACTION_ALREADY_COMMITTED = 5003,
  TRANSACTION_ALREADY_ROLLED_BACK = 5004,

  // Schema 错误 (6xxx)
  DDL_FAILED = 6001,
  MIGRATION_FAILED = 6002,
  SCHEMA_INTROSPECTION_FAILED = 6003,
  TABLE_NOT_FOUND = 6004,
  TABLE_ALREADY_EXISTS = 6005,

  // 通用错误 (9xxx)
  UNKNOWN = 9001,
  INTERNAL = 9002,
  NOT_IMPLEMENTED = 9003,
}

/**
 * 错误分类
 */
export type ErrorCategory =
  | 'connection'
  | 'query'
  | 'config'
  | 'security'
  | 'transaction'
  | 'schema'
  | 'unknown';

/**
 * 获取错误码的分类
 */
function getCategory(code: ErrorCode): ErrorCategory {
  if (code >= 1000 && code < 2000) return 'connection';
  if (code >= 2000 && code < 3000) return 'query';
  if (code >= 3000 && code < 4000) return 'config';
  if (code >= 4000 && code < 5000) return 'security';
  if (code >= 5000 && code < 6000) return 'transaction';
  if (code >= 6000 && code < 7000) return 'schema';
  return 'unknown';
}

/**
 * Onela 统一错误类
 */
export class OnelaError extends Error {
  /** 错误码 */
  readonly code: ErrorCode;
  /** 错误分类 */
  readonly category: ErrorCategory;
  /** 数据库类型（可选） */
  readonly dbType?: string;
  /** 表名（可选） */
  readonly tableName?: string;
  /** 原始错误 */
  readonly cause?: Error;
  /** 额外上下文 */
  readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      cause?: Error;
      dbType?: string;
      tableName?: string;
      context?: Record<string, any>;
    }
  ) {
    super(message);
    this.name = 'OnelaError';
    this.code = code;
    this.category = getCategory(code);
    this.cause = options?.cause;
    this.dbType = options?.dbType;
    this.tableName = options?.tableName;
    this.context = options?.context;
  }

  /**
   * 转为 JSON（用于日志/序列化）
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      dbType: this.dbType,
      tableName: this.tableName,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  /**
   * 是否为特定分类的错误
   */
  isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * 是否为可重试的错误
   */
  isRetryable(): boolean {
    return [
      ErrorCode.CONNECTION_TIMEOUT,
      ErrorCode.QUERY_TIMEOUT,
      ErrorCode.CONNECTION_POOL_EXHAUSTED,
      ErrorCode.TRANSACTION_TIMEOUT,
    ].includes(this.code);
  }
}

// ==================== 工厂函数 ====================

export function connectionError(message: string, cause?: Error, dbType?: string): OnelaError {
  return new OnelaError(ErrorCode.CONNECTION_FAILED, message, { cause, dbType });
}

export function queryError(message: string, cause?: Error, tableName?: string): OnelaError {
  return new OnelaError(ErrorCode.QUERY_FAILED, message, { cause, tableName });
}

export function configError(message: string, context?: Record<string, any>): OnelaError {
  return new OnelaError(ErrorCode.INVALID_CONFIG, message, { context });
}

export function securityError(code: ErrorCode, message: string, tableName?: string): OnelaError {
  return new OnelaError(code, message, { tableName });
}

export function transactionError(message: string, cause?: Error): OnelaError {
  return new OnelaError(ErrorCode.TRANSACTION_FAILED, message, { cause });
}

export function schemaError(code: ErrorCode, message: string, tableName?: string): OnelaError {
  return new OnelaError(code, message, { tableName });
}

/**
 * 将普通错误包装为 OnelaError
 */
export function wrapError(error: unknown, code: ErrorCode = ErrorCode.UNKNOWN): OnelaError {
  if (error instanceof OnelaError) return error;

  const cause = error instanceof Error ? error : new Error(String(error));
  return new OnelaError(code, cause.message, { cause });
}

/**
 * 判断是否为 OnelaError
 */
export function isOnelaError(error: unknown): error is OnelaError {
  return error instanceof OnelaError;
}
