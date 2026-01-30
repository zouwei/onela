/**
 * validateIdentifier 边界测试
 * 验证所有模块中的标识符校验（tableName, fieldName, aggregate, orderBy 等）
 */

import { createSQLBuilder } from '../../src/builders/SQLBuilder.js';
import { createSubqueryBuilder } from '../../src/query/SubqueryBuilder.js';
import { createDDLBuilder } from '../../src/schema/DDLBuilder.js';

// ==================== SQLBuilder identifier validation ====================
describe('SQLBuilder - identifier validation', () => {
  const builder = createSQLBuilder('mysql');

  describe('tableName validation', () => {
    it('should accept valid table names', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
      });
      expect(result.sql).toContain('users');
    });

    it('should accept table names with underscores', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'user_profiles', engine: 'default' },
        command: { tableName: 'user_profiles' },
      });
      expect(result.sql).toContain('user_profiles');
    });
  });

  describe('SELECT field validation', () => {
    it('should accept valid field names', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        select: ['id', 'name', 'email'],
      });
      expect(result.sql).toContain('id');
    });

    it('should accept fields with table prefix (t.field)', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        select: ['t.id', 't.name'],
      });
      expect(result.sql).toContain('t.id');
    });

    it('should accept wildcard *', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        select: ['*'],
      });
      expect(result.sql).toContain('*');
    });

    it('should reject SQL injection in field names', () => {
      expect(() => {
        builder.buildSelect({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          select: ['id; DROP TABLE users'],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should reject fields with quotes', () => {
      expect(() => {
        builder.buildSelect({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          select: ["id'"],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should reject fields with parentheses', () => {
      expect(() => {
        builder.buildSelect({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          select: ['COUNT(*)'],
        });
      }).toThrow('Invalid SQL identifier');
    });
  });

  describe('WHERE key validation', () => {
    it('should accept valid WHERE keys', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        where: [{ key: 'status', operator: '=', value: 1, logic: 'and' }],
      });
      expect(result.sql).toContain('status');
    });

    it('should reject injection in WHERE keys', () => {
      expect(() => {
        builder.buildSelect({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          where: [{ key: '1=1; DROP TABLE users--', operator: '=', value: 1, logic: 'and' }],
        });
      }).toThrow('Invalid SQL identifier');
    });
  });

  describe('ORDER BY validation', () => {
    it('should accept valid ORDER BY fields', () => {
      const result = builder.buildSelect({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        orderBy: { create_time: 'DESC' },
      });
      expect(result.sql).toContain('create_time');
    });

    it('should reject injection in ORDER BY', () => {
      expect(() => {
        builder.buildSelect({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          orderBy: { 'id; DROP TABLE users--': 'ASC' },
        });
      }).toThrow('Invalid SQL identifier');
    });
  });

  describe('UPDATE key validation', () => {
    it('should reject injection in UPDATE keys', () => {
      expect(() => {
        builder.buildUpdate({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          update: [{ key: "name' OR '1'='1", value: 'hack', operator: 'replace' }],
          where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
        });
      }).toThrow('Invalid SQL identifier');
    });
  });

  describe('aggregate validation', () => {
    it('should accept valid aggregate fields', () => {
      const result = builder.buildAggregate({
        configs: { tableName: 'users', engine: 'default' },
        command: { tableName: 'users' },
        aggregate: [{ function: 'count', field: '*', name: 'total' }],
      });
      expect(result.sql).toContain('COUNT(*)');
    });

    it('should reject injection in aggregate field', () => {
      expect(() => {
        builder.buildAggregate({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          aggregate: [{ function: 'count', field: '* FROM users; --', name: 'total' }],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should reject injection in aggregate name', () => {
      expect(() => {
        builder.buildAggregate({
          configs: { tableName: 'users', engine: 'default' },
          command: { tableName: 'users' },
          aggregate: [{ function: 'count', field: '*', name: 'total; DROP TABLE users' }],
        });
      }).toThrow('Invalid SQL identifier');
    });
  });
});

// ==================== SubqueryBuilder identifier validation ====================
describe('SubqueryBuilder - identifier validation', () => {
  it('should accept valid table names', () => {
    const sb = createSubqueryBuilder('orders');
    const { sql } = sb.buildSQL();
    expect(sql).toContain('orders');
  });

  it('should reject injection in table name', () => {
    expect(() => {
      createSubqueryBuilder('orders; DROP TABLE users');
    }).toThrow('Invalid SQL identifier');
  });

  it('should reject digit-starting table names', () => {
    expect(() => {
      createSubqueryBuilder('1orders');
    }).toThrow('Invalid SQL identifier');
  });

  it('should accept underscore-starting table names', () => {
    const sb = createSubqueryBuilder('_temp_table');
    const { sql } = sb.buildSQL();
    expect(sql).toContain('_temp_table');
  });

  it('should reject injection in select fields', () => {
    const sb = createSubqueryBuilder('orders');
    expect(() => {
      sb.select("id; DROP TABLE users--");
    }).toThrow('Unsafe SQL expression');
  });

  it('should reject injection in orderBy field', () => {
    const sb = createSubqueryBuilder('orders');
    expect(() => {
      sb.orderBy('id; DROP TABLE users');
    }).toThrow('Invalid SQL identifier');
  });

  it('should reject injection in groupBy field', () => {
    const sb = createSubqueryBuilder('orders');
    expect(() => {
      sb.groupBy('id; DROP TABLE users');
    }).toThrow('Invalid SQL identifier');
  });

  it('should reject injection in toInClause field', () => {
    const sb = createSubqueryBuilder('orders').select('id');
    expect(() => {
      sb.toInClause("user_id' OR '1'='1");
    }).toThrow('Invalid SQL identifier');
  });

  it('should reject injection in toScalar alias', () => {
    const sb = createSubqueryBuilder('orders').select('COUNT(*)');
    expect(() => {
      sb.toScalar("alias; DROP TABLE users");
    }).toThrow('Invalid SQL identifier');
  });

  it('should reject injection in toFromClause alias', () => {
    const sb = createSubqueryBuilder('orders').select('*');
    expect(() => {
      sb.toFromClause("sub; DROP TABLE users");
    }).toThrow('Invalid SQL identifier');
  });
});

// ==================== DDLBuilder identifier validation ====================
describe('DDLBuilder - identifier validation', () => {
  const ddl = createDDLBuilder('mysql');

  it('should reject injection in engine option', () => {
    expect(() => {
      ddl.buildCreateTable({
        tableName: 'test',
        columns: [{ name: 'id', type: 'int' }],
        engine: "InnoDB; DROP TABLE users--",
      });
    }).toThrow();
  });

  it('should reject injection in charset option', () => {
    expect(() => {
      ddl.buildCreateTable({
        tableName: 'test',
        columns: [{ name: 'id', type: 'int' }],
        charset: "utf8mb4'; DROP TABLE users--",
      });
    }).toThrow();
  });

  it('should accept valid engine/charset values', () => {
    const sql = ddl.buildCreateTable({
      tableName: 'test',
      columns: [{ name: 'id', type: 'int' }],
      engine: 'InnoDB',
      charset: 'utf8mb4',
    });
    expect(sql).toContain('InnoDB');
    expect(sql).toContain('utf8mb4');
  });
});

// ==================== Grammar file identifier validation ====================
describe('Grammar modules - identifier validation', () => {
  // Test MySQL grammar
  describe('MySQL grammar', () => {
    let getParameters: any;

    beforeAll(async () => {
      const mod = await import('../../src/grammar/mysql.js');
      getParameters = mod.getParameters;
    });

    it('should reject injection in select fields', () => {
      expect(() => {
        getParameters({
          select: ["id; DROP TABLE users--"],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should accept valid select fields', () => {
      const result = getParameters({
        select: ['id', 'name', 't.email'],
      });
      expect(result.select).toContain('id');
      expect(result.select).toContain('name');
    });

    it('should reject injection in WHERE key', () => {
      expect(() => {
        getParameters({
          where: [{ key: "id' OR '1'='1", value: 1, operator: '=' }],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should reject injection in orderBy field', () => {
      expect(() => {
        getParameters({
          orderBy: { 'id; DROP TABLE users': 'ASC' },
        });
      }).toThrow('Invalid SQL identifier');
    });
  });

  // Test PostgreSQL grammar
  describe('PostgreSQL grammar', () => {
    let getParameters: any;

    beforeAll(async () => {
      const mod = await import('../../src/grammar/postgresql.js');
      getParameters = mod.getParameters;
    });

    it('should reject injection in select fields', () => {
      expect(() => {
        getParameters({
          select: ["id; DROP TABLE users--"],
        });
      }).toThrow('Invalid SQL identifier');
    });

    it('should accept valid select fields', () => {
      const result = getParameters({
        select: ['id', 'name'],
      });
      expect(result.select).toContain('id');
    });
  });

  // Test SQLite grammar
  describe('SQLite grammar', () => {
    let getParameters: any;

    beforeAll(async () => {
      const mod = await import('../../src/grammar/sqlite.js');
      getParameters = mod.getParameters;
    });

    it('should reject injection in select fields', () => {
      expect(() => {
        getParameters({
          select: ["id; DROP TABLE users--"],
        });
      }).toThrow('Invalid SQL identifier');
    });
  });
});
