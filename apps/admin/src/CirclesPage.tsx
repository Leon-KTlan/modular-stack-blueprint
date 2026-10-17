import { useEffect, useState } from "react"
import { buildPageItems, formatDate, type ApiRequest, type Pagination } from "./shared"

type CircleStatus = "active" | "disabled"

type Circle = {
  id: string
  name: string
  description: string | null
  coverUrl: string | null
  status: CircleStatus
  memberCount: number
  createdAt: string
  updatedAt: string
}

type CircleListResponse = {
  items: Circle[]
  pagination: Pagination
}

type CircleForm = {
  name: string
  description: string
  coverUrl: string
}

const emptyForm: CircleForm = { name: "", description: "", coverUrl: "" }

export function CirclesPage(props: {
  request: ApiRequest
  onUnauthorized: () => void
  onLogout: () => void
}) {
  const [circles, setCircles] = useState<Circle[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [keywordInput, setKeywordInput] = useState("")
  const [keywordQuery, setKeywordQuery] = useState("")
  const [statusInput, setStatusInput] = useState<"" | CircleStatus>("")
  const [statusQuery, setStatusQuery] = useState<"" | CircleStatus>("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Circle | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CircleForm>(emptyForm)

  async function loadCircles(page = 1, keyword = keywordQuery, status = statusQuery) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (keyword) params.set("keyword", keyword)
      if (status) params.set("status", status)
      const result = await props.request<CircleListResponse>(`/admin-api/circles?${params}`)
      setCircles(result.items)
      setPagination(result.pagination)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "圈子加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCircles(1, "", "")
  }, [])

  async function search(event: React.FormEvent) {
    event.preventDefault()
    const keyword = keywordInput.trim()
    setKeywordQuery(keyword)
    setStatusQuery(statusInput)
    await loadCircles(1, keyword, statusInput)
  }

  async function resetSearch() {
    setKeywordInput("")
    setKeywordQuery("")
    setStatusInput("")
    setStatusQuery("")
    await loadCircles(1, "", "")
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError("")
    setShowCreate(true)
  }

  function openEdit(circle: Circle) {
    setEditing(circle)
    setForm({ name: circle.name, description: circle.description ?? "", coverUrl: circle.coverUrl ?? "" })
    setError("")
  }

  function closeForm() {
    setShowCreate(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function submitCircle(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await props.request(editing ? `/admin-api/circles/${editing.id}` : "/admin-api/circles", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          coverUrl: form.coverUrl || null,
        }),
      })
      closeForm()
      await loadCircles(editing ? pagination?.page ?? 1 : 1)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "圈子保存失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(circle: Circle) {
    const nextStatus = circle.status === "active" ? "disabled" : "active"
    if (nextStatus === "disabled" && !window.confirm(`确认禁用圈子“${circle.name}”吗？`)) return
    setError("")
    try {
      await props.request(`/admin-api/circles/${circle.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      })
      await loadCircles(pagination?.page ?? 1)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "圈子状态修改失败")
    }
  }

  async function deleteCircle(circle: Circle) {
    const confirmed = window.confirm(`确认删除圈子“${circle.name}”吗？\n\n删除后小程序端将不再展示该圈子，已有成员关系会保留。`)
    if (!confirmed) return
    setDeletingId(circle.id)
    setError("")
    try {
      await props.request<void>(`/admin-api/circles/${circle.id}`, { method: "DELETE" })
      const currentPage = pagination?.page ?? 1
      const nextPage = circles.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage
      await loadCircles(nextPage)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "圈子删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const filterSummary = keywordQuery || (statusQuery === "active" ? "正常圈子" : statusQuery === "disabled" ? "禁用圈子" : "全部圈子")
  const modalOpen = showCreate || editing !== null

  return (
    <main className="content">
      <header className="topbar">
        <div><p className="eyebrow">COMMUNITY DIRECTORY</p><h1>圈子管理</h1></div>
        <button className="ghost-button" onClick={props.onLogout}>退出登录</button>
      </header>
      <section className="stats">
        <div><span>查询结果</span><strong>{pagination?.total ?? "—"}</strong></div>
        <div><span>当前筛选</span><strong className="query-summary">{filterSummary}</strong></div>
        <div><span>每页数量</span><strong>10</strong></div>
      </section>
      <section className="panel circle-panel">
        <div className="panel-heading"><div><h2>圈子列表</h2><p>维护学习、表白、二手等预设社区入口；小程序用户不能创建圈子。</p></div><button className="primary-button small" onClick={openCreate}>新增圈子</button></div>
        <form className="filters circle-filters" onSubmit={search}>
          <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="圈子名称" maxLength={50} placeholder="输入圈子名称" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} /></label>
          <select aria-label="圈子状态" value={statusInput} onChange={(event) => setStatusInput(event.target.value as "" | CircleStatus)}><option value="">全部状态</option><option value="active">正常</option><option value="disabled">禁用</option></select>
          <button className="primary-button search-button" type="submit" disabled={loading}>查询</button>
          <button className="secondary-button" type="button" disabled={loading || (!keywordInput && !keywordQuery && !statusInput && !statusQuery)} onClick={() => void resetSearch()}>重置</button>
        </form>
        {error && !modalOpen && <div className="error-banner inline">{error}</div>}
        <div className="table-wrap"><table className="circle-table"><thead><tr><th>圈子</th><th>简介</th><th>成员</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td className="empty" colSpan={6}>加载中...</td></tr> : circles.length === 0 ? <tr><td className="empty circle-empty" colSpan={6}><strong>暂无圈子</strong><span>创建第一个社区入口后会显示在这里。</span></td></tr> : circles.map((circle) => <tr key={circle.id}><td><div className="user-cell"><div className="avatar circle-cover">{circle.coverUrl ? <img src={circle.coverUrl} alt="" /> : circle.name.slice(0, 1)}</div><div><strong>{circle.name}</strong><small>ID {circle.id}</small></div></div></td><td><p className="circle-description">{circle.description || "暂无简介"}</p></td><td><strong className="member-count">{circle.memberCount}</strong><small>位成员</small></td><td><span className={`status-tag ${circle.status === "active" ? "active" : "disabled"}`}><i />{circle.status === "active" ? "正常" : "禁用"}</span></td><td className="muted">{formatDate(circle.createdAt)}</td><td><div className="action-buttons circle-actions"><button className="link-button" disabled={deletingId === circle.id} onClick={() => openEdit(circle)}>编辑</button><button className={`link-button ${circle.status === "active" ? "danger-link" : ""}`} disabled={deletingId === circle.id} onClick={() => void toggleStatus(circle)}>{circle.status === "active" ? "禁用" : "启用"}</button><button className="link-button danger-link" disabled={deletingId === circle.id} onClick={() => void deleteCircle(circle)}>{deletingId === circle.id ? "删除中" : "删除"}</button></div></td></tr>)}</tbody></table></div>
        {pagination && <div className="pagination"><span>共 <strong>{pagination.total}</strong> 条 · 每页 {pagination.pageSize} 条</span>{pagination.totalPages > 1 && <nav aria-label="圈子列表分页"><button className="page-arrow" aria-label="上一页" disabled={loading || pagination.page <= 1} onClick={() => void loadCircles(pagination.page - 1)}>‹</button><div className="desktop-pages">{buildPageItems(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === pagination.page ? "active" : ""} aria-current={item === pagination.page ? "page" : undefined} disabled={loading} onClick={() => void loadCircles(item)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary">第 {pagination.page} / {pagination.totalPages} 页</b><button className="page-arrow" aria-label="下一页" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void loadCircles(pagination.page + 1)}>›</button></nav>}</div>}
      </section>
      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="modal circle-form" onSubmit={submitCircle}><div className="modal-heading"><div><p className="eyebrow">{editing ? "EDIT CIRCLE" : "NEW CIRCLE"}</p><h2>{editing ? `编辑 ${editing.name}` : "新增圈子"}</h2></div><button type="button" className="close-button" aria-label="关闭" onClick={closeForm}>×</button></div>{error && <div className="error-banner">{error}</div>}<label>圈子名称<input required maxLength={50} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>圈子简介<textarea maxLength={500} rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>封面地址<input maxLength={500} placeholder="可选，填写受控存储的永久地址" value={form.coverUrl} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={closeForm}>取消</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? "保存中..." : "保存"}</button></div></form></div>}
    </main>
  )
}
