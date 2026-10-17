import { useEffect, useState } from "react"
import { buildPageItems, formatDate, type ApiRequest, type Pagination } from "./shared"

type Status = "published" | "hidden" | "deleted"
type ContentType = "TEXT" | "IMAGE_TEXT" | "VIDEO"
type Media = { id: string; type: "IMAGE" | "VIDEO"; url: string; sortOrder: number; createdAt: string }
type Post = {
  id: string
  user: { id: string; nickname: string; avatarUrl: string | null }
  circle: { id: string; name: string }
  category: { id: string; name: string; code: string }
  contentType: ContentType
  content: string
  status: Exclude<Status, "deleted">
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  likeCount: number
  commentCount: number
  media: Media[]
}
type ListResponse<T> = { items: T[]; pagination: Pagination }
type CircleOption = { id: string; name: string }
type CategoryOption = { id: string; name: string }

const labels: Record<Status, string> = { published: "可见", hidden: "已隐藏", deleted: "已删除" }
const typeLabels: Record<ContentType, string> = { TEXT: "纯文字", IMAGE_TEXT: "图文", VIDEO: "视频" }

export function PostManagement(props: { request: ApiRequest; onUnauthorized: () => void; onLogout: () => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [circles, setCircles] = useState<CircleOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [status, setStatus] = useState<"" | Status>("")
  const [circleId, setCircleId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [contentType, setContentType] = useState<"" | ContentType>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  async function load(page = 1, filters = { status, circleId, categoryId, contentType }) {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ page: String(page) })
    if (filters.status) params.set("status", filters.status)
    if (filters.circleId) params.set("circleId", filters.circleId)
    if (filters.categoryId) params.set("categoryId", filters.categoryId)
    if (filters.contentType) params.set("contentType", filters.contentType)
    try {
      const result = await props.request<ListResponse<Post>>(`/admin-api/posts?${params}`)
      setPosts(result.items)
      setPagination(result.pagination)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "帖子加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void props.request<ListResponse<CircleOption>>("/admin-api/circles?page=1")
      .then((result) => setCircles(result.items))
      .catch(() => undefined)
    void props.request<ListResponse<CategoryOption>>("/admin-api/categories?page=1&pageSize=100")
      .then((result) => setCategories(result.items))
      .catch(() => undefined)
  }, [])

  async function changeStatus(post: Post) {
    const nextStatus = post.status === "published" ? "hidden" : "published"
    const reason = window.prompt(`请输入${nextStatus === "hidden" ? "隐藏" : "恢复显示"}原因` )?.trim()
    if (!reason) return
    try {
      await props.request(`/admin-api/posts/${post.id}/status`, { method: "POST", body: JSON.stringify({ status: nextStatus, reason }) })
      await load(pagination?.page ?? 1)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "帖子状态更新失败")
    }
  }

  async function deletePost(post: Post) {
    const reason = window.prompt("请输入删除原因")?.trim()
    if (!reason) return
    if (!window.confirm(`确认软删除帖子 #${post.id} 吗？历史评论和点赞会保留。`)) return
    try {
      await props.request<void>(`/admin-api/posts/${post.id}`, { method: "DELETE", body: JSON.stringify({ reason }) })
      await load(pagination?.page ?? 1)
      if (selectedPost?.id === post.id) setSelectedPost(null)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "帖子删除失败")
    }
  }

  async function openDetail(post: Post) {
    try {
      setSelectedPost(await props.request<Post>(`/admin-api/posts/${post.id}`))
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) props.onUnauthorized()
      setError(cause instanceof Error ? cause.message : "帖子详情加载失败")
    }
  }

  const filterSummary = [
    status ? labels[status] : "全部状态",
    circleId ? circles.find((item) => item.id === circleId)?.name : null,
    categoryId ? categories.find((item) => item.id === categoryId)?.name : null,
    contentType ? typeLabels[contentType] : null,
  ].filter(Boolean).join(" · ")

  return <main className="content">
    <header className="topbar"><div><p className="eyebrow">COMMUNITY CONTENT</p><h1>帖子管理</h1></div><button className="ghost-button" onClick={props.onLogout}>退出登录</button></header>
    <section className="stats"><div><span>查询结果</span><strong>{pagination?.total ?? "—"}</strong></div><div><span>当前筛选</span><strong className="query-summary">{filterSummary}</strong></div><div><span>每页数量</span><strong>10</strong></div></section>
    <section className="panel content-panel">
      <div className="panel-heading"><div><h2>帖子列表</h2><p>查看社区内容、媒体及互动数据；管理操作会写入审计记录。</p></div></div>
      <form className="filters content-filters" onSubmit={(event) => { event.preventDefault(); void load(1) }}>
        <select aria-label="帖子状态" value={status} onChange={(event) => setStatus(event.target.value as "" | Status)}><option value="">全部状态</option><option value="published">可见</option><option value="hidden">已隐藏</option><option value="deleted">已删除</option></select>
        <select aria-label="圈子" value={circleId} onChange={(event) => setCircleId(event.target.value)}><option value="">全部圈子</option>{circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select>
        <select aria-label="分类" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <select aria-label="内容形式" value={contentType} onChange={(event) => setContentType(event.target.value as "" | ContentType)}><option value="">全部形式</option><option value="TEXT">纯文字</option><option value="IMAGE_TEXT">图文</option><option value="VIDEO">视频</option></select>
        <button className="primary-button search-button" type="submit" disabled={loading}>查询</button>
        <button className="secondary-button" type="button" disabled={loading || !filterSummary.includes("·") && !status && !circleId && !categoryId && !contentType} onClick={() => { setStatus(""); setCircleId(""); setCategoryId(""); setContentType(""); void load(1, { status: "", circleId: "", categoryId: "", contentType: "" }) }}>重置</button>
      </form>
      {error && <div className="error-banner inline">{error}</div>}
      <div className="table-wrap"><table className="content-table"><thead><tr><th>帖子</th><th>作者</th><th>圈子 / 分类</th><th>互动</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead><tbody>
        {loading ? <tr><td className="empty" colSpan={7}>加载中...</td></tr> : posts.length === 0 ? <tr><td className="empty" colSpan={7}>暂无帖子</td></tr> : posts.map((post) => <tr key={post.id}>
          <td><div className="post-preview"><span className="content-type-mark">{typeLabels[post.contentType]}</span><p>{post.content}</p><small>ID {post.id}</small></div></td>
          <td><strong>{post.user.nickname}</strong><small>ID {post.user.id}</small></td>
          <td><strong>{post.circle.name}</strong><small>{post.category.name}</small></td>
          <td><span>♥ {post.likeCount}</span><small>评论 {post.commentCount}</small></td>
          <td><span className={`status-tag ${post.deletedAt ? "disabled" : post.status === "published" ? "active" : "disabled"}`}><i />{post.deletedAt ? labels.deleted : labels[post.status]}</span></td>
          <td className="muted">{formatDate(post.createdAt)}</td>
          <td><div className="action-buttons"><button className="link-button" onClick={() => void openDetail(post)}>详情</button>{!post.deletedAt && <><button className="link-button" onClick={() => void changeStatus(post)}>{post.status === "published" ? "隐藏" : "恢复"}</button><button className="link-button danger-link" onClick={() => void deletePost(post)}>删除</button></>}</div></td>
        </tr>)}
      </tbody></table></div>
      {pagination && <div className="pagination"><span>共 <strong>{pagination.total}</strong> 条 · 每页 {pagination.pageSize} 条</span>{pagination.totalPages > 1 && <nav aria-label="帖子列表分页"><button className="page-arrow" disabled={loading || pagination.page <= 1} onClick={() => void load(pagination.page - 1)}>‹</button><div className="desktop-pages">{buildPageItems(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === pagination.page ? "active" : ""} aria-current={item === pagination.page ? "page" : undefined} disabled={loading} onClick={() => void load(item)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary">第 {pagination.page} / {pagination.totalPages} 页</b><button className="page-arrow" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void load(pagination.page + 1)}>›</button></nav>}</div>}
    </section>
    {selectedPost && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPost(null) }}><section className="modal post-detail-modal"><div className="modal-heading"><div><p className="eyebrow">POST DETAIL · #{selectedPost.id}</p><h2>{selectedPost.circle.name} / {selectedPost.category.name}</h2></div><button className="close-button" aria-label="关闭详情" onClick={() => setSelectedPost(null)}>×</button></div><div className="post-detail-meta"><span>作者：{selectedPost.user.nickname}（{selectedPost.user.id}）</span><span>{typeLabels[selectedPost.contentType]} · {formatDate(selectedPost.createdAt)}</span><span>点赞 {selectedPost.likeCount} · 评论 {selectedPost.commentCount}</span></div><p className="post-detail-content">{selectedPost.content}</p>{selectedPost.media.length > 0 ? <div className="post-media-list">{selectedPost.media.map((media) => media.type === "IMAGE" ? <img key={media.id} src={media.url} alt="帖子附件" /> : <a key={media.id} href={media.url} target="_blank" rel="noreferrer">查看视频附件</a>)}</div> : <p className="post-media-empty">暂无媒体附件</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedPost(null)}>关闭</button></div></section></div>}
  </main>
}
