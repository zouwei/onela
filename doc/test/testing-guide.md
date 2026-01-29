# 测试指南

本文档介绍如何为 Onela ORM 运行测试。

## 测试类型

### 1. 单元测试

不需要数据库连接，测试单个模块的功能。

```bash
npm test -- --testPathPattern=unit
```

**测试内容：**
- SQL 构建器
- 方言系统
- 查询操作符
- 简单 WHERE 解析器
- SQL 注入防护
- 日志系统

### 2. 集成测试

需要数据库连接，测试完整的数据库操作。

```bash
npm test -- --testPathPattern=integration
```

**测试内容：**
- 数据库连接
- CRUD 操作
- 事务处理
- 连接路由

## 测试环境设置

### Docker 环境

使用 Docker Compose 启动测试数据库：

```bash
cd docker
docker compose up -d
```

**可用数据库：**

| 服务 | 端口 | 用户名 | 密码 | 数据库 |
|------|------|--------|------|--------|
| MySQL | 3306 | test | test123 | onela_test |
| PostgreSQL | 5432 | test | test123 | onela_test |
| MariaDB | 3307 | test | test123 | onela_test |
| SQL Server | 1433 | sa | Test@123456 | onela_test |
| Oracle XE | 1521 | test | test123 | XE |
| TiDB | 4000 | root | (无) | onela_test |

### 检查数据库状态

```bash
docker compose ps
```

### 查看数据库日志

```bash
docker compose logs -f mysql
docker compose logs -f postgresql
```

## 运行测试

### 全部测试

```bash
npm test
```

### 指定测试文件

```bash
npm test -- tests/unit/SQLBuilder.test.ts
```

### 监听模式

```bash
npm test -- --watch
```

### 覆盖率报告

```bash
npm test -- --coverage
```

## 编写测试

### 单元测试示例

```typescript
import { SQLBuilder, createSQLBuilder } from '../../src/builders/SQLBuilder.js';

describe('SQLBuilder', () => {
  let builder: SQLBuilder;

  beforeEach(() => {
    builder = createSQLBuilder('mysql');
  });

  test('should build SELECT query', () => {
    const result = builder.buildSelect({
      configs: { tableName: 'users', engine: 'default' },
      command: { tableName: 'users' },
      select: ['id', 'name'],
    });

    expect(result.sql).toContain('SELECT id, name');
    expect(result.sql).toContain('FROM users');
  });
});
```

### 集成测试示例

```typescript
import { Onela, OnelaBaseModel } from '../../src/index.js';

describe('Database Integration', () => {
  beforeAll(async () => {
    Onela.init([{
      engine: 'test',
      type: 'mysql',
      value: {
        host: 'localhost',
        user: 'test',
        password: 'test123',
        database: 'onela_test',
      },
    }]);
  });

  test('should insert and query', async () => {
    class TestModel extends OnelaBaseModel {
      static configs = {
        engine: 'test',
        tableName: 'test_table',
        fields: [
          { name: 'id', type: 'int', increment: true },
          { name: 'name', type: 'varchar', default: '' },
        ],
      };
    }

    const result = await TestModel.insert({ name: 'test' });
    expect(result.insertId).toBeDefined();

    const found = await TestModel.findOne({
      where: [{ key: 'id', value: result.insertId }],
    });
    expect(found.name).toBe('test');
  });
});
```

## 测试数据初始化

测试数据库初始化脚本位于 `docker/init/` 目录：

- `mysql/01-init.sql` - MySQL 初始化
- `postgresql/01-init.sql` - PostgreSQL 初始化

### 测试表结构

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    age INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    category VARCHAR(50),
    is_active TINYINT DEFAULT 1
);
```

## 故障排除

### 连接超时

检查 Docker 容器是否正常运行：

```bash
docker compose ps
```

### 权限问题

确保测试用户有足够权限：

```sql
GRANT ALL PRIVILEGES ON onela_test.* TO 'test'@'%';
FLUSH PRIVILEGES;
```

### 端口冲突

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "13306:3306"  # 使用不同端口
```
