

// === 数据库实例 ===

interface DatabaseConfig {
  type: 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
  engine: string;
  value: any;
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
      | 'tinyint';
    default: string | number | null;
    comment: string;
    primary?: true;
}

interface KeywordItem {
  key: string;
  value: any;
  logic?: 'and' | 'or';
  operator?:
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
    | 'is';
  sqlType?: string;
  format?: boolean;
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

interface FieldConfig {
  name: string;
  type: string; // 如 'varchar', 'int', 'datetime'
}

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
    DatabaseConfig, DBSource, OODBC, Command, Configs, CallParas, ProcParam,
    FieldConfig,
    KeywordItem,
    QueryResult, 
    UpdateResult, 
    DeleteResult,

    Transaction,
    QueryOption,
    AggregateItem,
    QueryParams,
    UpdateFieldItem , 
    UpdateCaseItem, 
    UpdateCaseField, 
    UpdateParams, 
    InsertParams,
    DeleteParams,
    Parameter
};