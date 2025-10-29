/**
 * MySQL 对象关系实例
 * 单例数据库操作管理者，负责 MySQL 的基本 CRUD
 */
import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarMysql from '../grammar/mysql.js';
/**
 * MySQL 单例操作管理器
 */
class MySQLActionManager extends BaseActionManager {
    static conn;
    /**
     * 初始化连接池（单例）
     */
    static init(config) {
        const mysql = require('mysql');
        const connPool = mysql.createPool(config);
        this.conn = connPool;
    }
    /**
     * 创建事务连接
     */
    static createTransaction() {
        const self = this;
        return new Promise((resolve, reject) => {
            if (!self.conn) {
                return reject(new Error('Connection pool not initialized'));
            }
            self.conn.getConnection((err, connection) => {
                if (err) {
                    console.log('An exception occurred when creating a transaction connection', err);
                    return reject(new Error('An exception occurred when creating a transaction connection'));
                }
                const transaction = { client: connection };
                // 开始事务
                transaction.begin = () => {
                    return new Promise((res, rej) => {
                        connection.beginTransaction((err) => {
                            if (err)
                                rej(err);
                            else
                                res();
                        });
                    });
                };
                // 提交事务
                transaction.commit = () => {
                    return new Promise((res) => {
                        connection.commit(() => {
                            res('Transaction submitted successfully');
                            connection.release();
                        });
                    });
                };
                // 回滚事务
                transaction.rollback = () => {
                    return new Promise((res) => {
                        connection.rollback(() => {
                            res('Transaction rolled back');
                            connection.release();
                        });
                    });
                };
                resolve(transaction);
            });
        });
    }
    /**
     * 执行 SQL（连接池）
     */
    static execute(sql, parameters = []) {
        const self = this;
        return new Promise((resolve, reject) => {
            if (self.conn) {
                self.conn.query(sql, parameters, (err, doc) => {
                    if (err)
                        reject(err);
                    else
                        resolve(doc);
                });
            }
            else {
                reject(new Error('The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig.'));
            }
        });
    }
    /**
     * 执行事务 SQL
     */
    static executeTransaction(sql, parameters, transaction) {
        return new Promise((resolve, reject) => {
            if (transaction && transaction.client) {
                transaction.client.query(sql, parameters, (err, doc) => {
                    if (err)
                        reject(err);
                    else
                        resolve(doc);
                });
            }
            else {
                reject(new Error('The database instance engine instance is not pointed correctly. Please check whether the singleton configs configuration is consistent with the engine configured in dbconfig.'));
            }
        });
    }
    /**
     * 查询单条记录
     */
    static queryEntity(params, option = { transaction: null }) {
        const p = GrammarMysql.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;
        if (option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction).catch(err => {
                console.log('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, p.parameters).catch(err => {
                console.error('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
    /**
     * 分页查询 + 总数
     */
    static queryEntityList(params, option = { transaction: null }) {
        const p = GrammarMysql.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
        const countSql = `SELECT COUNT(0) total FROM ${params.configs.tableName} t ${p.where};`;
        if (option.transaction) {
            return Promise.all([
                this.executeTransaction(sql, p.parameters, option.transaction),
                this.executeTransaction(countSql, p.parameters, option.transaction),
            ]).then(([data, count]) => {
                return { data, recordsTotal: count[0]?.total ?? 0 };
            }).catch(err => {
                console.log('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return Promise.all([
                this.execute(sql, p.parameters),
                this.execute(countSql, p.parameters),
            ]).then(([data, count]) => {
                return { data, recordsTotal: count[0]?.total ?? 0 };
            }).catch(err => {
                console.error('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
    /**
     * 瀑布流查询（判断末尾）
     */
    static queryWaterfallList(params, option = { transaction: null }) {
        const limit = params.limit || [0, 10];
        const fetchCount = limit[1] + 1;
        const p = GrammarMysql.getParameters({ ...params, limit: [limit[0], fetchCount] });
        const sql = [`SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} LIMIT ?, ?;`];
        p.parameters.push(limit[0], fetchCount);
        if (option.transaction) {
            return this.executeTransaction(sql.join(''), p.parameters, option.transaction).then(data => {
                const result = { data, isLastPage: false };
                if (data.length === 0) {
                    result.isLastPage = true;
                }
                else if (data.length < limit[1]) {
                    result.isLastPage = true;
                }
                else if (data.length > limit[1]) {
                    result.data.pop();
                }
                return result;
            }).catch(err => {
                console.error('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql.join(''), p.parameters).then(data => {
                const result = { data, isLastPage: false };
                if (data.length === 0) {
                    result.isLastPage = true;
                }
                else if (data.length < limit[1]) {
                    result.isLastPage = true;
                }
                else if (data.length > limit[1]) {
                    result.data.pop();
                }
                return result;
            }).catch(err => {
                console.error('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
    /**
     * 新增
     */
    static insert(params, option = { transaction: null }) {
        const insertion = params.insertion;
        const p = [], f = [], s = [];
        for (const key in insertion) {
            f.push(key);
            s.push('?');
            p.push(insertion[key]);
        }
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(',')}) VALUES (${s.join(',')});`;
        const executeFn = option.transaction
            ? () => this.executeTransaction(sql, p, option.transaction)
            : () => this.execute(sql, p);
        return executeFn().then(data => {
            return { ...insertion, _returns: data };
        });
    }
    /**
     * 批量新增
     */
    static insertBatch(params, option = { transaction: null }) {
        const list = params.insertion;
        const p = [], f = [], s = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const s2 = [];
            for (const key in item) {
                if (i === 0)
                    f.push(`\`${key}\``);
                p.push(item[key]);
                s2.push('?');
            }
            s.push(`(${s2.join(',')})`);
        }
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(',')}) VALUES ${s.join(',')};`;
        return option.transaction
            ? this.executeTransaction(sql, p, option.transaction)
            : this.execute(sql, p);
    }
    /**
     * 物理删除
     */
    static deleteEntity(params, option = { transaction: null }) {
        if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
            return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');
        }
        const p = GrammarMysql.getDeleteParameters(params);
        const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction)
            : this.execute(sql, p.parameters);
    }
    /**
     * 更新
     */
    static updateEntity(params, option = { transaction: null }) {
        const p = GrammarMysql.getUpdateParameters(params);
        let limitSql = '';
        if (params.limit) {
            limitSql = ' LIMIT ?';
            p.parameters.push(params.limit);
        }
        const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction)
            : this.execute(sql, p.parameters);
    }
    /**
     * 聚合统计
     */
    static statsByAggregate(params, option = { transaction: null }) {
        const p = GrammarMysql.getParameters(params);
        const check = {
            count: 'COUNT', sum: 'SUM', max: 'MAX', min: 'MIN', abs: 'ABS', avg: 'AVG',
        };
        const show = [];
        for (const agg of params.aggregate) {
            const fn = check[agg.function.toLowerCase()];
            if (fn) {
                show.push(`${fn}(${agg.field}) AS ${agg.name}`);
            }
        }
        const sql = `SELECT ${show.join(', ')} FROM ${params.configs.tableName} ${p.where}${p.limit};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction)
            : this.execute(sql, p.parameters);
    }
    /**
     * 自定义 SQL（谨慎使用）
     */
    static streak(sql, parameters = [], option = { transaction: null }) {
        if (option.transaction) {
            return this.executeTransaction(sql, parameters, option.transaction).catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, parameters).catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
}
export { MySQLActionManager };
