/**
 * MySql对象关系实例
 */
const {BaseActionManager} = require('../BaseActionManager');
// 语法处理
const GrammarParameter = require("../grammar/sqlserver.js");
/**
 * MYSQL
 * 单例的数据库操作管理者，负责这个数据库的基本crud，负责全局的一个连接；
 */
class SQLServerActionManager extends BaseActionManager {

    /**
     * 数据库初始化
     * @param config
     */
    static init(config) {
        // const sql = require("mssql");
        //
        // let connectionCfg = {
        //     server: config.host,
        //     user: config.user,
        //     port: config.port || 1433,
        //     password: config.password,
        //     database: config.database,
        //     options: {}
        // };
        // this.sql = sql;
        // // 使用windows azure，需要设置次配置。
        // if (config.encrypt) {
        //     connectionCfg.options.encrypt = config.encrypt;
        // }
        // /**
        //  * 创建连接池
        //  */
        // this.conn = new sql.ConnectionPool(connectionCfg, err => {
        //     console.log("创建SQL Server连接", err);
        //     if (err)
        //         return Promise.reject(err);
        //     else
        //         return Promise.resolve("创建SQL Server连接")
        // });
        //
        // // 错误跟踪
        // sql.on('error', err => {
        //     // ... error handler
        //     console.log("SQL Server连接出现错误");
        // })

        const tedious = require('tedious');
        const Connection = tedious.Connection;
        this.Request = tedious.Request;
        this.TYPES = tedious.TYPES;


        let connectionCfg = {
            "server": config.host,                          //数据库地址
            "userName": config.user,                        //用户名
            "password": config.password,                    //密码
            'options': {
                'encrypt': config.encrypt || false,         //是否启用加密传输,测试了两台机器,一台开了无法连接
                'port': config.port || 1433,                //端口号
                'database': config.database                 //数据库名
            }
        };
        //if (config.encrypt) {
        //    connectionCfg.options.encrypt = config.encrypt;      //是否启用加密传输,测试了两台机器,一台开了无法连接
        //}
        this.Connection = Connection;
        this.connectionCfg = connectionCfg;
        // 连接对象
        // this.conn = new Connection(connectionCfg);

        // this.conn.connect();

        // // 启动连接
        // this.conn.on('connect', function (err) {
        //     if (err) {
        //         console.log("SQL Server访问连接出错", err);
        //     } else {
        //         console.log("已经创建SQL Server访问连接");
        //     }
        // });

        // this.conn = connection;

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
                    commit.transaction.client.release(() => {
                        resolve("事务提交成功");
                    });
                });
            })
        };
        // 回滚事务
        let rollback = () => {
            return new Promise(function (resolve, reject) {
                rollback.transaction.client.rollback(() => {
                    rollback.transaction.client.release(() => {
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
        console.log("执行SQL", sql);
        console.log("参数", parameters);

        let self = this;
        return new Promise((resolve, reject) => {
                // 启动连接
                let conn = new self.Connection(self.connectionCfg);
                conn.on('connect', function (err) {
                    if (err) {
                        console.log("SQL Server访问连接出错", err);
                    } else {
                        console.log("已经创建SQL Server访问连接");
                        console.log('开始创建connect');
                        // 每次单独创建连接
                        /**
                         * 执行SQL
                         */
                        let rows = {
                            "rows": [],
                            "rowCount": 0
                        };
                        // 创建请求
                        let request = new self.Request(sql, function (err, rowCount) {
                            //判断有没有出错
                            if (err) {
                                console.log("创建SQL执行请求出错", err);
                                return reject(err);
                            }
                            else rows['rowCount'] = rowCount; //rowCount是语句执行影响行数
                            // console.log("rows", rows);
                            conn.close();               //记得关闭连接
                            resolve(rows);
                        });
                        // 参数
                        for (let i in parameters) {
                            // 参数化处理self.TYPES[parameters[i].sqlType]
                            //console.log('参数TYPES', self.TYPES[parameters[i].sqlType]);
                            request.addParameter(parameters[i].name, self.TYPES[parameters[i].sqlType], parameters[i].value);
                        }
                        let n = 0;
                        //查询数据返回,select才有返回,每次一行记录
                        request.on('row', function (columns) {
                            // console.log("columns",columns)
                            rows.rows[n] = {};
                            //遍历出列名和值
                            columns.forEach(function (s) {
                                rows.rows[n][s.metadata.colName] = s.value;   //列名和值
                            });
                            // console.log('n+++++++');
                            n++;
                        });
                        //执行状态返回
                        request.on('doneProc', function (r, m, status) {
                            //成功返回0,一般不会用到,在Request的回调判断err即可
                            console.log("r", r)
                            console.log("m", m)
                            console.log("status", status)
                            // if (status)
                            //     rows = request;

                            console.log("doneProc", rows.rows.length);
                        });


                        request.on('done', function (rowCount, more, rows) {
                            console.log("done", rowCount, more);
                            resolve(rows);
                        });

                        // request.on('row', function (columns) {
                        //     console.log("row", columns);
                        // });


                        request.on('returnValue', function (parameterName, value, metadata) {
                            console.log("returnValue", parameterName, value, metadata)
                        });


                        request.on('error', function (err) {
                            console.log("出现错误", error);
                        });

                        // 执行SQL
                        conn.execSql(request);
                    }
                });

                // if (self.conn) {
                //     console.log('开始创建connect');
                //     // 每次单独创建连接
                //     /**
                //      * 执行SQL
                //      */
                //     let rows = {
                //         "rows": [],
                //         "rowCount": 0
                //     };
                //     // 创建请求
                //     let request = new self.Request(sql, function (err, rowCount) {
                //         //判断有没有出错
                //         if (err) {
                //             console.log("创建SQL执行请求出错", err);
                //             return reject(err);
                //         }
                //         else rows['rowCount'] = rowCount; //rowCount是语句执行影响行数
                //         // console.log("rows", rows);
                //         // self.conn.close();               //记得关闭连接
                //         resolve(rows);
                //     });
                //     // 参数
                //     for (let i in parameters) {
                //         // 参数化处理self.TYPES[parameters[i].sqlType]
                //         //console.log('参数TYPES', self.TYPES[parameters[i].sqlType]);
                //         request.addParameter(parameters[i].name, self.TYPES[parameters[i].sqlType], parameters[i].value);
                //     }
                //     let n = 0;
                //     //查询数据返回,select才有返回,每次一行记录
                //     request.on('row', function (columns) {
                //         // console.log("columns",columns)
                //         rows.rows[n] = {};
                //         //遍历出列名和值
                //         columns.forEach(function (s) {
                //             rows.rows[n][s.metadata.colName] = s.value;   //列名和值
                //         });
                //         // console.log('n+++++++');
                //         n++;
                //     });
                //     //执行状态返回
                //     request.on('doneProc', function (r, m, status) {
                //         //成功返回0,一般不会用到,在Request的回调判断err即可
                //         console.log("r", r)
                //         console.log("m", m)
                //         console.log("status", status)
                //         // if (status)
                //         //     rows = request;
                //
                //         console.log("doneProc", rows.rows.length);
                //     });
                //
                //
                //     request.on('done', function (rowCount, more, rows) {
                //         console.log("done", rowCount, more);
                //         resolve(rows);
                //     });
                //
                //     // request.on('row', function (columns) {
                //     //     console.log("row", columns);
                //     // });
                //
                //
                //     request.on('returnValue', function (parameterName, value, metadata) {
                //         console.log("returnValue", parameterName, value, metadata)
                //     });
                //
                //
                //     request.on('error', function (err) {
                //         console.log("出现错误", error);
                //     });
                //
                //     // 执行SQL
                //     self.conn.execSql(request);
                //
                //     //
                //     // this.conn.on('connect', function (err) {
                //     //     if (err) {
                //     //         console.log("SQL Server访问连接出错", err);
                //     //     } else {
                //     //         console.log("已经创建SQL Server访问连接");
                //     //     }
                //     //
                //     //     // self.conn.connect(function (err) {
                //     //     //     console.log('connect。。。。')
                //     //     //     if (err) {
                //     //     //         reject(err);
                //     //     //     } else {
                //     //
                //     //     // }
                //     //     // });
                //     //
                //     // });
                //     //
                //     // //
                //     // // request.addParameter('name', TYPES.VarChar, 'Fred');
                //     // // request.addParameter('age', TYPES.Int, 42);
                //     //
                //     //
                //     // let request = self.Request();
                //     // // 参数
                //     // for (let i in parameters) {
                //     //     // 参数化处理
                //     //     request.input(parameters[i].name, self.sql[parameters[i].sqlType], parameters[i].value)
                //     // }
                //     // // 执行
                //     // request.query(sql)
                //     //     .then(result => {
                //     //         console.log("执行结果", result);
                //     //         resolve(result);
                //     //     })
                //     //     .catch(ex => {
                //     //         console.log(ex)
                //     //         reject(ex);
                //     //     });
                //
                //     //console.time("【onela】执行SQL时间");
                //     // 事务连接池
                //     // self.conn.query(sql, parameters, function (err, doc) {
                //     //     //console.timeEnd("【onela】执行SQL时间");
                //     //     if (err) {
                //     //         reject(err);
                //     //     }
                //     //     else {
                //     //         resolve(doc);
                //     //     }
                //     // });
                // }
                // else {
                //     console.log('数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致')
                //     reject(new Error("数据库实例engine实例未正确指向，请检查单例configs配置是否跟dbconfig配置的engine一致"));
                // }
            }
        );
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
        console.log('进入了。。。。', params);
        let p = GrammarParameter.getParameters(params);
        console.log('参数', p);

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
        let p = GrammarParameter.getParameters(params);
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
                self.execute(sql, p.parameters).then(data => {
                    console.log('对象结果1>>', data);
                    return Promise.resolve(data);
                }),
                self.execute(count_sql, p.parameters).then(data => {
                    console.log('对象结果2>>', data);
                    return Promise.resolve(data.rows[0].total);
                })
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
        console.log('进入了。。。。');
        console.log("字段配置", params.configs);
        for (let i in params.insertion) {
            //参数值
            let sqlType = {
                "name": i,
                "sqlType": "Varchar",           // 默认类型
                "value": params.insertion[i]
            };

            for (let s = 0; s < params.configs.fields.length; s++) {
                if (i === params.configs.fields[s].name) {
                    sqlType.sqlType = GrammarParameter.sqlTypeHandle(params.configs.fields[s].type);
                    break;
                }
            }
            p.push(sqlType);

            //字段名称集合
            f.push(i);
            //sql参数化处理符合
            s.push('@' + i);
        }
        let sql = "insert into " + params.configs.tableName + "(" + f.join(',') + ") values(" + s.join(',') + ");";

        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p, option.transaction);
        }
        else {
            console.log("开始执行");
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
                    f.push(j);
                }

                //参数值
                let sqlType = {
                    "name": j + "" + i,
                    "sqlType": "Varchar",           // 默认类型
                    "value": params.insertion[i][j]
                };

                for (let s = 0; s < params.configs.fields.length; s++) {
                    if (j === params.configs.fields[s].name) {
                        sqlType.sqlType = GrammarParameter.sqlTypeHandle(params.configs.fields[s].type);
                        break;
                    }
                }
                //参数化，值处理
                p.push(sqlType);
                //sql参数化处理符合
                s2.push("@" + j + "" + i);
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
        let p = GrammarParameter.getDeleteParameters(params);
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
        let p = GrammarParameter.getUpdateParameters(params);
        //let _limit = "";
        //if (params.limit && params.hasOwnProperty('limit')) {
        //    _limit = " limit ?";
        //    p.parameters.push(params.limit);
        //}
        let sql = "update " + params.configs.tableName + " set " + p.set.join(',') + " where " + p.where + p.limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction);
        }
        else {
            return this.execute(sql, p.parameters);
        }
    }

    static statsByAggregate(params, option = {"transaction": null}) {
        let p = GrammarParameter.getParameters(params);
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

module.exports = {SQLServerActionManager};