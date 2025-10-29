/**
 * SQL Server - 命令行参数处理
 * author:joey
 * create time:2018-05-17
 */
const TYPES = {
    "NULL": "Null",
    "TINYINT": "TinyInt",
    "BIT": "Bit",
    "SMALLINT": "SmallInt",
    "INT": "Int",
    "SMALLDATETIME": "SmallDateTime",
    "REAL": "Real",
    "MONEY": "Money",
    "DATETIME": "DateTime",
    "FLOAT": "Float",
    "DECIMAL": "Decimal",
    "NUMERIC": "Numeric",
    "SMALLMONEY": "SmallMoney",
    "BIGINT": "BigInt",
    "IMAGE": "Image",
    "TEXT": "Text",
    "UNIQUEIDENTIFIER": "UniqueIdentifier",
    "INTN": "IntN",
    "NTEXT": "NText",
    "BITN": "BitN",
    "DECIMALN": "DecimalN",
    "NUMERICN": "NumericN",
    "FLOATN": "FloatN",
    "MONEYN": "MoneyN",
    "DATETIMEN": "DateTimeN",
    "VARBINARY": "VarBinary",
    "VARCHAR": "VarChar",
    "BINARY": "Binary",
    "CHAR": "Char",
    "NVARCHAR": "NVarChar",
    "NCHAR": "NChar",
    "XML": "Xml",
    "TIME": "Time",
    "DATE": "Date",
    "DATETIME2": "DateTime2",
    "DATETIMEOFFSET": "DateTimeOffset",
    "UDT": "UDT",
    "TVP": "TVP",
    "VARIANT": "Variant"
};

let m = {};


/**
 * 参数类型处理
 * @param sqlType SQL字段类型处理
 */
m.sqlTypeHandle = (sqlType) => {
    if (sqlType && sqlType != "") {
        // 直接转换成为大写
        let sqltype = TYPES[sqlType.toUpperCase()];
        if (!sqltype)
            sqltype = "NVarChar";     // 没有匹配到的类型
        return sqltype;
    }
    else
        return "NVarChar";
};

/**
 * 获取分页参数，封装成执行SQL参数化的对象
 * @param paras 原始参数集合
 * {
 *   "select":[],               //需要查询的字段，可缺省，即表示“*”
 *   "keyword":[]
 *   "orderBy":{}
 * }
 * author:joey
 * create time:2018-05-17
 */
m.getParameters = function (paras) {
    //返回的参数集合
    let _self = { 'select': [], 'where': ' where 1=1 ', 'orderBy': '', 'parameters': [], "limit": "" };

    /**
     * 指定字段查询，可以包含聚合函数
     * paras.select是数组对象
     */
    if (paras.select && typeof paras.select === "object") {
        if (paras.select.length == 0)
            _self.select = 't.*';
        else if (paras.select.length == 1)
            _self.select = paras.select[0];
        else
            _self.select = paras.select.join(',');
    }
    else {
        //如果没有包含这个参数，默认查询全部数据
        _self.select = 't.*';
    }

    /**
     * 排序
     */
    if (paras.hasOwnProperty('orderBy') && paras.orderBy != null) {
        /**
         * 遍历排序数组
         * 支持多字段排序
         * @orderBy {"order":"ASC"}
         */
        for (let i in paras.orderBy) {
            if (_self.orderBy === '') {
                _self.orderBy += ' order by ' + i + ' ' + paras.orderBy[i] + ' ';
            }
            else {
                _self.orderBy += ',' + i + ' ' + paras.orderBy[i] + ' ';
            }
        }
    }

    /**
     * where条件以及参数处理
     * keyword：查询条件
     */
    paras.keyword = paras.keyword || paras.where;
    // 索引
    let index = 0;
    //遍历查询条件参数
    for (let i in paras.keyword) {
        index++;        // 增加索引
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 匹配参数类型
             */
            console.log('参数比较', paras.keyword[i].key)
            for (let s = 0; s < paras.configs.fields.length; s++) {

                if (paras.keyword[i].key === paras.configs.fields[s].name) {
                    paras.keyword[i].sqlType = TYPES[paras.configs.fields[s].type.toUpperCase()] || "";
                    break;
                }
            }

            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }
            _self.where += " " + paras.keyword[i].logic + " " + paras.keyword[i].key + " ";

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                let oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where += (oper + "@" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    case "in":
                    case "not in":
                        //包含查询，利用数据遍历的方式实现
                        let p = [];
                        for (let c in paras.keyword[i].value) {
                            p.push("@" + paras.keyword[i].key + index);
                            //参数化
                            _self.parameters.push({
                                "name": paras.keyword[i].key + index,
                                "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                                "value": paras.keyword[i].value[c]
                            });
                            index++;    // 增加索引
                        }
                        _self.where += " " + oper + " (" + p.join(',') + ")";
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value
                        });
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算 where f like ?
                        //右侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value + "%"
                        });
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value + "%"
                        });
                        break;
                    case 'is':
                        _self.where += ("is @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    default:
                        _self.where += "";
                        break;
                }
            }
            else {
                //运算符
                _self.where += ("=@" + paras.keyword[i].key + index);
                //参数化
                _self.parameters.push({
                    "name": paras.keyword[i].key + index,
                    "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                    "value": paras.keyword[i].value
                });
            }
        }
    }
    /**
     * 检测是否存在limit
     * 第二种方式：offset fetch next方式（SQL2012以上的版本才支持：推荐使用 ）
     select * from ArtistModels  order by ArtistId offset 4 rows fetch next 5 rows only
     --order by ArtistId offset 页数 rows fetch next 条数 rows only ----
     */
    if (paras.limit && paras.limit.length > 1) {
        _self.limit = " offset @onelaPageIndex rows fetch next @onelaPageSize rows only";
        _self.parameters.push({
            "name": "onelaPageIndex",
            "sqlType": "Int",
            "value": paras.limit[0]
        });
        _self.parameters.push({
            "name": "onelaPageSize",
            "sqlType": "Int",
            "value": paras.limit[1]
        });
    }
    else if (paras.limit && paras.limit.length == 1) {
        _self.limit = " offset @onelaPageIndex rows fetch next @onelaPageSize rows only";
        _self.parameters.push({
            "name": "onelaPageIndex",
            "sqlType": "Int",
            "value": 0
        });
        _self.parameters.push({
            "name": "onelaPageSize",
            "sqlType": "Int",
            "value": paras.limit[0]
        });
    }
    else {
        _self.limit = "";
    }
    /**
     * 返回结果
     */
    return _self;
};


/**
 * 获取更新参数
 * @param paras 原始参数集合
 * author:joey
 * create time:2018-05-17
 */
m.getUpdateParameters = function (paras) {

    /**
    * where条件以及参数处理
    * keyword：查询条件
    */
    paras.keyword = paras.keyword || paras.where;

    //返回的参数集合
    let _self = { "set": [], "where": [], "parameters": [] };
    // 参数索引
    let index = 0;
    /**
     * 更新字段
     * update：需要更新的字段
     */
    //遍历查询条件参数
    for (let i in paras.update) {
        /**
         * update里面是对象数组{"key":"","value":"","operator":"replace"}
         * {
         *   "key": "payment_no",
         *   "case_field": "id",
         *   "case_item": [{"case_value": "123", "value": "1", "operator": "replace"}]
         * }
         */

        //参数值验证
        if (paras.update[i] == '') {
            continue;
        }

        // 字段验证
        for (let s = 0; s < paras.configs.fields.length; s++) {

            if (paras.update[i].key === paras.configs.fields[s].name) {
                paras.update[i].sqlType = TYPES[paras.configs.fields[s].type.toUpperCase()] || "";
                break;
            }
        }

        //判断字段更新模式，常规更新还是case when then更新方式
        if (paras.update[i].hasOwnProperty('case_field')) {
            //遍历节点
            let item = paras.update[i];
            console.log('传入参数', item);
            // let kkk = {
            //     "key": "payment_no",
            //     "case_field": "id",
            //     "case_item": [
            //         {"case_value": "123", "value": "1", "operator": "replace"}
            //     ]
            // }

            //条件判断
            if (!(item.case_item instanceof Array) || item.case_item.length == 0) {
                //条件不符合
                continue;
            }

            // 处理case字段的类型
            let case_sqlType = "NvarChar";    // 默认处理方式
            // 循环where条件
            // 字段验证
            for (let s = 0; s < paras.configs.fields.length; s++) {
                // 更新的case_field字段类型
                if (item.case_field === paras.configs.fields[s].name) {
                    case_sqlType = TYPES[paras.configs.fields[s].type.toUpperCase()] || "";
                    break;
                }
            }
            //开头
            let case_str = [];
            case_str.push(item.key + '= (CASE ' + item.case_field);

            //循环case_item分支
            for (let cw in item.case_item) {
                /**
                 * 默认逻辑处理，默认替换更新
                 */
                if (!item.case_item[cw].hasOwnProperty('operator')) {
                    item.case_item[cw].operator = "replace";
                }
                //更新参数处理
                let oper = item.case_item[cw].operator;
                switch (oper) {
                    case 'replace':
                        /**
                         * 值替换   // WHEN '1' THEN balance+2
                         */
                        case_str.push("WHEN @" + item.case_field + "_before_" + index + " THEN @" + item.key + "_after_" + index);
                        _self.parameters.push({
                            "name": item.case_field + "_before_" + index,
                            "sqlType": m.sqlTypeHandle(case_sqlType), //
                            "value": item.case_item[cw].case_value
                        });
                        _self.parameters.push({
                            "name": item.key + "_after_" + index,       //item.case_field 
                            "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                            "value": item.case_item[cw].value
                        });
                        break;
                    case "plus":
                        /**
                         * 值累加
                         */
                        case_str.push("WHEN @" + item.case_field + "_before_" + index + " THEN @" + item.key + "_after_" + index);
                        _self.parameters.push({
                            "name": item.case_field + "_before_" + index,
                            "sqlType": m.sqlTypeHandle(case_sqlType), // 
                            "value": item.case_item[cw].case_value
                        });
                        _self.parameters.push({
                            "name": item.key + "_after_" + index,
                            "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                            "value": item.case_item[cw].value
                        });
                        break;
                    case "reduce":
                        /**
                         * 值累减
                         */
                        case_str.push("WHEN @" + item.case_field + "_before_" + index + " THEN @" + item.key + "_after_" + index);
                        _self.parameters.push({
                            "name": item.case_field + "_before_" + index,
                            "sqlType": m.sqlTypeHandle(case_sqlType), // 
                            "value": item.case_item[cw].case_value
                        });
                        _self.parameters.push({
                            "name": item.key + "_after_" + index,
                            "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                            "value": item.case_item[cw].value
                        });
                        break;
                    default:
                        /**
                         * 其他默认为值替换更新
                         */
                        case_str.push("WHEN @" + item.case_field + "_before_" + index + " THEN " + item.key + "_after_" + index);
                        _self.parameters.push({
                            "name": item.case_field + "_before_" + index,
                            "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                            "value": item.case_item[cw].case_value
                        });
                        _self.parameters.push({
                            "name": item.key + "_after_" + index,
                            "sqlType": m.sqlTypeHandle(case_sqlType), //  
                            "value": item.case_item[cw].value
                        });
                        break;
                }
            }
            //结尾
            case_str.push("END) ");
            //追加到参数模型
            _self.set.push(case_str.join(' '));
            index++;
        }
        else {

            /**
             * 默认逻辑处理，默认替换更新
             */
            if (!paras.update[i].hasOwnProperty('operator')) {
                paras.update[i].operator = "replace";
            }
            //更新参数处理
            let oper = paras.update[i].operator;
            switch (oper) {
                case 'replace':
                    /**
                     * 值替换
                     */
                    _self.set.push(paras.update[i].key + '=@' + paras.update[i].key + index);
                    _self.parameters.push({
                        "name": paras.update[i].key + index,
                        "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                        "value": paras.update[i].value
                    });
                    break;
                case "plus":
                    /**
                     * 值累加
                     */
                    _self.set.push(paras.update[i].key + '=' + paras.update[i].key + "+ @" + paras.update[i].key + index);
                    _self.parameters.push({
                        "name": paras.update[i].key + index,
                        "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                        "value": paras.update[i].value
                    });
                    break;
                case "reduce":
                    /**
                     * 值累减
                     */
                    _self.set.push(paras.update[i].key + '=' + paras.update[i].key + "- @" + paras.update[i].key + index);
                    _self.parameters.push({
                        "name": paras.update[i].key + index,
                        "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                        "value": paras.update[i].value
                    });
                    break;
                default:
                    /**
                     * 其他默认为值替换更新
                     */
                    _self.set.push(paras.update[i].key + '=@' + paras.update[i].key + index);
                    _self.parameters.push({
                        "name": paras.update[i].key + index,
                        "sqlType": m.sqlTypeHandle(paras.update[i].sqlType),
                        "value": paras.update[i].value
                    });
                    break;
            }
            index++;
        }
    }



    //遍历查询条件参数
    for (let i in paras.keyword) {
        index++;        // 增加索引
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 匹配参数类型
             */
            for (let s = 0; s < paras.configs.fields.length; s++) {
                if (paras.keyword[i].key === paras.configs.fields[s].name) {
                    paras.keyword[i].sqlType = TYPES[paras.configs.fields[s].type.toUpperCase()] || "";
                    break;
                }
            }
            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }
            _self.where += " " + paras.keyword[i].logic + " " + paras.keyword[i].key + " ";

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                let oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where += (oper + "@" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    case "in":
                    case "not in":
                        //包含查询，利用数据遍历的方式实现
                        let p = [];
                        for (let c in paras.keyword[i].value) {
                            p.push("@" + paras.keyword[i].key + index);
                            // 参数化
                            _self.parameters.push({
                                "name": paras.keyword[i].key + index,
                                "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                                "value": paras.keyword[i].value[c]
                            });
                            index++;    // 增加索引
                        }
                        _self.where += " " + oper + " (" + p.join(',') + ")";
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value
                        });
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算 where f like ?
                        //右侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value + "%"
                        });
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value + "%"
                        });
                        break;
                    case 'is':
                        _self.where += ("is @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    default:
                        _self.where += "";
                        break;
                }
            }
            else {
                //运算符
                _self.where += ("=@" + paras.keyword[i].key + index);
                //参数化
                _self.parameters.push({
                    "name": paras.keyword[i].key + index,
                    "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                    "value": paras.keyword[i].value
                });
            }
        }
    }

    /**
     * 检测是否存在limit
     * 第二种方式：offset fetch next方式（SQL2012以上的版本才支持：推荐使用 ）
     select * from ArtistModels  order by ArtistId offset 4 rows fetch next 5 rows only
     --order by ArtistId offset 页数 rows fetch next 条数 rows only ----
     */
    if (paras.limit && paras.limit.length > 1) {
        _self.limit = " offset @onelaPageIndex rows fetch next @onelaPageSize rows only";
        _self.parameters.push({
            "name": "onelaPageIndex",
            "sqlType": "Int",
            "value": paras.limit[0]
        });
        _self.parameters.push({
            "name": "onelaPageSize",
            "sqlType": "Int",
            "value": paras.limit[1]
        });
    }
    else if (paras.limit && paras.limit.length == 1) {
        _self.limit = " offset @onelaPageIndex rows fetch next @onelaPageSize rows only";
        _self.parameters.push({
            "name": "onelaPageIndex",
            "sqlType": "Int",
            "value": 0
        });
        _self.parameters.push({
            "name": "onelaPageSize",
            "sqlType": "Int",
            "value": paras.limit[0]
        });
    }
    else {
        _self.limit = "";
    }
    /**
     * where条件字符串组装
     */
    _self.where = ' 1=1 ' + _self.where;
    /**
     * 返回结果
     */
    return _self;
};

/**
 * 获取实例删除参数
 * 注意，一般情况下不推荐直接物理删除
 * @param paras 原始参数集合
 * {
 *   "keyword":[]
 * }
 * author:joey
 * create time:2018-05-17
 */
m.getDeleteParameters = function (paras) {
    //返回的参数集合
    let _self = { 'where': [], 'parameters': [] };

    /**
     * where条件以及参数处理
     * keyword：查询条件
     */
    paras.keyword = paras.keyword || paras.where;
    // 索引
    let index = 0;
    //遍历查询条件参数
    for (let i in paras.keyword) {
        index++;        // 增加索引
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 匹配参数类型
             */
            for (let s = 0; s < paras.configs.fields.length; s++) {
                if (paras.keyword[i].key === paras.configs.fields[s].name) {
                    paras.keyword[i].sqlType = TYPES[paras.configs.fields[s].type.toUpperCase()] || "";
                    break;
                }
            }
            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }
            _self.where += " " + paras.keyword[i].logic + " " + paras.keyword[i].key + " ";

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                let oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where += (oper + "@" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    case "in":
                    case "not in":
                        //包含查询，利用数据遍历的方式实现
                        let p = [];
                        for (let c in paras.keyword[i].value) {
                            p.push("@" + paras.keyword[i].key + index);
                            //参数化
                            _self.parameters.push({
                                "name": paras.keyword[i].key + index,
                                "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                                "value": paras.keyword[i].value[c]
                            });
                            index++;    // 增加索引
                        }
                        _self.where += " " + oper + " (" + p.join(',') + ")";
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value
                        });
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算 where f like ?
                        //右侧模糊匹配查询
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value + "%"
                        });
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where += ("like @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": "%" + paras.keyword[i].value + "%"
                        });
                        break;
                    case 'is':
                        _self.where += ("is @" + paras.keyword[i].key + index);
                        //参数化
                        _self.parameters.push({
                            "name": paras.keyword[i].key + index,
                            "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                            "value": paras.keyword[i].value
                        });
                        break;
                    default:
                        _self.where += "";
                        break;
                }
            }
            else {
                //运算符
                _self.where += ("=@" + paras.keyword[i].key + index);
                //参数化
                _self.parameters.push({
                    "name": paras.keyword[i].key + index,
                    "sqlType": m.sqlTypeHandle(paras.keyword[i].sqlType),
                    "value": paras.keyword[i].value
                });
            }
        }
    }
    /**
     * where条件字符串组装
     */
    _self.where = ' 1=1 ' + _self.where;
    /**
     * 返回结果
     */
    return _self;
};

module.exports = m;