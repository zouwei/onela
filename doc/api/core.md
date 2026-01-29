# 核心 API 文档

## Onela 类

Onela 是框架的核心类，负责管理数据库连接。

### 静态方法

#### init(config_list, options?)

初始化数据库连接。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config_list | DatabaseConfig[] | 是 | 数据库配置列表 |
| options.useV2 | boolean | 否 | 是否使用 V2 适配器 |

**DatabaseConfig 结构：**

```typescript
interface DatabaseConfig {
  type: 'mysql' | 'mariadb' | 'tidb' | 'postgresql' | 'sqlite' | 'sqlserver' | 'oracle';
  engine: string;      // 引擎标识
  value: any;          // 连接配置
  role?: 'master' | 'slave';  // 节点角色
  weight?: number;     // 权重
}
```

**示例：**

```typescript
Onela.init([
  {
    engine: 'default',
    type: 'mysql',
    value: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'mydb',
      connectionLimit: 10,
    },
  },
  {
    engine: 'readonly',
    type: 'mysql',
    role: 'slave',
    value: {
      host: 'slave.localhost',
      user: 'readonly',
      password: 'password',
      database: 'mydb',
    },
  },
]);
```

#### getActionManager(engine)

获取指定引擎的 ActionManager 实例。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| engine | string | 是 | 引擎标识 |

**返回：** `Promise<ActionManager>`

**示例：**

```typescript
const am = await Onela.getActionManager('default');
```

#### getActionTransaction(engine)

获取事务实例（自动开启）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| engine | string | 是 | 引擎标识 |

**返回：** `Promise<Transaction>`

---

## OnelaBaseModel 类

所有模型的基类，提供 CRUD 操作。

### 静态属性

#### configs

模型配置，子类必须定义。

```typescript
interface Configs {
  engine: string;        // 引擎标识
  tableName: string;     // 表名
  fields?: FieldConfig[]; // 字段配置
}

interface FieldConfig {
  name: string;          // 字段名
  type: string;          // 字段类型
  default?: any;         // 默认值或生成函数
  primary?: boolean;     // 是否主键
  increment?: boolean;   // 是否自增
  comment?: string;      // 注释
}
```

### 静态方法

#### findOne(args, option?)

查询单条记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| args | QueryParams | 是 | 查询参数 |
| option | QueryOption | 否 | 查询选项 |

**返回：** `Promise<any | null>`

**示例：**

```typescript
const user = await User.findOne({
  where: [{ key: 'id', operator: '=', value: 1 }],
});
```

#### findAll(args, option?)

查询所有符合条件的记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| args | QueryParams | 是 | 查询参数 |
| option | QueryOption | 否 | 查询选项 |

**返回：** `Promise<any[]>`

**QueryParams 结构：**

```typescript
interface QueryParams {
  select?: string[];                      // 查询字段
  where?: KeywordItem[];                  // 查询条件
  keyword?: KeywordItem[];                // 同 where（兼容）
  orderBy?: Record<string, 'ASC' | 'DESC'>; // 排序
  groupBy?: string[];                     // 分组
  limit?: [number, number];               // [offset, limit]
}

interface KeywordItem {
  key: string;           // 字段名
  value: any;            // 条件值
  operator?: string;     // 操作符（默认 '='）
  logic?: 'and' | 'or';  // 逻辑运算符（默认 'and'）
}
```

**支持的操作符：**

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `=` | 等于 | `{ key: 'status', value: 1 }` |
| `>` | 大于 | `{ key: 'age', operator: '>', value: 18 }` |
| `<` | 小于 | `{ key: 'age', operator: '<', value: 60 }` |
| `>=` | 大于等于 | `{ key: 'age', operator: '>=', value: 18 }` |
| `<=` | 小于等于 | `{ key: 'age', operator: '<=', value: 60 }` |
| `<>` | 不等于 | `{ key: 'status', operator: '<>', value: 0 }` |
| `in` | 在列表中 | `{ key: 'id', operator: 'in', value: [1,2,3] }` |
| `not in` | 不在列表中 | `{ key: 'id', operator: 'not in', value: [1,2,3] }` |
| `%` | 左模糊 | `{ key: 'name', operator: '%', value: '张' }` |
| `x%` | 右模糊 | `{ key: 'name', operator: 'x%', value: '张' }` |
| `%%` | 全模糊 | `{ key: 'name', operator: '%%', value: '张' }` |
| `is` | IS (NULL) | `{ key: 'deleted_at', operator: 'is', value: 'NULL' }` |
| `between` | 范围 | `{ key: 'age', operator: 'between', value: [18, 60] }` |

#### findList(args, option?)

分页查询（带总数）。

**返回：** `Promise<{ data: any[]; recordsTotal: number }>`

**示例：**

```typescript
const { data, recordsTotal } = await User.findList({
  where: [{ key: 'status', value: 1 }],
  limit: [0, 10],
});
// data: 当前页数据
// recordsTotal: 总记录数
```

#### find(args, option?)

瀑布流查询。

**返回：** `Promise<{ data: any[]; isLastPage: boolean }>`

**示例：**

```typescript
const { data, isLastPage } = await User.find({
  where: [{ key: 'status', value: 1 }],
  orderBy: { id: 'DESC' },
  limit: [lastId, 10],
});
```

#### insert(args, option?)

插入单条记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| args | object | 是 | 插入数据 |
| option | QueryOption | 否 | 查询选项 |

**返回：** `Promise<{ insertId: number; ...data }>`

**示例：**

```typescript
const result = await User.insert({
  name: '张三',
  email: 'zhangsan@example.com',
});
console.log(result.insertId); // 新记录 ID
```

#### inserts(entity_list, option?)

批量插入。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| entity_list | object[] | 是 | 插入数据列表 |
| option | QueryOption | 否 | 查询选项 |

**返回：** `Promise<{ affectedRows: number }>`

#### update(args, option?)

更新记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| args | UpdateParams | 是 | 更新参数 |
| option | QueryOption | 否 | 查询选项 |

**UpdateParams 结构：**

```typescript
interface UpdateParams extends QueryParams {
  update: UpdateFieldItem[];
}

interface UpdateFieldItem {
  key: string;                           // 字段名
  value?: any;                           // 更新值
  operator?: 'replace' | 'plus' | 'reduce'; // 操作类型
  case_field?: string;                   // CASE WHEN 字段
  case_item?: UpdateCaseItem[];          // CASE WHEN 项
}
```

**示例：**

```typescript
// 普通更新
await User.update({
  update: [
    { key: 'name', value: '新名字', operator: 'replace' },
  ],
  where: [{ key: 'id', value: 1 }],
});

// 数值增减
await User.update({
  update: [
    { key: 'balance', value: 100, operator: 'plus' },
  ],
  where: [{ key: 'id', value: 1 }],
});

// CASE WHEN 批量更新
await User.update({
  update: [
    {
      key: 'status',
      case_field: 'id',
      case_item: [
        { case_value: 1, value: 'active' },
        { case_value: 2, value: 'inactive' },
      ],
    },
  ],
  where: [{ key: 'id', operator: 'in', value: [1, 2] }],
});
```

#### delete(args, option?)

删除记录。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| args | DeleteParams | 是 | 删除参数 |
| option | QueryOption | 否 | 查询选项 |

**注意：** 必须提供 where 条件，防止全表删除。

**示例：**

```typescript
await User.delete({
  where: [{ key: 'id', value: 1 }],
});
```

#### aggregate(args, option?)

聚合查询。

**AggregateItem 结构：**

```typescript
interface AggregateItem {
  function: 'count' | 'sum' | 'max' | 'min' | 'avg' | 'abs';
  field: string;
  name: string;  // 结果别名
}
```

**示例：**

```typescript
const result = await User.aggregate({
  aggregate: [
    { function: 'count', field: '*', name: 'total' },
    { function: 'sum', field: 'balance', name: 'total_balance' },
    { function: 'avg', field: 'age', name: 'avg_age' },
  ],
  where: [{ key: 'status', value: 1 }],
});
// result: [{ total: 100, total_balance: 50000, avg_age: 28.5 }]
```

#### transaction()

获取事务实例。

**返回：** `Promise<Transaction>`

**Transaction 接口：**

```typescript
interface Transaction {
  client: any;             // 原生连接
  begin(): Promise<void>;  // 开始事务
  commit(): Promise<string>;  // 提交事务
  rollback(): Promise<string>; // 回滚事务
}
```

**示例：**

```typescript
const t = await User.transaction();

try {
  await User.insert({ name: '用户1' }, { transaction: t });
  await User.insert({ name: '用户2' }, { transaction: t });
  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

#### sql(sql, parameters?, option?)

执行原生 SQL。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sql | string | 是 | SQL 语句 |
| parameters | any[] | 否 | 参数 |
| option | QueryOption | 否 | 查询选项 |

**警告：** 使用原生 SQL 时要注意 SQL 注入风险。

**示例：**

```typescript
const result = await User.sql(
  'SELECT * FROM users WHERE age > ? AND status = ?',
  [18, 1]
);
```
