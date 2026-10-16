# 苍穹项目

当前是使用 **PostgreSQL** 持久化的用户管理闭环。后端通过 Drizzle ORM 访问用户和审计数据；新密码只保存 Argon2id 哈希，已有 bcrypt 哈希会在用户成功登录时自动升级。管理员使用 JWT 登录，后台可以查询、新增、重置密码、启用和禁用用户。

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
```

所有 `/admin-api/*` 请求都必须携带管理员登录后取得的 `Authorization: Bearer <token>` 请求头。

小程序用户由微信登录流程自动创建，管理后台只提供分页查询、详情查看以及启用/禁用，不提供手动新增和密码管理。

首次创建 PostgreSQL 数据卷时，Docker 会自动执行 `database/migrations/` 和 `database/seed/`。已有数据库的数据结构变更仍需通过新的 migration 管理，不能依赖重新创建数据卷。
