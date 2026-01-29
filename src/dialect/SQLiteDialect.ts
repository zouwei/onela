/**
 * SQLiteDialect - SQLite 方言实现
 * 支持：SQLite 3.x
 */

import { BaseDialect } from './BaseDialect.js';
import type { DialectConfig } from './IDialect.js';

export class SQLiteDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'sqlite',
    placeholderStyle: 'question',
    quoteStyle: 'double',
    paginationStyle: 'limit-offset',
    supportsReturning: true, // SQLite 3.35+
    supportsUpsert: true, // ON CONFLICT
    supportsWindowFunctions: true, // SQLite 3.25+
    supportsCTE: true, // SQLite 3.8.3+
    supportsJSON: true, // SQLite 3.9+
    caseSensitive: false,
    concatOperator: '||',
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
    return {
      sql: ' LIMIT ? OFFSET ?',
      params: [limit, offset],
      newIndex: currentIndex,
    };
  }

  buildUpsert(
    table: string,
    columns: string[],
    values: any[],
    conflictColumns: string[],
    updateColumns: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map(() => '?').join(', ');
    const conflictCols = conflictColumns.map((c) => this.quoteIdentifier(c)).join(', ');

    const updateParts = updateColumns.map(
      (col) => `${this.quoteIdentifier(col)} = excluded.${this.quoteIdentifier(col)}`
    );

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateParts.join(', ')}`;

    return { sql, params: values };
  }

  getCurrentTimestamp(): string {
    return "datetime('now')";
  }

  getCurrentDate(): string {
    return "date('now')";
  }

  booleanValue(value: boolean): number {
    return value ? 1 : 0;
  }

  getLastInsertId(): string {
    return 'SELECT last_insert_rowid() AS id';
  }

  /**
   * JSON 提取表达式
   */
  jsonExtract(column: string, path: string): string {
    return `json_extract(${this.quoteIdentifier(column)}, '$.${path}')`;
  }

  /**
   * JSON 设置表达式
   */
  jsonSet(column: string, path: string, value: string): string {
    return `json_set(${this.quoteIdentifier(column)}, '$.${path}', ${value})`;
  }

  /**
   * 字符串函数
   */
  substring(column: string, start: number, length?: number): string {
    if (length !== undefined) {
      return `substr(${this.quoteIdentifier(column)}, ${start}, ${length})`;
    }
    return `substr(${this.quoteIdentifier(column)}, ${start})`;
  }

  /**
   * 日期格式化
   */
  dateFormat(column: string, format: string): string {
    return `strftime('${format}', ${this.quoteIdentifier(column)})`;
  }

  /**
   * GLOB 模式匹配（SQLite 特有）
   */
  glob(column: string, pattern: string): string {
    return `${this.quoteIdentifier(column)} GLOB ${pattern}`;
  }
}
