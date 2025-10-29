// /**
//  * PostgreSQL - 命令行参数处理
//  * author: joey
//  * create time: 2018-04-25
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
//   /** 允许直接拼接 SQL 片段（不参数化） */
//   format?: boolean;
// }
// const m = {} as {
//   getParameters: (paras: SelectField) => QueryResult;
//   getUpdateParameters: (paras: UpdateParameters) => UpdateResult;
//   getDeleteParameters: (paras: { keyword?: KeywordItem[]; where?: KeywordItem[] }) => DeleteResult;
// };
/**
 * 获取分页参数，封装成执行SQL参数化的对象（PostgreSQL $1, $2...）
 * @param paras 原始参数集合
 * @returns QueryResult
 */
const getParameters = function (paras) {
    let index = 0;
    var _self = {
        select: '',
        where: ' where 1=1 ',
        orderBy: '',
        groupBy: '',
        // parameters: [],
        limit: '',
    };
    _self.parameters = [];
    // === SELECT 字段 ===
    if (paras.select && Array.isArray(paras.select)) {
        _self.select = paras.select.length === 0 ? 't.*' : paras.select.join(',');
    }
    else {
        _self.select = 't.*';
    }
    // === ORDER BY ===
    if (paras.orderBy && typeof paras.orderBy === 'object') {
        const parts = [];
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
    // === GROUP BY ===
    if (paras.groupBy && Array.isArray(paras.groupBy) && paras.groupBy.length > 0) {
        _self.groupBy = ` GROUP BY ${paras.groupBy.join(', ')} `;
    }
    // === WHERE 条件 ===
    const keywords = paras.keyword || paras.where || [];
    for (const item of keywords) {
        if (!item || item.value === '' || item.value === undefined || item.value === null)
            continue;
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
                if (item.format) {
                    index--; // 不占用参数位
                    _self.where += `${operator} ${item.value}`;
                }
                else {
                    index++;
                    _self.where += `${operator}$${index}`;
                    _self.parameters.push(item.value);
                }
                break;
            case 'in':
            case 'not in':
                if (Array.isArray(item.value) && item.value.length > 0) {
                    index--; // 预留
                    const placeholders = [];
                    for (const _ of item.value) {
                        index++;
                        placeholders.push(`$${index}`);
                        _self.parameters.push(item.value[_]);
                    }
                    _self.where += `${operator} (${placeholders.join(', ')})`;
                }
                else {
                    _self.where += `${operator} ()`;
                }
                break;
            case '%': // 左模糊
                index++;
                _self.where += `like $${index}`;
                _self.parameters.push(`%${item.value}`);
                break;
            case 'x%': // 右模糊
                index++;
                _self.where += `like $${index}`;
                _self.parameters.push(`${item.value}%`);
                break;
            case '%%': // 全模糊
                index++;
                _self.where += `like $${index}`;
                _self.parameters.push(`%${item.value}%`);
                break;
            case 'is':
                _self.where += `is ${item.value}`;
                break;
            default:
                index++;
                _self.where += `=$${index}`;
                _self.parameters.push(item.value);
                break;
        }
    }
    // === LIMIT & OFFSET ===
    if (paras.limit && paras.limit.length > 1) {
        index++;
        const limitIndex = index;
        index++;
        const offsetIndex = index;
        _self.limit = ` limit $${limitIndex} offset $${offsetIndex}`;
        _self.parameters.push(paras.limit[1], paras.limit[0]); // 注意：PostgreSQL 是 LIMIT 先，OFFSET 后
    }
    return _self;
};
/**
 * 获取更新参数（支持 CASE WHEN）
 * @param paras 原始参数集合
 * @returns UpdateResult
 */
const getUpdateParameters = function (paras) {
    let index = 0;
    const _self = {
        set: [],
        where: '',
        parameters: [],
    };
    // === SET 字段处理 ===
    for (const updateItem of paras.update || []) {
        if (!updateItem || ('value' in updateItem && updateItem.value === ''))
            continue;
        // CASE WHEN 复杂更新
        if ('case_field' in updateItem && 'case_item' in updateItem) {
            const { key, case_field, case_item } = updateItem;
            if (!Array.isArray(case_item) || case_item.length === 0)
                continue;
            const caseParts = [`${key}= (CASE ${case_field}`];
            for (const cw of case_item) {
                index += 2;
                const op = cw.operator || 'replace';
                switch (op) {
                    case 'replace':
                        caseParts.push(`WHEN $${index - 1} THEN $${index}`);
                        break;
                    case 'plus':
                        caseParts.push(`WHEN $${index - 1} THEN ${key} + $${index}`);
                        break;
                    case 'reduce':
                        caseParts.push(`WHEN $${index - 1} THEN ${key} - $${index}`);
                        break;
                    default:
                        caseParts.push(`WHEN $${index - 1} THEN $${index}`);
                        break;
                }
                _self.parameters.push(cw.case_value, cw.value);
            }
            caseParts.push('END)');
            _self.set.push(caseParts.join(' '));
        }
        // 普通字段更新
        else {
            const item = updateItem;
            index++;
            const op = item.operator || 'replace';
            switch (op) {
                case 'replace':
                    _self.set.push(`${item.key}=$${index}`);
                    _self.parameters.push(item.value);
                    break;
                case 'plus':
                    _self.set.push(`${item.key}=${item.key} + $${index}`);
                    _self.parameters.push(item.value);
                    break;
                case 'reduce':
                    _self.set.push(`${item.key}=${item.key} - $${index}`);
                    _self.parameters.push(item.value);
                    break;
                default:
                    _self.set.push(`${item.key}=$${index}`);
                    _self.parameters.push(item.value);
                    break;
            }
        }
    }
    // === WHERE 条件处理 ===
    const keywords = paras.keyword || paras.where || [];
    const whereParts = [];
    for (const item of keywords) {
        if (!item || item.value === '' || item.value === undefined || item.value === null)
            continue;
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
                index++;
                sql += `${operator}$${index}`;
                _self.parameters.push(item.value);
                break;
            case '%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`%${item.value}`);
                break;
            case 'x%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`${item.value}%`);
                break;
            case '%%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`%${item.value}%`);
                break;
            case 'in':
            case 'not in':
                if (Array.isArray(item.value) && item.value.length > 0) {
                    index--;
                    const placeholders = [];
                    for (const _ of item.value) {
                        index++;
                        placeholders.push(`$${index}`);
                        _self.parameters.push(item.value[_]);
                    }
                    sql += `${operator} (${placeholders.join(', ')})`;
                }
                else {
                    sql += `${operator} ()`;
                }
                break;
            default:
                index++;
                sql += `=$${index}`;
                _self.parameters.push(item.value);
                break;
        }
        whereParts.push(sql);
    }
    _self.where = ' 1=1 ' + whereParts.join('');
    return _self;
};
/**
 * 获取删除参数
 * @param paras 原始参数集合
 * @returns DeleteResult
 */
const getDeleteParameters = function (paras) {
    let index = 0;
    const _self = {
        where: '',
        parameters: [],
    };
    const keywords = paras.keyword || paras.where || [];
    const whereParts = [];
    for (const item of keywords) {
        if (!item || item.value === '' || item.value === undefined || item.value === null)
            continue;
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
                index++;
                sql += `${operator}$${index}`;
                _self.parameters.push(item.value);
                break;
            case '%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`%${item.value}`);
                break;
            case 'x%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`${item.value}%`);
                break;
            case '%%':
                index++;
                sql += `like $${index}`;
                _self.parameters.push(`%${item.value}%`);
                break;
            case 'in':
            case 'not in':
                if (Array.isArray(item.value) && item.value.length > 0) {
                    index--;
                    const placeholders = [];
                    for (const _ of item.value) {
                        index++;
                        placeholders.push(`$${index}`);
                        _self.parameters.push(item.value[_]);
                    }
                    sql += `${operator} (${placeholders.join(', ')})`;
                }
                else {
                    sql += `${operator} ()`;
                }
                break;
            default:
                index++;
                sql += `=$${index}`;
                _self.parameters.push(item.value);
                break;
        }
        whereParts.push(sql);
    }
    _self.where = ' 1=1 ' + whereParts.join('');
    return _self;
};
export { getDeleteParameters, getParameters, getUpdateParameters };
