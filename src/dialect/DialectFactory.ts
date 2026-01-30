/**
 * DialectFactory - 方言工厂
 * 统一管理和创建数据库方言实例
 */

import type { IDialect, IDialectFactory } from './IDialect.js';
import { MySQLDialect, MariaDBDialect, TiDBDialect } from './MySQLDialect.js';
import { PostgreSQLDialect } from './PostgreSQLDialect.js';
import { SQLiteDialect } from './SQLiteDialect.js';
import { SQLServerDialect } from './SQLServerDialect.js';
import { OracleDialect } from './OracleDialect.js';

/**
 * 方言工厂实现
 */
class DialectFactoryImpl implements IDialectFactory {
  private dialects: Map<string, IDialect> = new Map();
  private factories: Map<string, () => IDialect> = new Map();

  constructor() {
    // 注册内置方言工厂
    this.registerFactory('mysql', () => new MySQLDialect());
    this.registerFactory('mariadb', () => new MariaDBDialect());
    this.registerFactory('tidb', () => new TiDBDialect());
    this.registerFactory('postgresql', () => new PostgreSQLDialect());
    this.registerFactory('postgres', () => new PostgreSQLDialect()); // 别名
    this.registerFactory('pg', () => new PostgreSQLDialect()); // 别名
    this.registerFactory('sqlite', () => new SQLiteDialect());
    this.registerFactory('sqlite3', () => new SQLiteDialect()); // 别名
    this.registerFactory('sqlserver', () => new SQLServerDialect());
    this.registerFactory('mssql', () => new SQLServerDialect()); // 别名
    this.registerFactory('oracle', () => new OracleDialect());

    // MySQL 协议兼容数据库
    this.registerFactory('oceanbase', () => new MySQLDialect());
    this.registerFactory('polardb', () => new MySQLDialect());
    this.registerFactory('tdsql', () => new MySQLDialect());
    this.registerFactory('greatsql', () => new MySQLDialect());
  }

  /**
   * 注册方言工厂函数
   */
  private registerFactory(type: string, factory: () => IDialect): void {
    this.factories.set(type.toLowerCase(), factory);
  }

  /**
   * 创建方言实例（单例模式）
   */
  create(type: string): IDialect {
    const normalizedType = type.toLowerCase();

    // 检查是否已有实例
    if (this.dialects.has(normalizedType)) {
      return this.dialects.get(normalizedType)!;
    }

    // 获取工厂函数
    const factory = this.factories.get(normalizedType);
    if (!factory) {
      throw new Error(
        `Unsupported database dialect: ${type}. ` +
        `Supported types: ${this.getSupported().join(', ')}`
      );
    }

    // 创建并缓存实例
    const dialect = factory();
    this.dialects.set(normalizedType, dialect);
    return dialect;
  }

  /**
   * 注册自定义方言
   */
  register(type: string, dialect: IDialect): void {
    const normalizedType = type.toLowerCase();
    this.dialects.set(normalizedType, dialect);
    this.factories.set(normalizedType, () => dialect);
  }

  /**
   * 获取支持的数据库类型列表
   */
  getSupported(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * 检查是否支持指定类型
   */
  isSupported(type: string): boolean {
    return this.factories.has(type.toLowerCase());
  }

  /**
   * 清除缓存的实例（用于测试）
   */
  clearCache(): void {
    this.dialects.clear();
  }
}

// 导出单例
export const DialectFactory = new DialectFactoryImpl();

// 导出所有方言类
export {
  MySQLDialect,
  MariaDBDialect,
  TiDBDialect,
  PostgreSQLDialect,
  SQLiteDialect,
  SQLServerDialect,
  OracleDialect,
};
