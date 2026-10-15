# 苍穹项目

当前是**本地文件存储版**用户管理闭环。后端将用户数据保存在 `apps/server/data/users.json`；首次运行自动生成 3 条演示数据，重启后仍保留。文件被 Git 忽略，新密码仅存 Argon2id 哈希，已有 bcrypt 哈希会在用户成功登录时自动升级。管理员使用 JWT 登录，后台可以查询、新增、重置密码、启用和禁用用户。

> 不需要 MySQL 或 Docker。现有 `database/migrations/` 和 `docker-compose.yml` 暂时保留为将来接入 MySQL 的草案，不会在当前启动流程中使用。旧的架构文档中 PostgreSQL/Session/RBAC 方案亦是历史草案，以此 README 的当前实现为准。

## 启动

```bash
pnpm install
test -f apps/server/.env || cp apps/server/.env.example apps/server/.env
# 如刚复制了模板，请将 JWT_SECRET 改成随机长密钥
pnpm --filter @cangqiong/server seed
pnpm dev:server
```

另开终端：

```bash
pnpm dev:admin
```

打开 <http://localhost:5173>。本机已生成随机 `JWT_SECRET`；换机器时，请使用随机密钥填写 `apps/server/.env`（该文件不会提交）。

仅供本地演示的账号：`admin / Admin123!`，普通用户：`leon / User123!`，禁用用户：`alice / User123!`。实际部署前必须移除演示用户或重设密码，并替换文件存储方案。

## 接口

```text
POST /api/auth/login
GET  /api/users/me
PATCH /api/users/me
GET  /admin-api/users
POST /admin-api/users
POST /admin-api/users/:id/status
POST /admin-api/users/:id/password-reset
```

本地 JSON 文件只适合单进程开发体验：不支持多个后端实例并发写入，也没有数据库级事务和备份机制。以后换回 MySQL 时，主要替换 `apps/server/src/db.ts` 中的数据访问实现，接口和后台页面可以保留。
