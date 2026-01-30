# Onela ORM Framework 文档中心

## 📚 文档目录

### 用户指南
- [快速开始](./guide/getting-started.md) - 5 分钟上手 Onela
- [配置说明](./guide/configuration.md) - 详细配置选项
- [查询模式](./guide/query-modes.md) - 五种查询模式详解
- [事务处理](./guide/transactions.md) - 事务使用指南
- [读写分离](./guide/read-write-split.md) - 读写分离和负载均衡

### API 文档
- [核心 API](./api/core.md) - Onela 和 OnelaBaseModel
- [查询构建器](./api/query-builder.md) - QueryBuilder API
- [操作符](./api/operators.md) - 查询操作符
- [方言系统](./api/dialect.md) - SQL 方言接口
- [连接路由](./api/router.md) - ConnectionRouter API
- [安全模块](./api/security.md) - SQL 注入防护
- [日志系统](./api/logger.md) - Logger API

### 测试文档
- [测试指南](./test/testing-guide.md) - 如何运行测试
- [测试环境](./test/test-environment.md) - Docker 测试环境配置

### AI 规则
- [开发规范](./ai-rules/development-rules.md) - 开发规范和最佳实践
- [代码风格](./ai-rules/code-style.md) - 代码风格指南
- [架构设计](./ai-rules/architecture.md) - 架构设计原则

## 🗂️ 项目结构

```
src/
├── index.ts              # 主入口
├── interfaces/           # 接口定义
│   └── IActionManager.ts
├── abstract/             # 抽象基类
│   └── AbstractActionManager.ts
├── dialect/              # SQL 方言系统
│   ├── IDialect.ts
│   ├── BaseDialect.ts
│   ├── MySQLDialect.ts
│   ├── PostgreSQLDialect.ts
│   ├── SQLiteDialect.ts
│   ├── SQLServerDialect.ts
│   ├── OracleDialect.ts
│   └── DialectFactory.ts
├── builders/             # SQL 构建器
│   └── SQLBuilder.ts
├── query/                # 查询模块
│   ├── QueryBuilder.ts
│   ├── operators/
│   │   └── index.ts
│   └── parsers/
│       ├── SimpleWhereParser.ts
│       └── LegacyParser.ts
├── router/               # 连接路由
│   └── ConnectionRouter.ts
├── security/             # 安全模块
│   └── SQLInjectionPrevention.ts
├── logger/               # 日志系统
│   └── Logger.ts
├── instance/             # 数据库适配器
│   ├── MySQLActionManager.ts
│   ├── PostgreSQLActionManager.ts
│   ├── SQLiteActionManager.ts
│   └── SQLServerActionManager.ts
└── types/                # 类型定义
    └── onela.ts
```

## 📊 支持的数据库

| 数据库 | 版本 | 状态 |
|--------|------|------|
| MySQL | 5.7+, 8.0+ | ✅ 完全支持 |
| MariaDB | 10.x+ | ✅ 完全支持 |
| TiDB | Latest | ✅ MySQL 兼容 |
| PostgreSQL | 10+ | ✅ 完全支持 |
| SQLite | 3.x | ✅ 完全支持 |
| SQL Server | 2012+ | ✅ 完全支持 |
| Oracle | 11g+ | ✅ 基本支持 |
| OceanBase | MySQL 模式 | ✅ MySQL 兼容 |
| PolarDB | MySQL 兼容 | ✅ MySQL 兼容 |

## 🔧 版本历史

### v3.2.0 (当前)
- 新增：方言系统支持多种数据库
- 新增：五种查询模式
- 新增：连接路由和热切换
- 新增：SQL 注入防护
- 新增：可插拔日志系统
- 优化：代码重构减少 80% 重复

### v3.1.2
- 修复：PostgreSQL 问题
- 修复：小修复

## 📝 许可证

GPL-3.0-only
