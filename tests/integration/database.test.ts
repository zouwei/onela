/**
 * 数据库集成测试
 * 测试 Onela ORM 与真实数据库的交互
 *
 * 测试环境:
 * - MySQL: 192.168.3.56:3306
 * - PostgreSQL: 192.168.3.56:5432
 * - MariaDB: 192.168.3.56:3307
 */

// 测试配置
const TEST_CONFIG = {
  mysql: {
    host: '192.168.3.56',
    port: 3306,
    user: 'test',
    password: 'test123',
    database: 'onela_test',
  },
  postgresql: {
    host: '192.168.3.56',
    port: 5432,
    user: 'test',
    password: 'test123',
    database: 'onela_test',
  },
  mariadb: {
    host: '192.168.3.56',
    port: 3307,
    user: 'test',
    password: 'test123',
    database: 'onela_test',
  },
};

// 导入测试所需模块
import { SQLBuilder, createSQLBuilder } from '../../src/builders/SQLBuilder.js';
import { DialectFactory } from '../../src/dialect/DialectFactory.js';
import { SQLInjectionPrevention, createSQLInjectionPrevention } from '../../src/security/SQLInjectionPrevention.js';
import { Logger, createLogger, LogLevel } from '../../src/logger/Logger.js';
import { Op, eq, gt, inArray, like } from '../../src/query/operators/index.js';
import { createQueryBuilder } from '../../src/query/QueryBuilder.js';
import { parseSimpleWhere } from '../../src/query/parsers/SimpleWhereParser.js';

/**
 * SQL 构建器测试套件
 */
describe('SQLBuilder Integration Tests', () => {
  describe('MySQL Dialect', () => {
    let builder: SQLBuilder;

    beforeEach(() => {
      builder = createSQLBuilder('mysql');
    });

    test('should build SELECT with multiple conditions', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        select: ['id', 'name', 'email'],
        where: [
          { key: 'status', operator: '=', value: 1, logic: 'and' },
          { key: 'age', operator: '>=', value: 18, logic: 'and' },
          { key: 'name', operator: '%%', value: '张', logic: 'and' },
        ],
        orderBy: { create_time: 'DESC' },
        limit: [0, 10],
      });

      expect(result.sql).toContain('SELECT id, name, email');
      expect(result.sql).toContain('FROM `users` AS t');
      expect(result.sql).toContain('status = ?');
      expect(result.sql).toContain('age >= ?');
      expect(result.sql).toContain('name LIKE ?');
      expect(result.sql).toContain('ORDER BY create_time DESC');
      expect(result.sql).toContain('LIMIT');
      expect(result.params).toEqual([1, 18, '%张%', 0, 10]);
    });

    test('should build UPDATE with CASE WHEN', () => {
      const result = builder.buildUpdate({
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
      expect(result.sql).toContain('ELSE status END');
    });

    test('should build batch INSERT', () => {
      const result = builder.buildBatchInsert('users', [
        { name: '测试用户1', email: 'test1@example.com', age: 25 },
        { name: '测试用户2', email: 'test2@example.com', age: 30 },
        { name: '测试用户3', email: 'test3@example.com', age: 28 },
      ]);

      expect(result.sql).toContain('INSERT INTO');
      expect(result.sql).toContain('VALUES');
      expect(result.params.length).toBe(9);
    });
  });

  describe('PostgreSQL Dialect', () => {
    let builder: SQLBuilder;

    beforeEach(() => {
      builder = createSQLBuilder('postgresql');
    });

    test('should use $n placeholders', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        where: [
          { key: 'status', operator: '=', value: 1, logic: 'and' },
          { key: 'age', operator: '>=', value: 18, logic: 'and' },
        ],
      });

      expect(result.sql).toContain('$1');
      expect(result.sql).toContain('$2');
    });

    test('should build LIMIT OFFSET correctly', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        limit: [10, 20],
      });

      expect(result.sql).toContain('LIMIT $1 OFFSET $2');
      expect(result.params).toContain(20); // limit
      expect(result.params).toContain(10); // offset
    });
  });
});

/**
 * 查询操作符测试套件
 */
describe('Query Operators Tests', () => {
  test('Op.eq should create equality condition', () => {
    const condition = eq('name', 'John');
    expect(condition.operator).toBe('=');
    expect(condition.value).toBe('John');
  });

  test('Op.gt should create greater than condition', () => {
    const condition = gt('age', 18);
    expect(condition.operator).toBe('>');
    expect(condition.value).toBe(18);
  });

  test('Op.in should create IN condition', () => {
    const condition = inArray('status', [1, 2, 3]);
    expect(condition.operator).toBe('in');
    expect(condition.value).toEqual([1, 2, 3]);
  });

  test('Op.like should create LIKE condition', () => {
    const condition = like('name', 'John');
    expect(condition.operator).toBe('%%');
    expect(condition.value).toBe('John');
  });
});

/**
 * 简单 WHERE 解析器测试套件
 */
describe('SimpleWhereParser Tests', () => {
  test('should parse simple equality', () => {
    const result = parseSimpleWhere({ name: 'John', age: 25 });
    expect(result.length).toBe(2);
    expect(result[0].key).toBe('name');
    expect(result[0].operator).toBe('=');
    expect(result[0].value).toBe('John');
  });

  test('should parse operators', () => {
    const result = parseSimpleWhere({
      age: { $gte: 18 },
      status: { $in: [1, 2, 3] },
      name: { $like: 'John' },
    });

    expect(result.length).toBe(3);
    expect(result.find((r) => r.key === 'age')?.operator).toBe('>=');
    expect(result.find((r) => r.key === 'status')?.operator).toBe('in');
    expect(result.find((r) => r.key === 'name')?.operator).toBe('%%');
  });

  test('should parse $or conditions', () => {
    const result = parseSimpleWhere({
      $or: [{ status: 1 }, { status: 2 }],
    } as any);

    expect(result.length).toBe(2);
    expect(result[1].logic).toBe('or');
  });
});

/**
 * QueryBuilder 测试套件
 */
describe('QueryBuilder Tests', () => {
  test('should build query with chain methods', () => {
    const configs = { tableName: 'users', engine: 'default' };
    const qb = createQueryBuilder(configs);

    const params = qb
      .select('id', 'name', 'email')
      .where('status', 1)
      .where('age', '>=', 18)
      .orderBy('create_time', 'DESC')
      .limit(0, 10)
      .build();

    expect(params.select).toEqual(['id', 'name', 'email']);
    expect(params.where?.length).toBe(2);
    expect(params.orderBy).toEqual({ create_time: 'DESC' });
    expect(params.limit).toEqual([0, 10]);
  });

  test('should support whereIn', () => {
    const configs = { tableName: 'users', engine: 'default' };
    const qb = createQueryBuilder(configs);

    const params = qb.whereIn('status', [1, 2, 3]).build();

    expect(params.where?.[0].operator).toBe('in');
    expect(params.where?.[0].value).toEqual([1, 2, 3]);
  });

  test('should support pagination', () => {
    const configs = { tableName: 'users', engine: 'default' };
    const qb = createQueryBuilder(configs);

    const params = qb.page(2, 20).build();

    expect(params.limit).toEqual([20, 20]); // offset = (2-1) * 20 = 20
  });
});

/**
 * SQL 注入防护测试套件
 */
describe('SQLInjectionPrevention Tests', () => {
  let security: SQLInjectionPrevention;

  beforeEach(() => {
    security = createSQLInjectionPrevention({ enabled: true, throwOnDetection: false });
  });

  test('should detect SQL injection patterns', () => {
    const maliciousInputs = [
      "1'; DROP TABLE users; --",
      '1 OR 1=1',
      "1' UNION SELECT * FROM users --",
      'SLEEP(10)',
      "'; EXEC xp_cmdshell('dir'); --",
    ];

    for (const input of maliciousInputs) {
      const result = security.validateValue(input);
      expect(result.valid).toBe(false);
    }
  });

  test('should allow safe inputs', () => {
    const safeInputs = [
      'John Doe',
      'john@example.com',
      '普通中文文本',
      12345,
      true,
      null,
      ['a', 'b', 'c'],
    ];

    for (const input of safeInputs) {
      const result = security.validateValue(input);
      expect(result.valid).toBe(true);
    }
  });

  test('should escape special characters', () => {
    const input = "O'Brien";
    const escaped = security.escape(input);
    expect(escaped).toBe("O\\'Brien");
  });

  test('should escape LIKE wildcards', () => {
    const input = '100%';
    const escaped = security.escapeLike(input);
    expect(escaped).toBe('100\\%');
  });
});

/**
 * 日志系统测试套件
 */
describe('Logger Tests', () => {
  test('should create logger with default config', () => {
    const logger = createLogger('Test');
    expect(logger).toBeDefined();
  });

  test('should create child logger', () => {
    const logger = createLogger('Parent');
    const childLogger = logger.child('Child');
    expect(childLogger).toBeDefined();
  });

  test('should log SQL with timing', () => {
    const logger = createLogger('SQL', { logSQL: true, logDuration: true });
    // 不会抛出错误
    expect(() => {
      logger.sql('SELECT * FROM users', [1, 2, 3], 100);
    }).not.toThrow();
  });
});

/**
 * 方言工厂测试套件
 */
describe('DialectFactory Tests', () => {
  test('should create MySQL dialect', () => {
    const dialect = DialectFactory.create('mysql');
    expect(dialect.getType()).toBe('mysql');
  });

  test('should create PostgreSQL dialect', () => {
    const dialect = DialectFactory.create('postgresql');
    expect(dialect.getType()).toBe('postgresql');
  });

  test('should create dialect with alias', () => {
    const pg1 = DialectFactory.create('postgresql');
    const pg2 = DialectFactory.create('postgres');
    const pg3 = DialectFactory.create('pg');
    expect(pg1.getType()).toBe('postgresql');
    expect(pg2.getType()).toBe('postgresql');
    expect(pg3.getType()).toBe('postgresql');
  });

  test('should support MySQL compatible databases', () => {
    const types = ['mysql', 'mariadb', 'tidb', 'oceanbase', 'polardb'];
    for (const type of types) {
      const dialect = DialectFactory.create(type);
      expect(dialect).toBeDefined();
    }
  });

  test('should throw for unsupported types', () => {
    expect(() => DialectFactory.create('unsupported')).toThrow();
  });
});

// 运行测试
console.log('Running Onela ORM Integration Tests...');
