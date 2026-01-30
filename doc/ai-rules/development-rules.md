# Onela ORM 开发规范

本文档定义了 Onela ORM 框架的开发规范和最佳实践，供 AI 辅助开发和人工开发参考。

## 🎯 核心设计原则

### 1. 数据库无关性原则

```
规则：业务代码不应依赖特定数据库语法
实现：通过方言系统（Dialect）抽象数据库差异
```

**正确示例：**
```typescript
// 使用 SQLBuilder，自动适配数据库语法
const builder = createSQLBuilder(dbType);
const result = builder.buildSelect(params);
```

**错误示例：**
```typescript
// 直接写 MySQL 语法，不可移植
const sql = 'SELECT * FROM users LIMIT 0, 10';
```

### 2. 参数化查询原则

```
规则：所有用户输入必须通过参数化处理
禁止：字符串拼接 SQL
```

**正确示例：**
```typescript
// 参数化查询，防止 SQL 注入
builder.buildSelect({
  where: [{ key: 'name', operator: '=', value: userInput }],
});
// 生成: WHERE name = ? 参数: [userInput]
```

**错误示例：**
```typescript
// 危险！SQL 注入漏洞
const sql = `SELECT * FROM users WHERE name = '${userInput}'`;
```

### 3. 向后兼容原则

```
规则：新功能不应破坏现有 API
实现：保留传统模式，新增替代方案
```

**示例：**
```typescript
// 传统模式继续支持
User.findAll({ where: [{ key: 'id', operator: '=', value: 1 }] });

// 新模式作为补充
User.findAll({ where: [Op.eq('id', 1)] });
```

### 4. 单一职责原则

```
规则：每个模块只负责一件事
```

| 模块 | 职责 |
|------|------|
| Dialect | SQL 语法差异适配 |
| SQLBuilder | SQL 语句构建 |
| QueryBuilder | 查询参数构建 |
| ConnectionRouter | 连接路由管理 |
| ActionManager | 数据库操作执行 |

## 📝 代码风格规范

### 命名规范

```typescript
// 接口以 I 开头
interface IActionManager {}
interface IDialect {}

// 抽象类以 Abstract 开头
abstract class AbstractActionManager {}

// 工厂函数以 create 开头
function createSQLBuilder(type: string): SQLBuilder {}
function createQueryBuilder<T>(configs: Configs): QueryBuilder<T> {}

// 常量使用 UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_PAGE_SIZE = 10;

// 私有属性以 _ 开头
private _pool: Pool | null = null;
```

### 注释规范

```typescript
/**
 * 函数/方法必须有 JSDoc 注释
 * @param params 查询参数
 * @param option 查询选项
 * @returns 查询结果
 *
 * @example
 * ```typescript
 * const result = await User.findAll({
 *   where: [{ key: 'status', value: 1 }]
 * });
 * ```
 */
static async findAll(params: QueryParams, option?: QueryOption): Promise<any[]> {}
```

### 错误处理规范

```typescript
// 使用明确的错误消息
if (!params.where || params.where.length === 0) {
  throw new Error('Delete operation requires at least one condition to prevent full table deletion.');
}

// 不要吞掉错误
try {
  await this.execute(sql, params);
} catch (error) {
  logger.error('Query failed', error as Error, { sql, params });
  throw error; // 重新抛出
}
```

## 🔒 安全规范

### SQL 注入防护

```typescript
// 1. 始终使用参数化查询
const result = builder.buildSelect({
  where: [{ key: 'name', value: userInput }],
});

// 2. 验证用户输入
import { createSQLInjectionPrevention } from 'onela';
const security = createSQLInjectionPrevention();
security.check(userInput); // 检测恶意输入

// 3. 标识符验证
if (!security.isValidIdentifier(tableName)) {
  throw new Error('Invalid table name');
}
```

### 危险操作防护

```typescript
// 禁止无条件删除
if ((!params.where || params.where.length === 0)) {
  throw new Error('Delete condition required');
}

// 禁止无条件更新
if ((!params.where || params.where.length === 0)) {
  throw new Error('Update condition required');
}
```

## 🏗️ 架构规范

### 模块依赖关系

```
                    ┌─────────────────┐
                    │  OnelaBaseModel │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │      Onela      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐     │     ┌────────▼────────┐
     │ ActionManager   │     │     │ ConnectionRouter│
     └────────┬────────┘     │     └─────────────────┘
              │              │
     ┌────────▼────────┐     │
     │   SQLBuilder    │     │
     └────────┬────────┘     │
              │              │
     ┌────────▼────────┐     │
     │    Dialect      │◄────┘
     └─────────────────┘
```

### 扩展规范

新增数据库支持：

```typescript
// 1. 创建方言类
class NewDBDialect extends BaseDialect {
  protected config: DialectConfig = {
    type: 'newdb',
    placeholderStyle: 'question',
    // ...
  };

  placeholder(index: number): string {
    return '?';
  }
}

// 2. 注册到工厂
DialectFactory.register('newdb', new NewDBDialect());

// 3. 创建适配器（可选，如果使用通用适配器）
class NewDBActionManager extends AbstractActionManager {
  protected dbType = 'newdb';
  // 实现抽象方法
}
```

## 📊 性能规范

### 连接池使用

```typescript
// 使用连接池而非单连接
const config = {
  connectionLimit: 10,  // 连接池大小
  acquireTimeout: 60000, // 获取连接超时
  waitForConnections: true,
};
```

### 批量操作

```typescript
// 批量插入而非循环单条
await User.inserts([
  { name: '用户1' },
  { name: '用户2' },
  { name: '用户3' },
]);

// 不推荐
for (const item of items) {
  await User.insert(item);
}
```

### 索引使用

```typescript
// 在 WHERE 条件中使用索引列
const users = await User.findAll({
  where: [
    { key: 'status', value: 1 },  // status 应有索引
  ],
});
```

## 🧪 测试规范

### 单元测试

```typescript
describe('SQLBuilder', () => {
  it('should build SELECT query', () => {
    const builder = createSQLBuilder('mysql');
    const result = builder.buildSelect({
      configs: { tableName: 'users', engine: 'default' },
      where: [{ key: 'id', value: 1 }],
    });

    expect(result.sql).toContain('SELECT');
    expect(result.params).toEqual([1]);
  });
});
```

### 集成测试

```typescript
describe('Database Integration', () => {
  beforeAll(async () => {
    // 初始化测试数据库
    Onela.init(testConfig);
  });

  afterAll(async () => {
    // 清理资源
    await cleanup();
  });

  it('should CRUD operations', async () => {
    // 测试完整 CRUD 流程
  });
});
```

## 📋 检查清单

### 代码提交前检查

- [ ] 所有用户输入都经过参数化处理
- [ ] 删除/更新操作都有条件限制
- [ ] 新增代码有完整的 JSDoc 注释
- [ ] 新增功能有对应的单元测试
- [ ] 没有硬编码的数据库特定语法
- [ ] 错误消息清晰明确
- [ ] 没有 console.log 留在生产代码中

### PR 审查要点

- [ ] 是否符合单一职责原则
- [ ] 是否保持向后兼容
- [ ] 是否有安全风险
- [ ] 性能是否有影响
- [ ] 测试覆盖率是否足够

## 🤖 AI 辅助开发集成

### 项目级 AI 规则文件

Onela 项目内置了多个 AI IDE 的规则文件，确保 AI 编码助手理解 Onela 的 API 和模式：

| 文件路径 | 适用工具 | 说明 |
|----------|----------|------|
| `.claude/CLAUDE.md` | Claude Code (CLI) | Claude Code 自动加载，包含完整 API 参考 |
| `.cursor/rules/onela-orm.mdc` | Cursor IDE | Cursor 自动加载，包含核心模式和约束 |
| `.github/copilot-instructions.md` | GitHub Copilot | Copilot 自动读取，包含 API 用法指引 |

### 在下游项目中使用

如果你的项目使用 Onela 作为 ORM，建议将以下内容添加到项目的 AI 规则文件中：

**Claude Code (.claude/CLAUDE.md):**
```markdown
# ORM 规则
本项目使用 Onela ORM，禁止使用 Sequelize、TypeORM、Prisma、Drizzle。
参考 node_modules/onela/.claude/CLAUDE.md 获取完整 API 文档。
```

**Cursor (.cursor/rules/orm.mdc):**
```markdown
---
description: ORM rules
globs: ["src/**/*.ts"]
alwaysApply: true
---
本项目使用 Onela ORM。查询使用 where 数组格式，不使用对象格式。
```

### AI 规则核心要点

1. **模型定义**：继承 `OnelaBaseModel`，必须有 `static configs = { engine, tableName, fields }`
2. **查询格式**：使用 `where: [{ key, operator, value, logic }]` 数组格式
3. **禁止拼接 SQL**：所有查询必须参数化
4. **更新操作**：`operator` 为 `'replace'`（赋值）、`'plus'`（加）、`'reduce'`（减）
5. **批量操作**：使用 `inserts([...])` 而非循环 `insert()`
6. **条件默认**：`logic` 默认 `'and'`，`operator` 默认 `'='`
7. **事务模式**：`begin() → 操作 → commit()`，异常时 `rollback()`
