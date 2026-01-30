/**
 * IDialect - SQL 方言接口
 * 定义不同数据库的 SQL 语法差异
 */

/**
 * 占位符风格
 */
export type PlaceholderStyle =
  | 'question'      // MySQL, SQLite: ?
  | 'dollar'        // PostgreSQL: $1, $2
  | 'at'            // SQL Server: @p1, @p2
  | 'colon'         // Oracle: :1, :2
  | 'named';        // Oracle named: :name

/**
 * 标识符引用风格
 */
export type QuoteStyle =
  | 'backtick'      // MySQL: `column`
  | 'double'        // PostgreSQL, Oracle, SQLite: "column"
  | 'bracket';      // SQL Server: [column]

/**
 * 分页语法风格
 */
export type PaginationStyle =
  | 'limit-offset'     // MySQL, PostgreSQL, SQLite: LIMIT x OFFSET y
  | 'offset-fetch'     // SQL Server 2012+, Oracle 12c+: OFFSET x ROWS FETCH NEXT y ROWS ONLY
  | 'rownum'           // Oracle 传统: WHERE ROWNUM <= x
  | 'top';             // SQL Server 传统: SELECT TOP x

/**
 * 方言配置
 */
export interface DialectConfig {
  /** 数据库类型 */
  type: string;
  /** 占位符风格 */
  placeholderStyle: PlaceholderStyle;
  /** 标识符引用风格 */
  quoteStyle: QuoteStyle;
  /** 分页风格 */
  paginationStyle: PaginationStyle;
  /** 是否支持 RETURNING 子句 */
  supportsReturning: boolean;
  /** 是否支持 UPSERT */
  supportsUpsert: boolean;
  /** 是否支持窗口函数 */
  supportsWindowFunctions: boolean;
  /** 是否支持 CTE */
  supportsCTE: boolean;
  /** 是否支持 JSON 操作 */
  supportsJSON: boolean;
  /** 是否区分大小写 */
  caseSensitive: boolean;
  /** 字符串连接运算符 */
  concatOperator: string;
  /** 是否使用双引号字符串 */
  useDoubleQuoteString: boolean;
}

/**
 * SQL 方言接口
 */
export interface IDialect {
  /**
   * 获取方言配置
   */
  getConfig(): DialectConfig;

  /**
   * 获取数据库类型
   */
  getType(): string;

  /**
   * 生成参数占位符
   * @param index 参数索引（从1开始）
   * @param name 可选的参数名
   */
  placeholder(index: number, name?: string): string;

  /**
   * 引用标识符（表名、列名等）
   * @param identifier 标识符
   */
  quoteIdentifier(identifier: string): string;

  /**
   * 生成 LIMIT/分页子句
   * @param offset 偏移量
   * @param limit 限制数量
   * @param currentIndex 当前参数索引
   */
  buildPagination(offset: number, limit: number, currentIndex: number): {
    sql: string;
    params: any[];
    newIndex: number;
  };

  /**
   * 生成 INSERT 语句
   * @param table 表名
   * @param columns 列名数组
   * @param values 值数组
   * @param returning 返回列（如果支持）
   */
  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] };

  /**
   * 生成批量 INSERT 语句
   * @param table 表名
   * @param columns 列名数组
   * @param valuesList 值数组的数组
   */
  buildBatchInsert(
    table: string,
    columns: string[],
    valuesList: any[][]
  ): { sql: string; params: any[] };

  /**
   * 生成 UPDATE 语句
   * @param table 表名
   * @param setClauses SET 子句数组
   * @param whereClause WHERE 子句
   * @param params 参数数组
   */
  buildUpdate(
    table: string,
    setClauses: string[],
    whereClause: string,
    params: any[]
  ): { sql: string; params: any[] };

  /**
   * 生成 DELETE 语句
   * @param table 表名
   * @param whereClause WHERE 子句
   * @param params 参数数组
   */
  buildDelete(
    table: string,
    whereClause: string,
    params: any[]
  ): { sql: string; params: any[] };

  /**
   * 生成 UPSERT 语句（如果支持）
   * @param table 表名
   * @param columns 列名数组
   * @param values 值数组
   * @param conflictColumns 冲突检测列
   * @param updateColumns 更新列
   */
  buildUpsert?(
    table: string,
    columns: string[],
    values: any[],
    conflictColumns: string[],
    updateColumns: string[]
  ): { sql: string; params: any[] };

  /**
   * 转换数据类型
   * @param value 值
   * @param type 目标类型
   */
  castValue(value: any, type: string): string;

  /**
   * 获取当前时间戳函数
   */
  getCurrentTimestamp(): string;

  /**
   * 获取当前日期函数
   */
  getCurrentDate(): string;

  /**
   * 生成字符串连接表达式
   * @param expressions 表达式数组
   */
  concat(...expressions: string[]): string;

  /**
   * 生成 COALESCE 表达式
   * @param expressions 表达式数组
   */
  coalesce(...expressions: string[]): string;

  /**
   * 生成 CASE WHEN 表达式
   * @param field 字段名
   * @param cases 条件数组
   * @param elseValue 默认值
   */
  caseWhen(
    field: string,
    cases: Array<{ when: any; then: any }>,
    elseValue?: any
  ): string;

  /**
   * 转义 LIKE 通配符
   * @param value 值
   */
  escapeLike(value: string): string;

  /**
   * 获取布尔值表示
   * @param value 布尔值
   */
  booleanValue(value: boolean): string | number;

  /**
   * 格式化日期时间
   * @param date 日期
   */
  formatDateTime(date: Date): string;

  /**
   * 获取自增 ID 的查询方式
   */
  getLastInsertId?(): string;
}

/**
 * 方言工厂接口
 */
export interface IDialectFactory {
  create(type: string): IDialect;
  register(type: string, dialect: IDialect): void;
  getSupported(): string[];
}
