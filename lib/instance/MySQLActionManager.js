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
        let begin = (t) => {
            return new Promise(function (resolve, reject) {
                // 直接开始事务
                t.client.beginTransaction(function (err) {
                    if (err) {
                        throw err;
                    }
                    // 直接返回已经开始事务的连接池
                    resolve(t);
                });
            });
        };
        // 提交事务
        let commit = (t) => {
            return new Promise(function (resolve, reject) {
                t.client.commit(() => {
                    t.client.release(() => {
                        resolve("事务提交成功");
                    });
                });
            })
        };
        // 回滚事务
        let rollback = (t) => {
            return new Promise(function (resolve, reject) {
                t.client.rollback(() => {
                    t.client.release(() => {
                        resolve("事务已回滚");
                    });
                });
            });
        };


        return new Promise(function (resolve, reject) {
            self.conn.getConnection(function (err, connection) {
                if (err) {
                    console.log('创建事务连接出现异常', err);
                    reject(new Error('创建事务连接出现异常'));
                } else {
                    // resolve(connection);
                    let transaction = {
                        "client": connection,
                        // "done": done,
                        "begin": begin,         // 开始事务
                        "commit": commit,       // 提交事务
                        "rollback": rollback     // 事务回滚
                    };
                    resolve(transaction);
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
                reject(new Error("数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致"));
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
                reject(new Error("数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致"));
            }
        });
    }

    static queryEntity(params, option = {"transaction": null}) {
        let self = this;
        let p = GrammarMysql.getParameters(params);

        let sql = "select  " + p["select"] + " from " + params.configs.tableName + " as t " + p.where + p.orderBy + p.limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql, p.parameters, option.transaction)
                .catch(err => {
                    console.log('执行execute查询数据列表出错', err);
                    return Promise.reject(err);
                });
        }
        else {
            return self.execute(sql, p.parameters)
                .catch(err => {
                    console.log('执行execute查询数据列表出错', err);
                    return Promise.reject(err);
                });
        }
    }

    static queryEntityList(params, option = {"transaction": null}) {
        let self = this;
        let p = GrammarMysql.getParameters(params);
        //变量定义
        let result = {
            "data": [],                                         //数据列表
            "recordsTotal": 0                                  //查询记录总数
        };
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
                console.log('执行execute查询数据列表出错', ex);
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
                console.log('执行execute查询数据列表出错', ex);
                return Promise.reject(ex);
            });
        }

    }

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
            return this.executeTransaction(sql, p, option.transaction);
        }
        else {
            return this.execute(sql, p);
        }
    }

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

    static deleteEntity(params, option = {"transaction": null}) {
        if ((!params.hasOwnProperty('keyword') || params.keyword.length == 0) && (!params.hasOwnProperty('where') || params.where.length == 0)) {
            return Promise.reject('需要指定删除条件，防止整表数据误删除');
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
}

module.exports = {MySQLActionManager};