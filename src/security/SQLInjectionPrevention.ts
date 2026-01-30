/**
 * SQLInjectionPrevention - SQL 注入防护模块
 * 基于 OWASP 安全标准实现
 */

/**
 * 危险 SQL 关键字模式
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  // 注释
  /--/,
  /\/\*/,
  /\*\//,
  /#/,

  // 字符串终止
  /';/,
  /";/,
  /`';/,

  // 联合查询
  /\bUNION\b.*\bSELECT\b/i,
  /\bUNION\b.*\bALL\b/i,

  // 子查询
  /\bSELECT\b.*\bFROM\b.*\bWHERE\b/i,

  // 时间盲注
  /\bSLEEP\s*\(/i,
  /\bBENCHMARK\s*\(/i,
  /\bWAITFOR\s+DELAY\b/i,
  /\bpg_sleep\s*\(/i,

  // 系统函数
  /\bLOAD_FILE\s*\(/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bINTO\s+DUMPFILE\b/i,

  // 存储过程
  /\bEXEC\s*\(/i,
  /\bEXECUTE\s*\(/i,
  /\bxp_cmdshell\b/i,
  /\bsp_executesql\b/i,

  // 权限操作
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,

  // 信息泄露
  /\bINFORMATION_SCHEMA\b/i,
  /\bsys\./i,
  /\bpg_catalog\b/i,

  // 堆叠查询
  /;\s*\bSELECT\b/i,
  /;\s*\bINSERT\b/i,
  /;\s*\bUPDATE\b/i,
  /;\s*\bDELETE\b/i,
  /;\s*\bDROP\b/i,

  // 布尔盲注
  /\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
  /\bAND\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
  /\bOR\b\s+['"]?[a-z]+['"]?\s*=\s*['"]?[a-z]+['"]?/i,
];

/**
 * 安全配置
 */
export interface SecurityConfig {
  /** 是否启用 SQL 注入检测 */
  enabled: boolean;
  /** 是否在检测到注入时抛出错误 */
  throwOnDetection: boolean;
  /** 自定义危险模式 */
  customPatterns?: RegExp[];
  /** 白名单值 */
  whitelist?: string[];
  /** 最大参数长度 */
  maxValueLength?: number;
  /** 日志回调 */
  onDetection?: (value: any, pattern: RegExp) => void;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  pattern?: RegExp;
}

/**
 * SQL 注入防护类
 */
export class SQLInjectionPrevention {
  private config: SecurityConfig;
  private patterns: RegExp[];

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enabled: true,
      throwOnDetection: true,
      maxValueLength: 10000,
      ...config,
    };

    this.patterns = [
      ...DANGEROUS_PATTERNS,
      ...(config.customPatterns || []),
    ];
  }

  /**
   * 验证单个值
   */
  validateValue(value: any): ValidationResult {
    if (!this.config.enabled) {
      return { valid: true };
    }

    // null 和 undefined 是安全的
    if (value === null || value === undefined) {
      return { valid: true };
    }

    // 数字和布尔值是安全的
    if (typeof value === 'number' || typeof value === 'boolean') {
      return { valid: true };
    }

    // 日期对象是安全的
    if (value instanceof Date) {
      return { valid: true };
    }

    // 数组递归检查
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = this.validateValue(item);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    }

    // 字符串检查
    if (typeof value === 'string') {
      // 检查白名单
      if (this.config.whitelist?.includes(value)) {
        return { valid: true };
      }

      // 检查长度
      if (this.config.maxValueLength && value.length > this.config.maxValueLength) {
        return {
          valid: false,
          reason: `Value exceeds maximum length of ${this.config.maxValueLength}`,
        };
      }

      // 检查危险模式
      for (const pattern of this.patterns) {
        if (pattern.test(value)) {
          this.config.onDetection?.(value, pattern);
          return {
            valid: false,
            reason: 'Potential SQL injection detected',
            pattern,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证参数对象
   */
  validateParams(params: Record<string, any>): ValidationResult {
    for (const key in params) {
      const result = this.validateValue(params[key]);
      if (!result.valid) {
        return {
          ...result,
          reason: `${result.reason} in parameter: ${key}`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * 验证 SQL 语句（仅用于原生 SQL）
   */
  validateSQL(sql: string): ValidationResult {
    if (!this.config.enabled) {
      return { valid: true };
    }

    // 检查是否有多个语句（堆叠查询）
    const statements = sql.split(';').filter((s) => s.trim().length > 0);
    if (statements.length > 1) {
      // 只允许最后一个分号（语句结尾）
      const trimmedSql = sql.trim();
      if (!trimmedSql.endsWith(';') || statements.length > 1) {
        return {
          valid: false,
          reason: 'Multiple SQL statements detected (potential stacked queries)',
        };
      }
    }

    return { valid: true };
  }

  /**
   * 安全检查装饰器
   * @throws Error 如果检测到注入
   */
  check(value: any): void {
    const result = this.validateValue(value);
    if (!result.valid && this.config.throwOnDetection) {
      throw new Error(`Security violation: ${result.reason}`);
    }
  }

  /**
   * 转义特殊字符
   */
  escape(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * 转义 LIKE 通配符
   */
  escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  /**
   * 清理标识符（表名、列名）
   */
  sanitizeIdentifier(identifier: string): string {
    // 只允许字母、数字、下划线
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * 验证标识符格式
   */
  isValidIdentifier(identifier: string): boolean {
    // 标识符规则：字母或下划线开头，只包含字母、数字、下划线
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
  }

  /**
   * 添加自定义模式
   */
  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  /**
   * 移除模式
   */
  removePattern(pattern: RegExp): void {
    const index = this.patterns.indexOf(pattern);
    if (index > -1) {
      this.patterns.splice(index, 1);
    }
  }

  /**
   * 添加白名单值
   */
  addToWhitelist(value: string): void {
    if (!this.config.whitelist) {
      this.config.whitelist = [];
    }
    this.config.whitelist.push(value);
  }

  /**
   * 启用/禁用检测
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

/**
 * 创建 SQL 注入防护实例的工厂函数
 */
export function createSQLInjectionPrevention(
  config?: Partial<SecurityConfig>
): SQLInjectionPrevention {
  return new SQLInjectionPrevention(config);
}

/**
 * 默认实例
 */
export const defaultSecurity = new SQLInjectionPrevention();

/**
 * 安全检查中间件
 * 用于在执行 SQL 前验证参数
 */
export function securityMiddleware(
  security: SQLInjectionPrevention = defaultSecurity
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 验证所有参数
      for (const arg of args) {
        if (arg && typeof arg === 'object') {
          const result = security.validateParams(arg);
          if (!result.valid) {
            throw new Error(`Security violation: ${result.reason}`);
          }
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
