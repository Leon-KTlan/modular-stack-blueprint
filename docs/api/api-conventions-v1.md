# 苍穹 API 与 SDK 约定

- **文档版本**：V1.0
- **文档状态**：Draft
- **最后更新**：2026-10-14

## 1. API 分区

| 前缀 | 使用方 | 权限要求 |
|---|---|---|
| `/api/*` | 用户前端 | 普通用户认证和业务权限 |
| `/admin-api/*` | 管理后台 | 管理员认证、角色和操作权限 |
| `/internal/*` | 内部任务或内部服务 | 仅在需要 HTTP 边界时使用 |

管理后台不绕过 API 直接连接数据库或调用后端内部函数。

## 2. SDK 分层

```text
packages/sdk/
├── http-client.ts
├── client-sdk.ts
├── admin-sdk.ts
├── errors.ts
└── index.ts
```

### 2.1 Base HTTP Client

统一处理：

- `baseURL`
- 请求方法
- Bearer Token 鉴权头
- 请求头
- JSON 序列化
- 超时
- 响应解析
- 错误码转换
- `requestId` 透传

### 2.2 Client SDK

提供普通用户业务接口：

```ts
sdk.auth.login(input)
sdk.auth.logout()
sdk.users.getCurrent()
sdk.orders.list(input)
sdk.orders.create(input)
```

### 2.3 Admin SDK

提供管理后台接口：

```ts
adminSdk.auth.getCurrentAdmin()
adminSdk.users.list(input)
adminSdk.users.update(userId, input)
adminSdk.users.disable(userId, input)
adminSdk.users.resetPassword(userId, input)
adminSdk.auditLogs.list(input)
```

## 3. 契约定义

API 输入、输出和枚举优先放在 `packages/api-contracts`：

```text
packages/api-contracts/
├── common.ts
├── auth.ts
├── users.ts
├── orders.ts
└── admin.ts
```

示例：

```ts
export type UserStatus = "active" | "disabled"

export interface UserSummary {
  id: string
  name: string
  status: UserStatus
  createdAt: string
}

export interface ListUsersInput {
  page?: number
  username?: string
}
```

后端仍然必须做运行时校验，不能因为前后端共享 TypeScript 类型而跳过校验。

## 4. HTTP 方法和资源命名

```text
GET    /api/orders              获取列表
GET    /api/orders/:id          获取详情
POST   /api/orders              创建资源
PATCH  /api/orders/:id          局部更新
DELETE /api/orders/:id          删除资源
```

状态操作使用动作接口：

```text
POST /admin-api/users/:id/disable
POST /admin-api/users/:id/enable
POST /admin-api/users/:id/password-reset
POST /admin-api/orders/:id/refund
```

## 5. 认证和请求上下文

SDK 通过统一的 Base HTTP Client 添加 Bearer Token：

```ts
fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
```

业务模块不自行读取或拼接 Token。登录接口签发 JWT；退出或管理员撤销令牌时，由认证实现按账号 `token_version` 等撤销机制使令牌失效。

后端请求上下文至少包含：

```ts
interface RequestContext {
  requestId: string
  userId?: string
  sessionId?: string
  roles: string[]
}
```

Base HTTP Client 统一负责 Token 的读取、附加和认证错误转换，不要让业务模块自行处理 Token。

## 6. 分页

输入：

```ts
interface PaginationInput {
  page?: number
  pageSize?: number
}
```

通用默认值为 `page=1`、`pageSize=10`；服务端必须限制 `pageSize` 最大值，默认上限为 `100`。接口可基于具体业务另行收紧上限或固定每页条数，并在接口契约中注明。

输出：

```ts
interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Paginated<T> {
  items: T[]
  pagination: PaginationMeta
}
```

当前后台用户列表固定每页返回 10 条，客户端不传 `pageSize`。用户名检索使用可选的 `username` 参数。该接口仅允许管理员访问，每次请求必须携带登录接口签发的 Bearer Token：

```http
GET /admin-api/users?page=1&username=demo HTTP/1.1
Authorization: Bearer <token>
```

未携带或使用无效 Token 返回 `401`，普通用户 Token 返回 `403`。

## 7. 错误处理

后端统一返回：

```ts
interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    requestId: string
  }
}
```

SDK 将其转换为稳定的错误对象：

```ts
class SdkError extends Error {
  code: string
  status: number
  requestId?: string
  details?: unknown
}
```

前端业务代码只依赖：

- `error.code`
- `error.status`
- `error.details`

不要依赖 `error.message` 作为逻辑判断条件。

## 8. API 版本和变更

V1 内部 API 默认不单独加版本号，但必须保持兼容性：

- 新增字段优先，不随意修改字段含义。
- 删除字段前先确认所有 SDK 调用方已经迁移。
- 修改枚举值需要同步检查前端分支。
- 破坏性变更时使用 `/api/v2` 或制定明确迁移方案。

## 9. API 文档和调试

Fastify 路由应维护完整 Schema，后续可生成 OpenAPI 文档。每个接口至少应描述：

- 请求方法和路径
- 身份认证要求
- 权限要求
- Path / Query / Body 参数
- 成功响应
- 业务错误码
- 分页规则

建议提供：

```text
GET /health
GET /docs（仅开发或受保护环境）
```

## 10. SDK 编写示例

```ts
export class UserApi {
  constructor(private readonly http: HttpClient) {}

  async getCurrent(): Promise<UserSummary> {
    return this.http.get("/me")
  }

  async list(input: ListUsersInput): Promise<Paginated<UserSummary>> {
    return this.http.get("/users", {
      query: input,
    })
  }
}
```

建议每个业务模块对应一个 API 类或 namespace，避免所有方法都塞在一个巨大 SDK 类中。
