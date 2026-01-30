/**
 * SQLBuilder 单元测试
 * 测试 SQL 构建器的各种功能
 */

import { SQLBuilder, createSQLBuilder } from '../../src/builders/SQLBuilder.js';
import { DialectFactory } from '../../src/dialect/DialectFactory.js';

describe('SQLBuilder', () => {
  let mysqlBuilder: SQLBuilder;
  let pgBuilder: SQLBuilder;
  let sqliteBuilder: SQLBuilder;

  beforeEach(() => {
    mysqlBuilder = createSQLBuilder('mysql');
    pgBuilder = createSQLBuilder('postgresql');
    sqliteBuilder = createSQLBuilder('sqlite');
  });

  describe('buildSelect', () => {
    it('should build basic SELECT query for MySQL', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
      });

      expect(result.sql).toContain('SELECT t.* FROM `users` AS t');
      expect(result.sql).toContain('WHERE 1=1');
    });

    it('should build SELECT with specific columns', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        select: ['id', 'name', 'email'],
      });

      expect(result.sql).toContain('SELECT id, name, email');
    });

    it('should build SELECT with WHERE conditions', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        where: [
          { key: 'status', operator: '=', value: 1, logic: 'and' },
          { key: 'age', operator: '>=', value: 18, logic: 'and' },
        ],
      });

      expect(result.sql).toContain('status = ?');
      expect(result.sql).toContain('age >= ?');
      expect(result.params).toContain(1);
      expect(result.params).toContain(18);
    });

    it('should build SELECT with IN operator', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        where: [
          { key: 'id', operator: 'in', value: [1, 2, 3], logic: 'and' },
        ],
      });

      expect(result.sql).toContain('id IN (?, ?, ?)');
      expect(result.params).toEqual([1, 2, 3]);
    });

    it('should build SELECT with LIKE operator', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        where: [
          { key: 'name', operator: '%%', value: 'John', logic: 'and' },
        ],
      });

      expect(result.sql).toContain('name LIKE ?');
      expect(result.params).toContain('%John%');
    });

    it('should build SELECT with ORDER BY', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        orderBy: { create_time: 'DESC', id: 'ASC' },
      });

      expect(result.sql).toContain('ORDER BY create_time DESC, id ASC');
    });

    it('should build SELECT with LIMIT for MySQL', () => {
      const result = mysqlBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        limit: [10, 20],
      });

      expect(result.sql).toContain('LIMIT ?, ?');
      expect(result.params).toContain(10);
      expect(result.params).toContain(20);
    });

    it('should build SELECT with LIMIT for PostgreSQL', () => {
      const result = pgBuilder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        limit: [10, 20],
      });

      expect(result.sql).toContain('LIMIT $1 OFFSET $2');
      expect(result.params).toContain(20); // limit
      expect(result.params).toContain(10); // offset
    });
  });

  describe('buildUpdate', () => {
    it('should build basic UPDATE query', () => {
      const result = mysqlBuilder.buildUpdate({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        update: [
          { key: 'name', value: 'John', operator: 'replace' },
        ],
        where: [
          { key: 'id', operator: '=', value: 1, logic: 'and' },
        ],
      });

      expect(result.sql).toContain('UPDATE `users` SET name = ?');
      expect(result.sql).toContain('WHERE id = ?');
      expect(result.params).toContain('John');
      expect(result.params).toContain(1);
    });

    it('should build UPDATE with plus operator', () => {
      const result = mysqlBuilder.buildUpdate({
        configs: { tableName: 'products', engine: 'default' },
        command: { tableName: 'products' },
        update: [
          { key: 'stock', value: 10, operator: 'plus' },
        ],
        where: [
          { key: 'id', operator: '=', value: 1, logic: 'and' },
        ],
      });

      expect(result.sql).toContain('stock = stock + ?');
    });

    it('should build UPDATE with CASE WHEN', () => {
      const result = mysqlBuilder.buildUpdate({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        update: [
          {
            key: 'status',
            value: null,  // 使用 case_item 时 value 可以为 null
            case_field: 'id',
            case_item: [
              { case_value: 1, value: 'active', operator: 'replace' },
              { case_value: 2, value: 'inactive', operator: 'replace' },
            ],
          },
        ],
        where: [
          { key: 'id', operator: 'in', value: [1, 2], logic: 'and' },
        ],
      });

      expect(result.sql).toContain('CASE id');
      expect(result.sql).toContain('WHEN ? THEN ?');
    });
  });

  describe('buildDelete', () => {
    it('should build DELETE query', () => {
      const result = mysqlBuilder.buildDelete({
        configs: { tableName: 'users' },
        where: [
          { key: 'id', operator: '=', value: 1, logic: 'and' },
        ],
      });

      expect(result.sql).toContain('DELETE FROM `users`');
      expect(result.sql).toContain('WHERE id = ?');
    });
  });

  describe('buildInsert', () => {
    it('should build INSERT query for MySQL', () => {
      const result = mysqlBuilder.buildInsert('users', {
        name: 'John',
        email: 'john@example.com',
      });

      expect(result.sql).toContain('INSERT INTO');
      expect(result.sql).toContain('users');
      expect(result.sql).toContain('VALUES');
      expect(result.params.length).toBe(2);
    });
  });

  describe('buildBatchInsert', () => {
    it('should build batch INSERT query', () => {
      const result = mysqlBuilder.buildBatchInsert('users', [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ]);

      expect(result.sql).toContain('INSERT INTO');
      expect(result.sql).toContain('VALUES');
      expect(result.params.length).toBe(4);
    });
  });

  describe('buildAggregate', () => {
    it('should build aggregate query', () => {
      const result = mysqlBuilder.buildAggregate({
        configs: { tableName: 'orders', engine: 'default' },
        command: { tableName: 'orders' },
        aggregate: [
          { function: 'count', field: '*', name: 'total' },
          { function: 'sum', field: 'amount', name: 'total_amount' },
        ],
      });

      expect(result.sql).toContain('COUNT(*) AS total');
      expect(result.sql).toContain('SUM(amount) AS total_amount');
    });
  });
});

describe('Dialect Placeholders', () => {
  it('should use ? for MySQL', () => {
    const dialect = DialectFactory.create('mysql');
    expect(dialect.placeholder(1)).toBe('?');
    expect(dialect.placeholder(2)).toBe('?');
  });

  it('should use $n for PostgreSQL', () => {
    const dialect = DialectFactory.create('postgresql');
    expect(dialect.placeholder(1)).toBe('$1');
    expect(dialect.placeholder(2)).toBe('$2');
  });

  it('should use @pn for SQL Server', () => {
    const dialect = DialectFactory.create('sqlserver');
    expect(dialect.placeholder(1)).toBe('@p1');
    expect(dialect.placeholder(2)).toBe('@p2');
  });

  it('should use :n for Oracle', () => {
    const dialect = DialectFactory.create('oracle');
    expect(dialect.placeholder(1)).toBe(':1');
    expect(dialect.placeholder(2)).toBe(':2');
  });
});
