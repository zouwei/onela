/**
 * FieldAccessControl - 字段级访问控制
 * 控制哪些字段可以被读取、写入
 * 适用于 AI 场景下的敏感数据保护
 */

/**
 * 字段访问权限
 */
export type FieldPermission = 'read' | 'write' | 'readwrite' | 'none';

/**
 * 字段访问规则
 */
export interface FieldRule {
  /** 字段名（支持 * 通配符） */
  field: string;
  /** 访问权限 */
  permission: FieldPermission;
}

/**
 * 表字段访问控制配置
 */
export interface TableFieldAccess {
  /** 表名 */
  tableName: string;
  /** 默认权限 */
  defaultPermission: FieldPermission;
  /** 字段级规则 */
  rules: FieldRule[];
}

/**
 * 字段访问控制配置
 */
export interface FieldAccessConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 全局默认权限 */
  globalDefault: FieldPermission;
  /** 表级别配置 */
  tables: TableFieldAccess[];
  /** 违规时的回调 */
  onViolation?: (tableName: string, field: string, action: 'read' | 'write') => void;
}

/**
 * 字段访问控制
 */
export class FieldAccessControl {
  private config: FieldAccessConfig;
  private tableMap: Map<string, TableFieldAccess>;

  constructor(config: Partial<FieldAccessConfig> = {}) {
    this.config = {
      enabled: true,
      globalDefault: 'readwrite',
      tables: [],
      ...config,
    };
    this.tableMap = new Map();
    this.buildMap();
  }

  /**
   * 构建查找表
   */
  private buildMap(): void {
    this.tableMap.clear();
    for (const table of this.config.tables) {
      this.tableMap.set(table.tableName, table);
    }
  }

  /**
   * 检查字段读取权限
   */
  canRead(tableName: string, field: string): boolean {
    if (!this.config.enabled) return true;
    const perm = this.getFieldPermission(tableName, field);
    return perm === 'read' || perm === 'readwrite';
  }

  /**
   * 检查字段写入权限
   */
  canWrite(tableName: string, field: string): boolean {
    if (!this.config.enabled) return true;
    const perm = this.getFieldPermission(tableName, field);
    return perm === 'write' || perm === 'readwrite';
  }

  /**
   * 获取字段的访问权限
   */
  getFieldPermission(tableName: string, field: string): FieldPermission {
    const tableAccess = this.tableMap.get(tableName);
    if (!tableAccess) return this.config.globalDefault;

    // 查找精确匹配规则
    const rule = tableAccess.rules.find((r) => r.field === field);
    if (rule) return rule.permission;

    // 查找通配符规则
    const wildcardRule = tableAccess.rules.find((r) => {
      if (r.field === '*') return true;
      if (r.field.endsWith('*')) {
        return field.startsWith(r.field.slice(0, -1));
      }
      return false;
    });
    if (wildcardRule) return wildcardRule.permission;

    return tableAccess.defaultPermission;
  }

  /**
   * 过滤可读字段（SELECT 过滤）
   */
  filterReadableFields(tableName: string, fields: string[]): string[] {
    if (!this.config.enabled) return fields;
    return fields.filter((f) => {
      const readable = this.canRead(tableName, f);
      if (!readable) {
        this.config.onViolation?.(tableName, f, 'read');
      }
      return readable;
    });
  }

  /**
   * 过滤可写字段（INSERT/UPDATE 过滤）
   */
  filterWritableFields(tableName: string, data: Record<string, any>): Record<string, any> {
    if (!this.config.enabled) return data;
    const filtered: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (this.canWrite(tableName, key)) {
        filtered[key] = data[key];
      } else {
        this.config.onViolation?.(tableName, key, 'write');
      }
    }
    return filtered;
  }

  /**
   * 断言字段可读
   */
  assertRead(tableName: string, field: string): void {
    if (!this.canRead(tableName, field)) {
      throw new Error(
        `Field "${field}" in table "${tableName}" is not readable`
      );
    }
  }

  /**
   * 断言字段可写
   */
  assertWrite(tableName: string, field: string): void {
    if (!this.canWrite(tableName, field)) {
      throw new Error(
        `Field "${field}" in table "${tableName}" is not writable`
      );
    }
  }

  /**
   * 设置表字段访问配置
   */
  setTableAccess(tableAccess: TableFieldAccess): void {
    this.config.tables = this.config.tables.filter(
      (t) => t.tableName !== tableAccess.tableName
    );
    this.config.tables.push(tableAccess);
    this.tableMap.set(tableAccess.tableName, tableAccess);
  }

  /**
   * 快捷设置：隐藏敏感字段
   */
  hideSensitiveFields(tableName: string, fields: string[]): void {
    const existing = this.tableMap.get(tableName) || {
      tableName,
      defaultPermission: this.config.globalDefault,
      rules: [],
    };

    for (const field of fields) {
      // 移除已有规则
      existing.rules = existing.rules.filter((r) => r.field !== field);
      // 添加 none 规则
      existing.rules.push({ field, permission: 'none' });
    }

    this.setTableAccess(existing);
  }

  /**
   * 快捷设置：字段只读
   */
  setFieldsReadOnly(tableName: string, fields: string[]): void {
    const existing = this.tableMap.get(tableName) || {
      tableName,
      defaultPermission: this.config.globalDefault,
      rules: [],
    };

    for (const field of fields) {
      existing.rules = existing.rules.filter((r) => r.field !== field);
      existing.rules.push({ field, permission: 'read' });
    }

    this.setTableAccess(existing);
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
  getConfig(): FieldAccessConfig {
    return { ...this.config };
  }
}

/**
 * 工厂函数
 */
export function createFieldAccessControl(
  config?: Partial<FieldAccessConfig>
): FieldAccessControl {
  return new FieldAccessControl(config);
}
