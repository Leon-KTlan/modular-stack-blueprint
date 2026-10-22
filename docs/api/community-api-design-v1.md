# 社区模块接口设计

- **文档版本**：V1.0
- **文档状态**：Design Record
- **最后更新**：2026-10-22
- **当前实现状态**：后台账号、小程序用户管理、圈子/分类管理，以及帖子、点赞、评论接口和帖子/评论管理后台已实现；小程序微信登录与令牌签发已实现；圈子用户端接口、昵称修改与媒体上传尚未实现

## 1. 接口边界

```text
/admin-api/*          管理后台接口，只接受后台账号 JWT
/api/miniapp/*        微信小程序接口，只接受小程序用户 JWT
```

后台账号来自现有 `users`，小程序身份来自 `miniapp_users`。两类令牌使用不同的签名密钥与身份类型，不能互相访问接口。服务端已实现小程序微信登录、JWT 签发和 Bearer JWT 校验，使用 `MINIAPP_JWT_SECRET`；未配置该密钥时受保护小程序业务路由返回 `503 MINIAPP_AUTH_NOT_CONFIGURED`。

## 2. 通用约定

- `miniapp_users`、`circles` 和其他社区实体 ID 在 URL 与 JSON 中均使用十进制字符串；第 3 节现有 `users` 账户接口沿用 JSON number。
- 时间使用 ISO 8601 UTC 字符串。
- 现有后台账户 API 的 `status` 使用数字 `0 | 1`；新社区 API 的小程序用户状态 DTO 使用 `active | disabled`。
- 分页响应沿用 `docs/api/api-conventions-v1.md` 的 `items + pagination`。
- 目标错误响应结构为 `error.code`、`error.message` 和 `requestId`。目前已实现的后台账户路由错误响应只保证 `error.code` 和 `error.message`，尚未统一附带 `requestId`。
- API 不返回完整 `openid`、`unionid` 或 `session_key`。

## 3. 后台账户管理接口（现有）

本节描述基于 `users` 表的用户名/密码账户。`role=1` 为管理员，只有管理员可以访问 `/admin-api/*`；小程序微信身份使用独立的 `miniapp_users` 表和本文件第 5 节接口。

本节中的账户状态请求和响应使用数据库枚举数字：`1` 表示启用、`0` 表示禁用；第 6 节小程序用户管理接口使用字符串状态。

现有账户 API 的 `id` 使用 JSON number，与新社区表 API 使用十进制字符串的约定不同；客户端不要把 `users.id` 当作 BIGINT 社区 ID。

### 3.1 登录

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "username": "admin",
  "password": "<password>"
}
```

成功响应包含有效期 2 小时的后台 JWT 和安全用户视图：

```json
{
  "accessToken": "<admin-token>",
  "user": {
    "id": 1,
    "username": "admin",
    "phone": null,
    "email": "admin@example.com",
    "gender": 0,
    "role": 1,
    "status": 1,
    "lastLoginAt": "2026-10-16T12:00:00.000Z",
    "createdAt": "2026-10-16T12:00:00.000Z"
  }
}
```

密码错误或账号已禁用返回 `401 INVALID_CREDENTIALS`；必填参数不合法返回 `400 VALIDATION_ERROR`。当前后台 JWT 包含 `userId` 和 `tokenVersion`，有效期为 2 小时。普通账号可以登录和访问自己的 `/api/users/me`，但访问管理接口返回 `403 FORBIDDEN`。

### 3.2 获取和修改当前账号资料

```http
GET   /api/users/me
PATCH /api/users/me
Authorization: Bearer <user-token>
```

PATCH 可提交 `phone`、`email` 和 `gender`；性别取值为 `0` 未设置、`1` 男、`2` 女。资料更新成功返回用户安全视图。无效或已失效令牌返回 `401 UNAUTHORIZED`，性别不合法返回 `400 VALIDATION_ERROR`，手机号或邮箱已占用返回 `409 CONTACT_ALREADY_EXISTS`。

### 3.3 管理员分页查询账号

```http
GET /admin-api/users?page=1&username=demo
Authorization: Bearer <admin-token>
```

`page` 默认 `1` 且必须是正整数；`username` 可选，最长 50 个字符，按不区分大小写的包含匹配查询；每页固定 10 条。成功响应：

```json
{
  "items": [
    {
      "id": 12,
      "username": "demo_user",
      "phone": null,
      "email": null,
      "gender": 0,
      "role": 0,
      "status": 1,
      "lastLoginAt": null,
      "createdAt": "2026-10-16T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

页码或查询条件不合法返回 `400 VALIDATION_ERROR`。未登录或令牌失效返回 `401 UNAUTHORIZED`；已登录但不是管理员返回 `403 FORBIDDEN`。

### 3.4 管理员新增账号

```http
POST /admin-api/users
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "username": "new_user",
  "password": "<8-to-128-character-password>",
  "phone": null,
  "email": null,
  "gender": 0,
  "role": 0
}
```

用户名去除首尾空格并转小写后为 1–50 位英文小写字母、数字或下划线；密码为 8–128 个字符；`role` 为 `0` 普通账号或 `1` 管理员；`gender` 为 `0/1/2`。手机号、邮箱可省略或为空。成功返回 `201` 和新建账号安全视图，不返回密码或哈希。参数不合法返回 `400 VALIDATION_ERROR`；用户名、手机号或邮箱重复返回 `409 USER_ALREADY_EXISTS`。

### 3.5 管理员启用或禁用账号

```http
POST /admin-api/users/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{ "status": 0 }
```

`status=1` 启用，`status=0` 禁用。成功返回更新后的账号安全视图。不能禁用当前登录的管理员，返回 `400 CANNOT_DISABLE_SELF`；用户不存在返回 `404 USER_NOT_FOUND`；ID 或状态非法返回 `400 VALIDATION_ERROR`。每次调用都会递增 `token_version` 并更新时间，包括重复设置相同状态；该接口目前不写审计日志。

### 3.6 管理员重置账号密码

```http
POST /admin-api/users/:id/password-reset
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "password": "<new-8-to-128-character-password>",
  "reason": "管理员确认账号本人请求重置"
}
```

密码长度为 8–128 个字符，原因去除首尾空格后为 1–500 个字符。成功返回 `204 No Content`。参数不合法返回 `400 VALIDATION_ERROR`，账号不存在返回 `404 USER_NOT_FOUND`。密码哈希更新、`token_version` 递增和 `user.password.reset` 审计记录在同一个数据库事务中完成，旧 JWT 随即失效。

## 4. 小程序用户 DTO

```ts
type MiniappUserStatus = "active" | "disabled"

interface MiniappUserView {
  id: string
  nickname: string
  avatarUrl: string | null
  status: MiniappUserStatus
  createdAt: string
}
```

## 5. 小程序接口

### 5.1 微信登录

```http
POST /api/miniapp/auth/login
Content-Type: application/json
```

请求：

```json
{
  "code": "wx.login 返回的一次性 code"
}
```

处理流程：

1. 服务端使用 `code` 调用微信小程序 `code2Session`（不是开放平台移动 App 的 SDK OAuth 授权）。后端配置 `WECHAT_MINIAPP_APP_ID`、`WECHAT_MINIAPP_APP_SECRET` 和独立的 `MINIAPP_JWT_SECRET`；缺少配置时返回 `503 MINIAPP_AUTH_NOT_CONFIGURED`。`code` 只能使用一次，不在客户端缓存。
2. 取得 `openid` 和可选 `unionid`。
3. 按 `openid` 幂等查询或创建 `miniapp_users`。并发首次登录必须使用数据库 UPSERT，或在唯一约束冲突后重新查询，不能把唯一冲突返回给客户端。
4. 微信本次返回 `unionid` 且数据库尚未保存时回填；微信未返回时保持原值不变。
5. 更新 `last_login_at`。
6. 为正常用户签发 7200 秒小程序 JWT，负载包含十进制字符串 `sub`、`actorType=MINIAPP_USER`、`aud=miniapp` 和 `tokenVersion`。禁用用户不能登录，已签发令牌在禁用后失效。服务端不保存或返回 `session_key`，不返回完整微信标识。

成功响应：

```json
{
  "accessToken": "<token>",
  "expiresIn": 7200,
  "user": {
    "id": "10240001",
    "nickname": "微信用户",
    "avatarUrl": null,
    "status": "active",
    "createdAt": "2026-10-16T12:00:00.000Z"
  }
}
```

错误：

| HTTP | 错误码 | 场景 |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `code` 缺失或格式不合法 |
| `401` | `WECHAT_LOGIN_CODE_INVALID` | 微信返回无效登录凭证 |
| `403` | `MINIAPP_USER_DISABLED` | 用户已被禁用 |
| `403` | `WECHAT_LOGIN_BLOCKED` | 微信拦截高风险登录 |
| `429` | `WECHAT_LOGIN_RATE_LIMITED` | 微信接口触发频率限制 |
| `502` | `WECHAT_SERVICE_ERROR` | 微信服务异常、响应不合法或身份写入失败 |
| `503` | `MINIAPP_AUTH_NOT_CONFIGURED` | 小程序登录配置缺失 |

### 5.2 获取当前用户

```http
GET /api/miniapp/users/me
Authorization: Bearer <miniapp-token>
```

成功返回 `MiniappUserView`。无效或已失效令牌返回 `401 UNAUTHORIZED`。

### 5.3 修改昵称（已设计待实现）

```http
PATCH /api/miniapp/users/me
Authorization: Bearer <miniapp-token>
Content-Type: application/json
```

```json
{
  "nickname": "用户主动填写的微信昵称"
}
```

规则：去除首尾空格后长度为 1–50。成功返回更新后的 `MiniappUserView`。

### 5.4 上传头像（已设计待实现）

```http
POST /api/miniapp/users/me/avatar
Authorization: Bearer <miniapp-token>
Content-Type: multipart/form-data
```

小程序 `chooseAvatar` 返回临时文件，客户端需要上传文件。服务端校验文件后保存到受控对象存储，数据库只保存永久 `avatar_url`。对象存储未选定前不实现该接口。

## 6. 管理后台的小程序用户接口

小程序用户通过微信首次登录自动创建，后台不提供新增用户或重置密码。

本节分页、详情、启用和禁用接口已经实现。

### 6.1 分页查询

```http
GET /admin-api/miniapp-users?page=1&pageSize=10&keyword=&status=active
Authorization: Bearer <admin-token>
```

参数：

| 参数 | 默认值 | 规则 |
|---|---|---|
| `page` | `1` | 正整数 |
| `pageSize` | `10` | `1–100` |
| `keyword` | 空 | 去除首尾空格后最长 50 个字符；纯数字时精确匹配用户 ID，同时对昵称做包含匹配 |
| `status` | 空 | `active` 或 `disabled` |

成功响应：

```json
{
  "items": [
    {
      "id": "10240001",
      "nickname": "微信用户",
      "avatarUrl": null,
      "status": "active",
      "lastLoginAt": "2026-10-16T12:00:00.000Z",
      "createdAt": "2026-10-16T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

V1 允许昵称包含匹配使用顺序扫描；数据量达到性能阈值后再依据真实查询计划增加 PostgreSQL trigram 等专用索引，不预先创建无依据的搜索索引。

### 6.2 查看详情

```http
GET /admin-api/miniapp-users/:id
Authorization: Bearer <admin-token>
```

返回脱敏后的微信标识，以及用户当前加入的未删除圈子：

```json
{
  "id": "10240001",
  "nickname": "微信用户",
  "avatarUrl": null,
  "status": "active",
  "wechatOpenIdMasked": "******a1b2c3",
  "lastLoginAt": "2026-10-16T12:00:00.000Z",
  "createdAt": "2026-10-16T12:00:00.000Z",
  "updatedAt": "2026-10-16T12:00:00.000Z",
  "circleMemberships": [
    {
      "circleId": "1",
      "circleName": "学习",
      "circleStatus": "active",
      "joinedAt": "2026-10-16T12:00:00.000Z"
    }
  ]
}
```

`circleMemberships` 只包含 `circle_members.status=1` 且 `circles.deleted_at IS NULL` 的关系。已退出或已删除的圈子不返回；禁用但未删除的圈子仍返回，并以 `circleStatus=disabled` 标识。没有有效关系时返回空数组。

路径 ID 非法返回 `400 VALIDATION_ERROR`；用户不存在返回 `404 MINIAPP_USER_NOT_FOUND`。

### 6.3 启用或禁用

```http
POST /admin-api/miniapp-users/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "status": "disabled"
}
```

处理规则：

- 更新数据库 `status`。
- 只有状态实际发生变化时才执行 `token_version + 1`，使已签发令牌失效。
- 写入 `audit_logs`，不记录完整微信标识。
- 重复设置相同状态按幂等成功处理，不增加 `token_version`，也不重复写状态变更审计日志。

成功响应：

```json
{
  "id": "10240001",
  "status": "disabled",
  "updatedAt": "2026-10-16T12:05:00.000Z"
}
```

错误：

| HTTP | 错误码 | 场景 |
|---|---|---|
| `400` | `VALIDATION_ERROR` | 路径 ID 或 `status` 不合法 |
| `404` | `MINIAPP_USER_NOT_FOUND` | 用户不存在 |

## 7. 分类管理接口

分类表示帖子业务主题，不表示 `TEXT`、`IMAGE_TEXT`、`VIDEO` 三种内容形式。

分类管理接口已实现；帖子创建时校验分类为启用且未删除。分类采用软删除；帖子外键使用 `ON DELETE RESTRICT`。

```http
GET    /api/miniapp/categories
GET    /admin-api/categories?page=1&pageSize=10
POST   /admin-api/categories
PATCH  /admin-api/categories/:id
PATCH  /admin-api/categories/:id/status
DELETE /admin-api/categories/:id
```

删除规则：

- 分类不存在：`404 CATEGORY_NOT_FOUND`。
- 管理员可软删除分类并写入审计日志；帖子外键使用 `ON DELETE RESTRICT`，分类管理采用软删除。
- 分页默认排除软删除分类，默认每页 10 条。
- 小程序查询只返回启用且未软删除的分类。


## 8. JWT 约定

小程序 JWT 至少包含：

```json
{
  "sub": "10240001",
  "actorType": "MINIAPP_USER",
  "tokenVersion": 0,
  "aud": "miniapp"
}
```

每次访问受保护接口时，Guard 必须：

1. 校验小程序专用签名密钥。
2. 校验 `aud` 和 `actorType`。
3. 查询 `miniapp_users`。
4. 检查 `status=1`。
5. 比较 JWT 与数据库的 `token_version`。

禁用后旧令牌请求受保护接口返回 `401 UNAUTHORIZED`。

## 9. 圈子接口

圈子由管理后台创建和维护，小程序用户不能创建圈子。圈子没有创建者、圈主或圈内管理员。

### 9.1 后台圈子分页

```http
GET /admin-api/circles?page=1&keyword=&status=active
Authorization: Bearer <admin-token>
```

`page` 默认 `1`；`pageSize` 固定为 `10`，客户端无需传递，显式传入其他值返回 `400 VALIDATION_ERROR`；`keyword` 最长 50 个字符并匹配圈子名称；`status` 可选 `active/disabled`。响应项包含字符串 `id`、`name`、`description`、`coverUrl`、`status`、`memberCount`、`createdAt`、`updatedAt`，分页结构沿用通用约定。

### 9.2 创建、详情和编辑

```http
POST  /admin-api/circles
GET   /admin-api/circles/:id
PATCH /admin-api/circles/:id
Authorization: Bearer <admin-token>
```

创建请求：

```json
{
  "name": "学习",
  "description": "交流课程、考试和学习经验",
  "coverUrl": null
}
```

`name` 去除首尾空格后为 1–50 个字符；`description` 和 `coverUrl` 可空，最大长度分别为 500。创建返回 `201`；PATCH 至少提交一个字段并返回更新后的圈子。

### 9.3 启用或禁用

```http
POST /admin-api/circles/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "status": "disabled" }
```

接口幂等；只有状态实际变化才更新 `updated_at` 并写审计。禁用不会删除或修改成员关系。

### 9.4 软删除

```http
DELETE /admin-api/circles/:id
Authorization: Bearer <admin-token>
```

首次删除在同一事务中设置 `status=0`、`deleted_at`、`updated_at`，写入一条 `circle.delete` 审计，并返回 `204 No Content`。成员关系及后续内容历史不会被物理删除。

重复删除已存在的软删除记录按幂等成功返回 `204`，不重复写审计；真实不存在的 ID 返回 `404 CIRCLE_NOT_FOUND`；非法 ID 返回 `400 VALIDATION_ERROR`。删除后，圈子列表、详情、编辑、状态和成员接口均把该圈子视为不存在。当前不提供恢复接口。

禁用与删除含义不同：禁用可恢复且继续出现在后台列表；删除后默认从后台和未来小程序端查询中隐藏。

### 9.5 成员分页

```http
GET /admin-api/circles/:id/members?page=1&keyword=&status=active
Authorization: Bearer <admin-token>
```

分页规则与圈子分页一致，固定每页 10 条；`keyword` 匹配用户 ID 或昵称；`status` 可选 `active/left`。成员项返回 `userId`、`nickname`、`avatarUrl`、`status`、`joinedAt`、`updatedAt`，不返回 OpenID 或 UnionID。

圈子接口统一错误：参数错误为 `400 VALIDATION_ERROR`，圈子不存在为 `404 CIRCLE_NOT_FOUND`，未登录为 `401 UNAUTHORIZED`，非管理员为 `403 FORBIDDEN`。

### 9.6 已设计待实现的小程序接口

```http
GET  /api/miniapp/circles
GET  /api/miniapp/circles/:id
POST /api/miniapp/circles/:id/join
POST /api/miniapp/circles/:id/leave
GET  /api/miniapp/users/me/circles
```

上述接口等待小程序 JWT Guard 落地后实现，不能使用后台 JWT 代替小程序身份。列表、详情和“我的圈子”查询必须过滤 `circles.deleted_at IS NULL`。

## 10. 帖子、点赞与评论接口

帖子、点赞、评论以及后台治理接口详见 `docs/architecture/post-content-design-v1.md`。当前已实现范围：

- 小程序：`GET /api/miniapp/posts`、`GET /api/miniapp/posts/:id`、`POST /api/miniapp/posts`（仅 `TEXT`）、`DELETE /api/miniapp/posts/:id`。
- 小程序：`PUT/DELETE /api/miniapp/posts/:id/likes/me`；`GET/POST /api/miniapp/posts/:id/comments`；`DELETE /api/miniapp/comments/:id`。
- 后台：`GET /admin-api/posts`、`GET /admin-api/posts/:id`、`POST /admin-api/posts/:id/status`、`DELETE /admin-api/posts/:id`。
- 后台：`GET /admin-api/comments`、`GET /admin-api/comments/:id`、`POST /admin-api/comments/:id/status`、`DELETE /admin-api/comments/:id`。
- 新增列表分页默认 `page=1`、`pageSize=10`，最大 `100`；ID 使用十进制字符串。

当前边界：微信登录签发已实现；媒体存储未配置时，图文/视频发帖返回 `503 MEDIA_STORAGE_NOT_CONFIGURED`，不接受客户端任意媒体 URL。评论不支持编辑、回复或点赞。

这些接口应在对应产品规则确认后单独补充设计。

## 11. 官方参考

- [微信小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [code2Session](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)
- [微信头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
