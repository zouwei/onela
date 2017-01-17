/**
 * 通用模块-命令行参数处理
 * author:zack zou
 * create time:2016-06-27
 */
var dbconn = require("../service/dbconnect");
var command = require("../service/command");

var m = {}

/**
 * 查询瀑布数据列表，不返回记录总数，当返回的记录数小于每页显示记录数时，查询到了末尾
 * 查询记录length，查询可以length+1，前台数据只显示length的记录，判断尾页，利用length+1判断，小于等于length的记录到了末尾页面
 * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
 * author:zack zou
 * create time:2016-06-27
 */
m.queryWaterfallList = function (paras, cb) {
    /**
     * 参数处理
     */
    var p = command.getParameters(paras);

    /**
     * 分页数据查询
     */
    console.log("select  * from " + paras.command.tableName + " " + p.where + p.orderBy);

    dbconn.db.query("select * from " + paras.command.tableName + " " + p.where + " " + p.orderBy + " LIMIT ?,?", p.parameters.concat([paras.start, paras.length]), function (err, doc) {
        if (err) {
            console.log(err);
            cb(err);
        } else {
            /**
             * 套两层，第二层查询记录总数
             */
            //定义返回数据结构
            var data = {
                data: doc,                          //数据列表
                start: paras.start,                 //当前页索引
                length: paras.length                //页大小
            }
            //返回数据
            cb(null, data);
        }
    });
}

/**
 * 查询实体列表集合数据
 * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
 * author:zack zou
 * create time:2016-06-27
 */
m.queryEntityList = function (paras, cb) {

    /**
     * 参数处理
     */
    var p = command.getParameters(paras);
    console.log('参数：', p);
    /**
     * 分页数据查询
     */
    console.log("select * from " + paras.command.tableName + " " + p.where + " " + p.orderBy + " LIMIT ?,?");
    dbconn.db.query("select * from " + paras.command.tableName + " " + p.where + " " + p.orderBy + " LIMIT ?,?", p.parameters.concat([paras.start, paras.length]), function (err, doc) {
        if (err) {

            console.log(err);

            cb(err);
        } else {
            /**
             * 套两层，第二层查询记录总数
             */
            dbconn.db.query("select count(0) total from " + paras.command.tableName + " " + p.where, p.parameters, function (err, counts) {
                if (err) {
                    console.log(err);
                    cb(err);
                }
                else {
                    //定义返回数据结构
                    var data = {
                        "data": doc,                          //数据列表
                        "recordsTotal": counts[0].total,      //查询记录总数
                        "recordsFiltered": counts[0].total,
                        "draw": paras.draw,
                        "start": paras.start,                 //当前页索引
                        "length": paras.length                //页大小
                    }
                    //返回数据
                    cb(null, data);
                }
            });

        }
    });
}

/**
 * SQL查询结果列表，根据参数返回符合条件的全部结果
 * @param paras 参数集合
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-07-01
 */
m.query = function (paras, cb) {
    /**
     * 参数处理
     */
    var p = command.getParameters(paras);
    console.log(p);
    /**
     * 根据制定条件获取查询数据列表
     * 自由组合查询条件
     */
    dbconn.db.query("select  * from " + paras.command.tableName + " " + p.where + p.orderBy, p.parameters, function (err, data) {
        if (err) {
            cb(err);
        } else {
            //返回数据
            cb(null, data);
        }
    });
}

/**
 * Proc存储过程执行，根据参数返回符合条件的结果
 * @param paras 参数集合，以下为参数示例：
 * {
 *   "proc_name":"usp_biz_getBizInfoList",            //存储过程名称
 *   "keyword":{"_start":0,"_length":10}              //存储过程的输入参数
 * }
 * @param cb 回调函数
 * author:zack zou
 * create time：2016-12-05
 */
m.proc = function (paras, cb) {
    /**
     * 参数处理，数据库模式，支持多种数据库，目前写死mysql
     */
    try {
        /**
         * 存储过程基于不同类型数据库的架构支持，目前只做支持mysql的示例
         * 代码预留位置
         */
        paras.database = 'mysql';
        paras.symbol = '@';
        /**
         * 架构中间处理变量
         */
        var _self = {"call": "", "parameter": [], values: []};
        /**
         * 输入参数匹配
         */
        var _error = false;
        var error = [];
        for (var j in paras.config.parameter) {
            _error = false;
            /**
             * 输出参数，查看参数是否完全匹配
             * 不在可传参数之列的参数，程序自动忽略
             */
            for (var i in paras.keyword) {
                if (paras.config.parameter[j].name == i) {
                    _self.values.push(paras.keyword[i]);     //@parameter value
                    _self.parameter.push('?');
                    _error = true;
                }
            }
            /**
             * 如果验证未通过直接返回
             */
            if (!_error && !paras.config.parameter[j].mandatory) {
                error.push(paras.config.parameter[j]);
            }
        }
        /**
         * 输入参数匹配
         */
        for (var j in paras.config.outs) {
            //貌似这里不需要额外参数
            _self.parameter.push(paras.symbol + paras.config.outs[j].name);
        }
        /**
         * 是否错误抛出
         */
        if (error.length > 0) {
            console.log('error', error);
            cb("参数不正确", error);
            return;
        }
        /**
         * 参数处理，支持不通类型数据库的业务处理（目前只固定处理mysql）
         */
        switch (paras.database) {
            case "mysql":
                //参数名（防止SQL注入，）
                _self.call = "call " + paras.proc_name + "(" + _self.parameter.join(',') + ");";
                break;
        }
        /**
         * 参数拼装
         */
        console.log('执行存储过程模型>>>>>', _self);
        /**
         * 参数化处理完毕
         * 执行存储过程
         */
        dbconn.db.query(_self.call, _self.values, function (err, result) {
            if (err) {
                cb(err);
            } else {
                //返回数据
                cb(null, result);
            }
        });
    }
    catch (e) {
        console.log('异常：', e);
        cb("执行存储过程出现异常");
    }
}

/**
 * 统计信息查询，sum统计
 * @param paras 执行参数
 * @param paras.command.sumField 统计字段
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-07-01
 */
m.statsBySum = function (paras, cb) {
    /**
     * 参数处理
     */
    var p = command.getParameters(paras);

    /**
     * sum统计sql执行
     */
    dbconn.db.query("select sum(" + paras.command.sumField + ") total from " + paras.command.tableName + " " + p.where, p.parameters, function (err, datas) {
        if (err) {
            console.log(err);
            res.json(err);
        }
        else {
            var total = 0;
            if (datas.length != 0 && datas[0].total != null) {
                total = datas[0].total;
            }
            //返回数据
            cb(null, total);
        }
    });
}

/**
 * 统计信息查询，count统计
 * @param paras 执行参数
 * @param paras.command.countField 统计字段
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-08-12
 */
m.statsByCount = function (paras, cb) {
    /**
     * 参数处理
     */
    var p = command.getParameters(paras);

    /**
     * 套两层，第二层查询记录总数
     */
    dbconn.db.query("select count(" + paras.command.countField + ") total from " + paras.command.tableName + " " + p.where, p.parameters, function (err, datas) {
        if (err) {
            console.log(err);
            cb(err);
        }
        else {
            var total = 0;
            if (datas.length != 0 && datas[0].total != null) {
                total = datas[0].total;
            }
            //返回数据
            cb(null, total);
        }
    });
}

/**
 * 统计信息查询，count统计
 * @param paras 执行参数
 * @param paras.command.aggregate 统计字段
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-08-12
 */
m.statsByAggregate = function (paras, cb) {

    /**
     * 参数处理
     */
    var p = command.getParameters(paras);
    /**
     * 参数比对，符合条件的参数才执行处理
     * 其他聚合函数（SQL）根据需要再添加
     */
    var check = {
        "count": "COUNT",
        "sum": "SUM",
        "max": "MAX",
        "min": "MIN",
        "abs": "ABS",
        "avg": "AVG"
    }
    /**
     * 循环遍历执行的聚合函数
     */
    var show = [];
    for (var i in paras.aggregate) {
        var c = paras.aggregate[i];
        var item = check[c.function.toLowerCase()];
        if (item) {
            show.push(item + "(" + c.field + ") as " + c.name);
        }
    }
    console.log(p);
    console.log(show);
    /**
     * 查询统计
     */
    dbconn.db.query("select " + show.join(',') + " from " + paras.command.tableName + " " + p.where, p.parameters, function (err, result) {
        if (err) {
            console.log(err);
            cb(err);
        }
        else {
            //返回数据
            cb(null, result);
        }
    });
}

/**
 * 新增操作
 * @param paras 新增参数配置
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-07-01
 */
m.insertion = function (paras, cb) {
    /**
     * 参数处理
     * p：参数值集合，f字段名称集合，s占位参数符号
     */
    var p = [], f = [], s = [];
    for (var i in paras.insertion) {
        //参数值
        p.push(paras.insertion[i]);
        //字段名称集合
        f.push(i);
        //sql参数化处理符合
        s.push('?');
    }
    console.log("insert into " + paras.command.tableName + "(" + f.join(',') + ") values(" + s.join(',') + ");");

    /**
     * 执行sql以及参数
     */
    dbconn.db.query("insert into " + paras.command.tableName + "(" + f.join(',') + ") values(" + s.join(',') + ");", p, function (err, result) {
        if (err) {
            console.log(err);
            cb(err);
        } else {
            /**
             * 检测是否添加成功
             * 返回：新增的实体对象
             */
            cb(null, paras.insertion);
        }
    });

}

/**
 * 批量新增操作
 * @param paras 新增参数配置
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-07-10
 */
m.insertionBatch = function (paras, cb) {
    /**
     * 参数处理
     * p：参数值集合，f字段名称集合，s占位参数符号
     */
    var p = [], f = [], s = [];
    /**
     * 这是个数组，数组内部是实体对象的字段
     * 需要双重遍历
     */
    for (var i in paras.insertion) {
        var s2 = [];
        for (var j in paras.insertion[i]) {
            if (i == 0) {
                //字段名称集合，大于0就不需要继续了
                f.push(j);
            }
            //参数值
            p.push(paras.insertion[i][j]);
            //sql参数化处理符合
            s2.push('?');
        }
        //置入
        s.push('(' + s2.join(',') + ')');
    }
    console.log("insert into " + paras.command.tableName + "(" + f.join(',') + ") values" + s.join(',') + ";");

    /**
     * 执行sql以及参数
     */
    dbconn.db.query("insert into " + paras.command.tableName + "(" + f.join(',') + ") values" + s.join(',') + ";", p, function (err, result) {
        if (err) {
            console.log(err);
            cb(err);
        } else {
            /**
             * 检测是否添加成功
             * 返回：新增的实体对象
             */
            cb(null, paras.insertion);
        }
    });

}

/**
 * 更新操作，这个更新方法更加灵活
 * 这个方法参数定义比较复杂，了解的实现原理再使用
 * @param paras 新增参数配置
 * @param cb 回调函数
 * author:zack zou
 * create time:2016-08-01
 */
m.updateBySenior = function (paras, cb) {

    /**
     * 特殊参数处理，防止全表更新
     */
    if (!paras.hasOwnProperty('keyword') || paras.keyword.length == 0) {
        /**
         * id等于空值，更新不成功，过滤错误参数导致的全表更新
         * //paras.keyword = [{"key": "id", "value": "", "logic": "and", "operator": "="}];
         */
        cb('paras.keyword更新条件（数组）必须存在条件');
        return;
    }

    /**
     * 参数处理
     */
    var p = command.getUpdateParameters(paras);
    console.log("update " + paras.command.tableName + " set " + p.set.join(',') + " where " + p.where);
    console.log(p.parameters);

    /**
     * 检测是否存在limit节点
     * paras.limit=1
     */
    var _limit = "";
    if (paras.limit && paras.hasOwnProperty('limit')) {
        /**
         * 必须两个值
         */
        _limit = " limit ?";
        p.parameters.push(paras.limit);
    }
    /**
     * SQL执行
     * 返回变更数据的记录行数
     */
    dbconn.db.query("update " + paras.command.tableName + " set " + p.set.join(',') + " where " + p.where + _limit, p.parameters, function (err, result) {
        if (err) {
            cb(err);
        } else {
            /**
             * 回调：返回数据变更记录行数以及其他参数
             * result.changedRows
             */
            cb(null, result);
        }
    });
}

module.exports = exports = m;

/************************************************************************************************************
 * 工具类方法
 * **********************************************************************************************************
 */
var tools = {};

/**
 * 获取任意数据表的字段结构数组
 * 注意：数据表中至少有一条数据才能导出表结构字段的数组
 * @param paras
 * @param cb
 */
tools.getConfigFields = function (paras, cb) {
    /**
     * paras.command.tableName 这个参数是动态取值
     * 其他参数自定义，这里只需要一条数据就行了
     */
    paras.start = 0;
    paras.length = 1;

    m.queryEntityList(paras, function (err, data) {
        if (err) {
            cb(err);
        }
        else {
            if (data.length == 0) {
                cb('数据表中没有数据，无法导出表结构');
            }
            else {
                /**
                 * 导出表结构
                 */
                var row = data.data[0];
                var result = [];
                //遍历字段
                for (var i in row) {
                    result.push(i + '');
                }
                /**
                 * 在最末尾的位置返回
                 */
                console.log(result);
                cb(null, result);
            }
        }
    });
}

/**
 * 工具类
 */
module.exports.tools = tools;





