/**
 * 【老版本兼容，新版本弃用】
 * 通用模块-命令行参数处理
 * author:zack zou
 * create time:2016-06-27
 */
var oParameters = require("./grammar/mysql.js");


/**
 * 数据库实例对象
 */
function Service(oodbc, _database, _instance) {
    //数据库标签识别，如果没有标识默认使用MYSQL
    var database = _database || "MYSQL";
    database = database.toUpperCase();
    this.database = database;
    var source = oodbc[database];
    //判断数据库识别
    if (source) {
        //实例识别
        var dbsource = source[_instance.toUpperCase()];
        if (dbsource) {
            //识别正确，返回数据源实例对象，读写分离的实例一起返回
            this.db = dbsource;
        }
        else {
            // 数据源实例配置节点识别错误，请检查{0}节点是否存在
            console.log('Data source instance configuration node identification error, please check whether the ' + _instance.toUpperCase() + ' node exists');
            throw new TypeError('Data source instance configuration node identification error, please check whether the ' + _instance.toUpperCase() + ' node exists');
        }
    }
    else {
        // 数据源实例配置节点识别错误，请检查{0}节点是否存在
        console.log('Data source instance configuration node identification error, please check whether the ' + this.database.toUpperCase() + ' node exists');
        throw new TypeError('Data source instance configuration node identification error, please check whether the ' + this.database.toUpperCase() + ' node exists');
    }
}

/**
 * 数据库实例
 * @param database 数据库名称
 * @param instance
 * @returns {Promise}
 */
function service(oodbc, _database, _instance) {

    if (!(this instanceof Service)) {
        return new Service(oodbc, _database, _instance);
    }
}


/**
 * 数据库实例命令执行（高频执行）
 * 读写实例走这一个对象
 * @param instance 数据库实例对象
 * @param sql 执行的SQL
 * @param parameters 参数
 * @returns {Promise}
 */
var execute = function (instance, sql, parameters) {
    return new Promise(function (resolve, reject) {
        //执行对数据库的访问
        console.time('【onela】SQL execution time'); // 【onela】执行SQL时间
        //console.log('执行sql', sql, '参数', parameters);
        if (instance) {
            instance.query(sql, parameters, function (err, doc) {
                console.timeEnd('【onela】SQL execution time'); // 【onela】执行SQL时间
                if (err) {
                    reject(err);
                }
                else {
                    resolve(doc);
                }
            });
        }
        else {
            // 数据库instance实例未正确指向，请检查oodbc数据实例配置和表结构配置（onelaInstanceConfig.json）的实例对照是否正确
            reject("The database instance is not pointed correctly. Please check whether the instance comparison between the oodbc data instance configuration and the table structure configuration (onelaInstanceConfig.json) is correct.");
        }
    });
}


/**
 * 查询瀑布数据列表，不返回记录总数，当返回的记录数小于每页显示记录数时，查询到了末尾
 * 查询记录length，查询可以length+1，前台数据只显示length的记录，判断尾页，利用length+1判断，小于等于length的记录到了末尾页面
 * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
 * author:zack zou
 * create time:2017-03-22
 */
Service.prototype.queryWaterfallList = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 参数模型处理
                 */
                var p = oParameters.getParameters(paras);
                //瀑布流数据查询（单次数据查询）
                var sql = "select " + p["select"] + "  from " + paras.command.tableName + " as t " + p.where + " " + p.orderBy + p.limit + ";";
                //执行SQL
                execute(db['READER'], sql, p.parameters)
                    .then(function (doc) {
                        //定义返回数据结构
                        var data = {
                            data: doc,                          //数据列表
                        }
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                        reject(err);
                    });
            });
        }
    }

    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * 查询实体列表集合数据
 * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
 * author:zack zou
 * create time:2017-03-22
 */
Service.prototype.queryEntityList = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 */
                var p = oParameters.getParameters(paras);
                //变量定义
                var result = {
                    "data": [],                                         //数据列表
                    "recordsTotal": 0                                  //查询记录总数
                }
                /**
                 * 分页数据查询
                 */
                var sql = "select " + p["select"] + " from " + paras.command.tableName + " t " + p.where + " " + p.orderBy + p.limit + ";";
                //执行SQL
                execute(db['READER'], sql, p.parameters)
                    .then(function (doc) {
                        //数据绑定
                        result.data = doc;
                        //执行正确，接下来再执行记录总数查询
                        return execute(db['READER'], "select count(0) total from " + paras.command.tableName + " t " + p.where, p.parameters);
                    })
                    .then(function (counts) {
                        //执行成功，绑定记录数据
                        result.recordsTotal = counts[0].total;
                        //返回结构
                        resolve(result);
                    })
                    .catch(function (err) {
                        console.log('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                        reject(err);
                    });

            });
        }
    }

    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * SQL查询结果列表，根据参数返回符合条件的全部结果
 * @param paras 参数集合
 * author:zack zou
 * create time:2017-03-22
 */
Service.prototype.queryEntity = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 */
                var p = oParameters.getParameters(paras);
                //瀑布流数据查询（单次数据查询）
                var sql = "select  " + p["select"] + " from " + paras.command.tableName + " as t " + p.where + p.orderBy + p.limit + ";";
                /**
                 * 执行SQL
                 * 根据制定条件获取查询数据列表
                 * 自由组合查询条件
                 */
                execute(db['READER'], sql, p.parameters)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                        reject(err);
                    });
            });
        }
    }

    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * 统计信息查询，count统计
 * @param paras 执行参数
 * @param paras.command.aggregate 统计字段
 * author:zack zou
 * create time:2016-08-12
 */
Service.prototype.statsByAggregate = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 */
                var p = oParameters.getParameters(paras);
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
                //sql
                var sql = "select " + show.join(',') + " from " + paras.command.tableName + " " + p.where + p.limit + ";";
                /**
                 * 执行SQL，进行统计查询
                 */
                execute(db['READER'], sql, p.parameters)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('Exception occurred when executing aggregation query', err); // 执行聚合查询出现异常
                        reject(err);
                    });

            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

//下面的方法是写入相关的操作

/**
 * 新增操作
 * @param paras 新增参数配置
 * author:zack zou
 * create time:2016-07-01
 */
Service.prototype.insertion = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
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
                var sql = "insert into " + paras.command.tableName + "(" + f.join(',') + ") values(" + s.join(',') + ");";
                /**
                 * 执行SQL
                 * 根据制定条件获取查询数据列表
                 * 自由组合查询条件
                 */
                execute(db['WRITER'], sql, p)
                    .then(function (data) {
                        //返回数据
                        resolve(paras.insertion);
                    })
                    .catch(function (err) {
                        console.log('An error occurred when executing execute query insert.', err); // 执行execute查询insert出错
                        reject(err);
                    });

            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * 批量新增操作
 * @param paras 新增参数配置
 * author:zack zou
 * create time:2016-07-10
 */
Service.prototype.insertionBatch = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
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
                            f.push("`" + j + "`");
                        }
                        //参数值
                        p.push(paras.insertion[i][j]);
                        //sql参数化处理符合
                        s2.push('?');
                    }
                    //置入
                    s.push('(' + s2.join(',') + ')');
                }
                //SQL执行
                var sql = "insert into " + paras.command.tableName + "(" + f.join(',') + ") values" + s.join(',') + ";";
                console.log(sql)
                execute(db['WRITER'], sql, p)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                        reject(err);
                    });
            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * 更新操作，这个更新方法更加灵活
 * 这个方法参数定义比较复杂，了解的实现原理再使用
 * @param paras 新增参数配置
 * author:zack zou
 * create time:2016-08-01
 */
Service.prototype.updateBySenior = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 * 特殊参数处理，防止全表更新
                 */
                if (!paras.hasOwnProperty('keyword') || paras.keyword.length == 0) {
                    /**
                     * id等于空值，更新不成功，过滤错误参数导致的全表更新
                     * //paras.keyword = [{"key": "id", "value": "", "logic": "and", "operator": "="}];
                     */
                    reject('`paras.keyword` update conditions (array) must exist conditions'); // paras.keyword更新条件（数组）必须存在条件
                    return;
                }
                /**
                 * 参数处理
                 */
                var p = oParameters.getUpdateParameters(paras);
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
                var sql = "update " + paras.command.tableName + " set " + p.set.join(',') + " where " + p.where + _limit + ";";
                execute(db['WRITER'], sql, p.parameters)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('An error occurred while executing execute operation updateBySenior', err); // 执行execute操作updateBySenior出错
                        reject(err);
                    });
            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}

/**
 * 物理删除实例对象，改方法慎用，建议采用逻辑删除
 * @param paras 新增参数配置
 * author:zack zou
 * create time:2017-04-06
 */
Service.prototype.deleteEntity = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 * 特殊参数处理，防止全表更新
                 */
                if (!paras.hasOwnProperty('keyword') || paras.keyword.length == 0) {
                    /**
                     * id等于空值，更新不成功，过滤错误参数导致的全表更新
                     * //paras.keyword = [{"key": "id", "value": "", "logic": "and", "operator": "="}];
                     */
                    reject('`paras.keyword` update conditions (array) must exist conditions'); // paras.keyword更新条件（数组）必须存在条件
                    return;
                }
                /**
                 * 参数处理
                 */
                var p = oParameters.getDeleteParameters(paras);

                /**
                 * SQL执行
                 * 返回变更数据的记录行数
                 */
                var sql = "delete from " + paras.command.tableName + " where " + p.where + ";";
                execute(db['WRITER'], sql, p.parameters)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('An error occurred during execute operation deleteEntity', err); // 执行execute操作deleteEntity出错
                        reject(err);
                    });

            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
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
 * author:zack zou
 * create time：2017-05-02
 */
Service.prototype.call = function (paras) {
    //参数
    var database = this.database;
    var db = this.db;
    /**
     * 数据工厂
     */
    var factory = {
        "MYSQL": function () {
            return new Promise(function (resolve, reject) {
                /**
                 * 业务模型处理
                 * 参数处理，数据库模式，支持多种数据库，目前写死mysql
                 * 存储过程基于不同类型数据库的架构支持，目前只做支持mysql的示例
                 * 代码预留位置
                 */
                paras.database = database.toUpperCase();          //'mysql';
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
                //遍历配置参数
                for (var j in paras.config.parameter) {
                    //参数类型
                    var item = paras.config.parameter[j];
                    //错误标记，临时变量
                    _error = false;
                    /**
                     * 输出参数，查看参数是否完全匹配
                     * 不在可传参数之列的参数，程序自动忽略
                     */
                    for (var i in paras.keyword) {
                        //匹配到字段定义：参数的类型可能会是多种情况 [in|out|inout]
                        if (item.name == i) {
                            if (item.hasOwnProperty('type') && item.type === 'in') {
                                //参数匹配，检测是参数类型
                                _self.values.push(paras.keyword[i]);     //@parameter value
                                _self.parameter.push('?');
                                _error = true;
                            }
                            else {
                                // 输入参数匹配
                                // 输出或者输入类型，对于直接调用的方式out或者inout不好用
                                _self.parameter.push(paras.symbol + item.name);
                                _error = true;
                            }
                        }
                    }

                    //发现错误
                    if (!_error) {
                        if (!item.mandatory) {           //非强制参数，应该存在默认值
                            //检测参数类型，是否为强制性参数
                            //参数类型未直接定义
                            if (item.hasOwnProperty('type') && item.type !== 'in') {
                                //未直接定义的out inout参数，另外一种情况就是存在默认值
                                _self.parameter.push(paras.symbol + item.name);
                            }
                            else {
                                //参数类型是in，但是参数是可选的情况，那么直接调用默认值，假如连这个默认值没有，直接抛错
                                if (item.hasOwnProperty('defaultValue')) {
                                    _self.values.push(item.name);               //使用默认值
                                    _self.parameter.push(item.defaultValue);
                                }
                                else {
                                    error.push(item);
                                }
                            }
                        }
                        else {
                            //强制参束未赋值，也没有默认值
                            error.push(item);
                        }

                    }
                }

                /**
                 * 是否错误抛出，说明未传入该参数，分两种情况，检测是否为强制参数
                 */
                if (error.length > 0) {
                    console.log('error', error);
                    reject("Parameter error"); // 参数错误
                    return;
                }
                /**
                 * 参数处理，支持不通类型数据库的业务处理（目前只固定处理mysql）
                 */
                //参数名（防止SQL注入，）
                _self.call = "call " + paras.proc_name + "(" + _self.parameter.join(',') + ");";

                /**
                 * 参数化处理完毕
                 * 执行存储过程
                 */
                execute(db['READER'], _self.call, _self.values)
                    .then(function (data) {
                        //返回数据
                        resolve(data);
                    })
                    .catch(function (err) {
                        console.log('An error occurred while executing execute query proc.', err);// 执行execute查询proc出错
                        reject(err);
                    });
            });
        }
    }
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 数据工厂
         */
        var workshop = factory[database];
        if (workshop) {
            workshop()
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        }
        else {
            // 非常抱歉，OFranmework目前对{0}数据库还未支持！
            reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
        }
    });
}


module.exports = service;