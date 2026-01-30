/**
 * LegacyParser - 传统格式解析器
 * 保持向后兼容，严格遵循原有的 keyword/where 数组格式
 */

import type { KeywordItem, QueryParams, UpdateParams, DeleteParams } from '../../types/onela.js';

/**
 * 传统查询参数格式
 */
export interface LegacyQueryParams {
  select?: string[];
  keyword?: KeywordItem[];
  where?: KeywordItem[];
  orderBy?: Record<string, 'ASC' | 'DESC'>;
  groupBy?: string[];
  limit?: [number, number];
}

/**
 * 传统更新参数格式
 */
export interface LegacyUpdateParams extends LegacyQueryParams {
  update: Array<{
    key: string;
    value?: any;
    operator?: 'replace' | 'plus' | 'reduce';
    case_field?: string;
    case_item?: Array<{
      case_value: any;
      value: any;
      operator?: 'replace' | 'plus' | 'reduce';
    }>;
  }>;
}

/**
 * 传统删除参数格式
 */
export interface LegacyDeleteParams {
  keyword?: KeywordItem[];
  where?: KeywordItem[];
}

/**
 * 检查是否为传统格式
 */
export function isLegacyFormat(params: any): boolean {
  if (!params || typeof params !== 'object') {
    return false;
  }

  // 如果包含 keyword 或 where 数组，则为传统格式
  if (
    (Array.isArray(params.keyword) && params.keyword.length > 0) ||
    (Array.isArray(params.where) && params.where.length > 0)
  ) {
    // 检查数组元素是否为 KeywordItem 格式
    const items = params.keyword || params.where;
    if (items.length > 0) {
      const firstItem = items[0];
      return (
        firstItem &&
        typeof firstItem === 'object' &&
        'key' in firstItem &&
        ('value' in firstItem || 'operator' in firstItem)
      );
    }
  }

  return false;
}

/**
 * 验证 KeywordItem 格式
 */
export function validateKeywordItem(item: any): item is KeywordItem {
  if (!item || typeof item !== 'object') {
    return false;
  }

  if (typeof item.key !== 'string' || !item.key) {
    return false;
  }

  // 验证 operator
  const validOperators = [
    '=', '>', '<', '<>', '>=', '<=',
    'in', 'not in', '%', 'x%', '%%',
    'is', 'is not', 'like', 'not like',
    'between', 'not between', 'regexp',
  ];

  if (item.operator && !validOperators.includes(item.operator)) {
    return false;
  }

  // 验证 logic
  if (item.logic && !['and', 'or'].includes(item.logic)) {
    return false;
  }

  return true;
}

/**
 * 验证传统查询参数
 */
export function validateLegacyQueryParams(params: any): params is LegacyQueryParams {
  if (!params || typeof params !== 'object') {
    return false;
  }

  // 验证 select
  if (params.select !== undefined) {
    if (!Array.isArray(params.select)) {
      return false;
    }
    if (!params.select.every((s: any) => typeof s === 'string')) {
      return false;
    }
  }

  // 验证 keyword/where
  const conditions = params.keyword || params.where || [];
  if (!Array.isArray(conditions)) {
    return false;
  }
  if (!conditions.every(validateKeywordItem)) {
    return false;
  }

  // 验证 orderBy
  if (params.orderBy !== undefined) {
    if (typeof params.orderBy !== 'object' || Array.isArray(params.orderBy)) {
      return false;
    }
    for (const key in params.orderBy) {
      if (!['ASC', 'DESC'].includes(params.orderBy[key])) {
        return false;
      }
    }
  }

  // 验证 groupBy
  if (params.groupBy !== undefined) {
    if (!Array.isArray(params.groupBy)) {
      return false;
    }
    if (!params.groupBy.every((g: any) => typeof g === 'string')) {
      return false;
    }
  }

  // 验证 limit
  if (params.limit !== undefined) {
    if (!Array.isArray(params.limit) || params.limit.length < 2) {
      return false;
    }
    if (!params.limit.every((l: any) => typeof l === 'number' && l >= 0)) {
      return false;
    }
  }

  return true;
}

/**
 * 验证传统更新参数
 */
export function validateLegacyUpdateParams(params: any): params is LegacyUpdateParams {
  if (!validateLegacyQueryParams(params)) {
    return false;
  }

  // 使用 as any 避免 TypeScript 类型收窄导致的类型错误
  const updateParams = params as any;
  if (!Array.isArray(updateParams.update) || updateParams.update.length === 0) {
    return false;
  }

  for (const item of updateParams.update) {
    if (!item || typeof item !== 'object') {
      return false;
    }

    if (typeof item.key !== 'string' || !item.key) {
      return false;
    }

    // 验证 operator
    if (item.operator && !['replace', 'plus', 'reduce'].includes(item.operator)) {
      return false;
    }

    // CASE WHEN 验证
    if (item.case_field || item.case_item) {
      if (typeof item.case_field !== 'string') {
        return false;
      }
      if (!Array.isArray(item.case_item) || item.case_item.length === 0) {
        return false;
      }
      for (const caseItem of item.case_item) {
        if (!caseItem || typeof caseItem !== 'object') {
          return false;
        }
        if (caseItem.case_value === undefined || caseItem.value === undefined) {
          return false;
        }
        if (caseItem.operator && !['replace', 'plus', 'reduce'].includes(caseItem.operator)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * 规范化传统格式参数
 * 确保 keyword/where 的一致性
 */
export function normalizeLegacyParams<T extends LegacyQueryParams>(params: T): T {
  const normalized = { ...params };

  // 统一使用 where（如果同时存在 keyword 和 where，合并它们）
  if (normalized.keyword && normalized.where) {
    normalized.where = [...normalized.keyword, ...normalized.where];
    delete normalized.keyword;
  } else if (normalized.keyword) {
    normalized.where = normalized.keyword;
    delete normalized.keyword;
  }

  // 确保 where 是数组
  if (!normalized.where) {
    normalized.where = [];
  }

  // 为每个条件项设置默认值
  normalized.where = normalized.where.map((item) => ({
    ...item,
    logic: item.logic || 'and',
    operator: item.operator || '=',
  }));

  return normalized;
}

/**
 * 传统格式转换为标准 QueryParams
 */
export function legacyToQueryParams(
  legacy: LegacyQueryParams,
  configs: { tableName: string; engine: string }
): QueryParams {
  const normalized = normalizeLegacyParams(legacy);

  return {
    command: { tableName: configs.tableName },
    configs,
    select: normalized.select,
    where: normalized.where,
    orderBy: normalized.orderBy,
    groupBy: normalized.groupBy,
    limit: normalized.limit,
  };
}
