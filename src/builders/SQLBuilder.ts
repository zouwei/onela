/**
 * SQLBuilder - 统一 SQL 构建器
 * 使用方言系统生成不同数据库的 SQL
 */

import type { IDialect } from '../dialect/IDialect.js';
import { DialectFactory } from '../dialect/DialectFactory.js';
import type {
  KeywordItem,
  QueryParams,
  UpdateParams,
  UpdateFieldItem,
  UpdateCaseField,
  AggregateItem,
} from '../types/onela.js';

/**
 * 构建后的 SQL 结果
 */
export interface BuiltSQL {
  sql: string;
  params: any[];
}

/**
 * 查询构建结果
 */
export interface QueryBuiltSQL extends BuiltSQL {
  select: string;
  where: string;
  orderBy: string;
  groupBy: string;
  limit: string;
}

/**
 * 更新构建结果
 */
export interface UpdateBuiltSQL extends BuiltSQL {
  set: string[];
  where: string;
}

/**
 * 删除构建结果
 */
export interface DeleteBuiltSQL extends BuiltSQL {
  where: string;
}

/**
 * SQL 构建器
 */
export class SQLBuilder {
  private dialect: IDialect;
  private paramIndex: number = 0;

  constructor(dialectType: string) {
    this.dialect = DialectFactory.create(dialectType);
  }

  /**
   * 重置参数索引
   */
  resetParamIndex(): void {
    this.paramIndex = 0;
  }

  /**
   * 获取下一个参数占位符
   */
  private nextPlaceholder(name?: string): string {
    this.paramIndex++;
    return this.dialect.placeholder(this.paramIndex, name);
  }

  /**
   * 构建 SELECT 查询
   */
  buildSelect(params: QueryParams): QueryBuiltSQL {
    this.resetParamIndex();
    const result: QueryBuiltSQL = {
      sql: '',
      params: [],
      select: '',
      where: '',
      orderBy: '',
      groupBy: '',
      limit: '',
    };

    // === SELECT 字段 ===
    if (params.select && Array.isArray(params.select) && params.select.length > 0) {
      result.select = params.select.join(', ');
    } else {
      result.select = 't.*';
    }

    // === WHERE 条件 ===
    const whereResult = this.buildWhereClause(params.keyword || params.where || []);
    result.where = whereResult.sql || '1=1';
    result.params.push(...whereResult.params);

    // === GROUP BY ===
    if (params.groupBy && Array.isArray(params.groupBy) && params.groupBy.length > 0) {
      result.groupBy = ` GROUP BY ${params.groupBy.join(', ')}`;
    }

    // === ORDER BY ===
    if (params.orderBy && typeof params.orderBy === 'object') {
      const parts: string[] = [];
      for (const field in params.orderBy) {
        const dir = params.orderBy[field];
        if (dir === 'ASC' || dir === 'DESC') {
          parts.push(`${field} ${dir}`);
        }
      }
      if (parts.length > 0) {
        result.orderBy = ` ORDER BY ${parts.join(', ')}`;
      }
    }

    // === LIMIT / PAGINATION ===
    if (params.limit && params.limit.length >= 2) {
      const [offset, limit] = params.limit;
      const paginationResult = this.dialect.buildPagination(offset, limit, this.paramIndex);
      result.limit = paginationResult.sql;
      result.params.push(...paginationResult.params);
      this.paramIndex = paginationResult.newIndex;
    }

    // 组装完整 SQL
    result.sql = `SELECT ${result.select} FROM ${params.configs.tableName} AS t WHERE ${result.where}${result.groupBy}${result.orderBy}${result.limit}`;

    return result;
  }

  /**
   * 构建 WHERE 子句
   */
  buildWhereClause(conditions: KeywordItem[]): BuiltSQL {
    const parts: string[] = [];
    const params: any[] = [];

    for (const item of conditions) {
      if (!item || item.value === '' || item.value === undefined || item.value === null) {
        continue;
      }

      const logic = (item.logic || 'and').toUpperCase();
      const key = item.key;
      const operator = item.operator || '=';

      let sql = '';

      switch (operator) {
        case '=':
        case '>':
        case '<':
        case '<>':
        case '>=':
        case '<=':
          if (item.format) {
            // 直接使用值（用于函数调用等）
            sql = `${key} ${operator} ${item.value}`;
          } else {
            sql = `${key} ${operator} ${this.nextPlaceholder()}`;
            params.push(item.value);
          }
          break;

        case 'in':
        case 'not in':
          if (Array.isArray(item.value) && item.value.length > 0) {
            const placeholders = item.value.map(() => this.nextPlaceholder()).join(', ');
            sql = `${key} ${operator.toUpperCase()} (${placeholders})`;
            params.push(...item.value);
          } else {
            sql = `${key} ${operator.toUpperCase()} (NULL)`; // 空数组处理
          }
          break;

        case '%': // 左模糊 LIKE '%value'
          sql = `${key} LIKE ${this.nextPlaceholder()}`;
          params.push(`%${item.value}`);
          break;

        case 'x%': // 右模糊 LIKE 'value%'
          sql = `${key} LIKE ${this.nextPlaceholder()}`;
          params.push(`${item.value}%`);
          break;

        case '%%': // 全模糊 LIKE '%value%'
          sql = `${key} LIKE ${this.nextPlaceholder()}`;
          params.push(`%${item.value}%`);
          break;

        case 'is':
          sql = `${key} IS ${item.value}`;
          break;

        case 'is not':
          sql = `${key} IS NOT ${item.value}`;
          break;

        case 'between':
          if (Array.isArray(item.value) && item.value.length >= 2) {
            sql = `${key} BETWEEN ${this.nextPlaceholder()} AND ${this.nextPlaceholder()}`;
            params.push(item.value[0], item.value[1]);
          }
          break;

        case 'not between':
          if (Array.isArray(item.value) && item.value.length >= 2) {
            sql = `${key} NOT BETWEEN ${this.nextPlaceholder()} AND ${this.nextPlaceholder()}`;
            params.push(item.value[0], item.value[1]);
          }
          break;

        case 'like':
          sql = `${key} LIKE ${this.nextPlaceholder()}`;
          params.push(item.value);
          break;

        case 'not like':
          sql = `${key} NOT LIKE ${this.nextPlaceholder()}`;
          params.push(item.value);
          break;

        case 'regexp':
        case '~':
          // 正则匹配（PostgreSQL）
          sql = `${key} ~ ${this.nextPlaceholder()}`;
          params.push(item.value);
          break;

        default:
          sql = `${key} = ${this.nextPlaceholder()}`;
          params.push(item.value);
          break;
      }

      if (sql) {
        if (parts.length > 0) {
          parts.push(`${logic} ${sql}`);
        } else {
          parts.push(sql);
        }
      }
    }

    return {
      sql: parts.length > 0 ? parts.join(' ') : '1=1',
      params,
    };
  }

  /**
   * 构建 UPDATE 语句
   */
  buildUpdate(params: UpdateParams): UpdateBuiltSQL {
    this.resetParamIndex();
    const result: UpdateBuiltSQL = {
      sql: '',
      params: [],
      set: [],
      where: '',
    };

    // === SET 子句 ===
    for (const updateItem of params.update || []) {
      if (!updateItem) continue;

      // CASE WHEN 更新
      if ('case_field' in updateItem && 'case_item' in updateItem) {
        const caseField = updateItem as UpdateCaseField;
        if (!Array.isArray(caseField.case_item) || caseField.case_item.length === 0) {
          continue;
        }

        const caseParts: string[] = [`${caseField.key} = (CASE ${caseField.case_field}`];

        for (const caseItem of caseField.case_item) {
          const op = caseItem.operator || 'replace';
          const whenPlaceholder = this.nextPlaceholder();
          const thenPlaceholder = this.nextPlaceholder();

          switch (op) {
            case 'replace':
              caseParts.push(`WHEN ${whenPlaceholder} THEN ${thenPlaceholder}`);
              break;
            case 'plus':
              caseParts.push(`WHEN ${whenPlaceholder} THEN ${caseField.key} + ${thenPlaceholder}`);
              break;
            case 'reduce':
              caseParts.push(`WHEN ${whenPlaceholder} THEN ${caseField.key} - ${thenPlaceholder}`);
              break;
            default:
              caseParts.push(`WHEN ${whenPlaceholder} THEN ${thenPlaceholder}`);
              break;
          }
          result.params.push(caseItem.case_value, caseItem.value);
        }

        caseParts.push(`ELSE ${caseField.key} END)`);
        result.set.push(caseParts.join(' '));
      }
      // 普通字段更新
      else {
        const item = updateItem as UpdateFieldItem;
        if (item.value === '' || item.value === undefined) continue;

        const op = item.operator || 'replace';
        const placeholder = this.nextPlaceholder();

        switch (op) {
          case 'replace':
            result.set.push(`${item.key} = ${placeholder}`);
            break;
          case 'plus':
            result.set.push(`${item.key} = ${item.key} + ${placeholder}`);
            break;
          case 'reduce':
            result.set.push(`${item.key} = ${item.key} - ${placeholder}`);
            break;
          default:
            result.set.push(`${item.key} = ${placeholder}`);
            break;
        }
        result.params.push(item.value);
      }
    }

    // === WHERE 子句 ===
    const whereResult = this.buildWhereClause(params.keyword || params.where || []);
    result.where = whereResult.sql;
    result.params.push(...whereResult.params);

    // 组装完整 SQL
    result.sql = `UPDATE ${params.configs.tableName} SET ${result.set.join(', ')} WHERE ${result.where}`;

    return result;
  }

  /**
   * 构建 DELETE 语句
   */
  buildDelete(params: { keyword?: KeywordItem[]; where?: KeywordItem[]; configs: { tableName: string } }): DeleteBuiltSQL {
    this.resetParamIndex();
    const result: DeleteBuiltSQL = {
      sql: '',
      params: [],
      where: '',
    };

    const whereResult = this.buildWhereClause(params.keyword || params.where || []);
    result.where = whereResult.sql;
    result.params = whereResult.params;

    result.sql = `DELETE FROM ${params.configs.tableName} WHERE ${result.where}`;

    return result;
  }

  /**
   * 构建 INSERT 语句
   */
  buildInsert(
    tableName: string,
    data: Record<string, any>,
    returning?: string[]
  ): BuiltSQL {
    this.resetParamIndex();
    const columns: string[] = [];
    const values: any[] = [];

    for (const key in data) {
      columns.push(key);
      values.push(data[key]);
    }

    return this.dialect.buildInsert(tableName, columns, values, returning);
  }

  /**
   * 构建批量 INSERT 语句
   */
  buildBatchInsert(
    tableName: string,
    dataList: Record<string, any>[]
  ): BuiltSQL {
    this.resetParamIndex();
    if (dataList.length === 0) {
      throw new Error('Cannot build batch insert with empty data list');
    }

    const columns = Object.keys(dataList[0]);
    const valuesList = dataList.map((data) => columns.map((col) => data[col]));

    return this.dialect.buildBatchInsert(tableName, columns, valuesList);
  }

  /**
   * 构建聚合查询
   */
  buildAggregate(
    params: QueryParams & { aggregate: AggregateItem[] }
  ): BuiltSQL {
    this.resetParamIndex();
    const aggregateFunctions: Record<string, string> = {
      count: 'COUNT',
      sum: 'SUM',
      max: 'MAX',
      min: 'MIN',
      avg: 'AVG',
      abs: 'ABS',
    };

    const selectParts: string[] = [];
    for (const agg of params.aggregate) {
      const fn = aggregateFunctions[agg.function.toLowerCase()];
      if (fn) {
        selectParts.push(`${fn}(${agg.field}) AS ${agg.name}`);
      }
    }

    const whereResult = this.buildWhereClause(params.keyword || params.where || []);

    let groupBy = '';
    if (params.groupBy && params.groupBy.length > 0) {
      groupBy = ` GROUP BY ${params.groupBy.join(', ')}`;
    }

    const sql = `SELECT ${selectParts.join(', ')} FROM ${params.configs.tableName} WHERE ${whereResult.sql}${groupBy}`;

    return {
      sql,
      params: whereResult.params,
    };
  }

  /**
   * 构建 COUNT 查询
   */
  buildCount(params: QueryParams): BuiltSQL {
    this.resetParamIndex();
    const whereResult = this.buildWhereClause(params.keyword || params.where || []);

    const sql = `SELECT COUNT(*) AS total FROM ${params.configs.tableName} WHERE ${whereResult.sql}`;

    return {
      sql,
      params: whereResult.params,
    };
  }

  /**
   * 获取方言实例
   */
  getDialect(): IDialect {
    return this.dialect;
  }

  /**
   * 获取当前参数索引
   */
  getCurrentParamIndex(): number {
    return this.paramIndex;
  }
}

/**
 * 创建 SQL 构建器的工厂函数
 */
export function createSQLBuilder(dialectType: string): SQLBuilder {
  return new SQLBuilder(dialectType);
}
