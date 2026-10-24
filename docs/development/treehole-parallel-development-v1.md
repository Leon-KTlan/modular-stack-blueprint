# 树洞 V1：三端开发与联调

- 契约版本：**1.0.0**。小程序视觉基准：**B「午夜电台」**。
- 已实现：共享类型包、生成/漂移检查、本地内存 Mock、HTTP 与三端类型消费测试。
- 三端代码已落地，完整验收待完成：用户已明确授权原生小程序、服务端及数据库、管理后台三端并行实施；计划见[三端实现计划](../superpowers/plans/2026-10-24-treehole-three-clients.md)。实现状态与实际验收结果分别记录，不能将 Mock 通过等同于生产能力已验证。
- 非目标：学生身份绑定、投票、精选、延期和身份关联查询。

## 1. 三端共同依据

| 文件 | 用途 |
|---|---|
| `docs/api/treehole-openapi-v1.json` | HTTP 结构的唯一来源，33 个 operationId、67 个 Schema |
| `docs/api/treehole-api-contract-v1.md` | 权限、状态、幂等、过期等语义 |
| `docs/api/treehole-examples-v1.json` | 50 个独立响应样例，不是连续案件数据 |
| `packages/api-contracts/treehole.d.ts` | 从 OpenAPI 生成的 DTO 与操作映射，禁止手改 |
| `docs/architecture/treehole-design-v1.md` | 产品决定、grill-me 结论、数据库与事务设计 |
| `docs/development/treehole-frontend-b-spec-v1.md` | 原生小程序复刻规范，配合 `docs/prototypes/treehole/b.html` 和 B 截图 |
| `docs/api/treehole-baseline-v1.json` | 上述契约、类型和原型材料的 SHA-256 清单 |

共同基线已由 SHA-256 清单固定在当前工作区，尚未创建 Git 提交。当前三端在同一工作区按目录所有权并行，避免从缺少未提交基线的分支开始；小程序负责 `apps/miniapp`，后台负责 `apps/admin`，服务端负责 `apps/server`、`database/migrations` 和 `.env.example`，协调方维护文档与共享契约。以后拆成独立分支时，先保存同一基线提交，再从该提交分支；不能只复制 OpenAPI 而漏掉类型包或 B 材料。基线之外的既有小程序/mobile 工作区改动必须保留。本轮没有提交、推送或部署授权。

进入仓库根目录，先安装并检查：

```sh
pnpm install --frozen-lockfile
pnpm treehole:check
pnpm treehole:test
```

`treehole:check` 校验 DTO 生成一致性和基线材料哈希；`treehole:test` 需要允许监听本机临时端口，并验证 Mock 状态与三端 TypeScript 引用。正式服务无需启动、无需数据库或 AI 凭证。受限环境无法监听端口时，可运行 `TREEHOLE_MOCK_TEST_TRANSPORT=memory pnpm treehole:test`；该模式复用相同 HTTP 请求处理器，但不验证实际网络监听。

## 2. 共享 DTO 的使用

三端均以 workspace 开发依赖引用 `@cangqiong/api-contracts`，该包只导出类型，没有运行时 JavaScript，不需要打包到小程序。

```ts
import type {
  CreatePost,
  TreeholeRequest,
  TreeholeResponse,
} from '@cangqiong/api-contracts/treehole'

const body: CreatePost = { content: '今天也有一点小进步。', ttlHours: 6 }
type CreateRequest = TreeholeRequest<'createTreeholePost'>
type CreateReceipt = TreeholeResponse<'createTreeholePost', 201>
type PostPage = TreeholeResponse<'listTreeholePosts', 200>
const detailRequest: TreeholeRequest<'getTreeholePost'> = {
  pathParams: { postId: '9007199254742000' },
}
```

`TreeholeSchemas` 映射全部 Schema；`TreeholeOperations` 映射方法、路径、request 和按状态码区分的 responses。204 的响应类型为 `undefined`。只用 `import type`，不要普通 import，也不要复制三份手写 DTO。

TS 保证结构、可空字段和字符串枚举；不会证明 UUID 格式、BIGINT 上限、字数、分数范围及所有条件字段合法。服务端仍需独立运行时校验。`tools/treehole/contract.mjs` 的校验器仅覆盖当前契约使用的 JSON Schema 子集，是开发工具，不接入生产鉴权或参数层。

## 3. 启动 Mock

```sh
pnpm treehole:mock
```

默认 `http://127.0.0.1:4010`；仅绑定本机，使用独立进程。端口冲突时：

```sh
TREEHOLE_MOCK_PORT=4011 pnpm treehole:mock
```

所有数据仅在内存中，重启/重置即清空。默认时钟跟随当前时间；种子数据以启动/重置时刻生成，固定日期样例会整体平移。响应保留 `Date` 和 `Cache-Control: private, no-store`；允许 localhost/127.0.0.1 网页跨域并暴露 Date。

以下全部为公开的开发假令牌，**不是 JWT，不得用于生产**：

| Bearer 值 | 身份 |
|---|---|
| `treehole-miniapp-demo` | 当前演示小程序用户 |
| `treehole-miniapp-other` | 第二名小程序用户，用于越权和不同匿名身份验证 |
| `treehole-admin-demo` | 演示后台管理员 |
| `treehole-non-admin-demo` | 已认证但无管理员权限，后台返回 403 |

例如：

```sh
curl http://127.0.0.1:4010/api/miniapp/treehole/posts \
  -H 'Authorization: Bearer treehole-miniapp-demo'

curl http://127.0.0.1:4010/api/miniapp/treehole/posts \
  -H 'Authorization: Bearer treehole-miniapp-demo' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 00000000-0000-4000-8000-000000000001' \
  --data '{"content":"今天也有一点小进步。","ttlHours":6}'
```

重试复用原幂等键，修改正文/期限后换新键。ID 直接保留字符串，不能转换成 Number。

## 4. 可操作的联合开发流程

默认不是每个接口各返回一份静态 JSON，而是共享内存状态：

1. 小程序 POST 投稿返回 201 `pending_review`，公开列表不显示；个人中心可查状态。
2. 管理后台 GET `/admin-api/treehole/reviews` 找到该目标，POST `/reviews/{reviewId}/decision`，Body 为 `{ "decision":"approve", "reason":"人工确认正常" }`，携带新 UUID 幂等键。
3. 小程序重新 GET 公开/本人接口即可看到新状态。首次通过时才起算 TTL，评论沿用父帖期限。
4. 通过后台处罚队列确认种子 `901`，小程序整个树洞返回限制，个人中心仍可申诉；管理员处理申诉后再刷新 Access。

种子资源：`123` 他人公开帖，`125` 本人待审帖，`124` 他人公开评论，`126` 删除占位，`127` 本人正常回复；`701` 待审核、`801` 待处理举报、`901` 待确认处罚。新建 ID 从大于 JS 安全整数范围开始，便于暴露误转 Number。匿名昵称仅用于页面演示，随帖子独立、同帖稳定。

Mock 为 33 个契约操作提供状态处理，支持分页筛选、点赞和举报去重、本人删除、评论必要占位、限额、幂等、人工审核、处罚确认/撤销、申诉通过/驳回、期限推进。请求与正式响应都会按对应 OpenAPI 校验；无效的 Mock 输出返回 500 并在终端标出契约问题。

## 5. 场景和开发控制接口

这些接口**只属于本地 Mock**，不写入 OpenAPI，不接入生产 router，没有认证要求。

重置（同时清空旧投稿、案件、幂等记录、样例覆盖和时间偏移）：

```sh
curl http://127.0.0.1:4010/__mock/treehole/reset \
  -H 'Content-Type: application/json' --data '{"scenario":"restricted"}'
```

| scenario | 初始状态 |
|---|---|
| `normal` | 默认公开内容、本人待审内容、待处理案件 |
| `empty` | 所有资源为空，供空态和首次投稿 |
| `pending` | 同 normal，供待审与超时演示 |
| `restricted` | 当前用户被临时限制 24 小时；本人旧内容隐藏 |
| `permanent` | 当前用户被永久限制 |
| `quota` | 当前用户当日帖子额度已用完 |

推进时钟（非负整数秒）：

```sh
curl http://127.0.0.1:4010/__mock/treehole/clock \
  -H 'Content-Type: application/json' --data '{"advanceSeconds":86400}'
```

下一次指定操作强制返回已有样例，用于 422/500/503、立即公开、永久限制等界面状态：

```sh
curl http://127.0.0.1:4010/__mock/treehole/example \
  -H 'Content-Type: application/json' \
  --data '{"operationId":"createTreeholePost","name":"pending","httpStatus":201}'
```

样例键取 `treehole-examples-v1.json` 的 `operationId/name/httpStatus`。只保留一项待覆盖样例，命中一次后清空；仍先校验身份、当前树洞访问资格和请求。204 可指定 `name:"noContent"`。样例只返回独立快照，不更新内存资源；不要用强制样例验证跨页面状态闭环，闭环使用 normal 场景和真实操作。

## 6. 三端分工与接入边界

| 开发方 | 负责范围 | 不应修改 |
|---|---|---|
| 小程序 | `apps/miniapp`；按 B 还原、树洞服务层、个人中心入口及错误/状态刷新 | 后台页面、生产审核规则、共享 DTO 生成产物 |
| 服务端 | `apps/server`；migration + Schema、运行时校验、事务/权限/worker/AI/审计 | 小程序与后台页面、擅改冻结字段 |
| 管理后台前端 | `apps/admin`；审核、举报、处罚、申诉队列与详情 | 客户端计分、真实身份关联、生产服务事务 |
| 契约维护 | OpenAPI、语义文档、样例、DTO 生成、Mock 与基线清单 | 单端私加字段后要求其他端追赶 |

本轮不切换既有普通社区请求到 Mock。前端接入树洞时应在树洞服务层显式选择地址，真实服务端与 Mock 保持相同路径与 DTO。

- 小程序：树洞专属服务层负责幂等头、结构化错误与服务器 Date；微信开发者工具本地调试需允许本地 HTTP，真机不能把自身的 localhost 当开发机。原生实现与验证状态在下方记录。
- 后台：现有 Vite `/api`、`/admin-api` 代理仍指向真实开发服务；开发模式登录页可选择“进入树洞独立 Mock 工作台”，或使用 `?treeholeMock=1`。专属服务直接请求 `VITE_TREEHOLE_MOCK_URL`（默认 `http://127.0.0.1:4010`），假令牌不写入正式登录存储，生产构建无该入口。
- 服务端：生产模块使用 PostgreSQL 持久化、真实 JWT 与审核 worker，不导入 Mock 内存状态；实现和隔离数据库验证另行记录，不能把 Mock 测试通过视为生产验收。

Mock 刻意不模拟：JWT 校验/微信登录、持久化与并发事务、真实 AI/词库分流、90 天计分/同批去重及跨处罚时间线重算、worker 租约、生产审计、证据留存与清理。审核 violation 可生成演示违规 ID，但不自动计算处罚；处罚通过种子候选单独演示。`recomputed=true` 仅表示已完成该模拟处罚的撤销与资格更新，不证明生产重算算法完成。Mock 不能用于生产、性能或数据库验收。

## 7. 契约变更与验收

发现契约缺口先统一修正文档、OpenAPI 和样例，再生成并检查：

```sh
pnpm treehole:generate
pnpm treehole:baseline
pnpm treehole:check
pnpm treehole:test
```

`treehole:baseline` 会重写哈希清单，只在变更经协调后执行，不能用它掩盖漂移；破坏性变更先确定版本。基线包含 A/C 比较文件是为了保持原型链接完整，视觉选择仍只有 B。

三端实施验证命令（使用已安装依赖时设置 `CI=true`）：

```sh
CI=true pnpm --filter @cangqiong/miniapp typecheck
CI=true pnpm --filter @cangqiong/admin typecheck
CI=true pnpm --filter @cangqiong/server typecheck
CI=true pnpm build
node --test apps/miniapp/tests/*.test.cjs
node --test apps/admin/tests/*.test.cjs
cd apps/server
node --import tsx --test src/wechat-login.test.ts src/treehole/*.test.ts
```

本轮服务端实施包含新增 migration 与 Schema；迁移及持久化流程须在独立临时测试数据库验证（本轮尚未执行），不自动迁移已有开发或生产数据库。现有社区 `smoke` 不能替代树洞事务与计分测试。


### 基础设施阶段验证记录（2026-10-24）

| 检查 | 结果 |
|---|---|
| `CI=true pnpm treehole:check` | 通过，生成 DTO 与契约及基线哈希一致 |
| `CI=true TREEHOLE_MOCK_TEST_TRANSPORT=memory pnpm treehole:test` | 21/21 通过，包含基线、契约、Mock 与三端类型消费测试 |
| 三端 `typecheck` | 均通过，运行时使用 `CI=true` |
| `CI=true pnpm build` | 通过 |
| 小程序现有 Node 测试 | 6/6 通过 |
| 服务端登录测试（`node --import tsx --test`） | 3/3 通过，无需 tsx CLI 的 IPC 监听 |
| `git diff --check` | 通过 |

本地依赖在 CI 模式安装，pnpm 非 CI 模式检测到 global virtual store 配置不同会尝试重装；本轮验证设置 `CI=true` 匹配已有安装配置，没有修改仓库配置。

最新完整 Mock 测试使用内存传输，复用服务端请求处理器；实际端口重跑因自动审批通道连接故障未执行，不能据此宣称最新代码已经完成真实网络联调。33 操作循环覆盖路由、样例派发和 Schema；投稿审核、幂等、删除/过期、举报、处罚及申诉等主要状态链路另有行为测试，不能将样例循环写成全部状态分支端到端验收。独立代码复核已完成，发现的五项问题已修复并补回归测试。

上述记录对应共同基线阶段。三端业务开发已经启动，最新实现及验收结果见本节后续记录；原有小程序与 mobile 改动保留，尚未创建 Git 提交。


### 三端实现交接（2026-10-24）

实现文件：

- 小程序：`pages/circles` 为 B 入口；`pages/treehole/index` 包含列表、详情、投稿与回执、本人内容、处罚及申诉；个人中心提供两个管理入口。原生 WXML/WXSS/TS，装饰资源在 `assets/treehole`，20 个调用在 `services/treehole.ts`。
- 服务端：`apps/server/src/treehole` 实现 33 操作、持久化事务、匿名视图、审核规则/AI/worker 和治理重算；新增 `database/migrations/009_create_treehole.sql`，同步 Schema；未迁移已有数据库。
- 后台：`TreeholePage.tsx` 与专属 service/rules/css 提供审核、举报、处罚、申诉四队列及 13 操作。成功或冲突后刷新当前状态，不确定失败同参重试复用键，20 秒超时；旧证据请求不能覆盖刷新后的案件。

#### OpenAI 兼容审核配置

在运行环境配置 `.env.example` 中以下变量，不将填好的密钥提交到仓库：

| ENV | 用途与默认值 |
|---|---|
| `TREEHOLE_AI_CHAT_COMPLETIONS_URL` | 完整 OpenAI 兼容 Chat Completions endpoint |
| `TREEHOLE_AI_MODEL` / `TREEHOLE_AI_API_KEY` | 平台模型名与密钥 |
| `TREEHOLE_AI_DAILY_REQUEST_LIMIT` | 必填正整数，上海自然日请求次数上限，重试也占预算 |
| `TREEHOLE_AI_TIMEOUT_MS` | 默认 15000 毫秒 |
| `TREEHOLE_AI_MAX_OUTPUT_TOKENS` | 默认 1000 |
| `TREEHOLE_RULE_VERSION` / `TREEHOLE_RISK_PATTERNS` | 人工审定的规则版本与 `\|` 分隔字面风险词；未配全时全部进入 AI/人工待审 |
| `TREEHOLE_SAMPLE_RATE` | 0–1 的低风险抽查比例；未设置不抽查 |

配置审核规则后，明显正常内容规则通过，命中风险词/电话/URL 等进入 AI；抽查另按比例执行。规则缺失、AI 配置缺失、超时、非法输出或预算耗尽均不假装通过、不扣分。管理员可接手，未公开投稿仍受 24 小时待审上限约束。人工每天至少处理一次队列；未确认的正文/证据保留期限不硬编码，worker 不运行物理清除。

数据库完成相应迁移且普通服务端配置可用后，运行审核进程：

```sh
CI=true pnpm --filter @cangqiong/server treehole:worker
```

该进程与 HTTP 服务分开启动；每轮关闭超时投稿，短事务领取任务并预留预算，事务外调用 AI，回写校验版本及租约。请求不等待 AI。未提供真实平台配置，本轮没有外部 AI 调用验证。

#### 独立开发与持久化验证

小程序 `services/treehole-config.ts` 默认 `enabled:false`；只在 `develop` 环境显式启用后使用 `127.0.0.1:4010` 和假令牌。生产基地址仍沿用既有 `services/api.ts`，须按实际部署填写，不能将默认示例域名当可联通服务。后台独立 Mock 入口见第 6 节。

持久化 harness 位于 `apps/server/src/treehole/integration.ts`，只接受 localhost、显式端口及名为 `treehole_test` 的隔离库；会重置该库 schema。**不得指向已有业务数据库**。在允许本地 TCP 的环境中，从 `apps/server` 执行：

```sh
TREEHOLE_TEST_DATABASE_URL=postgresql://treehole_test@127.0.0.1:53982/treehole_test node --import tsx src/treehole/integration.ts
```

本轮未执行该命令：审批通道断连并出现加密输出解码故障，自动审批未完成，操作未执行；不是已通过或安全否决。也未完成真实浏览器网络联调、微信业务编译/截图/键盘安全区检查。后续须完成上述验证及真实平台审核调用，才能声明完整验收。


#### 三端代码检查结果（2026-10-24）

| 检查 | 当前结果 |
|---|---|
| 小程序全部 Node 测试 | 18/18（含原有热榜 3 项），覆盖 WXML 条件语法、请求/幂等/受限/到期及迟到请求竞态；树洞 WXML 已用本机微信工具自带 wcc 编译通过，完整预览仍待验收 |
| 后台全部 Node 测试 | 12/12，含旧证据竞态与请求超时保留幂等键 |
| 服务端树洞测试 + 既有微信登录测试 | 15/15，其中树洞 12 项；使用 HTTP inject/AI fetch 桩及纯规则，不含真实 PostgreSQL |
| 三端 typecheck、全量 build | 通过 |
| 共同基线/DTO check、内存 Mock tests | 通过，Mock 21/21 |
| 差异空白检查 | 通过 |

独立复核发现的后台迟到证据/超时、小程序迟到请求/加载状态、处罚候选 CHECK/队列筛选/同链临时限制，以及 AI 严重待审建议/空词表问题均已修正；页面竞态和 AI/规则边界补有回归测试。永久审查的同周期人工处置去重与已执行等级分离，排除已撤销处罚或触发违规，补有精确 90 天边界测试及未运行的集成场景。SQL 事务相关修正经过代码复核，尚无数据库执行证据。未运行原有社区 smoke，因为它访问真实配置数据库，不能作为本轮隔离验收替代。

临时测试容器名为 `cangqiong-treehole-test-20261024`，使用 tmpfs，仅供上述隔离 harness；不是原有 `cangqiong-postgres`。测试结束后仅清理此前者，不操作原有业务容器。


临时容器清理命令也遇到相同自动审批技术故障，未执行；容器可能仍运行。审批通道恢复后执行以下命令，仅移除本轮测试容器：

```sh
docker rm -f cangqiong-treehole-test-20261024
```
