/**
 * SQLite 对象关系实例
 * 单例数据库操作管理者，负责 SQLite 的基本 CRUD
 */
import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarSqlite from '../grammar/sqlite.js';
/**
 * SQLite 单例操作管理器
 */
class SQLiteActionManager extends BaseActionManager {
    static conn;
    static host;
    /**
     * 初始化数据库（单例）
     */
    static init(config) {
        const SQLite3 = require('sqlite3').verbose();
        this.host = config.host;
        this.conn = new SQLite3.Database(config.host, (err) => {
            if (err) {
                console.log('SQLite database connection exception', err);
            }
            else {
                console.log('SQLite database connection successful');
            }
        });
    }
    /**
     * 连接数据库（延迟初始化）
     */
    static connectDataBase() {
        const self = this;
        return new Promise((resolve, reject) => {
            if (!self.conn) {
                const SQLite3 = require('sqlite3').verbose();
                self.conn = new SQLite3.Database(self.host, (err) => {
                    if (err)
                        reject(new Error(err));
                    else
                        resolve(self.conn);
                });
            }
            else {
                resolve(self.conn);
            }
        });
    }
    /**
     * 创建事务连接（共享单例连接）
     */
    static createTransaction() {
        const self = this;
        return new Promise((resolve, reject) => {
            if (!self.conn) {
                return reject(new Error('SQLite connection not initialized'));
            }
            const transaction = { client: self.conn };
            transaction.begin = () => {
                return new Promise((res) => {
                    transaction.client.run('BEGIN');
                    res();
                });
            };
            transaction.commit = () => {
                return new Promise((res) => {
                    transaction.client.run('COMMIT');
                    res('Transaction submitted successfully');
                });
            };
            transaction.rollback = () => {
                return new Promise((res) => {
                    transaction.client.run('ROLLBACK');
                    res('Transaction rolled back');
                });
            };
            resolve(transaction);
        });
    }
    /**
     * 执行 SQL（自动选择 run/get/all）
     */
    static execute(sql, parameters = [], mode = 'run') {
        const self = this;
        return new Promise((resolve, reject) => {
            if (self.conn) {
                console.time('【onela】SQL execution time');
                self.conn[mode](sql, parameters, function (err, data) {
                    console.timeEnd('【onela】SQL execution time');
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data !== undefined ? data : 'success');
                    }
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
    static executeTransaction(sql, parameters, transaction, mode = 'run') {
        return new Promise((resolve, reject) => {
            if (transaction && transaction.client) {
                console.time('【onela】SQL execution time');
                transaction.client[mode](sql, parameters, function (err, data) {
                    console.timeEnd('【onela】SQL execution time');
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data !== undefined ? data : 'success');
                    }
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
        const p = GrammarSqlite.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;
        if (option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction, 'get')
                .catch(err => {
                console.log('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, p.parameters, 'get')
                .catch(err => {
                console.error('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
    /**
     * 分页查询 + 总数
     */
    static queryEntityList(params, option = { transaction: null }) {
        const p = GrammarSqlite.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
        const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;
        const exec = option.transaction
            ? (q, params, mode) => this.executeTransaction(q, params, option.transaction, mode)
            : (q, params, mode) => this.execute(q, params, mode);
        return Promise.all([
            exec(sql, p.parameters, 'all'),
            exec(countSql, p.parameters, 'get'),
        ]).then(([data, count]) => {
            return {
                data,
                recordsTotal: count?.total ?? 0,
            };
        }).catch(err => {
            console.log('Error when executing execute query data list', err);
            return Promise.reject(err);
        });
    }
    /**
     * 瀑布流查询（判断末尾）
     */
    static queryWaterfallList(params, option = { transaction: null }) {
        const limit = params.limit || [0, 10];
        const fetchCount = limit[1] + 1;
        const p = GrammarSqlite.getParameters({ ...params, limit: [limit[0], fetchCount] });
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} LIMIT ? OFFSET ?;`;
        p.parameters.push(fetchCount, limit[0]);
        const exec = option.transaction
            ? (q, params) => this.executeTransaction(q, params, option.transaction, 'all')
            : (q, params) => this.execute(q, params, 'all');
        return exec(sql, p.parameters).then(data => {
            const isLastPage = data.length <= limit[1];
            return {
                data: isLastPage ? data : data.slice(0, -1),
                isLastPage,
            };
        }).catch(err => {
            console.error('Error when executing execute query data list', err);
            return Promise.reject(err);
        });
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
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;
        const executeFn = option.transaction
            ? () => this.executeTransaction(sql, p, option.transaction, 'run')
            : () => this.execute(sql, p, 'run');
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
            s.push(`(${s2.join(', ')})`);
        }
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;
        return option.transaction
            ? this.executeTransaction(sql, p, option.transaction, 'run')
            : this.execute(sql, p, 'run');
    }
    /**
     * 物理删除
     */
    static deleteEntity(params, option = { transaction: null }) {
        if ((!params.keyword || params.keyword.length === 0) && (!params.where || params.where.length === 0)) {
            return Promise.reject('Deletion conditions need to be specified to prevent the entire table data from being accidentally deleted.');
        }
        const p = GrammarSqlite.getDeleteParameters(params);
        const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
            : this.execute(sql, p.parameters, 'run');
    }
    /**
     * 更新
     */
    static updateEntity(params, option = { transaction: null }) {
        const p = GrammarSqlite.getUpdateParameters(params);
        let limitSql = '';
        if (params.limit) {
            limitSql = ' LIMIT ?';
            p.parameters.push(params.limit);
        }
        const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${limitSql};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction, 'run')
            : this.execute(sql, p.parameters, 'run');
    }
    /**
     * 聚合统计
     */
    static statsByAggregate(params, option = { transaction: null }) {
        const p = GrammarSqlite.getParameters(params);
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
            ? this.executeTransaction(sql, p.parameters, option.transaction, 'all')
            : this.execute(sql, p.parameters, 'all');
    }
    /**
     * 自定义 SQL（谨慎使用）
     */
    static streak(sql, parameters = [], option = { transaction: null }) {
        const mode = sql.trim().toLowerCase().startsWith('select') ? 'all' : 'run';
        if (option.transaction) {
            return this.executeTransaction(sql, parameters, option.transaction, mode)
                .catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, parameters, mode)
                .catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
}
export { SQLiteActionManager };
