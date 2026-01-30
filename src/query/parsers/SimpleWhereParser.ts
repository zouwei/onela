/**
 * SimpleWhereParser - 简单对象语法解析器
 * 将简单对象格式转换为 KeywordItem 数组
 */

import type { KeywordItem } from '../../types/onela.js';

/**
 * 简单条件值类型
 */
export type SimpleValue =
  | string
  | number
  | boolean
  | null
  | Date
  | string[]
  | number[];

/**
 * 操作符条件
 */
export interface OperatorCondition {
  $eq?: SimpleValue;
  $ne?: SimpleValue;
  $neq?: SimpleValue;
  $gt?: number | string | Date;
  $gte?: number | string | Date;
  $lt?: number | string | Date;
  $lte?: number | string | Date;
  $in?: any[];
  $nin?: any[];
  $notIn?: any[];
  $like?: string;
  $startsWith?: string;
  $endsWith?: string;
  $contains?: string;
  $between?: [any, any];
  $notBetween?: [any, any];
  $isNull?: boolean;
  $isNotNull?: boolean;
  $regexp?: string;
  $raw?: string;
}

/**
 * 简单 WHERE 条件基础接口
 * @example { id: 1, status: { $in: [1, 2] }, name: { $like: 'John' } }
 */
export interface SimpleWhereBase {
  [key: string]: SimpleValue | OperatorCondition | SimpleWhere[] | undefined;
}

/**
 * 简单 WHERE 条件（包含 $or 和 $and 支持）
 */
export interface SimpleWhere extends SimpleWhereBase {
  $or?: SimpleWhere[];
  $and?: SimpleWhere[];
}

/**
 * 解析简单 WHERE 条件为 KeywordItem 数组
 */
export function parseSimpleWhere(
  where: SimpleWhere,
  logic: 'and' | 'or' = 'and'
): KeywordItem[] {
  const result: KeywordItem[] = [];

  for (const key in where) {
    const value = where[key];

    // 处理 $or 条件组
    if (key === '$or' && Array.isArray(value)) {
      const orConditions = value as unknown as SimpleWhere[];
      for (let i = 0; i < orConditions.length; i++) {
        const subConditions = parseSimpleWhere(orConditions[i], 'and');
        // 第一个 OR 条件组使用当前逻辑，后续使用 or
        for (let j = 0; j < subConditions.length; j++) {
          if (j === 0 && i > 0) {
            subConditions[j].logic = 'or';
          }
        }
        result.push(...subConditions);
      }
      continue;
    }

    // 处理 $and 条件组
    if (key === '$and' && Array.isArray(value)) {
      const andConditions = value as unknown as SimpleWhere[];
      for (const subWhere of andConditions) {
        result.push(...parseSimpleWhere(subWhere, 'and'));
      }
      continue;
    }

    // 处理简单值（直接等于）
    if (value === null || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) {
      if (Array.isArray(value)) {
        // 数组默认使用 IN
        result.push({
          key,
          operator: 'in',
          value,
          logic,
        });
      } else if (value === null) {
        result.push({
          key,
          operator: 'is',
          value: 'NULL',
          logic,
        });
      } else {
        result.push({
          key,
          operator: '=',
          value: value instanceof Date ? value.toISOString() : value,
          logic,
        });
      }
      continue;
    }

    // 处理操作符条件
    const opCondition = value as OperatorCondition;
    for (const op in opCondition) {
      const opValue = (opCondition as any)[op];

      switch (op) {
        case '$eq':
          result.push({ key, operator: '=', value: opValue, logic });
          break;
        case '$ne':
        case '$neq':
          result.push({ key, operator: '<>', value: opValue, logic });
          break;
        case '$gt':
          result.push({ key, operator: '>', value: opValue, logic });
          break;
        case '$gte':
          result.push({ key, operator: '>=', value: opValue, logic });
          break;
        case '$lt':
          result.push({ key, operator: '<', value: opValue, logic });
          break;
        case '$lte':
          result.push({ key, operator: '<=', value: opValue, logic });
          break;
        case '$in':
          result.push({ key, operator: 'in', value: opValue, logic });
          break;
        case '$nin':
        case '$notIn':
          result.push({ key, operator: 'not in', value: opValue, logic });
          break;
        case '$like':
        case '$contains':
          result.push({ key, operator: '%%', value: opValue, logic });
          break;
        case '$startsWith':
          result.push({ key, operator: 'x%', value: opValue, logic });
          break;
        case '$endsWith':
          result.push({ key, operator: '%', value: opValue, logic });
          break;
        case '$between':
          if (Array.isArray(opValue) && opValue.length >= 2) {
            result.push({ key, operator: 'between', value: opValue, logic });
          }
          break;
        case '$notBetween':
          if (Array.isArray(opValue) && opValue.length >= 2) {
            result.push({ key, operator: 'not between', value: opValue, logic });
          }
          break;
        case '$isNull':
          if (opValue === true) {
            result.push({ key, operator: 'is', value: 'NULL', logic });
          } else if (opValue === false) {
            result.push({ key, operator: 'is not', value: 'NULL', logic });
          }
          break;
        case '$isNotNull':
          if (opValue === true) {
            result.push({ key, operator: 'is not', value: 'NULL', logic });
          }
          break;
        case '$regexp':
          result.push({ key, operator: 'regexp', value: opValue, logic });
          break;
        case '$raw':
          // Security: $raw is deprecated and disabled to prevent SQL injection.
          // Use parameterized operators instead.
          throw new Error('$raw operator is disabled for security reasons. Use parameterized operators instead.');
          break;
      }
    }
  }

  return result;
}

/**
 * 检查是否为简单 WHERE 格式
 */
export function isSimpleWhere(obj: any): obj is SimpleWhere {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  // 如果包含传统格式的键，则不是简单格式
  if ('keyword' in obj || 'where' in obj) {
    return false;
  }

  // 检查是否所有值都是有效的简单值或操作符对象
  for (const key in obj) {
    const value = obj[key];

    // $or 和 $and 是特殊键
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(value)) return false;
      continue;
    }

    // 简单值
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      Array.isArray(value)
    ) {
      continue;
    }

    // 操作符对象
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      const validOperators = [
        '$eq', '$ne', '$neq', '$gt', '$gte', '$lt', '$lte',
        '$in', '$nin', '$notIn', '$like', '$startsWith', '$endsWith',
        '$contains', '$between', '$notBetween', '$isNull', '$isNotNull',
        '$regexp', '$raw',
      ];
      if (keys.every((k) => validOperators.includes(k))) {
        continue;
      }
    }

    return false;
  }

  return true;
}
