# 圈子内容模块实施状态

- **文档版本**：V1.1
- **文档状态**：Active
- **最后更新**：2026-10-16

## 1. 已确认产品规则

- [x] 圈子由管理后台创建和维护，小程序用户不能创建。
- [x] 首批预设圈子为“学习”“表白”“二手”。
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
- [x] `002_seed_circles.sql`：幂等写入学习、表白、二手。
- [x] `003_seed_circle_members.sql`：幂等回填正常用户的 1–2 个圈子关系。
- [x] Drizzle Schema 与 SQL migration 同步。
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
- [x] 创建、编辑、实际状态变化和首次删除写入审计日志。
- [x] 非管理员拒绝访问；非法 ID、分页和状态返回稳定错误码。

## 4. 已完成后台页面

- [x] 侧边栏新增“圈子管理”。
- [x] 圈子表格显示封面、名称、简介、成员数、状态和创建时间。
- [x] 支持关键词和状态筛选；页容量固定为 10，不显示页容量筛选控件。
- [x] 支持新增、编辑、启用、禁用和软删除。
- [x] 小程序用户详情展示当前加入的圈子及空状态。
- [x] 复用现有后台表格、分页、空状态和移动端布局。
- [x] 后台账号、小程序用户、圈子页面共用分页与日期工具。

## 5. 验证状态

- [x] 服务端 TypeScript 类型检查。
- [x] 后台 TypeScript 类型检查。
- [x] PostgreSQL 增量 migration、圈子种子和成员回填执行。
- [x] Fastify 冒烟覆盖删除鉴权/参数、重复删除、删除后不可见、审计幂等，以及用户详情关系过滤。
- [x] 在空 PostgreSQL 数据卷验证全部 init 脚本顺序。
- [x] Playwright 验证桌面、移动端圈子页面和新增弹窗。

## 6. 后续工作

- [ ] 实现微信登录和小程序专用 JWT Guard。
- [ ] 实现小程序圈子列表、详情、加入、退出和“我的圈子”。
- [ ] 确认 `categories` 的业务含义和首批分类。
- [ ] 落地 `categories`、`posts`、`post_media`、`post_likes`、`comments`。
- [ ] 对象存储确定后实现头像和圈子封面上传；在此之前只保存受控永久地址。

## 7. 持续维护要求

后续任何社区字段、状态、接口或实现状态变更，必须同步更新本文件和 `docs/architecture/community-user-and-api-design-v1.md`。数据库细节同步到 `docs/architecture/community-database-design-v1.md`，HTTP 契约同步到 `docs/api/community-api-design-v1.md`。
