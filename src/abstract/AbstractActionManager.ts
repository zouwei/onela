/**
 * AbstractActionManager - 抽象数据库操作管理器
 * 使用模板方法模式，将通用逻辑提取到基类
 * 子类只需实现数据库特定的连接和执行方法
 */

import type {
  IActionManager,
  QueryResultData,
  PaginatedResult,
  WaterfallResult,
  InsertResult,
  ModifyResult,
  AggregateResult,
} from '../interfaces/IActionManager.js';
import type {
  Transaction,
  QueryParams,
  QueryOption,
  UpdateParams,
  InsertParams,
  DeleteParams,
  AggregateItem,
  Configs,
} from '../types/onela.js';
import { SQLBuilder, type BuiltSQL } from '../builders/SQLBuilder.js';
import type { IDialect } from '../dialect/IDialect.js';

/**
 * 连接池接口
 */
export interface ConnectionPool {
  getConnection(): Promise<any>;
  query?(sql: string, params: any[]): Promise<any>;
  end?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * 数据库连接接口
 */
export interface DatabaseConnection {
  query(sql: string, params: any[]): Promise<any>;
  release?(): void;
  end?(): void;
  close?(): void;
}

/**
 * 执行选项
 */
export interface ExecuteOptions {
  transaction?: Transaction | null;
}

/**
 * 抽象数据库操作管理器
 */
export abstract class AbstractActionManager implements IActionManager {
  /** 数据库类型标识 */
  protected abstract dbType: string;

  /** 连接池实例 */
  protected static pool: ConnectionPool | null = null;

  /** SQL 构建器 */
  protected sqlBuilder: SQLBuilder | null = null;

  /**
   * 获取数据库类型
   */
  getType(): string {
    return this.dbType;
  }

  /**
   * 获取 SQL 构建器
   */
  protected getSQLBuilder(): SQLBuilder {
    if (!this.sqlBuilder) {
      this.sqlBuilder = new SQLBuilder(this.dbType);
    }
    return this.sqlBuilder;
  }

  /**
   * 获取方言实例
   */
  protected getDialect(): IDialect {
    return this.getSQLBuilder().getDialect();
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /**
   * 初始化连接池
   */
  abstract init(config: any, moduleOrPool?: any): void | Promise<void>;

  /**
   * 创建事务
   */
  abstract createTransaction(): Promise<Transaction>;

  /**
   * 执行 SQL 查询
   */
  protected abstract execute(sql: string, params: any[]): Promise<any>;

  /**
   * 在事务中执行 SQL
   */
  protected abstract executeInTransaction(
    sql: string,
    params: any[],
    transaction: Transaction
  ): Promise<any>;

  /**
   * 规范化查询结果为统一格式
   */
  protected abstract normalizeQueryResult(rawResult: any): QueryResultData;

  /**
   * 规范化插入结果
   */
  protected abstract normalizeInsertResult(rawResult: any, data: any): InsertResult;

  /**
   * 规范化修改结果
   */
  protected abstract normalizeModifyResult(rawResult: any): ModifyResult;

  // ==================== 模板方法（通用实现） ====================

  /**
   * 执行 SQL（自动选择连接池或事务）
   */
  protected async executeQuery(
    sql: string,
    params: any[],
    option: ExecuteOptions = {}
  ): Promise<any> {
    if (option.transaction) {
      return this.executeInTransaction(sql, params, option.transaction);
    }
    return this.execute(sql, params);
  }

  /**
   * 查询所有符合条件的记录
   */
  async findAll(
    params: QueryParams,
    option: QueryOption = { transaction: null }
  ): Promise<QueryResultData> {
    const builder = this.getSQLBuilder();
    const built = builder.buildSelect(params);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    return this.normalizeQueryResult(rawResult);
  }

  /**
   * 分页查询（带总数）
   */
  async findList(
    params: QueryParams,
    option: QueryOption = { transaction: null }
  ): Promise<PaginatedResult> {
    const builder = this.getSQLBuilder();

    // 构建数据查询
    const dataBuilt = builder.buildSelect(params);

    // 构建计数查询
    const countBuilt = builder.buildCount(params);

    // 并行执行两个查询
    const [dataResult, countResult] = await Promise.all([
      this.executeQuery(dataBuilt.sql, dataBuilt.params, option),
      this.executeQuery(countBuilt.sql, countBuilt.params, option),
    ]);

    const normalizedData = this.normalizeQueryResult(dataResult);
    const normalizedCount = this.normalizeQueryResult(countResult);

    return {
      data: normalizedData.rows,
      recordsTotal: normalizedCount.rows[0]?.total ?? 0,
    };
  }

  /**
   * 瀑布流查询
   */
  async find(
    params: QueryParams,
    option: QueryOption = { transaction: null }
  ): Promise<WaterfallResult> {
    const limit = params.limit || [0, 10];
    const fetchCount = limit[1] + 1; // 多取一条用于判断是否有下一页

    // 修改 limit 参数
    const modifiedParams = {
      ...params,
      limit: [limit[0], fetchCount] as [number, number],
    };

    const builder = this.getSQLBuilder();
    const built = builder.buildSelect(modifiedParams);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    const normalized = this.normalizeQueryResult(rawResult);

    const isLastPage = normalized.rows.length <= limit[1];
    return {
      data: isLastPage ? normalized.rows : normalized.rows.slice(0, -1),
      isLastPage,
    };
  }

  /**
   * 单条插入
   */
  async insert(
    params: InsertParams,
    option: QueryOption = { transaction: null }
  ): Promise<InsertResult> {
    const insertion = params.insertion as Record<string, any>;
    const builder = this.getSQLBuilder();
    const built = builder.buildInsert(params.configs.tableName, insertion);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    return this.normalizeInsertResult(rawResult, insertion);
  }

  /**
   * 批量插入
   */
  async inserts(
    params: InsertParams,
    option: QueryOption = { transaction: null }
  ): Promise<ModifyResult> {
    const insertList = params.insertion as Array<Record<string, any>>;
    if (!insertList || insertList.length === 0) {
      return { affectedRows: 0 };
    }

    const builder = this.getSQLBuilder();
    const built = builder.buildBatchInsert(params.configs.tableName, insertList);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    return this.normalizeModifyResult(rawResult);
  }

  /**
   * 删除
   */
  async delete(
    params: DeleteParams,
    option: QueryOption = { transaction: null }
  ): Promise<ModifyResult> {
    // 安全检查：禁止无条件删除
    if (
      (!params.keyword || params.keyword.length === 0) &&
      (!params.where || params.where.length === 0)
    ) {
      throw new Error('Delete operation requires at least one condition to prevent full table deletion.');
    }

    const builder = this.getSQLBuilder();
    const built = builder.buildDelete({
      keyword: params.keyword,
      where: params.where,
      configs: params.configs,
    });

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    return this.normalizeModifyResult(rawResult);
  }

  /**
   * 更新
   */
  async update(
    params: UpdateParams,
    option: QueryOption = { transaction: null }
  ): Promise<ModifyResult> {
    // 安全检查：禁止无条件更新
    if (
      (!params.keyword || params.keyword.length === 0) &&
      (!params.where || params.where.length === 0)
    ) {
      throw new Error('Update operation requires at least one condition to prevent full table update.');
    }

    const builder = this.getSQLBuilder();
    const built = builder.buildUpdate(params);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    return this.normalizeModifyResult(rawResult);
  }

  /**
   * 聚合查询
   */
  async aggregate(
    params: QueryParams & { aggregate: AggregateItem[] },
    option: QueryOption = { transaction: null }
  ): Promise<AggregateResult[]> {
    const builder = this.getSQLBuilder();
    const built = builder.buildAggregate(params);

    const rawResult = await this.executeQuery(built.sql, built.params, option);
    const normalized = this.normalizeQueryResult(rawResult);

    return normalized.rows as AggregateResult[];
  }

  /**
   * 执行原生 SQL
   */
  async sql(
    sql: string,
    parameters: any[] = [],
    option: QueryOption = { transaction: null }
  ): Promise<any> {
    return this.executeQuery(sql, parameters, option);
  }

  /**
   * 健康检查（默认实现）
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.execute('SELECT 1', []);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 关闭连接（需要子类覆盖）
   */
  async close(): Promise<void> {
    // 默认空实现，子类需要覆盖
  }

  /**
   * 获取连接池状态（需要子类覆盖）
   */
  getPoolStatus(): { active: number; idle: number; waiting: number } {
    return { active: 0, idle: 0, waiting: 0 };
  }
}
