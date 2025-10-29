import type { FieldConfig, KeywordItem, QueryResult, UpdateResult, DeleteResult, QueryParams, UpdateParams, UpdateFieldItem , UpdateCaseItem, UpdateCaseField } from '../interface/onelaType.js';

// /**
//  * 通用模块 - 命令行参数处理（MySQL 版）
//  * author: joey
//  * create time: 2016-06-27
//  */

// interface KeywordItem {
//   key: string;
//   value: any;
//   logic?: 'and' | 'or';
//   operator?:
//     | '='
//     | '>'
//     | '<'
//     | '<>'
//     | '>='
//     | '<='
//     | 'in'
//     | 'not in'
//     | '%'
//     | 'x%'
//     | '%%'
//     | 'is';
// }

// interface UpdateFieldItem {
//   key: string;
//   value: any;
//   operator?: 'replace' | 'plus' | 'reduce';
// }

// interface UpdateCaseItem {
//   case_value: any;
//   value: any;
//   operator?: 'replace' | 'plus' | 'reduce';
// }

// interface UpdateCaseField {
//   key: string;
//   case_field: string;
//   case_item: UpdateCaseItem[];
// }

// type UpdateItem = UpdateFieldItem | UpdateCaseField;

// interface SelectField {
//   select?: string[];
//   keyword?: KeywordItem[];
//   where?: KeywordItem[];
//   orderBy?: Record<string, 'ASC' | 'DESC'>;
//   limit?: [number, number]; // [offset, limit]
// }

// interface UpdateParameters {
//   update: UpdateItem[];
//   keyword?: KeywordItem[];
//   where?: KeywordItem[];
// }

// interface QueryResult {
//   select: string;
//   where: string;
//   orderBy: string;
//   parameters: any[];
//   limit: string;
// }

// interface UpdateResult {
//   set: string[];
//   where: string;
//   parameters: any[];
// }

// interface DeleteResult {
//   where: string;
//   parameters: any[];
// }

// const m = {} as {
//   getParameters: (paras: SelectField) => QueryResult;
//   getUpdateParameters: (paras: UpdateParameters) => UpdateResult;
//   getDeleteParameters: (paras: { keyword?: KeywordItem[]; where?: KeywordItem[] }) => DeleteResult;
// };

/**
 * 获取查询参数（SELECT）
 * @param paras 原始参数
 * @returns QueryResult
 */
const getParameters = function (paras: QueryParams): QueryResult {
  var _self: QueryResult = {
    select: '',
    where: ' where 1=1 ',
    orderBy: '',
    parameters: [],
    limit: '',
  };
_self.parameters = [];

  // === SELECT 字段 ===
  if (paras.select && Array.isArray(paras.select)) {
    _self.select = paras.select.length === 0 ? 't.*' : paras.select.join(',');
  } else {
    _self.select = 't.*';
  }

  // === ORDER BY ===
  if (paras.orderBy && typeof paras.orderBy === 'object') {
    const parts: string[] = [];
    for (const field in paras.orderBy) {
      const dir = paras.orderBy[field];
      if (dir === 'ASC' || dir === 'DESC') {
        parts.push(`${field} ${dir}`);
      }
    }
    if (parts.length > 0) {
      _self.orderBy = ' order by ' + parts.join(', ');
    }
  }

  // === WHERE 条件 ===
  const keywords: KeywordItem[] = paras.keyword || paras.where || [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    const logic = item.logic || 'and';
    const key = item.key;
    const operator = item.operator || '=';

    _self.where += ` ${logic} ${key} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        _self.where += `${operator}?`;
        _self.parameters.push(item.value);
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders = item.value.map(() => '?').join(', ');
          _self.where += `${operator} (${placeholders})`;
          _self.parameters.push(...item.value);
        } else {
          _self.where += `${operator} ()`;
        }
        break;

      case '%': // 左模糊
        _self.where += 'like ?';
        _self.parameters.push(`%${item.value}`);
        break;

      case 'x%': // 右模糊
        _self.where += 'like ?';
        _self.parameters.push(`${item.value}%`);
        break;

      case '%%': // 全模糊
        _self.where += 'like ?';
        _self.parameters.push(`%${item.value}%`);
        break;

      case 'is':
        _self.where += `is ${item.value}`;
        break;

      default:
        _self.where += '=?';
        _self.parameters.push(item.value);
        break;
    }
  }

  // === LIMIT ===
  if (paras.limit && paras.limit.length > 1) {
    _self.limit = ' limit ?,?';
    _self.parameters.push(paras.limit[0], paras.limit[1]); // offset, limit
  }

  return _self;
};

/**
 * 获取更新参数（UPDATE）
 * @param paras 原始参数
 * @returns UpdateResult
 */
const getUpdateParameters = function (paras: UpdateParams): UpdateResult {
  const _self: UpdateResult = {
    set: [],
    where: '',
    parameters: [],
  };

  // === SET 字段处理 ===
  for (const updateItem of paras.update || []) {
    if (!updateItem || ('value' in updateItem && updateItem.value === '')) continue;

    // CASE WHEN 更新
    if ('case_field' in updateItem && 'case_item' in updateItem) {
      const { key, case_field, case_item } = updateItem as UpdateCaseField;
      if (!Array.isArray(case_item) || case_item.length === 0) continue;

      const caseParts: string[] = [`${key}= (CASE ${case_field}`];

      for (const cw of case_item) {
        const op = cw.operator || 'replace';

        switch (op) {
          case 'replace':
            caseParts.push('WHEN ? THEN ?');
            _self.parameters.push(cw.case_value, cw.value);
            break;
          case 'plus':
            caseParts.push(`WHEN ? THEN ${key} + ?`);
            _self.parameters.push(cw.case_value, cw.value);
            break;
          case 'reduce':
            caseParts.push(`WHEN ? THEN ${key} - ?`);
            _self.parameters.push(cw.case_value, cw.value);
            break;
          default:
            caseParts.push('WHEN ? THEN ?');
            _self.parameters.push(cw.case_value, cw.value);
            break;
        }
      }

      caseParts.push('END)');
      _self.set.push(caseParts.join(' '));
    }
    // 普通字段更新
    else {
      const item = updateItem as UpdateFieldItem;
      const op = item.operator || 'replace';

      switch (op) {
        case 'replace':
          _self.set.push(`${item.key}=?`);
          _self.parameters.push(item.value);
          break;
        case 'plus':
          _self.set.push(`${item.key}=${item.key} + ?`);
          _self.parameters.push(item.value);
          break;
        case 'reduce':
          _self.set.push(`${item.key}=${item.key} - ?`);
          _self.parameters.push(item.value);
          break;
        default:
          _self.set.push(`${item.key}=?`);
          _self.parameters.push(item.value);
          break;
      }
    }
  }

  // === WHERE 条件处理 ===
  const keywords: KeywordItem[] = paras.keyword || paras.where || [];
  const whereParts: string[] = [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    const logic = item.logic || 'and';
    const key = item.key;
    const operator = item.operator || '=';

    let sql = ` ${logic} ${key} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        sql += `${operator}?`;
        _self.parameters.push(item.value);
        break;

      case '%':
        sql += 'like ?';
        _self.parameters.push(`%${item.value}`);
        break;
      case 'x%':
        sql += 'like ?';
        _self.parameters.push(`${item.value}%`);
        break;
      case '%%':
        sql += 'like ?';
        _self.parameters.push(`%${item.value}%`);
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders = item.value.map(() => '?').join(', ');
          sql += `${operator} (${placeholders})`;
          _self.parameters.push(...item.value);
        } else {
          sql += `${operator} ()`;
        }
        break;

      default:
        sql += '=?';
        _self.parameters.push(item.value);
        break;
    }

    whereParts.push(sql);
  }

  _self.where = ' 1=1 ' + whereParts.join('');

  return _self;
};

/**
 * 获取删除参数（DELETE）
 * @param paras 原始参数
 * @returns DeleteResult
 */
const getDeleteParameters = function (paras: { keyword?: KeywordItem[]; where?: KeywordItem[] }): DeleteResult {
  const _self: DeleteResult = {
    where: '',
    parameters: [],
  };

  const keywords: KeywordItem[] = paras.keyword || paras.where || [];
  const whereParts: string[] = [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    const logic = item.logic || 'and';
    const key = item.key;
    const operator = item.operator || '=';

    let sql = ` ${logic} ${key} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        sql += `${operator}?`;
        _self.parameters.push(item.value);
        break;

      case '%':
        sql += 'like ?';
        _self.parameters.push(`%${item.value}`);
        break;
      case 'x%':
        sql += 'like ?';
        _self.parameters.push(`${item.value}%`);
        break;
      case '%%':
        sql += 'like ?';
        _self.parameters.push(`%${item.value}%`);
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders = item.value.map(() => '?').join(', ');
          sql += `${operator} (${placeholders})`;
          _self.parameters.push(...item.value);
        } else {
          sql += `${operator} ()`;
        }
        break;

      default:
        sql += '=?';
        _self.parameters.push(item.value);
        break;
    }

    whereParts.push(sql);
  }

  _self.where = ' 1=1 ' + whereParts.join('');

  return _self;
};

export { getParameters, getUpdateParameters, getDeleteParameters };