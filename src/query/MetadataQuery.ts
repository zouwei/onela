/**
 * MetadataQuery - 数据库元数据查询抽象
 * 提供跨数据库的元数据查询能力
 * 包括：数据库列表、表列表、列信息、索引信息、约束信息
 */

/**
 * 数据库信息
 */
export interface DatabaseInfo {
  /** 数据库名 */
  name: string;
  /** 字符集 */
  charset?: string;
  /** 排序规则 */
  collation?: string;
  /** 大小（字节） */
  size?: number;
}

/**
 * 约束信息
 */
export interface ConstraintInfo {
  /** 约束名 */
  name: string;
  /** 约束类型 */
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  /** 关联列 */
  columns: string[];
  /** 引用表（外键） */
  refTable?: string;
  /** 引用列（外键） */
  refColumns?: string[];
}

/**
 * 元数据查询 SQL 生成器
 */
export class MetadataQuery {
  private dbType: string;

  constructor(dbType: string) {
    this.dbType = dbType.toLowerCase();
  }

  /**
   * 获取数据库列表 SQL
   */
  getDatabasesSQL(): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT SCHEMA_NAME AS name, DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT datname AS name, pg_encoding_to_char(encoding) AS charset FROM pg_database WHERE datistemplate = false ORDER BY datname`;

      case 'sqlite': case 'sqlite3':
        return `PRAGMA database_list`;

      case 'sqlserver': case 'mssql':
        return `SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name`;

      case 'oracle': case 'oracledb':
        return `SELECT DISTINCT TABLESPACE_NAME AS name FROM USER_TABLES ORDER BY TABLESPACE_NAME`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * 获取表行数 SQL
   */
  getTableRowCountSQL(tableName: string): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT TABLE_ROWS AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT reltuples::bigint AS count FROM pg_class WHERE relname = '${tableName}'`;

      case 'sqlite': case 'sqlite3':
        return `SELECT COUNT(*) AS count FROM "${tableName}"`;

      case 'sqlserver': case 'mssql':
        return `SELECT SUM(row_count) AS count FROM sys.dm_db_partition_stats WHERE object_id = OBJECT_ID('${tableName}') AND index_id < 2`;

      case 'oracle': case 'oracledb':
        return `SELECT NUM_ROWS AS count FROM USER_TABLES WHERE TABLE_NAME = '${tableName.toUpperCase()}'`;

      default:
        return `SELECT COUNT(*) AS count FROM ${tableName}`;
    }
  }

  /**
   * 获取表大小 SQL
   */
  getTableSizeSQL(tableName: string): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT (DATA_LENGTH + INDEX_LENGTH) AS size_bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT pg_total_relation_size('${tableName}') AS size_bytes`;

      case 'sqlite': case 'sqlite3':
        return `SELECT page_count * page_size AS size_bytes FROM pragma_page_count(), pragma_page_size()`;

      case 'sqlserver': case 'mssql':
        return `SELECT SUM(a.total_pages) * 8 * 1024 AS size_bytes FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id JOIN sys.allocation_units a ON p.partition_id = a.container_id WHERE t.name = '${tableName}'`;

      case 'oracle': case 'oracledb':
        return `SELECT BYTES AS size_bytes FROM USER_SEGMENTS WHERE SEGMENT_NAME = '${tableName.toUpperCase()}'`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * 获取索引信息 SQL
   */
  getIndexesSQL(tableName: string): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT INDEX_NAME AS name, COLUMN_NAME AS column_name, NON_UNIQUE, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' ORDER BY INDEX_NAME, SEQ_IN_INDEX`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT i.relname AS name, a.attname AS column_name, NOT ix.indisunique AS non_unique FROM pg_class t JOIN pg_index ix ON t.oid = ix.indrelid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) WHERE t.relname = '${tableName}' ORDER BY i.relname`;

      case 'sqlite': case 'sqlite3':
        return `PRAGMA index_list("${tableName}")`;

      case 'sqlserver': case 'mssql':
        return `SELECT i.name AS name, c.name AS column_name, CASE WHEN i.is_unique = 1 THEN 0 ELSE 1 END AS non_unique FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id WHERE i.object_id = OBJECT_ID('${tableName}') ORDER BY i.name, ic.key_ordinal`;

      case 'oracle': case 'oracledb':
        return `SELECT i.INDEX_NAME AS name, ic.COLUMN_NAME AS column_name, CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 0 ELSE 1 END AS non_unique FROM USER_INDEXES i JOIN USER_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME WHERE i.TABLE_NAME = '${tableName.toUpperCase()}' ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * 获取外键信息 SQL
   */
  getForeignKeysSQL(tableName: string): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND REFERENCED_TABLE_NAME IS NOT NULL`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT tc.constraint_name AS name, kcu.column_name AS column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${tableName}'`;

      case 'sqlite': case 'sqlite3':
        return `PRAGMA foreign_key_list("${tableName}")`;

      case 'sqlserver': case 'mssql':
        return `SELECT f.name AS name, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name, OBJECT_NAME(f.referenced_object_id) AS ref_table, COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ref_column FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id WHERE f.parent_object_id = OBJECT_ID('${tableName}')`;

      case 'oracle': case 'oracledb':
        return `SELECT a.CONSTRAINT_NAME AS name, a.COLUMN_NAME AS column_name, c_pk.TABLE_NAME AS ref_table, b.COLUMN_NAME AS ref_column FROM USER_CONS_COLUMNS a JOIN USER_CONSTRAINTS c ON a.CONSTRAINT_NAME = c.CONSTRAINT_NAME JOIN USER_CONSTRAINTS c_pk ON c.R_CONSTRAINT_NAME = c_pk.CONSTRAINT_NAME JOIN USER_CONS_COLUMNS b ON c_pk.CONSTRAINT_NAME = b.CONSTRAINT_NAME WHERE c.CONSTRAINT_TYPE = 'R' AND a.TABLE_NAME = '${tableName.toUpperCase()}'`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * 获取数据库版本 SQL
   */
  getVersionSQL(): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT VERSION() AS version`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT version() AS version`;

      case 'sqlite': case 'sqlite3':
        return `SELECT sqlite_version() AS version`;

      case 'sqlserver': case 'mssql':
        return `SELECT @@VERSION AS version`;

      case 'oracle': case 'oracledb':
        return `SELECT BANNER AS version FROM V$VERSION WHERE ROWNUM = 1`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }

  /**
   * 获取当前数据库名 SQL
   */
  getCurrentDatabaseSQL(): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb':
        return `SELECT DATABASE() AS name`;

      case 'postgresql': case 'postgres': case 'pg':
        return `SELECT current_database() AS name`;

      case 'sqlite': case 'sqlite3':
        return `PRAGMA database_list`;

      case 'sqlserver': case 'mssql':
        return `SELECT DB_NAME() AS name`;

      case 'oracle': case 'oracledb':
        return `SELECT SYS_CONTEXT('USERENV', 'DB_NAME') AS name FROM DUAL`;

      default:
        throw new Error(`Unsupported database type: ${this.dbType}`);
    }
  }
}

/**
 * 工厂函数
 */
export function createMetadataQuery(dbType: string): MetadataQuery {
  return new MetadataQuery(dbType);
}
