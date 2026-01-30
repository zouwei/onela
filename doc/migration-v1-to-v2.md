# V1 → V2 迁移指南

本文档介绍从 Onela V1 迁移到 V2 的步骤和注意事项。

## 概述

v4.0 将 V1 代码路径标记为 `@deprecated`，V2 成为推荐架构。V1 将在 v5.0 中移除。

**V1 与 V2 的核心差异：**

| 对比项 | V1 | V2 |
|--------|----|----|
| SQL 构建 | 各 ActionManager 独立拼接 SQL | 统一 SQLBuilder + Dialect |
| 基类 | 无统一基类 | AbstractActionManager 模板方法 |
| 数据库支持 | MySQL, PostgreSQL, SQLite, SQL Server | + Oracle, MariaDB, TiDB, OceanBase, PolarDB |
| 安全校验 | 补丁式（v4.0 补齐） | 架构级内置 |
| 参数占位符 | 各语法文件独立处理 | Dialect 统一处理 |

## 迁移步骤

### 1. 启用 V2 适配器

```typescript
// V1（旧方式，已废弃）
Onela.init([
  { engine: 'default', type: 'mysql', value: { /* ... */ } }
]);

// V2（推荐）
Onela.init([
  { engine: 'default', type: 'mysql', value: { /* ... */ } }
], { useV2: true });
```

> **注意**：不传 `useV2` 或传 `false` 仍使用 V1 适配器，但会在控制台输出废弃警告。

### 2. 查询代码无需修改

Model 层 API 完全兼容，以下代码在 V1 和 V2 下行为一致：

```typescript
// findOne / findAll / findList / find — 无变化
const user = await User.findOne({
  where: [{ key: 'id', value: 1, operator: '=' }],
});

// insert / inserts — 无变化
await User.insert({ name: 'Alice', email: 'alice@example.com' });

// update — 无变化
await User.update({
  update: [{ key: 'name', value: 'Bob', operator: 'replace' }],
  where: [{ key: 'id', value: 1, operator: '=' }],
});

// delete — 无变化
await User.delete({
  where: [{ key: 'id', value: 1, operator: '=' }],
});

// aggregate — 无变化
await User.aggregate({
  aggregate: [{ function: 'count', field: 'id', name: 'total' }],
  where: [{ key: 'status', value: 1 }],
});

// transaction — 无变化
const t = await User.transaction();
```

### 3. 处理废弃的 `format` 属性

`format` 属性曾允许绕过参数化查询，在 v4.0 中已收紧为仅允许 `[a-zA-Z0-9_.]` 字符，且标记为 `@deprecated`。

```typescript
// V1 - 使用 format（已废弃，安全风险）
{
  where: [{ key: 'a.id', value: 'b.user_id', operator: '=', format: true }]
}

// V2 - 推荐替代方式
// 方式 1：使用 JoinBuilder
import { createJoinBuilder } from 'onela';
const jb = createJoinBuilder('table_a', 'a');
jb.innerJoin('table_b', [{ leftColumn: 'a.id', rightColumn: 'b.user_id' }], 'b');

// 方式 2：使用原生 SQL
await Model.sql('SELECT * FROM table_a a JOIN table_b b ON a.id = b.user_id');
```

### 4. `$raw` 操作符已禁用

SimpleWhereParser 中的 `$raw` 操作符因安全风险已禁用，使用时会抛出异常。

```typescript
// 不再支持
parseSimpleWhere({ $raw: 'age > 18' }); // ❌ 抛出 Error

// 替代方案
parseSimpleWhere({ age: { $gt: 18 } }); // ✅ 安全
// 或使用 Op
[Op.gt('age', 18)] // ✅ 安全
```

### 5. 数据库类型标识扩展

V2 支持更多数据库类型标识别名：

```typescript
// 以下标识均路由到 MySQLActionManagerV2
type: 'mysql' | 'mariadb' | 'tidb' | 'oceanbase' | 'polardb' | 'tdsql' | 'greatsql'

// PostgreSQL 别名
type: 'postgresql' | 'postgres' | 'pg'

// SQLite 别名
type: 'sqlite' | 'sqlite3'

// SQL Server 别名
type: 'sqlserver' | 'mssql'

// Oracle 别名
type: 'oracle' | 'oracledb'
```

## 不兼容变更清单

| 变更 | 影响 | 处理方式 |
|------|------|---------|
| `format` 属性正则收紧 | 包含 `(`, `)`, 空格, `+`, `-`, `*`, `/` 的 format 值将被拒绝 | 改用 JoinBuilder 或原生 SQL |
| `$raw` 操作符禁用 | 使用 `$raw` 的代码会抛出异常 | 改用 Op 函数或参数化条件 |
| V1 ActionManager @deprecated | 运行时无影响，IDE 会提示废弃 | 传入 `{ useV2: true }` |
| 构建入口切换 | npm 包导出内容变化（包含完整 V2 模块） | 无需处理，向后兼容 |

## V2 新增能力

迁移到 V2 后，可使用以下新功能：

- **Op 操作符**：`Op.eq()`, `Op.gt()`, `Op.in()`, `Op.like()` 等
- **QueryBuilder 链式查询**：`.where().orderBy().page().build()`
- **JoinBuilder**：多表 JOIN 查询构建
- **SubqueryBuilder**：子查询 IN / EXISTS
- **Schema 管理**：DDL 构建、结构自省、迁移管理
- **安全模块**：操作白名单、审计日志、行级限制、字段访问控制
- **连接路由**：读写分离、负载均衡、故障转移
- **错误系统**：结构化错误码、分类、可重试判断

## 常见问题

### Q: V2 适配器是否影响性能？

V2 通过统一 SQLBuilder 构建 SQL，最终执行的 SQL 与 V1 等价。SQLBuilder 的额外开销可忽略不计。

### Q: 能否混用 V1 和 V2？

不能。`useV2` 是全局开关，同一进程中所有 engine 使用同一版本的适配器。

### Q: Oracle 只有 V2 版本？

是的。Oracle 支持是 V2 架构新增的，没有 V1 版本。
