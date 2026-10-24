# 圈子内容模块实施状态

- **文档版本**：V1.2
- **文档状态**：Active
- **最后更新**：2026-10-23

## 1. 已确认产品规则

- [x] 圈子由管理后台创建和维护，小程序用户不能创建。
- [x] 当前已落地的预设圈子为“学习”“表白”“二手”。
- [x] 产品已确认新增“运动搭子”作为第四个预设圈子。
- [ ] 通过幂等 seed 落地“运动搭子”，并同步接口、smoke 和相关文档；完成前不得标记为已实现。
- [x] `circles` 不保存 `creator_id`，不追踪历史创建者。
- [x] `circle_members` 不包含 `OWNER`、`ADMIN` 或其他圈内角色。
- [x] 圈子名称允许重复，以 ID 唯一识别。
- [x] 圈子采用软删除，不提供物理删除；删除后后台和小程序默认不可见，成员关系保留。
- [x] 禁用与删除分离：禁用可恢复，删除当前不提供恢复接口。
- [x] 成员退出保留关系记录；重新加入复用同一条关系。
- [x] 当前正常小程序用户按 ID 确定性加入 1–2 个预设圈子，禁用用户不分配。
- [x] 分页 `page` 默认 1，圈子和圈子成员固定 `pageSize=10`。

## 2. 已完成数据库工作

- [x] `002_create_miniapp_users.sql`：创建小程序用户表。
- [x] `003_alter_audit_logs_resource_id_bigint.sql`：审计资源 ID 升级为 BIGINT。
- [x] `004_create_circles.sql`：创建 `circles` 和 `circle_members`。
- [x] `005_add_circles_deleted_at.sql`：新增圈子软删除字段和未删除记录部分索引。
- [x] `006_create_categories.sql`：创建帖子主题分类表。
- [x] `007_create_post_content.sql`：创建 `posts`、`post_media`、`post_likes`、`comments`。
- [x] `008_add_miniapp_profiles_and_follows.sql`：增加资料字段、昵称修改窗口、用户关注关系和帖子浏览量。
- [x] `002_seed_circles.sql`：幂等写入学习、表白、二手。
- [x] `003_seed_circle_members.sql`：幂等回填正常用户的 1–2 个圈子关系。
- [x] `004_seed_categories.sql`：幂等写入六个帖子主题分类。
- [x] Drizzle Schema 与 SQL migration 同步。
- [x] 四张帖子内容表的约束、外键删除策略和索引与 Drizzle Schema 同步。
- [x] 社区主键和外键统一使用 BIGINT，API 使用字符串 ID。
- [x] `UNIQUE (circle_id, user_id)` 防止重复成员关系。
- [x] 圈子列表和成员双向查询索引落地。
- [x] 公共状态列、创建/更新时间和软删除时间集中到 `schema-fields.ts`。
- [x] 当前数据回填结果：27 个正常用户、40 条有效关系，三个圈子人数为 13/13/14；4 个禁用用户均为 0 条。

## 3. 已完成后台接口

- [x] `GET /admin-api/circles`：关键词、状态和固定每页 10 条分页。
- [x] `POST /admin-api/circles`：创建圈子。
- [x] `GET /admin-api/circles/:id`：圈子详情。
- [x] `PATCH /admin-api/circles/:id`：编辑基础资料。
- [x] `POST /admin-api/circles/:id/status`：幂等启用/禁用。
- [x] `DELETE /admin-api/circles/:id`：幂等软删除，保留成员关系。
- [x] `GET /admin-api/circles/:id/members`：成员分页。
- [x] `GET /admin-api/miniapp-users/:id`：返回用户当前加入且圈子未删除的关系。
- [x] 分类分页查询、新增、编辑、启停和软删除接口，以及 `GET /api/miniapp/categories`。
- [x] 帖子列表/详情、文本发布、作者软删除、点赞/取消点赞、评论列表/创建/作者删除接口。
- [x] 当前用户与公开主页、资料更新、关注/取消关注、关注和粉丝列表接口。
- [x] 昵称 2–20 字白名单、30 天最多修改 3 次、简介 100 字及性别保密规则。
- [x] 公开帖子详情浏览量原子递增并返回 `viewCount`。
- [x] 后台帖子和评论分页、详情、隐藏/恢复和软删除接口；管理操作记录 `audit_logs`。
- [x] 创建、编辑、实际状态变化和首次删除写入审计日志。
- [x] 非管理员拒绝访问；非法 ID、分页和状态返回稳定错误码。

## 4. 已完成后台页面

- [x] 侧边栏新增“圈子管理”。
- [x] 圈子表格显示封面、名称、简介、成员数、状态和创建时间。
- [x] 支持关键词和状态筛选；页容量固定为 10，不显示页容量筛选控件。
- [x] 支持新增、编辑、启用、禁用和软删除。
- [x] 小程序用户详情展示当前加入的圈子及空状态。
- [x] 侧边栏新增“帖子分类”，支持分类列表、新增、编辑、启停和软删除。
- [x] 侧边栏新增“帖子管理”和“评论管理”；媒体和点赞作为帖子详情信息，不单独设管理菜单。
- [x] 复用现有后台表格、分页、空状态和移动端布局。
- [x] 后台账号、小程序用户、圈子页面共用分页与日期工具。

## 5. 验证状态

- [x] 服务端 TypeScript 类型检查。
- [x] 后台 TypeScript 类型检查。
- [x] PostgreSQL 增量 migration、圈子种子和成员回填执行。
- [x] Fastify 冒烟覆盖删除鉴权/参数、重复删除、删除后不可见、审计幂等，以及用户详情关系过滤。
- [x] Fastify 冒烟覆盖 Expo App 演示登录默认关闭、显式启用和令牌访问隔离。
- [x] 在空 PostgreSQL 数据卷验证全部 init 脚本顺序。
- [x] Playwright 验证桌面、移动端圈子页面和新增弹窗。
- [ ] 验证圈子与分类合并后的完整后台导航和所有页面。
- [ ] 完成帖子/评论接口 smoke 和后台页面交互验证。

## 6. 后续工作

- [x] 实现微信小程序 code2Session 登录、独立 JWT 签发及 Guard；真实微信 AppID/AppSecret 与请求域名须部署配置。
- [ ] 新增“运动搭子”预设圈子并验证重复执行 seed 不产生重复数据。
- [ ] 实现小程序圈子列表、详情、加入、退出和“我的圈子”。
- [x] 确认 `categories` 表示帖子业务主题，并落地首批六个主题。
- [x] 落地 `posts`、`post_media`、`post_likes`、`comments` 及首批接口和后台管理页。
- [x] 接入小程序登录签发流程、当前用户资料查询、微信服务错误映射与并发首登测试。
- [x] 增加仅非生产可用的 Expo App 演示登录；正式移动 App 身份体系仍待黑客松后设计。
- [x] 实现小程序昵称、简介和性别修改；当前微信登录不读取微信头像昵称。
- [x] 实现 C 版“我的”页和自动保存的“个人主页”页；长昵称省略，性别保密时不显示图标。
- [ ] 接入“我的”页帖子/点赞/收藏/足迹真实列表；当前四个标签使用界面演示数据。
- [ ] 实现服务端头像上传；当前未配置 API 时仅保存本机预览图。
- [ ] 对象存储确定后实现头像、圈子封面和帖子媒体上传；当前图文/视频发帖明确返回未配置错误。

## 7. 持续维护要求

后续任何社区字段、状态、接口或实现状态变更，必须同步更新本文件和 `docs/architecture/community-user-and-api-design-v1.md`。数据库细节同步到 `docs/architecture/community-database-design-v1.md`，HTTP 契约同步到 `docs/api/community-api-design-v1.md`。
