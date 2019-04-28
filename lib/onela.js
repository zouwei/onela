const { MySQLActionManager } = require("./instance/MySQLActionManager");
const { PostgreSQLActionManager } = require("./instance/PostgreSQLActionManager");
const { SQLiteActionManager } = require("./instance/SQLiteSQLActionManager");
const { SQLServerActionManager } = require("./instance/SQLServerActionManager");
// 老版本兼容
const Old = require("./OFramework");

/**
 * 负责多个database的管理，能够初始化数据库连接
 */
class Onela {

    /**
     * 数据库实例对象识别
     * @param db_type 数据类型
     * @returns {MySQLActionManager}
     */
    static getActionManagerClass(db_type) {
        switch (db_type.toLowerCase()) {
            case "mysql":
                return MySQLActionManager;
            case "postgresql":
                return PostgreSQLActionManager;
            case "sqlite":
                return SQLiteActionManager;
            case "sqlserver":
                return SQLServerActionManager;
            default:
                return null;
        }
    }

    /**
     * 数据库实例初始化（多类型多实例）
     * @param config_list
     */
    static init(config_list) {
        let self = this;
        for (let tempConfig of config_list) {
            let temp_am = self.getActionManagerClass(tempConfig.type);
            // 检测实例对象是否存在
            if (temp_am) {
                temp_am.init(tempConfig.value);
                self._connections[tempConfig.engine] = temp_am;
            }
            else {
                console.error("数据库实例类型", tempConfig.type, "不存在");
            }
        }
    }

    static getActionManager(engine) {
        let self = this;
        if (!(engine in this._connections)) {
            throw new Error(`invalid engine: ${engine}`);
        }
        return Promise.resolve(self._connections[engine]);
    }

    /**
     * 获取事务实例对象
     * @param name
     */
    static getActionTransaction(engine) {
        // 连接对象
        let self = this;
        // 检测链接池是否存在
        if (!(engine in this._connections)) {
            throw new Error(`invalid engine: ${engine}`);
        }

        // 获取事务对象
        return self._connections[engine].createTransaction()
            .then(connection => {
                return Promise.resolve(connection);
            })
            .catch(ex => {
                return Promise.reject(ex);
            });

    }
}

/**
 * 连接对象
 * 一般情况下需要一个数据库连接对象即可，onela在框架设计上直接支持多个不同类型的数据库同时创建连接
 * 事务只能在同一个connection对象里面才回生效
 */
Onela._connections = {};

/**
 * 模型的基类，负责该模型的crud基本操作
 */
class OnelaBaseModel {

    static getActionManager() {
        if (!(this.action_manager)) {
            this.action_manager = Onela.getActionManager(this.configs.engine);
        }

        return this.action_manager;
    }

    /**
     * 获取事务连接对象
     * @returns {*}
     */
    static transaction() {

        return new Promise((resolve, reject) => {
            Onela.getActionTransaction(this.configs.engine).then(connection => {
                // 默认自动开始事务执行
                // console.log('事务对象',connection.client)
                connection.begin(connection).then((connection2) => {
                    // 直接返回已经开始事务的连接池
                    resolve(connection2 || connection);
                });
            });
        });

    }

    /**
     * 查询实体对象
     * @param args 查询参数
     * {
     *    "select":["*"],          // select，默认查询*，可以指定输出特定的字段
     *    "where":[                // where，是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ],
     *    "orderBy":
     *      {
     *          "id":"DESC",        // 根据id排序，DESC降序排列，可选值：DESC、ASC；排序字段对照数据库表字段
     *          "valid":"ASC"       // 可组合排序
     *      },
     *     "limit":[0,10]          // limit，查询输出限制，0表示从条件模型中查询数据索引从0的位置开始查询，10表示一次性查询10条数据记录
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参
     * [                            // 查询结果数据列表
     *     {"id":"1","valid":1},
     *     {"id":"2","valid":1}
     *  ]
     */
    static getEntity(args, option) {
        let params = Object.assign({}, args);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager().then(_connection => {
            return _connection.queryEntity(params, option)
        });
    }

    /**
     * 获取实体对象列表
     * @param args 查询参数
     * {
     *    "select":["*"],          // select，默认查询*，可以指定输出特定的字段
     *    "where":[                 // where是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ],
     *    "orderBy":
     *      {
     *          "id":"DESC",        // 根据id排序，DESC降序排列，可选值：DESC、ASC；排序字段对照数据库表字段
     *          "valid":"ASC"       // 可组合排序
     *      },
     *      "limit":[0,10]          // limit，查询输出限制，0表示从条件模型中查询数据索引从0的位置开始查询，10表示一次性查询10条数据记录
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参
     * {
     *     "data":[                 // 查询结果数据列表
     *          {"id":"1","valid":1},
     *          {"id":"2","valid":1}
     *     ],
     *     "recordsTotal":4        // recordsTotal，查询结果记录总数
     * }
     */
    static getEntityList(args, option) {
        let params = Object.assign({}, args);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.queryEntityList(params, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 获取数据瀑布
     * @param params 查询参数
     * {
     *    "select":["*"],          // select，默认查询*，可以指定输出特定的字段
     *    "where":[                 // where是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ],
     *    "orderBy":
     *      {
     *          "id":"DESC",        // 根据id排序，DESC降序排列，可选值：DESC、ASC；排序字段对照数据库表字段
     *          "valid":"ASC"       // 可组合排序
     *      },
     *      "limit":[0,10]          // limit，查询输出限制，0表示从条件模型中查询数据索引从0的位置开始查询，10表示一次性查询10条数据记录
     * }
     * @param args 其他参数
     * @returns {Promise.<TResult>} 出参
     * {
     *     "data":[                 // 查询结果数据列表
     *          {"id":"1"},
     *          {"id":"2"}
     *     ],
     *     "isLastPage":false       // 当前数据库是否为查询条件结果的最后一页，false表示不是，true表示是
     * }
     */
    static getEntityWaterfall(args, option) {
        let params = Object.assign({}, args);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.getEntityWaterfall(params, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 新增实体对象
     * @param args ,新增实体对象
     * {
     *    "id":"3",             // 字段1，
     *    "valid":1,            // 字段2，
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参，返回新增实体对象
     * {
     *      "id":"3",
     *      "valid":1,
     *      "_returns":{}               // _returns 节点返回底层执行的结果，不同的数据库返回的数据不同，有些每个这个节点，使用的时候需要注意
     * }
     */
    static insertEntity(args, option) {
        let p = {};
        let entity = Object.assign({}, args);
        entity.configs = this.configs;
        for (let field of this.configs.fields) {
            if (field.name in entity) {
                p[field.name] = entity[field.name];
            } else {
                let default_value = null;
                if (field.default === undefined) {
                    throw new Error(`field:${field.name} required`);
                }
                if (field.default instanceof Function) {
                    default_value = field.default();
                } else {
                    default_value = field.default;
                }
                // 如果是主键自增，则跳出
                if (field.increment)
                    continue;
                p[field.name] = default_value;
            }
        }
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.insert({ insertion: p, configs: this.configs }, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 批量新增
     * @param entity_list 新增实体对象列表
     * [
     *    {
     *          "id":"10",          // 批量新增对象1
     *          "valid":1
     *    },
     *    {
     *          "id":"10",          // 批量新增对象2
     *          "valid":1
     *    }
     * ]
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static insertBatch(entity_list, option) {
        let insert_list = [];
        for (let entity of entity_list) {
            let insert_obj = {};
            for (let field of this.configs.fields) {
                if (field.name in entity) {
                    insert_obj[field.name] = entity[field.name];
                } else {
                    let default_value = null;
                    if (field.default === undefined) {
                        throw new Error(`field:${field.name} required`);
                    }
                    if (field.default instanceof Function) {
                        default_value = field.default();
                    } else {
                        default_value = field.default;
                    }
                    // 如果是主键自增，则跳出
                    if (field.increment)
                        continue;
                    insert_obj[field.name] = default_value;
                }
            }
            insert_list.push(insert_obj);
        }
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.insertBatch({ insertion: insert_list, configs: this.configs }, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 物理删除
     * @param args 查询参数
     * {
     *    "where":[                 // where是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "id",      // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ]
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参
     * }
     */
    static deleteEntity(args, option) {

        let params = Object.assign({}, args);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.deleteEntity(params, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 实体对象更新
     * @param args 更新对象模型
     * {
     *    "where":[                // where，是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ],
     *    "update":[              // where，是更新对象，对应SQL语句中的set更新
     *          {
     *              "key": "name",          // 更新字段
     *              "value": "更改名字",    // 更新之后的值
     *              "operator": "replace"   // 更新方式：replace（替换更新）、plus（+=更新，例如金额更新）、reduce（-=更新，例如金额更新）
     *          },
     *         {                             // WHEN THEN CASE 更新
     *               "key": "money",		 // 更新字段
     *               "case_field": "id",	 // CASE 条件字段
     *               "case_item": [
     *                   {
     *                      "case_value": "22",         // 把id值为22的这条记录
     *                      "value": 12,                // 例句：WHEN '22' THEN money += 12
     *                      "operator": "plus"         //
     *                    },
     *                   {"case_value": 23, "value": "B", "operator": "replace"}		//WHEN '001' THEN balance+2
     *               ]
     *           }
     *    ]
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参
     */
    static updateEntity(args, option) {
        let params = Object.assign({}, args);

        if ((!params.hasOwnProperty('keyword') || params.keyword.length == 0) && (!params.hasOwnProperty('where') || params.where.length == 0)) {
            return Promise.reject(new Error('paras.where更新条件（数组）必须存在条件'));
        }
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.updateEntity(params, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 批量更新（未实现）
     * @param update_list 批量更新
     * @param option 其他参数
     */
    static updateBatch(update_list, option) {
        var self = this;
        let p = Promise.resolve();
        for (let update_info of update_list) {
            p.then(self.updateEntity(update_info, option));
        }
    }

    /**
     * 统计查询（聚合函数的使用）
     * @param args 统计查询参数
     * {
     *    "where":[                // where，是查询条件模型数组，对应SQL语句where条件
     *      {                      // 例句：select * from tableName where 1=1 and valid = 1
     *          "logic": "and",    // logic，逻辑运算符，对应SQL语句运算符，可选值：and、or等
     *          "key": "valid",    // key，字段关键字，对应数据表表字段名称
     *          "operator":"=",    // operator，运算符，对应字段对比关系，可选值：=、>、>=、<、<=、<>、%、x%、%%、in、not in等
     *          "value": 1         // value，查询条件值
     *      }
     *    ],
     *   "aggregate":[
     *     {
     *          "function": "count",        // function，聚合函数：COUNT、SUM、MAX、MIN、ABS、AVG
     *          "field": "id",              // 字段
     *          "name": "total"             // 输出字段重命名
     *      },
     *   ]
     * }
     * @param option 其他参数
     * @returns {Promise.<TResult>} 出参
     */
    static getEntityByAggregate(args, option) {
        let params = Object.assign({}, args);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.statsByAggregate(params, option)
            }).catch(ex => {
                throw ex;
            });
    }

    /**
     * 自定义SQL执行（裸奔，一般不建议用）
     * @param sql SQL语句
     * @param parameters 参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static streak(sql, option) {
        return this.getActionManager().then(_connection => {
            if (_connection.streak)
                //支持此方法
                return _connection.streak(sql, option);
            else
                return Promise.reject(new Error("该类型数据库不支持streak方法"))

        }).catch(ex => {
            throw ex;
        });
    }
}

OnelaBaseModel.action_manager = null; // 连接初始化后绑定到这里来
OnelaBaseModel.configs = {
    fields: [],
    tableName: '',
    engine: "default"
};

// module.exports = BaseModelManager;

module.exports = { Old, Onela, OnelaBaseModel };