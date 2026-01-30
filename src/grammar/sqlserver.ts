import type { KeywordItem, QueryResult, UpdateResult, DeleteResult, QueryParams, UpdateParams, UpdateFieldItem , UpdateCaseItem, UpdateCaseField , DeleteParams} from '../types/onela.js';

/**
 * 校验标识符（列名），防止 SQL 注入
 */
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_*][a-zA-Z0-9_.*]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`);
  }
  return name;
}

/**
 * SQL Server - 命令行参数处理
 * author: joey
 * create time: 2018-05-17
 */

const TYPES: Record<string, string> = {
  NULL: 'Null',
  TINYINT: 'TinyInt',
  BIT: 'Bit',
  SMALLINT: 'SmallInt',
  INT: 'Int',
  SMALLDATETIME: 'SmallDateTime',
  REAL: 'Real',
  MONEY: 'Money',
  DATETIME: 'DateTime',
  FLOAT: 'Float',
  DECIMAL: 'Decimal',
  NUMERIC: 'Numeric',
  SMALLMONEY: 'SmallMoney',
  BIGINT: 'BigInt',
  IMAGE: 'Image',
  TEXT: 'Text',
  UNIQUEIDENTIFIER: 'UniqueIdentifier',
  INTN: 'IntN',
  NTEXT: 'NText',
  BITN: 'BitN',
  DECIMALN: 'DecimalN',
  NUMERICN: 'NumericN',
  FLOATN: 'FloatN',
  MONEYN: 'MoneyN',
  DATETIMEN: 'DateTimeN',
  VARBINARY: 'VarBinary',
  VARCHAR: 'VarChar',
  BINARY: 'Binary',
  CHAR: 'Char',
  NVARCHAR: 'NVarChar',
  NCHAR: 'NChar',
  XML: 'Xml',
  TIME: 'Time',
  DATE: 'Date',
  DATETIME2: 'DateTime2',
  DATETIMEOFFSET: 'DateTimeOffset',
  UDT: 'UDT',
  TVP: 'TVP',
  VARIANT: 'Variant',
};

// interface FieldConfig {
//   name: string;
//   type: string;
// }

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
//   sqlType?: string;
// }

// interface UpdateFieldItem {
//   key: string;
//   value: any;
//   operator?: 'replace' | 'plus' | 'reduce';
//   sqlType?: string;
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
//   sqlType?: string;
// }

// type UpdateItem = UpdateFieldItem | UpdateCaseField;

// interface SelectField {
//   select?: string[];
//   keyword?: KeywordItem[];
//   where?: KeywordItem[];
//   orderBy?: Record<string, 'ASC' | 'DESC'>;
//   limit?: [number, number] | [number]; // [offset, limit] or [limit]
//   configs: { fields: FieldConfig[] };
// }

// interface UpdateParameters {
//   update: UpdateItem[];
//   keyword?: KeywordItem[];
//   where?: KeywordItem[];
//   configs: { fields: FieldConfig[] };
//   limit?: [number, number] | [number];
// }

// interface QueryResult {
//   select: string;
//   where: string;
//   orderBy: string;
//   parameters: Array<{ name: string; sqlType: string; value: any }>;
//   limit: string;
// }

// interface UpdateResult {
//   set: string[];
//   where: string;
//   parameters: Array<{ name: string; sqlType: string; value: any }>;
//   limit: string;
// }

// interface DeleteResult {
//   where: string;
//   parameters: Array<{ name: string; sqlType: string; value: any }>;
// }

// const m = {} as {
//   sqlTypeHandle: (sqlType?: string) => string;
//   getParameters: (paras: SelectField) => QueryResult;
//   getUpdateParameters: (paras: UpdateParameters) => UpdateResult;
//   getDeleteParameters: (paras: { keyword?: KeywordItem[]; where?: KeywordItem[]; configs: { fields: FieldConfig[] } }) => DeleteResult;
// };

/**
 * 参数类型处理
 * @param sqlType SQL字段类型
 */
const sqlTypeHandle = (sqlType?: string): string => {
  if (sqlType && sqlType !== '') {
    const upper = sqlType.toUpperCase();
    return TYPES[upper] || 'NVarChar';
  }
  return 'NVarChar';
};

/**
 * 获取查询参数（SELECT + 分页）
 */
const getParameters = function (paras: QueryParams): QueryResult {
  let index = 0;
  var _self: QueryResult = {
    select: '',
    where: ' where 1=1 ',
    orderBy: '',
    parameters: [],
    // limit: [],
  };
  _self.parameters = [];
  _self.limit = [];

  // === SELECT ===
  if (paras.select && Array.isArray(paras.select)) {
    _self.select = paras.select.length === 0 ? 't.*' : paras.select.map(f => validateIdentifier(f)).join(',');
  } else {
    _self.select = 't.*';
  }

  // === ORDER BY ===
  if (paras.orderBy && typeof paras.orderBy === 'object') {
    const parts: string[] = [];
    for (const field in paras.orderBy) {
      validateIdentifier(field);
      const dir = paras.orderBy[field];
      if (dir === 'ASC' || dir === 'DESC') {
        parts.push(`${field} ${dir}`);
      }
    }
    if (parts.length > 0) {
      _self.orderBy = ' order by ' + parts.join(', ');
    }
  }

  // === WHERE + 参数化 ===
  const keywords: KeywordItem[] = paras.keyword || paras.where || [];

  // 处理参数
  const fields = paras.configs?.fields || [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    // 查找字段类型
    const field = fields.find(f => f.name === item.key);
    item.sqlType = field ? TYPES[field.type.toUpperCase()] || '' : '';

    const logic = item.logic || 'and';
    const operator = item.operator || '=';
    index++;

    const safeKey = validateIdentifier(item.key);
    _self.where += ` ${logic} ${safeKey} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        _self.where += `${operator}@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders: string[] = [];
          for (let i = 0; i < item.value.length; i++) {
            placeholders.push(`@${safeKey}${index}`);
            _self.parameters.push({
              name: `${safeKey}${index}`,
              sqlType: sqlTypeHandle(item.sqlType),
              value: item.value[i],
            });
            index++;
          }
          _self.where += `${operator} (${placeholders.join(', ')})`;
        } else {
          _self.where += `${operator} ()`;
        }
        break;

      case '%':
        _self.where += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}`,
        });
        break;

      case 'x%':
        _self.where += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `${item.value}%`,
        });
        break;

      case '%%':
        _self.where += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}%`,
        });
        break;

      case 'is':
        if (item.value !== null && !(typeof item.value === 'string' && item.value.toUpperCase() === 'NULL')) {
          throw new Error('IS operator only supports NULL value');
        }
        _self.where += 'is NULL';
        break;

      default:
        _self.where += `=@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;
    }
  }

  // === OFFSET FETCH NEXT 分页 ===
  if (paras.limit && paras.limit.length > 0) {
    const offset = paras.limit.length > 1 ? paras.limit[0] : 0;
    const limit = paras.limit.length > 1 ? paras.limit[1] : paras.limit[0];
    
    _self.limit = ` OFFSET @onelaPageIndex ROWS FETCH NEXT @onelaPageSize ROWS ONLY`;
    _self.parameters.push(
      { name: 'onelaPageIndex', sqlType: 'Int', value: offset },
      { name: 'onelaPageSize', sqlType: 'Int', value: limit }
    );
  }

  return _self;
};

/**
 * 获取更新参数（UPDATE + CASE WHEN）
 */
const getUpdateParameters = function (paras: UpdateParams): UpdateResult {
  let index = 0;
  var _self: UpdateResult = {
    set: [],
    where: '',
    parameters: [],
    // limit: '',
  };
  _self.limit = [];

  const fields = paras.configs?.fields || [];

  // === SET 字段处理 ===
  for (const updateItem of paras.update || []) {
    if (!updateItem || ('value' in updateItem && updateItem.value === '')) continue;

    // 查找字段类型
    const field = fields.find(f => f.name === updateItem.key);
    updateItem.sqlType = field ? TYPES[field.type.toUpperCase()] || '' : '';

    if ('case_field' in updateItem && 'case_item' in updateItem) {
      const { key, case_field, case_item } = updateItem as UpdateCaseField;
      validateIdentifier(key);
      validateIdentifier(case_field);
      if (!Array.isArray(case_item) || case_item.length === 0) continue;

      const caseParts: string[] = [`${key}= (CASE ${case_field}`];

      for (const cw of case_item) {
        const op = cw.operator || 'replace';

        switch (op) {
          case 'replace':
            caseParts.push(`WHEN @${key}${index}_case THEN @${key}${index}_val`);
            break;
          case 'plus':
            caseParts.push(`WHEN @${key}${index}_case THEN ${key} + @${key}${index}_val`);
            break;
          case 'reduce':
            caseParts.push(`WHEN @${key}${index}_case THEN ${key} - @${key}${index}_val`);
            break;
          default:
            caseParts.push(`WHEN @${key}${index}_case THEN @${key}${index}_val`);
            break;
        }

        _self.parameters.push(
          { name: `${key}${index}_case`, sqlType: 'NVarChar', value: cw.case_value },
          { name: `${key}${index}_val`, sqlType: sqlTypeHandle(updateItem.sqlType), value: cw.value }
        );
        index++;
      }

      caseParts.push('END)');
      _self.set.push(caseParts.join(' '));
    } else {
      const item = updateItem as UpdateFieldItem;
      const safeKey = validateIdentifier(item.key);
      const op = item.operator || 'replace';

      switch (op) {
        case 'replace':
          _self.set.push(`${safeKey}=@${safeKey}${index}`);
          _self.parameters.push({
            name: `${safeKey}${index}`,
            sqlType: sqlTypeHandle(item.sqlType),
            value: item.value,
          });
          break;
        case 'plus':
          _self.set.push(`${safeKey}=${safeKey} + @${safeKey}${index}`);
          _self.parameters.push({
            name: `${safeKey}${index}`,
            sqlType: sqlTypeHandle(item.sqlType),
            value: item.value,
          });
          break;
        case 'reduce':
          _self.set.push(`${safeKey}=${safeKey} - @${safeKey}${index}`);
          _self.parameters.push({
            name: `${safeKey}${index}`,
            sqlType: sqlTypeHandle(item.sqlType),
            value: item.value,
          });
          break;
        default:
          _self.set.push(`${safeKey}=@${safeKey}${index}`);
          _self.parameters.push({
            name: `${safeKey}${index}`,
            sqlType: sqlTypeHandle(item.sqlType),
            value: item.value,
          });
          break;
      }
      index++;
    }
  }

  // === WHERE 条件处理（复用查询逻辑）===
  const keywords: KeywordItem[] = paras.keyword || paras.where || [];
  const whereParts: string[] = [];

//   const fields = paras.configs?.fields || [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    const field = fields.find(f => f.name === item.key);
    item.sqlType = field ? TYPES[field.type.toUpperCase()] || '' : '';

    const logic = item.logic || 'and';
    const operator = item.operator || '=';
    index++;

    const safeKey = validateIdentifier(item.key);
    let sql = ` ${logic} ${safeKey} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        sql += `${operator}@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders: string[] = [];
          for (let i = 0; i < item.value.length; i++) {
            placeholders.push(`@${safeKey}${index}`);
            _self.parameters.push({
              name: `${safeKey}${index}`,
              sqlType: sqlTypeHandle(item.sqlType),
              value: item.value[i],
            });
            index++;
          }
          sql += `${operator} (${placeholders.join(', ')})`;
        } else {
          sql += `${operator} ()`;
        }
        break;

      case '%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}`,
        });
        break;
      case 'x%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `${item.value}%`,
        });
        break;
      case '%%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}%`,
        });
        break;

      default:
        sql += `=@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;
    }

    whereParts.push(sql);
  }

  _self.where = ' 1=1 ' + whereParts.join('');

  // === 分页（UPDATE 不需要，但保留兼容）===
  if (paras.limit && paras.limit.length > 0) {
    const offset = paras.limit.length > 1 ? paras.limit[0] : 0;
    const limit = paras.limit.length > 1 ? paras.limit[1] : paras.limit[0];

    _self.limit = ` offset @onelaPageIndex rows fetch next @onelaPageSize rows only`;
    _self.parameters.push(
      { name: 'onelaPageIndex', sqlType: 'Int', value: offset },
      { name: 'onelaPageSize', sqlType: 'Int', value: limit }
    );
  }

  return _self;
};

/**
 * 获取删除参数（DELETE）
 */
const getDeleteParameters = function (paras: DeleteParams): DeleteResult {
  let index = 0;
  const _self: DeleteResult = {
    where: '',
    parameters: [],
  };

  const keywords: KeywordItem[] = paras.keyword || paras.where || [];
  const whereParts: string[] = [];

  const fields = paras.configs?.fields || [];

  for (const item of keywords) {
    if (!item || item.value === '' || item.value === undefined || item.value === null) continue;

    const field = fields.find(f => f.name === item.key);
    item.sqlType = field ? TYPES[field.type.toUpperCase()] || '' : '';

    const logic = item.logic || 'and';
    const operator = item.operator || '=';
    index++;

    const safeKey = validateIdentifier(item.key);
    let sql = ` ${logic} ${safeKey} `;

    switch (operator) {
      case '=':
      case '>':
      case '<':
      case '<>':
      case '>=':
      case '<=':
        sql += `${operator}@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;

      case 'in':
      case 'not in':
        if (Array.isArray(item.value) && item.value.length > 0) {
          const placeholders: string[] = [];
          for (let i = 0; i < item.value.length; i++) {
            placeholders.push(`@${safeKey}${index}`);
            _self.parameters.push({
              name: `${safeKey}${index}`,
              sqlType: sqlTypeHandle(item.sqlType),
              value: item.value[i],
            });
            index++;
          }
          sql += `${operator} (${placeholders.join(', ')})`;
        } else {
          sql += `${operator} ()`;
        }
        break;

      case '%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}`,
        });
        break;
      case 'x%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `${item.value}%`,
        });
        break;
      case '%%':
        sql += `like @${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: `%${item.value}%`,
        });
        break;

      default:
        sql += `=@${safeKey}${index}`;
        _self.parameters.push({
          name: `${safeKey}${index}`,
          sqlType: sqlTypeHandle(item.sqlType),
          value: item.value,
        });
        break;
    }

    whereParts.push(sql);
  }

  _self.where = ' 1=1 ' + whereParts.join('');

  return _self;
};

export {sqlTypeHandle, getParameters, getUpdateParameters, getDeleteParameters };