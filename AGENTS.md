# Project Agent Rules

本文件记录苍穹项目的长期工程约束。实现任务时同时遵守用户级规则和本文件。

## Community Documentation

- 社区身份、表关系、状态或接口发生变化时，必须同步更新：
  - `docs/architecture/community-user-and-api-design-v1.md`
  - `docs/development/community-module-todo-v1.md`
- 数据库细节同步到 `docs/architecture/community-database-design-v1.md`；HTTP 契约同步到 `docs/api/community-api-design-v1.md`。
- 树洞接口以 `docs/api/treehole-api-contract-v1.md` 和 `docs/api/treehole-openapi-v1.json` 为固定基线；修改 HTTP 契约时同步两者与 `docs/api/treehole-examples-v1.json`，不能仅改调用方。
- 开发过程中直接修正文档中的旧结论，不在文件末尾堆叠互相矛盾的补充说明。
- 文档必须区分“已实现”“已设计待实现”和“非目标”，不能把设计稿写成已上线能力。

## Treehole Frontend Baseline

- 用户已于 2026-10-24 选定树洞 **B「午夜电台」**，后续小程序前端以 B 为复刻基准；不得自行改成 A/C、混搭其他方案或重新设计。
- 开发树洞前必须阅读 `docs/development/treehole-frontend-b-spec-v1.md`，打开 `docs/prototypes/treehole/b.html`，检查关联 `styles.css`、`app.js` 与 `previews/b-*.png`；业务行为同时遵守 `docs/architecture/treehole-design-v1.md`。
- 用户已明确授权三端并行开发：原生小程序、服务端及数据库、管理后台。共同基线、共享 DTO 和开发 Mock 已落地；实施计划见 `docs/superpowers/plans/2026-10-24-treehole-three-clients.md`。不需要再次确认已经选定的 B 方案；实现、验证与部署状态必须分别记录。
- 实现须用原生 WXML/WXSS/TS，逐页对照 B 的结构、颜色、间距、字号、插画和状态；HTML 中的比较工具条、模拟状态栏和微信胶囊不属于正式页面。不能只换深色主题就宣称复刻完成。

## Treehole Contract and Development Tools

- HTTP 结构以 `docs/api/treehole-openapi-v1.json` 为唯一来源；语义见 `docs/api/treehole-api-contract-v1.md`，三端交接见 `docs/development/treehole-parallel-development-v1.md`。
- `packages/api-contracts/treehole.d.ts` 由 `pnpm treehole:generate` 生成，禁止手改；三端使用 `import type`，不复制 DTO。
- `pnpm treehole:mock` 启动独立本机内存 Mock；假令牌、开发控制接口和内存状态不得接入生产。Mock 通过不代表生产事务、计分或 AI 已实现。
- 契约变更同步语义文档、OpenAPI、样例、生成 DTO 和 Mock；协调后用 `pnpm treehole:baseline` 更新基线，执行 `pnpm treehole:check` 与 `pnpm treehole:test` 验证。

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

## Verification

- 后端类型检查：`pnpm --filter @cangqiong/server typecheck`
- 后台类型检查：`pnpm --filter @cangqiong/admin typecheck`
- 全量构建：`pnpm build`
- 数据库冒烟：`pnpm --filter @cangqiong/server smoke`
