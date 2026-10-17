import { useEffect, useState } from "react"
import { buildPageItems, formatDate, type ApiRequest, type Pagination } from "./shared"

type MiniappUserStatus = "active" | "disabled"

type MiniappUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  status: MiniappUserStatus
  lastLoginAt: string | null
  createdAt: string
}

type MiniappUserDetail = MiniappUser & {
  wechatOpenIdMasked: string
  updatedAt: string
  circleMemberships: Array<{
    circleId: string
    circleName: string
    circleStatus: MiniappUserStatus
    joinedAt: string
  }>
}

type MiniappUserListResponse = {
  items: MiniappUser[]
  pagination: Pagination
}

export function MiniappUsersPage(props: {
  request: ApiRequest
  onUnauthorized: () => void
  onLogout: () => void
}) {
  const [users, setUsers] = useState<MiniappUser[]>([])
  const [pagination, setPagination] = useState<MiniappUserListResponse["pagination"] | null>(null)
  const [keywordInput, setKeywordInput] = useState("")
  const [keywordQuery, setKeywordQuery] = useState("")
  const [statusInput, setStatusInput] = useState<"" | MiniappUserStatus>("")
  const [statusQuery, setStatusQuery] = useState<"" | MiniappUserStatus>("")
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<MiniappUserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")

  async function loadUsers(page = 1, keyword = keywordQuery, status = statusQuery, size = pageSize) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(size) })
      if (keyword) params.set("keyword", keyword)
      if (status) params.set("status", status)
      const result = await props.request<MiniappUserListResponse>(`/admin-api/miniapp-users?${params}`)
      setUsers(result.items)
      setPagination(result.pagination)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers(1, "", "", 10)
  }, [])

  async function searchUsers(event: React.FormEvent) {
    event.preventDefault()
    const keyword = keywordInput.trim()
    setKeywordQuery(keyword)
    setStatusQuery(statusInput)
    await loadUsers(1, keyword, statusInput, pageSize)
  }

  async function resetSearch() {
    setKeywordInput("")
    setKeywordQuery("")
    setStatusInput("")
    setStatusQuery("")
    await loadUsers(1, "", "", pageSize)
  }

  async function changePageSize(size: number) {
    setPageSize(size)
    await loadUsers(1, keywordQuery, statusQuery, size)
  }

  async function showDetail(user: MiniappUser) {
    setDetailLoading(true)
    setError("")
    try {
      setDetail(await props.request<MiniappUserDetail>(`/admin-api/miniapp-users/${user.id}`))
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "详情加载失败")
    } finally {
      setDetailLoading(false)
    }
  }

  async function toggleStatus(user: MiniappUser) {
    const nextStatus = user.status === "active" ? "disabled" : "active"
    if (nextStatus === "disabled" && !window.confirm(`确认禁用小程序用户“${user.nickname}”吗？`)) return
    setError("")
    try {
      await props.request(`/admin-api/miniapp-users/${user.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      })
      await loadUsers(pagination?.page ?? 1, keywordQuery, statusQuery, pageSize)
      if (detail?.id === user.id) setDetail(await props.request<MiniappUserDetail>(`/admin-api/miniapp-users/${user.id}`))
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "状态修改失败")
    }
  }

  return (
    <main className="content">
      <header className="topbar">
        <div><p className="eyebrow">MINI PROGRAM COMMUNITY</p><h1>小程序用户</h1></div>
        <button className="ghost-button" onClick={props.onLogout}>退出登录</button>
      </header>
      <section className="stats">
        <div><span>查询结果</span><strong>{pagination?.total ?? "—"}</strong></div>
        <div><span>当前筛选</span><strong className="query-summary">{keywordQuery || (statusQuery === "active" ? "正常用户" : statusQuery === "disabled" ? "禁用用户" : "全部用户")}</strong></div>
        <div><span>每页数量</span><strong>{pageSize}</strong></div>
      </section>
      <section className="panel miniapp-panel">
        <div className="panel-heading"><div><h2>小程序用户列表</h2><p>用户由微信首次登录自动创建，后台只负责查看与状态管理。</p></div><span className="source-badge">WECHAT</span></div>
        <form className="filters miniapp-filters" onSubmit={searchUsers}>
          <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="昵称或用户ID" maxLength={50} placeholder="输入昵称或用户 ID" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} /></label>
          <select aria-label="用户状态" value={statusInput} onChange={(event) => setStatusInput(event.target.value as "" | MiniappUserStatus)}><option value="">全部状态</option><option value="active">正常</option><option value="disabled">禁用</option></select>
          <select aria-label="每页数量" value={pageSize} onChange={(event) => void changePageSize(Number(event.target.value))}><option value={10}>10 条/页</option><option value={20}>20 条/页</option><option value={50}>50 条/页</option></select>
          <button className="primary-button search-button" type="submit" disabled={loading}>查询</button>
          <button className="secondary-button" type="button" disabled={loading || (!keywordInput && !keywordQuery && !statusInput && !statusQuery)} onClick={() => void resetSearch()}>重置</button>
        </form>
        {error && <div className="error-banner inline">{error}</div>}
        <div className="table-wrap"><table className="miniapp-table"><thead><tr><th>小程序用户</th><th>状态</th><th>最近登录</th><th>注册时间</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td className="empty" colSpan={5}>加载中...</td></tr> : users.length === 0 ? <tr><td className="empty miniapp-empty" colSpan={5}><strong>暂无小程序用户</strong><span>用户首次通过微信登录后会自动出现在这里。</span></td></tr> : users.map((user) => <tr key={user.id}><td><div className="user-cell"><div className="avatar miniapp-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.nickname.slice(0, 1)}</div><div><strong>{user.nickname}</strong><small>ID {user.id}</small></div></div></td><td><span className={`status-tag ${user.status === "active" ? "active" : "disabled"}`}><i />{user.status === "active" ? "正常" : "禁用"}</span></td><td className="muted">{formatDate(user.lastLoginAt)}</td><td className="muted">{formatDate(user.createdAt, "—")}</td><td><div className="action-buttons"><button className="link-button" disabled={detailLoading} onClick={() => void showDetail(user)}>查看详情</button><button className={`link-button ${user.status === "active" ? "danger-link" : ""}`} onClick={() => void toggleStatus(user)}>{user.status === "active" ? "禁用" : "启用"}</button></div></td></tr>)}</tbody></table></div>
        {pagination && <div className="pagination"><span>共 <strong>{pagination.total}</strong> 条 · 每页 {pagination.pageSize} 条</span>{pagination.totalPages > 1 && <nav aria-label="小程序用户列表分页"><button className="page-arrow" aria-label="上一页" disabled={loading || pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1)}>‹</button><div className="desktop-pages">{buildPageItems(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === pagination.page ? "active" : ""} aria-current={item === pagination.page ? "page" : undefined} disabled={loading} onClick={() => void loadUsers(item)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary miniapp-page-summary">第 {pagination.page} / {pagination.totalPages} 页</b><button className="page-arrow" aria-label="下一页" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void loadUsers(pagination.page + 1)}>›</button></nav>}</div>}
      </section>
      {detail && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null) }}><section className="modal miniapp-detail" aria-modal="true" role="dialog"><div className="modal-heading"><div><p className="eyebrow">MINIAPP USER</p><h2>{detail.nickname}</h2></div><button type="button" className="close-button" aria-label="关闭" onClick={() => setDetail(null)}>×</button></div><div className="detail-identity"><div className="avatar miniapp-avatar large">{detail.avatarUrl ? <img src={detail.avatarUrl} alt="" /> : detail.nickname.slice(0, 1)}</div><div><span className={`status-tag ${detail.status === "active" ? "active" : "disabled"}`}><i />{detail.status === "active" ? "正常" : "禁用"}</span><small>社区展示昵称允许重复，以用户 ID 作为唯一标识。</small></div></div><dl className="detail-grid"><div><dt>用户 ID</dt><dd>{detail.id}</dd></div><div><dt>微信 OpenID</dt><dd>{detail.wechatOpenIdMasked}</dd></div><div><dt>最近登录</dt><dd>{formatDate(detail.lastLoginAt)}</dd></div><div><dt>注册时间</dt><dd>{formatDate(detail.createdAt, "—")}</dd></div><div><dt>更新时间</dt><dd>{formatDate(detail.updatedAt, "—")}</dd></div></dl><section className="membership-section" aria-labelledby="membership-heading"><div className="membership-heading"><h3 id="membership-heading">加入圈子</h3><span>{detail.circleMemberships.length} 个</span></div>{detail.circleMemberships.length === 0 ? <p className="membership-empty">暂未加入圈子</p> : <ul className="membership-list">{detail.circleMemberships.map((membership) => <li key={membership.circleId}><div><strong>{membership.circleName}</strong><small>加入于 {formatDate(membership.joinedAt, "—")}</small></div><span className={`status-tag ${membership.circleStatus === "active" ? "active" : "disabled"}`}><i />{membership.circleStatus === "active" ? "正常" : "禁用"}</span></li>)}</ul>}</section><div className="modal-actions"><button className="secondary-button" onClick={() => setDetail(null)}>关闭</button><button className={detail.status === "active" ? "danger-button" : "primary-button"} onClick={() => void toggleStatus(detail)}>{detail.status === "active" ? "禁用用户" : "启用用户"}</button></div></section></div>}
    </main>
  )
}
