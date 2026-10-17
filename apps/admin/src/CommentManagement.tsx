import { useEffect, useState } from "react"
import { buildPageItems, formatDate, type ApiRequest, type Pagination } from "./shared"

type Status = "published" | "hidden" | "deleted"
type Comment = {
  id: string
  post: { id: string; content: string; circleName: string }
  user: { id: string; nickname: string; avatarUrl: string | null }
  content: string
  status: Exclude<Status, "deleted">
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
type ListResponse = { items: Comment[]; pagination: Pagination }

const labels: Record<Status, string> = { published: "可见", hidden: "已隐藏", deleted: "已删除" }

export function CommentManagement(props: { request: ApiRequest; onUnauthorized: () => void; onLogout: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [status, setStatus] = useState<"" | Status>("")
  const [postId, setPostId] = useState("")
  const [userId, setUserId] = useState("")
  const [postIdQuery, setPostIdQuery] = useState("")
  const [userIdQuery, setUserIdQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)

  async function load(page = 1, filters = { status, postId: postIdQuery, userId: userIdQuery }) {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ page: String(page) })
    if (filters.status) params.set("status", filters.status)
    if (filters.postId) params.set("postId", filters.postId)
    if (filters.userId) params.set("userId", filters.userId)
    try {
      const result = await props.request<ListResponse>(`/admin-api/comments?${params}`)
      setComments(result.items)
      setPagination(result.pagination)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "评论加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function changeStatus(comment: Comment) {
    const nextStatus = comment.status === "published" ? "hidden" : "published"
    const reason = window.prompt(`请输入${nextStatus === "hidden" ? "隐藏" : "恢复显示"}原因`)?.trim()
    if (!reason) return
    try {
      await props.request(`/admin-api/comments/${comment.id}/status`, { method: "POST", body: JSON.stringify({ status: nextStatus, reason }) })
      await load(pagination?.page ?? 1)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "评论状态更新失败")
    }
  }

  async function deleteComment(comment: Comment) {
    const reason = window.prompt("请输入删除原因")?.trim()
    if (!reason) return
    if (!window.confirm(`确认软删除评论 #${comment.id} 吗？`)) return
    try {
      await props.request<void>(`/admin-api/comments/${comment.id}`, { method: "DELETE", body: JSON.stringify({ reason }) })
      await load(pagination?.page ?? 1)
      if (selectedComment?.id === comment.id) setSelectedComment(null)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "评论删除失败")
    }
  }

  async function openDetail(comment: Comment) {
    try {
      setSelectedComment(await props.request<Comment>(`/admin-api/comments/${comment.id}`))
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "评论详情加载失败")
    }
  }

  const filterSummary = [status ? labels[status] : null, postIdQuery ? `帖子 ${postIdQuery}` : null, userIdQuery ? `用户 ${userIdQuery}` : null].filter(Boolean).join(" · ") || "全部评论"

  return <main className="content">
    <header className="topbar"><div><p className="eyebrow">COMMUNITY MODERATION</p><h1>评论管理</h1></div><button className="ghost-button" onClick={props.onLogout}>退出登录</button></header>
    <section className="stats"><div><span>查询结果</span><strong>{pagination?.total ?? "—"}</strong></div><div><span>当前筛选</span><strong className="query-summary">{filterSummary}</strong></div><div><span>每页数量</span><strong>10</strong></div></section>
    <section className="panel content-panel">
      <div className="panel-heading"><div><h2>评论列表</h2><p>集中查看评论及关联帖子；隐藏、恢复和删除均记录操作审计。</p></div></div>
      <form className="filters content-filters comment-filters" onSubmit={(event) => { event.preventDefault(); const p = postId.trim(); const u = userId.trim(); setPostIdQuery(p); setUserIdQuery(u); void load(1, { status, postId: p, userId: u }) }}>
        <label><span className="sr-only">帖子 ID</span><input aria-label="帖子 ID" inputMode="numeric" placeholder="帖子 ID" value={postId} onChange={(event) => setPostId(event.target.value)} /></label>
        <label><span className="sr-only">用户 ID</span><input aria-label="用户 ID" inputMode="numeric" placeholder="用户 ID" value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
        <select aria-label="评论状态" value={status} onChange={(event) => setStatus(event.target.value as "" | Status)}><option value="">全部状态</option><option value="published">可见</option><option value="hidden">已隐藏</option><option value="deleted">已删除</option></select>
        <button className="primary-button search-button" type="submit" disabled={loading}>查询</button>
        <button className="secondary-button" type="button" disabled={loading || (!postId && !postIdQuery && !userId && !userIdQuery && !status)} onClick={() => { setPostId(""); setPostIdQuery(""); setUserId(""); setUserIdQuery(""); setStatus(""); void load(1, { status: "", postId: "", userId: "" }) }}>重置</button>
      </form>
      {error && <div className="error-banner inline">{error}</div>}
      <div className="table-wrap"><table className="comment-table"><thead><tr><th>评论内容</th><th>作者</th><th>关联帖子</th><th>状态</th><th>评论时间</th><th>操作</th></tr></thead><tbody>
        {loading ? <tr><td className="empty" colSpan={6}>加载中...</td></tr> : comments.length === 0 ? <tr><td className="empty" colSpan={6}>暂无评论</td></tr> : comments.map((comment) => <tr key={comment.id}>
          <td><div className="comment-preview"><p>{comment.content}</p><small>ID {comment.id}</small></div></td>
          <td><strong>{comment.user.nickname}</strong><small>ID {comment.user.id}</small></td>
          <td><strong>#{comment.post.id} · {comment.post.circleName}</strong><small>{comment.post.content}</small></td>
          <td><span className={`status-tag ${comment.deletedAt ? "disabled" : comment.status === "published" ? "active" : "disabled"}`}><i />{comment.deletedAt ? labels.deleted : labels[comment.status]}</span></td>
          <td className="muted">{formatDate(comment.createdAt)}</td>
          <td><div className="action-buttons"><button className="link-button" onClick={() => void openDetail(comment)}>详情</button>{!comment.deletedAt && <><button className="link-button" onClick={() => void changeStatus(comment)}>{comment.status === "published" ? "隐藏" : "恢复"}</button><button className="link-button danger-link" onClick={() => void deleteComment(comment)}>删除</button></>}</div></td>
        </tr>)}
      </tbody></table></div>
      {pagination && <div className="pagination"><span>共 <strong>{pagination.total}</strong> 条 · 每页 {pagination.pageSize} 条</span>{pagination.totalPages > 1 && <nav aria-label="评论列表分页"><button className="page-arrow" disabled={loading || pagination.page <= 1} onClick={() => void load(pagination.page - 1)}>‹</button><div className="desktop-pages">{buildPageItems(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === pagination.page ? "active" : ""} aria-current={item === pagination.page ? "page" : undefined} disabled={loading} onClick={() => void load(item)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary">第 {pagination.page} / {pagination.totalPages} 页</b><button className="page-arrow" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void load(pagination.page + 1)}>›</button></nav>}</div>}
    </section>
    {selectedComment && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedComment(null) }}><section className="modal post-detail-modal"><div className="modal-heading"><div><p className="eyebrow">COMMENT DETAIL · #{selectedComment.id}</p><h2>{selectedComment.post.circleName} · 帖子 #{selectedComment.post.id}</h2></div><button className="close-button" aria-label="关闭详情" onClick={() => setSelectedComment(null)}>×</button></div><div className="post-detail-meta"><span>作者：{selectedComment.user.nickname}（{selectedComment.user.id}）</span><span>评论时间：{formatDate(selectedComment.createdAt)}</span></div><p className="post-detail-content">{selectedComment.content}</p><div className="related-post"><small>关联帖子</small><p>{selectedComment.post.content}</p></div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedComment(null)}>关闭</button></div></section></div>}
  </main>
}
