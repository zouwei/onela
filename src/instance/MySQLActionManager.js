/**
 * MySql对象关系实例
 */
const {BaseActionManager} = require('../BaseActionManager');
// 语法处理
const GrammarMysql = require("../grammar/mysql.js");
/**
 * MYSQL
 * 单例的数据库操作管理者，负责这个数据库的基本crud，负责全局的一个连接；
 */
class MySQLActionManager extends BaseActionManager {

    /**
     * 数据库初始化
     * @param config
     */
    static init(config) {
        const mysql = require("mysql");
        let connPool = mysql.createPool(config);
        this.conn = connPool;
    }

    // 创建事务连接
    static createTransaction() {
        let self = this;
        // 事务开始
        let begin = () => {
            return new Promise(function (resolve, reject) {
                // 直接开始事务
                begin.transaction.client.beginTransaction(function (err) {
                    if (err) {
                        throw err;
                    }
                    // 直接返回已经开始事务的连接池
                    resolve(begin.transaction);
                });
            });
        };
        // 提交事务
        let commit = () => {
            return new Promise(function (resolve, reject) {
                commit.transaction.client.commit(() => {
                    resolve("Transaction submitted successfully"); // 事务提交成功
                    commit.transaction.client.release(() => {
                        
                    });
                });
            })
        };
        // 回滚事务
        let rollback = () => {
            return new Promise(function (resolve, reject) {
                rollback.transaction.client.rollback(() => {
                    resolve("Transaction rolled back"); // 事务已回滚
                    rollback.transaction.client.release(() => {
                        
                    });
                });
            });
        };


        return new Promise(function (resolve, reject) {
            self.conn.getConnection(function (err, connection) {
                if (err) {
                    console.log('An exception occurred when creating a transaction connection', err); // 创建事务连接出现异常
                    reject(new Error('An exception occurred when creating a transaction connection')); // 创建事务连接出现异常
                } else {
                    // 事务对象
                    let _transaction = {
                        "client": connection
                        // "done": done
                    };
                    begin.transaction = commit.transaction = rollback.transaction = _transaction;
                    // 事件绑定
                    _transaction.begin = begin;
                    _transaction.commit = commit;
                    _transaction.rollback = rollback;
                    resolve(_transaction);

                    // // resolve(connection);
                    // let transaction = {
                    //     "client": connection,
                    //     // "done": done,
                    //     "begin": begin,         // 开始事务
                    //     "commit": commit,       // 提交事务
                    //     "rollback": rollback     // 事务回滚
                    // };
                    // resolve(transaction);
                }
            });
        });
    }

    // 执行SQL
    static execute(sql, parameters) {
        let self = this;
        return new Promise(function (resolve, reject) {
            if (self.conn) {
                //console.time("【onela】执行SQL时间");

                self.conn.query(sql, parameters, function (err, doc) {
                    //console.timeEnd("【onela】执行SQL时间");
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(doc);
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
    static executeTransaction(sql, parameters, transaction) {

        return new Promise((resolve, reject) => {
            // console.log(sql);
            //console.log('事务对象',   transaction.client.query)
            if (transaction && transaction.client) {
                //console.time("【onela】执行SQL时间");
                // 事务连接池
                transaction.client.query(sql, parameters, function (err, doc) {
                    //console.timeEnd("【onela】执行SQL时间");
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(doc);
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
     * 数据实例查询
     * @param params 查询模型参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static queryEntity(params, option = {"transaction": null}) {
        let self = this;
        let p = GrammarMysql.getParameters(params);

        let sql = "select  " + p["select"] + " from " + params.configs.tableName + " as t " + p.where + p.orderBy + p.limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql, p.parameters, option.transaction)
                .catch(err => {
                    console.log('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                    return Promise.reject(err);
                });
        }
        else {
            return self.execute(sql, p.parameters)
                .catch(err => {
                    console.error('Error when executing execute query data list', err); // 执行execute查询数据列表出错
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
        let p = GrammarMysql.getParameters(params);
        /**
         * 分页数据查询
         */
        let sql = "select " + p["select"] + " from " + params.configs.tableName + " t " + p.where + " " + p.orderBy + p.limit + ";";
        let count_sql = "select count(0) total from " + params.configs.tableName + " t " + p.where;

        //执行SQL
        if (option && option.transaction) {
            return Promise.all([
                self.executeTransaction(sql, p.parameters, option.transaction),
                self.executeTransaction(count_sql, p.parameters, option.transaction)
            ]).then(result => {
                return Promise.resolve({data: result[0], recordsTotal: result[1]});
            }).catch(ex => {
                console.error('Error when executing execute query data list', ex); // 执行execute查询数据列表出错
                return Promise.reject(ex);
            });

        }
        else {
            return Promise.all([
                self.execute(sql, p.parameters),
                self.execute(count_sql, p.parameters)
            ]).then(result => {
                return Promise.resolve({data: result[0], recordsTotal: result[1]});
            }).catch(ex => {
                console.error('Error when executing execute query data list', ex); // 执行execute查询数据列表出错
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
        let p = GrammarMysql.getParameters(params);
        // 拼装SQL
        let sql = ["select ", p["select"], " from ", params.configs.tableName, " as t ", p.where, p.orderBy, p.limit + ";"];
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql.join(""), p.parameters, option.transaction).then(data => {
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
                console.error('Error when executing execute query data list', err); // 执行execute查询数据列表出错
                return Promise.reject(err);
            });
        }
        else {
            return self.execute(sql.join(""), p.parameters).then(data => {
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
                console.error('Error when executing execute query data list', err); // 执行execute查询数据列表出错
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
        let sql = "insert into " + params.configs.tableName + "(" + f.join(',') + ") values(" + s.join(',') + ");";

        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p, option.transaction).then((data) => {
                // 返回浅拷贝
                let insertion = Object.assign(params.insertion, {"_returns": data});
                return Promise.resolve(insertion);
            }).catch(ex => {
                throw ex;
            });
        }
        else {
            return this.execute(sql, p).then((data) => {
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
            return this.executeTransaction(sql, p, option.transaction);
        }
        else {
            return this.execute(sql, p);
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
            return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.'); // 需要指定删除条件，防止整表数据误删除
        }
        let p = GrammarMysql.getDeleteParameters(params);
        let sql = "delete from " + params.configs.tableName + " where " + p.where + ";";

        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction);
        }
        else {
            return this.execute(sql, p.parameters);
        }
    }

    /**
     * 实体对象更新
     * @param params 更新模型参数
     * @param option 其他参数
     * @returns {*}
     */
    static updateEntity(params, option = {"transaction": null}) {
        let p = GrammarMysql.getUpdateParameters(params);
        let _limit = "";
        if (params.limit && params.hasOwnProperty('limit')) {
            _limit = " limit ?";
            p.parameters.push(params.limit);
        }
        let sql = "update " + params.configs.tableName + " set " + p.set.join(',') + " where " + p.where + _limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction);
        }
        else {
            return this.execute(sql, p.parameters);
        }
    }

    /**
     * 统计查询
     * @param params 查询参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static statsByAggregate(params, option = {"transaction": null}) {
        let p = GrammarMysql.getParameters(params);
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
            return this.executeTransaction(sql, p.parameters, option.transaction);
        }
        else {
            return this.execute(sql, p.parameters);
        }
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
}

module.exports = {MySQLActionManager};