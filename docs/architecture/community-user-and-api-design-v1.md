# 小程序用户身份与社区数据模型接口设计

- **文档版本**：V1.1
- **文档状态**：Implemented in Parts
- **最后更新**：2026-10-16

## 1. 身份边界

后台账号和小程序用户属于不同身份域：

| 身份域 | 数据表 | 登录方式 | 用途 |
|---|---|---|---|
| 管理后台 | `users` | 用户名和密码 | 后台登录、圈子维护、审计 |
| 微信小程序 | `miniapp_users` | 微信 `code` | 加入圈子、发帖、点赞、评论 |

社区业务外键只能引用 `miniapp_users.id`，不能引用后台 `users.id`。社区实体 ID 使用 PostgreSQL `BIGINT IDENTITY`；服务端内部使用 `bigint`，URL 和 JSON 中使用十进制字符串。

## 2. 社区表关系

```text
users（后台账号）
  └──执行管理操作──> audit_logs

circles（后台创建和维护）
  ├──包含──> circle_members <──加入── miniapp_users
  └──包含──> posts

miniapp_users
  ├──发布──> posts
  ├──点赞──> post_likes
  └──评论──> comments
```

社区规划仍为 8 张表：`miniapp_users`、`circles`、`circle_members`、`categories`、`posts`、`post_media`、`post_likes`、`comments`。当前已落地前四张。

## 3. 圈子模型决策

圈子是后台预设的社区入口，例如“学习”“表白”“二手”。V1 采用以下边界：

- 小程序用户不能创建、编辑或删除圈子。
- 圈子不保存 `creator_id`，没有历史创建者概念。
- 成员没有 `OWNER` 或 `ADMIN` 角色；所有圈子配置均由后台账号维护。
- 圈子名称允许重复，以圈子 ID 唯一识别。
- 圈子删除采用 `deleted_at` 软删除，不物理删除成员关系或历史内容。
- 禁用圈子仍在后台可见并可重新启用；删除圈子默认从后台和小程序查询隐藏，当前不提供恢复接口。

`circles` 字段：

```text
id
name
description
cover_url
status
created_at
updated_at
deleted_at
```

`circle_members` 字段：

```text
id
circle_id
user_id
status
joined_at
updated_at
```

成员状态只有 `active` 和 `left`。`UNIQUE (circle_id, user_id)` 防止重复关系；重新加入时复用原记录并刷新 `joined_at`。详细约束和索引见 `docs/architecture/community-database-design-v1.md`。

## 4. 已实现的后台圈子接口

```http
GET   /admin-api/circles?page=1&keyword=&status=active
POST  /admin-api/circles
GET   /admin-api/circles/:id
PATCH /admin-api/circles/:id
DELETE /admin-api/circles/:id
POST  /admin-api/circles/:id/status
GET   /admin-api/circles/:id/members?page=1&keyword=&status=active
```

统一规则：

- 必须携带后台管理员 JWT。
- `page` 默认 `1`；圈子和圈子成员查询固定 `pageSize=10`，后台页面不提供页容量筛选。
- 圈子列表按 `created_at DESC, id DESC` 稳定排序。
- `keyword` 去除首尾空格后最长 50 个字符；圈子列表按名称包含匹配。
- 圈子状态使用 `active`、`disabled`；成员状态使用 `active`、`left`。
- 创建、编辑、实际状态变化和首次软删除都写入 `audit_logs`。
- 创建返回 `201`，不存在返回 `404 CIRCLE_NOT_FOUND`，参数错误返回 `400 VALIDATION_ERROR`。

圈子分页项：

```json
{
  "id": "10001",
  "name": "学习",
  "description": "交流课程、考试和学习经验",
  "coverUrl": null,
  "status": "active",
  "memberCount": 0,
  "createdAt": "2026-10-16T12:00:00.000Z",
  "updatedAt": "2026-10-16T12:00:00.000Z"
}
```

创建请求接受 `name`、可选 `description`、可选 `coverUrl`；编辑请求至少提交其中一个字段。成员列表项返回 `userId`、`nickname`、`avatarUrl`、`status`、`joinedAt`、`updatedAt`，不返回微信标识。

删除设置 `status=0`、`deleted_at` 和 `updated_at`，保留 `circle_members`。首次和重复删除均返回 `204`，重复删除不重复写审计；删除后的圈子在普通列表、详情、编辑、状态和成员查询中均视为不存在。

`GET /admin-api/miniapp-users/:id` 已增加 `circleMemberships`，只返回用户状态为 `active` 的成员关系且圈子未软删除。成员已退出或圈子已删除时不展示；禁用但未删除的圈子仍展示并标记 `circleStatus=disabled`。

当前用户数据已通过 `003_seed_circle_members.sql` 完成一次性回填：正常用户按 ID 确定性加入 1–2 个预设圈子，禁用用户不分配；脚本以 `(circle_id, user_id)` 冲突忽略保证幂等。

## 5. 已设计待实现的小程序圈子接口

```http
GET  /api/miniapp/circles
GET  /api/miniapp/circles/:id
POST /api/miniapp/circles/:id/join
POST /api/miniapp/circles/:id/leave
GET  /api/miniapp/users/me/circles
```

这些接口依赖小程序专用 JWT Guard。当前微信登录和 Guard 尚未实现，因此本次没有使用后台 JWT 代替小程序身份，也没有开放用户创建圈子的接口。所有小程序圈子查询必须过滤 `circles.deleted_at IS NULL`。

## 6. 公共数据库字段规范

- 可复用的二元状态列、`created_at`、`updated_at`、`deleted_at` 通过 `apps/server/src/schema-fields.ts` 定义。
- SQL migration 与 Drizzle Schema 必须同步维护默认值、CHECK、索引和外键策略。
- 数据库默认值只负责插入时间；更新路径显式刷新 `updated_at`，不增加数据库 Trigger。
- 状态在数据库使用 `SMALLINT + CHECK`，API 对外转换为字符串枚举。
- 管理操作的多态资源 ID 使用 `audit_logs.resource_id BIGINT`，兼容所有社区实体。

## 7. 当前实现边界

已实现：`miniapp_users`、`circles`、`circle_members`、`categories` 表；圈子关系回填；后台小程序用户管理及加入圈子详情；后台圈子管理；后台分类管理；小程序可选分类查询。

待实现：微信登录、小程序 JWT Guard、小程序加入/退出/我的圈子，以及帖子、媒体、点赞和评论表与接口。分类在帖子接口完成前独立维护，帖子创建时关联分类的校验尚未实现。
