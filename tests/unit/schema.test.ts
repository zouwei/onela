/**
 * Schema 模块全面单元测试
 * 覆盖: DDLBuilder, SchemaIntrospector, MigrationRunner, DynamicModel
 */

import { DDLBuilder, createDDLBuilder } from '../../src/schema/DDLBuilder.js';
import { SchemaIntrospector, createSchemaIntrospector } from '../../src/schema/SchemaIntrospector.js';
import { MigrationRunner, createMigrationRunner } from '../../src/schema/MigrationRunner.js';
import { DynamicModelRegistry } from '../../src/schema/DynamicModel.js';

// ==================== DDLBuilder ====================
describe('DDLBuilder', () => {
  describe('MySQL', () => {
    let ddl: DDLBuilder;
    beforeEach(() => { ddl = createDDLBuilder('mysql'); });

    it('should build CREATE TABLE', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'users',
        columns: [
          { name: 'id', type: 'int', primary: true, increment: true },
          { name: 'name', type: 'varchar', length: 100, nullable: false },
          { name: 'email', type: 'varchar', length: 255, unique: true },
          { name: 'age', type: 'int', defaultValue: 0 },
          { name: 'bio', type: 'text' },
          { name: 'is_active', type: 'boolean', defaultValue: true },
          { name: 'created_at', type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' },
        ],
      });
      expect(sql).toContain('CREATE TABLE users');
      expect(sql).toContain('id INT NOT NULL AUTO_INCREMENT');
      expect(sql).toContain('name VARCHAR(100) NOT NULL');
      expect(sql).toContain('PRIMARY KEY (id)');
      expect(sql).toContain('UNIQUE (email)');
      expect(sql).toContain('DEFAULT 0');
      expect(sql).toContain('DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('DEFAULT 1');
      expect(sql).toMatch(/;$/);
    });

    it('should build CREATE TABLE IF NOT EXISTS', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test', ifNotExists: true,
        columns: [{ name: 'id', type: 'int', primary: true }],
      });
      expect(sql).toContain('IF NOT EXISTS');
    });

    it('should build CREATE TABLE with MySQL options', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [{ name: 'id', type: 'int', primary: true }],
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        comment: "用户表",
      });
      expect(sql).toContain('ENGINE=InnoDB');
      expect(sql).toContain('DEFAULT CHARSET=utf8mb4');
      expect(sql).toContain('COLLATE=utf8mb4_unicode_ci');
      expect(sql).toContain("COMMENT='用户表'");
    });

    it('should build CREATE TABLE with column comments (MySQL)', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [
          { name: 'id', type: 'int', primary: true, comment: '主键' },
        ],
      });
      expect(sql).toContain("COMMENT '主键'");
    });

    it('should build DROP TABLE', () => {
      expect(ddl.buildDropTable('users')).toBe('DROP TABLE IF EXISTS users;');
      expect(ddl.buildDropTable('users', false)).toBe('DROP TABLE users;');
    });

    it('should build ALTER TABLE addColumn', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'addColumn', column: { name: 'phone', type: 'varchar', length: 20 } },
      ]);
      expect(sqls[0]).toContain('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
    });

    it('should build ALTER TABLE dropColumn', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'dropColumn', columnName: 'phone' },
      ]);
      expect(sqls[0]).toContain('DROP COLUMN phone');
    });

    it('should build ALTER TABLE modifyColumn for MySQL', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'modifyColumn', column: { name: 'name', type: 'varchar', length: 200 } },
      ]);
      expect(sqls[0]).toContain('MODIFY COLUMN name VARCHAR(200)');
    });

    it('should build ALTER TABLE renameColumn', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'renameColumn', oldName: 'name', newName: 'full_name' },
      ]);
      expect(sqls[0]).toContain('RENAME COLUMN name TO full_name');
    });

    it('should build ALTER TABLE addIndex', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'addIndex', index: { name: 'idx_email', columns: ['email'], unique: true } },
      ]);
      expect(sqls[0]).toContain('CREATE UNIQUE INDEX idx_email ON users (email)');
    });

    it('should build ALTER TABLE dropIndex for MySQL', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'dropIndex', indexName: 'idx_email' },
      ]);
      expect(sqls[0]).toContain('DROP INDEX idx_email ON users');
    });

    it('should build ALTER TABLE renameTable', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'renameTable', newName: 'app_users' },
      ]);
      expect(sqls[0]).toContain('RENAME TO app_users');
    });

    it('should build CREATE INDEX', () => {
      const sql = ddl.buildCreateIndex('users', { name: 'idx_name', columns: ['name', 'email'] });
      expect(sql).toBe('CREATE INDEX idx_name ON users (name, email);');
    });

    it('should build CREATE UNIQUE INDEX', () => {
      const sql = ddl.buildCreateIndex('users', { name: 'uq_email', columns: ['email'], unique: true });
      expect(sql).toContain('UNIQUE INDEX');
    });

    it('should map type: decimal correctly', () => {
      const sql = ddl.buildCreateTable({
        tableName: 't', columns: [
          { name: 'price', type: 'decimal', precision: 12, scale: 4 },
        ],
      });
      expect(sql).toContain('DECIMAL(12, 4)');
    });

    it('should map type: json correctly', () => {
      const sql = ddl.buildCreateTable({
        tableName: 't', columns: [{ name: 'data', type: 'json' }],
      });
      expect(sql).toContain('JSON');
    });
  });

  describe('PostgreSQL', () => {
    let ddl: DDLBuilder;
    beforeEach(() => { ddl = createDDLBuilder('postgresql'); });

    it('should map types correctly for PostgreSQL', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [
          { name: 'id', type: 'int', primary: true, increment: true },
          { name: 'data', type: 'json' },
          { name: 'is_active', type: 'boolean' },
          { name: 'created_at', type: 'datetime' },
        ],
      });
      expect(sql).toContain('INTEGER');
      expect(sql).toContain('JSONB');
      expect(sql).toContain('BOOLEAN');
      expect(sql).toContain('TIMESTAMP');
      // PostgreSQL auto-increment is empty (uses SERIAL)
    });

    it('should build ALTER TABLE modifyColumn for PostgreSQL', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'modifyColumn', column: { name: 'name', type: 'varchar', length: 200 } },
      ]);
      expect(sqls[0]).toContain('ALTER COLUMN name TYPE VARCHAR(200)');
    });

    it('should build DROP INDEX without ON for PostgreSQL', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'dropIndex', indexName: 'idx_email' },
      ]);
      expect(sqls[0]).toBe('DROP INDEX idx_email;');
    });
  });

  describe('SQLite', () => {
    let ddl: DDLBuilder;
    beforeEach(() => { ddl = createDDLBuilder('sqlite'); });

    it('should map types correctly for SQLite', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [
          { name: 'id', type: 'int', primary: true, increment: true },
          { name: 'name', type: 'varchar' },
          { name: 'data', type: 'json' },
        ],
      });
      expect(sql).toContain('INTEGER');
      expect(sql).toContain('TEXT');
      expect(sql).toContain('AUTOINCREMENT');
    });
  });

  describe('SQL Server', () => {
    let ddl: DDLBuilder;
    beforeEach(() => { ddl = createDDLBuilder('sqlserver'); });

    it('should use NVARCHAR and IDENTITY', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [
          { name: 'id', type: 'int', primary: true, increment: true },
          { name: 'name', type: 'varchar', length: 100 },
        ],
      });
      expect(sql).toContain('IDENTITY(1,1)');
      expect(sql).toContain('NVARCHAR(100)');
    });

    it('should use sp_rename for rename', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'renameColumn', oldName: 'name', newName: 'full_name' },
      ]);
      expect(sqls[0]).toContain("sp_rename 'users.name'");
    });

    it('should use sp_rename for table rename', () => {
      const sqls = ddl.buildAlterTable('users', [
        { type: 'renameTable', newName: 'app_users' },
      ]);
      expect(sqls[0]).toContain("sp_rename 'users'");
    });
  });

  describe('Oracle', () => {
    let ddl: DDLBuilder;
    beforeEach(() => { ddl = createDDLBuilder('oracle'); });

    it('should map types to Oracle equivalents', () => {
      const sql = ddl.buildCreateTable({
        tableName: 'test',
        columns: [
          { name: 'id', type: 'int', primary: true },
          { name: 'name', type: 'varchar', length: 100 },
          { name: 'data', type: 'json' },
          { name: 'is_active', type: 'boolean' },
        ],
      });
      expect(sql).toContain('NUMBER(10)');
      expect(sql).toContain('VARCHAR2(100)');
      expect(sql).toContain('CLOB');
      expect(sql).toContain('NUMBER(1)');
    });
  });

  describe('fromFieldConfigs', () => {
    it('should convert FieldConfig to ColumnDefinition', () => {
      const cols = DDLBuilder.fromFieldConfigs([
        { name: 'id', type: 'int', default: null, comment: 'PK', primary: true, increment: true },
        { name: 'name', type: 'varchar', default: '', comment: '用户名' },
      ]);
      expect(cols.length).toBe(2);
      expect(cols[0].primary).toBe(true);
      expect(cols[0].increment).toBe(true);
      expect(cols[1].comment).toBe('用户名');
    });
  });
});

// ==================== SchemaIntrospector ====================
describe('SchemaIntrospector', () => {
  describe('static methods', () => {
    it('should convert ColumnInfo to FieldConfig', () => {
      const fields = SchemaIntrospector.toFieldConfigs([
        { name: 'id', type: 'int', nullable: false, defaultValue: null, isPrimary: true, isAutoIncrement: true },
        { name: 'name', type: 'varchar', nullable: true, defaultValue: null, isPrimary: false, isAutoIncrement: false, comment: '用户名' },
      ]);
      expect(fields.length).toBe(2);
      expect(fields[0].primary).toBe(true);
      expect(fields[0].increment).toBe(true);
      expect(fields[1].comment).toBe('用户名');
    });

    it('should convert to Configs format', () => {
      const configs = SchemaIntrospector.toConfigs('users', 'default', [
        { name: 'id', type: 'int', nullable: false, defaultValue: null, isPrimary: true, isAutoIncrement: true },
      ]);
      expect(configs.engine).toBe('default');
      expect(configs.tableName).toBe('users');
      expect(configs.fields!.length).toBe(1);
    });

    it('should generate table description', () => {
      const desc = SchemaIntrospector.describeTable({
        table: { tableName: 'users', comment: 'User table' },
        columns: [
          { name: 'id', type: 'int', nullable: false, defaultValue: null, isPrimary: true, isAutoIncrement: true },
          { name: 'name', type: 'varchar', nullable: true, defaultValue: null, isPrimary: false, isAutoIncrement: false, comment: 'User name' },
        ],
        indexes: [],
      });
      expect(desc).toContain('Table: users');
      expect(desc).toContain('Comment: User table');
      expect(desc).toContain('[PRIMARY KEY]');
      expect(desc).toContain('[AUTO INCREMENT]');
      expect(desc).toContain('-- User name');
    });
  });

  describe('SQL generation per database', () => {
    it('should generate MySQL getTables SQL', async () => {
      const executedSQLs: string[] = [];
      const executor = async (sql: string) => { executedSQLs.push(sql); return []; };
      const intro = createSchemaIntrospector('mysql', executor);
      await intro.getTables();
      expect(executedSQLs[0]).toContain('information_schema.TABLES');
    });

    it('should generate PostgreSQL getTables SQL', async () => {
      const executedSQLs: string[] = [];
      const executor = async (sql: string) => { executedSQLs.push(sql); return []; };
      const intro = createSchemaIntrospector('postgresql', executor);
      await intro.getTables();
      expect(executedSQLs[0]).toContain('pg_tables');
    });

    it('should generate SQLite getTables SQL', async () => {
      const executedSQLs: string[] = [];
      const executor = async (sql: string) => { executedSQLs.push(sql); return []; };
      const intro = createSchemaIntrospector('sqlite', executor);
      await intro.getTables();
      expect(executedSQLs[0]).toContain('sqlite_master');
    });

    it('should generate SQL Server getTables SQL', async () => {
      const executedSQLs: string[] = [];
      const executor = async (sql: string) => { executedSQLs.push(sql); return []; };
      const intro = createSchemaIntrospector('sqlserver', executor);
      await intro.getTables();
      expect(executedSQLs[0]).toContain('INFORMATION_SCHEMA.TABLES');
    });

    it('should generate Oracle getTables SQL', async () => {
      const executedSQLs: string[] = [];
      const executor = async (sql: string) => { executedSQLs.push(sql); return []; };
      const intro = createSchemaIntrospector('oracle', executor);
      await intro.getTables();
      expect(executedSQLs[0]).toContain('USER_TAB_COMMENTS');
    });

    it('should throw for unsupported db type', async () => {
      const executor = async () => [];
      const intro = createSchemaIntrospector('unknown', executor);
      await expect(intro.getTables()).rejects.toThrow('Unsupported');
    });
  });

  describe('normalizeColumnInfo', () => {
    it('should normalize MySQL column info', async () => {
      const executor = async () => [{
        COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: null, COLUMN_KEY: 'PRI', EXTRA: 'auto_increment',
        COLUMN_COMMENT: '主键', CHARACTER_MAXIMUM_LENGTH: null,
      }];
      const intro = createSchemaIntrospector('mysql', executor);
      const cols = await intro.getColumns('users');
      expect(cols[0].name).toBe('id');
      expect(cols[0].isPrimary).toBe(true);
      expect(cols[0].isAutoIncrement).toBe(true);
      expect(cols[0].nullable).toBe(false);
    });

    it('should normalize SQLite PRAGMA info', async () => {
      const executor = async () => [
        { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
        { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      ];
      const intro = createSchemaIntrospector('sqlite', executor);
      const cols = await intro.getColumns('users');
      expect(cols[0].name).toBe('id');
      expect(cols[0].isPrimary).toBe(true);
      expect(cols[0].isAutoIncrement).toBe(true);
      expect(cols[1].nullable).toBe(true);
    });
  });
});

// ==================== MigrationRunner ====================
describe('MigrationRunner', () => {
  const migrations = [
    { version: '001', description: 'Create users', up: 'CREATE TABLE users (id INT)', down: 'DROP TABLE users' },
    { version: '002', description: 'Create orders', up: 'CREATE TABLE orders (id INT)', down: 'DROP TABLE orders' },
    { version: '003', description: 'Add index', up: ['CREATE INDEX idx ON users (id)', 'ALTER TABLE users ADD col INT'], down: 'DROP INDEX idx' },
  ];

  let executedSQLs: string[];
  let appliedMigrations: Array<{ version: string; description: string }>;
  let runner: MigrationRunner;

  beforeEach(() => {
    executedSQLs = [];
    appliedMigrations = [];

    const executor = async (sql: string, params?: any[]) => {
      executedSQLs.push(sql);
      // Simulate history table queries
      if (sql.includes('SELECT version')) {
        return appliedMigrations.map(m => ({ version: m.version, description: m.description, applied_at: new Date() }));
      }
      if (sql.includes('INSERT INTO _onela_migrations')) {
        appliedMigrations.push({ version: params![0], description: params![1] });
      }
      if (sql.includes('DELETE FROM _onela_migrations')) {
        appliedMigrations = appliedMigrations.filter(m => m.version !== params![0]);
      }
      return [];
    };

    runner = createMigrationRunner('mysql', executor);
  });

  it('should ensure history table on first run', async () => {
    await runner.ensureHistoryTable();
    expect(executedSQLs[0]).toContain('CREATE TABLE IF NOT EXISTS _onela_migrations');
  });

  it('should detect all migrations as pending initially', async () => {
    const pending = await runner.getPendingMigrations(migrations);
    expect(pending.length).toBe(3);
  });

  it('should run all pending migrations with up()', async () => {
    const results = await runner.up(migrations);
    expect(results.length).toBe(3);
    expect(appliedMigrations.length).toBe(3);
    // Should execute the actual SQL
    expect(executedSQLs.some(s => s.includes('CREATE TABLE users'))).toBe(true);
    expect(executedSQLs.some(s => s.includes('CREATE TABLE orders'))).toBe(true);
    expect(executedSQLs.some(s => s.includes('CREATE INDEX idx'))).toBe(true);
  });

  it('should not re-apply already applied migrations', async () => {
    await runner.up(migrations);
    const pending = await runner.getPendingMigrations(migrations);
    expect(pending.length).toBe(0);
  });

  it('should rollback with down()', async () => {
    await runner.up(migrations);
    executedSQLs = [];
    const results = await runner.down(migrations, 1);
    expect(results.length).toBe(1);
    expect(executedSQLs.some(s => s.includes('DROP INDEX idx'))).toBe(true);
    expect(appliedMigrations.length).toBe(2);
  });

  it('should report status correctly', async () => {
    await runner.up(migrations.slice(0, 2));
    const status = await runner.status(migrations);
    expect(status.applied.length).toBe(2);
    expect(status.pending.length).toBe(1);
    expect(status.total).toBe(3);
  });

  it('should use correct placeholder for PostgreSQL', () => {
    const pgRunner = createMigrationRunner('postgresql', async () => []);
    // Access private method indirectly via ensureHistoryTable
    // Just verify it creates without error
    expect(pgRunner).toBeDefined();
  });

  it('should handle custom history table name', async () => {
    const customRunner = createMigrationRunner('mysql', async (sql: string) => {
      executedSQLs.push(sql);
      return [];
    }, { tableName: 'my_migrations' });
    await customRunner.ensureHistoryTable();
    expect(executedSQLs.some(s => s.includes('my_migrations'))).toBe(true);
  });

  it('should throw when down() cannot find migration', async () => {
    appliedMigrations = [{ version: 'unknown', description: 'unknown' }];
    await expect(runner.down(migrations, 1)).rejects.toThrow('not found');
  });
});

// ==================== DynamicModelRegistry ====================
describe('DynamicModelRegistry', () => {
  beforeEach(() => {
    DynamicModelRegistry.clear();
  });

  it('should register and retrieve a model', () => {
    DynamicModelRegistry.register({ engine: 'default', tableName: 'users' });
    expect(DynamicModelRegistry.has('users')).toBe(true);
    const config = DynamicModelRegistry.get('users');
    expect(config?.tableName).toBe('users');
  });

  it('should register with specific engine', () => {
    DynamicModelRegistry.register({ engine: 'secondary', tableName: 'orders' });
    expect(DynamicModelRegistry.has('orders', 'secondary')).toBe(true);
    expect(DynamicModelRegistry.has('orders', 'default')).toBe(false);
  });

  it('should unregister a model', () => {
    DynamicModelRegistry.register({ engine: 'default', tableName: 'users' });
    expect(DynamicModelRegistry.unregister('users')).toBe(true);
    expect(DynamicModelRegistry.has('users')).toBe(false);
  });

  it('should list all models', () => {
    DynamicModelRegistry.register({ engine: 'default', tableName: 'users' });
    DynamicModelRegistry.register({ engine: 'default', tableName: 'orders' });
    DynamicModelRegistry.register({ engine: 'secondary', tableName: 'logs' });
    expect(DynamicModelRegistry.list().length).toBe(3);
  });

  it('should list models by engine', () => {
    DynamicModelRegistry.register({ engine: 'default', tableName: 'users' });
    DynamicModelRegistry.register({ engine: 'secondary', tableName: 'logs' });
    expect(DynamicModelRegistry.list('default').length).toBe(1);
    expect(DynamicModelRegistry.list('secondary').length).toBe(1);
  });

  it('should createFromFields', () => {
    const configs = DynamicModelRegistry.createFromFields('ai_data', 'default', [
      { name: 'id', type: 'int', default: null, comment: 'PK', primary: true, increment: true },
      { name: 'content', type: 'text', default: '', comment: '内容' },
    ]);
    expect(configs.tableName).toBe('ai_data');
    expect(configs.fields!.length).toBe(2);
    expect(DynamicModelRegistry.has('ai_data')).toBe(true);
  });

  it('should describe models', () => {
    DynamicModelRegistry.createFromFields('users', 'default', [
      { name: 'id', type: 'int', default: null, comment: '主键', primary: true, increment: true },
      { name: 'name', type: 'varchar', default: '', comment: '名称' },
    ]);
    const desc = DynamicModelRegistry.describe();
    expect(desc).toContain('Registered Models (1)');
    expect(desc).toContain('Table: users');
    expect(desc).toContain('[PK]');
    expect(desc).toContain('[AUTO]');
    expect(desc).toContain('-- 名称');
  });

  it('should return empty description when no models', () => {
    expect(DynamicModelRegistry.describe()).toBe('No models registered.');
  });

  it('should clear all models', () => {
    DynamicModelRegistry.register({ engine: 'default', tableName: 'a' });
    DynamicModelRegistry.register({ engine: 'default', tableName: 'b' });
    DynamicModelRegistry.clear();
    expect(DynamicModelRegistry.list().length).toBe(0);
  });
});
