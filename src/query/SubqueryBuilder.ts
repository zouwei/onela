/**
 * SubqueryBuilder - 子查询构建器
 * 支持 WHERE IN (SELECT ...), EXISTS, 标量子查询等
 */

/**
 * 子查询类型
 */
export type SubqueryType = 'in' | 'not_in' | 'exists' | 'not_exists' | 'scalar' | 'from';

/**
 * 子查询定义
 */
export interface SubqueryDefinition {
  /** 子查询类型 */
  type: SubqueryType;
  /** 子查询 SQL */
  sql: string;
  /** 子查询参数 */
  params: any[];
  /** 关联字段（用于 IN/NOT IN） */
  field?: string;
  /** 别名（用于 FROM 子查询） */
  alias?: string;
}

/**
 * 校验标识符，防止 SQL 注入
 */
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_*][a-zA-Z0-9_.*]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}

/**
 * 子查询构建器
 */
export class SubqueryBuilder {
  private table: string;
  private selectFields: string[] = ['*'];
  private whereClauses: string[] = [];
  private params: any[] = [];
  private _orderBy?: string;
  private _limit?: number;
  private _offset?: number;
  private _groupBy?: string;

  constructor(table: string) {
    this.table = validateIdentifier(table);
  }

  /**
   * 设置查询字段
   */
  select(...fields: string[]): this {
    // SELECT 字段允许 SQL 表达式（如 COUNT(*)、SUM(amount) AS total），
    // 但禁止危险字符（分号、注释、引号）
    for (const f of fields) {
      if (/[;'"\\]|--/.test(f)) {
        throw new Error(`Unsafe SQL expression in select: "${f}"`);
      }
    }
    this.selectFields = fields;
    return this;
  }

  /**
   * 添加 WHERE 条件
   */
  where(clause: string, ...values: any[]): this {
    this.whereClauses.push(clause);
    this.params.push(...values);
    return this;
  }

  /**
   * ORDER BY
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this._orderBy = `${validateIdentifier(field)} ${direction}`;
    return this;
  }

  /**
   * LIMIT
   */
  limit(count: number): this {
    this._limit = count;
    return this;
  }

  /**
   * OFFSET
   */
  offset(count: number): this {
    this._offset = count;
    return this;
  }

  /**
   * GROUP BY
   */
  groupBy(field: string): this {
    this._groupBy = validateIdentifier(field);
    return this;
  }

  /**
   * 构建子查询 SQL
   */
  buildSQL(): { sql: string; params: any[] } {
    const parts: string[] = [];
    parts.push(`SELECT ${this.selectFields.join(', ')}`);
    parts.push(`FROM ${this.table}`);

    if (this.whereClauses.length > 0) {
      parts.push(`WHERE ${this.whereClauses.join(' AND ')}`);
    }

    if (this._groupBy) {
      parts.push(`GROUP BY ${this._groupBy}`);
    }

    if (this._orderBy) {
      parts.push(`ORDER BY ${this._orderBy}`);
    }

    if (this._limit !== undefined) {
      parts.push(`LIMIT ${this._limit}`);
      if (this._offset !== undefined) {
        parts.push(`OFFSET ${this._offset}`);
      }
    }

    return {
      sql: parts.join(' '),
      params: [...this.params],
    };
  }

  /**
   * 生成 WHERE field IN (SELECT ...) 子句
   */
  toInClause(field: string): SubqueryDefinition {
    const safeField = validateIdentifier(field);
    const { sql, params } = this.buildSQL();
    return {
      type: 'in',
      sql: `${safeField} IN (${sql})`,
      params,
      field: safeField,
    };
  }

  /**
   * 生成 WHERE field NOT IN (SELECT ...) 子句
   */
  toNotInClause(field: string): SubqueryDefinition {
    const safeField = validateIdentifier(field);
    const { sql, params } = this.buildSQL();
    return {
      type: 'not_in',
      sql: `${safeField} NOT IN (${sql})`,
      params,
      field: safeField,
    };
  }

  /**
   * 生成 EXISTS (SELECT ...) 子句
   */
  toExistsClause(): SubqueryDefinition {
    const { sql, params } = this.buildSQL();
    return {
      type: 'exists',
      sql: `EXISTS (${sql})`,
      params,
    };
  }

  /**
   * 生成 NOT EXISTS (SELECT ...) 子句
   */
  toNotExistsClause(): SubqueryDefinition {
    const { sql, params } = this.buildSQL();
    return {
      type: 'not_exists',
      sql: `NOT EXISTS (${sql})`,
      params,
    };
  }

  /**
   * 作为标量子查询使用（用于 SELECT 中）
   */
  toScalar(alias: string): SubqueryDefinition {
    const safeAlias = validateIdentifier(alias);
    const { sql, params } = this.buildSQL();
    return {
      type: 'scalar',
      sql: `(${sql}) AS ${safeAlias}`,
      params,
      alias: safeAlias,
    };
  }

  /**
   * 作为 FROM 子查询使用
   */
  toFromClause(alias: string): SubqueryDefinition {
    const safeAlias = validateIdentifier(alias);
    const { sql, params } = this.buildSQL();
    return {
      type: 'from',
      sql: `(${sql}) AS ${safeAlias}`,
      params,
      alias: safeAlias,
    };
  }

  /**
   * 重置
   */
  reset(): this {
    this.selectFields = ['*'];
    this.whereClauses = [];
    this.params = [];
    this._orderBy = undefined;
    this._limit = undefined;
    this._offset = undefined;
    this._groupBy = undefined;
    return this;
  }
}

/**
 * 工厂函数
 */
export function createSubqueryBuilder(table: string): SubqueryBuilder {
  return new SubqueryBuilder(table);
}

/**
 * 快捷函数：构建 IN 子查询
 */
export function subqueryIn(
  field: string,
  table: string,
  selectField: string,
  whereClause?: string,
  ...params: any[]
): SubqueryDefinition {
  const builder = new SubqueryBuilder(table).select(selectField);
  if (whereClause) {
    builder.where(whereClause, ...params);
  }
  return builder.toInClause(field);
}

/**
 * 快捷函数：构建 EXISTS 子查询
 */
export function subqueryExists(
  table: string,
  whereClause: string,
  ...params: any[]
): SubqueryDefinition {
  const builder = new SubqueryBuilder(table).select('1').where(whereClause, ...params);
  return builder.toExistsClause();
}
