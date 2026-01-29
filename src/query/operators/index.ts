/**
 * 查询操作符函数
 * 提供类型安全的条件构建
 */

import type { KeywordItem } from '../../types/onela.js';

/**
 * 条件符号类型
 */
export type ConditionSymbol = {
  __isCondition: true;
  key?: string;
  operator: string;
  value: any;
  logic?: 'and' | 'or';
};

/**
 * 创建条件的基础函数
 */
function createCondition(
  operator: string,
  value: any,
  key?: string
): ConditionSymbol {
  return {
    __isCondition: true,
    key,
    operator,
    value,
  };
}

// ==================== 比较操作符 ====================

/**
 * 等于
 * @example eq('name', 'John') 或 field.eq('John')
 */
export function eq(keyOrValue: string, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('=', keyOrValue);
  }
  return createCondition('=', value, keyOrValue);
}

/**
 * 不等于
 */
export function neq(keyOrValue: string, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('<>', keyOrValue);
  }
  return createCondition('<>', value, keyOrValue);
}

/**
 * 大于
 */
export function gt(keyOrValue: string | number, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('>', keyOrValue);
  }
  return createCondition('>', value, keyOrValue as string);
}

/**
 * 大于等于
 */
export function gte(keyOrValue: string | number, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('>=', keyOrValue);
  }
  return createCondition('>=', value, keyOrValue as string);
}

/**
 * 小于
 */
export function lt(keyOrValue: string | number, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('<', keyOrValue);
  }
  return createCondition('<', value, keyOrValue as string);
}

/**
 * 小于等于
 */
export function lte(keyOrValue: string | number, value?: any): ConditionSymbol {
  if (value === undefined) {
    return createCondition('<=', keyOrValue);
  }
  return createCondition('<=', value, keyOrValue as string);
}

// ==================== 范围操作符 ====================

/**
 * IN 操作符
 * @example inArray('status', [1, 2, 3])
 */
export function inArray(keyOrValues: string | any[], values?: any[]): ConditionSymbol {
  if (values === undefined) {
    return createCondition('in', keyOrValues);
  }
  return createCondition('in', values, keyOrValues as string);
}

/**
 * NOT IN 操作符
 */
export function notInArray(keyOrValues: string | any[], values?: any[]): ConditionSymbol {
  if (values === undefined) {
    return createCondition('not in', keyOrValues);
  }
  return createCondition('not in', values, keyOrValues as string);
}

/**
 * BETWEEN 操作符
 * @example between('age', 18, 30)
 */
export function between(
  keyOrMin: string | number,
  minOrMax?: number,
  max?: number
): ConditionSymbol {
  if (max === undefined) {
    return createCondition('between', [keyOrMin, minOrMax]);
  }
  return createCondition('between', [minOrMax, max], keyOrMin as string);
}

/**
 * NOT BETWEEN 操作符
 */
export function notBetween(
  keyOrMin: string | number,
  minOrMax?: number,
  max?: number
): ConditionSymbol {
  if (max === undefined) {
    return createCondition('not between', [keyOrMin, minOrMax]);
  }
  return createCondition('not between', [minOrMax, max], keyOrMin as string);
}

// ==================== 模糊匹配操作符 ====================

/**
 * LIKE 操作符（全模糊）
 * @example like('name', 'John') => name LIKE '%John%'
 */
export function like(keyOrValue: string, value?: string): ConditionSymbol {
  if (value === undefined) {
    return createCondition('%%', keyOrValue);
  }
  return createCondition('%%', value, keyOrValue);
}

/**
 * 左模糊匹配
 * @example startsWith('name', 'John') => name LIKE 'John%'
 */
export function startsWith(keyOrValue: string, value?: string): ConditionSymbol {
  if (value === undefined) {
    return createCondition('x%', keyOrValue);
  }
  return createCondition('x%', value, keyOrValue);
}

/**
 * 右模糊匹配
 * @example endsWith('name', 'son') => name LIKE '%son'
 */
export function endsWith(keyOrValue: string, value?: string): ConditionSymbol {
  if (value === undefined) {
    return createCondition('%', keyOrValue);
  }
  return createCondition('%', value, keyOrValue);
}

/**
 * 包含
 * @example contains('name', 'oh') => name LIKE '%oh%'
 */
export function contains(keyOrValue: string, value?: string): ConditionSymbol {
  return like(keyOrValue, value);
}

/**
 * NOT LIKE 操作符
 */
export function notLike(keyOrValue: string, value?: string): ConditionSymbol {
  if (value === undefined) {
    return createCondition('not like', `%${keyOrValue}%`);
  }
  return createCondition('not like', `%${value}%`, keyOrValue);
}

// ==================== NULL 操作符 ====================

/**
 * IS NULL
 */
export function isNull(key?: string): ConditionSymbol {
  return createCondition('is', 'NULL', key);
}

/**
 * IS NOT NULL
 */
export function isNotNull(key?: string): ConditionSymbol {
  return createCondition('is not', 'NULL', key);
}

// ==================== 逻辑操作符 ====================

/**
 * AND 组合
 * @example and(eq('a', 1), gt('b', 2))
 */
export function and(...conditions: ConditionSymbol[]): ConditionSymbol[] {
  return conditions.map((c) => ({ ...c, logic: 'and' as const }));
}

/**
 * OR 组合
 * @example or(eq('status', 1), eq('status', 2))
 */
export function or(...conditions: ConditionSymbol[]): ConditionSymbol[] {
  return conditions.map((c, i) => ({
    ...c,
    logic: i === 0 ? ('and' as const) : ('or' as const),
  }));
}

// ==================== 原始 SQL ====================

/**
 * 原始 SQL 表达式
 * @example raw('YEAR(create_time) = 2024')
 */
export function raw(sql: string): ConditionSymbol {
  return {
    __isCondition: true,
    operator: 'raw',
    value: sql,
  };
}

// ==================== 工具函数 ====================

/**
 * 判断是否为条件对象
 */
export function isCondition(obj: any): obj is ConditionSymbol {
  return obj && obj.__isCondition === true;
}

/**
 * 将条件符号转换为 KeywordItem
 */
export function toKeywordItem(
  condition: ConditionSymbol,
  key?: string
): KeywordItem {
  const actualKey = condition.key || key;
  if (!actualKey && condition.operator !== 'raw') {
    throw new Error('Condition must have a key');
  }

  return {
    key: actualKey!,
    operator: condition.operator as any,
    value: condition.value,
    logic: condition.logic,
  };
}

/**
 * 将条件数组转换为 KeywordItem 数组
 */
export function toKeywordItems(
  conditions: Array<ConditionSymbol | ConditionSymbol[]>
): KeywordItem[] {
  const result: KeywordItem[] = [];

  for (const condition of conditions) {
    if (Array.isArray(condition)) {
      // 处理 and() 或 or() 返回的数组
      for (const c of condition) {
        result.push(toKeywordItem(c));
      }
    } else {
      result.push(toKeywordItem(condition));
    }
  }

  return result;
}

/**
 * 导出操作符对象（便于解构导入）
 */
export const Op = {
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  in: inArray,
  notIn: notInArray,
  between,
  notBetween,
  like,
  startsWith,
  endsWith,
  contains,
  notLike,
  isNull,
  isNotNull,
  and,
  or,
  raw,
};
