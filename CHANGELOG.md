# Changelog

## [4.0.0] - 2026-01-30

### ⚠ BREAKING CHANGES

- **构建入口切换至 V2** - `rollup.config.js` 入口从 `src/index.ts` 切换为 `src/index.v2.ts`，完整导出 V2 架构所有模块
- **V1 代码路径标记 @deprecated** - 所有 V1 ActionManager（MySQLActionManager / PostgreSQLActionManager / SQLServerActionManager / SQLiteActionManager）及 OFInstance 已标记为废弃，将在 v5.0 移除
- **format 属性收紧** - `format` 属性正则从 `/^[a-zA-Z0-9_(). +\-*/]+$/` 收紧为 `/^[a-zA-Z0-9_.]+$/`，不再允许括号、空格和算术运算符
- **$raw 操作符禁用** - SimpleWhereParser 中的 `$raw` 操作符已禁用并抛出异常

### Security (安全加固)

#### P1 - 关键路径校验
- **tableName 校验** - 所有 V1 ActionManager 和 OFInstance 的 CRUD 方法均对 `params.configs.tableName` 进行 `validateIdentifier()` 校验，防止 SQL 注入
- **aggregate field/name 校验** - 聚合函数的 `field` 和 `name` 参数均通过 `validateIdentifier()` 校验
- **INSERT 字段名校验** - INSERT/INSERTS 方法中的字段名（key）通过 `validateIdentifier()` 校验
- **SELECT 字段校验** - 四个语法文件（mysql.ts / postgresql.ts / sqlite.ts / sqlserver.ts）的 `getParameters()` 中 SELECT 字段均通过 `validateIdentifier()` 校验

#### P2 - 中等优先级
- **format 属性收紧** - SQLBuilder 和 postgresql.ts 中的 format 正则表达式收紧为仅允许字母数字下划线点号，并标记 @deprecated
- **proc_name 校验** - OFInstance 的 `call()` 方法对存储过程名进行校验
- **SubqueryBuilder 标识符正则修正** - 正则从 `^[a-zA-Z0-9_*]` 改为 `^[a-zA-Z_*]`，禁止数字开头的标识符

#### P3 - 低优先级
- **console.log 数据泄露清理** - 移除 PostgreSQLActionManager 中的 INSERT/UPDATE/查询数据日志输出
- **DDLBuilder engine/charset/collation 校验** - 新增 `/^[a-zA-Z][a-zA-Z0-9_]*$/` 校验
- **测试文档凭据清理** - testing-guide.md 中的硬编码密码替换为环境变量引用

### Fixed

- **PostgreSQL IN 操作符 Bug** - 修复 postgresql.ts 中 `for (const _ of item.value)` 错误迭代（将数组元素当作索引），改为 `for (let i = 0; i < item.value.length; i++)` 正确遍历，影响 getParameters / getUpdateParameters / getDeleteParameters 三个函数
- **IS/IS NOT 操作符白名单** - 仅允许 NULL 值，防止绕过

### Changed

- **构建入口** - Rollup 入口从 `src/index.ts` 切换为 `src/index.v2.ts`
- **外部依赖** - Rollup external 新增 `better-sqlite3`
- **版本号** - 升级至 4.0.0

---

## [3.2.0] - 2026-01-29

### Added

#### ORM 核心稳定性 (P0)
- **SQLite V2 Adapter** (`SQLiteActionManagerV2`) - 基于 AbstractActionManager 模板方法的 SQLite 适配器
- **SQL Server V2 Adapter** (`SQLServerActionManagerV2`) - 基于 AbstractActionManager 的 SQL Server 适配器
- **Oracle V2 Adapter** (`OracleActionManagerV2`) - Oracle 数据库支持，使用 oracledb 驱动
- **V1/V2 切换修复** - 所有数据库类型现在都支持 V1/V2 适配器切换

#### Schema 能力 (P1)
- **DDLBuilder** - 数据定义语言构建器，支持 CREATE TABLE / ALTER TABLE / DROP TABLE，跨数据库类型映射
- **SchemaIntrospector** - 数据库结构自省，跨数据库获取表结构、列信息
- **MigrationRunner** - Schema 迁移运行器，支持 up/down 迁移、版本追踪
- **DynamicModelRegistry** - 运行时动态 Model 注册，适用于 AI 场景下的动态表管理

#### 安全增强 (P2)
- **OperationGuard** - 操作白名单守卫，控制表级别 CRUD 权限
- **AuditLogger** - 操作审计日志，支持内存存储和自定义存储后端
- **RowLimiter** - 行级操作限制，防止误操作影响过多行
- **FieldAccessControl** - 字段级访问控制，敏感数据保护

#### 高级查询 (P3)
- **JoinBuilder** - JOIN 查询构建器，支持 INNER / LEFT / RIGHT / CROSS / FULL OUTER JOIN
- **SubqueryBuilder** - 子查询构建器，支持 IN / NOT IN / EXISTS / NOT EXISTS / 标量子查询
- **MetadataQuery** - 数据库元数据查询，跨数据库获取版本、大小、索引、外键信息
- **least-connections 路由策略** - ConnectionRouter 完整实现最少连接路由

#### 生态完善 (P4)
- **OnelaError** - 统一错误系统，结构化错误码 (1xxx-9xxx)，可重试判断
- **ConnectionRouter 状态增强** - 节点详情、活跃连接计数、连接获取/释放接口
- **TypeScript 类型导出** - 完整的模块级类型导出

### Changed
- 版本号升级至 3.2.0
- package.json keywords 增加 Oracle / MariaDB / TiDB / hot-switch / ai-friendly

## [3.1.2-beta.2] - Previous

- 基础 ORM 功能
- MySQL / PostgreSQL / SQLite / SQL Server 支持
- V1 ActionManager 适配器
- 方言系统、SQL 构建器、查询模块
- 连接路由器、SQL 注入防护、日志模块
