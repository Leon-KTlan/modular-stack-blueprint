# 苍穹第一版技术方案

- **文档版本**：V1.0
- **文档状态**：Draft
- **适用范围**：用户端、管理后台、API 服务、SDK、数据库和基础工程
- **最后更新**：2026-10-14

## 1. 背景与目标

苍穹采用单体应用形态，包含：

1. 用户前端：负责面向普通用户的页面展示和交互。
2. 管理后台：负责运营、管理和审计操作。
3. 后端服务：负责业务规则、身份认证、权限校验、数据持久化和外部服务调用。
4. 内部 SDK：为用户前端和管理后台提供统一、类型安全的 API 调用方式。

### 1.1 建设目标

- 使用 TypeScript 统一前后端主要开发语言。
- 前端和管理后台不直接拼接 API 请求，统一通过 SDK 调用。
- 业务规则集中在后端，客户端不承担可信业务判断。
- 普通业务 API 和管理 API 在路由、权限和代码模块上保持边界清晰。
- 采用模块化单体，避免第一阶段引入微服务的部署和运维复杂度。
- 保留未来增加异步任务、缓存、多租户和开放 API 的扩展空间。

### 1.2 第一阶段非目标

以下内容不纳入 V1 的默认建设范围：

- 微服务拆分和独立服务治理
- 面向第三方开发者的公开 SDK
- 多语言 SDK 自动生成和发布
- 复杂 CQRS / Event Sourcing
- 多租户完整能力
- 复杂工作流引擎
- 独立 API Gateway

如果后续业务明确需要，应通过 ADR 评估后再引入。

## 2. 总体架构

```text
┌──────────────────────────────┐
│        用户前端 Web           │
│      React + TypeScript       │
└──────────────┬───────────────┘
               │ Client SDK
               ▼
┌──────────────────────────────┐
│       Fastify API 服务        │
│                              │
│  Auth / Permission / Error    │
│                              │
│  ┌────────────────────────┐  │
│  │ 用户与业务模块          │  │
│  │ Users / Orders / ...    │  │
│  ├────────────────────────┤  │
│  │ Admin API 模块          │  │
│  ├────────────────────────┤  │
│  │ Audit / Jobs / Files    │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
 PostgreSQL       Redis（按需）
```

管理后台使用同一个后端服务，但通过独立的 Admin API 访问：

```text
用户前端       → /api/*
管理后台       → /admin-api/*
内部任务接口   → /internal/*（只有确有需要时使用）
```

## 3. 技术选型

### 3.1 应用技术

| 层级 | 第一版选型 | 说明 |
|---|---|---|
| 用户前端 | React + TypeScript + Vite | 页面展示和用户交互 |
| 管理后台 | React + TypeScript + Vite | 管理和运营功能 |
| 路由 | React Router | 前端路由管理 |
| 服务端数据 | TanStack Query | 请求缓存、失效和加载状态管理 |
| 客户端本地状态 | Zustand | 仅用于认证态、UI 状态等客户端状态 |
| 后端 | Fastify + TypeScript | API 服务和插件化模块组织 |
| 请求/响应 Schema | TypeBox | 与 Fastify JSON Schema 机制结合 |
| 业务校验 | TypeBox；必要时补充 Zod | 复杂业务规则不能只依赖前端校验 |
| 数据库 | PostgreSQL | 关系型业务数据持久化 |
| ORM / Query Builder | Drizzle ORM | 类型安全、SQL 可控、适合模块化单体 |
| 缓存 / 队列 | Redis，按需启用 | 第一阶段不为缓存而引入，出现明确场景再启用 |
| 测试 | Vitest + Fastify inject | 单元测试和 API 集成测试 |
| 浏览器测试 | Playwright，按需启用 | 关键用户流程和后台流程 |
| 包管理 | pnpm workspace | 管理多应用和共享包 |
| 构建编排 | 第一阶段可不引入；规模变大后使用 Turborepo | 避免过早增加工程复杂度 |

### 3.2 认证方式

第一版 Web 应用默认采用：

```text
HttpOnly Cookie + 服务端 Session
```

原因：

- 用户前端和管理后台都是 Web 应用。
- 不需要让 JavaScript 直接持有长期 Token。
- 退出、失效、踢出设备和管理员会话控制更直接。
- 如果前后端同域部署，Cookie 处理更简单。

必须配置：

- `HttpOnly`
- 生产环境 `Secure`
- 合适的 `SameSite`
- CSRF 防护
- 登录限流
- Session 过期和撤销机制
- 管理员敏感操作的二次确认或二次认证（按业务风险启用）

如果未来出现移动端、开放 API 或跨域第三方客户端，再评估 Access Token + Refresh Token。

### 3.3 权限模型

第一版采用 RBAC：

```text
User → Role → Permission
```

权限使用稳定的资源和动作编码：

```text
user.read
user.update
user.disable
order.read
order.refund
audit.read
```

权限必须在后端强制校验。前端隐藏按钮只属于展示优化，不属于安全控制。

## 4. Monorepo 目录规划

```text
project/
├── apps/
│   ├── web/                         # 用户前端
│   ├── admin/                       # 管理后台
│   └── server/                      # Fastify 服务
│       └── src/
│           ├── app.ts               # 创建并组装 Fastify 实例
│           ├── server.ts            # 启动进程
│           ├── plugins/             # 基础设施插件
│           │   ├── database.ts
│           │   ├── auth.ts
│           │   ├── logger.ts
│           │   └── error-handler.ts
│           ├── modules/              # 按业务模块组织
│           │   ├── auth/
│           │   ├── users/
│           │   ├── orders/
│           │   └── admin/
│           └── shared/               # 服务端共享能力
│               ├── errors/
│               ├── permissions/
│               └── pagination/
│
├── packages/
│   ├── api-contracts/                # 请求、响应、枚举和错误契约
│   ├── sdk/                          # Client SDK 与 Admin SDK
│   ├── ui/                           # 可选，共享 UI 组件
│   ├── config/                       # 共享 TypeScript / ESLint 配置
│   └── utils/                        # 与业务无关的工具
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 4.1 依赖方向

```text
api-contracts 是基础层
sdk 依赖 api-contracts
web / admin 依赖 sdk
server 依赖 api-contracts
```

避免以下依赖：

```text
web → server 源码
admin → server 源码
server → sdk
前端 → ORM / 数据库模型
```

共享 API 契约，不共享数据库 Repository、后端 Service 或 ORM Model。

## 5. 后端模块结构

每个业务模块建议保持自包含：

```text
modules/users/
├── index.ts              # Fastify 插件入口
├── user.routes.ts        # 路由和 Fastify Schema
├── user.service.ts       # 业务用例
├── user.repository.ts    # 数据库访问
├── user.schema.ts        # 输入输出 Schema
├── user.types.ts         # 模块内部类型
└── user.errors.ts        # 模块错误
```

典型调用链：

```text
Route / Controller
        ↓
Application Service
        ↓
Domain Rule
        ↓
Repository
        ↓
Database
```

Route 层负责：

- 接收请求
- 参数和请求体校验
- 获取当前用户
- 调用业务 Service
- 返回标准响应

Service 层负责：

- 业务流程编排
- 业务规则
- 事务边界
- 调用 Repository 和外部服务
- 记录审计和发布异步任务

Repository 层负责：

- 查询和更新数据库
- 数据库事务中使用的底层操作
- 不承载用户权限和复杂业务流程

## 6. Fastify 组装方式

Fastify 使用插件机制组织公共能力和业务模块：

```ts
await app.register(databasePlugin)
await app.register(authPlugin)
await app.register(userPlugin, { prefix: "/api/users" })
await app.register(orderPlugin, { prefix: "/api/orders" })
await app.register(adminPlugin, { prefix: "/admin-api" })
```

适合挂载到 Fastify 实例的内容：

- 数据库连接
- 日志
- 认证工具
- 权限检查工具
- 统一错误处理
- 请求上下文

不建议把所有业务 Service 都挂到 Fastify 实例上。业务依赖应由模块明确创建或注入，避免形成全局服务容器。

## 7. SDK 设计

SDK 只供项目内部前端使用，不作为对外发布的公共 SDK。

建议提供两个入口：

```text
BaseHttpClient
├── ClientSdk
└── AdminSdk
```

使用示例：

```ts
const sdk = createClientSdk({
  baseURL: "/api",
})

const currentUser = await sdk.users.getCurrent()
const orders = await sdk.orders.list({
  page: 1,
  pageSize: 20,
})
```

```ts
const adminSdk = createAdminSdk({
  baseURL: "/admin-api",
})

await adminSdk.users.disable(userId)
```

SDK 统一负责：

- HTTP 请求
- Cookie / 鉴权头处理
- JSON 序列化和反序列化
- 标准错误转换
- 分页参数
- 文件上传
- 请求超时和必要的重试

前端组件中不直接出现散落的 `fetch`、`axios` 或 URL 字符串。

## 8. 数据库设计原则

第一版数据库规范：

- 所有表使用稳定的主键。
- 统一记录 `created_at`、`updated_at`。
- 删除行为根据业务选择软删除或显式状态，不能默认混用。
- 需要追踪操作人的数据增加 `created_by`、`updated_by`。
- 管理操作写入审计日志。
- 多表写操作明确事务边界。
- 分页接口默认限制 `pageSize` 上限，避免无界查询。
- 所有数据库变更通过 migration 管理，禁止手工修改生产表结构。

如果未来确定支持多租户，应在数据模型和请求上下文中统一引入 `tenant_id`，不能只在部分业务表中补充。

## 9. 统一错误处理

API 错误结构采用统一格式：

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "用户不存在",
    "details": null,
    "requestId": "req_xxx"
  }
}
```

建议错误分类：

```text
VALIDATION_ERROR       请求参数不合法
UNAUTHORIZED           未登录
FORBIDDEN              无权限
NOT_FOUND              资源不存在
CONFLICT               状态冲突或重复数据
BUSINESS_ERROR         可预期业务错误
INTERNAL_ERROR         未预期服务端错误
```

客户端只依赖稳定的 `code`，不要依赖后端 `message` 做业务分支。

## 10. 日志、审计和可观测性

第一版至少具备：

- 每个请求生成 `requestId`。
- 记录请求耗时、状态码和错误码。
- 生产环境不记录密码、Token、完整 Cookie 和敏感个人信息。
- 管理员的增删改、状态变更、导出等操作写入审计日志。
- 统一记录服务启动失败、数据库连接失败和未处理异常。

审计日志至少包含：

```text
operatorId
operatorRole
action
resourceType
resourceId
before
 after
reason
ip
userAgent
createdAt
```

其中 `before` 和 `after` 是否记录完整数据，需要按照敏感字段要求做脱敏。

## 11. 部署形态

第一版可以采用单体部署：

```text
反向代理 / CDN
        ↓
Web 静态资源 + Admin 静态资源
        ↓
Fastify Server
        ├── PostgreSQL
        └── Redis（按需）
```

生产环境建议：

- Web 和 Admin 构建为静态资源。
- Fastify 服务单独运行。
- 数据库迁移作为发布流程的一部分执行。
- 密钥和数据库连接信息通过环境变量注入。
- 不把 `.env` 提交到 Git。
- 生产日志输出结构化 JSON。

## 12. 第一阶段实施顺序

### Phase 0：工程初始化

- 初始化 pnpm workspace。
- 创建 `web`、`admin`、`server` 三个应用。
- 创建 `api-contracts` 和 `sdk` 两个共享包。
- 配置 TypeScript、ESLint、Prettier、Git hooks。
- 建立本地 PostgreSQL 和 Docker Compose 配置。

### Phase 1：基础平台

- Fastify 启动和关闭流程。
- 数据库连接与 migration。
- 统一错误处理。
- 请求日志和 requestId。
- Session 登录、退出和当前用户接口。
- 基础 RBAC 模型。

### Phase 2：第一个业务闭环

选定一个核心业务模块，完整实现：

```text
数据库表
→ Repository
→ Service
→ API Route
→ API Contract
→ SDK 方法
→ 用户端页面
→ 管理后台页面
→ 测试
```

不要在没有完成一个闭环前同时铺开所有业务模块。

### Phase 3：管理能力

- 管理员登录。
- 用户或核心业务数据列表。
- 查看、编辑、状态变更。
- 权限配置。
- 审计日志查询。

### Phase 4：质量和发布

- 关键 Service 单元测试。
- API 集成测试。
- 关键用户流程测试。
- 数据库备份和恢复演练。
- 生产配置和部署流程。

## 13. 需要后续确认的事项

以下内容暂不阻塞工程初始化，但需要在第一个业务模块开始前确认：

1. 第一个核心业务模块是什么。
2. 用户登录方式：账号密码、手机号、第三方登录或组合方式。
3. 用户前端和管理后台是否同域部署。
4. 是否存在组织、团队或租户概念。
5. 文件上传是否属于第一阶段范围。
6. 是否需要异步任务、邮件、短信或第三方支付。
7. 是否有必须满足的审计、合规或数据保留要求。
