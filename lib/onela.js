const {MySQLActionManager} = require("./instance/MySQLActionManager");
const {PostgreSQLActionManager} = require("./instance/PostgreSQLActionManager");
const {SQLiteActionManager} = require("./instance/SQLiteSQLActionManager");
// const {SQLServerActionManager} = require("./instance/SQLServerActionManager");
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
            // case "sqlserver":
            //     return SQLServerActionManager;
            default:
                return MySQLActionManager;
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
            temp_am.init(tempConfig.value);
            self._connections[tempConfig.engine] = temp_am;

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

                // // connection
                //
                // // 直接开始事务
                // connection.beginTransaction(function (err) {
                //     if (err) {
                //         throw err;
                //     }
                //
                //     // 直接返回已经开始事务的连接池
                //     resolve(connection);
                // });
            });
        });

    }

    /**
     * 查询实体对象
     * @param params
     * @param option
     * @returns {Promise.<T>}
     */
    static getEntity(params, option) {
        // let options = Object.assign({}, params);
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager().then(_connection => {
            return _connection.queryEntity(params, option)
        });
    }

    /**
     * 获取实体对象列表
     * @param params
     * @param option
     * @returns {Promise.<T>}
     */
    static getEntityList(params, option) {
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.queryEntityList(params, option)
            });
    }

    /**
     * 新增
     * @param entity
     * @param option
     * @returns {Promise.<T>}
     */
    static  insertEntity(entity, option) {
        let p = {};
        entity.configs = this.configs;
        for (let field of  this.configs.fields) {
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
                return _connection.insert({insertion: p, configs: this.configs}, option)
            });
    }

    /**
     * 批量新增
     * @param entity_list
     * @param option
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
                return _connection.insertBatch({insertion: insert_list, configs: this.configs}, option)
            });
    }

    /**
     * 物理删除
     * @param params
     * @param option
     * @returns {Promise.<TResult>}
     */
    static deleteEntity(params, option) {
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.deleteEntity(params, option)
            });
    }


    /**
     * 实体对象更新
     * @param params
     * @param option
     * @returns {*}
     */
    static updateEntity(params, option) {
        if ((!params.hasOwnProperty('keyword') || params.keyword.length == 0) && (!params.hasOwnProperty('where') || params.where.length == 0)) {
            return Promise.reject(new Error('paras.where更新条件（数组）必须存在条件'));
        }
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.updateEntity(params, option)
            });
    }

    /**
     * 批量更新
     * [{update: {}, keyword: []]
     * @param {Array<Object>} update_list
     */
    static updateBatch(update_list, option) {
        var self = this;
        let p = Promise.resolve();
        for (let update_info of update_list) {
            p.then(self.updateEntity(update_info, option));
        }
    }

    /**
     * 统计查询
     * @param params
     * @param option
     * @returns {Promise.<T>}
     */
    static  getEntityByAggregate(params, option) {
        params.configs = this.configs;
        // 返回执行结果
        return this.getActionManager()
            .then(_connection => {
                return _connection.statsByAggregate(params, option)
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

module.exports = {Old, Onela, OnelaBaseModel};