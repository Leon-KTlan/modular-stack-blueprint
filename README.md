# 苍穹项目

当前使用 **PostgreSQL** 持久化后台账号、小程序用户、圈子、成员关系和审计数据。后端通过 Drizzle ORM 访问数据库；新密码只保存 Argon2id 哈希，已有 bcrypt 哈希会在用户成功登录时自动升级。管理员使用 JWT 登录，后台可以管理账号、小程序用户以及学习、表白、二手等预设圈子。

管理员重置密码时，密码更新、旧 JWT 失效和审计日志写入在同一个 PostgreSQL 事务中完成。审计日志不记录密码或密码哈希。

## 启动

```bash
pnpm install
test -f .env || cp .env.example .env
test -f apps/server/.env || cp apps/server/.env.example apps/server/.env
# 将两个 .env 中的 PostgreSQL 密码设为相同的随机值，并设置随机 JWT_SECRET
# 如果 5432 已被占用，同时修改根目录 POSTGRES_PORT 和 DATABASE_URL 中的端口
docker compose up -d --wait
pnpm --filter @cangqiong/server seed
pnpm dev:server
```

另开终端：

```bash
pnpm dev:admin
```

打开 <http://localhost:5173>。`.env` 和 `apps/server/.env` 不会提交到 Git。

仅供本地演示的账号：`admin / Admin123!`，普通用户：`leon / User123!`，禁用用户：`alice / User123!`。实际部署前必须移除演示用户或重设密码。

如需测试用户分页，可以幂等写入 72 个演示用户（密码均为 `Demo12345!`，每个密码使用独立的 Argon2id 随机盐）：

```bash
pnpm --filter @cangqiong/server seed:demo
```

## 接口

```text
POST /api/auth/login
GET  /api/users/me
PATCH /api/users/me
GET  /admin-api/users?page=1&username=demo
POST /admin-api/users
POST /admin-api/users/:id/status
POST /admin-api/users/:id/password-reset
GET  /admin-api/miniapp-users?page=1&pageSize=10&keyword=&status=active
GET  /admin-api/miniapp-users/:id
POST /admin-api/miniapp-users/:id/status
GET  /admin-api/circles?page=1&keyword=&status=active
POST /admin-api/circles
GET  /admin-api/circles/:id
PATCH /admin-api/circles/:id
DELETE /admin-api/circles/:id
POST /admin-api/circles/:id/status
GET  /admin-api/circles/:id/members?page=1
```

所有 `/admin-api/*` 请求都必须携带管理员登录后取得的 `Authorization: Bearer <token>` 请求头。

小程序用户由微信登录流程自动创建，管理后台只提供分页查询、详情查看以及启用/禁用，不提供手动新增和密码管理。

圈子只由管理后台创建和维护，小程序用户不能创建圈子。圈子列表和成员分页固定每页 10 条，后台不提供页容量筛选。删除圈子采用软删除：小程序端和普通后台查询不再显示该圈子，但成员关系会保留。小程序用户详情只返回状态为已加入且圈子未删除的关系。

新数据库会幂等写入“学习、表白、二手”三个预设圈子。`003_seed_circle_members.sql` 是一次性数据回填：按用户 ID 将执行时已有的正常小程序用户确定性分配到 1–2 个预设圈子；禁用用户不会分配，重复执行不会重复插入。

首次创建 PostgreSQL 数据卷时，Docker 会自动执行 `database/migrations/` 和 `database/seed/`。已有数据库的数据结构变更仍需通过新的 migration 管理，不能依赖重新创建数据卷。

已有本地数据库增量应用圈子表：

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U cangqiong -d cangqiong < database/migrations/004_create_circles.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U cangqiong -d cangqiong < database/seed/002_seed_circles.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U cangqiong -d cangqiong < database/migrations/005_add_circles_deleted_at.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U cangqiong -d cangqiong < database/seed/003_seed_circle_members.sql
```
