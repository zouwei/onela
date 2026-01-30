/**
 * MySQLDialect - MySQL 方言实现
 * 支持：MySQL 5.7+, 8.0+, MariaDB, TiDB, OceanBase, PolarDB
 */

import { BaseDialect } from './BaseDialect.js';
import type { DialectConfig } from './IDialect.js';

export class MySQLDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'mysql',
    placeholderStyle: 'question',
    quoteStyle: 'backtick',
    paginationStyle: 'limit-offset',
    supportsReturning: false, // MySQL 8.0.21+ 部分支持
    supportsUpsert: true,
    supportsWindowFunctions: true, // MySQL 8.0+
    supportsCTE: true, // MySQL 8.0+
    supportsJSON: true, // MySQL 5.7+
    caseSensitive: false,
    concatOperator: 'CONCAT',
    useDoubleQuoteString: false,
  };

  placeholder(_index: number, _name?: string): string {
    return '?';
  }

  buildPagination(
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    // MySQL 使用 LIMIT offset, count 或 LIMIT count OFFSET offset
    return {
      sql: ' LIMIT ?, ?',
      params: [offset, limit],
      newIndex: currentIndex,
    };
  }

  buildUpsert(
    table: string,
    columns: string[],
    values: any[],
    _conflictColumns: string[],
    updateColumns: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map(() => '?').join(', ');

    const updateParts = updateColumns.map(
      (col) => `${this.quoteIdentifier(col)} = VALUES(${this.quoteIdentifier(col)})`
    );

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateParts.join(', ')}`;

    return { sql, params: values };
  }

  getCurrentTimestamp(): string {
    return 'NOW()';
  }

  getCurrentDate(): string {
    return 'CURDATE()';
  }

  booleanValue(value: boolean): number {
    return value ? 1 : 0;
  }

  getLastInsertId(): string {
    return 'SELECT LAST_INSERT_ID() AS id';
  }

  /**
   * JSON 提取表达式
   */
  jsonExtract(column: string, path: string): string {
    return `JSON_EXTRACT(${this.quoteIdentifier(column)}, '${path}')`;
  }

  /**
   * JSON 设置表达式
   */
  jsonSet(column: string, path: string, value: string): string {
    return `JSON_SET(${this.quoteIdentifier(column)}, '${path}', ${value})`;
  }

  /**
   * 全文搜索
   */
  fullTextSearch(columns: string[], query: string): string {
    const cols = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    return `MATCH(${cols}) AGAINST(? IN NATURAL LANGUAGE MODE)`;
  }
}

/**
 * MariaDB 方言 - 继承 MySQL，覆盖差异
 */
export class MariaDBDialect extends MySQLDialect {
  protected config: DialectConfig = {
    type: 'mariadb',
    placeholderStyle: 'question',
    quoteStyle: 'backtick',
    paginationStyle: 'limit-offset',
    supportsReturning: true, // MariaDB 10.5+ 支持 RETURNING
    supportsUpsert: true,
    supportsWindowFunctions: true,
    supportsCTE: true,
    supportsJSON: true,
    caseSensitive: false,
    concatOperator: 'CONCAT',
    useDoubleQuoteString: false,
  };

  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map(() => '?').join(', ');

    let sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    if (returning && returning.length > 0) {
      const returnCols = returning.map((c) => this.quoteIdentifier(c)).join(', ');
      sql += ` RETURNING ${returnCols}`;
    }

    return { sql, params: values };
  }
}

/**
 * TiDB 方言 - 兼容 MySQL 协议
 */
export class TiDBDialect extends MySQLDialect {
  protected config: DialectConfig = {
    type: 'tidb',
    placeholderStyle: 'question',
    quoteStyle: 'backtick',
    paginationStyle: 'limit-offset',
    supportsReturning: false,
    supportsUpsert: true,
    supportsWindowFunctions: true,
    supportsCTE: true,
    supportsJSON: true,
    caseSensitive: false,
    concatOperator: 'CONCAT',
    useDoubleQuoteString: false,
  };

  /**
   * TiDB 特有：序列生成器
   */
  nextSequenceValue(sequenceName: string): string {
    return `NEXT VALUE FOR ${this.quoteIdentifier(sequenceName)}`;
  }
}
