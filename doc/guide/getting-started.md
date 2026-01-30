# 快速开始

本指南将帮助你在 5 分钟内开始使用 Onela ORM 框架。

## 安装

```bash
npm install onela
```

根据你使用的数据库，安装相应的驱动：

```bash
# MySQL / MariaDB / TiDB
npm install mysql2

# PostgreSQL
npm install pg

# SQLite
npm install better-sqlite3

# SQL Server
npm install tedious

# Oracle
npm install oracledb
```

## 基本使用

### 1. 初始化连接

```typescript
import { Onela, OnelaBaseModel } from 'onela';
import type { Configs } from 'onela';

// 配置数据库连接
const dbconfig = [
  {
    engine: 'default',        // 引擎标识
    type: 'mysql',            // 数据库类型
    value: {
      connectionLimit: 10,
      host: '127.0.0.1',
      user: 'root',
      password: 'password',
      database: 'mydb',
    },
  },
];

// 初始化
Onela.init(dbconfig);
```

### 2. 定义模型

```typescript
class User extends OnelaBaseModel {
  static configs: Configs = {
    engine: 'default',
    tableName: 'users',
    fields: [
      { name: 'id', type: 'int', default: null, increment: true },
      { name: 'name', type: 'varchar', default: '' },
      { name: 'email', type: 'varchar', default: '' },
      { name: 'age', type: 'int', default: 0 },
      { name: 'status', type: 'tinyint', default: 1 },
      { name: 'create_time', type: 'datetime', default: () => new Date() },
    ],
  };
}
```

### 3. 查询数据

```typescript
// 查询单条
const user = await User.findOne({
  where: [{ key: 'id', operator: '=', value: 1 }],
});

// 查询多条
const users = await User.findAll({
  where: [{ key: 'status', operator: '=', value: 1 }],
  orderBy: { create_time: 'DESC' },
  limit: [0, 10],
});

// 分页查询
const { data, recordsTotal } = await User.findList({
  where: [{ key: 'status', operator: '=', value: 1 }],
  limit: [0, 10],
});
```

### 4. 插入数据

```typescript
// 单条插入
const result = await User.insert({
  name: '张三',
  email: 'zhangsan@example.com',
  age: 25,
});

// 批量插入
const results = await User.inserts([
  { name: '李四', email: 'lisi@example.com', age: 30 },
  { name: '王五', email: 'wangwu@example.com', age: 28 },
]);
```

### 5. 更新数据

```typescript
// 普通更新
await User.update({
  update: [
    { key: 'name', value: '张三丰', operator: 'replace' },
  ],
  where: [
    { key: 'id', operator: '=', value: 1, logic: 'and' },
  ],
});

// 数值增减
await User.update({
  update: [
    { key: 'age', value: 1, operator: 'plus' },  // age + 1
  ],
  where: [
    { key: 'id', operator: '=', value: 1, logic: 'and' },
  ],
});
```

### 6. 删除数据

```typescript
await User.delete({
  where: [
    { key: 'id', operator: '=', value: 1, logic: 'and' },
  ],
});
```

### 7. 事务处理

```typescript
const t = await User.transaction();

try {
  await User.insert({ name: '测试' }, { transaction: t });
  await User.update({
    update: [{ key: 'status', value: 1, operator: 'replace' }],
    where: [{ key: 'id', operator: '=', value: 1, logic: 'and' }],
  }, { transaction: t });

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

## 五种查询模式

Onela 支持五种查询模式，你可以选择最适合你的方式：

### 模式 1：传统模式（向后兼容）

```typescript
const users = await User.findAll({
  where: [
    { key: 'status', operator: '=', value: 1, logic: 'and' },
    { key: 'age', operator: '>=', value: 18, logic: 'and' },
  ],
});
```

### 模式 2：简单对象模式

```typescript
import { parseSimpleWhere } from 'onela';

const where = parseSimpleWhere({
  status: 1,
  age: { $gte: 18 },
  name: { $like: '张' },
});

const users = await User.findAll({ where });
```

### 模式 3：操作符函数模式

```typescript
import { Op } from 'onela';

const users = await User.findAll({
  where: [
    Op.eq('status', 1),
    Op.gte('age', 18),
    Op.like('name', '张'),
  ],
});
```

### 模式 4：链式构建模式

```typescript
import { createQueryBuilder } from 'onela';

const qb = createQueryBuilder(User.configs);
const params = qb
  .select('id', 'name', 'email')
  .where('status', 1)
  .where('age', '>=', 18)
  .whereLike('name', '张')
  .orderBy('create_time', 'DESC')
  .page(1, 10)
  .build();

const users = await User.findAll(params);
```

### 模式 5：Lambda 表达式模式

```typescript
import { createQueryBuilder } from 'onela';

interface UserEntity {
  id: number;
  name: string;
  email: string;
  age: number;
  status: number;
}

const qb = createQueryBuilder<UserEntity>(User.configs);
const params = qb
  .whereLambda((f) => f.status.eq(1))
  .whereLambda((f) => f.age.gte(18))
  .build();

const users = await User.findAll(params);
```

## 下一步

- [配置说明](./configuration.md) - 了解更多配置选项
- [查询模式详解](./query-modes.md) - 深入了解五种查询模式
- [事务处理](./transactions.md) - 事务使用最佳实践
- [API 文档](../api/core.md) - 完整 API 参考
