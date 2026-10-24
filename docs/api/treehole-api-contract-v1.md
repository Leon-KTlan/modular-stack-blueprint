# 树洞 V1：前后端接口契约

- **契约版本**：1.0.0；2026-10-24 固定为独立开发基线。
- **实现状态**：契约固定，三端已按契约实现并进入验收；未部署，真实数据库与原生界面仍待验证。
- **适用方**：原生小程序、管理后台前端、服务端、Mock 与联调验收。
- **当前实现**：契约、共享 DTO、基线、独立 Mock、原生页面、后台工作台、服务端 33 操作与数据库定义、审核 worker 和 OpenAI 兼容适配已落地；真实数据库/AI/原生联调尚未验收。接入方式见[三端开发说明](../development/treehole-parallel-development-v1.md)。

## 1. 唯一依据与变更规则

| 材料 | 职责 |
|---|---|
| [OpenAPI 3.1 文件](treehole-openapi-v1.json) | 固定全部 33 个操作的路径、请求、必填字段、DTO、枚举、认证、HTTP 状态及示例；结构校验与生成工具以此为准 |
| 本文 | 固定权限、时间、可见性、并发和状态等结构 Schema 无法完整表达的语义 |
| [响应样例](treehole-examples-v1.json) | 从 OpenAPI 响应示例整理出的 50 个可消费样例；用 `operationId + httpStatus + name` 定位 |
| [产品与后端规范](../architecture/treehole-design-v1.md) | 已确认产品决定、grill-me 决策、数据库和事务设计 |
| [B 小程序复刻规范](../development/treehole-frontend-b-spec-v1.md) | 视觉、布局、交互和原生适配，不用 HTML 演示数据替代真实 DTO |

业务规则以产品规范为准；HTTP 字段以本文与 OpenAPI 为准。发现冲突必须同步修正，不能由任意一端自行补字段。字段修改同步更新 OpenAPI、本文及响应样例，再更新调用方。所有输入对象禁止未知字段，新增输入字段也要同步后端校验；输出可增加向后兼容字段，客户端应容忍未知输出字段。删除/重命名字段、改变字段语义、修改枚举必须先协调调用方，不能直接覆盖已冻结约定。

本次新增的技术约定包括：本人单条投稿查询、明确的后台 DTO 与操作回执、评论平铺分页、错误详情结构及服务器时间校准。均用于补齐既定功能，不新增产品模块。保留期限、身份关联查询和特殊求助流程继续待确认，不为这些事项编造接口。

## 2. 通用规则

### 2.1 认证与权限

| 路径区域 | 认证 | 树洞受限后 |
|---|---|---|
| `/api/miniapp/treehole/*` | 正常小程序账号 JWT | 全部返回 `403 TREEHOLE_RESTRICTED`，包括浏览、点赞、举报 |
| `/api/miniapp/me/treehole/*` | 正常小程序账号 JWT，资源限本人 | 可查询访问资格、处理本人未消失内容、处罚与申诉 |
| `/admin-api/treehole/*` | 后台 JWT 且为管理员 | 按案件处理；不获得真实身份查询能力 |

认证头统一 `Authorization: Bearer <token>`。两种 JWT 不可互换；缺失、失效、身份类型不匹配返回 `401 UNAUTHORIZED`，后台已认证但非管理员返回 `403 FORBIDDEN`。整个小程序账号被禁用时沿用现有业务认证失败 `401`，不等同于树洞限制。小程序认证未配置返回 `503 MINIAPP_AUTH_NOT_CONFIGURED`。

先检查认证与树洞访问限制，再返回内容或幂等回执。个人中心查询不经过树洞限制 Guard，但不能借此查看他人内容或处罚。后台使用案件 ID 由服务端定位用户，不返回真实用户 ID、社区昵称、头像、微信身份或跨帖匿名标识。

### 2.2 参数、响应与分页

- JSON 使用 camelCase；成功直接返回资源或 `{ items, pagination }`，不新增 `data/code/message` 包装。
- Path 与 JSON 的业务 ID 均为字符串，匹配 `^[1-9][0-9]*$`，范围 `1..9223372036854775807`；禁止 `Number(id)`。Schema 的 `maxLength=19` 不能替代运行时 BIGINT 上限校验。
- 时间为以 `Z` 结尾的 ISO 8601 UTC 字符串；可空字段明确返回 `null`，不可自行省略。请求不得用 `null` 替代可选 ID 或文本。
- Query 只允许该接口声明的参数。`page` 默认 1，范围 `1..2147483647`；`pageSize` 可省略或传 `10`，其他值报 `400 VALIDATION_ERROR`。HTTP Query 使用十进制整数字面量，拒绝小数、负数和科学计数法。
- 每页固定 10 条，无页容量选择。空列表 `items=[]`、`total=0`、`totalPages=0`；超出末页返回空 items，仍返回真实总量，不报错。
- `pagination.total` 是该次请求按当前权限、可见性和过滤条件匹配的节点数；列表与 total 在同次查询读取一致的时刻。自然过期和新内容可能导致跨次翻页重复/遗漏，前端按 ID 去重；V1 不提供快照或游标。
- 公开帖子：`publishedAt DESC,id DESC`；评论：`publishedAt ASC,id ASC`；本人投稿：`submittedAt DESC,id DESC`；本人处罚/申诉：`createdAt DESC,id DESC`（处罚 DTO 不另返回 createdAt）。
- 后台审核、举报、处罚队列：`createdAt ASC,id ASC`；申诉：超时未结优先，再按 `createdAt ASC,id ASC`。筛选省略表示所有状态，不传空字符串。
- 全部树洞成功及错误响应均 `Cache-Control: private, no-store`，并保留标准 HTTP `Date`。前端可据 Date 校准倒计时，不能凭本地时间决定权限或过期。
- DELETE 成功为 `204` 时响应体为空；点赞取消例外，返回 `200 LikeResult`。无请求体的接口不发送 JSON 业务参数。

### 2.3 文本与限额

正文先将 CRLF/CR 统一为 LF，再 trim；长度按 Unicode 码点计算（前端可用 `Array.from(text).length`），不按 UTF-16 `text.length`。帖子 1–1000、评论/回复 1–500 码点。允许 LF 换行，拒绝其他 C0/C1 控制字符；纯空白拒绝。理由/说明 trim 后校验，举报说明 1–500、申诉及人工处理原因 1–1000 码点。OpenAPI 长度约束针对规范化后的输入，服务端必须先规范化再校验。

正文按纯文本显示，不解析 HTML/Markdown，不自动生成可点击外链。正常负面情绪不等于违规。

帖子 `ttlHours=1|6|12|24`，默认 24；仅服务端在首次公开时设置有效期，不从提交时间开始，不接受客户端提交 `publishedAt/expiresAt/status/userId/nickname/points` 等字段。评论不设置独立 TTL，随父帖到期。

限额为上海自然日每人帖子 5 篇、评论和回复合计 50 条；新帖间隔 60 秒、评论/回复间隔 10 秒。持久化接受即消耗，拒绝/删除不退还；参数、认证、频率失败和事务未提交不消耗。前端按钮防连点仅改善体验，最终由服务端事务保证。

## 3. 幂等与重试

| 操作 | 幂等方式 | 重放结果 |
|---|---|---|
| 新帖子、新评论 | 必填 UUID `Idempotency-Key`；作用域为当前用户＋资源类型＋键 | 同键同参仍 `201`，返回当前 Receipt，不重复计限额或入队 |
| 新申诉 | 必填 UUID；当前用户＋申诉创建＋键 | 同键同参 `201`，返回当前 Appeal，不再创建 |
| 后台决定/撤销 | 必填 UUID；案件类型＋案件 ID＋操作 | 同键同参 `200`，返回第一次操作的无正文结果快照，不重复审计 |
| 本人删除 | 资源归属与生命周期保证幂等 | 本人已删除/到期骨架仍 `204`；不存在/非本人 `404` |
| 点赞/取消 | 当前用户与帖子唯一关系 | 重复操作 `200`，返回当前 liked 与 likeCount |
| 举报 | 当前用户与目标唯一关系，不要求幂等头 | 首次 `201`；重复 `200`，不覆盖旧描述，返回现有状态 |

缺失必填幂等头或格式不合法返回 `400`。同键不同规范化参数 `409 IDEMPOTENCY_CONFLICT`；默认 TTL 的省略和显式 24 视为同参。正文换行/trim 统一后计算摘要；评论还包括父帖 ID 和回复目标；申诉包括处罚 ID 和理由。

相同内容但新键属于新投稿，仍计次数。客户端遇到超时/断网/5xx，保留原键重试；用户修改请求字段后创建新键。后台案件已经终结，使用新键再次决定返回 `TREEHOLE_CASE_ALREADY_RESOLVED`，不能覆盖旧决定。

投稿键和摘要至少保留 24 小时，具体骨架清除期限按待确认存储政策执行，不能承诺永久去重。过期/删除/隐藏投稿的同键重放只返回 `status=unavailable`、`reasonCode=content_unavailable`，回执始终无正文；公开与本人详情继续 `404`。重放仍先检查当前访问权限。评论创建的同键重放在确认参数和既有归属后，先于父帖可见性及新提交限额检查，父帖到期时也只返回 unavailable 回执；仅新投稿检查父帖当前是否可见。

申诉同键重放在认证与归属检查后优先识别已接受记录：即使窗口后来关闭、处罚后来撤销，仍返回该申诉当前状态，不重复创建。新键才检查申诉窗口和待处理申诉。后台重放是历史操作快照，不代表案件当前状态；需要当前状态时 GET 详情。

## 4. DTO 与状态含义

完整字段、必填、可空与枚举见 OpenAPI `components.schemas`；以下是调用方必须遵守的含义。

| Schema | 用途与边界 |
|---|---|
| `Receipt` | `{id,status,submittedAt,publishedAt,expiresAt,reasonCode}`；投稿创建/重放专用，无正文 |
| `Post` | 公开正文、匿名作者、首次公开/到期时间、点赞/评论计数及本人操作标记 |
| `Comment` | `published` 正文，或 `deleted` 占位；占位 `content=null,author=null,canDelete=false` |
| `MyPost` | Receipt（排除 unavailable）＋`content:string|null,ttlHours,canDelete` |
| `MyComment` | Receipt（排除 unavailable）＋`postId,replyToCommentId,content:string|null,canDelete` |
| `Access` | `{canEnter:true,restriction:null}` 或 `{canEnter:false,restriction:Restriction}` |
| `Penalty / PenaltyDetail` | 本人处罚通知；详情额外返回脱敏 evidence，不返回违规分或原帖浏览入口 |
| `Appeal` | 申诉理由、状态、处理原因/时间及是否超时 |
| `Admin*` | 后台案件数据，包括必要分值/规则依据；仍不包含账号身份或跨帖作者索引 |
| `*DecisionResult / RevokePenaltyResult` | 无正文、无身份的操作回执，可作为幂等快照；重新 GET 获取当前详情 |

### 4.1 投稿状态

| status | 含义 | 前端行为 |
|---|---|---|
| `published` | 已公开且当前可见 | 可刷新列表/进入详情 |
| `pending_review` | 已接受，等待 AI/人工；也可能是已公开内容暂停复查 | 显示待审，不插入公开列表、不承诺完成时间 |
| `rejected` | 内容审核拒绝 | 本人显示审核未通过，reasonCode 为 content_violation |
| `closed` | 从未公开，提交后 24 小时仍未通过，已关闭 | 本人显示审核超时关闭，reasonCode 为 review_timeout |
| `unavailable` | 仅创建幂等重放：已到期、删除或隐藏 | 无正文，不恢复列表，不再跳原帖 |

正常 published/pending_review 的 reasonCode 为 null；rejected/closed/unavailable 使用表中固定码，不返回规则词表、AI 响应或违规分。正文清除后 MyPost/MyComment 的 content 可为 null；不能将所有 null 一律解释为删除。

帖子从未公开时 `publishedAt/expiresAt=null`；已公开后复查保留两个原时间。评论从未公开时 `publishedAt=null`，但 `expiresAt` 使用父帖有效期；评论公开时间不改变父帖到期时间。父帖不可访问时本人评论也不返回，不用 closed 状态保留过期父帖历史。

待审、拒绝、关闭且未主动删除/隐藏的本人投稿可以出现在本人列表；到期、主动删除和处罚隐藏一律排除，单条查询统一 404。从未公开的拒绝/关闭内容没有公开 TTL，不自行虚构“24 小时后正文彻底清除”；实际保留期限仍待确认。

### 4.2 匿名、评论与计数

公开作者固定为 `{nickname,isOp,isMe}`，同帖昵称不变、跨帖独立，不新增作者 ID。帖子的 isOp 恒为 true；评论仅楼主为 true；isMe 是当前登录者标记。本人可见且有权删除的正文 canDelete=true，他人正文为 false。

评论以所有层级平铺分页，replyToCommentId 指向直接回复目标；发帖评论时省略该字段，传值时须为同帖当前可见正文。不得回复删除占位或不可见目标。分页内不保证目标同时出现；前端用普通“回复”提示，不凭空补齐身份或调用不存在的单评论公开详情接口。

存在正常后代回复的删除/违规隐藏节点保留必要占位，所有原正文、昵称、isOp/isMe 均不返回；无正常后代的节点不出现。占位可计入评论分页 total，但不计入 Post.commentCount。commentCount 仅统计当前公开正常评论/回复正文；likeCount 仅统计当前关系，无点赞者名单。

### 4.3 访问限制、处罚与申诉

Restriction 含 `penaltyId,type,reason,restrictedCapabilities,endsAt,appealDeadlineAt,canAppeal`。type 仅 temporary/permanent，永久 endsAt=null；有效普通限制 endsAt 非空。内部风险临时限制也展示为 temporary。受限能力固定 `['treehole_access']`。

存在多个独立限制时，返回决定最终访问期限的一项：永久优先，否则 endsAt 最晚，仍相同取 ID 最大的一项。其他案件仍在本人处罚列表；不得因主显示项被撤销就忽略其他有效限制。canEnter 由服务端根据全部有效限制计算，不依赖客户端倒计时。

Penalty.type 为 warning/temporary/permanent；warning 的 restrictedCapabilities=[]、startsAt=endsAt，状态直接 ended。本人只看到已通知的 active/ended/revoked/superseded 记录，pending_confirmation/declined 不展示。撤销后的原记录保留原处罚期限，当前能否进入通过 Access 查询。

appealDeadlineAt = notifiedAt + 30×24 小时；请求必须在服务端 now < deadline 时提交。本人处罚详情和列表读取不刷新 notifiedAt。canAppeal 同时要求：未撤销、仍在原窗口、无待处理申诉；已经 ended/superseded 但仍可能影响旧内容的处罚可申诉。驳回后再次申诉须说明新事实；重复原理由不作为新事实，返回 TREEHOLE_APPEAL_NOT_ALLOWED，不新开窗口。

Appeal.status 为 pending/upheld/rejected；待处理 decisionReason/resolvedAt=null；结案两者非空。overdue 仅当 pending 且 now >= createdAt+72 小时时为 true。申诉中继续执行处罚；成立时事务内重算，正常服完限制不会恢复旧内容。

## 5. 小程序树洞接口（9 个）

以下均受树洞访问限制拦截；GET 无 Body。

| operationId | 方法与路径 | 输入 | 成功响应 |
|---|---|---|---|
| listTreeholePosts | GET `/api/miniapp/treehole/posts` | page?,pageSize? | 200 PostPage |
| getTreeholePost | GET `/api/miniapp/treehole/posts/{postId}` | postId | 200 Post |
| createTreeholePost | POST `/api/miniapp/treehole/posts` | CreatePost；幂等头 | 201 Receipt |
| listTreeholeComments | GET `/api/miniapp/treehole/posts/{postId}/comments` | postId,page?,pageSize? | 200 CommentPage |
| createTreeholeComment | POST `/api/miniapp/treehole/posts/{postId}/comments` | CreateComment；幂等头 | 201 Receipt |
| likeTreeholePost | PUT `/api/miniapp/treehole/posts/{postId}/likes/me` | 无 Body | 200 LikeResult，liked=true |
| unlikeTreeholePost | DELETE `/api/miniapp/treehole/posts/{postId}/likes/me` | 无 Body | 200 LikeResult，liked=false |
| reportTreeholePost | POST `/api/miniapp/treehole/posts/{postId}/reports` | CreateReport | 首次 201 / 重复 200 ReportReceipt |
| reportTreeholeComment | POST `/api/miniapp/treehole/comments/{commentId}/reports` | CreateReport | 首次 201 / 重复 200 ReportReceipt |

CreatePost 为 `{content,ttlHours?}`，CreateComment 为 `{content,replyToCommentId?}`。CreateReport 为 `{reason,description?}`，reason 为 insult/harassment/privacy/threat/disputed_accusation/other；other 必须说明，description 省略则服务端存空，输出详情返回 null。不支持修改举报或查询其他举报人。

## 6. 个人中心接口（11 个）

只允许本人。单条 MyPost/MyComment 查询是本次补齐，用于发布后的状态刷新，不新增公开投稿状态接口。

| operationId | 方法与路径 | 输入 | 成功响应 |
|---|---|---|---|
| getMyTreeholeAccess | GET `/api/miniapp/me/treehole/access` | 无 | 200 Access |
| listMyPosts | GET `/api/miniapp/me/treehole/posts` | page?,pageSize? | 200 MyPostPage |
| getMyPost | GET `/api/miniapp/me/treehole/posts/{postId}` | postId | 200 MyPost |
| deleteMyPost | DELETE `/api/miniapp/me/treehole/posts/{postId}` | 无 Body | 204 |
| listMyComments | GET `/api/miniapp/me/treehole/comments` | page?,pageSize? | 200 MyCommentPage |
| getMyComment | GET `/api/miniapp/me/treehole/comments/{commentId}` | commentId | 200 MyComment |
| deleteMyComment | DELETE `/api/miniapp/me/treehole/comments/{commentId}` | 无 Body | 204 |
| listMyTreeholePenalties | GET `/api/miniapp/me/treehole/penalties` | page?,pageSize? | 200 PenaltyPage |
| getMyTreeholePenalty | GET `/api/miniapp/me/treehole/penalties/{penaltyId}` | penaltyId | 200 PenaltyDetail |
| createMyTreeholeAppeal | POST `/api/miniapp/me/treehole/penalties/{penaltyId}/appeals` | `{reason}`；幂等头 | 201 Appeal |
| listMyTreeholeAppeals | GET `/api/miniapp/me/treehole/appeals` | page?,pageSize? | 200 AppealPage |

过期/删除/隐藏、未公开、非本人等不能访问的内容，公开与本人查询统一按资源类型返回 404，不区分“曾经存在”。本人 DELETE 在确认为本人骨架后可返回 204，不返回正文。Access 和处罚/申诉接口不会因为树洞受限而返回 TREEHOLE_RESTRICTED。

前端在页面重新显示、提交/删除后、从后台返回时刷新资格与相关内容。待审详情可由刷新动作调用 getMyPost/getMyComment；本契约不增加 WebSocket、实时推送或常驻高频轮询。

## 7. 管理后台接口（13 个）

列表均接受 page?,pageSize?；未知/空筛选值报 400。各 DTO 明确分开列表、详情和操作结果，不将数据库行直接序列化。

| operationId | 方法与路径 | 筛选/Body | 成功响应 |
|---|---|---|---|
| listAdminReviews | GET `/admin-api/treehole/reviews` | status?,reviewerType? | 200 AdminReviewPage |
| getAdminReview | GET `/admin-api/treehole/reviews/{reviewId}` | — | 200 AdminReviewDetail |
| decideAdminReview | POST `/admin-api/treehole/reviews/{reviewId}/decision` | ReviewDecision；幂等头 | 200 ReviewDecisionResult |
| listAdminReports | GET `/admin-api/treehole/reports` | status? | 200 AdminReportPage |
| getAdminReport | GET `/admin-api/treehole/reports/{reportId}` | — | 200 AdminReportDetail |
| decideAdminReport | POST `/admin-api/treehole/reports/{reportId}/decision` | ReportDecision；幂等头 | 200 ReportDecisionResult |
| listAdminPenalties | GET `/admin-api/treehole/penalties` | status? | 200 AdminPenaltyPage |
| getAdminPenalty | GET `/admin-api/treehole/penalties/{penaltyId}` | — | 200 AdminPenaltyDetail |
| decideAdminPenalty | POST `/admin-api/treehole/penalties/{penaltyId}/decision` | PenaltyDecision；幂等头 | 200 PenaltyDecisionResult |
| revokeAdminPenalty | POST `/admin-api/treehole/penalties/{penaltyId}/revoke` | `{reason}`；幂等头 | 200 RevokePenaltyResult |
| listAdminAppeals | GET `/admin-api/treehole/appeals` | status? | 200 AdminAppealPage |
| getAdminAppeal | GET `/admin-api/treehole/appeals/{appealId}` | — | 200 AdminAppealDetail |
| decideAdminAppeal | POST `/admin-api/treehole/appeals/{appealId}/decision` | AppealDecision；幂等头 | 200 AppealDecisionResult |

### 7.1 队列与决定参数

| 资源 | status 枚举 | 其他枚举 |
|---|---|---|
| 审核 | queued/processing/completed/cancelled | reviewerType=rule/ai/human；source=submission/sample/report/appeal/manual |
| 举报 | pending/upheld/dismissed | reason 与用户举报输入一致 |
| 处罚 | pending_confirmation/active/ended/revoked/superseded/declined | basis=accumulated_score/manual_severity/provisional；tier=0..5 |
| 申诉 | pending/upheld/rejected | overdue 为服务端计算字段 |

审核输入严格为二选一：

```ts
type ReviewDecision =
  | { decision: 'approve'; reason: string }
  | {
      decision: 'violation'
      violationCode: 'minor_insult' | 'direct_insult' | 'harassment'
        | 'privacy_leak' | 'threat' | 'substantiated_defamation'
      points: number
      reason: string
    }
```

minor_insult=1..3；direct_insult/harassment=4..9；privacy_leak/threat=10..20；substantiated_defamation=4..20 且 reason 必须说明事实依据。approve 不允许携带 points/violationCode。此接口仅人工管理员调用；AI 通过服务端适配器返回结构化建议，不能拿后台 JWT 调用接口。

其他决定输入：

```ts
type ReportDecision = {
  decision: 'upheld' | 'dismissed'; reviewId: string; reason: string
}
type PenaltyDecision =
  | { decision: 'confirm'; tier: 1 | 2 | 3 | 4 | 5; reason: string }
  | { decision: 'decline'; reason: string }
type AppealDecision = { decision: 'uphold' | 'reject'; reason: string }
```

处罚 tier=1/2/3/4/5 对应 1 小时/24 小时/7 天/30 天/永久；服务端计算期限，不接受任意 endsAt。确认/拒绝只针对 pending_confirmation；拒绝不接受 tier。高等级人工确认、单次严重案件越级、永久审查降级均要记录依据。

### 7.2 并发与案件生命周期

- 人工审核只处理当前轮次 queued/processing 的任务。允许人工接手 rule/ai 待处理任务：同一事务内作人工终结并使原租约失效，更新 reviewerType=human；迟到 worker 必须因轮次/状态/租约不匹配而放弃回写。不能直接覆盖 completed/cancelled 的旧轮次。
- 已完成 needs_human 的记录不是可直接改写的任务；服务端生成关联的新 human 轮次。误判纠正通过申诉、新复核或处罚 revoke 案件链进行，不修改旧审核结论。
- 内容到期/删除不取消已形成的案件；人工仍可依据必要证据判断，但审核 approve 不能复活内容或重置公开时间。新案件若必要证据已清除、无法作决定，返回 TREEHOLE_CASE_NOT_ACTIONABLE，不臆测成立。
- ReviewDecisionResult.violationId 在 violation 时是实际确认的计分流水 ID，同批判重复用既有流水；approve 时为 null。这里是人工终结决定，严重违规也由本次人工确认计分；7 天及以上处罚仍单独等待确认。penaltyIds 是本次操作关联的处罚/待确认案件 ID，不暴露账号资料。
- 举报决定必须关联同对象的当前有效 completed 复查；needs_human 不可终结举报。upheld 对应 violation，dismissed 对应 approve；不匹配返回 TREEHOLE_CASE_NOT_ACTIONABLE。举报处理不额外计分。
- 处罚确认/拒绝仅待确认案件可操作。撤销适用于 active/ended/superseded 的有依据纠错；警告也可撤销。revoked 同键重放返回原结果，换键再次终结返回 TREEHOLE_CASE_ALREADY_RESOLVED；declined/pending_confirmation 不走 revoke。
- 申诉只处理 pending；uphold 必须在同事务内撤销错误依据、重算计分与权限/隐藏关系，回执 recomputed=true。reject 不重算，recomputed=false。重算沿原时间线，不从处理时刻重新启动旧处罚。
- 状态已终结优先返回 TREEHOLE_CASE_ALREADY_RESOLVED；未终结但过时轮次、状态不可操作、关联证据不足/不匹配返回 TREEHOLE_CASE_NOT_ACTIONABLE。同键重放在这些当前状态检查前返回历史快照，但仍须有效管理员认证和案件可访问。
- 每次人工决定及撤销在事务内审计，幂等重放不重复写审计。审计不保存正文、完整身份或 AI 请求响应。

## 8. 错误契约

```json
{
  "error": {
    "code": "TREEHOLE_SUBMIT_TOO_FAST",
    "message": "提交过于频繁，请稍后再试。",
    "details": { "retryAt": "2026-10-24T10:01:00Z" },
    "requestId": "treehole-example-001"
  }
}
```

前端按 code 分支，message 仅显示；不得按文案判断。除下表明确要求外不返回 details，禁止输入原值、内部词表、隐藏正文或真实身份进入错误详情。

| HTTP | code | details / 行为 |
|---|---|---|
| 400 | VALIDATION_ERROR | 必有 `{fields:[{path,issue}]}`；path 如 body.content/header.Idempotency-Key/query.page，issue 为 required/invalid_type/invalid_format/out_of_range/unknown_field；不含原值 |
| 401 | UNAUTHORIZED | 重新登录；无 details |
| 403 | FORBIDDEN | 非管理员；无 details |
| 403 | TREEHOLE_RESTRICTED | 必有 Restriction，与 Access.restriction 同结构；进入处罚申诉入口 |
| 404 | TREEHOLE_POST_NOT_FOUND | 帖子不可访问；无 details |
| 404 | TREEHOLE_COMMENT_NOT_FOUND | 评论不可访问或回复目标无效；嵌套业务接口先检查父帖，不可访问时返回 POST_NOT_FOUND；本人单条评论查询统一 COMMENT_NOT_FOUND |
| 404 | TREEHOLE_CASE_NOT_FOUND | 处罚、申诉或后台案件不存在/无权查看 |
| 409 | IDEMPOTENCY_CONFLICT | 同键异参；无 details |
| 409 | TREEHOLE_CASE_ALREADY_RESOLVED | 不同请求重复终结案件 |
| 409 | TREEHOLE_CASE_NOT_ACTIONABLE | 未终结但过时、关联不符、证据不足或当前状态不可操作 |
| 409 | TREEHOLE_APPEAL_PENDING | 同次处罚已有待处理申诉 |
| 409 | TREEHOLE_APPEAL_WINDOW_CLOSED | now >= 原申诉截止时间 |
| 409 | TREEHOLE_APPEAL_NOT_ALLOWED | 处罚已撤销、无有效新事实等不允许新申诉 |
| 422 | TREEHOLE_CONTENT_REJECTED | 必有 `{reasonCode:'content_requires_change'}`；未接受投稿，不直接扣分 |
| 429 | TREEHOLE_DAILY_LIMIT_REACHED | 必有 `{retryAt}`，上海次日 00:00 转 UTC；不计违规分 |
| 429 | TREEHOLE_SUBMIT_TOO_FAST | 必有 `{retryAt}`，下次允许新提交时间；不计违规分 |
| 500 | INTERNAL_ERROR | 技术错误；不返回堆栈；保留原幂等键重试 |
| 503 | MINIAPP_AUTH_NOT_CONFIGURED | 小程序认证配置缺失；无 details |

AI 故障/超时/预算耗尽：持久化接受的投稿继续 pending_review，不改成 rejected，不给用户伪造违规原因。HTTP 请求不等待 AI。投稿事务失败不消耗次数；客户端遇到不确定结果仍使用原键重试。

## 9. 联调示例与前端接入要求

响应样例均可通过 OpenAPI 的 operationId 定位。每个样例独立，不构成同一案件的连续时间线；固定日期仅作契约示例。Mock 要冻结到示例时间或整体平移相关时间，不能拿真实当前时间把所有示例判过期。示例不含真实身份或真实用户正文。

| 场景 | operationId / name | 需要验证 |
|---|---|---|
| 时间线与空态 | listTreeholePosts / populated、empty | 平铺正文、分页与空态 |
| 创建立即公开 / 待审 | createTreeholePost / published、pending | 同为 201，但前端状态不同 |
| 正文已消失后的重试 | createTreeholePost / unavailableReplay | 不复活正文或进入历史档案 |
| 评论删除占位 | listTreeholeComments / placeholderAndReply | 不返回原作者或原文 |
| 本人拒绝 / 超时关闭 | getMyPost / rejected、closed | 按 reasonCode 显示提示 |
| 临时 / 永久限制 | getMyTreeholeAccess / restricted、permanent | 申诉入口仍可用，永久不算倒计时 |
| 单接口遇到限制 | listTreeholePosts / restricted | 清除原列表，显示处罚入口 |
| 过期详情 | getTreeholePost / expired | 退出正文，不提供缓存继续浏览 |
| 重复举报 | reportTreeholePost / duplicate | 200 视为已受理，不重复创建 |
| 重试参数不同 | createTreeholePost / differentPayload | 409，不无限自动重试 |
| 当日额度用尽 | createTreeholePost / quota | retryAt 与上海日界一致 |
| 人工决定与重算 | decideAdminAppeal / upheld | 只以服务端结果为准，刷新当前案件 |

独立开发约束：

1. 小程序和后台均把 HTTP 调用集中到现有服务层，Mock 与真实请求使用同一 DTO，不将假数据和权限判断散落在页面。
2. `apps/miniapp/services/api.ts` 已支持自定义 `Idempotency-Key`、error.code/details/requestId 和 Date；树洞专属 `services/treehole.ts` 使用共享 DTO 与独立开发 Mock 配置。
3. 共享类型包 `@cangqiong/api-contracts/treehole` 已提供生成 DTO，三端用 `import type` 消费；`pnpm treehole:mock` 提供独立本地状态 Mock。未提供 SDK 或自动生成请求客户端；正式业务接口已在 `apps/server/src/treehole` 实现，持久化联调待验收。基线、使用方式和 Mock 简化边界见[三端开发说明](../development/treehole-parallel-development-v1.md)。
4. 列表与个人中心页面重新显示时重新校验。遇到限制/404 后移除缓存中的正文；不能仅依赖清理 worker 或本地倒计时。正在展示的内容到期时立即隐藏并刷新，后端始终实时校验。
5. 先按 B 还原视觉，再按真实 DTO 驱动状态；HTML 的演示昵称、模拟时间、评审工具条不能变成正式业务逻辑。

## 10. 完整验收清单（数据库与原生联调仍待执行）

- [ ] 全部 33 个操作的路径、Schema、认证与响应和 OpenAPI 一致，前端只调用约定接口。
- [ ] 运行时验证 BIGINT 上限、未知字段、控制字符、码点长度及参数规范化；不信任 TS 类型。
- [ ] 同键并发、网络超时重放不重复扣额度或创建任务，同键异参返回 409。
- [ ] 到期、主动删除、处罚隐藏覆盖公开/本人列表、详情、评论、点赞和举报所有路径。
- [ ] 受限后所有树洞业务 403，个人中心仍能正常申诉；公共和后台 DTO 均无真实账号身份。
- [ ] 旧轮次/过期租约不能覆盖人工；永久处罚必须人工确认，误判重算不重新启动期限。
- [ ] OpenAPI 与实际路由响应校验；再运行项目对应类型检查、相关 smoke 和页面交互验收。

当前已完成的静态、纯规则与请求层验证见[三端开发说明](../development/treehole-parallel-development-v1.md)，以下完整链路不因 Mock 或单元测试通过而自动视为验收。

正文/证据清理期限与身份关联查询仍待用户后续确认；可以依据当前契约开发和联调，但不能把待决事项静默补成上线政策。
