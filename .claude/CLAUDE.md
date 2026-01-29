# Onela ORM Framework - AI Development Rules

This project uses **Onela**, a multi-database adaptive ORM framework for Node.js/TypeScript. Do NOT use Sequelize, TypeORM, Prisma, Drizzle, or any other ORM in this project.

## Project Structure

```
src/
├── abstract/        # AbstractActionManager - template method pattern base
├── builders/        # SQLBuilder - unified SQL construction
├── dialect/         # Database-specific SQL dialects (MySQL, PostgreSQL, SQLite, SQLServer, Oracle)
├── grammar/         # SQL grammar definitions per database
├── instance/        # Database-specific ActionManager implementations
├── interfaces/      # IActionManager and other contracts
├── logger/          # Logger module
├── query/           # QueryBuilder, operators, parsers
│   ├── operators/   # Op.eq(), Op.gt(), Op.in(), etc.
│   └── parsers/     # SimpleWhereParser, LegacyParser
├── router/          # ConnectionRouter (read-write split, failover, load balancing)
├── security/        # SQL injection prevention (OWASP)
├── types/           # TypeScript type definitions
├── index.ts         # V1 entry point (legacy)
└── index.v2.ts      # V2 entry point (recommended)
```

## Core Concepts

### 1. Onela Initialization

```typescript
import { Onela, OnelaBaseModel } from 'onela';

Onela.init([
  {
    engine: 'default',
    type: 'mysql',       // mysql | mariadb | tidb | postgresql | sqlite | sqlserver | oracle | oceanbase | polardb
    value: {
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'mydb',
    },
  },
]);
```

### 2. Defining Models

Every model MUST extend `OnelaBaseModel` and define a static `configs` object:

```typescript
class UserModel extends OnelaBaseModel {
  static configs = {
    engine: 'default',        // matches the engine in Onela.init()
    tableName: 'users',
    fields: [
      { name: 'id', type: 'int', primary: true, increment: true },
      { name: 'name', type: 'varchar', default: '' },
      { name: 'email', type: 'varchar', default: '' },
      { name: 'age', type: 'int', default: 0 },
      { name: 'status', type: 'tinyint', default: 1 },
      { name: 'create_time', type: 'datetime', default: null },
    ],
  };
}
```

### 3. CRUD Operations

**Query (single record):**
```typescript
const user = await UserModel.findOne({
  where: [{ key: 'id', operator: '=', value: 1 }],
});
```

**Query (list):**
```typescript
const users = await UserModel.findAll({
  select: ['id', 'name', 'email'],
  where: [
    { key: 'status', operator: '=', value: 1, logic: 'and' },
    { key: 'age', operator: '>=', value: 18, logic: 'and' },
  ],
  orderBy: { create_time: 'DESC' },
  limit: [0, 20],
});
```

**Paginated query:**
```typescript
const result = await UserModel.findList({
  where: [{ key: 'status', value: 1 }],
  limit: [0, 10],
});
// Returns: { data: [...], recordsTotal: 100 }
```

**Insert:**
```typescript
const result = await UserModel.insert({ name: 'Alice', email: 'alice@example.com', age: 25 });
```

**Batch insert:**
```typescript
await UserModel.inserts([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);
```

**Update:**
```typescript
await UserModel.update({
  update: [{ key: 'name', value: 'New Name', operator: 'replace' }],
  where: [{ key: 'id', operator: '=', value: 1 }],
});
```

**Update with increment:**
```typescript
await UserModel.update({
  update: [{ key: 'balance', value: 100, operator: 'plus' }],
  where: [{ key: 'id', operator: '=', value: 1 }],
});
```

**Delete:**
```typescript
await UserModel.delete({
  where: [{ key: 'id', operator: '=', value: 1 }],
});
```

**Aggregation:**
```typescript
const stats = await UserModel.aggregate({
  aggregate: [
    { function: 'count', field: '*', name: 'total' },
    { function: 'avg', field: 'age', name: 'avg_age' },
  ],
  where: [{ key: 'status', value: 1 }],
});
```

### 4. Query Styles (choose ONE per project for consistency)

**Style A: Traditional array format (recommended for Onela)**
```typescript
where: [
  { key: 'status', operator: '=', value: 1, logic: 'and' },
  { key: 'name', operator: '%%', value: 'test', logic: 'and' },
]
```

**Style B: Operator functions**
```typescript
import { Op } from 'onela';
where: [
  Op.eq('status', 1),
  Op.like('name', 'test'),
  Op.gte('age', 18),
  Op.in('role', ['admin', 'editor']),
]
```

**Style C: Chain builder**
```typescript
import { createQueryBuilder } from 'onela';
const qb = createQueryBuilder(UserModel.configs);
const params = qb
  .select('id', 'name', 'email')
  .where('status', 1)
  .where('age', '>=', 18)
  .whereIn('role', ['admin', 'editor'])
  .orderBy('create_time', 'DESC')
  .page(1, 20)
  .build();
const users = await UserModel.findAll(params);
```

### 5. Transactions

```typescript
const trans = await UserModel.transaction();
try {
  await trans.begin();
  await UserModel.insert({ name: 'Alice' }, { transaction: trans });
  await OrderModel.insert({ user_id: 1, amount: 100 }, { transaction: trans });
  await trans.commit();
} catch (e) {
  await trans.rollback();
  throw e;
}
```

### 6. Condition Operators Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `=`      | Equals | `{ key: 'id', operator: '=', value: 1 }` |
| `>`      | Greater than | `{ key: 'age', operator: '>', value: 18 }` |
| `<`      | Less than | `{ key: 'age', operator: '<', value: 60 }` |
| `>=`     | Greater or equal | `{ key: 'age', operator: '>=', value: 18 }` |
| `<=`     | Less or equal | `{ key: 'age', operator: '<=', value: 60 }` |
| `<>`     | Not equal | `{ key: 'status', operator: '<>', value: 0 }` |
| `in`     | In set | `{ key: 'id', operator: 'in', value: [1,2,3] }` |
| `not in` | Not in set | `{ key: 'id', operator: 'not in', value: [4,5] }` |
| `%%`     | Full LIKE | `{ key: 'name', operator: '%%', value: 'test' }` → `LIKE '%test%'` |
| `%`      | Left LIKE | `{ key: 'name', operator: '%', value: 'test' }` → `LIKE '%test'` |
| `x%`     | Right LIKE | `{ key: 'name', operator: 'x%', value: 'test' }` → `LIKE 'test%'` |
| `between`| Range | `{ key: 'age', operator: 'between', value: [18, 60] }` |
| `is`     | IS NULL | `{ key: 'deleted_at', operator: 'is', value: null }` |
| `is not` | IS NOT NULL | `{ key: 'email', operator: 'is not', value: null }` |

## Critical Rules

1. **NEVER concatenate SQL strings.** Always use parameterized queries via the where array or Op functions.
2. **NEVER delete/update without WHERE conditions.** Onela enforces this by default.
3. **Always use `operator: 'replace'`** for simple value updates, `'plus'` for increment, `'reduce'` for decrement.
4. **Use batch operations** (`inserts()`) instead of looping `insert()`.
5. **All database-specific SQL must go through the dialect system** - never hardcode MySQL/PostgreSQL syntax.
6. **The `logic` field defaults to `'and'`** - only specify `logic: 'or'` when needed.
7. **The `engine` in model configs must match** an engine registered in `Onela.init()`.

## Build & Test

```bash
npm run build            # Compile TypeScript via Rollup
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

## Adding a New Database Dialect

1. Create dialect class extending `BaseDialect` in `src/dialect/`
2. Register it in `DialectFactory`
3. Create ActionManager extending `AbstractActionManager` in `src/instance/`
4. Add the type to `SupportedDatabaseType` in `src/types/onela.ts`
