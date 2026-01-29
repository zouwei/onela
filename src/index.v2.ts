/**
 * Onela ORM Framework V2
 * 世界级自适应关系型数据库热切换解决方案
 *
 * @description
 * Onela 是一个轻量级、高性能的 ORM 框架，支持：
 * - 多数据库类型：MySQL, MariaDB, TiDB, PostgreSQL, SQLite, SQL Server, Oracle
 * - 热切换：运行时无缝切换数据库连接
 * - 读写分离：自动路由读写请求
 * - 故障转移：自动检测和切换故障节点
 * - 五种查询模式：简单对象、操作符函数、链式构建、Lambda 表达式、传统模式
 * - SQL 注入防护：基于 OWASP 标准的安全检查
 *
 * @example
 * ```typescript
 * import { Onela, OnelaBaseModel, Op, createQueryBuilder } from 'onela';
 *
 * // 初始化
 * Onela.init([
 *   { engine: 'main', type: 'mysql', value: { host: 'localhost', user: 'root', database: 'test' } }
 * ]);
 *
 * // 定义模型
 * class User extends OnelaBaseModel {
 *   static configs = {
 *     engine: 'main',
 *     tableName: 'users',
 *     fields: [
 *       { name: 'id', type: 'int', increment: true },
 *       { name: 'name', type: 'varchar' },
 *       { name: 'email', type: 'varchar' }
 *     ]
 *   };
 * }
 *
 * // 查询（多种方式）
 * // 方式1: 简单对象
 * User.findAll({ name: 'John' });
 *
 * // 方式2: 操作符函数
 * User.findAll({ where: [Op.eq('name', 'John'), Op.gte('age', 18)] });
 *
 * // 方式3: 链式构建
 * const qb = createQueryBuilder(User.configs);
 * qb.where('name', 'John').where('age', '>=', 18).orderBy('id', 'DESC').limit(10);
 * User.findAll(qb.build());
 * ```
 *
 * @author SHIYE
 * @version 3.2.0
 * @license GPL-3.0-only
 */

// ==================== 核心模块 ====================
import { MySQLActionManager } from './instance/MySQLActionManager.js';
import { PostgreSQLActionManager } from './instance/PostgreSQLActionManager.js';
import { SQLiteActionManager } from './instance/SQLiteSQLActionManager.js';
import { SQLServerActionManager } from './instance/SQLServerActionManager.js';
// 新版适配器
import { MySQLActionManagerV2 } from './instance/MySQLActionManagerV2.js';
import { PostgreSQLActionManagerV2 } from './instance/PostgreSQLActionManagerV2.js';

import type {
  DatabaseConfig,
  Configs,
  Transaction,
  InsertParams,
  QueryOption,
  DeleteParams,
  AggregateItem,
  QueryParams,
  UpdateParams,
} from './types/onela.js';

// ==================== 接口和抽象类 ====================
export * from './interfaces/IActionManager.js';
export * from './abstract/AbstractActionManager.js';

// ==================== 方言系统 ====================
export * from './dialect/index.js';

// ==================== SQL 构建器 ====================
export * from './builders/index.js';

// ==================== 查询模块 ====================
export * from './query/index.js';

// ==================== 连接路由 ====================
export * from './router/index.js';

// ==================== 安全模块 ====================
export * from './security/index.js';

// ==================== 日志模块 ====================
export * from './logger/index.js';

// ==================== 类型定义 ====================
export * from './types/onela.js';

// ==================== ActionManager 通用接口 ====================
interface ActionManager {
  init(config: any, moduleOrPool?: any): void;
  createTransaction(): Promise<Transaction>;
  findAll(params: any, option?: QueryOption): Promise<any>;
  findList(params: any, option?: QueryOption): Promise<{ data: any[]; recordsTotal: any }>;
  find(params: any, option?: QueryOption): Promise<{ data: any[]; isLastPage: boolean }>;
  insert(params: InsertParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  inserts(params: InsertParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  delete(params: DeleteParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  update(params: UpdateParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  aggregate(params: QueryParams & { aggregate?: AggregateItem[]; configs: Configs }, option?: QueryOption): Promise<any>;
  sql?(sql: string, parameters?: any[], option?: QueryOption): Promise<any>;
}

/**
 * Onela 主类
 * 管理多数据库连接和实例
 */
class Onela {
  /** 数据库连接实例映射 */
  private static _connections: Record<string, ActionManager> = {};

  /** 是否使用新版适配器 */
  private static _useV2: boolean = false;

  /**
   * 根据数据库类型获取 ActionManager 类
   * @param db_type 数据库类型
   * @returns ActionManager 类
   */
  private static getActionManagerClass(db_type: string) {
    const type = db_type.toLowerCase();

    // MySQL 协议兼容数据库
    if (['mysql', 'mariadb', 'tidb', 'oceanbase', 'polardb', 'tdsql', 'greatsql'].includes(type)) {
      return this._useV2 ? MySQLActionManagerV2 : MySQLActionManager;
    }

    // PostgreSQL
    if (['postgresql', 'postgres', 'pg'].includes(type)) {
      return this._useV2 ? PostgreSQLActionManagerV2 : PostgreSQLActionManager;
    }

    // SQLite
    if (['sqlite', 'sqlite3'].includes(type)) {
      return SQLiteActionManager;
    }

    // SQL Server
    if (['sqlserver', 'mssql'].includes(type)) {
      return SQLServerActionManager;
    }

    // 未知类型
    return null;
  }

  /**
   * 初始化数据库连接
   * @param config_list 数据库配置列表
   * @param options 初始化选项
   *
   * @example
   * ```typescript
   * Onela.init([
   *   {
   *     engine: 'default',
   *     type: 'mysql',
   *     value: {
   *       host: 'localhost',
   *       user: 'root',
   *       password: 'password',
   *       database: 'mydb'
   *     }
   *   }
   * ]);
   * ```
   */
  static init(
    config_list: DatabaseConfig[],
    options: { useV2?: boolean } = {}
  ): void {
    this._useV2 = options.useV2 ?? false;

    for (const tempConfig of config_list) {
      const temp_am_class = this.getActionManagerClass(tempConfig.type);
      if (temp_am_class) {
        const instance = temp_am_class as any;
        instance.init(tempConfig.value);
        this._connections[tempConfig.engine] = instance;
      } else {
        console.error(`Database instance type "${tempConfig.type}" does not exist`);
      }
    }
  }

  /**
   * 获取数据库操作实例
   * @param engine 引擎标识
   * @returns ActionManager 实例
   */
  static getActionManager(engine: string): Promise<ActionManager> {
    if (!(engine in this._connections)) {
      return Promise.reject(new Error(`Invalid engine: ${engine}`));
    }
    return Promise.resolve(this._connections[engine]);
  }

  /**
   * 获取事务实例（自动开启）
   * @param engine 引擎标识
   * @returns Transaction 实例
   */
  static getActionTransaction(engine: string): Promise<Transaction> {
    if (!(engine in this._connections)) {
      return Promise.reject(new Error(`Invalid engine: ${engine}`));
    }

    return this._connections[engine].createTransaction().then(async (connection) => {
      await connection.begin();
      return connection;
    });
  }

  /**
   * 获取所有引擎标识
   * @returns 引擎标识列表
   */
  static getEngines(): string[] {
    return Object.keys(this._connections);
  }

  /**
   * 检查引擎是否存在
   * @param engine 引擎标识
   * @returns 是否存在
   */
  static hasEngine(engine: string): boolean {
    return engine in this._connections;
  }
}

/**
 * 模型基类
 * 提供 CRUD 操作的封装
 */
class OnelaBaseModel {
  /** ActionManager 实例缓存 */
  protected static action_manager: Promise<ActionManager> | null = null;

  /** 模型配置 */
  protected static configs: Configs;

  /**
   * 获取 ActionManager（延迟加载）
   * @returns ActionManager 实例
   */
  protected static getActionManager(): Promise<ActionManager> {
    if (!this.action_manager) {
      this.action_manager = Onela.getActionManager(this.configs.engine);
    }
    return this.action_manager;
  }

  /**
   * 获取事务（自动开启）
   * @returns Transaction 实例
   *
   * @example
   * ```typescript
   * const t = await User.transaction();
   * try {
   *   await User.insert({ name: 'John' }, { transaction: t });
   *   await t.commit();
   * } catch (e) {
   *   await t.rollback();
   * }
   * ```
   */
  static transaction(): Promise<Transaction> {
    return Onela.getActionTransaction(this.configs.engine);
  }

  /**
   * 查询单条记录
   * @param args 查询参数
   * @param option 查询选项
   * @returns 单条记录或 null
   */
  static findOne(args: any, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager()
      .then((am) => am.findAll(params, option))
      .then((result: any) => {
        // 统一处理不同数据库返回格式
        const rows = result.rows || result;
        return Array.isArray(rows) ? rows[0] || null : null;
      });
  }

  /**
   * 查询所有符合条件的记录
   * @param args 查询参数
   * @param option 查询选项
   * @returns 记录数组
   */
  static findAll(args: any, option?: QueryOption): Promise<any[]> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager()
      .then((am) => am.findAll(params, option))
      .then((result: any) => {
        // 统一处理不同数据库返回格式
        return result.rows || result || [];
      });
  }

  /**
   * 分页查询
   * @param args 查询参数
   * @param option 查询选项
   * @returns 分页结果
   */
  static findList(
    args: any,
    option?: QueryOption
  ): Promise<{ data: any[]; recordsTotal: any }> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then((am) => am.findList(params, option));
  }

  /**
   * 瀑布流查询
   * @param args 查询参数
   * @param option 查询选项
   * @returns 瀑布流结果
   */
  static find(
    args: any,
    option?: QueryOption
  ): Promise<{ data: any[]; isLastPage: boolean }> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then((am) => am.find(params, option));
  }

  /**
   * 插入单条记录
   * @param args 插入数据
   * @param option 查询选项
   * @returns 插入结果
   */
  static insert(args: any, option?: QueryOption): Promise<any> {
    let p: any = {};
    let entity: any = Object.assign({}, args);

    // 处理字段默认值
    for (let field of this.configs.fields!) {
      if (field.name in entity) {
        p[field.name] = entity[field.name!];
      } else {
        let default_value = null;
        if (field.default === undefined) {
          throw new Error(`Field: ${field.name} required`);
        }
        if (field.default instanceof Function) {
          default_value = field.default();
        } else {
          default_value = field.default;
        }
        // 跳过自增主键
        if (field.increment) continue;
        p[field.name] = default_value;
      }
    }

    const params = { insertion: p, configs: this.configs } as InsertParams;
    return this.getActionManager().then((am) => am.insert(params, option));
  }

  /**
   * 批量插入
   * @param entity_list 插入数据列表
   * @param option 查询选项
   * @returns 插入结果
   */
  static inserts(entity_list: any[], option?: QueryOption): Promise<any> {
    let insert_list = [];
    for (let entity of entity_list) {
      let insert_obj: any = {};
      for (let field of this.configs.fields!) {
        if (field.name in entity) {
          insert_obj[field.name] = entity[field.name];
        } else {
          let default_value = null;
          if (field.default === undefined) {
            throw new Error(`INSERTS Field: ${field.name} required`);
          }
          if (field.default instanceof Function) {
            default_value = field.default();
          } else {
            default_value = field.default;
          }
          if (field.increment) continue;
          insert_obj[field.name] = default_value;
        }
      }
      insert_list.push(insert_obj);
    }

    const params = { insertion: insert_list, configs: this.configs } as InsertParams;
    return this.getActionManager().then((am) => am.inserts(params, option));
  }

  /**
   * 删除记录
   * @param args 删除条件
   * @param option 查询选项
   * @returns 删除结果
   */
  static delete(args: any, option?: QueryOption): Promise<any> {
    if (
      (!args.keyword || args.keyword.length === 0) &&
      (!args.where || args.where.length === 0)
    ) {
      return Promise.reject(
        new Error('Delete condition required to prevent full table deletion')
      );
    }

    const params = { ...args, configs: this.configs } as DeleteParams;
    return this.getActionManager().then((am) => am.delete(params, option));
  }

  /**
   * 更新记录
   * @param args 更新参数
   * @param option 查询选项
   * @returns 更新结果
   */
  static update(args: any, option?: QueryOption): Promise<any> {
    if (
      (!args.keyword || args.keyword.length === 0) &&
      (!args.where || args.where.length === 0)
    ) {
      return Promise.reject(
        new Error('Update condition required to prevent full table update')
      );
    }
    const params = { ...args, configs: this.configs } as UpdateParams;
    return this.getActionManager().then((am) => am.update(params, option));
  }

  /**
   * 聚合查询
   * @param args 聚合参数
   * @param option 查询选项
   * @returns 聚合结果
   */
  static aggregate(
    args: any & { aggregate: AggregateItem[] },
    option?: QueryOption
  ): Promise<any> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then((am) => am.aggregate(params, option));
  }

  /**
   * 执行原生 SQL
   * @param sql SQL 语句
   * @param parameters 参数
   * @param option 查询选项
   * @returns 执行结果
   */
  static sql(
    sql: string,
    parameters: any[] = [],
    option?: QueryOption
  ): Promise<any> {
    return this.getActionManager().then((am) => {
      if (am.sql) {
        return am.sql(sql, parameters, option);
      } else {
        return Promise.reject(
          new Error('This database type does not support the sql method')
        );
      }
    });
  }
}

// ==================== 导出 ====================
export { Onela, OnelaBaseModel };

// 导出操作符（便捷导入）
export { Op } from './query/operators/index.js';

// 导出 QueryBuilder 工厂函数
export { createQueryBuilder } from './query/QueryBuilder.js';

// 导出 SQL 构建器工厂函数
export { createSQLBuilder } from './builders/SQLBuilder.js';

// 导出连接路由器工厂函数
export { createConnectionRouter } from './router/ConnectionRouter.js';

// 导出安全模块工厂函数
export { createSQLInjectionPrevention, defaultSecurity } from './security/SQLInjectionPrevention.js';

// 导出日志模块工厂函数
export { createLogger, defaultLogger, LogLevel } from './logger/Logger.js';
