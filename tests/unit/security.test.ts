/**
 * Security 模块全面单元测试
 * 覆盖: OperationGuard, AuditLogger, RowLimiter, FieldAccessControl
 */

import { OperationGuard, createOperationGuard } from '../../src/security/OperationGuard.js';
import { AuditLogger, MemoryAuditStore, createAuditLogger } from '../../src/security/AuditLogger.js';
import { RowLimiter, createRowLimiter } from '../../src/security/RowLimiter.js';
import { FieldAccessControl, createFieldAccessControl } from '../../src/security/FieldAccessControl.js';

// ==================== OperationGuard ====================
describe('OperationGuard', () => {
  describe('default policy: allow', () => {
    let guard: OperationGuard;

    beforeEach(() => {
      guard = createOperationGuard({ defaultPolicy: 'allow' });
    });

    it('should allow all operations by default', () => {
      expect(guard.check('users', 'select')).toBe(true);
      expect(guard.check('users', 'insert')).toBe(true);
      expect(guard.check('users', 'update')).toBe(true);
      expect(guard.check('users', 'delete')).toBe(true);
      expect(guard.check('users', 'aggregate')).toBe(true);
      expect(guard.check('users', 'sql')).toBe(true);
    });

    it('should restrict operations when permissions are set', () => {
      guard.setPermission('users', ['select', 'insert']);
      expect(guard.check('users', 'select')).toBe(true);
      expect(guard.check('users', 'insert')).toBe(true);
      expect(guard.check('users', 'update')).toBe(false);
      expect(guard.check('users', 'delete')).toBe(false);
    });

    it('should still allow operations on non-configured tables', () => {
      guard.setPermission('users', ['select']);
      expect(guard.check('orders', 'delete')).toBe(true);
    });
  });

  describe('default policy: deny', () => {
    let guard: OperationGuard;

    beforeEach(() => {
      guard = createOperationGuard({ defaultPolicy: 'deny' });
    });

    it('should deny all operations by default', () => {
      expect(guard.check('users', 'select')).toBe(false);
      expect(guard.check('users', 'delete')).toBe(false);
    });

    it('should allow operations when explicitly permitted', () => {
      guard.setPermission('users', ['select', 'aggregate']);
      expect(guard.check('users', 'select')).toBe(true);
      expect(guard.check('users', 'aggregate')).toBe(true);
      expect(guard.check('users', 'insert')).toBe(false);
    });
  });

  describe('readonly', () => {
    it('should set table as readonly', () => {
      const guard = createOperationGuard();
      guard.setReadOnly('logs');
      expect(guard.check('logs', 'select')).toBe(true);
      expect(guard.check('logs', 'aggregate')).toBe(true);
      expect(guard.check('logs', 'insert')).toBe(false);
      expect(guard.check('logs', 'update')).toBe(false);
      expect(guard.check('logs', 'delete')).toBe(false);
    });
  });

  describe('globalDeny', () => {
    it('should globally deny specified operations', () => {
      const guard = createOperationGuard({
        defaultPolicy: 'allow',
        globalDeny: ['sql', 'delete'],
      });
      expect(guard.check('users', 'select')).toBe(true);
      expect(guard.check('users', 'sql')).toBe(false);
      expect(guard.check('users', 'delete')).toBe(false);
    });
  });

  describe('assert', () => {
    it('should throw on denied operation', () => {
      const guard = createOperationGuard({ defaultPolicy: 'deny' });
      expect(() => guard.assert('users', 'select')).toThrow('not allowed');
    });

    it('should not throw on allowed operation', () => {
      const guard = createOperationGuard({ defaultPolicy: 'allow' });
      expect(() => guard.assert('users', 'select')).not.toThrow();
    });
  });

  describe('getAllowed', () => {
    it('should return allowed operations for table', () => {
      const guard = createOperationGuard();
      guard.setPermission('users', ['select', 'insert']);
      const allowed = guard.getAllowed('users');
      expect(allowed).toContain('select');
      expect(allowed).toContain('insert');
      expect(allowed).not.toContain('delete');
    });

    it('should return all ops for unconfigured table with allow policy', () => {
      const guard = createOperationGuard({ defaultPolicy: 'allow' });
      const allowed = guard.getAllowed('unknown_table');
      expect(allowed.length).toBe(6);
    });

    it('should return empty for unconfigured table with deny policy', () => {
      const guard = createOperationGuard({ defaultPolicy: 'deny' });
      expect(guard.getAllowed('unknown_table')).toEqual([]);
    });
  });

  describe('removePermission', () => {
    it('should fall back to default policy after removal', () => {
      const guard = createOperationGuard({ defaultPolicy: 'allow' });
      guard.setPermission('users', ['select']);
      expect(guard.check('users', 'delete')).toBe(false);
      guard.removePermission('users');
      expect(guard.check('users', 'delete')).toBe(true);
    });
  });

  describe('onViolation callback', () => {
    it('should call onViolation when operation is denied', () => {
      const violations: string[] = [];
      const guard = createOperationGuard({
        defaultPolicy: 'deny',
        onViolation: (table, op) => violations.push(`${table}:${op}`),
      });
      guard.check('users', 'delete');
      expect(violations).toEqual(['users:delete']);
    });
  });

  describe('setEnabled', () => {
    it('should allow all when disabled', () => {
      const guard = createOperationGuard({ defaultPolicy: 'deny' });
      guard.setEnabled(false);
      expect(guard.check('users', 'delete')).toBe(true);
    });
  });

  describe('constructor with permissions', () => {
    it('should accept permissions in config', () => {
      const guard = createOperationGuard({
        permissions: [
          { tableName: 'users', allowed: ['select'] },
          { tableName: 'logs', allowed: [], readonly: true },
        ],
      });
      expect(guard.check('users', 'select')).toBe(true);
      expect(guard.check('users', 'delete')).toBe(false);
      expect(guard.check('logs', 'select')).toBe(true);
      expect(guard.check('logs', 'insert')).toBe(false);
    });
  });
});

// ==================== AuditLogger ====================
describe('AuditLogger', () => {
  describe('MemoryAuditStore', () => {
    let store: MemoryAuditStore;

    beforeEach(() => {
      store = new MemoryAuditStore(100);
    });

    it('should write and retrieve entries', async () => {
      store.write({
        id: '1', timestamp: new Date(), operation: 'select',
        tableName: 'users', engine: 'default', success: true,
      });
      expect(store.size).toBe(1);
      const all = store.getAll();
      expect(all.length).toBe(1);
      expect(all[0].tableName).toBe('users');
    });

    it('should evict old entries when exceeding max size', () => {
      const store = new MemoryAuditStore(3);
      for (let i = 0; i < 5; i++) {
        store.write({
          id: String(i), timestamp: new Date(), operation: 'select',
          tableName: `table_${i}`, engine: 'default', success: true,
        });
      }
      expect(store.size).toBe(3);
      const all = store.getAll();
      expect(all[0].tableName).toBe('table_2');
    });

    it('should filter by operation', async () => {
      store.write({ id: '1', timestamp: new Date(), operation: 'select', tableName: 'users', engine: 'default', success: true });
      store.write({ id: '2', timestamp: new Date(), operation: 'delete', tableName: 'users', engine: 'default', success: true });
      const results = await store.query({ operation: 'delete' });
      expect(results.length).toBe(1);
      expect(results[0].operation).toBe('delete');
    });

    it('should filter by tableName', async () => {
      store.write({ id: '1', timestamp: new Date(), operation: 'select', tableName: 'users', engine: 'default', success: true });
      store.write({ id: '2', timestamp: new Date(), operation: 'select', tableName: 'orders', engine: 'default', success: true });
      const results = await store.query({ tableName: 'orders' });
      expect(results.length).toBe(1);
    });

    it('should filter by failedOnly', async () => {
      store.write({ id: '1', timestamp: new Date(), operation: 'select', tableName: 'users', engine: 'default', success: true });
      store.write({ id: '2', timestamp: new Date(), operation: 'select', tableName: 'users', engine: 'default', success: false, error: 'fail' });
      const results = await store.query({ failedOnly: true });
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
    });

    it('should clear all entries', () => {
      store.write({ id: '1', timestamp: new Date(), operation: 'select', tableName: 'users', engine: 'default', success: true });
      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe('AuditLogger', () => {
    let logger: AuditLogger;
    let store: MemoryAuditStore;

    beforeEach(() => {
      store = new MemoryAuditStore();
      logger = createAuditLogger({ store, enabled: true, logSQL: true });
    });

    it('should log operations', async () => {
      await logger.log({ operation: 'insert', tableName: 'users', engine: 'default', success: true, affectedRows: 1 });
      const entries = await logger.query();
      expect(entries.length).toBe(1);
      expect(entries[0].operation).toBe('insert');
      expect(entries[0].id).toBeDefined();
      expect(entries[0].timestamp).toBeInstanceOf(Date);
    });

    it('should not log when disabled', async () => {
      logger.setEnabled(false);
      await logger.log({ operation: 'insert', tableName: 'users', engine: 'default', success: true });
      expect(store.size).toBe(0);
    });

    it('should filter by configured operations', async () => {
      const filteredLogger = createAuditLogger({
        store, operations: ['delete'],
      });
      await filteredLogger.log({ operation: 'select', tableName: 'users', engine: 'default', success: true });
      await filteredLogger.log({ operation: 'delete', tableName: 'users', engine: 'default', success: true });
      expect(store.size).toBe(1);
    });

    it('should filter by configured tables', async () => {
      const filteredLogger = createAuditLogger({
        store, tables: ['users'],
      });
      await filteredLogger.log({ operation: 'select', tableName: 'users', engine: 'default', success: true });
      await filteredLogger.log({ operation: 'select', tableName: 'orders', engine: 'default', success: true });
      expect(store.size).toBe(1);
    });

    it('should truncate long SQL', async () => {
      const longSQL = 'SELECT '.repeat(500);
      await logger.log({ operation: 'select', tableName: 'users', engine: 'default', success: true, sql: longSQL });
      const entries = await logger.query();
      expect(entries[0].sql!.length).toBeLessThan(longSQL.length);
      expect(entries[0].sql!).toContain('[TRUNCATED]');
    });

    it('should strip SQL when logSQL is false', async () => {
      const noSqlLogger = createAuditLogger({ store: new MemoryAuditStore(), logSQL: false });
      await noSqlLogger.log({ operation: 'select', tableName: 'users', engine: 'default', success: true, sql: 'SELECT 1' });
      const entries = await noSqlLogger.query();
      expect(entries[0].sql).toBeUndefined();
    });
  });
});

// ==================== RowLimiter ====================
describe('RowLimiter', () => {
  let limiter: RowLimiter;

  beforeEach(() => {
    limiter = createRowLimiter({
      defaultLimits: { select: 1000, delete: 100, update: 500, insert: 2000 },
    });
  });

  describe('check', () => {
    it('should allow within limits', () => {
      const result = limiter.check('users', 'select', 500);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000);
      expect(result.requested).toBe(500);
    });

    it('should deny exceeding limits', () => {
      const result = limiter.check('users', 'delete', 200);
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(100);
      expect(result.reason).toContain('exceeding limit');
    });

    it('should allow when limit is exactly met', () => {
      const result = limiter.check('users', 'delete', 100);
      expect(result.allowed).toBe(true);
    });
  });

  describe('assert', () => {
    it('should throw when exceeding limit', () => {
      expect(() => limiter.assert('users', 'delete', 200)).toThrow('exceeding limit');
    });

    it('should not throw within limit', () => {
      expect(() => limiter.assert('users', 'select', 500)).not.toThrow();
    });
  });

  describe('table-level limits', () => {
    it('should override global limits per table', () => {
      limiter.setTableLimit('sensitive_data', 'delete', 10);
      expect(limiter.check('sensitive_data', 'delete', 50).allowed).toBe(false);
      expect(limiter.check('sensitive_data', 'delete', 5).allowed).toBe(true);
      // Other tables still use global limits
      expect(limiter.check('users', 'delete', 50).allowed).toBe(true);
    });
  });

  describe('getSafeSelectLimit', () => {
    it('should cap at configured limit', () => {
      expect(limiter.getSafeSelectLimit('users', 5000)).toBe(1000);
    });

    it('should allow requested limit when under cap', () => {
      expect(limiter.getSafeSelectLimit('users', 500)).toBe(500);
    });

    it('should use limit when no request specified', () => {
      expect(limiter.getSafeSelectLimit('users')).toBe(1000);
    });
  });

  describe('setEnabled', () => {
    it('should allow all when disabled', () => {
      limiter.setEnabled(false);
      expect(limiter.check('users', 'delete', 99999).allowed).toBe(true);
    });
  });

  describe('onViolation callback', () => {
    it('should call onViolation on exceeded limit', () => {
      const violations: string[] = [];
      const l = createRowLimiter({
        defaultLimits: { delete: 10 },
        onViolation: (t, op, req, lim) => violations.push(`${t}:${op}:${req}>${lim}`),
      });
      l.check('users', 'delete', 50);
      expect(violations).toEqual(['users:delete:50>10']);
    });
  });

  describe('operations without limits', () => {
    it('should allow aggregate with no limit set', () => {
      const result = limiter.check('users', 'aggregate', 999999);
      expect(result.allowed).toBe(true);
    });
  });
});

// ==================== FieldAccessControl ====================
describe('FieldAccessControl', () => {
  let acl: FieldAccessControl;

  beforeEach(() => {
    acl = createFieldAccessControl({
      tables: [{
        tableName: 'users',
        defaultPermission: 'readwrite',
        rules: [
          { field: 'password', permission: 'none' },
          { field: 'email', permission: 'read' },
          { field: 'id', permission: 'read' },
        ],
      }],
    });
  });

  describe('canRead', () => {
    it('should allow reading readwrite fields', () => {
      expect(acl.canRead('users', 'name')).toBe(true);
    });

    it('should allow reading read-only fields', () => {
      expect(acl.canRead('users', 'email')).toBe(true);
    });

    it('should deny reading none fields', () => {
      expect(acl.canRead('users', 'password')).toBe(false);
    });

    it('should use global default for unknown tables', () => {
      expect(acl.canRead('orders', 'anything')).toBe(true);
    });
  });

  describe('canWrite', () => {
    it('should allow writing readwrite fields', () => {
      expect(acl.canWrite('users', 'name')).toBe(true);
    });

    it('should deny writing read-only fields', () => {
      expect(acl.canWrite('users', 'email')).toBe(false);
    });

    it('should deny writing none fields', () => {
      expect(acl.canWrite('users', 'password')).toBe(false);
    });
  });

  describe('filterReadableFields', () => {
    it('should filter out non-readable fields', () => {
      const result = acl.filterReadableFields('users', ['id', 'name', 'email', 'password']);
      expect(result).toEqual(['id', 'name', 'email']);
    });
  });

  describe('filterWritableFields', () => {
    it('should filter out non-writable fields', () => {
      const result = acl.filterWritableFields('users', { name: 'Bob', email: 'new@test.com', password: '123' });
      expect(result).toEqual({ name: 'Bob' });
    });
  });

  describe('assertRead / assertWrite', () => {
    it('should throw on denied read', () => {
      expect(() => acl.assertRead('users', 'password')).toThrow('not readable');
    });

    it('should throw on denied write', () => {
      expect(() => acl.assertWrite('users', 'email')).toThrow('not writable');
    });
  });

  describe('wildcard rules', () => {
    it('should match wildcard * rule', () => {
      const wacl = createFieldAccessControl({
        tables: [{
          tableName: 'secret',
          defaultPermission: 'none',
          rules: [{ field: '*', permission: 'read' }],
        }],
      });
      expect(wacl.canRead('secret', 'anything')).toBe(true);
      expect(wacl.canWrite('secret', 'anything')).toBe(false);
    });

    it('should match prefix wildcard', () => {
      const wacl = createFieldAccessControl({
        tables: [{
          tableName: 'users',
          defaultPermission: 'readwrite',
          rules: [{ field: 'secret_*', permission: 'none' }],
        }],
      });
      expect(wacl.canRead('users', 'secret_key')).toBe(false);
      expect(wacl.canRead('users', 'name')).toBe(true);
    });
  });

  describe('hideSensitiveFields', () => {
    it('should hide fields', () => {
      const a = createFieldAccessControl();
      a.hideSensitiveFields('users', ['password', 'ssn']);
      expect(a.canRead('users', 'password')).toBe(false);
      expect(a.canWrite('users', 'ssn')).toBe(false);
    });
  });

  describe('setFieldsReadOnly', () => {
    it('should make fields readonly', () => {
      const a = createFieldAccessControl();
      a.setFieldsReadOnly('users', ['id', 'created_at']);
      expect(a.canRead('users', 'id')).toBe(true);
      expect(a.canWrite('users', 'id')).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should allow all when disabled', () => {
      acl.setEnabled(false);
      expect(acl.canRead('users', 'password')).toBe(true);
      expect(acl.canWrite('users', 'email')).toBe(true);
    });
  });

  describe('onViolation callback', () => {
    it('should call onViolation on denied access', () => {
      const violations: string[] = [];
      const a = createFieldAccessControl({
        tables: [{ tableName: 'users', defaultPermission: 'none', rules: [] }],
        onViolation: (t, f, action) => violations.push(`${t}.${f}:${action}`),
      });
      a.filterReadableFields('users', ['password']);
      expect(violations).toEqual(['users.password:read']);
    });
  });
});
