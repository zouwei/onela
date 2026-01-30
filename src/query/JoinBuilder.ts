/**
 * JoinBuilder - JOIN 查询构建器
 * 支持 INNER JOIN, LEFT JOIN, RIGHT JOIN, CROSS JOIN
 * 可与 QueryBuilder 配合使用
 */

import type { KeywordItem } from '../types/onela.js';

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
 * JOIN 类型
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS' | 'FULL';

/**
 * JOIN 条件
 */
export interface JoinCondition {
  /** JOIN 类型 */
  type: JoinType;
  /** 目标表名 */
  table: string;
  /** 别名 */
  alias?: string;
  /** ON 条件（列=列 形式） */
  on: JoinOnCondition[];
}

/**
 * ON 条件定义
 */
export interface JoinOnCondition {
  /** 左表列 */
  leftColumn: string;
  /** 右表列 */
  rightColumn: string;
  /** 操作符（默认 =） */
  operator?: string;
  /** 逻辑连接（默认 AND） */
  logic?: 'AND' | 'OR';
}

/**
 * JOIN 查询结果
 */
export interface JoinQueryResult {
  /** JOIN SQL 片段 */
  joinSQL: string;
  /** 完整 FROM ... JOIN 片段 */
  fromSQL: string;
  /** SELECT 字段片段（带表前缀） */
  selectSQL: string;
}

/**
 * JOIN 查询构建器
 */
export class JoinBuilder {
  private mainTable: string;
  private mainAlias?: string;
  private joins: JoinCondition[] = [];
  private selectFields: Array<{ table: string; field: string; alias?: string }> = [];

  constructor(mainTable: string, alias?: string) {
    this.mainTable = validateIdentifier(mainTable);
    this.mainAlias = alias ? validateIdentifier(alias) : undefined;
  }

  /**
   * INNER JOIN
   */
  innerJoin(table: string, on: JoinOnCondition | JoinOnCondition[], alias?: string): this {
    return this.addJoin('INNER', table, on, alias);
  }

  /**
   * LEFT JOIN
   */
  leftJoin(table: string, on: JoinOnCondition | JoinOnCondition[], alias?: string): this {
    return this.addJoin('LEFT', table, on, alias);
  }

  /**
   * RIGHT JOIN
   */
  rightJoin(table: string, on: JoinOnCondition | JoinOnCondition[], alias?: string): this {
    return this.addJoin('RIGHT', table, on, alias);
  }

  /**
   * CROSS JOIN
   */
  crossJoin(table: string, alias?: string): this {
    return this.addJoin('CROSS', table, [], alias);
  }

  /**
   * FULL OUTER JOIN
   */
  fullJoin(table: string, on: JoinOnCondition | JoinOnCondition[], alias?: string): this {
    return this.addJoin('FULL', table, on, alias);
  }

  /**
   * 快捷 JOIN：自动生成 ON 条件（主表.id = 目标表.主表_id）
   */
  join(table: string, foreignKey?: string, primaryKey?: string, type: JoinType = 'INNER'): this {
    const fk = foreignKey || `${this.mainTable}_id`;
    const pk = primaryKey || 'id';
    const mainRef = this.mainAlias || this.mainTable;

    return this.addJoin(type, table, [{
      leftColumn: `${mainRef}.${pk}`,
      rightColumn: `${table}.${fk}`,
    }]);
  }

  /**
   * 添加 SELECT 字段
   */
  select(table: string, field: string, alias?: string): this {
    this.selectFields.push({
      table: validateIdentifier(table),
      field: validateIdentifier(field),
      alias: alias ? validateIdentifier(alias) : undefined,
    });
    return this;
  }

  /**
   * 添加表的所有字段
   */
  selectAll(table: string): this {
    this.selectFields.push({ table: validateIdentifier(table), field: '*' });
    return this;
  }

  /**
   * 添加 JOIN
   */
  private addJoin(type: JoinType, table: string, on: JoinOnCondition | JoinOnCondition[], alias?: string): this {
    const conditions = Array.isArray(on) ? on : [on];
    // 校验 ON 条件中的列名
    for (const cond of conditions) {
      if (cond.leftColumn) validateIdentifier(cond.leftColumn);
      if (cond.rightColumn) validateIdentifier(cond.rightColumn);
    }
    this.joins.push({ type, table: validateIdentifier(table), alias: alias ? validateIdentifier(alias) : undefined, on: conditions });
    return this;
  }

  /**
   * 构建 JOIN SQL
   */
  build(): JoinQueryResult {
    const joinParts: string[] = [];

    for (const join of this.joins) {
      const tablePart = join.alias ? `${join.table} ${join.alias}` : join.table;

      if (join.type === 'CROSS') {
        joinParts.push(`CROSS JOIN ${tablePart}`);
        continue;
      }

      const onParts: string[] = [];
      for (let i = 0; i < join.on.length; i++) {
        const cond = join.on[i];
        const op = cond.operator || '=';
        const clause = `${cond.leftColumn} ${op} ${cond.rightColumn}`;

        if (i === 0) {
          onParts.push(clause);
        } else {
          const logic = cond.logic || 'AND';
          onParts.push(`${logic} ${clause}`);
        }
      }

      const joinType = join.type === 'FULL' ? 'FULL OUTER' : join.type;
      joinParts.push(`${joinType} JOIN ${tablePart} ON ${onParts.join(' ')}`);
    }

    const joinSQL = joinParts.join(' ');
    const mainRef = this.mainAlias
      ? `${this.mainTable} ${this.mainAlias}`
      : this.mainTable;

    // 构建 SELECT
    let selectSQL = '*';
    if (this.selectFields.length > 0) {
      selectSQL = this.selectFields
        .map((f) => {
          const col = `${f.table}.${f.field}`;
          return f.alias ? `${col} AS ${f.alias}` : col;
        })
        .join(', ');
    }

    return {
      joinSQL,
      fromSQL: `${mainRef} ${joinSQL}`,
      selectSQL,
    };
  }

  /**
   * 构建完整 SELECT SQL
   */
  buildSelectSQL(whereClause?: string, orderBy?: string, limit?: string): string {
    const result = this.build();
    let sql = `SELECT ${result.selectSQL} FROM ${result.fromSQL}`;
    if (whereClause) sql += ` WHERE ${whereClause}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;
    return sql;
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.joins = [];
    this.selectFields = [];
    return this;
  }
}

/**
 * 工厂函数
 */
export function createJoinBuilder(mainTable: string, alias?: string): JoinBuilder {
  return new JoinBuilder(mainTable, alias);
}
