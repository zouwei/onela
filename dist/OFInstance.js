/**
 * 【老版本兼容，新版本弃用】
 * 通用模块 - 数据库实例服务
 * author: zack zou
 * create time: 2016-06-27
 */
import * as mysqlGrammar from './grammar/mysql.js';
// === 数据库实例类 ===
class Service {
    database;
    db;
    constructor(oodbc, _database, _instance) {
        const database = (_database || 'MYSQL').toUpperCase();
        this.database = database;
        const source = oodbc[database];
        if (!source) {
            console.log(`Data source instance configuration node identification error, please check whether the ${database} node exists`);
            throw new TypeError(`Data source instance configuration node identification error, please check whether the ${database} node exists`);
        }
        const dbsource = source[(_instance || '').toUpperCase()];
        if (!dbsource) {
            console.log(`Data source instance configuration node identification error, please check whether the ${_instance?.toUpperCase()} node exists`);
            throw new TypeError(`Data source instance configuration node identification error, please check whether the ${_instance?.toUpperCase()} node exists`);
        }
        this.db = dbsource;
    }
    // === 执行 SQL ===
    execute(instance, sql, parameters = []) {
        return new Promise((resolve, reject) => {
            console.time('【onela】SQL execution time');
            if (instance) {
                instance.query(sql, parameters, (err, doc) => {
                    console.timeEnd('【onela】SQL execution time');
                    if (err)
                        reject(err);
                    else
                        resolve(doc);
                });
            }
            else {
                reject('The database instance is not pointed correctly. Please check whether the instance comparison between the oodbc data instance configuration and the table structure configuration (onelaInstanceConfig.json) is correct.');
            }
        });
    }
    // === 瀑布流查询 ===
    queryWaterfallList(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const p = mysqlGrammar.getParameters(paras);
                    const sql = `SELECT ${p.select} FROM ${paras.command.tableName} AS t ${p.where} ${p.orderBy}${p.limit};`;
                    this.execute(db.READER, sql, p.parameters)
                        .then(doc => resolve({ data: doc }))
                        .catch(err => {
                        console.log('Error when executing execute query data list', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    // === 分页查询（含总数）===
    queryEntityList(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const p = mysqlGrammar.getParameters(paras);
                    const result = { data: [], recordsTotal: 0 };
                    const sql = `SELECT ${p.select} FROM ${paras.command.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
                    const countSql = `SELECT COUNT(0) total FROM ${paras.command.tableName} t ${p.where};`;
                    this.execute(db.READER, sql, p.parameters)
                        .then(doc => {
                        result.data = doc;
                        return this.execute(db.READER, countSql, p.parameters);
                    })
                        .then(counts => {
                        result.recordsTotal = counts[0]?.total ?? 0;
                        resolve(result);
                    })
                        .catch(err => {
                        console.log('Error when executing execute query data list', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    // === 自由查询 ===
    queryEntity(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const p = mysqlGrammar.getParameters(paras);
                    const sql = `SELECT ${p.select} FROM ${paras.command.tableName} AS t ${p.where} ${p.orderBy}${p.limit};`;
                    this.execute(db.READER, sql, p.parameters)
                        .then(resolve)
                        .catch(err => {
                        console.log('Error when executing execute query data list', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    // === 统计聚合 ===
    statsByAggregate(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const field = paras.command.aggregate || '1';
                    const p = mysqlGrammar.getParameters({ ...paras, select: [`COUNT(${field}) AS total`] });
                    const sql = `SELECT COUNT(${field}) AS total FROM ${paras.command.tableName} AS t ${p.where};`;
                    this.execute(db.READER, sql, p.parameters)
                        .then(doc => resolve(doc[0]))
                        .catch(err => {
                        console.log('Error when executing statsByAggregate', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    /**
     * 批量新增操作
     * @param paras 新增参数配置
     * author:zack zou
     * create time:2016-07-10
     */
    insertionBatch(paras) {
        //参数
        var database = this.database;
        var db = this.db;
        /**
         * 数据工厂
         */
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
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
                    const insertion = paras.insertion || [];
                    for (var i = 0; i < paras.insertion.length; i++) {
                        var s2 = [];
                        for (var j in insertion[i]) {
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
                    console.log(sql);
                    this.execute(db.WRITER, sql, p)
                        .then(resolve)
                        .catch(function (err) {
                        console.log('An error occurred while performing a write operation.', err); // 执行写入操作报错
                        reject(err);
                    });
                });
            },
        };
        //定义结构
        return new Promise(function (resolve, reject) {
            /**
             * 数据工厂
             */
            var workshop = factory[database];
            if (workshop) {
                workshop()
                    .then(resolve)
                    .catch(err => {
                    console.log('An error occurred while executing execute operation updateBySenior', err);
                    reject(err);
                });
            }
            else {
                // 非常抱歉，OFranmework目前对{0}数据库还未支持！
                reject('We are very sorry, OFranmework currently does not support the ' + database + ' database!');
            }
        });
    }
    // === 高级更新（支持 CASE WHEN）===
    updateBySenior(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const p = mysqlGrammar.getUpdateParameters(paras);
                    let limitSql = '';
                    if (paras.limit != null) {
                        limitSql = ' LIMIT ?';
                        p.parameters.push(paras.limit);
                    }
                    const sql = `UPDATE ${paras.command.tableName} SET ${p.set.join(',')} WHERE ${p.where}${limitSql};`;
                    this.execute(db.WRITER, sql, p.parameters)
                        .then(resolve)
                        .catch(err => {
                        console.log('An error occurred while executing execute operation updateBySenior', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    // === 物理删除 ===
    deleteEntity(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    if (!paras.keyword || paras.keyword.length === 0) {
                        reject('`paras.keyword` update conditions (array) must exist conditions');
                        return;
                    }
                    const p = mysqlGrammar.getDeleteParameters(paras);
                    const sql = `DELETE FROM ${paras.command.tableName} WHERE ${p.where};`;
                    this.execute(db.WRITER, sql, p.parameters)
                        .then(resolve)
                        .catch(err => {
                        console.log('An error occurred during execute operation deleteEntity', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
    // === 存储过程调用 ===
    call(paras) {
        const { database, db } = this;
        const factory = {
            MYSQL: () => {
                return new Promise((resolve, reject) => {
                    const symbol = '?';
                    const _self = { call: '', parameter: [], values: [] };
                    const error = [];
                    for (const item of paras.config.parameter) {
                        let matched = false;
                        for (const key in paras.keyword) {
                            if (item.name === key) {
                                if (item.type === 'in') {
                                    _self.values.push(paras.keyword[key]);
                                    _self.parameter.push(symbol);
                                }
                                else {
                                    _self.parameter.push(`@${item.name}`);
                                }
                                matched = true;
                                break;
                            }
                        }
                        if (!matched) {
                            if (!item.mandatory) {
                                if (item.type && item.type !== 'in') {
                                    _self.parameter.push(`@${item.name}`);
                                }
                                else if (item.defaultValue != null) {
                                    _self.values.push(item.defaultValue);
                                    _self.parameter.push(symbol);
                                }
                                else {
                                    error.push(item);
                                }
                            }
                            else {
                                error.push(item);
                            }
                        }
                    }
                    if (error.length > 0) {
                        console.log('error', error);
                        reject('Parameter error');
                        return;
                    }
                    _self.call = `CALL ${paras.proc_name}(${_self.parameter.join(', ')});`;
                    this.execute(db.READER, _self.call, _self.values)
                        .then(resolve)
                        .catch(err => {
                        console.log('An error occurred while executing execute query proc.', err);
                        reject(err);
                    });
                });
            },
        };
        return new Promise((resolve, reject) => {
            const workshop = factory[database];
            if (workshop) {
                workshop().then(resolve).catch(reject);
            }
            else {
                reject(`We are very sorry, OFranmework currently does not support the ${database} database!`);
            }
        });
    }
}
// === 工厂函数 ===
function service(oodbc, _database, _instance) {
    return new Service(oodbc, _database, _instance);
}
// export default service;
export { Service, service };
