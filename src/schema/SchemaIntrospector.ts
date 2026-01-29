/**
 * SchemaIntrospector - 数据库结构自省
 * 提供跨数据库的表结构查询能力
 * 支持 AI 场景下的数据库结构探索
 */

import type { FieldConfig, Configs } from '../types/onela.js';

/**
 * 表信息
 */
export interface TableInfo {
  /** 表名 */
  tableName: string;
  /** 表注释 */
  comment?: string;
  /** 表类型 (TABLE, VIEW) */
  type?: string;
  /** 行数估算 */
  rowCount?: number;
}

/**
 * 列信息
 */
export interface ColumnInfo {
  /** 列名 */
  name: string;
  /** 数据类型 */
  type: string;
  /** 是否可为 NULL */
  nullable: boolean;
  /** 默认值 */
  defaultValue: any;
  /** 是否为主键 */
  isPrimary: boolean;
  /** 是否自增 */
  isAutoIncrement: boolean;
  /** 列注释 */
  comment?: string;
  /** 字符最大长度 */
  maxLength?: number;
  /** 数值精度 */
  precision?: number;
  /** 数值小数位 */
  scale?: number;
}

/**
 * 索引信息
 */
export interface IndexInfo {
  /** 索引名 */
  name: string;
  /** 索引列 */
  columns: string[];
  /** 是否唯一 */
  unique: boolean;
  /** 是否主键索引 */
  isPrimary: boolean;
}

/**
 * 完整表结构信息
 */
export interface TableSchema {
  /** 表信息 */
  table: TableInfo;
  /** 列信息 */
  columns: ColumnInfo[];
  /** 索引信息 */
  indexes: IndexInfo[];
}

/**
 * Schema 自省器
 * 通过执行数据库元数据查询获取表结构信息
 */
export class SchemaIntrospector {
  private dbType: string;
  private executor: (sql: string, params?: any[]) => Promise<any>;

  /**
   * @param dbType 数据库类型
   * @param executor SQL 执行函数（通常来自 ActionManager.sql()）
   */
  constructor(
    dbType: string,
    executor: (sql: string, params?: any[]) => Promise<any>
  ) {
    this.dbType = dbType.toLowerCase();
    this.executor = executor;
  }

  /**
   * 获取所有表列表
   */
  async getTables(database?: string): Promise<TableInfo[]> {
    let sql: string;
    let params: any[] = [];

    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb': case 'oceanbase': case 'polardb':
        sql = `SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS comment, TABLE_TYPE AS type, TABLE_ROWS AS rowCount
               FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
               ORDER BY TABLE_NAME`;
        break;

      case 'postgresql': case 'postgres': case 'pg':
        sql = `SELECT tablename AS "tableName", obj_description((schemaname || '.' || tablename)::regclass) AS comment,
               'TABLE' AS type FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
        break;

      case 'sqlite': case 'sqlite3':
        sql = `SELECT name AS tableName, 'TABLE' AS type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
        break;

      case 'sqlserver': case 'mssql':
        sql = `SELECT TABLE_NAME AS tableName, TABLE_TYPE AS type FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`;
        break;

      case 'oracle': case 'oracledb':
        sql = `SELECT TABLE_NAME AS "tableName", COMMENTS AS "comment" FROM USER_TAB_COMMENTS WHERE TABLE_TYPE = 'TABLE' ORDER BY TABLE_NAME`;
        break;

      default:
        throw new Error(`Unsupported database type for introspection: ${this.dbType}`);
    }

    const result = await this.executor(sql, params);
    const rows = Array.isArray(result) ? result : (result?.rows || []);
    return rows.map((row: any) => ({
      tableName: row.tableName || row.TABLE_NAME || row.name,
      comment: row.comment || row.TABLE_COMMENT,
      type: row.type || row.TABLE_TYPE || 'TABLE',
      rowCount: row.rowCount || row.TABLE_ROWS,
    }));
  }

  /**
   * 获取表的列信息
   */
  async getColumns(tableName: string): Promise<ColumnInfo[]> {
    let sql: string;
    const params: any[] = [];

    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb': case 'oceanbase': case 'polardb':
        sql = `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY,
               EXTRA, COLUMN_COMMENT, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
               FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
               ORDER BY ORDINAL_POSITION`;
        params.push(tableName);
        break;

      case 'postgresql': case 'postgres': case 'pg':
        sql = `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
               c.character_maximum_length, c.numeric_precision, c.numeric_scale,
               CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary
               FROM information_schema.columns c
               LEFT JOIN (SELECT ku.column_name FROM information_schema.key_column_usage ku
                 JOIN information_schema.table_constraints tc ON ku.constraint_name = tc.constraint_name
                 WHERE tc.constraint_type = 'PRIMARY KEY' AND ku.table_name = $1) pk ON c.column_name = pk.column_name
               WHERE c.table_name = $1 AND c.table_schema = 'public'
               ORDER BY c.ordinal_position`;
        params.push(tableName);
        break;

      case 'sqlite': case 'sqlite3':
        sql = `PRAGMA table_info("${tableName}")`;
        break;

      case 'sqlserver': case 'mssql':
        sql = `SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
               c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE,
               CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS IS_PRIMARY
               FROM INFORMATION_SCHEMA.COLUMNS c
               LEFT JOIN (SELECT ku.COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                 JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON ku.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                 WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND ku.TABLE_NAME = @p1) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
               WHERE c.TABLE_NAME = @p1
               ORDER BY c.ORDINAL_POSITION`;
        params.push(tableName);
        break;

      case 'oracle': case 'oracledb':
        sql = `SELECT c.COLUMN_NAME, c.DATA_TYPE, c.NULLABLE, c.DATA_DEFAULT,
               c.CHAR_LENGTH, c.DATA_PRECISION, c.DATA_SCALE,
               CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS IS_PRIMARY
               FROM USER_TAB_COLUMNS c
               LEFT JOIN (SELECT uc.COLUMN_NAME FROM USER_CONS_COLUMNS uc
                 JOIN USER_CONSTRAINTS con ON uc.CONSTRAINT_NAME = con.CONSTRAINT_NAME
                 WHERE con.CONSTRAINT_TYPE = 'P' AND uc.TABLE_NAME = :1) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
               WHERE c.TABLE_NAME = :1
               ORDER BY c.COLUMN_ID`;
        params.push(tableName.toUpperCase());
        break;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }

    const result = await this.executor(sql, params);
    const rows = Array.isArray(result) ? result : (result?.rows || []);

    return rows.map((row: any) => this.normalizeColumnInfo(row));
  }

  /**
   * 标准化列信息（不同数据库返回格式统一化）
   */
  private normalizeColumnInfo(row: any): ColumnInfo {
    // SQLite PRAGMA 格式
    if (row.cid !== undefined) {
      return {
        name: row.name,
        type: row.type || 'TEXT',
        nullable: row.notnull === 0,
        defaultValue: row.dflt_value,
        isPrimary: row.pk === 1,
        isAutoIncrement: row.pk === 1 && (row.type || '').toUpperCase() === 'INTEGER',
      };
    }

    // 标准 information_schema 格式
    return {
      name: row.COLUMN_NAME || row.column_name,
      type: (row.DATA_TYPE || row.data_type || '').toLowerCase(),
      nullable: (row.IS_NULLABLE || row.is_nullable || row.NULLABLE) !== 'NO' && row.NULLABLE !== 'N',
      defaultValue: row.COLUMN_DEFAULT || row.column_default || row.DATA_DEFAULT,
      isPrimary: (row.COLUMN_KEY === 'PRI') || (row.IS_PRIMARY === 'YES') || (row.is_primary === 'YES'),
      isAutoIncrement: (row.EXTRA || '').includes('auto_increment') || (row.column_default || '').includes('nextval'),
      comment: row.COLUMN_COMMENT || row.column_comment,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length || row.CHAR_LENGTH,
      precision: row.NUMERIC_PRECISION || row.numeric_precision || row.DATA_PRECISION,
      scale: row.NUMERIC_SCALE || row.numeric_scale || row.DATA_SCALE,
    };
  }

  /**
   * 获取完整表结构
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    const [columns, tables] = await Promise.all([
      this.getColumns(tableName),
      this.getTables(),
    ]);

    const table = tables.find((t) => t.tableName === tableName) || { tableName };

    return {
      table,
      columns,
      indexes: [], // 索引查询按需实现
    };
  }

  /**
   * 将列信息转换为 Onela FieldConfig 格式
   */
  static toFieldConfigs(columns: ColumnInfo[]): FieldConfig[] {
    return columns.map((col) => ({
      name: col.name,
      type: col.type,
      primary: col.isPrimary || undefined,
      increment: col.isAutoIncrement || undefined,
      default: col.defaultValue ?? (col.nullable ? null : undefined),
      comment: col.comment || '',
    })) as FieldConfig[];
  }

  /**
   * 将列信息转换为 Onela Configs 格式
   */
  static toConfigs(tableName: string, engine: string, columns: ColumnInfo[]): Configs {
    return {
      engine,
      tableName,
      fields: this.toFieldConfigs(columns),
    };
  }

  /**
   * 生成表结构的文本描述（供 AI 使用）
   */
  static describeTable(schema: TableSchema): string {
    const lines: string[] = [];
    lines.push(`Table: ${schema.table.tableName}`);
    if (schema.table.comment) lines.push(`Comment: ${schema.table.comment}`);
    lines.push(`Columns:`);

    for (const col of schema.columns) {
      let desc = `  - ${col.name} (${col.type})`;
      if (col.isPrimary) desc += ' [PRIMARY KEY]';
      if (col.isAutoIncrement) desc += ' [AUTO INCREMENT]';
      if (!col.nullable) desc += ' [NOT NULL]';
      if (col.defaultValue !== undefined && col.defaultValue !== null) desc += ` [DEFAULT: ${col.defaultValue}]`;
      if (col.comment) desc += ` -- ${col.comment}`;
      lines.push(desc);
    }

    return lines.join('\n');
  }
}

/**
 * 工厂函数
 */
export function createSchemaIntrospector(
  dbType: string,
  executor: (sql: string, params?: any[]) => Promise<any>
): SchemaIntrospector {
  return new SchemaIntrospector(dbType, executor);
}
