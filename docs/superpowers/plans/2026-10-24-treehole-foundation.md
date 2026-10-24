# 树洞共同基线、DTO 与开发 Mock 实施计划

> **For agentic workers:** 按本计划逐项实施；本次用户已授权直接落地，由当前会话执行，不等待再次批准。

**Goal:** 两套前端和服务端可以使用相同的契约、类型和可操作的本地 Mock 独立开发。

**Architecture:** OpenAPI 是结构唯一来源；无运行时代码的 workspace 包导出生成 DTO；独立 Node HTTP 服务模拟树洞接口。共同基线以可校验文件清单保存在当前工作区；三端开始分支开发前再保存范围明确的 Git 提交。

**Tech Stack:** 原有 pnpm/TypeScript；Node 内置 HTTP、test、crypto；不新增第三方运行时依赖。

**Spec:** `docs/api/treehole-api-contract-v1.md`、`docs/api/treehole-openapi-v1.json`、`docs/development/treehole-frontend-b-spec-v1.md`。

## Global Constraints

- HTTP 契约保持 1.0.0，不新增正式业务接口。
- ID 始终为十进制字符串；不转为 Number。
- Mock 与生产服务独立，不连接数据库、AI 或真实身份服务。
- B「午夜电台」视觉基线不变；不改业务页面。
- 不提交本轮之前的小程序、mobile 等无关改动。
- 不创建三端开发任务或启动正式业务开发。

## Review Focus

- 生成器不能静默忽略新增的结构关键字；TS 不表达的范围、条件约束必须由运行时校验补充。
- 投稿重试不能重复创建，删除/过期不能通过回执或本人详情泄露正文。
- Mock 样例时钟整体平移，不能因固定日期导致页面一打开全过期。
- 受限时业务接口拦截，但个人中心仍可申诉；管理员与小程序令牌不能互换。
- 所有正式 Mock 响应都必须通过对应 OpenAPI 响应校验；Mock 控制接口不能成为生产接口。

### Task 1: 契约工具与共享 DTO

**Files:** 新增 `tools/treehole/contract.mjs`、`generate.mjs`、`contract.test.mjs`；新增 `packages/api-contracts/package.json`、`treehole.d.ts`；修改 workspace、三端 package.json、锁文件和根 scripts。

**Interfaces:** 导出 `TreeholeSchemas`、`TreeholeOperations`、`TreeholeRequest<K>`、`TreeholeResponse<K,S>`；工具提供 `validate(schema,value)`、`operations`、`responseSchema(operation,status)`。

- [x] 先写测试：合法样例通过，未知字段/越界 ID/条件字段/错误计分范围失败；生成器输出可被三端 TypeScript 消费。
- [x] 执行 `node --test tools/treehole/contract.test.mjs`，确认缺少实现导致失败。
- [x] 实现仅覆盖当前 OpenAPI 使用的 JSON Schema 结构，未知关键字明确失败；生成 DTO 和操作映射。
- [x] 添加 workspace 类型依赖，离线安装；执行类型检查与生成一致性检查。

### Task 2: 独立状态 Mock

**Files:** 新增 `tools/treehole/mock-state.mjs`、`mock-server.mjs`、`mock.test.mjs`。

**Interfaces:** `createMockServer(options)` 返回 Node HTTP server；默认 `127.0.0.1:4010`；开发控制路由统一 `/__mock/treehole/*`。

- [x] 先写 HTTP 测试：创建待审→后台审批→公开；幂等/删除/评论占位/过期；点赞/举报；处罚确认→申诉→后台处理；参数、认证与分页边界。
- [x] 运行测试确认失败，再实现 Mock；所有 33 个操作都有处理，按请求/响应契约校验。
- [x] 提供场景重置、样例覆盖和时钟推进；覆盖错误态不污染正式契约。
- [x] 执行测试，确认 Date/no-store、CORS、204 空响应、状态刷新均符合约定。

### Task 3: 基线与三端交接

**Files:** 新增 `docs/development/treehole-parallel-development-v1.md`、`docs/api/treehole-baseline-v1.json`；同步相关社区文档、AGENTS 和契约中的实现状态。

- [x] 记录可运行命令、开发假令牌、类型导入、Mock 控制方式、各端所有权和业务实现限制。
- [x] 基线清单记录契约、DTO、产品设计和 B 复刻材料的 SHA-256，检查漂移。
- [x] 执行 `CI=true pnpm treehole:check`、内存传输 `treehole:test`（21/21）、三端类型检查及 `CI=true pnpm build`；现有小程序 6 项、服务端 3 项 Node 测试通过。最新真实 HTTP 监听测试未执行，边界见交接文档。
- [x] 做范围审阅；本轮基础设施及已确认树洞基线材料保存在工作区和哈希清单，未创建 Git 提交，原有无关工作区改动保留。三端分支开发前再保存共同基线提交。
