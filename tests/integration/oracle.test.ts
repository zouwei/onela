/**
 * Oracle 数据库集成测试
 * 覆盖: CRUD、事务、聚合、分页、批量操作、原生SQL
 *
 * 环境: 通过环境变量配置（ORACLE_HOST, ORACLE_USER 等）
 */

import { Onela, OnelaBaseModel } from '../../src/index.v2.js';
import type { Configs } from '../../src/index.v2.js';
import { OracleActionManagerV2 } from '../../src/instance/OracleActionManagerV2.js';

const ORACLE_CONFIG = {
  user: process.env.ORACLE_USER || 'test',
  password: process.env.ORACLE_PASSWORD || '',
  host: process.env.ORACLE_HOST || '127.0.0.1',
  port: Number(process.env.ORACLE_PORT) || 1521,
  database: process.env.ORACLE_DATABASE || 'XEPDB1',
  poolMin: 1,
  poolMax: 5,
};

const TABLE_NAME = 'ONELA_TEST_ITEMS';

let oracleAvailable = false;
let oracledb: any;

// ==================== 辅助函数 ====================

async function oracleExec(sql: string, params: any[] = [], autoCommit = true): Promise<any> {
  const conn = await oracledb.getConnection({
    user: ORACLE_CONFIG.user,
    password: ORACLE_CONFIG.password,
    connectString: `${ORACLE_CONFIG.host}:${ORACLE_CONFIG.port}/${ORACLE_CONFIG.database}`,
  });
  try {
    const result = await conn.execute(sql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit,
    });
    return result;
  } finally {
    await conn.close();
  }
}

async function oracleQuery(sql: string, params: any[] = []): Promise<any[]> {
  const result = await oracleExec(sql, params);
  return result.rows || [];
}

// ==================== 测试套件 ====================

describe('Oracle Integration Tests (192.168.3.56:1521)', () => {

  beforeAll(async () => {
    try {
      oracledb = await import('oracledb');
      // 如果是 ESM default export
      if (oracledb.default) {
        oracledb = oracledb.default;
      }
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

      // 测试连接
      const conn = await oracledb.getConnection({
        user: ORACLE_CONFIG.user,
        password: ORACLE_CONFIG.password,
        connectString: `${ORACLE_CONFIG.host}:${ORACLE_CONFIG.port}/${ORACLE_CONFIG.database}`,
      });
      await conn.close();
      oracleAvailable = true;

      // 清理旧表和序列
      try { await oracleExec(`DROP TABLE ${TABLE_NAME} PURGE`); } catch { /* ignore */ }
      try { await oracleExec(`DROP SEQUENCE ${TABLE_NAME}_SEQ`); } catch { /* ignore */ }

      // 创建序列（用于模拟自增ID）
      await oracleExec(`
        CREATE SEQUENCE ${TABLE_NAME}_SEQ
        START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE
      `);

      // 创建测试表
      await oracleExec(`
        CREATE TABLE ${TABLE_NAME} (
          ID NUMBER(10) NOT NULL,
          TITLE VARCHAR2(200) NOT NULL,
          CONTENT CLOB DEFAULT '',
          AMOUNT NUMBER(10,2) DEFAULT 0,
          STATUS NUMBER(3) DEFAULT 0,
          CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
          CONSTRAINT ${TABLE_NAME}_PK PRIMARY KEY (ID)
        )
      `);

      // 创建自增触发器
      await oracleExec(`
        CREATE OR REPLACE TRIGGER ${TABLE_NAME}_BI
        BEFORE INSERT ON ${TABLE_NAME}
        FOR EACH ROW
        WHEN (NEW.ID IS NULL)
        BEGIN
          SELECT ${TABLE_NAME}_SEQ.NEXTVAL INTO :NEW.ID FROM DUAL;
        END;
      `);

      // 初始化 OracleActionManagerV2
      await OracleActionManagerV2.init(ORACLE_CONFIG, oracledb);
      (Onela as any)._connections['oracle_test'] = OracleActionManagerV2;

    } catch (e: any) {
      console.warn(`Oracle not available: ${e.message}`);
      oracleAvailable = false;
    }
  }, 60000);

  afterAll(async () => {
    if (!oracleAvailable) return;
    try {
      await oracleExec(`DROP TABLE ${TABLE_NAME} PURGE`);
      await oracleExec(`DROP SEQUENCE ${TABLE_NAME}_SEQ`);
    } catch { /* ignore */ }
    try {
      await OracleActionManagerV2.close();
    } catch { /* ignore */ }
  });

  // ==================== 直接驱动测试 ====================
  describe('Direct Driver Tests', () => {

    it('should connect and query DUAL', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery('SELECT 1 AS VAL FROM DUAL');
      expect(rows.length).toBe(1);
      expect(rows[0].VAL).toBe(1);
    });

    it('should get Oracle version', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery('SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1');
      expect(rows.length).toBe(1);
      expect(rows[0].BANNER).toContain('Oracle');
    });

    it('should INSERT with sequence', async () => {
      if (!oracleAvailable) return;
      await oracleExec(
        `INSERT INTO ${TABLE_NAME} (ID, TITLE, CONTENT, AMOUNT) VALUES (${TABLE_NAME}_SEQ.NEXTVAL, :1, :2, :3)`,
        ['Oracle直接测试', '内容A', 99.5]
      );
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE = :1`, ['Oracle直接测试']
      );
      expect(rows.length).toBe(1);
      expect(rows[0].TITLE).toBe('Oracle直接测试');
      expect(Number(rows[0].AMOUNT)).toBeCloseTo(99.5);
    });

    it('should UPDATE a record', async () => {
      if (!oracleAvailable) return;
      await oracleExec(
        `UPDATE ${TABLE_NAME} SET TITLE = :1 WHERE TITLE = :2`,
        ['Oracle直接更新', 'Oracle直接测试']
      );
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE = :1`, ['Oracle直接更新']
      );
      expect(rows.length).toBe(1);
      expect(rows[0].TITLE).toBe('Oracle直接更新');
    });

    it('should batch INSERT (individual statements)', async () => {
      if (!oracleAvailable) return;
      // Oracle INSERT ALL 与自增触发器不兼容，使用逐条插入
      for (const title of ['ORA批量A', 'ORA批量B', 'ORA批量C']) {
        await oracleExec(
          `INSERT INTO ${TABLE_NAME} (TITLE) VALUES (:1)`, [title]
        );
      }
      const rows = await oracleQuery(`SELECT * FROM ${TABLE_NAME}`);
      expect(rows.length).toBeGreaterThanOrEqual(4);
    });

    it('should do pagination with OFFSET FETCH', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} ORDER BY ID OFFSET :1 ROWS FETCH NEXT :2 ROWS ONLY`,
        [0, 2]
      );
      expect(rows.length).toBeLessThanOrEqual(2);
    });

    it('should do aggregate (COUNT)', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(`SELECT COUNT(*) AS TOTAL FROM ${TABLE_NAME}`);
      expect(Number(rows[0].TOTAL)).toBeGreaterThanOrEqual(4);
    });

    it('should DELETE records', async () => {
      if (!oracleAvailable) return;
      await oracleExec(
        `DELETE FROM ${TABLE_NAME} WHERE TITLE = :1`, ['ORA批量C']
      );
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE = :1`, ['ORA批量C']
      );
      expect(rows.length).toBe(0);
    });

    it('should handle transaction (commit)', async () => {
      if (!oracleAvailable) return;
      const conn = await oracledb.getConnection({
        user: ORACLE_CONFIG.user,
        password: ORACLE_CONFIG.password,
        connectString: `${ORACLE_CONFIG.host}:${ORACLE_CONFIG.port}/${ORACLE_CONFIG.database}`,
      });
      try {
        await conn.execute(
          `INSERT INTO ${TABLE_NAME} (ID, TITLE) VALUES (${TABLE_NAME}_SEQ.NEXTVAL, :1)`,
          ['Oracle事务提交'], { autoCommit: false }
        );
        await conn.commit();
      } finally {
        await conn.close();
      }
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE = :1`, ['Oracle事务提交']
      );
      expect(rows.length).toBe(1);
    });

    it('should handle transaction (rollback)', async () => {
      if (!oracleAvailable) return;
      const before = await oracleQuery(`SELECT COUNT(*) AS CNT FROM ${TABLE_NAME}`);
      const conn = await oracledb.getConnection({
        user: ORACLE_CONFIG.user,
        password: ORACLE_CONFIG.password,
        connectString: `${ORACLE_CONFIG.host}:${ORACLE_CONFIG.port}/${ORACLE_CONFIG.database}`,
      });
      try {
        await conn.execute(
          `INSERT INTO ${TABLE_NAME} (ID, TITLE) VALUES (${TABLE_NAME}_SEQ.NEXTVAL, :1)`,
          ['Oracle事务回滚'], { autoCommit: false }
        );
        await conn.rollback();
      } finally {
        await conn.close();
      }
      const after = await oracleQuery(`SELECT COUNT(*) AS CNT FROM ${TABLE_NAME}`);
      expect(Number(after[0].CNT)).toBe(Number(before[0].CNT));
    });

    it('should query with IN clause', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE IN (:1, :2)`,
        ['ORA批量A', 'ORA批量B']
      );
      expect(rows.length).toBe(2);
    });

    it('should query with LIKE', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE TITLE LIKE :1`,
        ['ORA批量%']
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should UPDATE with arithmetic', async () => {
      if (!oracleAvailable) return;
      await oracleExec(
        `UPDATE ${TABLE_NAME} SET AMOUNT = AMOUNT + :1 WHERE TITLE = :2`,
        [10.5, 'Oracle直接更新']
      );
      const rows = await oracleQuery(
        `SELECT AMOUNT FROM ${TABLE_NAME} WHERE TITLE = :1`, ['Oracle直接更新']
      );
      expect(Number(rows[0].AMOUNT)).toBeCloseTo(99.5 + 10.5);
    });

    it('should query with ORDER BY', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} ORDER BY ID DESC`
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].ID).toBeGreaterThan(rows[rows.length - 1].ID);
    });

    it('should support BETWEEN', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE ID BETWEEN :1 AND :2`,
        [1, 100]
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should support IS NULL / IS NOT NULL', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(
        `SELECT * FROM ${TABLE_NAME} WHERE CONTENT IS NOT NULL`
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should support aggregate functions (SUM, AVG, MAX, MIN)', async () => {
      if (!oracleAvailable) return;
      const rows = await oracleQuery(`
        SELECT
          SUM(AMOUNT) AS SUM_AMT,
          AVG(AMOUNT) AS AVG_AMT,
          MAX(AMOUNT) AS MAX_AMT,
          MIN(AMOUNT) AS MIN_AMT,
          COUNT(*) AS CNT
        FROM ${TABLE_NAME}
      `);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].CNT)).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== ORM 层测试 ====================
  describe('ORM Layer Tests (via OnelaBaseModel)', () => {

    // Oracle ORM 模型
    // 注意: Oracle 表和字段名是大写的
    class OracleItem extends OnelaBaseModel {
      static configs = {
        tableName: TABLE_NAME,
        engine: 'oracle_test',
        fields: [
          { name: 'ID', type: 'int', default: null, increment: true },
          { name: 'TITLE', type: 'varchar' },
          { name: 'CONTENT', type: 'text', default: '' },
          { name: 'AMOUNT', type: 'decimal', default: 0 },
          { name: 'STATUS', type: 'int', default: 0 },
          { name: 'CREATED_AT', type: 'datetime', default: () => new Date() },
        ],
      } as Configs;
    }

    it('should execute raw SQL via ORM', async () => {
      if (!oracleAvailable) return;
      const result = await OracleItem.sql(`SELECT COUNT(*) AS CNT FROM ${TABLE_NAME}`);
      const rows = result?.rows || (Array.isArray(result) ? result : [result]);
      expect(Number(rows[0].CNT)).toBeGreaterThanOrEqual(1);
    });

    it('should INSERT via ORM', async () => {
      if (!oracleAvailable) return;
      const result = await OracleItem.insert({ TITLE: 'ORM插入测试', AMOUNT: 66.6 });
      expect(result).toBeDefined();
    });

    it('should findAll via ORM', async () => {
      if (!oracleAvailable) return;
      const rows = await OracleItem.findAll({
        where: [],
      });
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should findOne via ORM', async () => {
      if (!oracleAvailable) return;
      const row = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'ORM插入测试' }],
      });
      expect(row).toBeDefined();
      expect(row.TITLE).toBe('ORM插入测试');
    });

    it('should UPDATE via ORM', async () => {
      if (!oracleAvailable) return;
      const row = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'ORM插入测试' }],
      });
      if (!row) return;

      await OracleItem.update({
        update: [{ key: 'TITLE', value: 'ORM更新测试', operator: 'replace' }],
        where: [{ logic: 'and', key: 'ID', operator: '=', value: row.ID }],
      });

      const updated = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'ID', operator: '=', value: row.ID }],
      });
      expect(updated.TITLE).toBe('ORM更新测试');
    });

    it('should DELETE via ORM', async () => {
      if (!oracleAvailable) return;
      await OracleItem.delete({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'ORM更新测试' }],
      });
      const check = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'ORM更新测试' }],
      });
      expect(check).toBeNull();
    });

    it('should aggregate via ORM', async () => {
      if (!oracleAvailable) return;
      const result = await OracleItem.aggregate({
        aggregate: [
          { function: 'count', field: 'ID', name: 'total' },
        ],
      });
      const rows = result?.rows || (Array.isArray(result) ? result : [result]);
      expect(Number(rows[0].total || rows[0].TOTAL)).toBeGreaterThanOrEqual(1);
    });

    it('should query with IN via ORM', async () => {
      if (!oracleAvailable) return;
      const rows = await OracleItem.findAll({
        where: [{ logic: 'and', key: 'TITLE', operator: 'in', value: ['ORA批量A', 'ORA批量B'] }],
      });
      expect(rows.length).toBe(2);
    });

    it('should query with LIKE via ORM', async () => {
      if (!oracleAvailable) return;
      const rows = await OracleItem.findAll({
        where: [{ logic: 'and', key: 'TITLE', operator: '%%', value: '批量' }],
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle transaction commit via ORM', async () => {
      if (!oracleAvailable) return;
      const t = await OracleItem.transaction();
      try {
        await OracleItem.insert({ TITLE: 'ORM事务提交' }, { transaction: t });
        await t.commit();
      } catch {
        await t.rollback();
      }
      const row = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'ORM事务提交' }],
      });
      expect(row).toBeDefined();
      expect(row.TITLE).toBe('ORM事务提交');
    });

    it('should handle transaction rollback via ORM', async () => {
      if (!oracleAvailable) return;
      const before = await OracleItem.findAll({ where: [] });
      const t = await OracleItem.transaction();
      try {
        await OracleItem.insert({ TITLE: 'ORM事务回滚' }, { transaction: t });
        await t.rollback();
      } catch {
        await t.rollback();
      }
      const after = await OracleItem.findAll({ where: [] });
      expect(after.length).toBe(before.length);
    });

    it('should UPDATE with plus operator via ORM', async () => {
      if (!oracleAvailable) return;
      const row = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'TITLE', operator: '=', value: 'Oracle直接更新' }],
      });
      if (!row) return;

      const originalAmount = Number(row.AMOUNT);
      await OracleItem.update({
        update: [{ key: 'AMOUNT', value: 5, operator: 'plus' }],
        where: [{ logic: 'and', key: 'ID', operator: '=', value: row.ID }],
      });
      const updated = await OracleItem.findOne({
        where: [{ logic: 'and', key: 'ID', operator: '=', value: row.ID }],
      });
      expect(Number(updated.AMOUNT)).toBeCloseTo(originalAmount + 5);
    });

    it('should query with ORDER BY via ORM', async () => {
      if (!oracleAvailable) return;
      const rows = await OracleItem.findAll({
        where: [],
        orderBy: { ID: 'DESC' },
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].ID).toBeGreaterThan(rows[rows.length - 1].ID);
    });
  });
});
