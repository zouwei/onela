/**
 * PostgreSQLDialect - PostgreSQL 方言实现
 * 支持：PostgreSQL 10+, 11+, 12+, 13+, 14+, 15+
 */

import { BaseDialect } from './BaseDialect.js';
import type { DialectConfig } from './IDialect.js';

export class PostgreSQLDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'postgresql',
    placeholderStyle: 'dollar',
    quoteStyle: 'double',
    paginationStyle: 'limit-offset',
    supportsReturning: true,
    supportsUpsert: true, // ON CONFLICT
    supportsWindowFunctions: true,
    supportsCTE: true,
    supportsJSON: true, // JSONB
    caseSensitive: true,
    concatOperator: '||',
    useDoubleQuoteString: false,
  };

  private paramIndex = 0;

  placeholder(index: number, _name?: string): string {
    return `$${index}`;
  }

  buildPagination(
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    const limitIdx = currentIndex + 1;
    const offsetIdx = currentIndex + 2;
    return {
      sql: ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params: [limit, offset],
      newIndex: offsetIdx,
    };
  }

  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    let sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    if (returning && returning.length > 0) {
      const returnCols = returning.map((c) => this.quoteIdentifier(c)).join(', ');
      sql += ` RETURNING ${returnCols}`;
    }

    return { sql, params: values };
  }

  buildBatchInsert(
    table: string,
    columns: string[],
    valuesList: any[][]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const allParams: any[] = [];
    const valueClauses: string[] = [];
    let paramIndex = 0;

    for (const values of valuesList) {
      const placeholders = values.map(() => {
        paramIndex++;
        return `$${paramIndex}`;
      });
      valueClauses.push(`(${placeholders.join(', ')})`);
      allParams.push(...values);
    }

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES ${valueClauses.join(', ')}`;

    return { sql, params: allParams };
  }

  buildUpsert(
    table: string,
    columns: string[],
    values: any[],
    conflictColumns: string[],
    updateColumns: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const conflictCols = conflictColumns.map((c) => this.quoteIdentifier(c)).join(', ');

    const updateParts = updateColumns.map(
      (col) => `${this.quoteIdentifier(col)} = EXCLUDED.${this.quoteIdentifier(col)}`
    );

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateParts.join(', ')}`;

    return { sql, params: values };
  }

  getCurrentTimestamp(): string {
    return 'NOW()';
  }

  getCurrentDate(): string {
    return 'CURRENT_DATE';
  }

  booleanValue(value: boolean): string {
    return value ? 'TRUE' : 'FALSE';
  }

  getLastInsertId(): string {
    // PostgreSQL 需要使用 RETURNING 子句
    return '';
  }

  /**
   * JSONB 提取表达式
   */
  jsonExtract(column: string, path: string): string {
    // 支持嵌套路径 'a.b.c' -> 'a'->'b'->>'c'
    const parts = path.split('.');
    if (parts.length === 1) {
      return `${this.quoteIdentifier(column)}->>'${path}'`;
    }
    const pathParts = parts.slice(0, -1).map((p) => `'${p}'`).join('->');
    const lastPart = parts[parts.length - 1];
    return `${this.quoteIdentifier(column)}->${pathParts}->>'${lastPart}'`;
  }

  /**
   * JSONB 设置表达式
   */
  jsonSet(column: string, path: string, value: string): string {
    return `jsonb_set(${this.quoteIdentifier(column)}, '{${path.replace(/\./g, ',')}}', ${value})`;
  }

  /**
   * 数组包含检查
   */
  arrayContains(column: string, value: string): string {
    return `${value} = ANY(${this.quoteIdentifier(column)})`;
  }

  /**
   * 数组重叠检查
   */
  arrayOverlaps(column: string, values: string): string {
    return `${this.quoteIdentifier(column)} && ${values}`;
  }

  /**
   * 全文搜索
   */
  fullTextSearch(column: string, query: string, config: string = 'english'): string {
    return `to_tsvector('${config}', ${this.quoteIdentifier(column)}) @@ plainto_tsquery('${config}', ${query})`;
  }

  /**
   * 类型转换
   */
  castValue(value: any, type: string): string {
    return `${value}::${type}`;
  }

  /**
   * 正则匹配
   */
  regexMatch(column: string, pattern: string, caseInsensitive: boolean = false): string {
    const op = caseInsensitive ? '~*' : '~';
    return `${this.quoteIdentifier(column)} ${op} ${pattern}`;
  }
}
