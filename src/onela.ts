/**
 * Onela 核心模块
 * 多数据库统一管理 + 模型基类
 */

import { MySQLActionManager } from './instance/MySQLActionManager.js';
import { PostgreSQLActionManager } from './instance/PostgreSQLActionManager.js';
import { SQLiteActionManager } from './instance/SQLiteSQLActionManager.js';
import { SQLServerActionManager } from './instance/SQLServerActionManager.js';

// === 类型定义 ===
interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
  engine: string;
  value: any;
}

interface Transaction {
  client: any;
  begin: () => Promise<void>;
  commit: () => Promise<string>;
  rollback: () => Promise<string>;
  done?: () => void;
}

interface QueryOption {
  transaction?: Transaction | null;
}

interface KeywordItem {
  logic?: 'and' | 'or';
  key: string;
  operator?: '=' | '>' | '<' | '<>' | '>=' | '<=' | 'in' | 'not in' | '%' | 'x%' | '%%' | 'is';
  value: any;
}

interface AggregateItem {
  function: 'count' | 'sum' | 'max' | 'min' | 'abs' | 'avg';
  field: string;
  name: string;
}

interface UpdateItem {
  key: string;
  value: any;
  operator?: 'replace' | 'plus' | 'reduce';
  case_field?: string;
  case_item?: Array<{
    case_value: any;
    value: any;
    operator?: 'replace' | 'plus' | 'reduce';
  }>;
}

interface QueryParams {
  select?: string[];
  keyword?: KeywordItem[];
  where?: any[];
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  limit?: [number, number];
  aggregate?: AggregateItem[];
}

interface InsertParams {
  insertion: Record<string, any> | Array<Record<string, any>>;
}

interface UpdateParams extends QueryParams {
  update: UpdateItem[];
}

interface DeleteParams extends QueryParams {
  keyword?: KeywordItem[];
  where?: any[];
}

// ActionManager 通用接口
interface ActionManager {
  init(config: any): void;
  createTransaction(): Promise<Transaction>;
  queryEntity(params: any, option?: QueryOption): Promise<any>;
  queryEntityList(params: any, option?: QueryOption): Promise<{ data: any[]; recordsTotal: number }>;
  queryWaterfallList(params: any, option?: QueryOption): Promise<{ data: any[]; isLastPage: boolean }>;
  insert(params: InsertParams & { configs: any }, option?: QueryOption): Promise<any>;
  insertBatch(params: InsertParams & { configs: any }, option?: QueryOption): Promise<any>;
  deleteEntity(params: DeleteParams & { configs: any }, option?: QueryOption): Promise<any>;
  updateEntity(params: UpdateParams & { configs: any }, option?: QueryOption): Promise<any>;
  statsByAggregate(params: QueryParams & { aggregate: AggregateItem[]; configs: any }, option?: QueryOption): Promise<any>;
  streak?(sql: string, parameters?: any[], option?: QueryOption): Promise<any>;
}

/**
 * Onela 主类：多数据库管理
 */
export class Onela {
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
export class OnelaBaseModel {
  protected static action_manager: Promise<ActionManager> | null = null;
  protected static configs = {
    fields: [] as any[],
    tableName: '',
    engine: 'default' as string,
  };

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
  static queryEntity(args: QueryParams, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.queryEntity(params, option));
  }

  /**
   * 查询列表 + 总数
   */
  static queryEntityList(args: QueryParams, option?: QueryOption): Promise<{ data: any[]; recordsTotal: number }> {
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.queryEntityList(params, option));
  }

  /**
   * 瀑布流查询
   */
  static queryWaterfallList(args: QueryParams, option?: QueryOption): Promise<{ data: any[]; isLastPage: boolean }> {
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.queryWaterfallList(params, option));
  }

  /**
   * 新增
   */
  static insert(args: InsertParams, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.insert(params, option));
  }

  /**
   * 批量新增
   */
  static insertBatch(args: InsertParams, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.insertBatch(params, option));
  }

  /**
   * 删除
   */
  static deleteEntity(args: DeleteParams, option?: QueryOption): Promise<any> {
    if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
      return Promise.reject(new Error('paras.where delete condition (array) must exist condition'));
    }
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.deleteEntity(params, option));
  }

  /**
   * 更新
   */
  static updateEntity(args: UpdateParams, option?: QueryOption): Promise<any> {
    if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
      return Promise.reject(new Error('paras.where update condition (array) must exist condition'));
    }
    const params = { ...args, configs: this.configs };
    return this.getActionManager().then(am => am.updateEntity(params, option));
  }

  /**
   * 聚合统计
   */
  static getEntityByAggregate(args: QueryParams & { aggregate: AggregateItem[] }, option?: QueryOption): Promise<any> {
    const params = { ...args, configs: this.configs };
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