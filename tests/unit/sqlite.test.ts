/**
 * SQLite 综合单元测试
 * 覆盖：SQLiteDialect、SQLiteActionManagerV2、SQLiteSQLActionManager(V1)、Grammar/sqlite
 */

import { SQLiteDialect } from '../../src/dialect/SQLiteDialect.js';
import { SQLiteActionManagerV2 } from '../../src/instance/SQLiteActionManagerV2.js';
import { SQLiteActionManager } from '../../src/instance/SQLiteSQLActionManager.js';
import * as GrammarSqlite from '../../src/grammar/sqlite.js';

// ==================== Mock SQLite Database ====================

/**
 * 创建 mock SQLite Database 实例
 */
function createMockDB(options: {
  allResult?: any[];
  runResult?: { lastID?: number; changes?: number };
  getResult?: any;
  error?: Error | null;
} = {}) {
  const calls: Array<{ method: string; sql: string; params: any[] }> = [];

  const db: any = {
    allResult: options.allResult ?? [],
    runResult: options.runResult ?? { lastID: 1, changes: 1 },
    getResult: options.getResult ?? null,
    error: options.error ?? null,
    run(sql: string, params: any[], callback: Function) {
      calls.push({ method: 'run', sql, params });
      if (db.error) return callback.call(db.runResult, db.error);
      callback.call(db.runResult, null);
    },
    get(sql: string, params: any[], callback: Function) {
      calls.push({ method: 'get', sql, params });
      if (db.error) return callback(db.error, null);
      callback(null, db.getResult);
    },
    all(sql: string, params: any[], callback: Function) {
      calls.push({ method: 'all', sql, params });
      if (db.error) return callback(db.error, null);
      callback(null, db.allResult);
    },
    close(callback?: Function) {
      calls.push({ method: 'close', sql: '', params: [] });
      if (callback) callback(null);
    },
    _calls: calls,
  };

  return db;
}

// ==================== 1. SQLiteDialect 测试 ====================

describe('SQLiteDialect', () => {
  let dialect: SQLiteDialect;

  beforeEach(() => {
    dialect = new SQLiteDialect();
  });

  describe('config', () => {
    it('should have correct dialect config', () => {
      const config = dialect.getConfig();
      expect(config.type).toBe('sqlite');
      expect(config.placeholderStyle).toBe('question');
      expect(config.quoteStyle).toBe('double');
      expect(config.paginationStyle).toBe('limit-offset');
      expect(config.supportsReturning).toBe(true);
      expect(config.supportsUpsert).toBe(true);
      expect(config.supportsWindowFunctions).toBe(true);
      expect(config.supportsCTE).toBe(true);
      expect(config.supportsJSON).toBe(true);
      expect(config.caseSensitive).toBe(false);
      expect(config.concatOperator).toBe('||');
      expect(config.useDoubleQuoteString).toBe(false);
    });

    it('should return type as sqlite', () => {
      expect(dialect.getType()).toBe('sqlite');
    });
  });

  describe('placeholder', () => {
    it('should always return ? regardless of index', () => {
      expect(dialect.placeholder(1)).toBe('?');
      expect(dialect.placeholder(2)).toBe('?');
      expect(dialect.placeholder(100)).toBe('?');
    });

    it('should return ? even with named parameter', () => {
      expect(dialect.placeholder(1, 'id')).toBe('?');
      expect(dialect.placeholder(1, 'name')).toBe('?');
    });
  });

  describe('quoteIdentifier', () => {
    it('should quote identifiers with double quotes', () => {
      expect(dialect.quoteIdentifier('id')).toBe('"id"');
      expect(dialect.quoteIdentifier('user_name')).toBe('"user_name"');
    });

    it('should handle dotted identifiers (schema.table)', () => {
      const result = dialect.quoteIdentifier('main.users');
      expect(result).toBe('"main"."users"');
    });

    it('should not quote wildcard *', () => {
      expect(dialect.quoteIdentifier('*')).toBe('*');
    });

    it('should not quote function expressions', () => {
      expect(dialect.quoteIdentifier('COUNT(*)')).toBe('COUNT(*)');
    });

    it('should escape embedded double quotes', () => {
      expect(dialect.quoteIdentifier('col"name')).toBe('"col""name"');
    });

    it('should not re-quote already quoted identifiers', () => {
      expect(dialect.quoteIdentifier('"already_quoted"')).toBe('"already_quoted"');
    });
  });

  describe('buildPagination', () => {
    it('should generate LIMIT ? OFFSET ? syntax', () => {
      const result = dialect.buildPagination(10, 20, 0);
      expect(result.sql).toBe(' LIMIT ? OFFSET ?');
      expect(result.params).toEqual([20, 10]); // [limit, offset]
    });

    it('should handle zero offset', () => {
      const result = dialect.buildPagination(0, 10, 0);
      expect(result.sql).toBe(' LIMIT ? OFFSET ?');
      expect(result.params).toEqual([10, 0]);
    });

    it('should not modify currentIndex (SQLite uses ? placeholders)', () => {
      const result = dialect.buildPagination(5, 10, 3);
      // SQLite placeholder is always ?, so newIndex does not increment
      expect(result.newIndex).toBe(3);
    });
  });

  describe('buildInsert (inherited from BaseDialect)', () => {
    it('should build basic INSERT', () => {
      const result = dialect.buildInsert('users', ['name', 'age'], ['Alice', 30]);
      expect(result.sql).toBe('INSERT INTO "users" ("name", "age") VALUES (?, ?)');
      expect(result.params).toEqual(['Alice', 30]);
    });

    it('should build INSERT with RETURNING', () => {
      const result = dialect.buildInsert('users', ['name'], ['Alice'], ['id']);
      expect(result.sql).toBe('INSERT INTO "users" ("name") VALUES (?) RETURNING "id"');
      expect(result.params).toEqual(['Alice']);
    });

    it('should build INSERT with multiple RETURNING columns', () => {
      const result = dialect.buildInsert('users', ['name'], ['Alice'], ['id', 'created_at']);
      expect(result.sql).toContain('RETURNING "id", "created_at"');
    });
  });

  describe('buildBatchInsert (inherited from BaseDialect)', () => {
    it('should build batch INSERT with multiple rows', () => {
      const result = dialect.buildBatchInsert(
        'users',
        ['name', 'age'],
        [['Alice', 30], ['Bob', 25]]
      );
      expect(result.sql).toBe('INSERT INTO "users" ("name", "age") VALUES (?, ?), (?, ?)');
      expect(result.params).toEqual(['Alice', 30, 'Bob', 25]);
    });

    it('should handle single row batch', () => {
      const result = dialect.buildBatchInsert('users', ['name'], [['Alice']]);
      expect(result.sql).toBe('INSERT INTO "users" ("name") VALUES (?)');
      expect(result.params).toEqual(['Alice']);
    });
  });

  describe('buildUpsert', () => {
    it('should build ON CONFLICT DO UPDATE syntax', () => {
      const result = dialect.buildUpsert(
        'users',
        ['id', 'name', 'email'],
        [1, 'Alice', 'alice@test.com'],
        ['id'],
        ['name', 'email']
      );
      expect(result.sql).toContain('INSERT INTO "users"');
      expect(result.sql).toContain('ON CONFLICT ("id")');
      expect(result.sql).toContain('DO UPDATE SET');
      expect(result.sql).toContain('"name" = excluded."name"');
      expect(result.sql).toContain('"email" = excluded."email"');
      expect(result.params).toEqual([1, 'Alice', 'alice@test.com']);
    });

    it('should handle multiple conflict columns', () => {
      const result = dialect.buildUpsert(
        'user_roles',
        ['user_id', 'role_id', 'active'],
        [1, 2, true],
        ['user_id', 'role_id'],
        ['active']
      );
      expect(result.sql).toContain('ON CONFLICT ("user_id", "role_id")');
    });
  });

  describe('buildUpdate (inherited from BaseDialect)', () => {
    it('should build UPDATE statement', () => {
      const result = dialect.buildUpdate(
        'users',
        ['"name" = ?', '"age" = ?'],
        '"id" = ?',
        ['Alice', 30, 1]
      );
      expect(result.sql).toBe('UPDATE "users" SET "name" = ?, "age" = ? WHERE "id" = ?');
      expect(result.params).toEqual(['Alice', 30, 1]);
    });
  });

  describe('buildDelete (inherited from BaseDialect)', () => {
    it('should build DELETE statement', () => {
      const result = dialect.buildDelete('users', '"id" = ?', [1]);
      expect(result.sql).toBe('DELETE FROM "users" WHERE "id" = ?');
      expect(result.params).toEqual([1]);
    });
  });

  describe('getCurrentTimestamp / getCurrentDate', () => {
    it('should return SQLite datetime function', () => {
      expect(dialect.getCurrentTimestamp()).toBe("datetime('now')");
    });

    it('should return SQLite date function', () => {
      expect(dialect.getCurrentDate()).toBe("date('now')");
    });
  });

  describe('booleanValue', () => {
    it('should return 1 for true', () => {
      expect(dialect.booleanValue(true)).toBe(1);
    });

    it('should return 0 for false', () => {
      expect(dialect.booleanValue(false)).toBe(0);
    });
  });

  describe('getLastInsertId', () => {
    it('should return last_insert_rowid query', () => {
      expect(dialect.getLastInsertId()).toBe('SELECT last_insert_rowid() AS id');
    });
  });

  describe('jsonExtract', () => {
    it('should generate json_extract expression', () => {
      const result = dialect.jsonExtract('data', 'name');
      expect(result).toBe('json_extract("data", \'$.name\')');
    });

    it('should handle nested paths', () => {
      const result = dialect.jsonExtract('profile', 'address.city');
      expect(result).toBe('json_extract("profile", \'$.address.city\')');
    });
  });

  describe('jsonSet', () => {
    it('should generate json_set expression', () => {
      const result = dialect.jsonSet('data', 'name', "'Alice'");
      expect(result).toBe("json_set(\"data\", '$.name', 'Alice')");
    });
  });

  describe('substring', () => {
    it('should generate substr with start and length', () => {
      const result = dialect.substring('name', 1, 3);
      expect(result).toBe('substr("name", 1, 3)');
    });

    it('should generate substr with start only', () => {
      const result = dialect.substring('name', 2);
      expect(result).toBe('substr("name", 2)');
    });
  });

  describe('dateFormat', () => {
    it('should generate strftime expression', () => {
      const result = dialect.dateFormat('created_at', '%Y-%m-%d');
      expect(result).toBe('strftime(\'%Y-%m-%d\', "created_at")');
    });
  });

  describe('glob', () => {
    it('should generate GLOB expression', () => {
      const result = dialect.glob('filename', "'*.txt'");
      expect(result).toBe('"filename" GLOB \'*.txt\'');
    });
  });

  describe('concat (inherited from BaseDialect)', () => {
    it('should use || operator for concatenation', () => {
      const result = dialect.concat('"first_name"', "' '", '"last_name"');
      expect(result).toBe('"first_name" || \' \' || "last_name"');
    });
  });

  describe('coalesce (inherited from BaseDialect)', () => {
    it('should generate COALESCE expression', () => {
      const result = dialect.coalesce('"name"', "'Unknown'");
      expect(result).toBe("COALESCE(\"name\", 'Unknown')");
    });
  });

  describe('caseWhen (inherited from BaseDialect)', () => {
    it('should generate CASE WHEN expression', () => {
      const result = dialect.caseWhen('"status"', [
        { when: 1, then: "'active'" },
        { when: 0, then: "'inactive'" },
      ], "'unknown'");
      expect(result).toContain('CASE "status"');
      expect(result).toContain("WHEN 1 THEN 'active'");
      expect(result).toContain("WHEN 0 THEN 'inactive'");
      expect(result).toContain("ELSE 'unknown'");
      expect(result).toContain('END');
    });

    it('should generate CASE WHEN without ELSE', () => {
      const result = dialect.caseWhen('"status"', [
        { when: 1, then: "'active'" },
      ]);
      expect(result).not.toContain('ELSE');
    });
  });

  describe('escapeLike (inherited from BaseDialect)', () => {
    it('should escape % and _ characters', () => {
      expect(dialect.escapeLike('100%')).toBe('100\\%');
      expect(dialect.escapeLike('user_name')).toBe('user\\_name');
    });

    it('should escape backslash', () => {
      expect(dialect.escapeLike('path\\file')).toBe('path\\\\file');
    });
  });

  describe('castValue (inherited from BaseDialect)', () => {
    it('should generate CAST expression', () => {
      expect(dialect.castValue('"age"', 'TEXT')).toBe('CAST("age" AS TEXT)');
      expect(dialect.castValue('"price"', 'REAL')).toBe('CAST("price" AS REAL)');
    });
  });

  describe('formatDateTime (inherited from BaseDialect)', () => {
    it('should format Date to ISO-like string', () => {
      const date = new Date(2025, 0, 15, 10, 30, 45); // 2025-01-15 10:30:45
      const result = dialect.formatDateTime(date);
      expect(result).toBe('2025-01-15 10:30:45');
    });

    it('should pad single-digit values', () => {
      const date = new Date(2025, 5, 5, 8, 5, 3); // 2025-06-05 08:05:03
      const result = dialect.formatDateTime(date);
      expect(result).toBe('2025-06-05 08:05:03');
    });
  });
});

// ==================== 2. Grammar/sqlite 测试 ====================

describe('Grammar SQLite', () => {
  const configs = {
    tableName: 'test_items',
    fields: [
      { name: 'id', type: 'int', primary: true, increment: true },
      { name: 'title', type: 'varchar', default: '' },
      { name: 'status', type: 'int', default: 0 },
    ],
  };

  describe('getParameters (SELECT)', () => {
    it('should generate default SELECT with no conditions', () => {
      const result = GrammarSqlite.getParameters({ configs } as any);
      expect(result.select).toBe('t.*');
      expect(result.where).toContain('1=1');
      expect(result.orderBy).toBe('');
      expect(result.limit).toBe('');
      expect(result.parameters).toEqual([]);
    });

    it('should handle custom select fields', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        select: ['id', 'title'],
      } as any);
      expect(result.select).toBe('id,title');
    });

    it('should handle empty select array (fallback to t.*)', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        select: [],
      } as any);
      expect(result.select).toBe('t.*');
    });

    it('should handle WHERE with = operator', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.where).toContain('and id =?');
      expect(result.parameters).toEqual([1]);
    });

    it('should handle WHERE with comparison operators', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [
          { key: 'status', operator: '>', value: 0, logic: 'and' },
          { key: 'status', operator: '<', value: 10, logic: 'and' },
          { key: 'id', operator: '>=', value: 1, logic: 'and' },
          { key: 'id', operator: '<=', value: 100, logic: 'and' },
          { key: 'status', operator: '<>', value: 5, logic: 'and' },
        ],
      } as any);
      expect(result.where).toContain('>?');
      expect(result.where).toContain('<?');
      expect(result.where).toContain('>=?');
      expect(result.where).toContain('<=?');
      expect(result.where).toContain('<>?');
      expect(result.parameters).toEqual([0, 10, 1, 100, 5]);
    });

    it('should handle IN operator', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'id', operator: 'in', value: [1, 2, 3], logic: 'and' }],
      } as any);
      expect(result.where).toContain('in (?, ?, ?)');
      expect(result.parameters).toEqual([1, 2, 3]);
    });

    it('should handle NOT IN operator', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'id', operator: 'not in', value: [4, 5], logic: 'and' }],
      } as any);
      expect(result.where).toContain('not in (?, ?)');
      expect(result.parameters).toEqual([4, 5]);
    });

    it('should handle LIKE operators', () => {
      // % = left fuzzy
      const r1 = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'title', operator: '%', value: 'test', logic: 'and' }],
      } as any);
      expect(r1.where).toContain('like ?');
      expect(r1.parameters).toEqual(['%test']);

      // x% = right fuzzy
      const r2 = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'title', operator: 'x%', value: 'test', logic: 'and' }],
      } as any);
      expect(r2.parameters).toEqual(['test%']);

      // %% = full fuzzy
      const r3 = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'title', operator: '%%', value: 'test', logic: 'and' }],
      } as any);
      expect(r3.parameters).toEqual(['%test%']);
    });

    it('should handle IS operator', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'title', operator: 'is', value: 'null', logic: 'and' }],
      } as any);
      expect(result.where).toContain('is NULL');
      expect(result.parameters).toEqual([]); // IS does not push params
    });

    it('should handle OR logic', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [
          { key: 'status', operator: '=', value: 1, logic: 'and' },
          { key: 'status', operator: '=', value: 2, logic: 'or' },
        ],
      } as any);
      expect(result.where).toContain('and status =?');
      expect(result.where).toContain('or status =?');
      expect(result.parameters).toEqual([1, 2]);
    });

    it('should handle ORDER BY', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        orderBy: { id: 'DESC', title: 'ASC' },
      } as any);
      expect(result.orderBy).toContain('ORDER BY');
      expect(result.orderBy).toContain('id DESC');
      expect(result.orderBy).toContain('title ASC');
    });

    it('should handle LIMIT', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        limit: [0, 10],
      } as any);
      expect(result.limit).toBe(' LIMIT ?,?');
      expect(result.parameters).toEqual([0, 10]);
    });

    it('should skip null/undefined/empty values in WHERE', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [
          { key: 'title', operator: '=', value: '', logic: 'and' },
          { key: 'status', operator: '=', value: null, logic: 'and' },
          { key: 'id', operator: '=', value: undefined, logic: 'and' },
        ],
      } as any);
      expect(result.parameters).toEqual([]);
    });

    it('should use keyword field as fallback for where', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        keyword: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.where).toContain('and id =?');
      expect(result.parameters).toEqual([1]);
    });

    it('should handle default operator (no operator = equals)', () => {
      const result = GrammarSqlite.getParameters({
        configs,
        where: [{ key: 'id', value: 1, logic: 'and' }],
      } as any);
      expect(result.where).toContain('=?');
      expect(result.parameters).toEqual([1]);
    });
  });

  describe('getUpdateParameters (UPDATE)', () => {
    it('should handle replace operator', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'title', value: 'New Title', operator: 'replace' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set).toContain('title=?');
      expect(result.parameters[0]).toBe('New Title');
    });

    it('should handle plus operator', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'status', value: 1, operator: 'plus' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set).toContain('status=status + ?');
    });

    it('should handle reduce operator', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'status', value: 1, operator: 'reduce' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set).toContain('status=status - ?');
    });

    it('should handle CASE WHEN update', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{
          key: 'status',
          case_field: 'id',
          case_item: [
            { case_value: 1, value: 10, operator: 'replace' },
            { case_value: 2, value: 20, operator: 'replace' },
          ],
        }],
        where: [{ key: 'id', operator: 'in', value: [1, 2], logic: 'and' }],
      } as any);
      expect(result.set[0]).toContain('CASE id');
      expect(result.set[0]).toContain('WHEN ? THEN ?');
      expect(result.set[0]).toContain('END)');
    });

    it('should handle CASE WHEN with plus operator', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{
          key: 'status',
          case_field: 'id',
          case_item: [
            { case_value: 1, value: 5, operator: 'plus' },
          ],
        }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set[0]).toContain('WHEN ? THEN status + ?');
    });

    it('should handle CASE WHEN with reduce operator', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{
          key: 'status',
          case_field: 'id',
          case_item: [
            { case_value: 1, value: 3, operator: 'reduce' },
          ],
        }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set[0]).toContain('WHEN ? THEN status - ?');
    });

    it('should handle WHERE conditions in update', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'title', value: 'X', operator: 'replace' }],
        where: [
          { key: 'status', operator: '=', value: 1, logic: 'and' },
          { key: 'id', operator: '>', value: 0, logic: 'and' },
        ],
      } as any);
      expect(result.where).toContain('1=1');
      expect(result.where).toContain('and status =?');
      expect(result.where).toContain('and id >?');
    });

    it('should handle LIKE operators in WHERE of update', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'status', value: 1, operator: 'replace' }],
        where: [{ key: 'title', operator: '%%', value: 'test', logic: 'and' }],
      } as any);
      expect(result.where).toContain('like ?');
      // params: first is SET value, then WHERE value
      const lastParam = result.parameters[result.parameters.length - 1];
      expect(lastParam).toBe('%test%');
    });

    it('should skip empty value update items', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'title', value: '', operator: 'replace' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set).toEqual([]);
    });

    it('should default to replace operator when not specified', () => {
      const result = GrammarSqlite.getUpdateParameters({
        configs,
        update: [{ key: 'title', value: 'Hello' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.set).toContain('title=?');
    });
  });

  describe('getDeleteParameters (DELETE)', () => {
    it('should generate WHERE conditions for delete', () => {
      const result = GrammarSqlite.getDeleteParameters({
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      expect(result.where).toContain('1=1');
      expect(result.where).toContain('and id =?');
      expect(result.parameters).toEqual([1]);
    });

    it('should handle IN operator for delete', () => {
      const result = GrammarSqlite.getDeleteParameters({
        where: [{ key: 'id', operator: 'in', value: [1, 2, 3], logic: 'and' }],
      } as any);
      expect(result.where).toContain('in (?, ?, ?)');
      expect(result.parameters).toEqual([1, 2, 3]);
    });

    it('should handle LIKE operators for delete', () => {
      const r1 = GrammarSqlite.getDeleteParameters({
        where: [{ key: 'title', operator: '%', value: 'old', logic: 'and' }],
      } as any);
      expect(r1.parameters).toEqual(['%old']);

      const r2 = GrammarSqlite.getDeleteParameters({
        where: [{ key: 'title', operator: 'x%', value: 'old', logic: 'and' }],
      } as any);
      expect(r2.parameters).toEqual(['old%']);

      const r3 = GrammarSqlite.getDeleteParameters({
        where: [{ key: 'title', operator: '%%', value: 'old', logic: 'and' }],
      } as any);
      expect(r3.parameters).toEqual(['%old%']);
    });

    it('should use keyword as fallback for where', () => {
      const result = GrammarSqlite.getDeleteParameters({
        keyword: [{ key: 'status', operator: '=', value: 0, logic: 'and' }],
      } as any);
      expect(result.where).toContain('and status =?');
      expect(result.parameters).toEqual([0]);
    });
  });
});

// ==================== 3. SQLiteActionManagerV2 测试 ====================

describe('SQLiteActionManagerV2', () => {
  let mockDB: any;

  beforeEach(() => {
    // Reset static state
    (SQLiteActionManagerV2 as any)._db = null;
    mockDB = createMockDB({
      allResult: [{ id: 1, title: 'Test' }],
      runResult: { lastID: 1, changes: 1 },
    });
  });

  afterEach(() => {
    (SQLiteActionManagerV2 as any)._db = null;
  });

  describe('init', () => {
    it('should init with existing Database instance (情况3)', () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      expect((SQLiteActionManagerV2 as any)._db).toBe(mockDB);
    });

    it('should init with sqlite3 module (情况1 - has Database & verbose)', () => {
      const mockDBInstance = createMockDB();
      const mockModule = {
        Database: function() {},
        verbose: () => ({
          Database: function(path: string) {
            Object.assign(this, mockDBInstance);
          },
        }),
      };
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockModule);
      expect((SQLiteActionManagerV2 as any)._db).not.toBeNull();
    });

    it('should init with Database class (情况2 - constructor function)', () => {
      function MockDatabase(this: any, path: string) {
        this.path = path;
        this.run = mockDB.run;
        this.get = mockDB.get;
        this.all = mockDB.all;
        this.close = mockDB.close;
      }
      MockDatabase.prototype.run = function() {};

      SQLiteActionManagerV2.init({ host: ':memory:' }, MockDatabase);
      expect((SQLiteActionManagerV2 as any)._db).not.toBeNull();
    });

    it('should work with instance method', () => {
      const instance = new SQLiteActionManagerV2();
      instance.init({ host: ':memory:' }, mockDB);
      expect((SQLiteActionManagerV2 as any)._db).toBe(mockDB);
    });
  });

  describe('getDB (error handling)', () => {
    it('should throw when not initialized', () => {
      expect(() => {
        (SQLiteActionManagerV2 as any).getDB();
      }).toThrow('SQLite not initialized');
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
    });

    it('should use db.all for SELECT queries', async () => {
      const instance = new SQLiteActionManagerV2();
      const result = await (instance as any).execute('SELECT * FROM test', []);
      expect(result).toEqual([{ id: 1, title: 'Test' }]);
      expect(mockDB._calls[0].method).toBe('all');
    });

    it('should use db.run for INSERT queries', async () => {
      const instance = new SQLiteActionManagerV2();
      const result = await (instance as any).execute('INSERT INTO test (title) VALUES (?)', ['X']);
      expect(result).toEqual({ lastID: 1, changes: 1 });
      expect(mockDB._calls[0].method).toBe('run');
    });

    it('should use db.run for UPDATE queries', async () => {
      const instance = new SQLiteActionManagerV2();
      await (instance as any).execute('UPDATE test SET title = ?', ['Y']);
      expect(mockDB._calls[0].method).toBe('run');
    });

    it('should use db.run for DELETE queries', async () => {
      const instance = new SQLiteActionManagerV2();
      await (instance as any).execute('DELETE FROM test WHERE id = ?', [1]);
      expect(mockDB._calls[0].method).toBe('run');
    });

    it('should reject on error', async () => {
      mockDB.error = new Error('DB error');
      const instance = new SQLiteActionManagerV2();
      await expect((instance as any).execute('SELECT 1', [])).rejects.toThrow('DB error');
    });
  });

  describe('executeInTransaction', () => {
    it('should delegate to execute (SQLite single connection)', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const instance = new SQLiteActionManagerV2();
      const mockTx = { client: mockDB, begin: async () => {}, commit: async () => 'committed', rollback: async () => 'rolled back' };
      const result = await (instance as any).executeInTransaction('SELECT 1', [], mockTx);
      // executeInTransaction calls execute, which for SELECT calls db.all
      expect(mockDB._calls[0].method).toBe('all');
    });
  });

  describe('normalizeQueryResult', () => {
    it('should normalize array result (SELECT)', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeQueryResult([{ id: 1 }, { id: 2 }]);
      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should handle non-array result (DML)', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeQueryResult({ lastID: 5, changes: 1 });
      expect(result.rows).toEqual([]);
      expect(result.affectedRows).toBe(1);
      expect(result.insertId).toBe(5);
    });

    it('should handle null/undefined result', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeQueryResult(null);
      expect(result.rows).toEqual([]);
    });

    it('should extract changes and lastID from run result', () => {
      const instance = new SQLiteActionManagerV2();
      const rawResult = { lastID: 42, changes: 3 };
      const result = (instance as any).normalizeQueryResult(rawResult);
      // non-array, so rows = [], but affectedRows and insertId come from the raw
      expect(result.rows).toEqual([]);
      expect(result.affectedRows).toBe(3);
      expect(result.insertId).toBe(42);
    });
  });

  describe('normalizeInsertResult', () => {
    it('should merge insert data with result', () => {
      const instance = new SQLiteActionManagerV2();
      const rawResult = { lastID: 10, changes: 1 };
      const data = { title: 'Test', status: 1 };
      const result = (instance as any).normalizeInsertResult(rawResult, data);
      expect(result.title).toBe('Test');
      expect(result.status).toBe(1);
      expect(result.insertId).toBe(10);
      expect(result.affectedRows).toBe(1);
      expect(result._returns).toBe(rawResult);
    });

    it('should default affectedRows to 1 when changes is undefined', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeInsertResult({}, { name: 'X' });
      expect(result.affectedRows).toBe(1);
    });
  });

  describe('normalizeModifyResult', () => {
    it('should extract affectedRows from changes', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeModifyResult({ changes: 5 });
      expect(result.affectedRows).toBe(5);
    });

    it('should default to 0 when changes is undefined', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeModifyResult({});
      expect(result.affectedRows).toBe(0);
    });

    it('should handle null result', () => {
      const instance = new SQLiteActionManagerV2();
      const result = (instance as any).normalizeModifyResult(null);
      expect(result.affectedRows).toBe(0);
    });
  });

  describe('createTransaction', () => {
    it('should create a transaction object with begin/commit/rollback', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      expect(tx.client).toBe(mockDB);
      expect(typeof tx.begin).toBe('function');
      expect(typeof tx.commit).toBe('function');
      expect(typeof tx.rollback).toBe('function');
    });

    it('should execute BEGIN on begin()', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      await tx.begin();
      expect(mockDB._calls.some((c: any) => c.sql === 'BEGIN')).toBe(true);
    });

    it('should execute COMMIT on commit()', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      await tx.commit();
      expect(mockDB._calls.some((c: any) => c.sql === 'COMMIT')).toBe(true);
    });

    it('should execute ROLLBACK on rollback()', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      await tx.rollback();
      expect(mockDB._calls.some((c: any) => c.sql === 'ROLLBACK')).toBe(true);
    });

    it('should return message from commit', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      const msg = await tx.commit();
      expect(msg).toBe('Transaction committed');
    });

    it('should return message from rollback', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const tx = await SQLiteActionManagerV2.createTransaction();
      const msg = await tx.rollback();
      expect(msg).toBe('Transaction rolled back');
    });

    it('should work via instance method', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const instance = new SQLiteActionManagerV2();
      const tx = await instance.createTransaction();
      expect(tx.client).toBe(mockDB);
    });

    it('should reject begin on error', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      mockDB.error = new Error('BEGIN failed');
      const tx = await SQLiteActionManagerV2.createTransaction();
      await expect(tx.begin()).rejects.toThrow('BEGIN failed');
    });
  });

  describe('healthCheck', () => {
    it('should return true when DB is working', async () => {
      const db = createMockDB({ allResult: [{ '1': 1 }] });
      SQLiteActionManagerV2.init({ host: ':memory:' }, db);
      const instance = new SQLiteActionManagerV2();
      const result = await instance.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when DB has errors', async () => {
      mockDB.error = new Error('Connection lost');
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const instance = new SQLiteActionManagerV2();
      const result = await instance.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the database', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      await SQLiteActionManagerV2.close();
      expect((SQLiteActionManagerV2 as any)._db).toBeNull();
      expect(mockDB._calls.some((c: any) => c.method === 'close')).toBe(true);
    });

    it('should resolve if already closed', async () => {
      await SQLiteActionManagerV2.close();
      // Should not throw
    });

    it('should work via instance method', async () => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
      const instance = new SQLiteActionManagerV2();
      await instance.close();
      expect((SQLiteActionManagerV2 as any)._db).toBeNull();
    });
  });

  describe('static sql method', () => {
    beforeEach(() => {
      SQLiteActionManagerV2.init({ host: ':memory:' }, mockDB);
    });

    it('should execute raw SQL (SELECT)', async () => {
      const result = await SQLiteActionManagerV2.sql('SELECT * FROM test', []);
      expect(result).toEqual([{ id: 1, title: 'Test' }]);
    });

    it('should execute raw SQL (INSERT)', async () => {
      const result = await SQLiteActionManagerV2.sql('INSERT INTO test (title) VALUES (?)', ['X']);
      expect(result).toEqual({ lastID: 1, changes: 1 });
    });

    it('should use transaction when provided', async () => {
      const tx = await SQLiteActionManagerV2.createTransaction();
      const result = await SQLiteActionManagerV2.sql('SELECT 1', [], { transaction: tx });
      // Should work without throwing
      expect(result).toBeDefined();
    });
  });

  describe('dbType', () => {
    it('should be sqlite', () => {
      const instance = new SQLiteActionManagerV2();
      expect((instance as any).dbType).toBe('sqlite');
    });
  });
});

// ==================== 4. SQLiteSQLActionManager (V1) 测试 ====================

describe('SQLiteSQLActionManager (V1)', () => {
  let mockDB: any;

  beforeEach(() => {
    (SQLiteActionManager as any).conn = null;
    (SQLiteActionManager as any).host = '';
    mockDB = createMockDB({
      allResult: [{ id: 1, title: 'Test' }],
      runResult: { lastID: 1, changes: 1 },
      getResult: { id: 1, title: 'Test' },
    });
  });

  afterEach(() => {
    (SQLiteActionManager as any).conn = null;
  });

  describe('init', () => {
    it('should init with existing Database instance (情况3)', () => {
      SQLiteActionManager.init({ host: ':memory:' }, mockDB);
      expect((SQLiteActionManager as any).conn).toBe(mockDB);
    });

    it('should init with sqlite3 module (情况1)', () => {
      const mockDBInstance = createMockDB();
      const mockModule = {
        Database: function() {},
        verbose: () => ({
          Database: function(this: any, path: string, cb: Function) {
            Object.assign(this, mockDBInstance);
          },
        }),
      };
      SQLiteActionManager.init({ host: ':memory:' }, mockModule);
      expect((SQLiteActionManager as any).conn).not.toBeNull();
    });

    it('should init with Database class (情况2)', () => {
      // 情况2 sets SQLite3 = the passed function, then uses new SQLite3.Database(...)
      // So we need a function with prototype.run AND a .Database constructor property
      function MockSQLite3() {}
      MockSQLite3.prototype.run = function() {};
      (MockSQLite3 as any).Database = function(this: any, path: string, cb: Function) {
        this.run = mockDB.run;
        this.get = mockDB.get;
        this.all = mockDB.all;
        this.close = mockDB.close;
      };

      SQLiteActionManager.init({ host: ':memory:' }, MockSQLite3);
      expect((SQLiteActionManager as any).conn).not.toBeNull();
    });
  });

  describe('setDatabaseInstance', () => {
    it('should directly set the database instance', () => {
      SQLiteActionManager.setDatabaseInstance(mockDB);
      expect((SQLiteActionManager as any).conn).toBe(mockDB);
    });
  });

  describe('createTransaction', () => {
    it('should reject when not initialized', async () => {
      await expect(SQLiteActionManager.createTransaction()).rejects.toThrow('SQLite not initialized');
    });

    it('should create transaction with begin/commit/rollback', async () => {
      (SQLiteActionManager as any).conn = mockDB;
      const tx = await SQLiteActionManager.createTransaction();
      expect(tx.client).toBe(mockDB);
      expect(typeof tx.begin).toBe('function');
      expect(typeof tx.commit).toBe('function');
      expect(typeof tx.rollback).toBe('function');
    });
  });

  describe('execute (private static)', () => {
    it('should throw when not initialized', () => {
      expect(() => {
        (SQLiteActionManager as any).execute('SELECT 1', [], 'all');
      }).toThrow('SQLite not initialized');
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should query with get mode', async () => {
      const result = await SQLiteActionManager.findAll({
        configs: { tableName: 'test_items', fields: [] },
      } as any);
      const call = mockDB._calls[0];
      expect(call.method).toBe('get');
      expect(call.sql).toContain('SELECT');
      expect(call.sql).toContain('test_items');
    });
  });

  describe('findList', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
      mockDB.getResult = { total: 5 };
    });

    it('should return data with recordsTotal', async () => {
      const result = await SQLiteActionManager.findList({
        configs: { tableName: 'test_items', fields: [] },
        limit: [0, 10],
      } as any);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('recordsTotal');
    });
  });

  describe('insert', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should insert a record', async () => {
      const result = await SQLiteActionManager.insert({
        configs: { tableName: 'test_items', fields: [] },
        insertion: { title: 'Hello', status: 1 },
      } as any);
      const call = mockDB._calls[0];
      expect(call.method).toBe('run');
      expect(call.sql).toContain('INSERT INTO');
      expect(call.sql).toContain('test_items');
      expect(result.title).toBe('Hello');
    });
  });

  describe('inserts', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should batch insert records', async () => {
      await SQLiteActionManager.inserts({
        configs: { tableName: 'test_items', fields: [] },
        insertion: [
          { title: 'A', status: 1 },
          { title: 'B', status: 2 },
        ],
      } as any);
      const call = mockDB._calls[0];
      expect(call.method).toBe('run');
      expect(call.sql).toContain('INSERT INTO');
      expect(call.sql).toContain('VALUES');
      expect(call.params.length).toBe(4); // 2 records × 2 fields
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should delete with conditions', async () => {
      await SQLiteActionManager.delete({
        configs: { tableName: 'test_items', fields: [] },
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      const call = mockDB._calls[0];
      expect(call.method).toBe('run');
      expect(call.sql).toContain('DELETE FROM');
    });

    it('should reject delete without conditions', async () => {
      await expect(
        SQLiteActionManager.delete({
          configs: { tableName: 'test_items', fields: [] },
        } as any)
      ).rejects.toBe('Deletion conditions required to prevent full table deletion.');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should update with SET and WHERE', async () => {
      await SQLiteActionManager.update({
        configs: { tableName: 'test_items', fields: [] },
        update: [{ key: 'title', value: 'Updated', operator: 'replace' }],
        where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
      } as any);
      const call = mockDB._calls[0];
      expect(call.method).toBe('run');
      expect(call.sql).toContain('UPDATE');
      expect(call.sql).toContain('SET');
    });

    it('should support LIMIT in update', async () => {
      await SQLiteActionManager.update({
        configs: { tableName: 'test_items', fields: [] },
        update: [{ key: 'status', value: 0, operator: 'replace' }],
        where: [{ key: 'status', operator: '=', value: 1, logic: 'and' }],
        limit: 10,
      } as any);
      const call = mockDB._calls[0];
      expect(call.sql).toContain('LIMIT ?');
    });
  });

  describe('aggregate', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
      mockDB.allResult = [{ total: 10 }];
    });

    it('should handle COUNT aggregate', async () => {
      const result = await SQLiteActionManager.aggregate({
        configs: { tableName: 'test_items', fields: [] },
        aggregate: [{ function: 'count', field: '*', name: 'total' }],
      } as any);
      const call = mockDB._calls[0];
      expect(call.sql).toContain('COUNT(*)');
      expect(call.sql).toContain('AS total');
    });

    it('should handle multiple aggregates', async () => {
      await SQLiteActionManager.aggregate({
        configs: { tableName: 'test_items', fields: [] },
        aggregate: [
          { function: 'count', field: '*', name: 'total' },
          { function: 'sum', field: 'status', name: 'total_status' },
          { function: 'avg', field: 'status', name: 'avg_status' },
          { function: 'max', field: 'id', name: 'max_id' },
          { function: 'min', field: 'id', name: 'min_id' },
        ],
      } as any);
      const call = mockDB._calls[0];
      expect(call.sql).toContain('COUNT(*)');
      expect(call.sql).toContain('SUM(status)');
      expect(call.sql).toContain('AVG(status)');
      expect(call.sql).toContain('MAX(id)');
      expect(call.sql).toContain('MIN(id)');
    });
  });

  describe('sql (raw query)', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should execute SELECT with all mode', async () => {
      await SQLiteActionManager.sql('SELECT * FROM test', []);
      expect(mockDB._calls[0].method).toBe('all');
    });

    it('should execute non-SELECT with run mode', async () => {
      await SQLiteActionManager.sql('INSERT INTO test VALUES (?)', [1]);
      expect(mockDB._calls[0].method).toBe('run');
    });
  });

  describe('find (waterfall pagination)', () => {
    beforeEach(() => {
      (SQLiteActionManager as any).conn = mockDB;
    });

    it('should return isLastPage true when data is less than limit', async () => {
      mockDB.allResult = [{ id: 1 }, { id: 2 }];
      // request 10 items, fetchCount = 11, returns 2 < 11 => isLastPage
      const result = await SQLiteActionManager.find({
        configs: { tableName: 'test_items', fields: [] },
        limit: [0, 10],
      } as any);
      expect(result.isLastPage).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should return isLastPage false when data equals fetchCount', async () => {
      // limit = 2, fetchCount = 3, return 3 items => isLastPage = false
      mockDB.allResult = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = await SQLiteActionManager.find({
        configs: { tableName: 'test_items', fields: [] },
        limit: [0, 2],
      } as any);
      expect(result.isLastPage).toBe(false);
      expect(result.data.length).toBe(2); // last item trimmed
    });

    it('should default limit to [0, 10]', async () => {
      mockDB.allResult = [];
      const result = await SQLiteActionManager.find({
        configs: { tableName: 'test_items', fields: [] },
      } as any);
      expect(result.isLastPage).toBe(true);
    });
  });
});
