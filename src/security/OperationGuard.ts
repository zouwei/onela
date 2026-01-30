/**
 * OperationGuard - 操作白名单守卫
 * 控制哪些操作（CRUD）允许在指定表上执行
 * 适用于 AI 场景下的操作权限控制
 */

/**
 * 操作类型
 */
export type OperationType = 'select' | 'insert' | 'update' | 'delete' | 'aggregate' | 'sql';

/**
 * 表级别权限配置
 */
export interface TablePermission {
  /** 表名 */
  tableName: string;
  /** 允许的操作列表 */
  allowed: OperationType[];
  /** 是否只读（快捷设置，等价于 allowed: ['select', 'aggregate']） */
  readonly?: boolean;
}

/**
 * 操作守卫配置
 */
export interface OperationGuardConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 默认策略：允许所有 or 拒绝所有 */
  defaultPolicy: 'allow' | 'deny';
  /** 表级别权限 */
  permissions: TablePermission[];
  /** 全局禁止的操作 */
  globalDeny?: OperationType[];
  /** 违规时的回调 */
  onViolation?: (tableName: string, operation: OperationType) => void;
}

/**
 * 操作守卫
 */
export class OperationGuard {
  private config: OperationGuardConfig;
  private permissionMap: Map<string, Set<OperationType>>;

  constructor(config: Partial<OperationGuardConfig> = {}) {
    this.config = {
      enabled: true,
      defaultPolicy: 'allow',
      permissions: [],
      ...config,
    };
    this.permissionMap = new Map();
    this.buildPermissionMap();
  }

  /**
   * 构建权限查找表
   */
  private buildPermissionMap(): void {
    this.permissionMap.clear();
    for (const perm of this.config.permissions) {
      let allowed: OperationType[];
      if (perm.readonly) {
        allowed = ['select', 'aggregate'];
      } else {
        allowed = perm.allowed;
      }
      this.permissionMap.set(perm.tableName, new Set(allowed));
    }
  }

  /**
   * 检查操作是否被允许
   */
  check(tableName: string, operation: OperationType): boolean {
    if (!this.config.enabled) return true;

    // 全局禁止
    if (this.config.globalDeny?.includes(operation)) {
      this.config.onViolation?.(tableName, operation);
      return false;
    }

    // 表级别权限
    const tablePerms = this.permissionMap.get(tableName);
    if (tablePerms) {
      const allowed = tablePerms.has(operation);
      if (!allowed) {
        this.config.onViolation?.(tableName, operation);
      }
      return allowed;
    }

    // 默认策略
    const allowed = this.config.defaultPolicy === 'allow';
    if (!allowed) {
      this.config.onViolation?.(tableName, operation);
    }
    return allowed;
  }

  /**
   * 断言操作被允许（不允许则抛出异常）
   */
  assert(tableName: string, operation: OperationType): void {
    if (!this.check(tableName, operation)) {
      throw new Error(
        `Operation "${operation}" is not allowed on table "${tableName}"`
      );
    }
  }

  /**
   * 设置表权限
   */
  setPermission(tableName: string, allowed: OperationType[]): void {
    this.config.permissions = this.config.permissions.filter(
      (p) => p.tableName !== tableName
    );
    this.config.permissions.push({ tableName, allowed });
    this.permissionMap.set(tableName, new Set(allowed));
  }

  /**
   * 设置表为只读
   */
  setReadOnly(tableName: string): void {
    this.setPermission(tableName, ['select', 'aggregate']);
  }

  /**
   * 移除表权限配置（回退到默认策略）
   */
  removePermission(tableName: string): void {
    this.config.permissions = this.config.permissions.filter(
      (p) => p.tableName !== tableName
    );
    this.permissionMap.delete(tableName);
  }

  /**
   * 获取表的允许操作列表
   */
  getAllowed(tableName: string): OperationType[] {
    const perms = this.permissionMap.get(tableName);
    if (perms) return Array.from(perms);

    if (this.config.defaultPolicy === 'allow') {
      const all: OperationType[] = ['select', 'insert', 'update', 'delete', 'aggregate', 'sql'];
      return this.config.globalDeny
        ? all.filter((op) => !this.config.globalDeny!.includes(op))
        : all;
    }
    return [];
  }

  /**
   * 启用/禁用守卫
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 获取当前配置
   */
  getConfig(): OperationGuardConfig {
    return { ...this.config };
  }
}

/**
 * 工厂函数
 */
export function createOperationGuard(
  config?: Partial<OperationGuardConfig>
): OperationGuard {
  return new OperationGuard(config);
}
