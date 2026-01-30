/**
 * BaseDialect - SQL 方言基类
 * 提供通用实现，子类只需覆盖差异部分
 */

import type { IDialect, DialectConfig } from './IDialect.js';

export abstract class BaseDialect implements IDialect {
  protected abstract config: DialectConfig;

  getConfig(): DialectConfig {
    return this.config;
  }

  getType(): string {
    return this.config.type;
  }

  abstract placeholder(index: number, name?: string): string;

  quoteIdentifier(identifier: string): string {
    // 处理 schema.table 或 table.column 格式
    if (identifier.includes('.')) {
      return identifier
        .split('.')
        .map((part) => this.quoteIdentifierPart(part))
        .join('.');
    }
    return this.quoteIdentifierPart(identifier);
  }

  protected quoteIdentifierPart(identifier: string): string {
    // 如果已经被引用，直接返回
    if (this.isQuoted(identifier)) {
      return identifier;
    }

    // 特殊值不引用
    if (identifier === '*' || identifier.includes('(')) {
      return identifier;
    }

    switch (this.config.quoteStyle) {
      case 'backtick':
        return `\`${identifier.replace(/`/g, '``')}\``;
      case 'double':
        return `"${identifier.replace(/"/g, '""')}"`;
      case 'bracket':
        return `[${identifier.replace(/\]/g, ']]')}]`;
      default:
        return identifier;
    }
  }

  protected isQuoted(identifier: string): boolean {
    return (
      (identifier.startsWith('`') && identifier.endsWith('`')) ||
      (identifier.startsWith('"') && identifier.endsWith('"')) ||
      (identifier.startsWith('[') && identifier.endsWith(']'))
    );
  }

  buildPagination(
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    switch (this.config.paginationStyle) {
      case 'limit-offset':
        return {
          sql: ` LIMIT ${this.placeholder(currentIndex + 1)} OFFSET ${this.placeholder(currentIndex + 2)}`,
          params: [limit, offset],
          newIndex: currentIndex + 2,
        };
      case 'offset-fetch':
        return {
          sql: ` OFFSET ${this.placeholder(currentIndex + 1)} ROWS FETCH NEXT ${this.placeholder(currentIndex + 2)} ROWS ONLY`,
          params: [offset, limit],
          newIndex: currentIndex + 2,
        };
      case 'top':
        // TOP 需要在 SELECT 之后，这里返回空，需要特殊处理
        return {
          sql: '',
          params: [],
          newIndex: currentIndex,
        };
      case 'rownum':
        return {
          sql: '',
          params: [],
          newIndex: currentIndex,
        };
      default:
        return {
          sql: ` LIMIT ${this.placeholder(currentIndex + 1)} OFFSET ${this.placeholder(currentIndex + 2)}`,
          params: [limit, offset],
          newIndex: currentIndex + 2,
        };
    }
  }

  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values
      .map((_, i) => this.placeholder(i + 1))
      .join(', ');

    let sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    if (returning && returning.length > 0 && this.config.supportsReturning) {
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
        return this.placeholder(paramIndex);
      });
      valueClauses.push(`(${placeholders.join(', ')})`);
      allParams.push(...values);
    }

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES ${valueClauses.join(', ')}`;

    return { sql, params: allParams };
  }

  buildUpdate(
    table: string,
    setClauses: string[],
    whereClause: string,
    params: any[]
  ): { sql: string; params: any[] } {
    const sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClauses.join(', ')} WHERE ${whereClause}`;
    return { sql, params };
  }

  buildDelete(
    table: string,
    whereClause: string,
    params: any[]
  ): { sql: string; params: any[] } {
    const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${whereClause}`;
    return { sql, params };
  }

  castValue(value: any, type: string): string {
    return `CAST(${value} AS ${type})`;
  }

  getCurrentTimestamp(): string {
    return 'CURRENT_TIMESTAMP';
  }

  getCurrentDate(): string {
    return 'CURRENT_DATE';
  }

  concat(...expressions: string[]): string {
    if (this.config.concatOperator === 'CONCAT') {
      return `CONCAT(${expressions.join(', ')})`;
    }
    return expressions.join(` ${this.config.concatOperator} `);
  }

  coalesce(...expressions: string[]): string {
    return `COALESCE(${expressions.join(', ')})`;
  }

  caseWhen(
    field: string,
    cases: Array<{ when: any; then: any }>,
    elseValue?: any
  ): string {
    const caseParts = cases.map((c) => `WHEN ${c.when} THEN ${c.then}`);
    let sql = `CASE ${field} ${caseParts.join(' ')}`;
    if (elseValue !== undefined) {
      sql += ` ELSE ${elseValue}`;
    }
    sql += ' END';
    return sql;
  }

  escapeLike(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  booleanValue(value: boolean): string | number {
    return value ? 1 : 0;
  }

  formatDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
