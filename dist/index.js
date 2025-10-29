/**
 * Onela 核心模块
 * 多数据库统一管理 + 模型基类
 */
import { MySQLActionManager } from './instance/MySQLActionManager.js';
import { PostgreSQLActionManager } from './instance/PostgreSQLActionManager.js';
import { SQLiteActionManager } from './instance/SQLiteSQLActionManager.js';
import { SQLServerActionManager } from './instance/SQLServerActionManager.js';
/**
 * Onela 主类：多数据库管理
 */
class Onela {
    static _connections = {};
    /**
     * 根据类型获取 ActionManager 类
     */
    static getActionManagerClass(db_type) {
        switch (db_type.toLowerCase()) {
            case 'mysql':
                return MySQLActionManager;
            case 'postgresql':
                return PostgreSQLActionManager;
            case 'sqlite':
                return SQLiteActionManager;
            case 'sqlserver':
                return SQLServerActionManager;
            default:
                return null;
        }
    }
    /**
     * 初始化多个数据库连接
     */
    static init(config_list) {
        for (const tempConfig of config_list) {
            const temp_am_class = this.getActionManagerClass(tempConfig.type);
            if (temp_am_class) {
                const instance = temp_am_class;
                instance.init(tempConfig.value);
                this._connections[tempConfig.engine] = instance;
            }
            else {
                console.error(`Database instance type "${tempConfig.type}" does not exist`);
            }
        }
    }
    /**
     * 获取数据库操作实例
     */
    static getActionManager(engine) {
        if (!(engine in this._connections)) {
            return Promise.reject(new Error(`invalid engine: ${engine}`));
        }
        return Promise.resolve(this._connections[engine]);
    }
    /**
     * 获取事务实例（自动开启）
     */
    static getActionTransaction(engine) {
        if (!(engine in this._connections)) {
            return Promise.reject(new Error(`invalid engine: ${engine}`));
        }
        return this._connections[engine].createTransaction().then(async (connection) => {
            await connection.begin();
            return connection;
        });
    }
}
/**
 * 模型基类：封装 CRUD
 */
class OnelaBaseModel {
    static action_manager = null;
    static configs = {
        fields: [],
        tableName: '',
        engine: 'default',
    };
    /**
     * 获取 ActionManager（延迟加载）
     */
    static getActionManager() {
        if (!this.action_manager) {
            this.action_manager = Onela.getActionManager(this.configs.engine);
        }
        return this.action_manager;
    }
    /**
     * 获取事务（自动开启）
     */
    static transaction() {
        return Onela.getActionTransaction(this.configs.engine);
    }
    /**
     * 查询单条
     */
    static queryEntity(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.queryEntity(params, option));
    }
    /**
     * 查询列表 + 总数
     */
    static queryEntityList(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.queryEntityList(params, option));
    }
    /**
     * 瀑布流查询
     */
    static queryWaterfallList(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.queryWaterfallList(params, option));
    }
    /**
     * 新增
     */
    static insert(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.insert(params, option));
    }
    /**
     * 批量新增
     */
    static insertBatch(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.insertBatch(params, option));
    }
    /**
     * 删除
     */
    static deleteEntity(args, option) {
        if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
            return Promise.reject(new Error('paras.where delete condition (array) must exist condition'));
        }
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.deleteEntity(params, option));
    }
    /**
     * 更新
     */
    static updateEntity(args, option) {
        if ((!args.keyword || args.keyword.length === 0) && (!args.where || args.where.length === 0)) {
            return Promise.reject(new Error('paras.where update condition (array) must exist condition'));
        }
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.updateEntity(params, option));
    }
    /**
     * 聚合统计
     */
    static getEntityByAggregate(args, option) {
        const params = { ...args, configs: this.configs };
        return this.getActionManager().then(am => am.statsByAggregate(params, option));
    }
    /**
     * 自定义 SQL（谨慎）
     */
    static streak(sql, parameters = [], option) {
        return this.getActionManager().then(am => {
            if (am.streak) {
                return am.streak(sql, parameters, option);
            }
            else {
                return Promise.reject(new Error('This type of database does not support the streak method'));
            }
        });
    }
}
export { Onela, OnelaBaseModel };
