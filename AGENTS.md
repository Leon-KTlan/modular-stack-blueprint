# Project Agent Rules

本文件记录苍穹项目的长期工程约束。实现任务时同时遵守用户级规则和本文件。

## Community Documentation

- 社区身份、表关系、状态或接口发生变化时，必须同步更新：
  - `docs/architecture/community-user-and-api-design-v1.md`
  - `docs/development/community-module-todo-v1.md`
- 数据库细节同步到 `docs/architecture/community-database-design-v1.md`；HTTP 契约同步到 `docs/api/community-api-design-v1.md`。
- 开发过程中直接修正文档中的旧结论，不在文件末尾堆叠互相矛盾的补充说明。
- 文档必须区分“已实现”“已设计待实现”和“非目标”，不能把设计稿写成已上线能力。

## Database Conventions

- 所有数据库变更同时修改 SQL migration 和 `apps/server/src/schema.ts`，两者的字段、约束、索引及外键删除策略必须一致。
- 可复用的状态、`created_at`、`updated_at`、`deleted_at` 字段通过 `apps/server/src/schema-fields.ts` 管理；更新操作由 Service 或 Repository 显式刷新 `updated_at`。
- 社区实体主键和外键使用 PostgreSQL `BIGINT`；服务端内部使用 `bigint`，API 路径和 JSON DTO 使用十进制字符串，禁止 `Number(id)`。
- 状态在数据库中使用带 CHECK 约束的 `SMALLINT`，在 API 中使用可读字符串枚举。
- 索引必须对应已存在的查询路径，不为 `%keyword%` 包含匹配预先创建无效的普通 B-tree 索引。
- 软删除使用可空 `deleted_at`，普通查询默认过滤已删除记录；需要保留历史关联的表禁止用物理删除代替软删除。
- 管理员创建、编辑、启停、删除业务资源时写入 `audit_logs`；敏感值不得进入审计记录。

## Circle Boundaries

- 圈子由管理后台创建和维护，小程序用户不能创建圈子。
- `circles` 不保存 `creator_id`；`circle_members` 不保存 `OWNER`、`ADMIN` 或其他角色。
- 圈子名称允许重复，以圈子 ID 作为唯一标识。
- 成员关系以 `UNIQUE (circle_id, user_id)` 防重；退出保留记录并设置为 `left`，重新加入复用原记录。
- 圈子删除采用软删除：设置 `status=0` 和 `deleted_at`，保留成员关系；普通后台查询和小程序查询均不返回已删除圈子。
- 圈子禁用可恢复且仍在后台可见；圈子删除不提供恢复接口。重复删除按幂等 `204` 处理，且不重复写审计。
- 圈子和圈子成员分页默认 `page=1`，固定 `pageSize=10`；后台页面不提供页容量筛选。

## Mobile App Boundaries

- Expo Android 客户端位于 `apps/mobile`，微信小程序继续位于 `apps/miniapp`；移动端开发不得修改或移动 `apps/miniapp` 中的页面、资源和配置。
- `apps/mobile` 只复用后端 HTTP 契约、十进制字符串 ID、允许复制的静态资源和可核对的数据类型，不在黑客松阶段建立跨 Expo/微信小程序 UI 抽象层。
- 移动端中的社区主键与外键始终保持十进制字符串，禁止使用 `Number(id)` 或依赖 JavaScript 安全整数范围。
- 页面不得直接拼接服务端地址或自行管理认证头；HTTP 请求统一经过移动端 API client，JWT 统一存放在 Expo SecureStore。
- API 地址使用 `EXPO_PUBLIC_API_BASE_URL`；该值不得包含密钥。JWT 签名密钥、数据库凭证和第三方密钥只保存在服务端环境变量中。
- Expo Go 演示版不得引入 Expo Go 不包含且必须自定义原生构建的依赖。新增依赖前先核对当前 Expo SDK 兼容性。
- `POST /api/mobile/auth/demo` 仅用于非生产演示环境；必须同时要求显式开关和演示用户 ID，生产环境始终不可用，客户端不得内置固定 JWT 或账号密码。
- 服务端为移动端新增能力时必须保持现有 `/api/miniapp/*` 行为兼容；修改服务端后至少回归 server 与 miniapp typecheck。
- 演示数据和真实接口数据必须在代码与界面上可区分；未接通能力显示稳定的降级状态，不伪装成已经上线。
- 黑客松 V1 不包含应用商店发布、图片上传、私信、实时通知、搜索、推荐算法和微信/App 账号互通。

## Verification

- 后端类型检查：`pnpm --filter @cangqiong/server typecheck`
- 后台类型检查：`pnpm --filter @cangqiong/admin typecheck`
- Expo App 类型检查：`pnpm --filter @cangqiong/mobile typecheck`
- 全量构建：`pnpm build`
- 数据库冒烟：`pnpm --filter @cangqiong/server smoke`
