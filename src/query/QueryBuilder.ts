/**
 * QueryBuilder - 链式查询构建器
 * 支持链式调用、类型安全、Lambda 表达式
 */

import type { KeywordItem, QueryParams, Configs } from '../types/onela.js';
import type { ConditionSymbol } from './operators/index.js';
import { isCondition, toKeywordItem } from './operators/index.js';

/**
 * 排序方向
 */
export type OrderDirection = 'ASC' | 'DESC';

/**
 * 字段代理类型（用于 Lambda 表达式）
 */
export type FieldProxy<T> = {
  [K in keyof T]: FieldExpression<T[K]>;
};

/**
 * 字段表达式
 */
export interface FieldExpression<T> {
  /** 字段名 */
  readonly fieldName: string;

  /** 等于 */
  eq(value: T): ConditionSymbol;
  /** 不等于 */
  neq(value: T): ConditionSymbol;
  /** 大于 */
  gt(value: T): ConditionSymbol;
  /** 大于等于 */
  gte(value: T): ConditionSymbol;
  /** 小于 */
  lt(value: T): ConditionSymbol;
  /** 小于等于 */
  lte(value: T): ConditionSymbol;
  /** IN */
  in(values: T[]): ConditionSymbol;
  /** NOT IN */
  notIn(values: T[]): ConditionSymbol;
  /** BETWEEN */
  between(min: T, max: T): ConditionSymbol;
  /** LIKE (全模糊) */
  like(value: string): ConditionSymbol;
  /** 以...开始 */
  startsWith(value: string): ConditionSymbol;
  /** 以...结束 */
  endsWith(value: string): ConditionSymbol;
  /** 包含 */
  contains(value: string): ConditionSymbol;
  /** IS NULL */
  isNull(): ConditionSymbol;
  /** IS NOT NULL */
  isNotNull(): ConditionSymbol;
}

/**
 * 创建字段表达式
 */
function createFieldExpression<T>(fieldName: string): FieldExpression<T> {
  return {
    fieldName,
    eq: (value: T) => ({ __isCondition: true, key: fieldName, operator: '=', value }),
    neq: (value: T) => ({ __isCondition: true, key: fieldName, operator: '<>', value }),
    gt: (value: T) => ({ __isCondition: true, key: fieldName, operator: '>', value }),
    gte: (value: T) => ({ __isCondition: true, key: fieldName, operator: '>=', value }),
    lt: (value: T) => ({ __isCondition: true, key: fieldName, operator: '<', value }),
    lte: (value: T) => ({ __isCondition: true, key: fieldName, operator: '<=', value }),
    in: (values: T[]) => ({ __isCondition: true, key: fieldName, operator: 'in', value: values }),
    notIn: (values: T[]) => ({ __isCondition: true, key: fieldName, operator: 'not in', value: values }),
    between: (min: T, max: T) => ({ __isCondition: true, key: fieldName, operator: 'between', value: [min, max] }),
    like: (value: string) => ({ __isCondition: true, key: fieldName, operator: '%%', value }),
    startsWith: (value: string) => ({ __isCondition: true, key: fieldName, operator: 'x%', value }),
    endsWith: (value: string) => ({ __isCondition: true, key: fieldName, operator: '%', value }),
    contains: (value: string) => ({ __isCondition: true, key: fieldName, operator: '%%', value }),
    isNull: () => ({ __isCondition: true, key: fieldName, operator: 'is', value: 'NULL' }),
    isNotNull: () => ({ __isCondition: true, key: fieldName, operator: 'is not', value: 'NULL' }),
  };
}

/**
 * 创建字段代理（用于 Lambda 表达式）
 */
export function createFieldProxy<T extends object>(): FieldProxy<T> {
  return new Proxy({} as FieldProxy<T>, {
    get(_target, prop: string) {
      return createFieldExpression(prop);
    },
  });
}

/**
 * QueryBuilder 类
 * 支持链式调用构建查询
 */
export class QueryBuilder<T extends object = any> {
  private _select: string[] = [];
  private _where: KeywordItem[] = [];
  private _orderBy: Record<string, OrderDirection> = {};
  private _groupBy: string[] = [];
  private _limit?: [number, number];
  private _configs: Configs;

  constructor(configs: Configs) {
    this._configs = configs;
  }

  /**
   * 选择字段
   * @example select('id', 'name', 'email')
   * @example select(['id', 'name'])
   */
  select(...fields: (string | string[])[]): this {
    for (const field of fields) {
      if (Array.isArray(field)) {
        this._select.push(...field);
      } else {
        this._select.push(field);
      }
    }
    return this;
  }

  /**
   * Lambda 风格选择字段
   * @example selectLambda(f => [f.id, f.name])
   */
  selectLambda(selector: (fields: FieldProxy<T>) => FieldExpression<any>[]): this {
    const proxy = createFieldProxy<T>();
    const selected = selector(proxy);
    this._select.push(...selected.map((f) => f.fieldName));
    return this;
  }

  /**
   * WHERE 条件（支持多种格式）
   */
  where(conditions: KeywordItem[]): this;
  where(key: string, value: any): this;
  where(key: string, operator: string, value: any): this;
  where(condition: ConditionSymbol): this;
  where(
    keyOrConditions: string | KeywordItem[] | ConditionSymbol,
    operatorOrValue?: string | any,
    value?: any
  ): this {
    // 格式1: where(KeywordItem[])
    if (Array.isArray(keyOrConditions)) {
      this._where.push(...keyOrConditions);
      return this;
    }

    // 格式2: where(ConditionSymbol)
    if (isCondition(keyOrConditions)) {
      this._where.push(toKeywordItem(keyOrConditions));
      return this;
    }

    // 格式3: where('key', 'value') - 默认等于
    if (value === undefined) {
      this._where.push({
        key: keyOrConditions,
        operator: '=',
        value: operatorOrValue,
        logic: 'and',
      });
      return this;
    }

    // 格式4: where('key', 'operator', 'value')
    this._where.push({
      key: keyOrConditions,
      operator: operatorOrValue as any,
      value: value,
      logic: 'and',
    });
    return this;
  }

  /**
   * Lambda 风格 WHERE 条件
   * @example whereLambda(f => f.age.gte(18))
   * @example whereLambda(f => [f.status.eq(1), f.type.in([1, 2, 3])])
   */
  whereLambda(
    builder: (fields: FieldProxy<T>) => ConditionSymbol | ConditionSymbol[]
  ): this {
    const proxy = createFieldProxy<T>();
    const result = builder(proxy);

    if (Array.isArray(result)) {
      for (const condition of result) {
        this._where.push(toKeywordItem(condition));
      }
    } else {
      this._where.push(toKeywordItem(result));
    }

    return this;
  }

  /**
   * AND 条件
   */
  andWhere(key: string, value: any): this;
  andWhere(key: string, operator: string, value: any): this;
  andWhere(condition: ConditionSymbol): this;
  andWhere(
    keyOrCondition: string | ConditionSymbol,
    operatorOrValue?: string | any,
    value?: any
  ): this {
    if (isCondition(keyOrCondition)) {
      const item = toKeywordItem(keyOrCondition);
      item.logic = 'and';
      this._where.push(item);
      return this;
    }

    if (value === undefined) {
      this._where.push({
        key: keyOrCondition,
        operator: '=',
        value: operatorOrValue,
        logic: 'and',
      });
    } else {
      this._where.push({
        key: keyOrCondition,
        operator: operatorOrValue as any,
        value: value,
        logic: 'and',
      });
    }
    return this;
  }

  /**
   * OR 条件
   */
  orWhere(key: string, value: any): this;
  orWhere(key: string, operator: string, value: any): this;
  orWhere(condition: ConditionSymbol): this;
  orWhere(
    keyOrCondition: string | ConditionSymbol,
    operatorOrValue?: string | any,
    value?: any
  ): this {
    if (isCondition(keyOrCondition)) {
      const item = toKeywordItem(keyOrCondition);
      item.logic = 'or';
      this._where.push(item);
      return this;
    }

    if (value === undefined) {
      this._where.push({
        key: keyOrCondition,
        operator: '=',
        value: operatorOrValue,
        logic: 'or',
      });
    } else {
      this._where.push({
        key: keyOrCondition,
        operator: operatorOrValue as any,
        value: value,
        logic: 'or',
      });
    }
    return this;
  }

  /**
   * WHERE IN
   */
  whereIn(key: string, values: any[]): this {
    this._where.push({
      key,
      operator: 'in',
      value: values,
      logic: 'and',
    });
    return this;
  }

  /**
   * WHERE NOT IN
   */
  whereNotIn(key: string, values: any[]): this {
    this._where.push({
      key,
      operator: 'not in',
      value: values,
      logic: 'and',
    });
    return this;
  }

  /**
   * WHERE BETWEEN
   */
  whereBetween(key: string, min: any, max: any): this {
    this._where.push({
      key,
      operator: 'between',
      value: [min, max],
      logic: 'and',
    });
    return this;
  }

  /**
   * WHERE LIKE
   */
  whereLike(key: string, value: string): this {
    this._where.push({
      key,
      operator: '%%',
      value,
      logic: 'and',
    });
    return this;
  }

  /**
   * WHERE IS NULL
   */
  whereNull(key: string): this {
    this._where.push({
      key,
      operator: 'is',
      value: 'NULL',
      logic: 'and',
    });
    return this;
  }

  /**
   * WHERE IS NOT NULL
   */
  whereNotNull(key: string): this {
    this._where.push({
      key,
      operator: 'is not',
      value: 'NULL',
      logic: 'and',
    });
    return this;
  }

  /**
   * ORDER BY
   * @example orderBy('create_time', 'DESC')
   * @example orderBy({ create_time: 'DESC', id: 'ASC' })
   */
  orderBy(field: string, direction?: OrderDirection): this;
  orderBy(orders: Record<string, OrderDirection>): this;
  orderBy(
    fieldOrOrders: string | Record<string, OrderDirection>,
    direction?: OrderDirection
  ): this {
    if (typeof fieldOrOrders === 'string') {
      this._orderBy[fieldOrOrders] = direction || 'ASC';
    } else {
      Object.assign(this._orderBy, fieldOrOrders);
    }
    return this;
  }

  /**
   * ORDER BY DESC
   */
  orderByDesc(field: string): this {
    this._orderBy[field] = 'DESC';
    return this;
  }

  /**
   * ORDER BY ASC
   */
  orderByAsc(field: string): this {
    this._orderBy[field] = 'ASC';
    return this;
  }

  /**
   * GROUP BY
   */
  groupBy(...fields: string[]): this {
    this._groupBy.push(...fields);
    return this;
  }

  /**
   * LIMIT 和 OFFSET
   * @example limit(10) - 取前10条
   * @example limit(10, 20) - 跳过10条，取20条
   */
  limit(offsetOrLimit: number, limit?: number): this {
    if (limit === undefined) {
      this._limit = [0, offsetOrLimit];
    } else {
      this._limit = [offsetOrLimit, limit];
    }
    return this;
  }

  /**
   * 分页
   * @param page 页码（从1开始）
   * @param pageSize 每页数量
   */
  page(page: number, pageSize: number): this {
    const offset = (page - 1) * pageSize;
    this._limit = [offset, pageSize];
    return this;
  }

  /**
   * 构建查询参数
   */
  build(): QueryParams {
    const params: QueryParams = {
      configs: this._configs,
      command: { tableName: this._configs.tableName },
    };

    if (this._select.length > 0) {
      params.select = this._select;
    }

    if (this._where.length > 0) {
      params.where = this._where;
    }

    if (Object.keys(this._orderBy).length > 0) {
      params.orderBy = this._orderBy;
    }

    if (this._groupBy.length > 0) {
      params.groupBy = this._groupBy;
    }

    if (this._limit) {
      params.limit = this._limit;
    }

    return params;
  }

  /**
   * 克隆当前构建器
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this._configs);
    cloned._select = [...this._select];
    cloned._where = [...this._where];
    cloned._orderBy = { ...this._orderBy };
    cloned._groupBy = [...this._groupBy];
    cloned._limit = this._limit ? [...this._limit] : undefined;
    return cloned;
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this._select = [];
    this._where = [];
    this._orderBy = {};
    this._groupBy = [];
    this._limit = undefined;
    return this;
  }
}

/**
 * 创建 QueryBuilder 的工厂函数
 */
export function createQueryBuilder<T extends object = any>(
  configs: Configs
): QueryBuilder<T> {
  return new QueryBuilder<T>(configs);
}
