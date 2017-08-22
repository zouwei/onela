/**
 * OFramework 统一底层架构
 * author:zack zou
 * create time:2017-03-23
 */
var async = require("async");
var ofInstance = require("./OFInstance.js");
//tools
var fs = require('fs');
var mustache = require("mustache");
// 加载编码转换模块
var iconv = require('iconv-lite');

/**
 * SQL模型ORM映射对象
 */
module.exports = service;
/**
 * 存储过程
 */
module.exports.proc = proc;
/**
 * 工具类
 */
module.exports.tools = tools;

/**
 * 内部方法，必须是通用的方法
 */
var m = {};


/**
 * ！！！非常关键的配置信息
 * 当前模块配置
 * 表配置：变量放到顶部，代码重用只需要更改头部的配置代码
 */

function Service(oodbc, _config) {
    this.instanceConfig = _config;
    this.databaseConfig = _config.database || "MySQL";
    //数据源
    this.oodbc = oodbc;
}
/**
 * 常规SQL的方式
 * @param _config SQL的配置结构
 * @param oodbc 数据源
 */
function service(oodbc, _config) {
    console.log('初始化配置OFramework', JSON.stringify(_config));
    console.log('this instanceof service====>', this instanceof service)
    if (_config === undefined) {
        throw new TypeError('Expected object for argument _config')
    }

    if (!(this instanceof Service)) {
        return new Service(oodbc, _config)
    }

    throw new TypeError('Expected object for argument _config');
}

function Proc(oodbc, _config) {
    console.log('初始化配置OFramework procedure', JSON.stringify(_config));
    this.instanceConfig = _config;
    this.databaseConfig = _config.database || "MySQL";
    //数据源
    this.oodbc = oodbc;
}
/**
 * 存储过程的结构
 * @param _config 存储过程的配置结构
 */
function proc(_config, oodbc) {
    //初始化配置
    if (!(this instanceof Proc)) {
        return new Proc(_config, oodbc);
    }
}

function Tools(oodbc, _config) {
    //初始化配置
    console.log('初始化配置OFramework tools', JSON.stringify(_config));
    this.instanceConfig = _config;
    this.databaseConfig = _config.database || "MySQL";
    //数据源
    this.oodbc = oodbc;
}
/**
 * 工具类
 * @param oodbc 数据源
 * @param _config SQL的配置结构
 * @returns {tools}
 */
function tools(oodbc, _config) {
    if (!(this instanceof Tools)) {
        return new Tools(oodbc, _config);
    }
}

/**
 * s.1 分页查询用户账户信息
 * @param paras 参数集合，任意参数的组合
 * 参数 结构
 * {
 *   start: 开始数据索引
 *   length: 获取数据行数
 *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
 *   keyword:
 *     [
         {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
         {"key": "valid", "value": "1"}
      ]
      limit:[0,10]
 * }
 * 返回:{
     data: [],                  //数据列表
     recordsTotal: 0,           //查询记录总数
     start: 0,                  //当前页索引
     pageSize: 10                  //页大小
  }
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.getEntityList = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.getEntityList(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * s.2 查询瀑布数据列表，不返回记录总数，当返回的isLastPage=true，查询到了末尾
 * 查询记录length，查询可以length+1，前台数据只显示length的记录，判断尾页，利用length+1判断，小于等于length的记录到了末尾页面
 * @param paras 关键参数：paras.command、paras.keyword、paras.orderBy
 * 参数 结构
 * {
 *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
 *   keyword:
 *     [
         {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
         {"key": "valid", "value": "1"}
      ],
      limit:[0,10]          //[开始位置,查询数据个数]
 * }
 * 返回:{
     data: [],                  //数据列表
     isLastPage:false,          //当前页是否为最后页
     start: 0,                  //当前页索引
     pageSize: 10                 //页大小
  }
 * author:zack zou
 * create time:2016-06-27
 */
Service.prototype.getEntityListByWaterfall = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.getEntityListByWaterfall(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * s.3 根据动态参数条件查询数据实体对象
 * @param paras.id 主键id
 * 参数 结构
 * {
 *   orderBy:{"字段名":"规则（ASC|DESC）"  字段名:默认为 createtime  规则:默认为 DESC }
 *   keyword:
 *     [
 *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"},
 *        {"key": "valid", "value": "1"}
 *     ],
 *     limit:[0,1]          //[开始位置,查询数据个数]
 * }
 * 返回:[]
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.getEntity = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.getEntity(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });

    });
}

/**
 * s.4 新增用户信息
 * @param paras 参数
 * 参数 结构
 * {
 *      //新增主键id，可缺省，自动赋值，也可以补全id值
 *      “字段1”:"值"
 *      “字段1”:"值"
 *      ...
 * }
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.insertEntity = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.insertEntity(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });

    });
}

/**
 * s.5 批量新增数据
 * @param paras 实体列表数组
 * 参数结构
 * [{
 *      //新增主键id，可缺省，自动赋值，也可以补全id值
 *      “字段1”:"值"
 *      “字段1”:"值"
 *      ...
 * }]
 * author:zack zou
 * create time:2017-01-10
 */
Service.prototype.insertBatch = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.insertBatch(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (result) {
                resolve(result);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * s.6 修改实体信息，可以进行运算的字段的更新（加减）
 * @param paras 参数（限制字段类型为数字类型）
 * 参数结构
 {
     "update": [
         //字段：替换更新
         {"key": "字段1", "value": '值', "operator": "replace"},
         //字段：累加（数值类型）
         {"key": "字段2", "value": 1, "operator": "plus"},
         //字段：累减（数值类型）
         {"key": "字段3", "value": 1, "operator": "reduce"}
     ],
     "keyword": [
        //where条件：一般以主键id作为更新条件，支持多条件组合语句
        {"key": "条件字段1", "value": '值', "logic": "and", "operator": "="}
     ]
 }
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.updateBySenior = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.updateBySenior(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * s.7 批量更新数据
 * @param data 实体列表数组
 * 参数结构
 {
    "keyword": [
        {"key": "查询条件1", "value": "值", "logic": "and", "operator": "="},
        {"key": "查询条件2", "value": "值", "logic": "and", "operator": "="},
        {"key": "查询条件3", "value": "值", "logic": "and", "operator": "="}
    ],
    "orderBy": {"排序字段（created_time）": "DESC"},
    "sumField": "sum求和字段（数值类型）";
 }
 *
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.updateBatchBySenior = function (data) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 批量更新，这个方式是采用遍历数据单条记录更新的方式（不合适大批量的数据更新）
         */
        var index = 0;

        async.whilst(
            function () {
                return index < data.length;
            },
            function (callback) {
                /**
                 * 更新
                 */
                m.updateBySenior(oodbc, databaseConfig, instanceConfig, data[index])
                    .then(function (result) {
                        //更新索引
                        index++;
                        return callback(null, null);
                    })
                    .catch(function (err) {
                        //更新索引
                        console.log("更新" + index + "条信息出错");
                        index++;
                        return callback(null, null);
                    });
            },
            function (err) {
                /**
                 * 返回结果
                 */
                if (err) {
                    reject(err);
                } else {
                    /**
                     * 返回结果数据
                     */
                    resolve(data);
                }
            });
    });
}

/**
 * s.8 获取统计信息，count统计
 * @param paras 参数集合，任意参数的组合
 * 参数结构
 {
    "keyword": [
        {"key": "查询条件1", "value": "值", "logic": "and", "operator": "="},
        {"key": "查询条件2", "value": "值", "logic": "and", "operator": "="},
        {"key": "查询条件3", "value": "值", "logic": "and", "operator": "="}
    ],
    "orderBy": {"排序字段（created_time）": "DESC"},
    "aggregate":[{"count": "money"}]
 }
 * author:zack zou
 * create time:2016-09-01
 */
Service.prototype.getEntityByAggregate = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.getEntityByAggregate(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * s.9 物理删除数据实体对象
 * @param paras 删除条件模型
 * 参数 结构
 * {
 *   keyword:
 *     [
 *        {"key": "字段名", "value":"值", "logic": "连接联符 （默认为and 非必须 ）", operator: "关联符号 (默认为: = 可以为空)"}
 *     ]
 * }
 * author:zack zou
 * create time:2017-04-06
 */
Service.prototype.deleteEntity = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        m.deleteEntity(oodbc, databaseConfig, instanceConfig, paras)
            .then(function (result) {
                resolve(result);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/************************************************************************************************************
 * 储存过程
 * **********************************************************************************************************
 */

/**
 * p.1 存储过程执行方式
 * @param paras 执行存储过程需要的参数
 */
Proc.prototype.call = function (paras) {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义存储过程名称
         * 请注意：存储过程名称配置在此数据层的方法体内部，一个方法对照一个存储过程的名称，标准化的存储过程名称可批量定制
         * paras 直接转换成为参数集合的keyword值
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras = {
            "proc_name": instanceConfig.proc_name,
            "keyword": paras
        }
        //取配置信息，每个存储过程由BDA在配置节点定义（相当于开发文档，又是程序中间件）
        //直接使用初始化的这个配置
        paras.config = instanceConfig;
        /**
         * 执行存储过程
         */
        ofInstance(oodbc, databaseConfig, _instance).call(paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}


/************************************************************************************************************
 * 工具类方法
 * **********************************************************************************************************
 */

//工具类的内容方法
var t = {
    /**
     * 获取任意数据表的字段结构数组
     * 注意：数据表中至少有一条数据才能导出表结构字段的数组
     * @param paras
     */
    "getConfigFields": function (oodbc, databaseConfig, instanceConfig) {
        //
        return new Promise(function (resolve, reject) {
            /**
             * 其他参数自定义，这里只需要一条数据就行了
             */
            var condition = {
                "keyword": [],
                "limit": [0, 1]
            };
            //执行数据请求
            m.getEntityListByWaterfall(oodbc, databaseConfig, instanceConfig, condition)
                .then(function (data) {
                    console.log(data);
                    if (data.data.length == 0) {
                        reject('数据表中没有数据，无法导出表结构');
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
                        resolve(result);
                    }
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    },
    /**
     * 获取表名称列表
     */
    "findTableNames": function (oodbc, _config) {
        _config = _config || {};
        //参数
        var databaseConfig = _config.databaseConfig || "MYSQL";
        var instanceConfig = {
            "instance": _config.instance || "DEFAULT",
            "tableName": "information_schema.tables"
        }
        var paras = {
            "select": ['t.table_name', 't.table_schema'],
            "keyword": [{"logic": "and", "key": "table_type", "operator": "=", "value": "base table"}]
        }

        return new Promise(function (resolve, reject) {
            //数据请求
            m.getEntity(oodbc, databaseConfig, instanceConfig, paras)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    },
    /**
     * 循环遍历表列表，自动初始化配置文件
     */
    "loop": function (oodbc, fieldConfig, list) {
        //配置结果参数
        return new Promise(function (resolve, reject) {

            var index = 0;
            //循环遍历
            async.whilst(
                function () {
                    return index < list.length;
                },
                function (callback) {
                    /**
                     * 参数，查询单表记录
                     */
                    var item = list[index];
                    console.log('数据行：', JSON.stringify(item))
                    var databaseConfig = "MYSQL";
                    var instanceConfig = {
                        "instance": "DEFAULT",
                        "tableName": item.table_name
                    }
                    //更新索引
                    index++;
                    //获取表结构
                    t.getConfigFields(oodbc, databaseConfig, instanceConfig)
                        .then(function (data) {
                            /**
                             * 如果表内部没有数据怎么办？暂时不处理
                             */
                            if (data.length > 0) {

                                fieldConfig.tables[item.table_name] = {
                                    "database": databaseConfig,
                                    "instance": instanceConfig.instance,
                                    "tableName": item.table_name,
                                    "tableFiles": data
                                }
                            }
                            return callback(null, null);
                        })
                        .catch(function (ex) {
                            console.log('出现异常', ex);
                            return callback(null, null);
                        });
                },
                function (err) {
                    //更新索引
                    index++;
                    resolve(fieldConfig);
                });
        });
    },
    /**
     * 读取代码模块
     */
    "get_template": function (path) {
        return new Promise(function (resolve, reject) {
            //容错判断没有做，可能存在文件存在，里面没有JSON结构的情况
            try {
                fs.readFile(path, function (err, text) {
                    if (err) {
                        console.log(err);
                        reject("模板配置不存在");
                    }
                    else {
                        //这里可能出现错误的情况，暂时不考虑了
                        resolve(text.toString());
                    }
                });
            }
            catch (ex) {
                console.log(ex);
                reject("出现异常", ex);
            }
        });
    }

};

/**
 * 获取任意数据表的字段结构数组
 * 注意：数据表中至少有一条数据才能导出表结构字段的数组
 * @param paras
 */
Tools.prototype.getConfigFields = function () {
    //参数
    var databaseConfig = this.databaseConfig;
    var instanceConfig = this.instanceConfig;
    //数据源
    var oodbc = this.oodbc;
    //查询表数据字段
    return new Promise(function (resolve, reject) {
        t.getConfigFields(oodbc, databaseConfig, instanceConfig)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (ex) {
                reject(ex);
            });
    });
}

/**
 * 初始化数据库配置文件
 * 自动化更新
 */
Tools.prototype.initConfigFile = function (_config, file_path) {
    /**
     * 1.读取文件，没有文件就创建文件
     * 2.查询数据库表名称列表
     * 3.遍历数据列表，请求表内第一条数据
     * 4.获取到这个表的数据列结构信息
     * 5.追加到配置文件的json，直至遍历结束
     * 6.写入文件（如果文件存在则更新table节点），只更新和新增配置，不做删除
     */
        //数据源
    var oodbc = this.oodbc;
    /**
     * 读取配置文件
     * @param file 文件路径
     * @returns {Promise}
     */
    var read = function (file) {
        return new Promise(function (resolve, reject) {
            //文件是否存在
            fs.access(file, function (err) {
                if (err) {
                    //没有找到文件
                    resolve({
                        "tables": {},
                        "proc": {}
                    });
                }
                else {
                    console.log('读取配置文件');
                    //容错判断没有做，可能存在文件存在，里面没有JSON结构的情况
                    fs.readFile(file, function (err, data) {
                        if (err) {
                            resolve({
                                "tables": {},
                                "proc": {}
                            });
                        }
                        else {
                            //这里可能出现错误的情况，暂时不考虑了
                            resolve(JSON.parse(data));
                        }
                    });
                }
            });
        });
    }

    return new Promise(function (resolve, reject) {
        // var paras = {
        //     "file": "./config/OFInstanceConfig.json",
        // }
        //需要手动指定文件输出路径
        var fieldConfig = null;
        //文件是否存在
        read(file_path)
            .then(function (data) {
                //读取到了配置文件
                fieldConfig = data;
                //读取数据库名称列表
                return t.findTableNames(oodbc, _config);
            })
            .then(function (tabels) {
                //遍历数据库名称列表
                return t.loop(oodbc, fieldConfig, tabels);
            })
            .then(function (data) {
                /**
                 * 遍历结束，保存文件
                 */
                console.log('开始写入文件');
                var writeStream = fs.createWriteStream(file_path);
                writeStream.write(JSON.stringify(data, null, 4), function (err) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        //完成操作
                        console.log('OFInstanceConfig.json文件初始化完成');
                        writeStream.end();
                        resolve('OFInstanceConfig.json文件初始化完成');
                    }
                });
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 批量创建管理后台代码
 * 自动化批量生产代码
 * @param _config
 * @param paras 参数集合
 * {
 *      "path":"./core/com/",           //输出文件路径，指向到目录即可，结尾“/”
 *      "directory":"core",             //数据层输入目录名称
 * }
 */
Tools.prototype.initManagementMethodFile = function (_config, paras) {
    /**
     * 1.读取文件，没有文件就创建文件
     * 2.查询数据库表名称列表
     * 3.遍历数据列表，请求表内第一条数据
     * 4.获取到这个表的数据列结构信息
     * 5.追加到配置文件的json，直至遍历结束
     * 6.写入文件（如果文件存在则更新table节点），只更新和新增配置，不做删除
     */
        //数据源
    var oodbc = this.oodbc;

    /**
     * 读取配置文件
     * @param file 文件路径
     * @returns {Promise}
     */
    var read = function (file) {
        return new Promise(function (resolve, reject) {
            //文件是否存在
            fs.access(file, function (err) {
                if (err) {
                    /**
                     * 没有找到文件
                     */
                    resolve();
                }
                else {
                    console.log('找到文件，跳出执行，不替换代码');
                    //容错判断没有做，可能存在文件存在，里面没有JSON结构的情况
                    reject("该文件已经存在了~");
                }
            });
        });
    }
    /**
     * 遍历表配置
     */
    var loop = function (_template, new_param, list) {
        //配置结果参数
        return new Promise(function (resolve, reject) {
            //开始位置
            var index = 0;
            //循环遍历
            async.whilst(
                function () {
                    console.log('index>>>', index, list.length, (index < list.length));
                    return (index < list.length);
                },
                function (callback) {
                    /**
                     * 参数，查询单表记录
                     */
                    var item = list[index];
                    console.log('数据行：', JSON.stringify(item))
                    var databaseConfig = "MYSQL";
                    var instanceConfig = {
                        "instance": "DEFAULT",
                        "tableName": item.table_name
                    }
                    //更新索引
                    index++;
                    console.log('item.table_name>>>', item.table_name);
                    console.log('index>>>', index, list.length);
                    t.getConfigFields(oodbc, databaseConfig, instanceConfig)
                        .then(function (data) {
                            /**
                             * 如果表内部没有数据怎么办？暂时不处理
                             */
                            if (data.length > 0) {
                                //输出配置更新，根据表名更新
                                new_param.output_path = new_param.path.replace('.', '') + item.table_name + "/";
                                console.log(" new_param.output_path ", new_param.output_path);
                                new_param.tableFullName = item.table_name;
                                new_param.prefix = "one";
                                new_param.tableName = item.table_name;
                                //通过下划线分割
                                var ts = item.table_name.split('_');
                                if (ts.length > 1) {
                                    //前缀小写
                                    new_param.prefix = ts[0].toLowerCase();
                                    //名称，首字母大写
                                    new_param.tableName = ts[1].substr(0, 1).toUpperCase() + ts[1].substr(1);
                                }

                                //输出文件路径
                                var file_path = new_param.path + item.table_name + ".js";
                                console.log('输入文件路径验证', file_path);
                                //输出判断
                                read(file_path)
                                    .then(function (file_exists) {
                                        if (!file_exists) {
                                            console.log('开始写入文件', item.table_name, '.js');
                                            //创建文件

                                            //替换模板
                                            var text = mustache.render(_template, new_param);
                                            // appendFile，如果文件不存在，会自动创建新文件
                                            // 如果用writeFile，那么会删除旧文件，直接写新文件
                                            // 把中文转换成字节数组
                                            text = text.replace(/&#x2F;/g, '/');
                                            var arr = iconv.encode(text, 'utf-8');
                                            fs.appendFile(file_path, arr, function (err) {
                                                if (err) {
                                                    console.log('写入文件出错', err);
                                                    return callback(null, null);
                                                }
                                                else {
                                                    //完成操作
                                                    console.log('开始写入文件', item.table_name, '.js写入完成');
                                                    //跳出执行
                                                    return callback(null, null);
                                                }
                                            });
                                        }
                                        else {
                                            console.log('文件存在，跳出执行');
                                            return callback(null, null);
                                        }
                                    })
                                    .catch(function (ex) {
                                        console.log('出现异常', ex);
                                        return callback(null, null);
                                    });
                            }
                            else {
                                //跳出执行
                                return callback(null, null);
                            }
                        });
                })
                .catch(function (err, result) {
                    //更新索引
                    console.log('任务遍历完成');
                    return resolve("任务遍历完成");
                });
        });
    }

    return new Promise(function (resolve, reject) {
        /**
         * 配置
         * */
        var p = {
            "path": paras.path,
            "directory": paras.directory || "core",                 //文件引入目录
            "output_path": paras.path.replace(/./g, ''),
            "protocol": paras.protocol || "http",
            "host": paras.host || "localhost",
            "create_time": (new Date()).toDateString(),
            "author": paras.author || "onela",
            // "tableName": "",           //首字母大写
            // "tableFullName": "",        //表名称全称
            // "prefix": ""                //前缀
        }

        //需要手动指定文件输出路径
        var fieldConfig = null;
        //模块
        var _template = "";

        //文件是否存在
        var template_path = __dirname + "\\template\\control.ejs";
        console.log('文件路径', template_path);
        console.log('请求文件路径：', template_path);
        t.get_template(template_path)
            .then(function (template) {
                //读取到了配置文件
                _template = template;
                console.log('配置文件>>', _template);
                //读取数据库名称列表
                return t.findTableNames(oodbc, _config);
            })
            .then(function (tabels) {
                //遍历数据库名称列表
                return loop(_template, p, tabels);
            })
            .then(function (data) {
                /**
                 * 遍历结束，保存文件
                 */
                console.log('写入文件结束');
                resolve("写入文件结束");
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 *
 * @param name
 * @param tp
 * @param cb
 * @returns {string}
 */
var record = {};

/**
 * 生成主键
 * @param name
 * @param tp
 * @param cb
 * @returns {string}
 */
m.getID = function (name, tp, cb) {
    //console.log(name);
    var buf = new Buffer(12);
    var host = 1;//process.env.RISKEYS_HOST;
    var pid = process.pid;
    var time = Math.round((new Date).getTime() / 1000);

    if (record[name] == null) record[name] = {time: 0, seq: 0};
    //console.log(record[name].time,time);
    if (record[name].time != time) {
        record[name].time = time;
        record[name].seq = 0;
    } else {
        record[name].seq++;
    }
    var seq = record[name].seq;
    var pname = name + "\0";
    buf.write(pname, 0, 2);
    // buf.writeUInt8(name.charCodeAt(0));
    //buf.writeUInt8(name.charCodeAt(1),1);
    buf.writeUInt16LE(host, 2);
    buf.writeUInt16LE(pid & 0xffff, 4);
    buf.writeUInt32LE(time, 6);
    buf.writeUInt16LE(seq, 10);
    var id = buf.toString("hex").toUpperCase();

    if (cb) cb(id);
    else return id;

};

/************************************************************************************************************
 * 通用方法
 * **********************************************************************************************************
 */
m.getEntityList = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras.command = {
            //查询的表名
            "tableName": instanceConfig.tableName,
        };
        /**
         * 兼容性修复，用limit替换之前的start、length参数
         */
        if (!paras.hasOwnProperty("limit") && paras.hasOwnProperty("start") && paras.hasOwnProperty("length")) {
            paras.limit = [paras["start"], paras["length"]];
        }
        if (paras.hasOwnProperty("limit")) {
            //如果limit里面参数个数不符合
            if (paras.limit.length == 1) {
                paras.limit = [0, paras.limit[0]];       //默认10个
            }
            //这里处理
            paras.limit[0] = parseInt(paras.limit[0]);
            //长度
            paras.limit[1] = parseInt(paras.limit[1]);
        }

        /**
         * 执行数据查询，数据库分页查询，queryEntityList底层通用
         * 对应结果直接返回
         */
        ofInstance(oodbc, databaseConfig, _instance).queryEntityList(paras)
            .then(function (data) {
                /**
                 * 开始位置、pageSize
                 */
                data.start = paras.limit[0];
                data.pageSize = paras.limit[1];
                //返回结构
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 查询瀑布数据列表，不返回记录总数
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 * @returns {Promise}
 */
m.getEntityListByWaterfall = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras.command = {
            //查询的表名
            "tableName": instanceConfig.tableName
        };
        /**
         * 兼容性修复，用limit替换之前的start、length参数
         */
        if (!paras.hasOwnProperty("limit") && paras.hasOwnProperty("start") && paras.hasOwnProperty("length")) {
            paras.limit = [paras["start"], paras["length"]];
        }
        if (paras.hasOwnProperty("limit")) {
            //如果limit里面参数个数不符合
            if (paras.limit.length == 1) {
                paras.limit = [0, paras.limit[0]];       //默认10个
            }
            //这里处理
            paras.limit[0] = parseInt(paras.limit[0]);
            //长度+1
            paras.limit[1] = parseInt(paras.limit[1]) + 1;
        }

        /**
         * 执行数据查询，数据库分页查询，queryEntityList底层通用
         * 对应结果直接返回
         */
        ofInstance(oodbc, databaseConfig, _instance).queryWaterfallList(paras)
            .then(function (data) {
                /**
                 * 获取到了分页数据
                 * 检测是否为最后一页数据
                 * 查询结果行数删除末尾一条数据
                 */
                data.isLastPage = false;
                if (data.data.length < (paras.limit[1] - 1)) {
                    //最后一页数据
                    data.isLastPage = true;
                }
                else {
                    //记录数等于length+1，删除最后一条数据
                    if (data.data.length > (paras.limit[1] - 1))
                        data.data.pop();
                }
                /**
                 * 开始位置
                 * pageSize减去1
                 */
                data.start = paras.limit[0];
                data.pageSize = paras.limit[1] - 1;
                //数据返回
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 根据动态参数条件查询数据实体对象（定义内部通用方法）
 * 主要是底层数据方法
 */
m.getEntity = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras.command = {
            //查询的表名
            "tableName": instanceConfig.tableName,
        };

        /**
         * 兼容性修复，用limit替换之前的start、length参数
         */
        if (!paras.hasOwnProperty("limit") && paras.hasOwnProperty("start") && paras.hasOwnProperty("length")) {
            paras.limit = [paras["start"], paras["length"]];
        }
        if (paras.hasOwnProperty("limit")) {
            //如果limit里面参数个数不符合
            if (paras.limit.length == 1) {
                paras.limit = [0, paras.limit[0]];       //默认10个
            }
            //这里处理
            paras.limit[0] = parseInt(paras.limit[0]);
            //长度
            paras.limit[1] = parseInt(paras.limit[1]);
        }

        /**
         * 执行数据查询，数据库分页查询，queryEntityList底层通用
         * 对应结果直接返回
         * ORM底层实例
         */
        ofInstance(oodbc, databaseConfig, _instance).queryEntity(paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 新增用户信息
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 */
m.insertEntity = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * ：：以下代码重用时不需要更改，特殊情况除外
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        var p = {
            "command": {
                //查询的表名
                "tableName": instanceConfig.tableName,
            },
            "insertion": {}
        };

        /**
         * 自动创建主键
         * 如果未指定主键，则使用
         */
        m.getID('A', null, function (id) {
            /**
             * 主键检测
             */
            if (!paras.hasOwnProperty('id') || paras.id == null) {
                paras.id = id;
            }
            /**
             * 参数封装：insert表字段从字段配置表中遍历
             * 每个表的字段不一致，封装的参数直接拼接成insert语句的SQL，请注意字段名称必须是同数据库字段名称一致的
             * 不用参数遍历，这里手动指定
             */
            for (var i = 0; i < instanceConfig.tableFiles.length; i++) {
                /**
                 * 字段多少、字段的排序，以配置结构为准
                 */
                if (paras.hasOwnProperty(instanceConfig.tableFiles[i])) {
                    p.insertion[instanceConfig.tableFiles[i]] = paras[instanceConfig.tableFiles[i]];
                }
            }
            /**
             * 参数默认值处理
             */
            //创建时间
            if (p.insertion['created_time'] && p.insertion['created_time'] == null) {
                p.insertion['created_time'] = new Date();
            }
            //最近更新时间
            if (p.insertion['update_time'] && p.insertion['update_time'] == null) {
                p.insertion['update_time'] = new Date();
            }
            //是否有效（0无效；1有效）
            if (p.insertion['valid'] && p.insertion['valid'] == null) {
                p.insertion['valid'] = 1;
            }

            /**
             * 执行SQL，底层方法通用，配置好了参数集合列表底层自动完成
             */
            ofInstance(oodbc, databaseConfig, _instance).insertion(p)
                .then(function (data) {
                    resolve(data);
                })
                .catch(function (err) {
                    reject(err);
                });
        });
    });
}

/**
 * 批量新增数据
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 */
m.insertBatch = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * ：：以下代码重用时不需要更改，特殊情况除外
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        var p = {
            "command": {
                //查询的表名
                "tableName": instanceConfig.tableName,
            },
            "insertion": []         //这是个数组
        };

        /**
         * 遍历结果集
         */
        for (var i in paras) {
            //数据项
            var item = paras[i];
            //新增实体
            var _target = {};
            //id规则
            if (!item.hasOwnProperty('id') || item.id == null) {
                item.id = m.getID('A', null, null);
            }
            console.log('item', JSON.stringify(item));
            /**
             * 参数封装：insert表字段从字段配置表中遍历
             * 每个表的字段不一致，封装的参数直接拼接成insert语句的SQL，请注意字段名称必须是同数据库字段名称一致的
             * 不用参数遍历，这里手动指定
             */
            for (var f in item) {
                for (var j = 0; j < instanceConfig.tableFiles.length; j++) {
                    /**
                     * 字段多少、字段的排序，以配置结构为准
                     */
                    if (item.hasOwnProperty(instanceConfig.tableFiles[j])) {
                        _target[instanceConfig.tableFiles[j]] = item[instanceConfig.tableFiles[j]];
                    }
                }
            }
            /**
             * 参数默认值处理
             */
            //创建时间
            if (_target['created_time'] && _target['created_time'] == null) {
                _target['created_time'] = new Date();
            }
            //最近更新时间
            if (_target['update_time'] && _target['update_time'] == null) {
                _target['update_time'] = new Date();
            }
            //是否有效（0无效；1有效）
            if (_target['valid'] && _target['valid'] == null) {
                _target['valid'] = 1;
            }
            p.insertion.push(_target);

        }
        /**
         * 执行SQL，底层方法通用，配置好了参数集合列表底层自动完成
         */
        ofInstance(oodbc, databaseConfig, _instance).insertionBatch(p)
            .then(function (result) {
                resolve(result);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 修改实体信息
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 */
m.updateBySenior = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        var p = {
            "command": {
                //查询的表名
                "tableName": instanceConfig.tableName,
            },
            /**
             * 累加
             */
            "update": paras["update"],
            /**
             * 更新的where条件
             */
            "keyword": paras.keyword
        };
        // /**
        //  * 默认参数配置
        //  */
        // p.update.push({"key": "update_time", "value": new Date(), "operator": "="});
        /**
         * 执行sql
         */
        ofInstance(oodbc, databaseConfig, _instance).updateBySenior(p)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 聚合函数的应用
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 */
m.getEntityByAggregate = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 条件判断
         */
        if (!paras.aggregate || paras.aggregate.length == 0) {
            reject("缺少aggregate参数，数组参数，长度大于0");
            return;
        }
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras.command = {
            //查询的表名
            "tableName": instanceConfig.tableName
        };

        /**
         * 执行数据查询，数据库分页查询，statsByCount底层通用
         * 对应结果直接返回
         */
        ofInstance(oodbc, databaseConfig, _instance).statsByAggregate(paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * 物理删除实体信息
 * 注意：请谨慎使用该方法，因为会时数据物理删除
 * @param databaseConfig
 * @param instanceConfig
 * @param paras
 */
m.deleteEntity = function (oodbc, databaseConfig, instanceConfig, paras) {
    //定义结构
    return new Promise(function (resolve, reject) {
        /**
         * 定义SQL命令参数
         * 不同的业务表，只需要配置参数实现对应的数据查询，底层代码通用
         * 参数：paras.command
         */
        var _instance = instanceConfig.instance || "DEFAULT";      //数据库配置实例节点名称
        paras.command = {
            //查询的表名
            "tableName": instanceConfig.tableName
        };

        /**
         * 物理删除，根据
         */
        ofInstance(oodbc, databaseConfig, _instance).deleteEntity(paras)
            .then(function (data) {
                resolve(data);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}