import { useEffect, useRef, useState } from "react"
import type { AdminPenaltyDetail, AdminReviewDetail, Evidence, ViolationCode } from "@cangqiong/api-contracts/treehole"
import { buildPageItems, formatDate } from "./shared"
import { appealDecision, canReview, penaltyDecision, reportDecision, reviewDecision, revokeDecision, violationOptions } from "./treehole-rules"
import { TreeholeApiError, type CaseDetail, type CaseKind, type CasePage, type DecisionBody, type TreeholeService } from "./treehole-service"
import "./treehole.css"

const names: Record<CaseKind, string> = { reviews: "内容审核", reports: "举报处理", penalties: "处罚管理", appeals: "申诉处理" }
const states: Record<CaseKind, string[]> = {
  reviews: ["queued", "processing", "completed", "cancelled"], reports: ["pending", "upheld", "dismissed"],
  penalties: ["pending_confirmation", "active", "ended", "revoked", "superseded", "declined"], appeals: ["pending", "upheld", "rejected"],
}
const labels: Record<string, string> = {
  queued: "待审核", processing: "处理中", completed: "已完成", cancelled: "已取消", pending: "待处理", upheld: "已成立", dismissed: "不成立", rejected: "已驳回",
  pending_confirmation: "待人工确认", active: "生效中", ended: "已结束", revoked: "已撤销", superseded: "已被替代", declined: "未批准",
  rule: "规则", ai: "AI", human: "人工", approve: "审核通过", violation: "确认违规", needs_human: "需人工复核",
  submission: "投稿", sample: "抽查", report: "举报", appeal: "申诉", manual: "人工发起",
  post: "帖子", comment: "评论", published: "已公开", pending_review: "待审", unavailable: "已不可见",
  accumulated_score: "累计分值", manual_severity: "单次严重事件", provisional: "风险临时限制", warning: "警告", temporary: "临时限制", permanent: "永久限制",
  insult: "侮辱", harassment: "骚扰", privacy: "隐私泄露", threat: "威胁", disputed_accusation: "争议性指控", other: "其他",
}
const tierNames = ["警告", "1 小时", "24 小时", "7 天", "30 天", "永久"]
const label = (value: string | null) => value ? labels[value] ?? value : "—"
const date = (value: string | null) => formatDate(value, "—")

function Failure({ error }: { error: unknown }) {
  if (!error) return null
  return <div role="alert" className="error-banner"><strong>{error instanceof Error ? error.message : "请求失败"}</strong>{error instanceof TreeholeApiError && <><small>{error.code ?? `HTTP ${error.status}`} {error.requestId && `· 请求 ${error.requestId}`}</small>{error.details && <pre>{JSON.stringify(error.details, null, 2)}</pre>}</>}</div>
}

async function fetchDetail(service: TreeholeService, kind: CaseKind, id: string): Promise<CaseDetail> {
  switch (kind) {
    case "reviews": return { kind, data: await service.get(kind, id) }
    case "reports": return { kind, data: await service.get(kind, id) }
    case "penalties": return { kind, data: await service.get(kind, id) }
    case "appeals": return { kind, data: await service.get(kind, id) }
  }
}

export function TreeholePage({ service, mock, allowMock, onMockChange, onLogout, onUnauthorized }: {
  service: TreeholeService; mock: boolean; allowMock: boolean; onMockChange: (mock: boolean) => void; onLogout: () => void; onUnauthorized: () => void
}) {
  const [kind, setKind] = useState<CaseKind>("reviews")
  const [status, setStatus] = useState("")
  const [reviewer, setReviewer] = useState("")
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<CasePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<{ kind: CaseKind; id: string } | null>(null)
  const unauthorized = useRef(onUnauthorized)
  unauthorized.current = onUnauthorized

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    service.list(kind, page, { status, reviewerType: reviewer }).then((data) => {
      if (!ignore) {
        if (page > Math.max(1, data.pagination.totalPages)) { setPage(Math.max(1, data.pagination.totalPages)); return }
        setResult(data)
      }
    }).catch((cause: unknown) => {
      if (!ignore) { setResult(null); setError(cause); if (cause instanceof TreeholeApiError && cause.status === 401) unauthorized.current() }
    }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [service, kind, page, status, reviewer, version])

  function switchKind(next: CaseKind) { setKind(next); setStatus(""); setReviewer(""); setPage(1); setSelected(null); setResult(null) }
  return <main className="content treehole-workbench">
    <header className="topbar"><div><p className="eyebrow">TREEHOLE · CASE WORKBENCH</p><h1>树洞案件工作台</h1></div><div className="action-buttons">{allowMock && <button className="ghost-button" onClick={() => onMockChange(!mock)}>{mock ? "返回正式服务" : "切换独立 Mock"}</button>}<button className="ghost-button" onClick={onLogout}>{mock ? "退出演示" : "退出登录"}</button></div></header>
    {mock && <div className="treehole-dev-note"><strong>独立 Mock 开发模式</strong><span>仅连接本机内存服务，使用开发假令牌；数据重启即清空。</span></div>}
    <section className="stats"><div><span>当前队列</span><strong className="query-summary">{names[kind]}</strong></div><div><span>匹配案件</span><strong>{loading ? "—" : result?.pagination.total ?? "—"}</strong></div><div><span>处理原则</span><strong className="query-summary">匿名案件 · 逐案决定</strong></div></section>
    <section className="panel">
      <div className="treehole-tabs" role="tablist" aria-label="案件队列">{(Object.keys(names) as CaseKind[]).map((key) => <button key={key} role="tab" aria-selected={kind === key} className={kind === key ? "active" : ""} onClick={() => switchKind(key)}>{names[key]}</button>)}</div>
      <div className="panel-heading"><div><h2>{names[kind]}队列</h2><p>{kind === "appeals" ? "超时未结申诉优先，随后按创建时间从早到晚排列。" : "按创建时间从早到晚排列；选择案件查看证据并处理。"}</p></div><button className="secondary-button" disabled={loading} onClick={() => setVersion((v) => v + 1)}>刷新队列</button></div>
      <div className="filters treehole-filters"><label>案件状态<select aria-label="案件状态" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">全部状态</option>{states[kind].map((state) => <option key={state} value={state}>{label(state)}</option>)}</select></label>{kind === "reviews" && <label>审核方式<select aria-label="审核方式" value={reviewer} onChange={(event) => { setReviewer(event.target.value); setPage(1) }}><option value="">全部方式</option>{["rule", "ai", "human"].map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>}<button type="button" className="ghost-button" disabled={!status && !reviewer} onClick={() => { setStatus(""); setReviewer(""); setPage(1) }}>清除筛选</button></div>
      <Failure error={error} />
      <div className="table-wrap"><table className="treehole-table"><thead><tr><th>案件编号</th><th>{kind === "appeals" ? "申诉理由" : "关联与依据"}</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td className="empty" colSpan={5}>正在读取案件…</td></tr> : !result?.items.length ? <tr><td className="empty" colSpan={5}>当前筛选下暂无案件</td></tr> : result.items.map((item) => <tr key={item.id}><td><strong>#{item.id}</strong>{"overdue" in item && item.overdue && <small className="treehole-overdue">已超过 72 小时处理目标</small>}</td><td><div className="treehole-row-summary">{"target" in item ? `${label(item.target.type)} #${item.target.id}` : "penaltyId" in item ? item.reason : `${label(item.basis)} · ${tierNames[item.tier] ?? item.tier}`}</div><small>{"reviewerType" in item ? `${label(item.reviewerType)} · ${label(item.source)} · 第 ${item.targetReviewVersion} 轮${item.isCurrent ? "（当前）" : "（历史）"}` : "target" in item ? `举报原因：${label(item.reason)}` : "penaltyId" in item ? `处罚 #${item.penaltyId}` : `规则 ${item.ruleVersion} · 分值快照 ${item.scoreSnapshot}`}</small></td><td><span className={`role-tag ${["pending", "queued", "pending_confirmation"].includes(item.status) ? "admin" : ""}`}>{label(item.status)}</span></td><td className="muted">{date(item.createdAt)}</td><td><button className="link-button" onClick={() => setSelected({ kind, id: item.id })}>查看案件</button></td></tr>)}</tbody></table></div>
      {result && <div className="pagination"><span>共 <strong>{result.pagination.total}</strong> 条 · 每页 10 条</span>{result.pagination.totalPages > 1 && <nav aria-label="树洞案件分页"><button aria-label="上一页" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>‹</button><div className="desktop-pages">{buildPageItems(page, result.pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === page ? "active" : ""} aria-current={item === page ? "page" : undefined} disabled={loading} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary">第 {page} / {result.pagination.totalPages} 页</b><button aria-label="下一页" disabled={loading || page >= result.pagination.totalPages} onClick={() => setPage(page + 1)}>›</button></nav>}</div>}
      <p className="treehole-footnote">服务器时间：{service.serverDate ? date(service.serverDate) : "—"} · 每页固定 10 条</p>
    </section>
    {selected && <CaseInspector key={`${selected.kind}:${selected.id}`} kind={selected.kind} id={selected.id} service={service} onClose={() => setSelected(null)} onChanged={() => setVersion((v) => v + 1)} onUnauthorized={onUnauthorized} onNavigate={(nextKind, id) => { setSelected({ kind: nextKind, id }) }} />}
  </main>
}

function ReviewEvidence({ review, onNavigate }: { review: AdminReviewDetail; onNavigate: (kind: CaseKind, id: string) => void }) {
  return <section className="treehole-evidence"><h3>审核证据 · #{review.id}</h3><dl className="treehole-facts"><div><dt>对象</dt><dd>{label(review.target.type)} #{review.target.id} · {label(review.target.availability)}</dd></div><div><dt>审核轮次</dt><dd>第 {review.targetReviewVersion} 轮 · {review.isCurrent ? "当前轮次" : "历史轮次"} · {label(review.reviewerType)}</dd></div><div><dt>来源 / 规则</dt><dd>{label(review.source)} / {review.ruleVersion}</dd></div><div><dt>结论</dt><dd>{label(review.decision)}{review.violationCode && ` · ${violationOptions[review.violationCode].label} · ${review.points ?? "—"} 分`}</dd></div><div><dt>完成时间</dt><dd>{date(review.completedAt)}</dd></div><div><dt>计分记录</dt><dd>{review.countedViolationId ? `#${review.countedViolationId}` : "—"}</dd></div></dl><h4>正文快照</h4><p className="treehole-content">{review.content ?? "正文不可用，请核对剩余证据；证据不足时不能作决定。"}</p>{review.reason && <><h4>处理依据</h4><p className="treehole-content">{review.reason}</p></>}{review.evidenceQuotes.length > 0 && <><h4>证据引用</h4>{review.evidenceQuotes.map((quote, i) => <blockquote key={i}>{quote}</blockquote>)}</>}{review.context.length > 0 && <><h4>关联上下文</h4>{review.context.map((context, index) => <div key={index}><small>{label(context.target.type)} #{context.target.id} · {label(context.target.availability)}</small><p className="treehole-content">{context.content ?? "正文不可用"}</p></div>)}</>}{review.previousReviewId && <p>前一轮：<button className="link-button" onClick={() => onNavigate("reviews", review.previousReviewId!)}>#{review.previousReviewId}</button></p>}{review.history.length > 0 && <><h4>审核历史</h4><ul className="treehole-history">{review.history.map((item) => <li key={item.id}><button className="link-button" onClick={() => onNavigate("reviews", item.id)}>#{item.id} · 第 {item.targetReviewVersion} 轮</button><span>{label(item.status)} · {label(item.decision)} · {date(item.createdAt)}</span></li>)}</ul></>}</section>
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return <section className="treehole-evidence"><h3>脱敏证据</h3>{!evidence.length && <p className="muted">暂无可展示证据</p>}{evidence.map((item, i) => <div key={i}><p className="treehole-content">{item.content ?? "正文不可用"}</p>{item.quotes.map((quote, j) => <blockquote key={j}>{quote}</blockquote>)}<p className="treehole-content muted">{item.explanation}</p></div>)}</section>
}

function PenaltyEvidence({ penalty, onNavigate }: { penalty: AdminPenaltyDetail; onNavigate: (kind: CaseKind, id: string) => void }) {
  return <><dl className="treehole-facts"><div><dt>处罚等级 / 类型</dt><dd>{tierNames[penalty.tier]} / {label(penalty.type)}</dd></div><div><dt>依据 / 分值快照</dt><dd>{label(penalty.basis)} / {penalty.scoreSnapshot}</dd></div><div><dt>规则版本</dt><dd>{penalty.ruleVersion}</dd></div><div><dt>触发违规</dt><dd>{penalty.triggerViolationId ? `#${penalty.triggerViolationId}` : "—"}</dd></div><div><dt>生效时间</dt><dd>{date(penalty.startsAt)}</dd></div><div><dt>结束时间</dt><dd>{penalty.type === "permanent" && penalty.startsAt ? "永久" : date(penalty.endsAt)}</dd></div><div><dt>通知时间</dt><dd>{date(penalty.notifiedAt)}</dd></div><div><dt>撤销时间</dt><dd>{date(penalty.revokedAt)}</dd></div></dl><h4>处罚原因</h4><p className="treehole-content">{penalty.reason}</p>{penalty.revokeReason && <><h4>撤销原因</h4><p className="treehole-content">{penalty.revokeReason}</p></>}<div className="treehole-related">{penalty.supersedesPenaltyId && <button className="link-button" onClick={() => onNavigate("penalties", penalty.supersedesPenaltyId!)}>被替代处罚 #{penalty.supersedesPenaltyId}</button>}{[...new Set([...(penalty.reviewId ? [penalty.reviewId] : []), ...penalty.relatedReviewIds])].map((id) => <button className="link-button" key={`r${id}`} onClick={() => onNavigate("reviews", id)}>审核 #{id}</button>)}{penalty.relatedAppealIds.map((id) => <button className="link-button" key={`a${id}`} onClick={() => onNavigate("appeals", id)}>申诉 #{id}</button>)}</div><EvidenceList evidence={penalty.evidence} /></>
}

function CaseInspector({ kind, id, service, onClose, onChanged, onUnauthorized, onNavigate }: {
  kind: CaseKind; id: string; service: TreeholeService; onClose: () => void; onChanged: () => void; onUnauthorized: () => void; onNavigate: (kind: CaseKind, id: string) => void
}) {
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [reason, setReason] = useState("")
  const [decision, setDecision] = useState("approve")
  const [code, setCode] = useState<ViolationCode>("minor_insult")
  const [points, setPoints] = useState("1")
  const [tier, setTier] = useState("3")
  const [reviewId, setReviewId] = useState("")
  const [linkedReview, setLinkedReview] = useState<AdminReviewDetail | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const requestVersion = useRef(0)
  const active = useRef(true)

  function showError(cause: unknown) { setError(cause); if (cause instanceof TreeholeApiError && cause.status === 401) onUnauthorized() }
  async function refresh() {
    const version = ++requestVersion.current
    setEvidenceLoading(false)
    setLoading(true)
    try {
      const next = await fetchDetail(service, kind, id)
      if (active.current && version === requestVersion.current) {
        setDetail(next)
        if (next.kind === "reports") { setReviewId(next.data.reviewId ?? ""); setLinkedReview(next.data.review) }
        if (next.kind === "penalties" && next.data.tier >= 1 && next.data.tier <= 5) setTier(String(next.data.tier))
      }
    } finally { if (active.current && version === requestVersion.current) setLoading(false) }
  }
  useEffect(() => {
    active.current = true
    void refresh().catch((cause: unknown) => { if (active.current) showError(cause) })
    return () => { active.current = false; ++requestVersion.current }
  }, [])

  async function loadReview() {
    setError(null)
    if (!/^[1-9][0-9]{0,18}$/.test(reviewId) || BigInt(reviewId) > 9223372036854775807n) { setError(new Error("请输入有效的十进制审核案件编号。")); return }
    const version = ++requestVersion.current
    setEvidenceLoading(true)
    try { const review = await service.get("reviews", reviewId); if (active.current && version === requestVersion.current) setLinkedReview(review) } catch (cause) { if (active.current && version === requestVersion.current) { setLinkedReview(null); showError(cause) } } finally { if (active.current && version === requestVersion.current) setEvidenceLoading(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!detail || busy || loading || accepted || evidenceLoading) return
    setError(null); setNotice("")
    let body: DecisionBody
    let action = "decision"
    try {
      switch (detail.kind) {
        case "reviews":
          if (!canReview(detail.data)) throw new Error("该轮次已不可操作，请刷新详情。")
          body = reviewDecision(decision === "violation" ? "violation" : "approve", code, points, reason); break
        case "reports":
          if (!linkedReview || linkedReview.id !== reviewId) throw new Error("关联复查编号与证据不一致，请重新读取证据。")
          body = reportDecision(detail.data, linkedReview, decision === "upheld" ? "upheld" : "dismissed", reason); break
        case "penalties":
          if (detail.data.status === "pending_confirmation") body = penaltyDecision(detail.data.status, decision === "decline" ? "decline" : "confirm", tier, reason)
          else { body = revokeDecision(detail.data.status, reason); action = "revoke" }
          break
        case "appeals": body = appealDecision(detail.data.status, decision === "uphold" ? "uphold" : "reject", reason); break
      }
    } catch (cause) { showError(cause); return }
    setBusy(true)
    let committed = false
    try {
      const path = `/${kind}/${id}/${action}`
      await service.mutate(path, service.attempt(path, body))
      committed = true
      if (!active.current) return
      setAccepted(true)
      setNotice("决定已提交，正在读取案件的当前状态。")
      onChanged()
      await refresh()
      if (active.current) { setAccepted(false); setReason(""); setNotice("处理成功，已重新读取当前案件状态。") }
    } catch (cause) {
      if (!active.current) return
      showError(cause)
      if (committed) setNotice("决定已成功，但读取当前案件失败。请先刷新详情，再继续处理。")
      else if (!(cause instanceof TreeholeApiError) || cause.status >= 500) setNotice("请求结果尚未确认。保持相同参数再次提交会复用原幂等键；修改决定字段后会使用新键。")
      if (cause instanceof TreeholeApiError && cause.status === 409) {
        setAccepted(true)
        onChanged()
        try { await refresh(); if (active.current) setAccepted(false) } catch (refreshError) { if (active.current) setNotice(`案件刷新失败：${refreshError instanceof Error ? refreshError.message : "请重试刷新"}，请先刷新详情。`) }
      }
    } finally { if (active.current) setBusy(false) }
  }

  const actionable = detail && (detail.kind === "reviews" ? canReview(detail.data) : detail.kind === "penalties" ? ["pending_confirmation", "active", "ended", "superseded"].includes(detail.data.status) : detail.data.status === "pending")
  const revoking = detail?.kind === "penalties" && detail.data.status !== "pending_confirmation"
  function navigate(nextKind: CaseKind, nextId: string) { if (!busy && !loading && !evidenceLoading) onNavigate(nextKind, nextId) }
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = originalOverflow; previouslyFocused?.focus() }
  }, [])

  return <div className="modal-backdrop treehole-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }} onKeyDown={(event) => {
    if (event.key === "Escape" && !busy) onClose()
    if (event.key === "Tab") {
      const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}><section className="modal treehole-inspector" role="dialog" aria-modal="true" aria-labelledby="treehole-case-title"><div className="modal-heading"><div><p className="eyebrow">CASE DETAIL</p><h2 id="treehole-case-title">{names[kind]} #{id}</h2></div><button ref={closeRef} type="button" aria-label="关闭案件详情" className="close-button" disabled={busy} onClick={onClose}>×</button></div><div className="treehole-detail-toolbar"><span className="role-tag">{detail ? label(detail.data.status) : "读取中"}</span><button className="link-button" disabled={busy || loading || evidenceLoading} onClick={() => { setError(null); void refresh().then(() => { setAccepted(false) }).catch(showError) }}>刷新详情</button></div><Failure error={error} />{notice && <p role="status" className="treehole-notice">{notice}</p>}{loading && <p className="muted" role="status">正在读取最新案件…</p>}{detail && <><p className="treehole-detail-meta">创建于 {date(detail.data.createdAt)} · 服务器时间 {service.serverDate ? date(service.serverDate) : "—"}</p>{detail.kind === "reviews" && <ReviewEvidence review={detail.data} onNavigate={navigate} />}{detail.kind === "reports" && <><dl className="treehole-facts"><div><dt>举报对象</dt><dd>{label(detail.data.target.type)} #{detail.data.target.id}</dd></div><div><dt>举报类别</dt><dd>{label(detail.data.reason)}</dd></div><div><dt>结案时间</dt><dd>{date(detail.data.resolvedAt)}</dd></div></dl><h4>举报说明</h4><p className="treehole-content">{detail.data.description ?? "未附加说明"}</p>{detail.data.decisionReason && <><h4>处理原因</h4><p className="treehole-content">{detail.data.decisionReason}</p></>}<div className="treehole-link-review"><label>关联复查编号<input aria-label="关联复查编号" value={reviewId} disabled={busy || loading || evidenceLoading} onChange={(event) => { setReviewId(event.target.value); setLinkedReview(null) }} /></label><button className="secondary-button" disabled={evidenceLoading || busy || loading} onClick={() => void loadReview()}>{evidenceLoading ? "读取中…" : "读取复查证据"}</button>{detail.data.reviewId && <button className="link-button" onClick={() => navigate("reviews", detail.data.reviewId!)}>打开关联审核</button>}</div>{linkedReview ? <ReviewEvidence review={linkedReview} onNavigate={navigate} /> : <p className="treehole-warning">先读取关联复查证据，再作举报决定。复查须为同一对象、当前轮次且已完成。</p>}</>}{detail.kind === "penalties" && <PenaltyEvidence penalty={detail.data} onNavigate={navigate} />}{detail.kind === "appeals" && <>{detail.data.overdue && <p className="treehole-warning">该申诉已超过 72 小时处理目标，请优先核查。</p>}<h4>申诉理由</h4><p className="treehole-content">{detail.data.reason}</p>{detail.data.decisionReason && <><h4>申诉处理原因</h4><p className="treehole-content">{detail.data.decisionReason}</p><p>结案时间：{date(detail.data.resolvedAt)}</p></>}<h3>关联处罚 <button className="link-button" onClick={() => navigate("penalties", detail.data.penaltyId)}>#{detail.data.penaltyId}</button></h3><PenaltyEvidence penalty={detail.data.penalty} onNavigate={navigate} /></>}
      {actionable ? <form className="treehole-decision" onSubmit={submit}><h3>{revoking ? "撤销误判处罚" : "人工决定"}</h3><fieldset disabled={busy || loading || accepted}><div className="treehole-form-grid">{detail.kind === "reviews" && <><label>审核决定<select aria-label="审核决定" value={decision === "violation" ? "violation" : "approve"} onChange={(event) => setDecision(event.target.value)}><option value="approve">通过，确认正常</option><option value="violation">确认违规</option></select></label>{decision === "violation" && <><label>违规类别<select aria-label="违规类别" value={code} onChange={(event) => { const next = event.target.value as ViolationCode; setCode(next); setPoints(String(violationOptions[next].min)) }}>{(Object.entries(violationOptions) as [ViolationCode, typeof violationOptions[ViolationCode]][]).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label><label>本次确认分值（{violationOptions[code].min}–{violationOptions[code].max}）<input aria-label="本次确认分值" inputMode="numeric" value={points} onChange={(event) => setPoints(event.target.value)} /></label></>}</>}{detail.kind === "reports" && <label>举报决定<select aria-label="举报决定" value={decision === "upheld" ? "upheld" : "dismissed"} onChange={(event) => setDecision(event.target.value)}><option value="dismissed">不成立（关联通过复查）</option><option value="upheld">成立（关联违规复查）</option></select></label>}{detail.kind === "penalties" && !revoking && <><label>处罚决定<select aria-label="处罚决定" value={decision === "decline" ? "decline" : "confirm"} onChange={(event) => setDecision(event.target.value)}><option value="confirm">确认生效</option><option value="decline">拒绝生效</option></select></label>{decision !== "decline" && <label>确认等级<select aria-label="确认等级" value={tier} onChange={(event) => setTier(event.target.value)}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} 级 · {tierNames[value]}</option>)}</select></label>}</>}{detail.kind === "appeals" && <label>申诉决定<select aria-label="申诉决定" value={decision === "uphold" ? "uphold" : "reject"} onChange={(event) => setDecision(event.target.value)}><option value="reject">驳回申诉</option><option value="uphold">申诉成立并重算</option></select></label>}</div><label>{revoking ? "纠错依据" : "处理原因"}（必填）<textarea aria-label="处理原因" required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={code === "substantiated_defamation" && detail.kind === "reviews" && decision === "violation" ? "请写明诽谤判断的具体事实依据" : "说明判断依据；处罚原因会向用户展示，请勿包含他人隐私。"} /></label><p className="treehole-character-count">{Array.from(reason.replace(/\r\n?/g, "\n").trim()).length} / 1000 字符</p>{detail.kind === "reviews" && <p className="treehole-footnote">可接手当前规则 / AI 待处理任务。通过不会恢复已到期、删除或被其他处罚隐藏的内容。</p>}{detail.kind === "penalties" && <p className="treehole-warning">{revoking ? "仅用于有依据的误判纠错；服务端按原时间线重算，仍有依据的其他限制继续执行。" : "确认后由服务端计算限制期限与权限。越级、降级及永久处罚均须写明事实依据。"}</p>}{detail.kind === "appeals" && <p className="treehole-footnote">申诉成立后由服务端撤销错误依据并重算；申诉处理中继续执行原处罚。</p>}<div className="modal-actions"><button className={revoking ? "danger-button" : "primary-button"} type="submit" disabled={busy || loading || accepted || evidenceLoading}>{busy ? "正在提交…" : accepted ? "请先刷新当前状态" : revoking ? "确认撤销并重算" : "提交人工决定"}</button></div></fieldset></form> : <div className="treehole-terminal">{detail.kind === "reviews" && !detail.data.isCurrent ? "历史轮次仅供查阅。" : "当前案件已终结或不可操作。"}如需纠错，请通过关联处罚撤销、申诉或新的复核处理。</div>}</>}
    </section></div>
}
