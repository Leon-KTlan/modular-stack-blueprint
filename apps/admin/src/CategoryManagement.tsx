import { useEffect, useState } from "react"

type Category = {
  id: string
  name: string
  code: string
  sortOrder: number
  status: "active" | "disabled"
  createdAt: string
  updatedAt: string
}

type CategoryList = {
  items: Category[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

type CategoryForm = { name: string; code: string; sortOrder: string }

const emptyForm: CategoryForm = { name: "", code: "", sortOrder: "0" }
const pageSize = 10
const tokenKey = "cangqiong_admin_token"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey)
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const body = response.status === 204 ? undefined : await response.json() as { error?: { message?: string } }
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? "请求失败"), { status: response.status })
  return body as T
}

function pageNumbers(page: number, totalPages: number): number[] {
  const first = Math.max(1, Math.min(page - 2, totalPages - 4))
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index)
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<CategoryList["pagination"] | null>(null)
  const [keywordInput, setKeywordInput] = useState("")
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Category | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CategoryForm>(emptyForm)

  async function loadCategories(requestedPage = page, requestedKeyword = keyword, requestedStatus = status) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(requestedPage), pageSize: String(pageSize) })
      if (requestedKeyword) params.set("keyword", requestedKeyword)
      if (requestedStatus !== "all") params.set("status", requestedStatus)
      const result = await request<CategoryList>(`/admin-api/categories?${params}`)
      setCategories(result.items)
      setPagination(result.pagination)
      setPage(result.pagination.page)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) {
        localStorage.removeItem(tokenKey)
        window.location.reload()
        return
      }
      setError(cause instanceof Error ? cause.message : "加载分类失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories(1, "", "all")
  }, [])

  async function search(event: React.FormEvent) {
    event.preventDefault()
    const nextKeyword = keywordInput.trim()
    setKeyword(nextKeyword)
    setPage(1)
    await loadCategories(1, nextKeyword, status)
  }

  async function changeStatusFilter(value: string) {
    setStatus(value)
    setPage(1)
    await loadCategories(1, keyword, value)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setForm({ name: category.name, code: category.code, sortOrder: String(category.sortOrder) })
    setShowForm(true)
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const payload = { name: form.name, code: form.code, sortOrder: Number(form.sortOrder) }
      await request<Category>(editing ? `/admin-api/categories/${editing.id}` : "/admin-api/categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      setShowForm(false)
      await loadCategories(editing ? page : 1, keyword, status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存分类失败")
    } finally {
      setSaving(false)
    }
  }

  async function toggleCategory(category: Category) {
    setError("")
    try {
      await request<Category>(`/admin-api/categories/${category.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: category.status === "active" ? "disabled" : "active" }),
      })
      await loadCategories(page, keyword, status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新分类状态失败")
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`确定删除“${category.name}”吗？已被帖子引用的分类无法删除。`)) return
    setError("")
    try {
      await request<void>(`/admin-api/categories/${category.id}`, { method: "DELETE" })
      const nextPage = categories.length === 1 && page > 1 ? page - 1 : page
      await loadCategories(nextPage, keyword, status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除分类失败")
    }
  }

  return (
    <>
      <section className="category-summary">
        <div><span className="category-summary-icon">分</span><div><p className="eyebrow">POST TOPICS</p><h2>帖子主题分类</h2><p>维护用户发帖时可选择的主题。停用分类不会影响已发布的帖子。</p></div></div>
        <button className="primary-button" onClick={openCreate}>新增分类 <span aria-hidden="true">＋</span></button>
      </section>

      <section className="panel category-panel">
        <div className="panel-heading"><div><h2>分类列表</h2><p>共 {pagination?.total ?? "—"} 个分类 · 按排序值从小到大展示</p></div><span className="category-page-size">每页 10 条</span></div>
        <form className="filters category-filters" onSubmit={search}>
          <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="搜索分类" maxLength={50} placeholder="搜索分类名称或代码" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} /></label>
          <label className="category-status-filter"><span>状态</span><select aria-label="分类状态" value={status} onChange={(event) => void changeStatusFilter(event.target.value)}><option value="all">全部</option><option value="active">启用</option><option value="disabled">停用</option></select></label>
          <button className="primary-button search-button" type="submit" disabled={loading}>查询</button>
          <button className="secondary-button" type="button" disabled={loading || (!keywordInput && !keyword)} onClick={() => { setKeywordInput(""); setKeyword(""); void loadCategories(1, "", status) }}>重置</button>
        </form>
        {error && <div className="error-banner inline">{error}</div>}
        <div className="table-wrap"><table className="category-table"><thead><tr><th>分类名称</th><th>唯一代码</th><th>排序</th><th>状态</th><th>最近更新</th><th>操作</th></tr></thead><tbody>
          {loading ? <tr><td className="empty" colSpan={6}>正在加载分类…</td></tr> : categories.length === 0 ? <tr><td className="empty" colSpan={6}>没有符合条件的分类</td></tr> : categories.map((category, index) => <tr key={category.id}>
            <td><div className="category-name-cell"><span className="category-row-number">{String((page - 1) * pageSize + index + 1).padStart(2, "0")}</span><div><strong>{category.name}</strong><small>ID {category.id}</small></div></div></td>
            <td><code className="category-code">{category.code}</code></td>
            <td><span className="sort-value">{String(category.sortOrder).padStart(2, "0")}</span></td>
            <td><span className={`status-tag ${category.status === "active" ? "active" : "disabled"}`}><i />{category.status === "active" ? "启用" : "停用"}</span></td>
            <td className="muted">{new Date(category.updatedAt).toLocaleDateString("zh-CN")}</td>
            <td><div className="action-buttons"><button className="link-button" onClick={() => openEdit(category)}>编辑</button><button className="link-button" onClick={() => void toggleCategory(category)}>{category.status === "active" ? "停用" : "启用"}</button><button className="link-button danger-link" onClick={() => void deleteCategory(category)}>删除</button></div></td>
          </tr>)}
        </tbody></table></div>
        {pagination && <div className="pagination category-pagination"><span>共 <strong>{pagination.total}</strong> 条</span><nav aria-label="分类列表分页"><button aria-label="上一页" disabled={loading || page <= 1} onClick={() => void loadCategories(page - 1)}>‹</button><div className="desktop-pages">{pageNumbers(page, pagination.totalPages).map((number) => <button key={number} className={number === page ? "active" : ""} aria-current={number === page ? "page" : undefined} disabled={loading} onClick={() => void loadCategories(number)}>{number}</button>)}</div><b className="mobile-page-summary">第 {page} / {Math.max(1, pagination.totalPages)} 页</b><button aria-label="下一页" disabled={loading || page >= pagination.totalPages} onClick={() => void loadCategories(page + 1)}>›</button></nav></div>}
      </section>

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false) }}><form className="modal category-modal" onSubmit={saveCategory}>
        <div className="modal-heading"><div><p className="eyebrow">{editing ? "EDIT TOPIC" : "NEW TOPIC"}</p><h2>{editing ? "编辑分类" : "新增分类"}</h2></div><button type="button" className="close-button" aria-label="关闭" onClick={() => setShowForm(false)}>×</button></div>
        {error && <div className="error-banner">{error}</div>}
        <label>分类名称<input required maxLength={50} placeholder="例如：校园生活" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>唯一代码<input required maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如：campus-life" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /><small className="field-hint">使用小写英文、数字和连字符；创建后尽量保持稳定。</small></label>
        <label>排序值<input required type="number" min="0" max="1000000" step="1" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>取消</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中…" : "保存分类"}</button></div>
      </form></div>}
    </>
  )
}
