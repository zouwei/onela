/**
 * 真实数据库集成测试
 * 覆盖: MySQL, PostgreSQL, MariaDB, SQLite
 * 测试: CRUD、事务、聚合、分页、批量操作、原生SQL
 *
 * 环境: 通过环境变量配置（MYSQL_HOST, PG_HOST, MARIADB_HOST 等）
 *   SQLite - 本地文件 (内存模式)
 */

import { Onela, OnelaBaseModel } from '../../src/index.v2.js';
import type { Configs } from '../../src/index.v2.js';
import { MySQLActionManagerV2 } from '../../src/instance/MySQLActionManagerV2.js';
import { PostgreSQLActionManagerV2 } from '../../src/instance/PostgreSQLActionManagerV2.js';
import { SQLiteActionManagerV2 } from '../../src/instance/SQLiteActionManagerV2.js';
import * as mysql2 from 'mysql2';
import * as pg from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ==================== 配置（从环境变量读取） ====================

const MYSQL_CONFIG = {
  connectionLimit: 3,
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'test',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'onela_test',
};

const PG_CONFIG = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'test',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'onela_test',
  max: 3,
};

const MARIADB_CONFIG = {
  connectionLimit: 3,
  host: process.env.MARIADB_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT) || 3307,
  user: process.env.MARIADB_USER || 'test',
  password: process.env.MARIADB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || 'onela_test',
};

const SQLITE_DB_PATH = path.join(os.tmpdir(), `onela_test_${Date.now()}.db`);

// ==================== 连接池（直接使用驱动） ====================

let mysqlPool: any;
let pgPool: any;
let mariadbPool: any;
let sqliteDb: any;

// ==================== 辅助函数 ====================

function mysqlQuery(pool: any, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err: any, results: any) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function pgQuery(pool: any, sql: string, params: any[] = []): Promise<any> {
  return pool.query(sql, params).then((r: any) => r.rows);
}

function sqliteExec(db: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sqliteAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ==================== 连接检测 ====================

async function canConnectMySQL(): Promise<boolean> {
  try {
    const pool = mysql2.createPool(MYSQL_CONFIG);
    await mysqlQuery(pool, 'SELECT 1');
    pool.end();
    return true;
  } catch { return false; }
}

async function canConnectPG(): Promise<boolean> {
  try {
    const pool = new pg.Pool(PG_CONFIG);
    await (pool as any).query('SELECT 1');
    await pool.end();
    return true;
  } catch { return false; }
}

async function canConnectMariaDB(): Promise<boolean> {
  try {
    const pool = mysql2.createPool(MARIADB_CONFIG);
    await mysqlQuery(pool, 'SELECT 1');
    pool.end();
    return true;
  } catch { return false; }
}

// ==================== 测试套件 ====================

describe('Real Database Integration Tests', () => {
  const TABLE_NAME = 'onela_test_items';

  // ==================== MySQL ====================
  describe('MySQL (192.168.3.56:3306)', () => {
    let mysqlAvailable = false;

    beforeAll(async () => {
      mysqlAvailable = await canConnectMySQL();
      if (!mysqlAvailable) return;

      mysqlPool = mysql2.createPool(MYSQL_CONFIG);

      // 创建测试表
      await mysqlQuery(mysqlPool, `DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await mysqlQuery(mysqlPool, `
        CREATE TABLE ${TABLE_NAME} (
          id INT NOT NULL AUTO_INCREMENT,
          title VARCHAR(200) NOT NULL,
          content TEXT,
          amount DECIMAL(10,2) DEFAULT 0.00,
          status INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 初始化 MySQL 引擎（传入 mysql2 模块以避免动态 import 问题）
      MySQLActionManagerV2.init(MYSQL_CONFIG, mysql2);
      (Onela as any)._connections['mysql_test'] = MySQLActionManagerV2;
    }, 30000);

    afterAll(async () => {
      if (!mysqlAvailable) return;
      await mysqlQuery(mysqlPool, `DROP TABLE IF EXISTS ${TABLE_NAME}`);
      mysqlPool.end();
    });

    // 定义 MySQL 模型
    class MySQLItem extends OnelaBaseModel {
      static configs = {
        tableName: TABLE_NAME,
        engine: 'mysql_test',
        fields: [
          { name: 'id', type: 'int', default: null, increment: true },
          { name: 'title', type: 'varchar' },
          { name: 'content', type: 'text', default: '' },
          { name: 'amount', type: 'decimal', default: 0 },
          { name: 'status', type: 'int', default: 0 },
          { name: 'created_at', type: 'datetime', default: () => new Date() },
        ],
      } as Configs;
    }

    it('should INSERT a record', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.insert({ title: 'MySQL测试', content: '内容A', amount: 99.5 });
      expect(result).toBeDefined();
      expect(result.insertId).toBeGreaterThan(0);
    });

    it('should SELECT (findOne) the inserted record', async () => {
      if (!mysqlAvailable) return;
      const row = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'MySQL测试' }],
      });
      expect(row).toBeDefined();
      expect(row.title).toBe('MySQL测试');
      expect(Number(row.amount)).toBeCloseTo(99.5);
    });

    it('should findAll records', async () => {
      if (!mysqlAvailable) return;
      const rows = await MySQLItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should UPDATE a record', async () => {
      if (!mysqlAvailable) return;
      const row = await MySQLItem.findOne({ where: [] });
      const result = await MySQLItem.update({
        update: [{ key: 'title', value: 'MySQL更新', operator: 'replace' }],
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      expect(result).toBeDefined();
      const updated = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      expect(updated.title).toBe('MySQL更新');
    });

    it('should batch INSERT (inserts)', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.inserts([
        { title: '批量A' },
        { title: '批量B' },
        { title: '批量C' },
      ]);
      expect(result).toBeDefined();
      const rows = await MySQLItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should do pagination (findList)', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.findList({
        where: [],
        limit: [0, 2],
      });
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.recordsTotal).toBeGreaterThanOrEqual(4);
    });

    it('should do aggregate (COUNT)', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.aggregate({
        aggregate: [{ function: 'count', field: 'id', name: 'total' }],
      });
      expect(result).toBeDefined();
      const row = Array.isArray(result) ? result[0] : (result.rows ? result.rows[0] : result);
      expect(Number(row.total)).toBeGreaterThanOrEqual(4);
    });

    it('should execute raw SQL', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.sql(`SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`);
      const rows = Array.isArray(result) ? result : (result.rows || [result]);
      expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(4);
    });

    it('should DELETE records', async () => {
      if (!mysqlAvailable) return;
      const result = await MySQLItem.delete({
        where: [{ logic: 'and', key: 'title', operator: '=', value: '批量C' }],
      });
      expect(result).toBeDefined();
      const check = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: '批量C' }],
      });
      expect(check).toBeNull();
    });

    it('should handle transaction (commit)', async () => {
      if (!mysqlAvailable) return;
      const t = await MySQLItem.transaction();
      try {
        await MySQLItem.insert({ title: '事务测试' }, { transaction: t });
        await t.commit();
      } catch {
        await t.rollback();
      }
      const row = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: '事务测试' }],
      });
      expect(row).toBeDefined();
      expect(row.title).toBe('事务测试');
    });

    it('should handle transaction (rollback)', async () => {
      if (!mysqlAvailable) return;
      const countBefore = await MySQLItem.findAll({ where: [] });
      const t = await MySQLItem.transaction();
      try {
        await MySQLItem.insert({ title: '回滚测试' }, { transaction: t });
        // 故意回滚
        await t.rollback();
      } catch {
        await t.rollback();
      }
      const countAfter = await MySQLItem.findAll({ where: [] });
      expect(countAfter.length).toBe(countBefore.length);
    });

    it('should query with IN operator', async () => {
      if (!mysqlAvailable) return;
      const rows = await MySQLItem.findAll({
        where: [{ logic: 'and', key: 'title', operator: 'in', value: ['批量A', '批量B'] }],
      });
      expect(rows.length).toBe(2);
    });

    it('should query with LIKE operator', async () => {
      if (!mysqlAvailable) return;
      const rows = await MySQLItem.findAll({
        where: [{ logic: 'and', key: 'title', operator: '%%', value: '批量' }],
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should query with ORDER BY', async () => {
      if (!mysqlAvailable) return;
      const rows = await MySQLItem.findAll({
        where: [],
        orderBy: { id: 'DESC' },
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].id).toBeGreaterThan(rows[rows.length - 1].id);
    });

    it('should UPDATE with plus operator', async () => {
      if (!mysqlAvailable) return;
      const row = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'MySQL更新' }],
      });
      await MySQLItem.update({
        update: [{ key: 'amount', value: 10, operator: 'plus' }],
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      const updated = await MySQLItem.findOne({
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      expect(Number(updated.amount)).toBeCloseTo(Number(row.amount) + 10);
    });
  });

  // ==================== PostgreSQL ====================
  describe('PostgreSQL (192.168.3.56:5432)', () => {
    let pgAvailable = false;

    beforeAll(async () => {
      pgAvailable = await canConnectPG();
      if (!pgAvailable) return;

      pgPool = new pg.Pool(PG_CONFIG);

      await pgPool.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await pgPool.query(`
        CREATE TABLE ${TABLE_NAME} (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          content TEXT DEFAULT '',
          amount DECIMAL(10,2) DEFAULT 0.00,
          status INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 初始化 PostgreSQL 引擎（传入 pg 模块）
      PostgreSQLActionManagerV2.init(PG_CONFIG, pg);
      (Onela as any)._connections['pg_test'] = PostgreSQLActionManagerV2;
    }, 30000);

    afterAll(async () => {
      if (!pgAvailable) return;
      await pgPool.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await pgPool.end();
    });

    class PGItem extends OnelaBaseModel {
      static configs = {
        tableName: TABLE_NAME,
        engine: 'pg_test',
        fields: [
          { name: 'id', type: 'int', default: null, increment: true },
          { name: 'title', type: 'varchar' },
          { name: 'content', type: 'text', default: '' },
          { name: 'amount', type: 'decimal', default: 0 },
          { name: 'status', type: 'int', default: 0 },
          { name: 'created_at', type: 'datetime', default: () => new Date() },
        ],
      } as Configs;
    }

    it('should INSERT a record', async () => {
      if (!pgAvailable) return;
      const result = await PGItem.insert({ title: 'PG测试', content: '内容A', amount: 88.8 });
      expect(result).toBeDefined();
    });

    it('should SELECT (findOne) the inserted record', async () => {
      if (!pgAvailable) return;
      const row = await PGItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'PG测试' }],
      });
      expect(row).toBeDefined();
      expect(row.title).toBe('PG测试');
      expect(Number(row.amount)).toBeCloseTo(88.8);
    });

    it('should findAll records', async () => {
      if (!pgAvailable) return;
      const rows = await PGItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should UPDATE a record', async () => {
      if (!pgAvailable) return;
      const row = await PGItem.findOne({ where: [] });
      await PGItem.update({
        update: [{ key: 'title', value: 'PG更新', operator: 'replace' }],
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      const updated = await PGItem.findOne({
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      expect(updated.title).toBe('PG更新');
    });

    it('should batch INSERT (inserts)', async () => {
      if (!pgAvailable) return;
      await PGItem.inserts([
        { title: 'PG批量A' },
        { title: 'PG批量B' },
        { title: 'PG批量C' },
      ]);
      const rows = await PGItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should do pagination (findList)', async () => {
      if (!pgAvailable) return;
      const result = await PGItem.findList({
        where: [],
        limit: [0, 2],
      });
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(Number(result.recordsTotal)).toBeGreaterThanOrEqual(4);
    });

    it('should do aggregate (COUNT)', async () => {
      if (!pgAvailable) return;
      const result = await PGItem.aggregate({
        aggregate: [{ function: 'count', field: 'id', name: 'total' }],
      });
      const row = Array.isArray(result) ? result[0] : (result.rows ? result.rows[0] : result);
      expect(Number(row.total)).toBeGreaterThanOrEqual(4);
    });

    it('should execute raw SQL', async () => {
      if (!pgAvailable) return;
      const result = await PGItem.sql(`SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`);
      const rows = Array.isArray(result) ? result : (result.rows || [result]);
      expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(4);
    });

    it('should DELETE records', async () => {
      if (!pgAvailable) return;
      await PGItem.delete({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'PG批量C' }],
      });
      const check = await PGItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'PG批量C' }],
      });
      expect(check).toBeNull();
    });

    it('should handle transaction (commit)', async () => {
      if (!pgAvailable) return;
      const t = await PGItem.transaction();
      try {
        await PGItem.insert({ title: 'PG事务测试' }, { transaction: t });
        await t.commit();
      } catch {
        await t.rollback();
      }
      const row = await PGItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'PG事务测试' }],
      });
      expect(row).toBeDefined();
      expect(row.title).toBe('PG事务测试');
    });

    it('should handle transaction (rollback)', async () => {
      if (!pgAvailable) return;
      const countBefore = await PGItem.findAll({ where: [] });
      const t = await PGItem.transaction();
      try {
        await PGItem.insert({ title: 'PG回滚测试' }, { transaction: t });
        await t.rollback();
      } catch {
        await t.rollback();
      }
      const countAfter = await PGItem.findAll({ where: [] });
      expect(countAfter.length).toBe(countBefore.length);
    });

    it('should query with IN operator', async () => {
      if (!pgAvailable) return;
      const rows = await PGItem.findAll({
        where: [{ logic: 'and', key: 'title', operator: 'in', value: ['PG批量A', 'PG批量B'] }],
      });
      expect(rows.length).toBe(2);
    });

    it('should query with ORDER BY', async () => {
      if (!pgAvailable) return;
      const rows = await PGItem.findAll({
        where: [],
        orderBy: { id: 'DESC' },
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].id).toBeGreaterThan(rows[rows.length - 1].id);
    });
  });

  // ==================== MariaDB ====================
  // MariaDB 使用直接驱动测试（与 MySQL 共享 ActionManager，驱动层面验证兼容性）
  describe('MariaDB (192.168.3.56:3307) - Direct Driver', () => {
    let mariaAvailable = false;
    let pool: any;

    beforeAll(async () => {
      mariaAvailable = await canConnectMariaDB();
      if (!mariaAvailable) return;

      pool = mysql2.createPool(MARIADB_CONFIG);

      await mysqlQuery(pool, `DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await mysqlQuery(pool, `
        CREATE TABLE ${TABLE_NAME} (
          id INT NOT NULL AUTO_INCREMENT,
          title VARCHAR(200) NOT NULL,
          content TEXT,
          amount DECIMAL(10,2) DEFAULT 0.00,
          status INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }, 30000);

    afterAll(async () => {
      if (!mariaAvailable) return;
      await mysqlQuery(pool, `DROP TABLE IF EXISTS ${TABLE_NAME}`);
      pool.end();
    });

    it('should verify MariaDB version', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool, 'SELECT VERSION() AS ver');
      expect(rows[0].ver).toBeDefined();
      // MariaDB version string typically contains "MariaDB"
      expect(rows[0].ver.toLowerCase()).toContain('mariadb');
    });

    it('should INSERT a record', async () => {
      if (!mariaAvailable) return;
      const result = await mysqlQuery(pool,
        `INSERT INTO ${TABLE_NAME} (title, content, amount) VALUES (?, ?, ?)`,
        ['MariaDB测试', '内容A', 77.7]
      );
      expect(result.insertId).toBeGreaterThan(0);
    });

    it('should SELECT the inserted record', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title = ?`, ['MariaDB测试']
      );
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe('MariaDB测试');
      expect(Number(rows[0].amount)).toBeCloseTo(77.7);
    });

    it('should UPDATE a record', async () => {
      if (!mariaAvailable) return;
      await mysqlQuery(pool,
        `UPDATE ${TABLE_NAME} SET title = ? WHERE title = ?`,
        ['MariaDB更新', 'MariaDB测试']
      );
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title = ?`, ['MariaDB更新']
      );
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe('MariaDB更新');
    });

    it('should batch INSERT', async () => {
      if (!mariaAvailable) return;
      await mysqlQuery(pool,
        `INSERT INTO ${TABLE_NAME} (title) VALUES (?), (?), (?)`,
        ['MB批量A', 'MB批量B', 'MB批量C']
      );
      const rows = await mysqlQuery(pool, `SELECT * FROM ${TABLE_NAME}`);
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should do pagination with LIMIT OFFSET', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} LIMIT ? OFFSET ?`, [2, 0]
      );
      expect(rows.length).toBeLessThanOrEqual(2);
    });

    it('should do aggregate (COUNT)', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool,
        `SELECT COUNT(*) AS total FROM ${TABLE_NAME}`
      );
      expect(Number(rows[0].total)).toBeGreaterThanOrEqual(4);
    });

    it('should DELETE records', async () => {
      if (!mariaAvailable) return;
      await mysqlQuery(pool,
        `DELETE FROM ${TABLE_NAME} WHERE title = ?`, ['MB批量C']
      );
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title = ?`, ['MB批量C']
      );
      expect(rows.length).toBe(0);
    });

    it('should handle transaction (commit)', async () => {
      if (!mariaAvailable) return;
      const conn = await new Promise<any>((resolve, reject) => {
        pool.getConnection((err: any, conn: any) => err ? reject(err) : resolve(conn));
      });
      await new Promise<void>((resolve, reject) => {
        conn.beginTransaction((err: any) => err ? reject(err) : resolve());
      });
      await new Promise<void>((resolve, reject) => {
        conn.query(`INSERT INTO ${TABLE_NAME} (title) VALUES (?)`, ['MariaDB事务'], (err: any) => err ? reject(err) : resolve());
      });
      await new Promise<void>((resolve, reject) => {
        conn.commit((err: any) => err ? reject(err) : resolve());
      });
      conn.release();
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title = ?`, ['MariaDB事务']
      );
      expect(rows.length).toBe(1);
    });

    it('should handle transaction (rollback)', async () => {
      if (!mariaAvailable) return;
      const before = await mysqlQuery(pool, `SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`);
      const conn = await new Promise<any>((resolve, reject) => {
        pool.getConnection((err: any, conn: any) => err ? reject(err) : resolve(conn));
      });
      await new Promise<void>((resolve, reject) => {
        conn.beginTransaction((err: any) => err ? reject(err) : resolve());
      });
      await new Promise<void>((resolve, reject) => {
        conn.query(`INSERT INTO ${TABLE_NAME} (title) VALUES (?)`, ['MariaDB回滚'], (err: any) => err ? reject(err) : resolve());
      });
      await new Promise<void>((resolve, reject) => {
        conn.rollback((err: any) => err ? reject(err) : resolve());
      });
      conn.release();
      const after = await mysqlQuery(pool, `SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`);
      expect(Number(after[0].cnt)).toBe(Number(before[0].cnt));
    });

    it('should query with IN', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title IN (?, ?)`,
        ['MB批量A', 'MB批量B']
      );
      expect(rows.length).toBe(2);
    });

    it('should query with LIKE', async () => {
      if (!mariaAvailable) return;
      const rows = await mysqlQuery(pool,
        `SELECT * FROM ${TABLE_NAME} WHERE title LIKE ?`, ['MB批量%']
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should UPDATE with arithmetic operation', async () => {
      if (!mariaAvailable) return;
      await mysqlQuery(pool,
        `UPDATE ${TABLE_NAME} SET amount = amount + ? WHERE title = ?`,
        [22.3, 'MariaDB更新']
      );
      const rows = await mysqlQuery(pool,
        `SELECT amount FROM ${TABLE_NAME} WHERE title = ?`, ['MariaDB更新']
      );
      expect(Number(rows[0].amount)).toBeCloseTo(77.7 + 22.3);
    });
  });

  // ==================== SQLite ====================
  describe('SQLite (local file)', () => {
    let sqliteAvailable = false;

    beforeAll(async () => {
      try {
        const sqlite3Module = await import('sqlite3');
        const SQLite3 = sqlite3Module.verbose();
        sqliteDb = new SQLite3.Database(SQLITE_DB_PATH);
        sqliteAvailable = true;

        await sqliteExec(sqliteDb, `
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            amount REAL DEFAULT 0,
            status INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);

        // 初始化 SQLite 引擎（传入已创建的 db 实例）
        SQLiteActionManagerV2.init({ host: SQLITE_DB_PATH }, sqliteDb);
        (Onela as any)._connections['sqlite_test'] = SQLiteActionManagerV2;
      } catch {
        sqliteAvailable = false;
      }
    }, 30000);

    afterAll(async () => {
      if (!sqliteAvailable) return;
      try {
        await new Promise<void>((resolve) => {
          sqliteDb.close(() => resolve());
        });
        if (fs.existsSync(SQLITE_DB_PATH)) {
          fs.unlinkSync(SQLITE_DB_PATH);
        }
      } catch { /* ignore */ }
    });

    class SQLiteItem extends OnelaBaseModel {
      static configs = {
        tableName: TABLE_NAME,
        engine: 'sqlite_test',
        fields: [
          { name: 'id', type: 'int', default: null, increment: true },
          { name: 'title', type: 'varchar' },
          { name: 'content', type: 'text', default: '' },
          { name: 'amount', type: 'decimal', default: 0 },
          { name: 'status', type: 'int', default: 0 },
          { name: 'created_at', type: 'datetime', default: () => new Date().toISOString() },
        ],
      } as Configs;
    }

    it('should INSERT a record', async () => {
      if (!sqliteAvailable) return;
      const result = await SQLiteItem.insert({ title: 'SQLite测试', content: '内容', amount: 55.5 });
      expect(result).toBeDefined();
    });

    it('should SELECT (findOne) the inserted record', async () => {
      if (!sqliteAvailable) return;
      const row = await SQLiteItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'SQLite测试' }],
      });
      expect(row).toBeDefined();
      expect(row.title).toBe('SQLite测试');
      expect(Number(row.amount)).toBeCloseTo(55.5);
    });

    it('should findAll records', async () => {
      if (!sqliteAvailable) return;
      const rows = await SQLiteItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should UPDATE a record', async () => {
      if (!sqliteAvailable) return;
      const row = await SQLiteItem.findOne({ where: [] });
      await SQLiteItem.update({
        update: [{ key: 'title', value: 'SQLite更新', operator: 'replace' }],
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      const updated = await SQLiteItem.findOne({
        where: [{ logic: 'and', key: 'id', operator: '=', value: row.id }],
      });
      expect(updated.title).toBe('SQLite更新');
    });

    it('should batch INSERT (inserts)', async () => {
      if (!sqliteAvailable) return;
      await SQLiteItem.inserts([
        { title: 'SQ批量A' },
        { title: 'SQ批量B' },
        { title: 'SQ批量C' },
      ]);
      const rows = await SQLiteItem.findAll({ where: [] });
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should do pagination (findList)', async () => {
      if (!sqliteAvailable) return;
      const result = await SQLiteItem.findList({
        where: [],
        limit: [0, 2],
      });
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('should do aggregate (COUNT)', async () => {
      if (!sqliteAvailable) return;
      const result = await SQLiteItem.aggregate({
        aggregate: [{ function: 'count', field: 'id', name: 'total' }],
      });
      const row = Array.isArray(result) ? result[0] : result;
      expect(Number(row.total)).toBeGreaterThanOrEqual(4);
    });

    it('should execute raw SQL', async () => {
      if (!sqliteAvailable) return;
      const result = await SQLiteItem.sql(`SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`);
      const rows = Array.isArray(result) ? result : [result];
      expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(4);
    });

    it('should DELETE records', async () => {
      if (!sqliteAvailable) return;
      await SQLiteItem.delete({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'SQ批量C' }],
      });
      const check = await SQLiteItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'SQ批量C' }],
      });
      expect(check).toBeNull();
    });

    it('should handle transaction (commit)', async () => {
      if (!sqliteAvailable) return;
      const t = await SQLiteItem.transaction();
      try {
        await SQLiteItem.insert({ title: 'SQLite事务' }, { transaction: t });
        await t.commit();
      } catch {
        await t.rollback();
      }
      const row = await SQLiteItem.findOne({
        where: [{ logic: 'and', key: 'title', operator: '=', value: 'SQLite事务' }],
      });
      expect(row).toBeDefined();
    });

    it('should query with IN operator', async () => {
      if (!sqliteAvailable) return;
      const rows = await SQLiteItem.findAll({
        where: [{ logic: 'and', key: 'title', operator: 'in', value: ['SQ批量A', 'SQ批量B'] }],
      });
      expect(rows.length).toBe(2);
    });

    it('should query with ORDER BY', async () => {
      if (!sqliteAvailable) return;
      const rows = await SQLiteItem.findAll({
        where: [],
        orderBy: { id: 'DESC' },
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].id).toBeGreaterThan(rows[rows.length - 1].id);
    });
  });
});
