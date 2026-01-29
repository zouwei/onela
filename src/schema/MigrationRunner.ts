/**
 * MigrationRunner - Schema 迁移运行器
 * 管理数据库 Schema 版本，支持 up/down 迁移
 * 自动记录迁移历史，防止重复执行
 */

/**
 * 迁移定义
 */
export interface Migration {
  /** 迁移版本号（如 '20240101_001'） */
  version: string;
  /** 迁移描述 */
  description: string;
  /** 升级 SQL（可以是字符串或字符串数组） */
  up: string | string[];
  /** 降级 SQL（可以是字符串或字符串数组） */
  down: string | string[];
}

/**
 * 迁移记录
 */
export interface MigrationRecord {
  version: string;
  description: string;
  appliedAt: Date;
}

/**
 * 迁移运行器配置
 */
export interface MigrationRunnerConfig {
  /** 迁移历史表名 */
  tableName?: string;
}

/**
 * 迁移运行器
 */
export class MigrationRunner {
  private executor: (sql: string, params?: any[]) => Promise<any>;
  private dbType: string;
  private historyTable: string;

  constructor(
    dbType: string,
    executor: (sql: string, params?: any[]) => Promise<any>,
    config: MigrationRunnerConfig = {}
  ) {
    this.dbType = dbType.toLowerCase();
    this.executor = executor;
    this.historyTable = config.tableName || '_onela_migrations';
  }

  /**
   * 确保迁移历史表存在
   */
  async ensureHistoryTable(): Promise<void> {
    let sql: string;

    switch (this.dbType) {
      case 'oracle': case 'oracledb':
        // Oracle 不支持 IF NOT EXISTS，需要先检查
        sql = `BEGIN
          EXECUTE IMMEDIATE 'CREATE TABLE ${this.historyTable} (
            version VARCHAR2(100) PRIMARY KEY,
            description VARCHAR2(500),
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )';
        EXCEPTION WHEN OTHERS THEN
          IF SQLCODE = -955 THEN NULL; END IF;
        END;`;
        break;

      case 'sqlserver': case 'mssql':
        sql = `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${this.historyTable}' AND xtype='U')
          CREATE TABLE ${this.historyTable} (
            version NVARCHAR(100) PRIMARY KEY,
            description NVARCHAR(500),
            applied_at DATETIME2 DEFAULT GETDATE()
          )`;
        break;

      default:
        sql = `CREATE TABLE IF NOT EXISTS ${this.historyTable} (
          version VARCHAR(100) PRIMARY KEY,
          description VARCHAR(500),
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;
    }

    await this.executor(sql);
  }

  /**
   * 获取已执行的迁移记录
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureHistoryTable();
    const sql = `SELECT version, description, applied_at FROM ${this.historyTable} ORDER BY version ASC`;
    const result = await this.executor(sql);
    const rows = Array.isArray(result) ? result : (result?.rows || []);
    return rows.map((row: any) => ({
      version: row.version,
      description: row.description,
      appliedAt: new Date(row.applied_at),
    }));
  }

  /**
   * 获取待执行的迁移
   */
  async getPendingMigrations(migrations: Migration[]): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((m) => m.version));
    return migrations
      .filter((m) => !appliedVersions.has(m.version))
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * 执行所有待处理的迁移（升级）
   */
  async up(migrations: Migration[]): Promise<MigrationRecord[]> {
    const pending = await this.getPendingMigrations(migrations);
    const results: MigrationRecord[] = [];

    for (const migration of pending) {
      await this.executeMigration(migration, 'up');
      const record: MigrationRecord = {
        version: migration.version,
        description: migration.description,
        appliedAt: new Date(),
      };
      results.push(record);
    }

    return results;
  }

  /**
   * 回滚最近的 N 个迁移
   */
  async down(migrations: Migration[], count: number = 1): Promise<MigrationRecord[]> {
    const applied = await this.getAppliedMigrations();
    const toRollback = applied.slice(-count).reverse();
    const results: MigrationRecord[] = [];

    for (const record of toRollback) {
      const migration = migrations.find((m) => m.version === record.version);
      if (!migration) {
        throw new Error(`Migration ${record.version} not found in provided migrations list`);
      }

      await this.executeMigration(migration, 'down');
      results.push(record);
    }

    return results;
  }

  /**
   * 执行单个迁移
   */
  private async executeMigration(migration: Migration, direction: 'up' | 'down'): Promise<void> {
    const sqls = direction === 'up' ? migration.up : migration.down;
    const sqlList = Array.isArray(sqls) ? sqls : [sqls];

    for (const sql of sqlList) {
      if (sql.trim()) {
        await this.executor(sql);
      }
    }

    if (direction === 'up') {
      // 记录迁移
      const placeholder = this.getPlaceholder();
      await this.executor(
        `INSERT INTO ${this.historyTable} (version, description) VALUES (${placeholder(1)}, ${placeholder(2)})`,
        [migration.version, migration.description]
      );
    } else {
      // 删除迁移记录
      const placeholder = this.getPlaceholder();
      await this.executor(
        `DELETE FROM ${this.historyTable} WHERE version = ${placeholder(1)}`,
        [migration.version]
      );
    }
  }

  /**
   * 获取占位符函数
   */
  private getPlaceholder(): (index: number) => string {
    switch (this.dbType) {
      case 'postgresql': case 'postgres': case 'pg':
        return (i) => `$${i}`;
      case 'sqlserver': case 'mssql':
        return (i) => `@p${i}`;
      case 'oracle': case 'oracledb':
        return (i) => `:${i}`;
      default:
        return () => '?';
    }
  }

  /**
   * 获取迁移状态
   */
  async status(migrations: Migration[]): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations(migrations);
    return {
      applied,
      pending,
      total: migrations.length,
    };
  }
}

/**
 * 工厂函数
 */
export function createMigrationRunner(
  dbType: string,
  executor: (sql: string, params?: any[]) => Promise<any>,
  config?: MigrationRunnerConfig
): MigrationRunner {
  return new MigrationRunner(dbType, executor, config);
}
