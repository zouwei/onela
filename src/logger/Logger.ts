/**
 * Logger - 可插拔日志系统
 * 支持多种日志级别和输出目标
 */

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  OFF = 5,
}

/**
 * 日志级别名称映射
 */
const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
  [LogLevel.OFF]: 'OFF',
};

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: string;
  data?: any;
  error?: Error;
  sql?: string;
  params?: any[];
  duration?: number;
}

/**
 * 日志处理器接口
 */
export interface LogHandler {
  handle(entry: LogEntry): void | Promise<void>;
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 最小日志级别 */
  level: LogLevel;
  /** 是否启用 */
  enabled: boolean;
  /** 是否记录 SQL */
  logSQL: boolean;
  /** 是否记录参数 */
  logParams: boolean;
  /** 是否记录执行时间 */
  logDuration: boolean;
  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number;
  /** 日志处理器 */
  handlers: LogHandler[];
}

/**
 * 控制台日志处理器
 */
export class ConsoleLogHandler implements LogHandler {
  private colors: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m',  // Green
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.FATAL]: '\x1b[35m', // Magenta
    [LogLevel.OFF]: '',
  };

  private reset = '\x1b[0m';

  handle(entry: LogEntry): void {
    const color = this.colors[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const prefix = `${color}[${entry.levelName}]${this.reset}`;

    let message = `${timestamp} ${prefix}${context} ${entry.message}`;

    if (entry.sql) {
      message += `\n  SQL: ${entry.sql}`;
    }

    if (entry.params && entry.params.length > 0) {
      message += `\n  Params: ${JSON.stringify(entry.params)}`;
    }

    if (entry.duration !== undefined) {
      message += `\n  Duration: ${entry.duration}ms`;
    }

    if (entry.data) {
      message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    switch (entry.level) {
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }
}

/**
 * JSON 日志处理器
 */
export class JSONLogHandler implements LogHandler {
  handle(entry: LogEntry): void {
    const output = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.levelName,
      context: entry.context,
      message: entry.message,
      sql: entry.sql,
      params: entry.params,
      duration: entry.duration,
      data: entry.data,
      error: entry.error
        ? {
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    };

    console.log(JSON.stringify(output));
  }
}

/**
 * 内存日志处理器（用于测试）
 */
export class MemoryLogHandler implements LogHandler {
  private entries: LogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  handle(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  getSlowQueries(threshold?: number): LogEntry[] {
    return this.entries.filter(
      (e) => e.duration !== undefined && e.duration >= (threshold || 0)
    );
  }
}

/**
 * Logger 类
 */
export class Logger {
  private config: LoggerConfig;
  private context: string;

  constructor(context: string = 'Onela', config: Partial<LoggerConfig> = {}) {
    this.context = context;
    this.config = {
      level: LogLevel.INFO,
      enabled: true,
      logSQL: true,
      logParams: false, // 默认不记录参数（安全考虑）
      logDuration: true,
      slowQueryThreshold: 1000,
      handlers: [new ConsoleLogHandler()],
      ...config,
    };
  }

  /**
   * 记录日志
   */
  private log(
    level: LogLevel,
    message: string,
    options: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'levelName' | 'message'>> = {}
  ): void {
    if (!this.config.enabled || level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      levelName: LogLevelNames[level],
      message,
      context: options.context || this.context,
      data: options.data,
      error: options.error,
      sql: this.config.logSQL ? options.sql : undefined,
      params: this.config.logParams ? options.params : undefined,
      duration: this.config.logDuration ? options.duration : undefined,
    };

    for (const handler of this.config.handlers) {
      try {
        handler.handle(entry);
      } catch (e) {
        console.error('Log handler error:', e);
      }
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, { data });
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, { data });
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, { data });
  }

  error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, { error, data });
  }

  fatal(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.FATAL, message, { error, data });
  }

  /**
   * 记录 SQL 执行
   */
  sql(sql: string, params?: any[], duration?: number): void {
    const isSlowQuery = duration !== undefined && duration >= this.config.slowQueryThreshold;
    const level = isSlowQuery ? LogLevel.WARN : LogLevel.DEBUG;
    const message = isSlowQuery ? 'Slow query detected' : 'SQL executed';

    this.log(level, message, { sql, params, duration });
  }

  /**
   * 记录查询性能
   */
  query(operation: string, duration: number, sql?: string, params?: any[]): void {
    const isSlowQuery = duration >= this.config.slowQueryThreshold;
    const level = isSlowQuery ? LogLevel.WARN : LogLevel.DEBUG;
    const message = isSlowQuery
      ? `Slow query: ${operation} (${duration}ms)`
      : `Query: ${operation} (${duration}ms)`;

    this.log(level, message, { sql, params, duration });
  }

  /**
   * 创建子日志器
   */
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.config);
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 添加日志处理器
   */
  addHandler(handler: LogHandler): void {
    this.config.handlers.push(handler);
  }

  /**
   * 移除日志处理器
   */
  removeHandler(handler: LogHandler): void {
    const index = this.config.handlers.indexOf(handler);
    if (index > -1) {
      this.config.handlers.splice(index, 1);
    }
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 设置是否记录参数
   */
  setLogParams(enabled: boolean): void {
    this.config.logParams = enabled;
  }

  /**
   * 设置慢查询阈值
   */
  setSlowQueryThreshold(ms: number): void {
    this.config.slowQueryThreshold = ms;
  }

  /**
   * 计时工具
   */
  time<T>(operation: string, fn: () => T): T;
  time<T>(operation: string, fn: () => Promise<T>): Promise<T>;
  time<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = Date.now();
    const result = fn();

    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = Date.now() - start;
        this.query(operation, duration);
        return value;
      }).catch((error) => {
        const duration = Date.now() - start;
        this.error(`${operation} failed`, error, { duration });
        throw error;
      });
    }

    const duration = Date.now() - start;
    this.query(operation, duration);
    return result;
  }
}

/**
 * 创建 Logger 的工厂函数
 */
export function createLogger(
  context?: string,
  config?: Partial<LoggerConfig>
): Logger {
  return new Logger(context, config);
}

/**
 * 默认日志实例
 */
export const defaultLogger = new Logger();
