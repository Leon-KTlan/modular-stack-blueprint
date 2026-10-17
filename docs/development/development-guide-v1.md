# 苍穹技术开发规范

- **文档版本**：V1.1
- **文档状态**：Draft
- **最后更新**：2026-10-16

## 1. 基本原则

### 1.1 业务逻辑后端中心化

客户端可以做交互校验和展示优化，但不能作为可信业务规则来源。

以下内容必须由后端重新计算或校验：

- 用户身份
- 用户角色和权限
- 价格和金额
- 资源所属关系
- 状态流转
- 租户或组织范围
- 重要操作条件

### 1.2 前端统一通过 SDK

禁止在业务组件中直接编写散落的 API URL 和 HTTP 调用：

```ts
// 不推荐
await fetch("/api/orders")
```

推荐：

```ts
await sdk.orders.list()
```

SDK 方法需要有明确的输入和输出类型。

### 1.3 模块按业务组织

优先使用：

```text
modules/users
modules/orders
modules/products
```

不建议把所有 Controller、Service、Repository 分别放到全局目录后再按文件名区分。业务模块规模变大后，应让相关代码尽可能在同一模块目录内聚集。

### 1.4 避免隐式全局依赖

业务模块不应通过任意全局变量读取数据库、当前用户或配置。依赖应通过构造函数、函数参数或明确的 Fastify 插件装饰器传入。

## 2. TypeScript 规范

- 开启 `strict`。
- 禁止无理由使用 `any`。
- 外部输入必须经过运行时校验后再进入业务层。
- 不用字符串代替有稳定语义的联合类型或枚举。
- DTO、Domain Model、数据库 Model 不要无脑复用。
- 异步函数明确返回 Promise 类型，公共方法需要标注返回类型。
- 业务错误使用自定义错误类或稳定错误码，不要直接 `throw new Error("xxx")` 作为可预期业务错误。

示例：

```ts
export type UserStatus = "active" | "disabled"

export interface DisableUserInput {
  operatorId: string
  userId: string
  reason?: string
}
```

## 3. Fastify 开发规范

### 3.1 Route 层

Route 负责：

- 定义路径和 HTTP 方法。
- 定义 TypeBox / JSON Schema。
- 读取认证上下文。
- 调用 Service。
- 返回 API 响应。

Route 不负责：

- 复杂业务流程。
- 直接拼接多张表的业务查询。
- 决定用户是否有权限的全部细节。
- 直接调用多个外部服务并处理复杂补偿。

### 3.2 插件注册

插件注册顺序建议：

```text
配置
→ 日志
→ 数据库
→ JWT Auth
→ 通用 Hooks
→ 业务模块
→ Admin 模块
→ 错误处理和关闭钩子
```

每个插件只负责一个清晰的能力或业务模块。

### 3.3 Hook 与权限

认证和权限建议分成两层：

```text
authenticate：确认当前请求对应已登录用户
requirePermission：确认当前用户具有指定权限
```

业务 Service 仍然需要校验资源级业务规则，例如不能禁用自己、不能操作其他组织的数据等。

### 3.4 密码和重置

- 密码必须通过 HTTPS 传输。
- 后端使用 Argon2id 和随机盐进行单向密码哈希，只保存密码哈希值。
- 登录时使用 Argon2id 验证函数比较密码。
- 禁止使用 MD5、SHA-1 或直接 SHA-256 存储密码。
- 管理员只能发起密码重置，不能读取用户密码或密码哈希。
- 密码重置后必须递增该用户的 `token_version`，使已有 JWT 失效。
- 密码重置必须记录操作人、目标用户、原因、时间和 `requestId`，审计日志不得包含密码或密码哈希。

## 4. 前端开发规范

### 4.1 数据状态和 UI 状态分离

服务端数据使用 TanStack Query 管理：

- 列表
- 详情
- 加载状态
- 请求错误
- 缓存和失效

客户端 UI 状态使用 Zustand 或组件状态管理：

- 侧边栏展开状态
- 弹窗状态
- 当前筛选条件
- 临时草稿

不要把所有 API 数据复制到全局 Store。

### 4.2 页面结构

推荐：

```text
pages/
├── UserListPage.tsx
├── UserDetailPage.tsx
└── UserEditPage.tsx

features/
└── users/
    ├── api.ts
    ├── hooks.ts
    ├── components/
    └── schemas.ts
```

一个页面不应承担所有请求、表单、表格、弹窗和业务计算。复杂页面应拆成 feature 模块。

### 4.3 错误处理

前端根据错误码做稳定分支：

```ts
if (error.code === "FORBIDDEN") {
  // 展示无权限页面
}
```

不要根据中文错误消息判断业务逻辑。

## 5. API 开发规范

### 5.1 URL

```text
/api/*          普通用户 API
/admin-api/*    管理后台 API
/internal/*     仅在确有内部 HTTP 调用需求时使用
```

资源路径使用复数名词：

```text
GET    /api/orders
GET    /api/orders/:id
POST   /api/orders
PATCH  /api/orders/:id
DELETE /api/orders/:id
```

状态操作使用明确动作：

```text
POST /admin-api/users/:id/disable
POST /admin-api/users/:id/password-reset
POST /admin-api/orders/:id/refund
```

### 5.2 分页

默认分页请求：

```json
{
  "page": 1,
  "pageSize": 10
}
```

默认分页响应：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

通用默认值为 `page=1`、`pageSize=10`，后端默认将 `pageSize` 限制在 `1–100`。具体接口可以收紧上限或固定每页条数，并在接口契约中注明。

### 5.3 API 响应

成功响应可以直接返回资源或分页对象；错误响应必须统一：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": {
      "field": "email"
    },
    "requestId": "req_xxx"
  }
}
```

### 5.4 兼容性

内部 SDK 和 API 同步迭代时，优先采用向后兼容方式：

- 新增字段，不随意删除旧字段。
- 新增响应字段不应破坏旧前端。
- 修改枚举值必须评估所有客户端。
- 删除 API 前先标记弃用并完成调用方迁移。
- 破坏性变更使用版本路径或明确迁移窗口。

## 6. 数据库开发规范

- PostgreSQL 是唯一的关系型业务数据库；业务模块不得自行引入第二套关系型数据库。
- 每次表结构变化都创建 migration。
- SQL migration 与 `apps/server/src/schema.ts` 必须同步维护字段、默认值、CHECK、索引和外键删除策略。
- 可复用的二元 `status`、`created_at`、`updated_at` 和可空 `deleted_at` 通过 `apps/server/src/schema-fields.ts` 管理；更新操作由 Service 或 Repository 显式刷新 `updated_at`。
- 软删除实体的普通列表、详情和关联查询必须显式过滤 `deleted_at IS NULL`；删除操作保留外键关系，并同时刷新 `updated_at`。
- 禁用与软删除必须使用不同语义：禁用可恢复且管理端可见，软删除默认不可见；重复软删除应幂等且不重复写审计。
- 社区主键和外键使用 PostgreSQL `BIGINT`；服务端内部使用 JavaScript `bigint`，API 路径和 JSON DTO 使用十进制字符串，禁止用 `Number(id)` 转换。
- 状态在数据库使用带 CHECK 约束的 `SMALLINT`，在 API 中转换为可读字符串枚举。
- migration 必须可在空数据库和已有数据库上执行。
- 大表变更需要评估锁表和发布时间。
- 写操作涉及多个资源时明确事务边界。
- 不在 Controller 中直接执行数据库查询。
- Repository 方法使用业务语义命名，避免到处暴露通用 `query` 方法。

推荐：

```ts
userRepository.findActiveById(userId)
userRepository.updateStatus(userId, "disabled")
```

不推荐：

```ts
repository.query("users", { where: ... })
```

## 7. 权限开发规范

增加管理功能时必须同步完成：

1. 定义权限编码。
2. 后端 route 增加权限校验。
3. Service 增加资源级业务校验。
4. 管理后台根据权限决定是否展示入口。
5. 重要修改写审计日志。
6. 为允许和拒绝两种情况增加测试。

权限编码示例：

```text
product.read
product.create
product.update
product.delete
```

## 8. 测试规范

### 8.1 单元测试

适合测试：

- 价格计算
- 状态流转
- 权限判断
- 参数转换
- 业务错误

### 8.2 API 集成测试

使用 Fastify `inject` 测试：

- 路由是否注册。
- Schema 是否生效。
- 认证和权限是否正确。
- 数据库交互是否符合预期。
- 错误结构是否稳定。

### 8.3 端到端测试

优先覆盖：

- 登录和退出。
- 用户完成一个核心业务闭环。
- 管理员查询和修改数据。
- 无权限用户访问管理功能。
- 关键状态流转。

## 9. 提交和代码评审

提交信息建议使用统一格式：

```text
feat: add user disable flow
fix: handle expired session
refactor: extract order service
chore: update database migration
```

Pull Request 至少说明：

- 变更目的。
- 影响的应用和模块。
- 数据库是否有 migration。
- 是否涉及权限。
- 是否需要环境变量。
- 已执行的测试命令。

## 10. 环境变量

环境变量按应用维护，不把密钥写入源码：

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=...
SESSION_SECRET=...
REDIS_URL=...
```

要求：

- 启动时校验必填环境变量。
- 提供 `.env.example`。
- `.env` 不提交到 Git。
- 生产环境通过部署平台或密钥管理系统注入。

## 11. 本地开发建议

推荐本地启动顺序：

```text
1. 启动 PostgreSQL
2. 执行数据库 migration
3. 启动 Fastify server
4. 启动 web
5. 启动 admin
```

本地开发应提供：

- Docker Compose 基础依赖。
- 数据库初始化和 seed 命令。
- 统一的 `dev`、`build`、`test`、`lint` 命令。
- API 健康检查接口，例如 `GET /health`。

## 12. 发布前检查清单

- [ ] TypeScript 构建通过。
- [ ] ESLint 和格式化检查通过。
- [ ] 单元测试通过。
- [ ] API 集成测试通过。
- [ ] 数据库 migration 已审查。
- [ ] 新增管理权限已定义并校验。
- [ ] 敏感日志已脱敏。
- [ ] 环境变量已配置。
- [ ] 关键页面无直接 HTTP 调用。
- [ ] 关键管理员操作已写入审计日志。
