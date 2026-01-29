/**
 * IActionManager - 数据库操作管理器统一接口
 * 所有数据库适配器必须实现此接口
 */

import type {
  Transaction,
  QueryParams,
  QueryOption,
  UpdateParams,
  InsertParams,
  DeleteParams,
  AggregateItem,
  Configs
} from '../types/onela.js';

/**
 * 查询结果接口
 */
export interface QueryResultData {
  rows: any[];
  fields?: any[];
  affectedRows?: number;
  insertId?: number | string;
}

/**
 * 分页查询结果
 */
export interface PaginatedResult {
  data: any[];
  recordsTotal: number;
}

/**
 * 瀑布流查询结果
 */
export interface WaterfallResult {
  data: any[];
  isLastPage: boolean;
}

/**
 * 插入结果
 */
export interface InsertResult {
  insertId: number | string;
  affectedRows: number;
  [key: string]: any;
}

/**
 * 更新/删除结果
 */
export interface ModifyResult {
  affectedRows: number;
  changedRows?: number;
}

/**
 * 聚合结果
 */
export interface AggregateResult {
  [key: string]: number | string;
}

/**
 * 数据库操作管理器接口
 */
export interface IActionManager {
  /**
   * 获取数据库类型标识
   */
  getType(): string;

  /**
   * 初始化连接
   * @param config 数据库配置
   * @param moduleOrPool 可选的模块或连接池实例
   */
  init(config: any, moduleOrPool?: any): void | Promise<void>;

  /**
   * 创建事务
   */
  createTransaction(): Promise<Transaction>;

  /**
   * 查询所有符合条件的记录
   */
  findAll(params: QueryParams, option?: QueryOption): Promise<QueryResultData>;

  /**
   * 分页查询（带总数）
   */
  findList(params: QueryParams, option?: QueryOption): Promise<PaginatedResult>;

  /**
   * 瀑布流查询
   */
  find(params: QueryParams, option?: QueryOption): Promise<WaterfallResult>;

  /**
   * 单条插入
   */
  insert(params: InsertParams, option?: QueryOption): Promise<InsertResult>;

  /**
   * 批量插入
   */
  inserts(params: InsertParams, option?: QueryOption): Promise<ModifyResult>;

  /**
   * 删除
   */
  delete(params: DeleteParams, option?: QueryOption): Promise<ModifyResult>;

  /**
   * 更新
   */
  update(params: UpdateParams, option?: QueryOption): Promise<ModifyResult>;

  /**
   * 聚合查询
   */
  aggregate(
    params: QueryParams & { aggregate: AggregateItem[] },
    option?: QueryOption
  ): Promise<AggregateResult[]>;

  /**
   * 执行原生 SQL
   */
  sql(sql: string, parameters?: any[], option?: QueryOption): Promise<any>;

  /**
   * 检查连接健康状态
   */
  healthCheck?(): Promise<boolean>;

  /**
   * 关闭连接
   */
  close?(): Promise<void>;

  /**
   * 获取连接池状态
   */
  getPoolStatus?(): { active: number; idle: number; waiting: number };
}

/**
 * 静态工厂方法接口（用于类型约束）
 */
export interface IActionManagerStatic {
  new (): IActionManager;
  init(config: any, moduleOrPool?: any): void | Promise<void>;
  createTransaction(): Promise<Transaction>;
  findAll(params: QueryParams, option?: QueryOption): Promise<QueryResultData>;
  findList(params: QueryParams, option?: QueryOption): Promise<PaginatedResult>;
  find(params: QueryParams, option?: QueryOption): Promise<WaterfallResult>;
  insert(params: InsertParams, option?: QueryOption): Promise<InsertResult>;
  inserts(params: InsertParams, option?: QueryOption): Promise<ModifyResult>;
  delete(params: DeleteParams, option?: QueryOption): Promise<ModifyResult>;
  update(params: UpdateParams, option?: QueryOption): Promise<ModifyResult>;
  aggregate(params: QueryParams & { aggregate: AggregateItem[] }, option?: QueryOption): Promise<AggregateResult[]>;
  sql(sql: string, parameters?: any[], option?: QueryOption): Promise<any>;
}
