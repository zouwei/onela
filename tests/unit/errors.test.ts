/**
 * OnelaError 统一错误系统全面单元测试
 */

import {
  OnelaError, ErrorCode,
  connectionError, queryError, configError,
  securityError, transactionError, schemaError,
  wrapError, isOnelaError,
} from '../../src/errors/OnelaError.js';

describe('OnelaError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const err = new OnelaError(ErrorCode.QUERY_FAILED, 'Query failed');
      expect(err.name).toBe('OnelaError');
      expect(err.code).toBe(ErrorCode.QUERY_FAILED);
      expect(err.message).toBe('Query failed');
      expect(err.category).toBe('query');
      expect(err instanceof Error).toBe(true);
    });

    it('should include optional properties', () => {
      const cause = new Error('original');
      const err = new OnelaError(ErrorCode.CONNECTION_FAILED, 'conn fail', {
        cause,
        dbType: 'mysql',
        tableName: 'users',
        context: { host: 'localhost' },
      });
      expect(err.cause).toBe(cause);
      expect(err.dbType).toBe('mysql');
      expect(err.tableName).toBe('users');
      expect(err.context).toEqual({ host: 'localhost' });
    });
  });

  describe('category mapping', () => {
    it('should map connection errors (1xxx)', () => {
      expect(new OnelaError(ErrorCode.CONNECTION_FAILED, '').category).toBe('connection');
      expect(new OnelaError(ErrorCode.CONNECTION_TIMEOUT, '').category).toBe('connection');
      expect(new OnelaError(ErrorCode.CONNECTION_POOL_EXHAUSTED, '').category).toBe('connection');
      expect(new OnelaError(ErrorCode.NO_AVAILABLE_NODE, '').category).toBe('connection');
    });

    it('should map query errors (2xxx)', () => {
      expect(new OnelaError(ErrorCode.QUERY_FAILED, '').category).toBe('query');
      expect(new OnelaError(ErrorCode.INVALID_SQL, '').category).toBe('query');
      expect(new OnelaError(ErrorCode.INVALID_PARAMS, '').category).toBe('query');
    });

    it('should map config errors (3xxx)', () => {
      expect(new OnelaError(ErrorCode.INVALID_CONFIG, '').category).toBe('config');
      expect(new OnelaError(ErrorCode.MISSING_ENGINE, '').category).toBe('config');
      expect(new OnelaError(ErrorCode.UNSUPPORTED_DB_TYPE, '').category).toBe('config');
    });

    it('should map security errors (4xxx)', () => {
      expect(new OnelaError(ErrorCode.SQL_INJECTION_DETECTED, '').category).toBe('security');
      expect(new OnelaError(ErrorCode.OPERATION_NOT_ALLOWED, '').category).toBe('security');
      expect(new OnelaError(ErrorCode.FIELD_ACCESS_DENIED, '').category).toBe('security');
      expect(new OnelaError(ErrorCode.ROW_LIMIT_EXCEEDED, '').category).toBe('security');
    });

    it('should map transaction errors (5xxx)', () => {
      expect(new OnelaError(ErrorCode.TRANSACTION_FAILED, '').category).toBe('transaction');
      expect(new OnelaError(ErrorCode.TRANSACTION_TIMEOUT, '').category).toBe('transaction');
    });

    it('should map schema errors (6xxx)', () => {
      expect(new OnelaError(ErrorCode.DDL_FAILED, '').category).toBe('schema');
      expect(new OnelaError(ErrorCode.MIGRATION_FAILED, '').category).toBe('schema');
      expect(new OnelaError(ErrorCode.TABLE_NOT_FOUND, '').category).toBe('schema');
    });

    it('should map unknown errors (9xxx)', () => {
      expect(new OnelaError(ErrorCode.UNKNOWN, '').category).toBe('unknown');
      expect(new OnelaError(ErrorCode.INTERNAL, '').category).toBe('unknown');
    });
  });

  describe('isCategory', () => {
    it('should return true for matching category', () => {
      const err = new OnelaError(ErrorCode.QUERY_FAILED, '');
      expect(err.isCategory('query')).toBe(true);
      expect(err.isCategory('connection')).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      expect(new OnelaError(ErrorCode.CONNECTION_TIMEOUT, '').isRetryable()).toBe(true);
      expect(new OnelaError(ErrorCode.QUERY_TIMEOUT, '').isRetryable()).toBe(true);
      expect(new OnelaError(ErrorCode.CONNECTION_POOL_EXHAUSTED, '').isRetryable()).toBe(true);
      expect(new OnelaError(ErrorCode.TRANSACTION_TIMEOUT, '').isRetryable()).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(new OnelaError(ErrorCode.INVALID_SQL, '').isRetryable()).toBe(false);
      expect(new OnelaError(ErrorCode.SQL_INJECTION_DETECTED, '').isRetryable()).toBe(false);
      expect(new OnelaError(ErrorCode.INVALID_CONFIG, '').isRetryable()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const err = new OnelaError(ErrorCode.QUERY_FAILED, 'fail', {
        dbType: 'mysql', tableName: 'users',
      });
      const json = err.toJSON();
      expect(json.name).toBe('OnelaError');
      expect(json.code).toBe(ErrorCode.QUERY_FAILED);
      expect(json.category).toBe('query');
      expect(json.message).toBe('fail');
      expect(json.dbType).toBe('mysql');
      expect(json.tableName).toBe('users');
      // stack 已从 toJSON() 移除，防止信息泄漏
      expect(json.stack).toBeUndefined();
    });

    it('should include cause message', () => {
      const cause = new Error('root cause');
      const err = new OnelaError(ErrorCode.UNKNOWN, 'wrap', { cause });
      const json = err.toJSON();
      expect(json.cause).toBe('root cause');
    });
  });
});

describe('factory functions', () => {
  it('connectionError should create connection error', () => {
    const err = connectionError('timeout', undefined, 'mysql');
    expect(err.code).toBe(ErrorCode.CONNECTION_FAILED);
    expect(err.category).toBe('connection');
    expect(err.dbType).toBe('mysql');
  });

  it('queryError should create query error', () => {
    const err = queryError('bad SQL', undefined, 'users');
    expect(err.code).toBe(ErrorCode.QUERY_FAILED);
    expect(err.tableName).toBe('users');
  });

  it('configError should create config error', () => {
    const err = configError('missing', { key: 'engine' });
    expect(err.code).toBe(ErrorCode.INVALID_CONFIG);
    expect(err.context).toEqual({ key: 'engine' });
  });

  it('securityError should create security error', () => {
    const err = securityError(ErrorCode.SQL_INJECTION_DETECTED, 'injection', 'users');
    expect(err.code).toBe(ErrorCode.SQL_INJECTION_DETECTED);
    expect(err.category).toBe('security');
  });

  it('transactionError should create transaction error', () => {
    const err = transactionError('tx failed');
    expect(err.code).toBe(ErrorCode.TRANSACTION_FAILED);
    expect(err.category).toBe('transaction');
  });

  it('schemaError should create schema error', () => {
    const err = schemaError(ErrorCode.TABLE_NOT_FOUND, 'not found', 'users');
    expect(err.code).toBe(ErrorCode.TABLE_NOT_FOUND);
    expect(err.category).toBe('schema');
  });
});

describe('wrapError', () => {
  it('should return OnelaError as-is', () => {
    const original = new OnelaError(ErrorCode.QUERY_FAILED, 'fail');
    expect(wrapError(original)).toBe(original);
  });

  it('should wrap Error into OnelaError', () => {
    const err = new Error('something');
    const wrapped = wrapError(err);
    expect(wrapped).toBeInstanceOf(OnelaError);
    expect(wrapped.message).toBe('something');
    expect(wrapped.cause).toBe(err);
    expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
  });

  it('should wrap string into OnelaError', () => {
    const wrapped = wrapError('string error');
    expect(wrapped).toBeInstanceOf(OnelaError);
    expect(wrapped.message).toBe('string error');
  });

  it('should use custom error code', () => {
    const wrapped = wrapError(new Error('x'), ErrorCode.QUERY_TIMEOUT);
    expect(wrapped.code).toBe(ErrorCode.QUERY_TIMEOUT);
  });
});

describe('isOnelaError', () => {
  it('should return true for OnelaError', () => {
    expect(isOnelaError(new OnelaError(ErrorCode.UNKNOWN, ''))).toBe(true);
  });

  it('should return false for regular Error', () => {
    expect(isOnelaError(new Error('x'))).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isOnelaError('string')).toBe(false);
    expect(isOnelaError(null)).toBe(false);
    expect(isOnelaError(undefined)).toBe(false);
    expect(isOnelaError(42)).toBe(false);
  });
});
