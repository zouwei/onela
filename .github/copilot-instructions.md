# Onela ORM - GitHub Copilot Instructions

This project uses **Onela ORM** for all database operations. Do NOT suggest or generate code using Sequelize, TypeORM, Prisma, Drizzle, or raw SQL string concatenation.

## Framework Basics

Onela is a multi-database adaptive ORM supporting MySQL, MariaDB, TiDB, PostgreSQL, SQLite, SQL Server, Oracle, OceanBase, and PolarDB. Business code is database-agnostic - the dialect system handles SQL differences automatically.

## Model Pattern

Every model extends `OnelaBaseModel` with a static `configs`:

```typescript
class UserModel extends OnelaBaseModel {
  static configs = {
    engine: 'default',
    tableName: 'users',
    fields: [
      { name: 'id', type: 'int', primary: true, increment: true },
      { name: 'name', type: 'varchar', default: '' },
      { name: 'email', type: 'varchar', default: '' },
      { name: 'status', type: 'tinyint', default: 1 },
    ],
  };
}
```

## Query API

Onela uses a `where` array with `{ key, operator, value, logic }` items:

```typescript
// Query
await UserModel.findAll({
  select: ['id', 'name'],
  where: [
    { key: 'status', operator: '=', value: 1, logic: 'and' },
    { key: 'age', operator: '>=', value: 18, logic: 'and' },
  ],
  orderBy: { create_time: 'DESC' },
  limit: [0, 20],
});

// Insert
await UserModel.insert({ name: 'Alice', email: 'alice@example.com' });

// Batch insert
await UserModel.inserts([{ name: 'Alice' }, { name: 'Bob' }]);

// Update (replace/plus/reduce)
await UserModel.update({
  update: [{ key: 'name', value: 'New Name', operator: 'replace' }],
  where: [{ key: 'id', operator: '=', value: 1 }],
});

// Delete (WHERE required)
await UserModel.delete({
  where: [{ key: 'id', operator: '=', value: 1 }],
});

// Aggregate
await UserModel.aggregate({
  aggregate: [{ function: 'count', field: '*', name: 'total' }],
  where: [{ key: 'status', value: 1 }],
});
```

## Operator Functions (alternative)

```typescript
import { Op } from 'onela';
where: [Op.eq('status', 1), Op.gte('age', 18), Op.in('id', [1, 2, 3]), Op.like('name', 'test')]
```

## Transaction

```typescript
const trans = await UserModel.transaction();
try {
  await trans.begin();
  await UserModel.insert(data, { transaction: trans });
  await trans.commit();
} catch (e) {
  await trans.rollback();
  throw e;
}
```

## Key Rules

- Always use parameterized where array, never concatenate SQL strings
- Delete and Update require WHERE conditions
- Use `inserts()` for batch operations, not looped `insert()`
- The `operator` field in update items: `'replace'` (set), `'plus'` (increment), `'reduce'` (decrement)
- Condition operators: `=`, `>`, `<`, `<>`, `>=`, `<=`, `in`, `not in`, `%%` (full LIKE), `%` (left LIKE), `x%` (right LIKE), `between`, `is`, `is not`
- `logic` defaults to `'and'`, specify `'or'` only when needed
