/**
 * OracleDialect - Oracle 方言实现
 * 支持：Oracle 11g, 12c, 18c, 19c, 21c
 */

import { BaseDialect } from './BaseDialect.js';
import type { DialectConfig } from './IDialect.js';

export class OracleDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'oracle',
    placeholderStyle: 'colon',
    quoteStyle: 'double',
    paginationStyle: 'offset-fetch', // Oracle 12c+
    supportsReturning: true, // RETURNING INTO
    supportsUpsert: true, // MERGE
    supportsWindowFunctions: true,
    supportsCTE: true, // Oracle 9i+
    supportsJSON: true, // Oracle 12c+
    caseSensitive: true, // 默认大写
    concatOperator: '||',
    useDoubleQuoteString: false,
  };

  private oracleVersion: number = 12; // 默认 12c+

  /**
   * 设置 Oracle 版本（影响分页语法）
   */
  setVersion(version: number): void {
    this.oracleVersion = version;
    if (version < 12) {
      this.config.paginationStyle = 'rownum';
    }
  }

  placeholder(index: number, name?: string): string {
    if (name) {
      return `:${name}`;
    }
    return `:${index}`;
  }

  buildPagination(
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    if (this.oracleVersion >= 12) {
      // Oracle 12c+ 使用 OFFSET...FETCH
      return {
        sql: ` OFFSET :${currentIndex + 1} ROWS FETCH NEXT :${currentIndex + 2} ROWS ONLY`,
        params: [offset, limit],
        newIndex: currentIndex + 2,
      };
    } else {
      // Oracle 11g 及以下使用 ROWNUM（需要包装子查询）
      // 这里返回空，实际在构建完整 SQL 时处理
      return {
        sql: '',
        params: [offset + limit, offset],
        newIndex: currentIndex + 2,
      };
    }
  }

  /**
   * 构建 Oracle 11g 兼容的分页查询
   */
  wrapPaginationQuery(
    innerSql: string,
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    if (this.oracleVersion >= 12) {
      return {
        sql: innerSql,
        params: [],
        newIndex: currentIndex,
      };
    }

    // Oracle 11g ROWNUM 分页
    const sql = `
      SELECT * FROM (
        SELECT a.*, ROWNUM rnum FROM (
          ${innerSql}
        ) a WHERE ROWNUM <= :${currentIndex + 1}
      ) WHERE rnum > :${currentIndex + 2}
    `.trim();

    return {
      sql,
      params: [offset + limit, offset],
      newIndex: currentIndex + 2,
    };
  }

  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map((_, i) => `:${i + 1}`).join(', ');

    let sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    if (returning && returning.length > 0) {
      const returnCols = returning.map((c) => this.quoteIdentifier(c)).join(', ');
      const outVars = returning.map((_, i) => `:out${i + 1}`).join(', ');
      sql += ` RETURNING ${returnCols} INTO ${outVars}`;
    }

    return { sql, params: values };
  }

  buildBatchInsert(
    table: string,
    columns: string[],
    valuesList: any[][]
  ): { sql: string; params: any[] } {
    // Oracle 使用 INSERT ALL
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const allParams: any[] = [];
    const insertClauses: string[] = [];
    let paramIndex = 0;

    for (const values of valuesList) {
      const placeholders = values.map(() => {
        paramIndex++;
        return `:${paramIndex}`;
      });
      insertClauses.push(
        `INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders.join(', ')})`
      );
      allParams.push(...values);
    }

    const sql = `INSERT ALL ${insertClauses.join(' ')} SELECT 1 FROM DUAL`;

    return { sql, params: allParams };
  }

  buildUpsert(
    table: string,
    columns: string[],
    values: any[],
    conflictColumns: string[],
    updateColumns: string[]
  ): { sql: string; params: any[] } {
    // Oracle 使用 MERGE 语句
    const onConditions = conflictColumns
      .map((c) => `target.${this.quoteIdentifier(c)} = source.${this.quoteIdentifier(c)}`)
      .join(' AND ');

    const updateParts = updateColumns
      .map((c) => `target.${this.quoteIdentifier(c)} = source.${this.quoteIdentifier(c)}`)
      .join(', ');

    const insertCols = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const insertVals = columns.map((c) => `source.${this.quoteIdentifier(c)}`).join(', ');

    const sourceColumns = columns
      .map((c, i) => `:${i + 1} AS ${this.quoteIdentifier(c)}`)
      .join(', ');

    const sql = `
      MERGE INTO ${this.quoteIdentifier(table)} target
      USING (SELECT ${sourceColumns} FROM DUAL) source
      ON (${onConditions})
      WHEN MATCHED THEN UPDATE SET ${updateParts}
      WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals})
    `.trim();

    return { sql, params: values };
  }

  getCurrentTimestamp(): string {
    return 'SYSTIMESTAMP';
  }

  getCurrentDate(): string {
    return 'SYSDATE';
  }

  booleanValue(value: boolean): number {
    return value ? 1 : 0;
  }

  getLastInsertId(): string {
    // Oracle 需要使用序列或 RETURNING INTO
    return '';
  }

  /**
   * 序列下一个值
   */
  nextSequenceValue(sequenceName: string): string {
    return `${this.quoteIdentifier(sequenceName)}.NEXTVAL`;
  }

  /**
   * 序列当前值
   */
  currentSequenceValue(sequenceName: string): string {
    return `${this.quoteIdentifier(sequenceName)}.CURRVAL`;
  }

  /**
   * JSON 提取表达式 (Oracle 12c+)
   */
  jsonExtract(column: string, path: string): string {
    return `JSON_VALUE(${this.quoteIdentifier(column)}, '$.${path}')`;
  }

  /**
   * JSON 查询（返回对象/数组）
   */
  jsonQuery(column: string, path: string): string {
    return `JSON_QUERY(${this.quoteIdentifier(column)}, '$.${path}')`;
  }

  /**
   * 字符串函数
   */
  substring(column: string, start: number, length?: number): string {
    if (length !== undefined) {
      return `SUBSTR(${this.quoteIdentifier(column)}, ${start}, ${length})`;
    }
    return `SUBSTR(${this.quoteIdentifier(column)}, ${start})`;
  }

  /**
   * NVL 函数（Oracle 特有，类似 COALESCE）
   */
  nvl(column: string, defaultValue: string): string {
    return `NVL(${this.quoteIdentifier(column)}, ${defaultValue})`;
  }

  /**
   * NVL2 函数
   */
  nvl2(column: string, ifNotNull: string, ifNull: string): string {
    return `NVL2(${this.quoteIdentifier(column)}, ${ifNotNull}, ${ifNull})`;
  }

  /**
   * DECODE 函数（Oracle 特有）
   */
  decode(column: string, ...pairs: string[]): string {
    return `DECODE(${this.quoteIdentifier(column)}, ${pairs.join(', ')})`;
  }

  /**
   * TO_DATE 函数
   */
  toDate(value: string, format: string = 'YYYY-MM-DD HH24:MI:SS'): string {
    return `TO_DATE(${value}, '${format}')`;
  }

  /**
   * TO_CHAR 函数
   */
  toChar(column: string, format?: string): string {
    if (format) {
      return `TO_CHAR(${this.quoteIdentifier(column)}, '${format}')`;
    }
    return `TO_CHAR(${this.quoteIdentifier(column)})`;
  }

  /**
   * ROWID 伪列
   */
  getRowId(): string {
    return 'ROWID';
  }

  /**
   * 日期格式化
   */
  formatDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `TO_DATE('${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}', 'YYYY-MM-DD HH24:MI:SS')`;
  }
}
