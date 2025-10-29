/**
 * SQL Server 对象关系实例
 * 单例数据库操作管理者，负责 SQL Server 的基本 CRUD
 */
import { BaseActionManager } from '../BaseActionManager.js';
import * as GrammarParameter from '../grammar/sqlserver.js';
/**
 * SQL Server 单例操作管理器
 */
class SQLServerActionManager extends BaseActionManager {
    static Connection;
    static Request;
    static TYPES;
    static connectionCfg;
    /**
     * 初始化连接配置（单例）
     */
    static init(config) {
        const tedious = require('tedious');
        const Connection = tedious.Connection;
        this.Request = tedious.Request;
        this.TYPES = tedious.TYPES;
        const connectionCfg = {
            server: config.host,
            authentication: {
                type: 'default',
                options: {
                    userName: config.user,
                    password: config.password,
                },
            },
            options: {
                encrypt: config.encrypt || false,
                port: config.port || 1433,
                database: config.database,
            },
        };
        this.Connection = Connection;
        this.connectionCfg = connectionCfg;
    }
    /**
     * 创建事务连接
     */
    static createTransaction() {
        const self = this;
        return new Promise((resolve, reject) => {
            const conn = new self.Connection(self.connectionCfg);
            conn.on('connect', (err) => {
                if (err) {
                    console.error('Error creating SQL Server transaction access connection', err);
                    return reject(err);
                }
                console.log('SQL Server transaction access connection has been created');
                const transaction = { client: conn };
                transaction.begin = () => {
                    return new Promise((res, rej) => {
                        conn.beginTransaction((err) => {
                            if (err)
                                rej(err);
                            else
                                res();
                        });
                    });
                };
                transaction.commit = () => {
                    return new Promise((res) => {
                        conn.commitTransaction(() => {
                            conn.close();
                            res('Transaction submitted successfully');
                        });
                    });
                };
                transaction.rollback = () => {
                    return new Promise((res) => {
                        conn.rollbackTransaction(() => {
                            conn.close();
                            res('Transaction rolled back');
                        });
                    });
                };
                resolve(transaction);
            });
        });
    }
    /**
     * 执行 SQL（每次新建连接）
     */
    static execute(sql, parameters = []) {
        const self = this;
        return new Promise((resolve, reject) => {
            const conn = new self.Connection(self.connectionCfg);
            conn.on('connect', (err) => {
                if (err) {
                    console.error('SQL Server access connection error', err);
                    return reject(err);
                }
                console.log('SQL Server access connection has been created');
                const rows = [];
                let rowCount = 0;
                const request = new self.Request(sql, (err, rc) => {
                    if (err) {
                        console.log('Error creating SQL execution request', err);
                        conn.close();
                        return reject(err);
                    }
                    rowCount = rc;
                    conn.close();
                    resolve({ rows, rowCount });
                });
                // 添加参数
                parameters.forEach(p => {
                    const type = self.TYPES[p.sqlType] || self.TYPES.VarChar;
                    request.addParameter(p.name, type, p.value);
                });
                request.on('row', (columns) => {
                    const row = {};
                    columns.forEach((col) => {
                        row[col.metadata.colName] = col.value;
                    });
                    rows.push(row);
                });
                conn.execSql(request);
            });
        });
    }
    /**
     * 执行事务 SQL
     */
    static executeTransaction(sql, parameters, transaction) {
        return new Promise((resolve, reject) => {
            const rows = [];
            let rowCount = 0;
            const request = new this.Request(sql, (err, rc) => {
                if (err) {
                    return reject(err);
                }
                rowCount = rc;
                resolve({ rows, rowCount });
            });
            parameters.forEach(p => {
                const type = this.TYPES[p.sqlType] || this.TYPES.VarChar;
                request.addParameter(p.name, type, p.value);
            });
            request.on('row', (columns) => {
                const row = {};
                columns.forEach((col) => {
                    row[col.metadata.colName] = col.value;
                });
                rows.push(row);
            });
            transaction.client.execSql(request);
        });
    }
    /**
     * 查询单条记录
     */
    static queryEntity(params, option = { transaction: null }) {
        const p = GrammarParameter.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where}${p.orderBy}${p.limit};`;
        if (option.transaction) {
            return this.executeTransaction(sql, p.parameters, option.transaction)
                .then(result => result.rows[0] || null)
                .catch(err => {
                console.log('Error when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, p.parameters)
                .then(result => result.rows[0] || null)
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
        const p = GrammarParameter.getParameters(params);
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} t ${p.where} ${p.orderBy}${p.limit};`;
        const countSql = `SELECT COUNT(0) AS total FROM ${params.configs.tableName} t ${p.where};`;
        const exec = option.transaction
            ? (q, params) => this.executeTransaction(q, params, option.transaction)
            : this.execute.bind(this);
        return Promise.all([
            exec(sql, p.parameters),
            exec(countSql, p.parameters),
        ]).then(([dataRes, countRes]) => {
            return {
                data: dataRes.rows,
                recordsTotal: countRes.rows[0]?.total ?? 0,
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
        const p = GrammarParameter.getParameters({ ...params, limit: [limit[0], fetchCount] });
        const sql = `SELECT ${p.select} FROM ${params.configs.tableName} AS t ${p.where} ${p.orderBy} OFFSET ${limit[0]} ROWS FETCH NEXT ${fetchCount} ROWS ONLY;`;
        const exec = option.transaction
            ? (q, params) => this.executeTransaction(q, params, option.transaction)
            : this.execute.bind(this);
        return exec(sql, p.parameters).then(result => {
            const rows = result.rows;
            const isLastPage = rows.length <= limit[1];
            return {
                data: isLastPage ? rows : rows.slice(0, -1),
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
        let index = 0;
        for (const key in insertion) {
            f.push(key);
            index++;
            s.push(`@${key}${index}`);
            p.push({
                name: `${key}${index}`,
                sqlType: this.getSqlType(key, params.configs.fields || []),
                value: insertion[key],
            });
        }
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES (${s.join(', ')});`;
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
        let index = 0;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const s2 = [];
            for (const key in item) {
                if (i === 0)
                    f.push(key);
                index++;
                s2.push(`@${key}${i}`);
                p.push({
                    name: `${key}${i}`,
                    sqlType: this.getSqlType(key, params.configs.fields || []),
                    value: item[key],
                });
            }
            s.push(`(${s2.join(', ')})`);
        }
        const sql = `INSERT INTO ${params.configs.tableName} (${f.join(', ')}) VALUES ${s.join(', ')};`;
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
        const p = GrammarParameter.getDeleteParameters(params);
        const sql = `DELETE FROM ${params.configs.tableName} WHERE ${p.where};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction)
            : this.execute(sql, p.parameters);
    }
    /**
     * 更新
     */
    static updateEntity(params, option = { transaction: null }) {
        const p = GrammarParameter.getUpdateParameters(params);
        const sql = `UPDATE ${params.configs.tableName} SET ${p.set.join(', ')} WHERE ${p.where}${p.limit};`;
        return option.transaction
            ? this.executeTransaction(sql, p.parameters, option.transaction)
            : this.execute(sql, p.parameters);
    }
    /**
     * 聚合统计
     */
    static statsByAggregate(params, option = { transaction: null }) {
        const p = GrammarParameter.getParameters(params);
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
            ? this.executeTransaction(sql, p.parameters, option.transaction).then(r => r.rows)
            : this.execute(sql, p.parameters).then(r => r.rows);
    }
    /**
     * 自定义 SQL（谨慎使用）
     */
    static streak(sql, parameters = [], option = { transaction: null }) {
        if (option.transaction) {
            return this.executeTransaction(sql, parameters, option.transaction)
                .then(r => r.rows)
                .catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
        else {
            return this.execute(sql, parameters)
                .then(r => r.rows)
                .catch(err => {
                console.error('Exception when executing execute query data list', err);
                return Promise.reject(err);
            });
        }
    }
    /**
     * 字段类型映射
     */
    static getSqlType(fieldName, fields) {
        const field = fields.find(f => f.name === fieldName);
        if (!field)
            return 'VarChar';
        return GrammarParameter.sqlTypeHandle(field.type);
    }
}
export { SQLServerActionManager };
