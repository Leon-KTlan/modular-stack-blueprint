# 社区模块接口设计

- **文档版本**：V1.0
- **文档状态**：Design Record
- **最后更新**：2026-10-16
- **当前实现状态**：后台账号接口已实现；`miniapp_users` 表和后台分页、详情、启用/禁用接口已实现；小程序端接口和分类接口仍为设计记录

## 1. 接口边界

```text
/admin-api/*          管理后台接口，只接受后台账号 JWT
/api/miniapp/*        微信小程序接口，只接受小程序用户 JWT
```

后台账号来自现有 `users`，小程序身份来自 `miniapp_users`。目标设计要求两类令牌使用不同的签名密钥、`audience` 和身份类型，不能互相访问接口。当前服务端已经实现后台账号令牌；在小程序登录接口落地前，还需要实现独立的小程序令牌校验。

## 2. 通用约定

- 第 5–7 节的新社区接口请求和响应中的实体 ID 均为十进制字符串；第 3 节现有 `users` 账户接口和第 6 节小程序用户后台接口分别沿用各自已实现的 ID 类型。
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

1. 服务端使用 `code` 调用微信 `code2Session`。
2. 取得 `openid` 和可选 `unionid`。
3. 按 `openid` 幂等查询或创建 `miniapp_users`。并发首次登录必须使用数据库 UPSERT，或在唯一约束冲突后重新查询，不能把唯一冲突返回给客户端。
4. 微信本次返回 `unionid` 且数据库尚未保存时回填；微信未返回时保持原值不变。
5. 更新 `last_login_at`。
6. 为正常用户签发小程序 JWT。

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
| `429` | `WECHAT_LOGIN_RATE_LIMITED` | 微信接口触发频率限制 |
| `502` | `WECHAT_SERVICE_ERROR` | 微信服务异常或未知错误 |

### 5.2 获取当前用户

```http
GET /api/miniapp/users/me
Authorization: Bearer <miniapp-token>
```

成功返回 `MiniappUserView`。无效或已失效令牌返回 `401 UNAUTHORIZED`。

### 5.3 修改昵称

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

### 5.4 上传头像

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

只返回脱敏后的微信标识：

```json
{
  "id": "10240001",
  "nickname": "微信用户",
  "avatarUrl": null,
  "status": "active",
  "wechatOpenIdMasked": "******a1b2c3",
  "lastLoginAt": "2026-10-16T12:00:00.000Z",
  "createdAt": "2026-10-16T12:00:00.000Z",
  "updatedAt": "2026-10-16T12:00:00.000Z"
}
```

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

V1 按当前产品取舍只记录分页查询和按 ID 删除；新增、编辑、启停和排序接口不在当前范围，不能据本文自行补充。

```http
GET    /admin-api/categories?page=1&pageSize=10
DELETE /admin-api/categories/:id
```

删除规则：

- 分类不存在：`404 CATEGORY_NOT_FOUND`。
- 分类被帖子引用：`409 CATEGORY_IN_USE`。
- 未被引用：软删除并写入审计日志。
- 分页默认排除软删除分类。

分类表尚未落地，因此这两个接口也尚未实现。

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

## 9. 尚未设计的接口

以下接口不在当前记录范围，不能依据表名自行实现：

- 圈子创建、加入和退出
- 帖子发布、查询和删除
- 图片与视频上传
- 点赞和取消点赞
- 评论发布和删除

这些接口应在对应产品规则确认后单独补充设计。

## 10. 官方参考

- [微信小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [code2Session](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)
- [微信头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
