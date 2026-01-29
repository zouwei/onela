# Changelog

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
