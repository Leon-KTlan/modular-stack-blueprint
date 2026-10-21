# 帖子内容模块数据表与接口设计

- **版本**：V1.1
- **状态**：数据库、接口和后台页面已实现并完成 smoke；微信登录签发与媒体存储仍待实现
- **最后核对**：2026-10-21
- **基线**：当前仓库代码
- **范围**：`posts`、`post_media`、`post_likes`、`comments`

## 1. 目标与边界

本设计记录社区内容四张表及其小程序、管理后台接口契约和已落地边界。

不包含：对象存储选型和文件上传实现、评论点赞、评论多级回复、帖子推荐/搜索、消息通知、永久物理删除。数据库表、接口和后台页面不是一一对应：`post_media` 与 `post_likes` 是帖子详情中的关联数据，不建议各自增加后台菜单。

已有表继续复用：`miniapp_users` 是社区作者身份；`circles` 和 `categories` 为帖子提供圈子与业务主题；`users` 是后台账号，管理员操作写入 `audit_logs`。

## 2. 推荐的 V1 产品规则

V1 按以下规则实现：

1. 帖子必须关联一个未删除且启用的圈子和一个未删除且启用的分类。
2. 帖子发布后立即对用户可见；后台可隐藏，暂不引入“待审核”状态。
3. 用户只能删除自己的帖子和评论；删除采用软删除，保留历史关系。
4. 评论先采用单层结构，不支持回复评论。
5. 点赞/取消点赞由唯一关系保证幂等；点赞数从关系表统计，不在帖子表冗余存储。
6. 帖子正文、内容形态、媒体附件是三个相关但不同的数据：`content_type` 只取 `TEXT`、`IMAGE_TEXT`、`VIDEO`；图片/视频文件元数据单独放入 `post_media`。

对象存储未确定前，不开放真实上传接口；微信登录签发流程也尚未实现。媒体数量/大小限制将在确定对象存储和上传方式后再定。

## 3. 表关系

```text
miniapp_users ──< posts >── circles
                    │
                    ├── categories
                    ├── post_media
                    ├── post_likes >── miniapp_users
                    └── comments >── miniapp_users
```

社区主键和外键统一使用 `BIGINT`；主键使用 `GENERATED ALWAYS AS IDENTITY`。服务端内部使用 `bigint`，路径参数和 JSON ID 使用十进制字符串。所有社区外键都不能引用后台 `users.id`。

## 4. 数据表设计

### 4.1 `posts`：帖子主体

| 字段 | 类型 | 规则与用途 |
|---|---|---|
| `id` | `BIGINT IDENTITY` | 主键 |
| `user_id` | `BIGINT` | 必填，引用 `miniapp_users.id` |
| `circle_id` | `BIGINT` | 必填，引用 `circles.id` |
| `category_id` | `BIGINT` | 必填，引用 `categories.id` |
| `content_type` | `VARCHAR(20)` | `TEXT` / `IMAGE_TEXT` / `VIDEO`，CHECK 约束 |
| `content` | `TEXT` | 正文/说明；是否允许空正文由发布校验结合媒体数判断 |
| `status` | `SMALLINT` | `1` 可见、`0` 隐藏；CHECK 约束 |
| `created_at`、`updated_at` | `TIMESTAMPTZ` | 创建时间和显式刷新的更新时间 |
| `deleted_at` | `TIMESTAMPTZ NULL` | 软删除时间；普通查询排除非空记录 |

外键删除策略为 `ON DELETE RESTRICT`，避免物理删除作者、圈子或分类时破坏帖子历史。服务层校验作者状态、圈子/分类状态及软删除状态。用户端默认只返回 `status=1 AND deleted_at IS NULL` 的帖子。

推荐索引：

- `(circle_id, created_at DESC, id DESC)`，圈子时间线。
- `(category_id, created_at DESC, id DESC)`，分类筛选。
- `(user_id, created_at DESC, id DESC)`，个人主页帖子。
- 管理后台列表按状态筛选时，再根据实际查询计划决定是否添加状态索引；不为未确认的正文包含匹配预建普通 B-tree 索引。

### 4.2 `post_media`：帖子媒体附件

| 字段 | 类型 | 规则与用途 |
|---|---|---|
| `id` | `BIGINT IDENTITY` | 主键 |
| `post_id` | `BIGINT` | 必填，引用 `posts.id` |
| `media_type` | `VARCHAR(10)` | `IMAGE` / `VIDEO`，CHECK 约束 |
| `media_url` | `VARCHAR(1000)` | 必填，受控存储中的永久访问地址；不得保存临时上传 URL |
| `sort_order` | `INTEGER` | 必填，默认 `0`，同帖内稳定排序 |
| `created_at` | `TIMESTAMPTZ` | 默认当前时间 |

帖子采用软删除，媒体记录保留；`post_id` 外键使用 `ON DELETE RESTRICT`。按 `post_id, sort_order, id` 查询附件。V1 不单独管理附件，不保存尚未确认的宽高、时长、转码状态等字段。

文件上传依赖对象存储方案。方案确定前，先实现表及只接受服务端可信媒体地址的关联逻辑；不得让客户端任意提交外部 URL 绕过上传校验。

### 4.3 `post_likes`：用户点赞关系

| 字段 | 类型 | 规则与用途 |
|---|---|---|
| `id` | `BIGINT IDENTITY` | 主键，与现有关系表约定一致 |
| `post_id` | `BIGINT` | 必填，引用 `posts.id` |
| `user_id` | `BIGINT` | 必填，引用 `miniapp_users.id` |
| `created_at` | `TIMESTAMPTZ` | 点赞时间 |

添加 `UNIQUE (post_id, user_id)` 防止重复点赞，并为用户查“我点赞的帖子”建立 `(user_id, created_at DESC, id DESC)` 索引。帖子详情读取点赞数时按 `post_id` 聚合；如果查询量将来证明需要，再单独评估计数缓存/冗余列。取消点赞物理删除这条关系记录，帖子或用户本身仍通过软删除保留。

### 4.4 `comments`：帖子评论

| 字段 | 类型 | 规则与用途 |
|---|---|---|
| `id` | `BIGINT IDENTITY` | 主键 |
| `post_id` | `BIGINT` | 必填，引用 `posts.id` |
| `user_id` | `BIGINT` | 必填，引用 `miniapp_users.id` |
| `content` | `VARCHAR(2000)` | 必填，trim 后不得为空；当前实现上限为 2000 字符 |
| `status` | `SMALLINT` | `1` 可见、`0` 隐藏；CHECK 约束 |
| `created_at`、`updated_at` | `TIMESTAMPTZ` | 创建时间和显式刷新的更新时间 |
| `deleted_at` | `TIMESTAMPTZ NULL` | 软删除时间 |

V1 不设 `parent_id`，所以暂不支持评论回复。推荐索引 `(post_id, created_at, id)` 用于帖子评论分页，`(user_id, created_at DESC, id DESC)` 用于用户评论记录。外键删除策略为 `ON DELETE RESTRICT`。

## 5. 小程序接口

统一前缀 `/api/miniapp`，只接受小程序专用 JWT Bearer Token。所有 ID 用十进制字符串；列表 `page` 默认 `1`、`pageSize` 默认 `10`，最大值按 API 通用约定限制为 `100`。所有用户端读取过滤已隐藏、已软删除内容以及不可见圈子。

### 5.1 帖子列表与详情

```http
GET /api/miniapp/posts?page=1&pageSize=10&circleId=101&categoryId=201&contentType=IMAGE_TEXT
GET /api/miniapp/posts/:postId
```

可选筛选：`circleId`、`categoryId`、`contentType`。列表按 `created_at DESC, id DESC` 稳定排序。返回帖子作者安全展示信息、圈子/分类摘要、媒体列表、评论数和点赞数；不返回微信 OpenID/UnionID。

### 5.2 发布与删除帖子

```http
POST   /api/miniapp/posts
DELETE /api/miniapp/posts/:postId
```

发布请求示例：

```json
{
  "circleId": "101",
  "categoryId": "201",
  "contentType": "IMAGE_TEXT",
  "content": "今天的校园活动",
  "media": [
    { "type": "IMAGE", "url": "https://storage.example/controlled/object-1" }
  ]
}
```

`media` 只在媒体上传方案确认后启用；发布时由服务端校验媒体数量、类型和地址均符合存储策略。用户只能删除自己的帖子，删除采用软删除。管理员删除见管理接口。

### 5.3 点赞

```http
PUT    /api/miniapp/posts/:postId/likes/me
DELETE /api/miniapp/posts/:postId/likes/me
```

PUT 对同一用户/帖子幂等；DELETE 在关系存在或不存在时均成功。帖子不存在、隐藏或已删除时按不可见资源返回 `404 POST_NOT_FOUND`。

### 5.4 评论

```http
GET    /api/miniapp/posts/:postId/comments?page=1&pageSize=10
POST   /api/miniapp/posts/:postId/comments
DELETE /api/miniapp/comments/:commentId
```

创建请求：`{ "content": "评论内容" }`。普通用户只返回可见且未删除的评论；作者只能软删除自己的评论。V1 不支持编辑、回复或评论点赞。

### 5.5 用户端错误

| HTTP | 错误码 | 场景 |
|---|---|---|
| `400` | `VALIDATION_ERROR` | ID、筛选、分页、内容或内容类型不合法 |
| `401` | `UNAUTHORIZED` | JWT 缺失、失效或用户被禁用 |
| `403` | `FORBIDDEN` | 用户试图删除他人内容 |
| `404` | `POST_NOT_FOUND` / `COMMENT_NOT_FOUND` | 资源不存在或对当前用户不可见 |
| `409` | `CIRCLE_NOT_AVAILABLE` / `CATEGORY_NOT_AVAILABLE` | 发布时圈子或分类不可用 |

## 6. 管理后台接口与页面

后台接口使用 `/admin-api` 前缀，只接受后台管理员 JWT。菜单建议新增一个“内容管理”分组，其中只有“帖子管理”和“评论管理”两个页面。

### 6.1 帖子管理

```http
GET    /admin-api/posts?page=1&pageSize=10&circleId=101&categoryId=201&contentType=TEXT&status=published
GET    /admin-api/posts/:postId
POST   /admin-api/posts/:postId/status
DELETE /admin-api/posts/:postId
```

- 列表可按圈子、分类、作者 ID、内容类型、状态和创建时间筛选；正文包含匹配仅在确认需求后实现。
- 详情展示正文、媒体、作者、圈子、分类、点赞数、评论数及状态。
- 状态请求示例：`{ "status": "hidden", "reason": "包含违规信息" }`；可见状态为 `published`。
- 管理删除软删除帖子并保留媒体、点赞、评论历史。管理状态变更和首次删除写入 `audit_logs`，重复设置相同状态或重复删除不重复写审计。
- 管理列表可以查看被隐藏/删除帖子；普通详情和小程序接口不暴露已删除内容。

### 6.2 评论管理

```http
GET    /admin-api/comments?page=1&pageSize=10&postId=301&userId=10240001&status=published
GET    /admin-api/comments/:commentId
POST   /admin-api/comments/:commentId/status
DELETE /admin-api/comments/:commentId
```

评论列表支持按帖子、作者、状态和时间筛选，展示评论内容及关联帖子摘要。状态请求示例：`{ "status": "hidden", "reason": "辱骂内容" }`。删除采用软删除；状态变更与首次删除写审计。请求字段 `reason` 必填，长度 1–500，敏感内容不得写入审计 reason。

### 6.3 不单独做后台页面的表

- `post_media`：在帖子详情内展示与预览；不设“附件管理”菜单。文件上传/替换/删除策略等对象存储选型后确定。
- `post_likes`：帖子列表或详情显示聚合数量；不提供逐条编辑/删除的日常运营页面。若后续需要反作弊治理，再设计独立权限和审计规则。

## 7. 跨表规则与事务

- 创建帖子及其媒体关联应在一个事务中完成；校验内容形态和附件类型一致。用户传入未授权媒体时整体失败，不留下半成品帖子。
- 点赞由 `(post_id, user_id)` 唯一约束兜底并处理并发重复请求。
- 帖子被隐藏或软删除后，不允许新点赞和新评论；既有历史关系不物理删除。
- 评论创建、帖子状态调整和删除均在服务层校验帖子当前可见状态。
- 管理操作的业务更新和审计写入在同一事务提交。
- 数据库检查与 `apps/server/src/schema.ts` 必须保持一致；所有索引须对应实际查询路径。

## 8. 管理界面结构建议

```text
内容管理
├── 帖子管理       独立列表与详情/审核
│   └── 帖子详情   正文、媒体、点赞数、评论列表
└── 评论管理       独立列表与审核；可跳转关联帖子
```

分类和圈子继续通过已有管理页面维护；帖子创建只引用其 ID，不复制名称。后台不直接维护点赞关系或媒体数据库记录。

## 9. 当前实现状态与后续边界

- 已新增 migration、Drizzle Schema、小程序路由和帖子/评论两个管理页面；正式状态以类型检查、构建、数据库 smoke 和页面交互验证结果为准。
- 小程序路由校验独立 Bearer JWT，但微信 `code2Session` 登录和 token 签发还未实现；须配置独立 `MINIAPP_JWT_SECRET` 才能访问。
- 当前只允许纯文本发帖。图文/视频发帖返回 `503 MEDIA_STORAGE_NOT_CONFIGURED`，不信任客户端直接传入的媒体 URL。
- 媒体上传、数量/大小限制和对象存储策略需在选定存储后设计；不阻碍先行落地媒体元数据表。
- 不支持评论编辑、回复、评论点赞、内容搜索、推荐或消息通知。
