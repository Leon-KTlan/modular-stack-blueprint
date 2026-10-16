# 社区模块数据库表设计

- **文档版本**：V1.0
- **文档状态**：Design Record
- **最后更新**：2026-10-16
- **数据库**：PostgreSQL 16
- **ORM**：Drizzle ORM

## 1. 设计范围

后台账号和小程序用户使用不同数据表：

- 现有 `users`：保存使用用户名和密码登录的系统账号，管理员通过角色获得后台管理权限。
- 新增 `miniapp_users`：只用于微信小程序用户。
- 现有 `audit_logs`：记录管理员操作，不属于社区业务表。

社区模块规划 8 张表：

1. `miniapp_users`
2. `circles`
3. `circle_members`
4. `categories`
5. `posts`
6. `post_media`
7. `post_likes`
8. `comments`

本次只落地 `miniapp_users`。其余 7 张表仅记录设计，字段和外键在实现前还需要单独冻结。

## 2. 全局约定

- 社区表主键统一使用 PostgreSQL `BIGINT IDENTITY`。
- 社区表外键统一使用 `BIGINT`。
- V1 只服务一个微信小程序，因此 `wx_openid` 可以全表唯一；如果未来接入多个小程序，需要增加 `appid` 并改为 `UNIQUE (appid, wx_openid)`。
- API 中所有实体 ID 使用十进制字符串，避免 JavaScript 数字精度丢失。
- 时间统一使用 `TIMESTAMPTZ`。
- `created_at`、`updated_at` 由数据库给初始值；更新时由 Service 显式刷新 `updated_at`。
- 状态在数据库使用受约束的 `SMALLINT`，在 API DTO 中使用可读字符串枚举。
- 用户、圈子、分类和帖子不通过物理删除破坏历史关联。

## 3. 表关系

```text
users（后台账号）
  ├──作为操作者──> audit_logs
  └──登录后台并管理系统账号

miniapp_users
  ├──创建──> circles
  ├──加入──> circle_members <──属于── circles
  ├──发布──> posts <──属于── circles
  ├──点赞──> post_likes <──属于── posts
  └──评论──> comments <──属于── posts

categories
  └──分类──> posts

posts
  └──包含──> post_media
```

## 4. 已有后台账户管理表

### 4.1 `users`：系统账号与后台账号

职责：保存通过用户名和密码登录系统的账号。`role=1` 是管理员，`role=0` 是普通系统账号；小程序微信身份单独保存在 `miniapp_users`，不能把 OpenID 写入 `users.username`。

| 字段 | 类型 | 空值 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `INTEGER IDENTITY` | 否 | 数据库生成 | 账号 ID；现有账户 API 以 JSON number 返回 |
| `username` | `VARCHAR(50)` | 否 | 无 | 唯一登录名；API 输入会去除首尾空格并转小写 |
| `password_hash` | `VARCHAR(255)` | 否 | 无 | 只保存密码哈希，不保存明文密码 |
| `phone` | `VARCHAR(20)` | 是 | `NULL` | 手机号，可空且唯一 |
| `email` | `VARCHAR(255)` | 是 | `NULL` | 邮箱，可空且唯一；API 输入会转小写 |
| `gender` | `SMALLINT` | 否 | `0` | `0` 未设置、`1` 男、`2` 女 |
| `role` | `SMALLINT` | 否 | `0` | `0` 普通账号、`1` 管理员 |
| `status` | `SMALLINT` | 否 | `1` | `1` 启用、`0` 禁用 |
| `token_version` | `INTEGER` | 否 | `0` | 账号状态或密码变化时使旧 JWT 失效 |
| `last_login_at` | `TIMESTAMPTZ` | 是 | `NULL` | 最近成功登录时间 |
| `created_at` | `TIMESTAMPTZ` | 否 | 当前时间 | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 否 | 当前时间 | 更新时间 |

约束和索引：

- `username`、非空的 `phone`、非空的 `email` 分别唯一。
- `gender` 只能是 `0/1/2`；`role`、`status` 只能是 `0/1`。
- `idx_users_status` 支持按账号状态筛选；`idx_users_role_status` 支持按角色和状态筛选。
- `username` 只能通过 API 规则保证小写；数据库唯一约束本身区分大小写。
- 新密码使用 Argon2id 哈希。兼容的旧 bcrypt 哈希会在用户成功登录时升级；密码哈希永不出现在 API 响应。

### 4.2 `audit_logs`：管理员操作审计

职责：记录需要追踪的管理员变更。`operator_id` 关联后台账号，`resource_type` 和 `resource_id` 标识被操作的数据对象。

| 字段 | 类型 | 空值 | 说明 |
|---|---|---:|---|
| `id` | `INTEGER IDENTITY` | 否 | 审计记录 ID |
| `operator_id` | `INTEGER` | 否 | 操作人，外键指向 `users.id`，删除账号时 `RESTRICT` |
| `operator_role` | `SMALLINT` | 否 | 操作发生时的角色快照 |
| `action` | `VARCHAR(100)` | 否 | 操作名称，如 `user.password.reset` |
| `resource_type` | `VARCHAR(100)` | 否 | 资源类型，如 `user`、`miniapp_user` |
| `resource_id` | `BIGINT` | 否 | 多态资源 ID，不是外键；迁移 003 后兼容社区表 BIGINT 主键 |
| `reason` | `VARCHAR(500)` | 否 | 操作原因，不得包含密码或完整敏感标识 |
| `request_id` | `VARCHAR(100)` | 否 | 关联请求 ID |
| `created_at` | `TIMESTAMPTZ` | 否 | 操作发生时间 |

索引：`(resource_type, resource_id)` 用于查询资源审计历史；`(operator_id, created_at)` 用于查询管理员操作记录。

`operator_id` 是真实外键并引用 `users.id`；`resource_id` 根据 `resource_type` 指向不同业务表，数据库不为它建立单一外键。

当前代码会在密码重置和小程序用户状态变更时写入审计日志；后台账号新增和状态修改目前没有审计记录。

## 5. 已落地：`miniapp_users`

### 5.1 职责

保存微信小程序用户在苍穹系统内的身份、展示资料和登录状态。该表不保存后台账号、密码或密码哈希。

### 5.2 字段

| 字段 | 类型 | 空值 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `BIGINT IDENTITY` | 否 | 数据库生成 | 小程序用户 ID |
| `wx_openid` | `VARCHAR(64)` | 否 | 无 | V1 唯一小程序内的微信身份标识 |
| `wx_unionid` | `VARCHAR(64)` | 是 | `NULL` | 满足微信下发条件时保存 |
| `nickname` | `VARCHAR(50)` | 否 | `微信用户` | 社区展示昵称，允许重复 |
| `avatar_url` | `VARCHAR(500)` | 是 | `NULL` | 服务端持久化后的头像地址 |
| `status` | `SMALLINT` | 否 | `1` | `1` 正常，`0` 禁用 |
| `token_version` | `INTEGER` | 否 | `0` | 使已签发 JWT 失效 |
| `last_login_at` | `TIMESTAMPTZ` | 是 | `NULL` | 最近成功登录时间 |
| `created_at` | `TIMESTAMPTZ` | 否 | 当前时间 | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 否 | 当前时间 | 更新时间 |

### 5.3 约束和索引

- `wx_openid` 唯一且必填。
- `wx_unionid` 唯一但允许为空；PostgreSQL 允许唯一列存在多行 `NULL`。
- `nickname` 去除首尾空格后长度必须为 1–50。
- `status` 只能是 `0` 或 `1`。
- `(status, created_at, id)` 支持后台按状态分页。
- `(created_at, id)` 支持后台全部用户稳定分页。

### 5.4 明确不保存

- 不保存 `username`。
- 不保存密码和密码哈希。
- 不把微信 `session_key` 返回给客户端，也不长期保存在用户表。
- 不默认收集手机号、邮箱、真实姓名和学校信息。

### 5.5 ID 方案

当前只有一个 PostgreSQL 写入点，因此使用数据库 Identity，而不是自研雪花算法。这样不需要处理机器编号、时钟回拨和序列冲突。

Drizzle 使用 `bigint` 模式，服务端内部类型为 JavaScript `bigint`。序列化 JSON 前必须转换为十进制字符串，禁止使用 `Number(id)`。

## 6. 待落地表设计

以下内容记录职责和核心字段，不代表 migration 已冻结。

### 6.1 `circles`

```text
id
name
description
cover_url
creator_id -> miniapp_users.id
status
created_at
updated_at
```

职责：保存圈子基础信息。名称重复规则和删除策略待确认。

### 6.2 `circle_members`

```text
id
circle_id -> circles.id
user_id -> miniapp_users.id
member_role
status
joined_at
```

约束：`UNIQUE (circle_id, user_id)`。成员退出采用状态变更还是删除关系待确认。

### 6.3 `categories`

```text
id
name
code
sort_order
status
created_at
updated_at
deleted_at
```

职责：管理帖子业务主题。`TEXT`、`IMAGE_TEXT`、`VIDEO` 是帖子内容类型，不写入分类表。第一批分类项待确认。

### 6.4 `posts`

```text
id
user_id -> miniapp_users.id
circle_id -> circles.id
category_id -> categories.id
content_type
content
status
created_at
updated_at
deleted_at
```

`content_type` 固定为：

- `TEXT`
- `IMAGE_TEXT`
- `VIDEO`

### 6.5 `post_media`

```text
id
post_id -> posts.id
media_type
media_url
cover_url
duration
sort_order
created_at
```

职责：保存帖子图片和视频。图片数量、视频数量和时长单位待确认。

### 6.6 `post_likes`

```text
id
post_id -> posts.id
user_id -> miniapp_users.id
created_at
```

约束：`UNIQUE (post_id, user_id)`，防止重复点赞。

### 6.7 `comments`

```text
id
post_id -> posts.id
user_id -> miniapp_users.id
content
status
created_at
updated_at
deleted_at
```

第一版默认只设计一级评论；回复关系确认后再增加 `parent_id`。

## 7. Migration 记录

- `001_create_users.sql`：现有后台账号和审计表。
- `002_create_miniapp_users.sql`：新增小程序用户表。
- `003_alter_audit_logs_resource_id_bigint.sql`：将审计资源 ID 升级为 `BIGINT`，兼容社区表主键。

Docker 新数据卷会按顺序执行 migration，再执行用户种子数据。已有数据卷不会自动执行新增文件，需要按顺序通过正式 migration 流程应用 `002_create_miniapp_users.sql` 和 `003_alter_audit_logs_resource_id_bigint.sql`，不能通过删除数据卷代替迁移。

## 8. 当前实现边界

已实现：

- `miniapp_users` SQL migration。
- `miniapp_users` Drizzle Schema。
- 既有 `users`、`audit_logs` 表和后台账号认证/管理接口。
- 新数据卷的 Docker 初始化挂载。
- 后台小程序用户分页、详情、启用和禁用接口。
- 后台小程序用户列表页面。

尚未实现：

- 微信登录调用。
- 小程序端用户 Repository、Service 和 `/api/miniapp/*` Route。
- 其他 7 张社区业务表。
