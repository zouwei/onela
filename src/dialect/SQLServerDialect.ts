/**
 * SQLServerDialect - SQL Server 方言实现
 * 支持：SQL Server 2012+, 2016+, 2017+, 2019+, Azure SQL
 */

import { BaseDialect } from './BaseDialect.js';
import type { DialectConfig } from './IDialect.js';

export class SQLServerDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'sqlserver',
    placeholderStyle: 'at',
    quoteStyle: 'bracket',
    paginationStyle: 'offset-fetch',
    supportsReturning: true, // OUTPUT 子句
    supportsUpsert: true, // MERGE
    supportsWindowFunctions: true,
    supportsCTE: true,
    supportsJSON: true, // SQL Server 2016+
    caseSensitive: false, // 取决于排序规则
    concatOperator: 'CONCAT',
    useDoubleQuoteString: false,
  };

  private paramIndex = 0;

  placeholder(index: number, name?: string): string {
    if (name) {
      return `@${name}`;
    }
    return `@p${index}`;
  }

  buildPagination(
    offset: number,
    limit: number,
    currentIndex: number
  ): { sql: string; params: any[]; newIndex: number } {
    // SQL Server 2012+ 使用 OFFSET...FETCH
    // 注意：必须有 ORDER BY 子句
    const offsetIdx = currentIndex + 1;
    const limitIdx = currentIndex + 2;
    return {
      sql: ` OFFSET @p${offsetIdx} ROWS FETCH NEXT @p${limitIdx} ROWS ONLY`,
      params: [offset, limit],
      newIndex: limitIdx,
    };
  }

  /**
   * 构建带 TOP 的查询（用于不需要分页的场景）
   */
  buildTop(limit: number, currentIndex: number): { sql: string; params: any[]; newIndex: number } {
    return {
      sql: `TOP (@p${currentIndex + 1})`,
      params: [limit],
      newIndex: currentIndex + 1,
    };
  }

  buildInsert(
    table: string,
    columns: string[],
    values: any[],
    returning?: string[]
  ): { sql: string; params: any[] } {
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = values.map((_, i) => `@p${i + 1}`).join(', ');

    let sql: string;
    if (returning && returning.length > 0) {
      const returnCols = returning.map((c) => `INSERTED.${this.quoteIdentifier(c)}`).join(', ');
      sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) OUTPUT ${returnCols} VALUES (${placeholders})`;
    } else {
      sql = `INSERT INTO ${this.quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;
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
        return `@p${paramIndex}`;
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
    // SQL Server 使用 MERGE 语句
    const quotedColumns = columns.map((c) => this.quoteIdentifier(c)).join(', ');

    // 构建 ON 条件
    const onConditions = conflictColumns
      .map((c) => `target.${this.quoteIdentifier(c)} = source.${this.quoteIdentifier(c)}`)
      .join(' AND ');

    // 构建 UPDATE SET
    const updateParts = updateColumns
      .map((c) => `target.${this.quoteIdentifier(c)} = source.${this.quoteIdentifier(c)}`)
      .join(', ');

    // 构建 INSERT 列和值
    const insertCols = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const insertVals = columns.map((c) => `source.${this.quoteIdentifier(c)}`).join(', ');

    // 构建源数据
    const sourceValues = columns
      .map((c, i) => `@p${i + 1} AS ${this.quoteIdentifier(c)}`)
      .join(', ');

    const sql = `
      MERGE INTO ${this.quoteIdentifier(table)} AS target
      USING (SELECT ${sourceValues}) AS source
      ON ${onConditions}
      WHEN MATCHED THEN UPDATE SET ${updateParts}
      WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});
    `.trim();

    return { sql, params: values };
  }

  getCurrentTimestamp(): string {
    return 'GETDATE()';
  }

  getCurrentDate(): string {
    return 'CAST(GETDATE() AS DATE)';
  }

  booleanValue(value: boolean): number {
    return value ? 1 : 0;
  }

  getLastInsertId(): string {
    return 'SELECT SCOPE_IDENTITY() AS id';
  }

  /**
   * JSON 提取表达式
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
   * JSON 修改
   */
  jsonModify(column: string, path: string, value: string): string {
    return `JSON_MODIFY(${this.quoteIdentifier(column)}, '$.${path}', ${value})`;
  }

  /**
   * 字符串函数
   */
  substring(column: string, start: number, length: number): string {
    return `SUBSTRING(${this.quoteIdentifier(column)}, ${start}, ${length})`;
  }

  /**
   * 日期部分提取
   */
  datePart(part: string, column: string): string {
    return `DATEPART(${part}, ${this.quoteIdentifier(column)})`;
  }

  /**
   * 日期加减
   */
  dateAdd(part: string, number: number, column: string): string {
    return `DATEADD(${part}, ${number}, ${this.quoteIdentifier(column)})`;
  }

  /**
   * 类型转换
   */
  castValue(value: any, type: string): string {
    return `CAST(${value} AS ${type})`;
  }

  /**
   * ISNULL 函数（SQL Server 特有）
   */
  isNull(column: string, defaultValue: string): string {
    return `ISNULL(${this.quoteIdentifier(column)}, ${defaultValue})`;
  }
}
