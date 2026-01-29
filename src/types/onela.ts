

// === 数据库实例 ===

/**
 * 支持的数据库类型
 * - mysql: MySQL 5.7+, 8.0+
 * - mariadb: MariaDB 10.x+
 * - tidb: TiDB (MySQL 兼容)
 * - postgresql: PostgreSQL 10+
 * - sqlite: SQLite 3.x
 * - sqlserver: SQL Server 2012+
 * - oracle: Oracle 11g+, 12c+, 19c+
 * - oceanbase: OceanBase (MySQL 模式)
 * - polardb: PolarDB (MySQL 兼容)
 */
type SupportedDatabaseType =
  | 'mysql'
  | 'mariadb'
  | 'tidb'
  | 'postgresql'
  | 'sqlite'
  | 'sqlserver'
  | 'oracle'
  | 'oceanbase'
  | 'polardb';

/**
 * 数据库配置
 */
interface DatabaseConfig {
  /** 数据库类型 */
  type: SupportedDatabaseType;
  /** 引擎标识（用于多数据库管理） */
  engine: string;
  /** 连接配置 */
  value: any;
  /** 节点角色（用于读写分离） */
  role?: 'master' | 'slave' | 'reader' | 'writer';
  /** 权重（用于负载均衡） */
  weight?: number;
}

interface DBSource {
  READER: any;
  WRITER: any;
}

interface OODBC {
  [database: string]: {
    [instance: string]: DBSource;
  };
}

interface Command {
  tableName: string;
  aggregate?: string;
}


interface ProcParam {
  name: string;
  type?: 'in' | 'out' | 'inout';
  mandatory?: boolean;
  defaultValue?: any;
}

interface CallParas {
  proc_name: string;
  keyword: Record<string, any>;
  config: { parameter: ProcParam[] };
}




// === 业务实例 ===

interface Configs {
    engine: string   // default
    tableName: string
    fields?: FieldConfig[];
}

/**
 * 字段类型
 */
interface FieldConfig {
    name: string;
    type: string 
      | 'varchar'
      | 'nvarchar'
      | 'json'
      | 'blob'
      | 'datetime'
      | 'timestampt'
      | 'timestamptz'
      | 'tinyint';
    default: any;
    comment: string;
    primary?: true;
    increment?: boolean
}

/**
 * 查询条件操作符类型
 * - '=', '>', '<', '<>', '>=', '<=': 比较操作符
 * - 'in', 'not in': 集合操作符
 * - '%': 左模糊 (LIKE '%value')
 * - 'x%': 右模糊 (LIKE 'value%')
 * - '%%': 全模糊 (LIKE '%value%')
 * - 'is', 'is not': NULL 判断
 * - 'between', 'not between': 范围查询
 * - 'like', 'not like': 模糊匹配
 * - 'regexp': 正则匹配 (PostgreSQL)
 */
type ConditionOperator =
  | '='
  | '>'
  | '<'
  | '<>'
  | '>='
  | '<='
  | 'in'
  | 'not in'
  | '%'
  | 'x%'
  | '%%'
  | 'is'
  | 'is not'
  | 'between'
  | 'not between'
  | 'like'
  | 'not like'
  | 'regexp'
  | '~'
  | 'raw';

/**
 * 查询条件项
 */
interface KeywordItem {
  /** 字段名 */
  key: string;
  /** 条件值 */
  value: any;
  /** 逻辑运算符 (默认: 'and') */
  logic?: 'and' | 'or';
  /** 比较操作符 (默认: '=') */
  operator?: ConditionOperator;
  /** SQL 类型（用于参数绑定） */
  sqlType?: string;
  /** 是否为格式化值（不进行参数化） */
  format?: boolean;
  /** 字段配置 */
  configs?: { fields: FieldConfig[] };
}



interface QueryResult {
  select?: string;
  where?: string;
  orderBy?: string;
  groupBy?: string;
  parameters?: any[];
  limit?:  number[] | string; // [offset, limit]
}

interface UpdateResult {
  set: string[];
  where: string;
  parameters: any[];
  limit?:  number[] | string; // [offset, limit]
  
}

interface DeleteResult {
  where: string;
  parameters: any[];
}

// === 类型定义 ===
interface Transaction {
  client: any;
  begin: () => Promise<void>;
  commit: () => Promise<string>;
  rollback: () => Promise<string>;
}

interface QueryOption {
  transaction?: Transaction | null;
}

// 移除重复的 FieldConfig 定义（已在上方定义）

interface AggregateItem {
  function: 'count' | 'sum' | 'max' | 'min' | 'abs' | 'avg';
  field: string;
  name: string;
}

/**
 * 查询参数
 */
interface QueryParams {
  command: Command;
  configs: Configs
  // {
  //   tableName: string;
  //   fields?: FieldConfig[];
  // };
  select?: string[];
  keyword?: Array<{
    key: string;
    value: any;
    logic?: 'and' | 'or';
    operator?: '=' | '>' | '<' | '<>' | '>=' | '<=' | 'in' | 'not in' | '%' | 'x%' | '%%' | 'is';
  }>;
  where?: any[];
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  groupBy?: string[];
  limit?: [number, number];
  aggregate?: AggregateItem[];
}

/**
 * 写入参数
 */
interface InsertParams {
  command: Command;
  configs: Configs
  // {
  //   tableName: string;
  //   fields?: FieldConfig[];
  // };
  insertion: any[]; // 数组，数组内部是实体对象的字段
}

/**
 * 更新参数
 */
interface UpdateParams extends QueryParams {
  update: UpdateFieldItem[]
}

interface UpdateFieldItem {
  key: string;
  value: any;
  operator?: 'replace' | 'plus' | 'reduce';
  sqlType?: string;
  case_field?: string;
  case_item?: UpdateCaseItem[];
}

interface UpdateCaseItem {
  case_value: any;
  value: any;
  operator?: 'replace' | 'plus' | 'reduce';
}

interface UpdateCaseField {
  key: string;
  case_field: string;
  case_item: UpdateCaseItem[];
}



// { keyword?: KeywordItem[]; where?: KeywordItem[]; configs: { fields: FieldConfig[] };}
interface DeleteParams extends QueryParams {
  keyword?: any[];
  where?: any[];

}

interface Parameter {
  name: string;
  sqlType: string;
  value: any;
}


export type {
    // 数据库配置
    SupportedDatabaseType,
    DatabaseConfig,
    DBSource,
    OODBC,
    Command,
    Configs,
    CallParas,
    ProcParam,

    // 字段定义
    FieldConfig,

    // 查询条件
    ConditionOperator,
    KeywordItem,

    // 查询结果
    QueryResult,
    UpdateResult,
    DeleteResult,

    // 事务
    Transaction,
    QueryOption,

    // 聚合
    AggregateItem,

    // 参数类型
    QueryParams,
    UpdateFieldItem,
    UpdateCaseItem,
    UpdateCaseField,
    UpdateParams,
    InsertParams,
    DeleteParams,
    Parameter
};