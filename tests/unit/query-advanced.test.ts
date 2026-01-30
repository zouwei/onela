/**
 * 高级查询模块全面单元测试
 * 覆盖: JoinBuilder, SubqueryBuilder, MetadataQuery
 */

import { JoinBuilder, createJoinBuilder } from '../../src/query/JoinBuilder.js';
import { SubqueryBuilder, createSubqueryBuilder, subqueryIn, subqueryExists } from '../../src/query/SubqueryBuilder.js';
import { MetadataQuery, createMetadataQuery } from '../../src/query/MetadataQuery.js';

// ==================== JoinBuilder ====================
describe('JoinBuilder', () => {
  describe('INNER JOIN', () => {
    it('should build basic INNER JOIN', () => {
      const jb = createJoinBuilder('users');
      jb.innerJoin('orders', [{ leftColumn: 'users.id', rightColumn: 'orders.user_id' }]);
      const result = jb.build();
      expect(result.joinSQL).toBe('INNER JOIN orders ON users.id = orders.user_id');
      expect(result.fromSQL).toContain('users INNER JOIN');
    });

    it('should build INNER JOIN with alias', () => {
      const jb = createJoinBuilder('users', 'u');
      jb.innerJoin('orders', [{ leftColumn: 'u.id', rightColumn: 'o.user_id' }], 'o');
      const result = jb.build();
      expect(result.joinSQL).toContain('INNER JOIN orders o ON');
      expect(result.fromSQL).toContain('users u');
    });

    it('should build INNER JOIN with multiple ON conditions', () => {
      const jb = createJoinBuilder('users');
      jb.innerJoin('orders', [
        { leftColumn: 'users.id', rightColumn: 'orders.user_id' },
        { leftColumn: 'users.tenant_id', rightColumn: 'orders.tenant_id', logic: 'AND' },
      ]);
      const result = jb.build();
      expect(result.joinSQL).toContain('users.id = orders.user_id');
      expect(result.joinSQL).toContain('AND users.tenant_id = orders.tenant_id');
    });
  });

  describe('LEFT JOIN', () => {
    it('should build LEFT JOIN', () => {
      const jb = createJoinBuilder('users');
      jb.leftJoin('profiles', [{ leftColumn: 'users.id', rightColumn: 'profiles.user_id' }]);
      const result = jb.build();
      expect(result.joinSQL).toContain('LEFT JOIN profiles');
    });
  });

  describe('RIGHT JOIN', () => {
    it('should build RIGHT JOIN', () => {
      const jb = createJoinBuilder('orders');
      jb.rightJoin('users', [{ leftColumn: 'orders.user_id', rightColumn: 'users.id' }]);
      const result = jb.build();
      expect(result.joinSQL).toContain('RIGHT JOIN users');
    });
  });

  describe('CROSS JOIN', () => {
    it('should build CROSS JOIN without ON', () => {
      const jb = createJoinBuilder('colors');
      jb.crossJoin('sizes');
      const result = jb.build();
      expect(result.joinSQL).toBe('CROSS JOIN sizes');
    });
  });

  describe('FULL OUTER JOIN', () => {
    it('should build FULL OUTER JOIN', () => {
      const jb = createJoinBuilder('users');
      jb.fullJoin('orders', [{ leftColumn: 'users.id', rightColumn: 'orders.user_id' }]);
      const result = jb.build();
      expect(result.joinSQL).toContain('FULL OUTER JOIN orders');
    });
  });

  describe('shorthand join()', () => {
    it('should auto-generate ON condition', () => {
      const jb = createJoinBuilder('users');
      jb.join('orders');
      const result = jb.build();
      expect(result.joinSQL).toContain('users.id = orders.users_id');
    });

    it('should accept custom keys', () => {
      const jb = createJoinBuilder('users');
      jb.join('profiles', 'uid', 'id', 'LEFT');
      const result = jb.build();
      expect(result.joinSQL).toContain('LEFT JOIN profiles');
      expect(result.joinSQL).toContain('users.id = profiles.uid');
    });
  });

  describe('multiple JOINs', () => {
    it('should chain multiple JOINs', () => {
      const jb = createJoinBuilder('users', 'u');
      jb.innerJoin('orders', [{ leftColumn: 'u.id', rightColumn: 'o.user_id' }], 'o')
        .leftJoin('profiles', [{ leftColumn: 'u.id', rightColumn: 'p.user_id' }], 'p');
      const result = jb.build();
      expect(result.joinSQL).toContain('INNER JOIN orders o');
      expect(result.joinSQL).toContain('LEFT JOIN profiles p');
    });
  });

  describe('SELECT fields', () => {
    it('should build custom SELECT fields', () => {
      const jb = createJoinBuilder('users', 'u');
      jb.innerJoin('orders', [{ leftColumn: 'u.id', rightColumn: 'o.user_id' }], 'o')
        .select('u', 'name', 'user_name')
        .select('o', 'amount');
      const result = jb.build();
      expect(result.selectSQL).toBe('u.name AS user_name, o.amount');
    });

    it('should build SELECT * for table', () => {
      const jb = createJoinBuilder('users');
      jb.selectAll('users');
      const result = jb.build();
      expect(result.selectSQL).toBe('users.*');
    });

    it('should default to * when no select specified', () => {
      const jb = createJoinBuilder('users');
      const result = jb.build();
      expect(result.selectSQL).toBe('*');
    });
  });

  describe('buildSelectSQL', () => {
    it('should build complete SELECT SQL', () => {
      const jb = createJoinBuilder('users', 'u');
      jb.leftJoin('orders', [{ leftColumn: 'u.id', rightColumn: 'o.user_id' }], 'o')
        .select('u', 'name')
        .select('o', 'amount');
      const sql = jb.buildSelectSQL('u.status = 1', 'o.created_at DESC', '10');
      expect(sql).toContain('SELECT u.name, o.amount');
      expect(sql).toContain('FROM users u LEFT JOIN orders o');
      expect(sql).toContain('WHERE u.status = 1');
      expect(sql).toContain('ORDER BY o.created_at DESC');
      expect(sql).toContain('LIMIT 10');
    });

    it('should omit optional clauses', () => {
      const jb = createJoinBuilder('users');
      const sql = jb.buildSelectSQL();
      expect(sql).toContain('SELECT * FROM users');
      expect(sql).not.toContain('WHERE');
      expect(sql).not.toContain('ORDER BY');
    });
  });

  describe('reset', () => {
    it('should reset builder state', () => {
      const jb = createJoinBuilder('users');
      jb.innerJoin('orders', [{ leftColumn: 'a', rightColumn: 'b' }])
        .select('users', 'name');
      jb.reset();
      const result = jb.build();
      expect(result.joinSQL).toBe('');
      expect(result.selectSQL).toBe('*');
    });
  });

  describe('custom operator in ON', () => {
    it('should support custom operator', () => {
      const jb = createJoinBuilder('a');
      jb.innerJoin('b', [{ leftColumn: 'a.id', rightColumn: 'b.parent_id', operator: '!=' }]);
      const result = jb.build();
      expect(result.joinSQL).toContain('a.id != b.parent_id');
    });
  });
});

// ==================== SubqueryBuilder ====================
describe('SubqueryBuilder', () => {
  describe('buildSQL', () => {
    it('should build basic SELECT', () => {
      const sb = createSubqueryBuilder('users');
      const { sql, params } = sb.buildSQL();
      expect(sql).toBe('SELECT * FROM users');
      expect(params).toEqual([]);
    });

    it('should build SELECT with fields', () => {
      const sb = createSubqueryBuilder('users').select('id', 'name');
      const { sql } = sb.buildSQL();
      expect(sql).toBe('SELECT id, name FROM users');
    });

    it('should build with WHERE', () => {
      const sb = createSubqueryBuilder('users')
        .select('id')
        .where('status = ?', 1)
        .where('age > ?', 18);
      const { sql, params } = sb.buildSQL();
      expect(sql).toBe('SELECT id FROM users WHERE status = ? AND age > ?');
      expect(params).toEqual([1, 18]);
    });

    it('should build with ORDER BY', () => {
      const sb = createSubqueryBuilder('users')
        .select('id')
        .orderBy('created_at', 'DESC');
      const { sql } = sb.buildSQL();
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should build with LIMIT and OFFSET', () => {
      const sb = createSubqueryBuilder('users')
        .limit(10)
        .offset(20);
      const { sql } = sb.buildSQL();
      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 20');
    });

    it('should build with GROUP BY', () => {
      const sb = createSubqueryBuilder('orders')
        .select('user_id')
        .groupBy('user_id');
      const { sql } = sb.buildSQL();
      expect(sql).toContain('GROUP BY user_id');
    });
  });

  describe('toInClause', () => {
    it('should generate IN subquery', () => {
      const sb = createSubqueryBuilder('users')
        .select('id')
        .where('status = ?', 1);
      const def = sb.toInClause('user_id');
      expect(def.type).toBe('in');
      expect(def.sql).toBe('user_id IN (SELECT id FROM users WHERE status = ?)');
      expect(def.params).toEqual([1]);
      expect(def.field).toBe('user_id');
    });
  });

  describe('toNotInClause', () => {
    it('should generate NOT IN subquery', () => {
      const sb = createSubqueryBuilder('blacklist').select('user_id');
      const def = sb.toNotInClause('id');
      expect(def.type).toBe('not_in');
      expect(def.sql).toContain('NOT IN');
    });
  });

  describe('toExistsClause', () => {
    it('should generate EXISTS subquery', () => {
      const sb = createSubqueryBuilder('orders')
        .select('1')
        .where('orders.user_id = users.id');
      const def = sb.toExistsClause();
      expect(def.type).toBe('exists');
      expect(def.sql).toBe('EXISTS (SELECT 1 FROM orders WHERE orders.user_id = users.id)');
    });
  });

  describe('toNotExistsClause', () => {
    it('should generate NOT EXISTS subquery', () => {
      const sb = createSubqueryBuilder('orders').select('1').where('1=0');
      const def = sb.toNotExistsClause();
      expect(def.type).toBe('not_exists');
      expect(def.sql).toContain('NOT EXISTS');
    });
  });

  describe('toScalar', () => {
    it('should generate scalar subquery', () => {
      const sb = createSubqueryBuilder('orders')
        .select('COUNT(*)')
        .where('orders.user_id = users.id');
      const def = sb.toScalar('order_count');
      expect(def.type).toBe('scalar');
      expect(def.sql).toContain(') AS order_count');
      expect(def.alias).toBe('order_count');
    });
  });

  describe('toFromClause', () => {
    it('should generate FROM subquery', () => {
      const sb = createSubqueryBuilder('orders')
        .select('user_id', 'SUM(amount) AS total')
        .groupBy('user_id');
      const def = sb.toFromClause('order_totals');
      expect(def.type).toBe('from');
      expect(def.sql).toContain(') AS order_totals');
    });
  });

  describe('shortcut functions', () => {
    it('subqueryIn should work', () => {
      const def = subqueryIn('user_id', 'active_users', 'id', 'status = ?', 1);
      expect(def.type).toBe('in');
      expect(def.sql).toContain('user_id IN (SELECT id FROM active_users WHERE status = ?)');
      expect(def.params).toEqual([1]);
    });

    it('subqueryIn without WHERE', () => {
      const def = subqueryIn('user_id', 'users', 'id');
      expect(def.sql).toBe('user_id IN (SELECT id FROM users)');
    });

    it('subqueryExists should work', () => {
      const def = subqueryExists('orders', 'orders.user_id = users.id AND status = ?', 'active');
      expect(def.type).toBe('exists');
      expect(def.sql).toContain('EXISTS');
      expect(def.params).toEqual(['active']);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const sb = createSubqueryBuilder('users')
        .select('id')
        .where('status = 1')
        .orderBy('id')
        .limit(10)
        .groupBy('status');
      sb.reset();
      const { sql } = sb.buildSQL();
      expect(sql).toBe('SELECT * FROM users');
    });
  });
});

// ==================== MetadataQuery ====================
describe('MetadataQuery', () => {
  const dbTypes = ['mysql', 'postgresql', 'sqlite', 'sqlserver', 'oracle'];

  describe('getDatabasesSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const mq = createMetadataQuery(dbType);
      const sql = mq.getDatabasesSQL();
      expect(sql).toBeTruthy();
      expect(typeof sql).toBe('string');
    });

    it('should throw for unsupported type', () => {
      expect(() => createMetadataQuery('unknown').getDatabasesSQL()).toThrow();
    });

    it('should use information_schema for MySQL', () => {
      expect(createMetadataQuery('mysql').getDatabasesSQL()).toContain('information_schema');
    });

    it('should use pg_database for PostgreSQL', () => {
      expect(createMetadataQuery('postgresql').getDatabasesSQL()).toContain('pg_database');
    });
  });

  describe('getTableRowCountSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getTableRowCountSQL('users');
      expect(sql.toLowerCase()).toContain('users');
    });
  });

  describe('getTableSizeSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getTableSizeSQL('users');
      expect(sql).toBeTruthy();
    });
  });

  describe('getIndexesSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getIndexesSQL('users');
      expect(sql).toBeTruthy();
    });

    it('should use STATISTICS for MySQL', () => {
      expect(createMetadataQuery('mysql').getIndexesSQL('users')).toContain('STATISTICS');
    });
  });

  describe('getForeignKeysSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getForeignKeysSQL('orders');
      expect(sql).toBeTruthy();
    });
  });

  describe('getVersionSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getVersionSQL();
      expect(sql).toContain('version');
    });
  });

  describe('getCurrentDatabaseSQL', () => {
    it.each(dbTypes)('should generate valid SQL for %s', (dbType) => {
      const sql = createMetadataQuery(dbType).getCurrentDatabaseSQL();
      expect(sql).toBeTruthy();
    });

    it('should use DATABASE() for MySQL', () => {
      expect(createMetadataQuery('mysql').getCurrentDatabaseSQL()).toContain('DATABASE()');
    });

    it('should use current_database() for PostgreSQL', () => {
      expect(createMetadataQuery('postgresql').getCurrentDatabaseSQL()).toContain('current_database()');
    });
  });

  describe('database aliases', () => {
    it('should support mariadb as mysql', () => {
      expect(createMetadataQuery('mariadb').getVersionSQL()).toContain('VERSION()');
    });

    it('should support pg as postgresql', () => {
      expect(createMetadataQuery('pg').getVersionSQL()).toContain('version()');
    });

    it('should support mssql as sqlserver', () => {
      expect(createMetadataQuery('mssql').getVersionSQL()).toContain('@@VERSION');
    });
  });
});
