/**
 * Onela 核心模块
 * 多数据库统一管理 + 模型基类
 */

import { MySQLActionManager } from './instance/MySQLActionManager.js';
import { PostgreSQLActionManager } from './instance/PostgreSQLActionManager.js';
import { SQLiteActionManager } from './instance/SQLiteSQLActionManager.js';
import { SQLServerActionManager } from './instance/SQLServerActionManager.js';
import type { DatabaseConfig, Configs, Transaction, InsertParams, QueryOption, DeleteParams, AggregateItem, QueryParams, UpdateParams } from './interface/onelaType.js';

// ActionManager 通用接口
interface ActionManager {
  init(config: any): void;
  createTransaction(): Promise<Transaction>;
  queryEntity(params: any, option?: QueryOption): Promise<any>;
  queryEntityList(params: any, option?: QueryOption): Promise<{ data: any[]; recordsTotal: number }>;
  queryWaterfallList(params: any, option?: QueryOption): Promise<{ data: any[]; isLastPage: boolean }>;
  insert(params: InsertParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  insertBatch(params: InsertParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  deleteEntity(params: DeleteParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  updateEntity(params: UpdateParams & { configs: Configs }, option?: QueryOption): Promise<any>;
  statsByAggregate(params: QueryParams & { aggregate?: AggregateItem[]; configs: Configs }, option?: QueryOption): Promise<any>;
  streak?(sql: string, parameters?: any[], option?: QueryOption): Promise<any>;
}

/**
 * Onela 主类：多数据库管理
 */
class Onela {
  private static _connections: Record<string, ActionManager> = {};

  /**
   * 根据类型获取 ActionManager 类
   */
  private static getActionManagerClass(db_type: string) {
    switch (db_type.toLowerCase()) {
      case 'mysql':
        return MySQLActionManager;
      case 'postgresql':
        return PostgreSQLActionManager;
      case 'sqlite':
        return SQLiteActionManager;
      case 'sqlserver':
        return SQLServerActionManager;
      default:
        return null;
    }
  }

  /**
   * 初始化多个数据库连接
   */
  static init(config_list: DatabaseConfig[]): void {
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
   */
  static getActionManager(engine: string): Promise<ActionManager> {
    if (!(engine in this._connections)) {
      return Promise.reject(new Error(`invalid engine: ${engine}`));
    }
    return Promise.resolve(this._connections[engine]);
  }

  /**
   * 获取事务实例（自动开启）
   */
  static getActionTransaction(engine: string): Promise<Transaction> {
    if (!(engine in this._connections)) {
      return Promise.reject(new Error(`invalid engine: ${engine}`));
    }

    return this._connections[engine].createTransaction().then(async (connection) => {
      await connection.begin();
      return connection;
    });
  }
}

/**
 * 模型基类：封装 CRUD
 */
class OnelaBaseModel {
  protected static action_manager: Promise<ActionManager> | null = null;
  protected static configs:Configs;
  
  // {
  //   fields: [] as any[],
  //   tableName: '',
  //   engine: 'default' as string,
  // };

  /**
   * 获取 ActionManager（延迟加载）
   */
  protected static getActionManager(): Promise<ActionManager> {
    if (!this.action_manager) {
      this.action_manager = Onela.getActionManager(this.configs.engine);
    }
    return this.action_manager;
  }

  /**
   * 获取事务（自动开启）
   */
  static transaction(): Promise<Transaction> {
    return Onela.getActionTransaction(this.configs.engine);
  }

  /**
   * 查询单条
   */
  static queryOne(args: any, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then(am => am.queryEntity(params, option));
  }

  /**
   * 查询列表 + 总数
   */
  static query(args: any, option?: QueryOption): Promise<{ data: any[]; recordsTotal: number }> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then(am => am.queryEntityList(params, option));
  }

  /**
   * 瀑布流查询
   */
  static queryList(args: any, option?: QueryOption): Promise<{ data: any[]; isLastPage: boolean }> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then(am => am.queryWaterfallList(params, option));
  }

  /**
   * 新增
   */
  static insert(args: any, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs } as InsertParams;
    return this.getActionManager().then(am => am.insert(params, option));
  }

  /**
   * 批量新增
   */
  static inserts(args:  any, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs } as InsertParams;
    return this.getActionManager().then(am => am.insertBatch(params, option));
  }

  /**
   * 删除
   */
  static delete(args: any, option?: QueryOption): Promise<any> {
    if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
      return Promise.reject(new Error('paras.where delete condition (array) must exist condition'));
    }
    const params = { ...args, configs: this.configs } as DeleteParams;
    return this.getActionManager().then(am => am.deleteEntity(params, option));
  }

  /**
   * 更新
   */
  static update(args: any, option?: QueryOption): Promise<any> {
    if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
      return Promise.reject(new Error('paras.where update condition (array) must exist condition'));
    }
    const params = { ...args, configs: this.configs } as UpdateParams;
    return this.getActionManager().then(am => am.updateEntity(params, option));
  }

  /**
   * 聚合统计
   */
  static aggregate(args: any & { aggregate: AggregateItem[] }, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs } as QueryParams;
    return this.getActionManager().then(am => am.statsByAggregate(params, option));
  }

  /**
   * 自定义 SQL（谨慎）
   */
  static streak(sql: string, parameters: any[] = [], option?: QueryOption): Promise<any> {
    return this.getActionManager().then(am => {
      if (am.streak) {
        return am.streak(sql, parameters, option);
      } else {
        return Promise.reject(new Error('This type of database does not support the streak method'));
      }
    });
  }
}

export { Onela, OnelaBaseModel };
export  type *  from './interface/onelaType.js';
