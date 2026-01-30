/**
 * DDLBuilder - 数据定义语言构建器
 * 支持 CREATE TABLE, ALTER TABLE, DROP TABLE 等 DDL 操作
 * 通过方言系统自动适配不同数据库的 DDL 语法
 */

import { DialectFactory } from '../dialect/DialectFactory.js';
import type { IDialect } from '../dialect/IDialect.js';
import type { FieldConfig } from '../types/onela.js';

/**
 * 列定义（用于 CREATE TABLE）
 */
export interface ColumnDefinition {
  /** 列名 */
  name: string;
  /** 数据类型 */
  type: string;
  /** 是否为主键 */
  primary?: boolean;
  /** 是否自增 */
  increment?: boolean;
  /** 是否允许 NULL */
  nullable?: boolean;
  /** 默认值 */
  defaultValue?: any;
  /** 备注 */
  comment?: string;
  /** 是否唯一 */
  unique?: boolean;
  /** 字段长度（如 VARCHAR(255)） */
  length?: number;
  /** 精度（如 DECIMAL(10,2)） */
  precision?: number;
  /** 小数位数 */
  scale?: number;
}

/**
 * 索引定义
 */
export interface IndexDefinition {
  /** 索引名 */
  name: string;
  /** 索引列 */
  columns: string[];
  /** 是否唯一索引 */
  unique?: boolean;
}

/**
 * 表定义
 */
export interface TableDefinition {
  /** 表名 */
  tableName: string;
  /** 列定义 */
  columns: ColumnDefinition[];
  /** 索引定义 */
  indexes?: IndexDefinition[];
  /** 表注释 */
  comment?: string;
  /** 字符集（MySQL） */
  charset?: string;
  /** 排序规则（MySQL） */
  collation?: string;
  /** 存储引擎（MySQL） */
  engine?: string;
  /** 是否使用 IF NOT EXISTS */
  ifNotExists?: boolean;
}

/**
 * ALTER TABLE 操作类型
 */
export type AlterAction =
  | { type: 'addColumn'; column: ColumnDefinition }
  | { type: 'dropColumn'; columnName: string }
  | { type: 'modifyColumn'; column: ColumnDefinition }
  | { type: 'renameColumn'; oldName: string; newName: string }
  | { type: 'addIndex'; index: IndexDefinition }
  | { type: 'dropIndex'; indexName: string }
  | { type: 'renameTable'; newName: string };

/**
 * 校验 SQL 标识符（表名、列名等），防止 SQL 注入
 */
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}

/**
 * DDL 构建器
 */
export class DDLBuilder {
  private dialect: IDialect;
  private dbType: string;

  constructor(dbType: string) {
    this.dbType = dbType.toLowerCase();
    this.dialect = DialectFactory.create(this.dbType);
  }

  /**
   * 构建 CREATE TABLE 语句
   */
  buildCreateTable(definition: TableDefinition): string {
    const safeTableName = validateIdentifier(definition.tableName);
    const columns = definition.columns.map((col) => this.buildColumnDef(col));

    // 提取主键
    const primaryKeys = definition.columns
      .filter((col) => col.primary)
      .map((col) => validateIdentifier(col.name));

    if (primaryKeys.length > 0) {
      columns.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
    }

    // 唯一约束
    const uniqueColumns = definition.columns
      .filter((col) => col.unique && !col.primary)
      .map((col) => `UNIQUE (${validateIdentifier(col.name)})`);
    columns.push(...uniqueColumns);

    const ifNotExists = definition.ifNotExists ? 'IF NOT EXISTS ' : '';
    let sql = `CREATE TABLE ${ifNotExists}${safeTableName} (\n  ${columns.join(',\n  ')}\n)`;

    // MySQL/MariaDB 特有选项
    if (['mysql', 'mariadb', 'tidb', 'oceanbase', 'polardb'].includes(this.dbType)) {
      if (definition.engine) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.engine)) {
          throw new Error(`Invalid engine name: "${definition.engine}"`);
        }
        sql += ` ENGINE=${definition.engine}`;
      }
      if (definition.charset) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.charset)) {
          throw new Error(`Invalid charset name: "${definition.charset}"`);
        }
        sql += ` DEFAULT CHARSET=${definition.charset}`;
      }
      if (definition.collation) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(definition.collation)) {
          throw new Error(`Invalid collation name: "${definition.collation}"`);
        }
        sql += ` COLLATE=${definition.collation}`;
      }
      if (definition.comment) sql += ` COMMENT='${definition.comment.replace(/'/g, "''")}'`;
    }

    return sql + ';';
  }

  /**
   * 构建列定义
   */
  private buildColumnDef(col: ColumnDefinition): string {
    const parts: string[] = [validateIdentifier(col.name)];

    // 类型映射
    parts.push(this.mapColumnType(col));

    // NOT NULL
    if (col.nullable === false || col.primary) {
      parts.push('NOT NULL');
    }

    // 自增
    if (col.increment) {
      parts.push(this.getAutoIncrementKeyword());
    }

    // 默认值
    if (col.defaultValue !== undefined && !col.increment) {
      parts.push(`DEFAULT ${this.formatDefault(col.defaultValue)}`);
    }

    // 列注释（MySQL）
    if (col.comment && ['mysql', 'mariadb', 'tidb'].includes(this.dbType)) {
      parts.push(`COMMENT '${col.comment.replace(/'/g, "''")}'`);
    }

    return parts.join(' ');
  }

  /**
   * 映射列类型到目标数据库
   */
  private mapColumnType(col: ColumnDefinition): string {
    const type = col.type.toLowerCase();
    const length = col.length;
    const precision = col.precision;
    const scale = col.scale;

    // 类型映射表
    const typeMap: Record<string, Record<string, string>> = {
      int: {
        mysql: 'INT', postgresql: 'INTEGER', sqlite: 'INTEGER',
        sqlserver: 'INT', oracle: 'NUMBER(10)',
      },
      bigint: {
        mysql: 'BIGINT', postgresql: 'BIGINT', sqlite: 'INTEGER',
        sqlserver: 'BIGINT', oracle: 'NUMBER(19)',
      },
      tinyint: {
        mysql: 'TINYINT', postgresql: 'SMALLINT', sqlite: 'INTEGER',
        sqlserver: 'TINYINT', oracle: 'NUMBER(3)',
      },
      varchar: {
        mysql: `VARCHAR(${length || 255})`, postgresql: `VARCHAR(${length || 255})`,
        sqlite: 'TEXT', sqlserver: `NVARCHAR(${length || 255})`,
        oracle: `VARCHAR2(${length || 255})`,
      },
      text: {
        mysql: 'TEXT', postgresql: 'TEXT', sqlite: 'TEXT',
        sqlserver: 'NVARCHAR(MAX)', oracle: 'CLOB',
      },
      boolean: {
        mysql: 'TINYINT(1)', postgresql: 'BOOLEAN', sqlite: 'INTEGER',
        sqlserver: 'BIT', oracle: 'NUMBER(1)',
      },
      datetime: {
        mysql: 'DATETIME', postgresql: 'TIMESTAMP', sqlite: 'TEXT',
        sqlserver: 'DATETIME2', oracle: 'TIMESTAMP',
      },
      date: {
        mysql: 'DATE', postgresql: 'DATE', sqlite: 'TEXT',
        sqlserver: 'DATE', oracle: 'DATE',
      },
      decimal: {
        mysql: `DECIMAL(${precision || 10}, ${scale || 2})`,
        postgresql: `DECIMAL(${precision || 10}, ${scale || 2})`,
        sqlite: 'REAL',
        sqlserver: `DECIMAL(${precision || 10}, ${scale || 2})`,
        oracle: `NUMBER(${precision || 10}, ${scale || 2})`,
      },
      json: {
        mysql: 'JSON', postgresql: 'JSONB', sqlite: 'TEXT',
        sqlserver: 'NVARCHAR(MAX)', oracle: 'CLOB',
      },
      blob: {
        mysql: 'BLOB', postgresql: 'BYTEA', sqlite: 'BLOB',
        sqlserver: 'VARBINARY(MAX)', oracle: 'BLOB',
      },
    };

    // 查找映射
    const dbKey = ['mariadb', 'tidb', 'oceanbase', 'polardb'].includes(this.dbType) ? 'mysql' : this.dbType;
    const mapped = typeMap[type]?.[dbKey];
    if (mapped) return mapped;

    // 如果没有映射，直接使用原始类型
    if (length) return `${type.toUpperCase()}(${length})`;
    return type.toUpperCase();
  }

  /**
   * 获取自增关键字
   */
  private getAutoIncrementKeyword(): string {
    switch (this.dbType) {
      case 'mysql': case 'mariadb': case 'tidb': case 'oceanbase': case 'polardb':
        return 'AUTO_INCREMENT';
      case 'sqlite':
        return 'AUTOINCREMENT';
      case 'postgresql':
        return ''; // PostgreSQL 使用 SERIAL 类型
      case 'sqlserver':
        return 'IDENTITY(1,1)';
      case 'oracle':
        return ''; // Oracle 使用 SEQUENCE
      default:
        return 'AUTO_INCREMENT';
    }
  }

  /**
   * 格式化默认值
   */
  private formatDefault(value: any): string {
    if (value === null) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value === 'CURRENT_TIMESTAMP') return 'CURRENT_TIMESTAMP';
    if (typeof value === 'string' && value.toUpperCase().includes('(')) return value; // 函数调用
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * 构建 DROP TABLE 语句
   */
  buildDropTable(tableName: string, ifExists: boolean = true): string {
    const safeTableName = validateIdentifier(tableName);
    const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
    return `DROP TABLE ${ifExistsClause}${safeTableName};`;
  }

  /**
   * 构建 ALTER TABLE 语句
   */
  buildAlterTable(tableName: string, actions: AlterAction[]): string[] {
    return actions.map((action) => this.buildAlterAction(tableName, action));
  }

  /**
   * 构建单个 ALTER TABLE 操作
   */
  private buildAlterAction(tableName: string, action: AlterAction): string {
    const safeTable = validateIdentifier(tableName);
    switch (action.type) {
      case 'addColumn':
        return `ALTER TABLE ${safeTable} ADD COLUMN ${this.buildColumnDef(action.column)};`;

      case 'dropColumn':
        return `ALTER TABLE ${safeTable} DROP COLUMN ${validateIdentifier(action.columnName)};`;

      case 'modifyColumn':
        if (['mysql', 'mariadb', 'tidb'].includes(this.dbType)) {
          return `ALTER TABLE ${safeTable} MODIFY COLUMN ${this.buildColumnDef(action.column)};`;
        } else if (this.dbType === 'postgresql') {
          return `ALTER TABLE ${safeTable} ALTER COLUMN ${validateIdentifier(action.column.name)} TYPE ${this.mapColumnType(action.column)};`;
        } else if (this.dbType === 'sqlserver') {
          return `ALTER TABLE ${safeTable} ALTER COLUMN ${this.buildColumnDef(action.column)};`;
        }
        return `ALTER TABLE ${safeTable} MODIFY ${this.buildColumnDef(action.column)};`;

      case 'renameColumn': {
        const safeOld = validateIdentifier(action.oldName);
        const safeNew = validateIdentifier(action.newName);
        if (['mysql', 'mariadb'].includes(this.dbType)) {
          return `ALTER TABLE ${safeTable} RENAME COLUMN ${safeOld} TO ${safeNew};`;
        } else if (this.dbType === 'sqlserver') {
          return `EXEC sp_rename '${safeTable}.${safeOld}', '${safeNew}', 'COLUMN';`;
        }
        return `ALTER TABLE ${safeTable} RENAME COLUMN ${safeOld} TO ${safeNew};`;
      }

      case 'addIndex': {
        const unique = action.index.unique ? 'UNIQUE ' : '';
        const safeCols = action.index.columns.map(c => validateIdentifier(c));
        return `CREATE ${unique}INDEX ${validateIdentifier(action.index.name)} ON ${safeTable} (${safeCols.join(', ')});`;
      }

      case 'dropIndex':
        if (['mysql', 'mariadb', 'tidb'].includes(this.dbType)) {
          return `DROP INDEX ${validateIdentifier(action.indexName)} ON ${safeTable};`;
        }
        return `DROP INDEX ${validateIdentifier(action.indexName)};`;

      case 'renameTable':
        if (this.dbType === 'sqlserver') {
          return `EXEC sp_rename '${safeTable}', '${validateIdentifier(action.newName)}';`;
        }
        return `ALTER TABLE ${safeTable} RENAME TO ${validateIdentifier(action.newName)};`;

      default:
        throw new Error(`Unknown alter action type`);
    }
  }

  /**
   * 构建 CREATE INDEX 语句
   */
  buildCreateIndex(tableName: string, index: IndexDefinition): string {
    const safeTable = validateIdentifier(tableName);
    const safeName = validateIdentifier(index.name);
    const safeCols = index.columns.map(c => validateIdentifier(c));
    const unique = index.unique ? 'UNIQUE ' : '';
    return `CREATE ${unique}INDEX ${safeName} ON ${safeTable} (${safeCols.join(', ')});`;
  }

  /**
   * 从 FieldConfig 数组生成 ColumnDefinition 数组
   */
  static fromFieldConfigs(fields: FieldConfig[]): ColumnDefinition[] {
    return fields.map((field) => ({
      name: field.name,
      type: field.type,
      primary: field.primary || false,
      increment: field.increment || false,
      defaultValue: field.default,
      comment: field.comment,
    }));
  }
}

/**
 * 工厂函数
 */
export function createDDLBuilder(dbType: string): DDLBuilder {
  return new DDLBuilder(dbType);
}
