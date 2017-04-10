/**
 * 通用模块-命令行参数处理
 * author:zack zou
 * create time:2016-06-27
 */

var m = {}

/**
 * 获取分页参数，封装成执行SQL参数化的对象
 * @param paras 原始参数集合
 * {
 *   "select":[],               //需要查询的字段，可缺省，即表示“*”
 *   "keyword":[]
 *   "orderBy":{}
 * }
 * author:zack zou
 * create time:2016-06-27
 */
m.getParameters = function (paras) {
    //返回的参数集合
    var _self = {'select': [], 'where': ' where 1=1 ', 'orderBy': '', 'parameters': [], "limit": ""};
    /**
     * 兼容性修复，用limit替换之前的start、length参数
     */
    if (!paras.hasOwnProperty("limit") && paras.hasOwnProperty("start") && paras.hasOwnProperty("length")) {
        paras.limit = [paras["start"], paras["length"]];
    }

    /**
     * 指定字段查询，可以包含聚合函数
     * paras.select是数组对象
     */
    console.log('paras.select', paras.select, "typeof paras.select ", typeof paras.select);
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
        for (var i in paras.orderBy) {
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
    //遍历查询条件参数
    for (var i in paras.keyword) {
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }
            _self.where += " " + paras.keyword[i].logic + " " + paras.keyword[i].key + " ";

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                var oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where += (oper + "?");
                        //参数化
                        _self.parameters.push(paras.keyword[i].value);
                        break;
                    case "in":
                    //    //包含查询，利用数据遍历的方式实现
                    //    var p = [];
                    //    for (var c in paras.keyword[i].value) {
                    //        //参数化
                    //        _self.parameters.push(paras.keyword[i].value[c]);
                    //        p.push('?');
                    //    }
                    //    _self.where += "in (" + p.join(',') + ")";
                    //    break;
                    case "not in":
                        //包含查询，利用数据遍历的方式实现
                        var p = [];
                        for (var c in paras.keyword[i].value) {
                            //参数化
                            _self.parameters.push(paras.keyword[i].value[c]);
                            p.push('?');
                        }
                        _self.where += " " + oper + " (" + p.join(',') + ")";
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where += "like ?";
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value);
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算 where f like ?
                        //右侧模糊匹配查询
                        _self.where += "like ?";
                        //参数化
                        _self.parameters.push(paras.keyword[i].value + '%');
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where += "like ?";
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value + '%');
                        break;
                    case 'is':
                        _self.where += "is " + paras.keyword[i].value;
                        break;
                    default:
                        _self.where += "";
                        break;
                }
            }
            else {
                //运算符
                _self.where += "=?"
                //参数化
                _self.parameters.push(paras.keyword[i].value);
            }


        }
    }
    /**
     * 检测是否存在limit
     */
    if (paras.limit && paras.limit.length > 1) {
        _self.limit = " limit ?,?";
        _self.parameters.push(paras.limit[0]);
        _self.parameters.push(paras.limit[1]);
    }
    /**
     * 返回结果
     */
    return _self;
}


/**
 * 获取更新参数
 * @param paras 原始参数集合
 * author:zack zou
 * create time:2016-06-27
 */
m.getUpdateParameters = function (paras) {
    //返回的参数集合
    var _self = {"set": [], "where": [], "parameters": []};

    /**
     * 更新字段
     * update：需要更新的字段
     */
    //遍历查询条件参数
    for (var i in paras.update) {
        /**
         * update里面是对象数组{"key":"","value":"","operator":"replace"}
         */
        if (paras.update[i] != '') {
            /**
             * 默认逻辑处理，默认替换更新
             */
            if (!paras.update[i].hasOwnProperty('operator')) {
                paras.update[i].operator = "replace";
            }
            //更新参数处理
            var oper = paras.update[i].operator;
            switch (oper) {
                case 'replace':
                    /**
                     * 值替换
                     */
                    _self.set.push(paras.update[i].key + '=?');
                    _self.parameters.push(paras.update[i].value);
                    break;
                case "plus":
                    /**
                     * 值累加
                     */
                    _self.set.push(paras.update[i].key + '=' + paras.update[i].key + "+ ?");
                    _self.parameters.push(paras.update[i].value);
                    break;
                case "reduce":
                    /**
                     * 值累减
                     */
                    _self.set.push(paras.update[i].key + '=' + paras.update[i].key + "- ?");
                    _self.parameters.push(paras.update[i].value);
                    break;
                default:
                    /**
                     * 其他默认为值替换更新
                     */
                    _self.set.push(paras.update[i].key + '=?');
                    _self.parameters.push(paras.update[i].value);
                    break;
            }
        }
    }

    /**
     * where条件以及参数处理
     * keyword：查询条件
     */
    //遍历查询条件参数
    for (var i in paras.keyword) {
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                var oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push(paras.keyword[i].value);
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value);
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算
                        //右侧模糊匹配查询
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push(paras.keyword[i].value + '%');
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value + '%');
                        break;
                    case "in":
                    case "not in":
                        var _item = ' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + " " + oper + " ("
                        //包含查询，利用数据遍历的方式实现
                        var p = [];
                        for (var c in paras.keyword[i].value) {
                            //参数化
                            _self.parameters.push(paras.keyword[i].value[c]);
                            p.push('?');
                        }
                        _item += p.join(',') + ")";         //sql语句
                        _self.where.push(_item);
                        break;
                }
            }

        }
    }
    /**
     * where条件字符串组装
     */
    _self.where = ' 1=1 ' + _self.where.join('');
    /**
     * 返回结果
     */
    return _self;
}

/**
 * 获取实例删除参数
 * 注意，一般情况下不推荐直接物理删除
 * @param paras 原始参数集合
 * {
 *   "keyword":[]
 * }
 * author:zack zou
 * create time:2017-04-06
 */
m.getDeleteParameters = function (paras) {
    //返回的参数集合
    var _self = {'where': [], 'parameters': []};

    /**
     * where条件以及参数处理
     * keyword：查询条件
     */
    //遍历查询条件参数
    for (var i in paras.keyword) {
        /**
         * keyword里面是对象数组{"key":"","value":"","logic":"and","operator:"="}
         */
        if (paras.keyword[i] != '') {
            /**
             * 默认逻辑处理，允许部分参数不填写
             */
            if (!paras.keyword[i].hasOwnProperty('logic')) {
                paras.keyword[i].logic = "and";
            }

            //逻辑运算
            if (paras.keyword[i].hasOwnProperty('operator')) {
                var oper = paras.keyword[i].operator;
                switch (oper) {
                    case '=':
                    case ">":
                    case "<":
                    case "<>":
                    case ">=":
                    case "<=":
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push(paras.keyword[i].value);
                        break;
                    case '%':
                        //模糊查询，logic需要指定link逻辑运算
                        //左侧模糊匹配查询
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value);
                        break;
                    case 'x%':
                        //模糊查询，logic需要指定link逻辑运算
                        //右侧模糊匹配查询
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push(paras.keyword[i].value + '%');
                        break;
                    case '%%':
                        //模糊查询，logic需要指定link逻辑运算
                        _self.where.push(' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + oper + "?");
                        //参数化
                        _self.parameters.push('%' + paras.keyword[i].value + '%');
                        break;
                    case "in":
                    case "not in":
                        var _item = ' ' + paras.keyword[i].logic + ' ' + paras.keyword[i].key + " " + oper + " ("
                        //包含查询，利用数据遍历的方式实现
                        var p = [];
                        for (var c in paras.keyword[i].value) {
                            //参数化
                            _self.parameters.push(paras.keyword[i].value[c]);
                            p.push('?');
                        }
                        _item += p.join(',') + ")";         //sql语句
                        _self.where.push(_item);
                        break;
                }
            }

        }
    }
    /**
     * where条件字符串组装
     */
    _self.where = ' 1=1 ' + _self.where.join('');
    /**
     * 返回结果
     */
    return _self;
}

module.exports = m;