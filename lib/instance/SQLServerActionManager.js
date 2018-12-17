/**
 * MySql对象关系实例
 */
const { BaseActionManager } = require('../BaseActionManager');
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
        // 依赖包使用申明
        const tedious = require('tedious');
        const Connection = tedious.Connection;
        this.Request = tedious.Request;
        this.TYPES = tedious.TYPES;

        // 配置结构重组
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
        // 配置信息
        this.Connection = Connection;
        this.connectionCfg = connectionCfg;

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
                commit.transaction.client.commitTransaction(() => {
                    commit.transaction.client.close();    //记得关闭连接
                    resolve("事务提交成功");
                });
            })
        };
        // 回滚事务
        let rollback = () => {
            return new Promise(function (resolve, reject) {
                rollback.transaction.client.rollbackTransaction(() => {
                    rollback.transaction.client.close();    //记得关闭连接
                    resolve("事务已回滚");
                });
            });
        };


        return new Promise(function (resolve, reject) {
            // 启动连接
            let conn = new self.Connection(self.connectionCfg);
            conn.on('connect', function (err) {
                if (err) {
                    console.log("创建SQL Server事务访问连接出错", err);
                } else {
                    console.log("已经创建SQL Server事务访问连接");

                    // 事务对象
                    let _transaction = {
                        "client": conn
                        // "done": done
                    };
                    begin.transaction = commit.transaction = rollback.transaction = _transaction;
                    // 事件绑定
                    _transaction.begin = begin;
                    _transaction.commit = commit;
                    _transaction.rollback = rollback;
                    resolve(_transaction);
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
                        console.log("rowCount", rowCount);
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
                        console.log("row", columns)
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
                        console.log("doneProc status", status, rows.rows.length);
                    });


                    request.on('done', function (rowCount, more, rows) {
                        console.log("done", rowCount, more);
                        resolve(rows);
                    });

                    request.on('prepared', function (prepared) {
                        console.log("prepared", prepared);
                    });

                    request.on('error', function (err) {
                        console.log("err", err);
                    });

                    request.on('requestCompleted', function () {
                        console.log("requestCompleted");
                    });


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
        });
    }

    // 执行带事务的实例对象
    static executeTransaction(sql, parameters, transaction) {
        let self = this;
        return new Promise((resolve, reject) => {
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
                // console.log("rowCount", rowCount);

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
                rows.rows[n] = {};
                //遍历出列名和值
                columns.forEach(function (s) {
                    rows.rows[n][s.metadata.colName] = s.value;   //列名和值
                });
                n++;
            });
            //执行状态返回
            request.on('doneProc', function (r, m, status) {
                //成功返回0,一般不会用到,在Request的回调判断err即可
                console.log("doneProc status", status, rows.rows.length);
            });

            request.on('done', function (rowCount, more, rows) {
                console.log("done", rowCount, more);
                resolve(rows);
            });

            request.on('prepared', function (prepared) {
                console.log("prepared", prepared);
            });

            request.on('error', function (err) {
                console.log("err", err);
            });

            request.on('requestCompleted', function () {
                console.log("requestCompleted");
            });

            request.on('returnValue', function (parameterName, value, metadata) {
                console.log("returnValue", parameterName, value, metadata)
            });

            request.on('error', function (err) {
                console.log("出现错误", error);
            });

            // 事务：执行SQL
            transaction.client.execSql(request);
        });
    }

    /**
     * 数据实例查询
     * @param params 查询模型参数
     * @param option 其他参数
     * @returns {Promise.<T>}
     */
    static queryEntity(params, option = { "transaction": null }) {
        let self = this;
        let p = GrammarParameter.getParameters(params);
        // SQL语句
        let sql = "select  " + p["select"] + " from " + params.configs.tableName + " as t " + p.where + p.orderBy + p.limit + ";";
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql, p.parameters, option.transaction).then(data => {
                return Promise.resolve(data.rows);
            }).catch(err => {
                console.log('执行execute查询数据列表出错', err);
                return Promise.reject(err);
            });
        }
        else {
            return self.execute(sql, p.parameters).then(data => {
                return Promise.resolve(data.rows);
            }).catch(err => {
                console.log('执行execute查询数据列表出错', err);
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
    static queryEntityList(params, option = { "transaction": null }) {
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
            // 最终结果（事务版本）
            let result = {};
            return self.executeTransaction(sql, p.parameters, option.transaction).then(data => {
                // 分页列表
                result.data = data.rows;
                return self.executeTransaction(count_sql, p.parameters, option.transaction);
            }).then(data => {
                // 统计总数
                result.recordsTotal = [{ "total": data.rows[0].total }];
                return Promise.resolve(result);
            }).catch(ex => {
                console.log('执行execute查询数据列表出错', ex);
                return Promise.reject(ex);
            });
        }
        else {
            // 最终结果
            let result = {};
            return self.execute(sql, p.parameters).then(data => {
                // 分页列表
                result.data = data.rows;
                return self.execute(count_sql, p.parameters);
            }).then(data => {
                // 统计总数
                result.recordsTotal = [{ "total": data.rows[0].total }];
                return Promise.resolve(result);
            }).catch(ex => {
                console.log('执行execute查询数据列表出错', ex);
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
    static getEntityWaterfall(params, option = { "transaction": null }) {
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
        let p = GrammarParameter.getParameters(params);
        // 拼装SQL
        let sql = ["select ", p["select"], " from ", params.configs.tableName, " as t ", p.where, p.orderBy, p.limit + ";"];
        // 执行SQL
        if (option && option.transaction) {
            // 事务连接池
            return self.executeTransaction(sql.join(""), p.parameters, option.transaction).then(data => {
                // 定义返回结果
                let result = { "data": data, "isLastPage": false };
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
                console.log('执行execute查询数据列表出错', err);
                return Promise.reject(err);
            });
        }
        else {
            return self.execute(sql.join(""), p.parameters).then(data => {
                // 定义返回结果
                let result = { "data": data, "isLastPage": false };
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
                console.log('执行execute查询数据列表出错', err);
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
    static insert(params, option = { "transaction": null }) {
        // 临时变量
        let p = [], f = [], s = [];
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
            return this.executeTransaction(sql, p, option.transaction).then((data) => {
                // 返回浅拷贝
                let insertion = Object.assign(params.insertion, { "_returns": data });
                return Promise.resolve(insertion);
            }).catch(ex => {
                throw ex;
            });
        }
        else {
            console.log("开始执行");
            return this.execute(sql, p).then((data) => {
                // 返回浅拷贝
                let insertion = Object.assign(params.insertion, { "_returns": data });
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
    static insertBatch(params, option = { "transaction": null }) {
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

    /**
     * 物理删除
     * @param params 删除条件参数
     * @param option 其他参数
     * @returns {Promise.<TResult>}
     */
    static deleteEntity(params, option = { "transaction": null }) {
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

    /**
     * 实体对象更新
     * @param params 更新模型参数
     * @param option 其他参数
     * @returns {*}
     */
    static updateEntity(params, option = { "transaction": null }) {
        let p = GrammarParameter.getUpdateParameters(params);

        let sql = "update " + params.configs.tableName + " set " + p.set.join(',') + " where " + p.where + p.limit + ";";
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
    static statsByAggregate(params, option = { "transaction": null }) {
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

module.exports = { SQLServerActionManager };