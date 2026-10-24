# 小程序用户身份与社区数据模型接口设计

- **文档版本**：V1.4
- **文档状态**：Implemented in Parts
- **最后更新**：2026-10-24

## 1. 身份边界

后台账号和小程序用户属于不同身份域：

| 身份域 | 数据表 | 登录方式 | 用途 |
|---|---|---|---|
| 管理后台 | `users` | 用户名和密码 | 后台登录、圈子维护、审计 |
| 微信小程序 | `miniapp_users` | 微信 `code` | 加入圈子、发帖、点赞、评论 |
| Expo 黑客松演示端 | 复用指定的 `miniapp_users` 演示记录 | 非生产演示登录 | 验证 Android 帖子主流程，不代表正式 App 身份方案 |

社区用户主体外键只能引用 `miniapp_users.id`，不能引用后台 `users.id`；管理操作人外键引用既有 `users.id`。社区实体 ID 使用 PostgreSQL `BIGINT IDENTITY`；服务端内部使用 `bigint`，URL 和 JSON 中使用十进制字符串。后台操作人沿用既有 INTEGER ID。

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
  ├──评论──> comments
  └──关注/被关注──> miniapp_user_follows
```

社区模块共 9 张表：`miniapp_users`、`miniapp_user_follows`、`circles`、`circle_members`、`categories`、`posts`、`post_media`、`post_likes`、`comments`；当前 Schema 与 migration 已覆盖全部 9 张。加上 `users` 和 `audit_logs`，共 11 张物理表。

树洞另新增 11 张表的 migration `009_create_treehole.sql` 与 Schema 定义，合计 22 张物理表的代码定义；尚未迁移已有数据库，隔离数据库验证待完成。树洞复用 `miniapp_users`，与普通帖子分表；表关系及接口见[树洞 V1 产品与后端技术规范](treehole-design-v1.md)。

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

这些接口依赖已实现的小程序专用 JWT Guard；圈子用户端路由仍待实现。后台 JWT 不能代替小程序身份，也没有开放用户创建圈子的接口。所有小程序圈子查询必须过滤 `circles.deleted_at IS NULL`。

## 6. 公共数据库字段规范

- 可复用的二元状态列、`created_at`、`updated_at`、`deleted_at` 通过 `apps/server/src/schema-fields.ts` 定义。
- SQL migration 与 Drizzle Schema 必须同步维护默认值、CHECK、索引和外键策略。
- 数据库默认值只负责插入时间；更新路径显式刷新 `updated_at`，不增加数据库 Trigger。
- 状态在数据库使用 `SMALLINT + CHECK`，API 对外转换为字符串枚举。
- 管理操作的多态资源 ID 使用 `audit_logs.resource_id BIGINT`，兼容所有社区实体。

## 7. 当前实现边界

已实现：9 张社区表的 SQL migration 与 Drizzle Schema；圈子关系回填；后台小程序用户、圈子、分类管理；帖子和评论后台管理接口与页面；帖子列表/详情/文本发布/删除、点赞、评论和详情浏览量的小程序接口；分类在帖子创建时的可用性校验。

已实现：`wx.login` 的 code 经服务端调用小程序 `code2Session`，按 OpenID 并发安全地创建/复用用户、回填可选 UnionID、禁用用户拒绝登录；签发独立密钥的两小时小程序 JWT，提供 `GET /api/miniapp/users/me`。不存储或返回 `session_key`，不返回完整微信身份标识。原生小程序已提供登录入口示例，真实 AppID、AppSecret 和 HTTPS 请求域名须由部署方配置。

已实现：非生产环境可通过显式开启的 `POST /api/mobile/auth/demo` 为指定启用演示用户签发同一身份域的两小时 JWT，供 `apps/mobile` Expo Go 黑客松演示复用现有社区接口。该路由在生产环境或未开启时返回 `404`，不创建新身份、不接受客户端选择用户，也不是正式移动 App 登录方案。

已实现：当前用户与公开用户主页、昵称/简介/性别资料更新、关注/取消关注、关注与粉丝列表。昵称经 NFKC 归一化后限制为 2–20 个中英文、数字、空格或 `_·-`，30 天内最多修改 3 次；简介最多 100 字。所有写入使用 Drizzle 参数化查询，数据库同时保留长度与枚举 CHECK。性别为 `private` 时公开主页返回 `null`。

待实现：小程序加入/退出/我的圈子、服务端头像上传；对象存储和媒体上传。“我的”页的帖子/点赞/收藏/足迹目前是小程序界面演示数据，收藏和足迹尚无服务端表与接口。帖子及评论路由使用独立 `MINIAPP_JWT_SECRET` 校验 Bearer JWT，但未配置密钥时返回 `503`；图文/视频发帖在存储接入前返回 `503 MEDIA_STORAGE_NOT_CONFIGURED`。当前仅文本发帖可以执行。

## 8. 树洞：三端实施与验收

完整产品规则、grill-me 访谈决策、11 张新增表和状态转换记录在[树洞 V1 产品与后端技术规范](treehole-design-v1.md)。三端使用[树洞接口契约 V1](../api/treehole-api-contract-v1.md)及配套 OpenAPI/响应样例，33 个 HTTP 操作已固定；共享 DTO、生成/基线校验及独立本地状态 Mock 已落地。用户已授权三端开发：原生小程序按 [B「午夜电台」复刻规范](../development/treehole-frontend-b-spec-v1.md)实施；服务端新增树洞模块、11 表定义和审核 worker；后台新增审核、举报、处罚与申诉工作台。当前代码仍在复核与验收，实际通过项目、未执行的数据库及界面验证见[三端开发说明](../development/treehole-parallel-development-v1.md)，不代表已部署。

- 复用现有小程序登录账号；学生身份和学号绑定不在 V1 范围。
- 匿名仅对其他用户成立：同帖昵称稳定、跨帖独立，公开 DTO 不返回真实用户 ID、头像、主页或跨帖身份标识。
- 仅文字帖子、评论/回复及帖子点赞；首次公开后 1/6/12/24 小时到期，默认 24 小时；取消投票、精选和延期保留。
- 代码规则分流、风险内容异步 AI 审核、严重及不确定案件人工复核；内部计分不可见，处罚原因、受限能力、结束时间与申诉入口可见。
- 有效限制阻止浏览及使用整个树洞；个人中心的本人处罚、申诉及内容管理接口独立鉴权。正常服完限制不恢复旧内容，误判撤销仅可恢复仍符合展示条件的内容。
- 拟新增 `/api/miniapp/treehole/*`、`/api/miniapp/me/treehole/*`、`/admin-api/treehole/*`；后台通过案件执行治理，身份关联查询权限另议，不开放查询接口。
- 过期与删除先保证不可访问；正文及证据的具体保留、清除期限待确认，不将后台留证等同于继续对用户展示。
