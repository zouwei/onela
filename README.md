# Onela ORM

> 世界级自适应关系型数据库热切换 ORM 框架，一套业务代码无缝接入 9+ 种数据库。

[![npm](https://img.shields.io/npm/v/onela?color=success)](https://npmjs.com/package/onela)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://npmjs.com/package/onela)
[![tree-shakable](https://img.shields.io/badge/tree--shakable-100%25-green)](https://npmjs.com/package/onela)
[![Downloads](https://img.shields.io/npm/dm/onela.svg?color=blue)](https://www.npmjs.com/package/onela)
[![License](https://img.shields.io/npm/l/onela)](https://github.com/zouwei/onela/blob/master/LICENSE)

## 特性

- **9+ 数据库支持** - MySQL / MariaDB / TiDB / PostgreSQL / SQLite / SQL Server / Oracle / OceanBase / PolarDB
- **热切换** - 运行时无缝切换数据库连接，零停机
- **读写分离** - 自动路由读写请求，支持 4 种负载均衡策略
- **故障转移** - 自动检测故障节点并切换，支持健康检查
- **5 种查询模式** - 简单对象 / 操作符函数 / 链式构建 / Lambda 表达式 / 传统模式
- **Schema 管理** - DDL 构建、结构自省、迁移运行、动态 Model 注册
- **安全体系** - SQL 注入防护 / 操作白名单 / 审计日志 / 行级限制 / 字段级访问控制
- **AI 友好** - 动态 Model、结构描述、元数据查询，为 AI 数据库管理场景设计
- **TypeScript 原生** - 完整类型定义，100% Tree-shakable

## 安装

```bash
npm install onela
```

安装数据库驱动（按需选择）：

```bash
npm install mysql2       # MySQL / MariaDB / TiDB / OceanBase / PolarDB
npm install pg           # PostgreSQL
npm install better-sqlite3  # SQLite（推荐）
npm install sqlite3         # SQLite（异步）
npm install tedious         # SQL Server
npm install oracledb     # Oracle
```

## 快速开始

### 1. 初始化

```typescript
import { Onela, OnelaBaseModel } from 'onela';
import type { Configs } from 'onela';

// 推荐：使用 V2 适配器（基于统一 SQLBuilder 架构）
Onela.init([
  {
    engine: 'default',
    type: 'mysql',
    value: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: 'mydb',
      connectionLimit: 10,
    },
  },
], { useV2: true });
```

### 2. 定义 Model

```typescript
class User extends OnelaBaseModel {
  static configs: Configs = {
    engine: 'default',
    tableName: 'users',
    fields: [
      { name: 'id', type: 'int', default: null, comment: '主键', primary: true, increment: true },
      { name: 'name', type: 'varchar', default: '', comment: '用户名' },
      { name: 'email', type: 'varchar', default: '', comment: '邮箱' },
      { name: 'age', type: 'int', default: 0, comment: '年龄' },
      { name: 'status', type: 'tinyint', default: 1, comment: '状态' },
      { name: 'created_at', type: 'datetime', default: () => new Date(), comment: '创建时间' },
    ],
  };
}
```

### 3. CRUD 操作

```typescript
// 查询单条
const user = await User.findOne({
  where: [{ key: 'id', value: 1, operator: '=' }],
});

// 查询列表
const users = await User.findAll({
  where: [{ key: 'status', value: 1, operator: '=' }],
  orderBy: { created_at: 'DESC' },
  limit: [0, 20],
});

// 分页查询
const { data, recordsTotal } = await User.findList({
  where: [{ key: 'status', value: 1, operator: '=' }],
  limit: [0, 10],
});

// 插入
const result = await User.insert({ name: 'Alice', email: 'alice@example.com', age: 25 });

// 更新
await User.update({
  update: [{ key: 'name', value: 'Bob', operator: 'replace' }],
  where: [{ key: 'id', value: 1, operator: '=' }],
});

// 删除
await User.delete({
  where: [{ key: 'id', value: 1, operator: '=' }],
});
```

## 5 种查询模式

### 模式 1：简单对象

```typescript
import { parseSimpleWhere } from 'onela';

const keyword = parseSimpleWhere({ name: 'Alice', status: 1 });
User.findAll({ where: keyword });
```

### 模式 2：操作符函数

```typescript
import { Op } from 'onela';

User.findAll({
  where: [Op.eq('status', 1), Op.gte('age', 18), Op.like('name', 'Ali')],
});
```

### 模式 3：链式构建

```typescript
import { createQueryBuilder } from 'onela';

const qb = createQueryBuilder(User.configs);
qb.select('id', 'name', 'email')
  .where('status', 1)
  .where('age', '>=', 18)
  .orderBy('created_at', 'DESC')
  .page(1, 20);

User.findAll(qb.build());
```

### 模式 4：Lambda 表达式

```typescript
const qb = createQueryBuilder<{ name: string; age: number; status: number }>(User.configs);
qb.whereLambda((f) => [f.status.eq(1), f.age.gte(18)])
  .orderByDesc('created_at')
  .limit(20);
```

### 模式 5：传统模式

```typescript
User.findAll({
  where: [
    { key: 'status', value: 1, operator: '=', logic: 'and' },
    { key: 'age', value: 18, operator: '>=', logic: 'and' },
  ],
  orderBy: { created_at: 'DESC' },
  limit: [0, 20],
});
```

## 高级功能

### 事务

```typescript
const t = await User.transaction();
try {
  await User.insert({ name: 'Alice', email: 'alice@example.com' }, { transaction: t });
  await User.update({
    update: [{ key: 'status', value: 2, operator: 'replace' }],
    where: [{ key: 'name', value: 'Alice', operator: '=' }],
  }, { transaction: t });
  await t.commit();
} catch (e) {
  await t.rollback();
}
```

### JOIN 查询

```typescript
import { createJoinBuilder } from 'onela';

const jb = createJoinBuilder('users', 'u');
jb.leftJoin('orders', [{ leftColumn: 'u.id', rightColumn: 'orders.user_id' }], 'o')
  .select('u', 'name', 'user_name')
  .select('o', 'amount');

const sql = jb.buildSelectSQL('u.status = 1', 'o.created_at DESC', '20');
```

### 子查询

```typescript
import { createSubqueryBuilder, subqueryIn } from 'onela';

// WHERE user_id IN (SELECT id FROM users WHERE status = 1)
const sub = subqueryIn('user_id', 'users', 'id', 'status = ?', 1);

// EXISTS 子查询
const builder = createSubqueryBuilder('orders')
  .select('1')
  .where('orders.user_id = users.id');
const exists = builder.toExistsClause();
```

### 聚合查询

```typescript
User.aggregate({
  aggregate: [
    { function: 'count', field: 'id', name: 'total' },
    { function: 'avg', field: 'age', name: 'avgAge' },
  ],
  where: [{ key: 'status', value: 1, operator: '=' }],
});
```

### 复杂更新 (CASE WHEN)

```typescript
User.update({
  update: [
    { key: 'status', value: 1, operator: 'replace' },
    {
      key: 'name',
      value: null,
      case_field: 'id',
      case_item: [
        { case_value: 1, value: 'Alice Updated', operator: 'replace' },
        { case_value: 2, value: 'Bob Updated', operator: 'replace' },
      ],
    },
  ],
  where: [{ key: 'id', operator: 'in', value: [1, 2] }],
});
```

### 原生 SQL

```typescript
const result = await User.sql('SELECT * FROM users WHERE age > ?', [18]);
```

## Schema 管理

### DDL 构建

```typescript
import { createDDLBuilder } from 'onela';

const ddl = createDDLBuilder('mysql');

// CREATE TABLE
const sql = ddl.buildCreateTable({
  tableName: 'articles',
  ifNotExists: true,
  columns: [
    { name: 'id', type: 'int', primary: true, increment: true },
    { name: 'title', type: 'varchar', length: 200, nullable: false },
    { name: 'content', type: 'text' },
    { name: 'created_at', type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' },
  ],
  engine: 'InnoDB',
  charset: 'utf8mb4',
  comment: '文章表',
});

// ALTER TABLE
const alterSQLs = ddl.buildAlterTable('articles', [
  { type: 'addColumn', column: { name: 'views', type: 'int', defaultValue: 0 } },
  { type: 'addIndex', index: { name: 'idx_title', columns: ['title'] } },
]);
```

### 数据库自省

```typescript
import { createSchemaIntrospector } from 'onela';

const introspector = createSchemaIntrospector('mysql', (sql, params) => User.sql(sql, params));

// 获取所有表
const tables = await introspector.getTables();

// 获取表结构
const schema = await introspector.getTableSchema('users');

// 转换为 Onela Model 配置
const configs = SchemaIntrospector.toConfigs('users', 'default', schema.columns);
```

### 迁移管理

```typescript
import { createMigrationRunner } from 'onela';

const runner = createMigrationRunner('mysql', (sql, params) => User.sql(sql, params));

const migrations = [
  {
    version: '20260101_001',
    description: 'Create articles table',
    up: 'CREATE TABLE articles (id INT PRIMARY KEY AUTO_INCREMENT, title VARCHAR(200))',
    down: 'DROP TABLE articles',
  },
];

// 执行迁移
await runner.up(migrations);

// 查看状态
const status = await runner.status(migrations);

// 回滚
await runner.down(migrations, 1);
```

### 动态 Model（AI 场景）

```typescript
import { DynamicModelRegistry } from 'onela';

// 运行时注册 Model
DynamicModelRegistry.createFromFields('ai_data', 'default', [
  { name: 'id', type: 'int', default: null, comment: 'ID', primary: true, increment: true },
  { name: 'content', type: 'text', default: '', comment: '内容' },
]);

// 获取所有 Model 描述（供 AI 使用）
const description = DynamicModelRegistry.describe();
```

## 安全体系

### SQL 注入防护

```typescript
import { createSQLInjectionPrevention } from 'onela';

const security = createSQLInjectionPrevention({
  enabled: true,
  throwOnDetection: true,
  maxValueLength: 10000,
});

security.check(userInput); // 检测到注入时抛出异常
```

### 操作白名单

```typescript
import { createOperationGuard } from 'onela';

const guard = createOperationGuard({
  defaultPolicy: 'deny',
  permissions: [
    { tableName: 'users', allowed: ['select', 'update'] },
    { tableName: 'logs', readonly: true },
  ],
  globalDeny: ['sql'],
});

guard.assert('users', 'delete'); // Error: Operation "delete" is not allowed
```

### 审计日志

```typescript
import { createAuditLogger } from 'onela';

const audit = createAuditLogger({
  enabled: true,
  logSQL: true,
  operations: ['insert', 'update', 'delete'],
});

await audit.log({
  operation: 'update',
  tableName: 'users',
  engine: 'default',
  success: true,
  affectedRows: 1,
  duration: 15,
});

const logs = await audit.query({ tableName: 'users', failedOnly: true });
```

### 行级限制

```typescript
import { createRowLimiter } from 'onela';

const limiter = createRowLimiter({
  defaultLimits: { select: 10000, delete: 100, update: 500 },
});

limiter.assert('users', 'delete', 5000); // Error: exceeding limit of 100
```

### 字段级访问控制

```typescript
import { createFieldAccessControl } from 'onela';

const acl = createFieldAccessControl({
  tables: [{
    tableName: 'users',
    defaultPermission: 'readwrite',
    rules: [
      { field: 'password', permission: 'none' },
      { field: 'email', permission: 'read' },
    ],
  }],
});

acl.canRead('users', 'password');   // false
acl.canWrite('users', 'email');     // false

const safeFields = acl.filterReadableFields('users', ['id', 'name', 'password']);
// ['id', 'name']
```

## 连接路由

### 读写分离 & 负载均衡

```typescript
import { createConnectionRouter } from 'onela';

const router = createConnectionRouter({
  readWriteSplit: true,
  strategy: 'least-connections', // round-robin | random | weight | least-connections
  failover: true,
  maxRetries: 3,
  healthCheckInterval: 30000,
});

router.addNode({ id: 'master', role: 'master', weight: 1, enabled: true, healthy: true, config: masterConfig, type: 'mysql' });
router.addNode({ id: 'slave-1', role: 'slave', weight: 2, enabled: true, healthy: true, config: slave1Config, type: 'mysql' });

// 自动路由
const writeNode = router.getWriteNode();
const readNode = router.getReadNode();

// 带重试的执行
await router.executeWithRetry(async (node) => {
  // 数据库操作
}, true); // true = 写操作

// 热切换
await router.hotSwitch('old-master', newMasterNode);

// 查看状态
const status = router.getStatus();
```

## 错误处理

```typescript
import { OnelaError, ErrorCode, isOnelaError, wrapError } from 'onela';

try {
  await User.findAll({ where: [{ key: 'id', value: 1, operator: '=' }] });
} catch (e) {
  if (isOnelaError(e)) {
    console.log(e.code);       // ErrorCode.QUERY_FAILED (2001)
    console.log(e.category);   // 'query'
    console.log(e.isRetryable()); // false
    console.log(e.toJSON());   // 结构化错误信息
  }
}

// 错误码分类:
// 1xxx - 连接错误 (CONNECTION_FAILED, CONNECTION_TIMEOUT, ...)
// 2xxx - 查询错误 (QUERY_FAILED, INVALID_SQL, ...)
// 3xxx - 配置错误 (INVALID_CONFIG, MISSING_ENGINE, ...)
// 4xxx - 安全错误 (SQL_INJECTION_DETECTED, OPERATION_NOT_ALLOWED, ...)
// 5xxx - 事务错误 (TRANSACTION_FAILED, TRANSACTION_TIMEOUT, ...)
// 6xxx - Schema 错误 (DDL_FAILED, MIGRATION_FAILED, ...)
```

## 元数据查询

```typescript
import { createMetadataQuery } from 'onela';

const meta = createMetadataQuery('mysql');

// 跨数据库通用的元数据 SQL
const versionSQL = meta.getVersionSQL();
const tablesSQL = meta.getDatabasesSQL();
const indexesSQL = meta.getIndexesSQL('users');
const foreignKeysSQL = meta.getForeignKeysSQL('orders');
const sizeSQL = meta.getTableSizeSQL('users');
```

## 数据库支持矩阵

| 数据库 | 类型标识 | 驱动 | V2 适配器 |
|--------|---------|------|----------|
| MySQL 5.7+ / 8.0+ | `mysql` | mysql2 | MySQLActionManagerV2 |
| MariaDB 10.x+ | `mariadb` | mysql2 | MySQLActionManagerV2 |
| TiDB | `tidb` | mysql2 | MySQLActionManagerV2 |
| OceanBase | `oceanbase` | mysql2 | MySQLActionManagerV2 |
| PolarDB | `polardb` | mysql2 | MySQLActionManagerV2 |
| PostgreSQL 10+ | `postgresql` | pg | PostgreSQLActionManagerV2 |
| SQLite 3.x | `sqlite` | sqlite3 | SQLiteActionManagerV2 |
| SQL Server 2012+ | `sqlserver` | tedious | SQLServerActionManagerV2 |
| Oracle 11g+ | `oracle` | oracledb | OracleActionManagerV2 |

## 条件操作符

| 操作符 | 说明 | 示例值 |
|-------|------|-------|
| `=` | 等于 | `1` |
| `>` `<` `>=` `<=` `<>` | 比较 | `18` |
| `in` / `not in` | 集合 | `[1, 2, 3]` |
| `between` / `not between` | 范围 | `[1, 100]` |
| `%%` | 全模糊 LIKE '%v%' | `'test'` |
| `%` | 左模糊 LIKE '%v' | `'test'` |
| `x%` | 右模糊 LIKE 'v%' | `'test'` |
| `like` / `not like` | LIKE | `'%test%'` |
| `is` / `is not` | NULL 判断 | `'NULL'` |
| `regexp` / `~` | 正则 | `'^A'` |

## V1 → V2 迁移

v4.0 起，V1 适配器已标记为 `@deprecated`，将在 v5.0 移除。详见 [Migration Guide](doc/migration-v1-to-v2.md)。

**关键变更：**
- 初始化时传入 `{ useV2: true }` 启用 V2 适配器
- V2 基于统一的 `SQLBuilder` + `AbstractActionManager` 架构，SQL 构建集中化
- V1 的 `format` 属性已废弃（安全风险），建议使用参数化查询
- `$raw` 操作符已禁用

## 项目结构

```
src/
  index.v2.ts            # 入口文件
  types/onela.ts         # 类型定义
  abstract/              # 抽象基类 (AbstractActionManager)
  interfaces/            # 接口定义 (IActionManager)
  dialect/               # 方言系统 (MySQL, PostgreSQL, SQLite, SQLServer, Oracle)
  builders/              # SQL 构建器
  query/                 # 查询模块 (QueryBuilder, JoinBuilder, SubqueryBuilder, Op, MetadataQuery)
  instance/              # 数据库适配器 (V1 + V2)
  router/                # 连接路由器 (读写分离, 负载均衡, 热切换)
  security/              # 安全模块 (注入防护, 操作守卫, 审计, 行限制, 字段控制)
  schema/                # Schema 管理 (DDL, 自省, 迁移, 动态Model)
  errors/                # 统一错误系统 (OnelaError, ErrorCode)
  logger/                # 日志模块
```

## 构建 & 测试

```bash
npm run build          # 构建 (Rollup, 输出 ESM + CJS)
npm test               # 运行全部测试
npm run test:unit      # 运行单元测试
npm run test:integration  # 运行集成测试
```

## License

[GPL-3.0-only](LICENSE)

## Author

SHIYE - [@zouwei](https://github.com/zouwei)
