/**
 * MySql对象关系实例
 */
const {BaseActionManager} = require('../BaseActionManager');
// 语法处理
const GrammarSqlite = require("../grammar/sqlite.js");
/**
 * MYSQL
 * 单例的数据库操作管理者，负责这个数据库的基本crud，负责全局的一个连接；
 */
class SQLiteActionManager extends BaseActionManager {

    /**
     * 数据库初始化
     * @param config
     */
    static init(config) {
        // console.log('配置信息', config);

        const SQLite3 = require('sqlite3').verbose();

        // 链接数据库对象
        this.host = config.host;    // 数据库文件(文件路径+文件名)

        // 打开的数据库对象（不存在则创建）
        this.conn = new SQLite3.Database(config.host, function (err) {
            if (err) console.log("SQLite database connection exception", err); // SQLite数据库连接异常
            else console.log("SQLite database connection successful"); // SQLite数据库连接成功
        });
    }

    // 数据库连接
    static connectDataBase() {
        let self = this;
        return new Promise((resolve, reject) => {
            if (!self.conn) {
                self.conn = new SQLite3.Database(self.host, function (err) {
                    if (err) reject(new Error(err));
                    resolve(self.conn);
                });
            }
            else {
                resolve(self.conn);
            }
        });
    }

    // 创建事务连接
    static createTransaction() {
        let self = this;
        // 事务开始
        let begin = () => {
            return new Promise(function (resolve, reject) {
                // 直接开始事务
                begin.transaction.client.run("BEGIN");
                // 直接返回已经开始事务的连接池
                resolve(null);

                //function (err) {
                //     if (err) {
                //         throw err;
                //     }
                //     // 直接返回已经开始事务的连接池
                //     resolve(t);
                // });
            });
        };
        // 提交事务
        let commit = () => {
            return new Promise(function (resolve, reject) {
                commit.transaction.client.run("COMMIT");
                resolve("Transaction submitted successfully"); // 事务提交成功

                // () => {
                //     t.client.release(() => {
                //         resolve("事务提交成功");
                //     });
                // });
            })
        };
        // 回滚事务
        let rollback = () => {
            return new Promise(function (resolve, reject) {
                rollback.transaction.client.run("ROLLBACK");
                resolve("Transaction rolled back"); // 事务已回滚

                // t.client.rollback(() => {
                //     t.client.release(() => {
                //         resolve("事务已回滚");
                //     });
                // });
            });
        };

        return new Promise(function (resolve, reject) {
            // 事务对象
            let _transaction = {
                "client": self.conn
            };
            begin.transaction = commit.transaction = rollback.transaction = _transaction;
            // 事件绑定
            _transaction.begin = begin;
            _transaction.commit = commit;
            _transaction.rollback = rollback;

            resolve(_transaction);

            //
            // self.conn.getConnection(function (err, connection) {
            //     if (err) {
            //         console.log('创建事务连接出现异常', err);
            //         reject(new Error('创建事务连接出现异常'));
            //     } else {
            //         // resolve(connection);
            //         let transaction = {
            //             "client": connection,
            //             // "done": done,
            //             "begin": begin,         // 开始事务
            //             "commit": commit,       // 提交事务
            //             "rollback": rollback     // 事务回滚
            //         };
            //         resolve(transaction);
            //     }
            // });
        });
    }

    // 执行SQL
    static execute(sql, parameters, mode) {
        let self = this;
        // console.log('sql打印', sql, parameters)
        return new Promise(function (resolve, reject) {

            if (self.conn) {
                console.time("【onela】SQL execution time"); //【onela】执行SQL时间
                mode = mode == 'all' ? 'all' : (mode == 'get' ? 'get' : 'run');
                self.conn[mode](sql, parameters, function (err, data) {
                    //console.timeEnd("【onela】执行SQL时间");
                    if (err) {
                        reject(err);
                    }
                    else {
                        if (data) {
                            resolve(data);    // 返回数据查询成功的结果
                        } else {
                            resolve("success");    // 提示 增 删 改 操作成功
                        }
                    }
                });
            }
            else {
                // 数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致
                reject(new Error("The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig."));
            }
        });
    }

    // 执行带事务的实例对象
    static executeTransaction(sql, parameters, transaction, mode) {

        return new Promise((resolve, reject) => {
            if (transaction && transaction.client) {
                //console.time("【onela】执行SQL时间");
                mode = mode == 'all' ? 'all' : (mode == 'get' ? 'get' : 'run');
                // 事务连接池
                transaction.client[mode](sql, parameters, function (err, data) {
                    //console.timeEnd("【onela】执行SQL时间");
                    if (err) {
                        reject(err);
                    }
                    else {
                        if (data) {
                            resolve(data);    // 返回数据查询成功的结果
                        } else {
                            resolve("success");    // 提示 增 删 改 操作成功
                        }
                    }
                });
            }
            else {
                // 数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致
                reject(new Error("The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig."));
            }
        });
    }


    /**
     * 自定义SQL执行（裸奔，一般不建议用）
     * @param sql SQL语句
     * @param parameters 参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static streak(sql, parameters, option = {"transaction": null}) {
        let self = this;

        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql, parameters, option.transaction,"all")
                .catch(err => {
                    console.error('Exception when executing execute query data list', err); // 执行execute查询数据列表异常
                    return Promise.reject(err);
                });
        }
        else {
            return self.execute(sql, parameters,"all")
                .catch(err => {
                    console.error('Exception when executing execute query data list', err); // 执行execute查询数据列表异常
                    return Promise.reject(err);
                });
        }
    }


    /**
     * 数据实例查询
     * @param params 查询模型参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static queryEntity(params, option = {"transaction": null}) {
        let self = this;
        let p = GrammarSqlite.getParameters(params);
        // 拼装SQL
        // let sql = "select  " + p["select"] + " from " + params.configs.tableName + " as t " + p.where + p.orderBy + p.limit + ";";
        let sql =  `SELECT ${p["select"]} FROM ${params.configs.tableName} ${p.where} ${p.orderBy} ${p.limit};`;
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql, p.parameters, option.transaction, "all")
                .catch(err => {
                    console.error('Exception when executing execute query data list', err);  // 执行execute查询数据列表异常
                    return Promise.reject(err);
                });
        }
        else {
            return self.execute(sql, p.parameters, "all")
                .catch(err => {
                    console.error('Exception when executing execute query data list', err); // 执行execute查询数据列表异常
                    return Promise.reject(err);
                });
        }
    }

    /**
     * 分页查询数据列表
     * @param params 查询参数
     * @param option 其他参数
     * @returns {Promise.<TResult>}
     */
    static queryEntityList(params, option = {"transaction": null}) {
        let self = this;
        let p = GrammarSqlite.getParameters(params);
        /**
         * 分页数据查询
         */
        let sql = "select " + p["select"] + " from " + params.configs.tableName + " t " + p.where + " " + p.orderBy + p.limit + ";";
        let count_sql = "select count(0) total from " + params.configs.tableName + " t " + p.where + ";";

        //执行SQL
        if (option && option.transaction) {
            return Promise.all([
                self.executeTransaction(sql, p.parameters, option.transaction, "all"),
                self.execute(count_sql, p.parameters.slice(0, p.parameters.length - p.limit.length || 0), "all")
            ]).then(result => {
                return Promise.resolve({data: result[0], recordsTotal: result[1][0].total || 0});
            }).catch(ex => {
                console.error('Exception when executing execute query data list', ex); // 执行execute查询数据列表异常
                return Promise.reject(ex);
            });

        }
        else {
            return Promise.all([
                self.execute(sql, p.parameters, "all"),
                self.execute(count_sql, p.parameters.slice(0, p.parameters.length - p.limit.length || 0), "all")
            ]).then(result => {

                return Promise.resolve({data: result[0], recordsTotal: result[1][0].total || 0});
            }).catch(ex => {
                console.error('Exception when executing execute query data list', ex); // 执行execute查询数据列表异常
                return Promise.reject(ex);
            });
        }

    }

    /**
     * 获取数据瀑布
     * @param params 查询参数
     * @param option 其他参数
     * @returns {Promise.<TResult>}
     */
    static getEntityWaterfall(params, option = {"transaction": null}) {
        let self = this;
        // 参数预处理
        if (params.hasOwnProperty("limit")) {
            //如果limit里面参数个数不符合
            if (params.limit.length == 1) {
                params.limit = [0, params.limit[0]];       //默认10个
            }
            //这里处理
            params.limit[0] = parseInt(params.limit[0]);
            //长度+1
            params.limit[1] = parseInt(params.limit[1]) + 1;
        }
        // 参数结构化
        let p = GrammarSqlite.getParameters(params);
        // 拼装SQL
        let sql = ["select ", p["select"], " from ", params.configs.tableName, " as t ", p.where, p.orderBy, p.limit + ";"];
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql.join(""), p.parameters, option.transaction, "all").then(data => {
                // 定义返回结果
                let result = {"data": data, "isLastPage": false};
                if (result.data.length == 0) {
                    result.isLastPage = true;         // 未查询到数据，显示最后一页
                }
                else if (result.data.length < (params.limit[1] - 1)) {
                    //最后一页数据
                    result.isLastPage = true;         // 最后一页
                }
                else {
                    //记录数等于length+1，删除最后一条数据
                    if (result.data.length > (params.limit[1] - 1))
                        result.data.pop();
                }
                return Promise.resolve(result);
            }).catch(err => {
                console.error('Exception when executing execute query data list', err); // 执行execute查询数据列表异常
                return Promise.reject(err);
            });
        }
        else {
            return self.execute(sql.join(""), p.parameters, "all").then(data => {
                // 定义返回结果
                let result = {"data": data, "isLastPage": false};
                if (result.data.length == 0) {
                    result.isLastPage = true;         // 未查询到数据，显示最后一页
                }
                else if (result.data.length < (params.limit[1] - 1)) {
                    //最后一页数据
                    result.isLastPage = true;         // 最后一页
                }
                else {
                    //记录数等于length+1，删除最后一条数据
                    if (result.data.length > (params.limit[1] - 1))
                        result.data.pop();
                }
                return Promise.resolve(result);
            }).catch(err => {
                console.error('Exception when executing execute query data list', err); // 执行execute查询数据列表异常
                return Promise.reject(err);
            });
        }
    }

    /**
     * 新增
     * @param entity 新增实体对象
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static insert(params, option = {"transaction": null}) {
        let p = [], f = [], s = [];
        for (let i in params.insertion) {
            //参数值
            p.push(params.insertion[i]);
            //字段名称集合
            f.push(i);
            //sql参数化处理符合
            s.push('?');
        }
        let sql = "insert into " + params.configs.tableName + " (" + f.join(',') + ") values(" + s.join(',') + ");";

        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p, option.transaction, "run").then((data) => {
                // 返回浅拷贝
                let insertion = Object.assign(params.insertion, {"_returns": data});
                return Promise.resolve(insertion);
            }).catch(ex => {
                throw ex;
            });
        }
        else {
            return this.execute(sql, p, "run").then((data) => {
                // 返回浅拷贝
                let insertion = Object.assign(params.insertion, {"_returns": data});
                return Promise.resolve(insertion);
            }).catch(ex => {
                throw ex;
            });
        }
    }

    /**
     * 批量新增
     * @param entity_list 新增实体对象列表
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static insertBatch(params, option = {"transaction": null}) {
        let p = [], f = [], s = [];
        for (let i in params.insertion) {
            let s2 = [];
            for (let j in params.insertion[i]) {
                if (i == 0) {
                    //字段名称集合，大于0就不需要继续了
                    f.push("`" + j + "`");
                }
                //参数值
                p.push(params.insertion[i][j]);
                //sql参数化处理符合
                s2.push('?');
            }
            //置入
            s.push('(' + s2.join(',') + ')');
        }
        //SQL执行
        let sql = "insert into " + params.configs.tableName + "(" + f.join(',') + ") values" + s.join(',') + ";";
        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p, option.transaction, "run");
        }
        else {
            return this.execute(sql, p, "run");
        }
    }

    /**
     * 物理删除
     * @param params 删除条件参数
     * @param option 其他参数
     * @returns {Promise.<TResult>}
     */
    static deleteEntity(params, option = {"transaction": null}) {
        if ((!params.hasOwnProperty('keyword') || params.keyword.length == 0) && (!params.hasOwnProperty('where') || params.where.length == 0)) {
            return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');  // 需要指定删除条件，防止整表数据误删除
        }
        let p = GrammarSqlite.getDeleteParameters(params);
        let sql = "delete from " + params.configs.tableName + " where " + p.where + ";";

        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction, "run");
        }
        else {
            return this.execute(sql, p.parameters, "run");
        }
    }

    /**
     * 实体对象更新
     * @param params 更新模型参数
     * @param option 其他参数
     * @returns {*}
     */
    static updateEntity(params, option = {"transaction": null}) {
        let p = GrammarSqlite.getUpdateParameters(params);
        let _limit = "";
        if (params.limit && params.hasOwnProperty('limit')) {
            _limit = " limit ?";
            p.parameters.push(params.limit);
        }
        let sql = "update " + params.configs.tableName + " set " + p.set.join(',') + " where " + p.where + _limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction, "run");
        }
        else {
            return this.execute(sql, p.parameters, "run");
        }
    }

    /**
     * 统计查询
     * @param params 查询参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static statsByAggregate(params, option = {"transaction": null}) {
        let p = GrammarSqlite.getParameters(params);
        let check = {
            "count": "COUNT",
            "sum": "SUM",
            "max": "MAX",
            "min": "MIN",
            "abs": "ABS",
            "avg": "AVG"
        };
        let show = [];
        for (let i in params.aggregate) {
            let c = params.aggregate[i];
            let item = check[c.function.toLowerCase()];
            if (item) {
                show.push(item + "(" + c.field + ") as " + c.name);
            }
        }
        //sql
        let sql = "select " + show.join(',') + " from " + params.configs.tableName + " " + p.where + p.limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction, "all");
        }
        else {
            return this.execute(sql, p.parameters, "all");
        }
    }
}

module.exports = {SQLiteActionManager};