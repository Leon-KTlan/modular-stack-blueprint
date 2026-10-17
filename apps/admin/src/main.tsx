import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { CirclesPage } from "./CirclesPage"
import { MiniappUsersPage } from "./MiniappUsersPage"
import { buildPageItems, formatDate, type Pagination } from "./shared"
import { CategoryManagement } from "./CategoryManagement.js"
import "./styles.css"
import "./pagination.css"
import "./circles.css"
import "./categories.css"

type User = {
  id: number
  username: string
  phone: string | null
  email: string | null
  gender: 0 | 1 | 2
  role: 0 | 1
  status: 0 | 1
  lastLoginAt: string | null
  createdAt: string
}

type UserListResponse = {
  items: User[]
  pagination: Pagination
}

const tokenKey = "cangqiong_admin_token"

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey)
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const body = response.status === 204 ? undefined : await response.json() as { error?: { message?: string } }
  if (!response.ok) throw Object.assign(new Error(body?.error?.message ?? "请求失败"), { status: response.status })
  return body as T
}

function genderLabel(gender: User["gender"]) {
  return ["未设置", "男", "女"][gender]
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey))
  const [activeSection, setActiveSection] = useState<"admin-users" | "miniapp-users" | "circles" | "categories">("admin-users")
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<UserListResponse["pagination"] | null>(null)
  const [usernameInput, setUsernameInput] = useState("")
  const [usernameQuery, setUsernameQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [loginForm, setLoginForm] = useState({ username: "", password: "" })
  const [createForm, setCreateForm] = useState({ username: "", password: "", phone: "", email: "", gender: 0, role: 0 })
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetForm, setResetForm] = useState({ password: "", reason: "" })

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      const result = await request<{ accessToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      })
      localStorage.setItem(tokenKey, result.accessToken)
      setToken(result.accessToken)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败")
    }
  }

  async function loadUsers(page = 1, username = usernameQuery) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (username) params.set("username", username)
      const result = await request<UserListResponse>(`/admin-api/users?${params}`)
      setUsers(result.items)
      setPagination(result.pagination)
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) {
        localStorage.removeItem(tokenKey)
        setToken(null)
      }
      setError(cause instanceof Error ? cause.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token && activeSection === "admin-users") void loadUsers(1, "")
  }, [token, activeSection])

  function logout() {
    localStorage.removeItem(tokenKey)
    setToken(null)
  }

  async function searchUsers(event: React.FormEvent) {
    event.preventDefault()
    const username = usernameInput.trim()
    setUsernameQuery(username)
    await loadUsers(1, username)
  }

  async function resetSearch() {
    setUsernameInput("")
    setUsernameQuery("")
    await loadUsers(1, "")
  }

  async function toggleStatus(user: User) {
    try {
      await request(`/admin-api/users/${user.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: user.status === 1 ? 0 : 1 }),
      })
      await loadUsers(pagination?.page ?? 1, usernameQuery)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败")
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault()
    try {
      await request("/admin-api/users", {
        method: "POST",
        body: JSON.stringify(createForm),
      })
      setShowCreate(false)
      setCreateForm({ username: "", password: "", phone: "", email: "", gender: 0, role: 0 })
      setUsernameInput("")
      setUsernameQuery("")
      await loadUsers(1, "")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败")
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!resetTarget) return
    setError("")
    try {
      await request(`/admin-api/users/${resetTarget.id}/password-reset`, {
        method: "POST",
        body: JSON.stringify(resetForm),
      })
      setResetTarget(null)
      setResetForm({ password: "", reason: "" })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "密码重置失败")
    }
  }

  if (!token) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark">苍</div>
          <p className="eyebrow">CANGQIONG ADMIN</p>
          <h1>登录管理后台</h1>
          <p className="muted">使用管理员账号进入用户管理。</p>
          {error && <div className="error-banner">{error}</div>}
          <label>用户名<input value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} /></label>
          <label>密码<input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></label>
          <button className="primary-button" type="submit">登录</button>
          <p className="hint">演示账号：admin / Admin123!</p>
        </form>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span>苍</span><div><strong>苍穹</strong><small>管理后台</small></div></div>
        <nav><button className={activeSection === "admin-users" ? "active" : ""} onClick={() => setActiveSection("admin-users")}><span>后</span>后台账号</button><button className={activeSection === "miniapp-users" ? "active" : ""} onClick={() => setActiveSection("miniapp-users")}><span>微</span>小程序用户</button><button className={activeSection === "circles" ? "active" : ""} onClick={() => setActiveSection("circles")}><span>圈</span>圈子管理</button><button className={activeSection === "categories" ? "active" : ""} onClick={() => setActiveSection("categories")}><span>分</span>帖子分类</button></nav>
        <div className="sidebar-footer"><span className="status-dot" />系统运行正常</div>
      </aside>
      {activeSection === "admin-users" ? <main className="content">
        <header className="topbar"><div><p className="eyebrow">ADMINISTRATION</p><h1>后台账号</h1></div><button className="ghost-button" onClick={logout}>退出登录</button></header>
        <section className="stats"><div><span>查询结果</span><strong>{pagination?.total ?? "—"}</strong></div><div><span>用户名检索</span><strong className="query-summary">{usernameQuery || "全部用户"}</strong></div><div><span>每页数量</span><strong>10</strong></div></section>
        <section className="panel">
          <div className="panel-heading"><div><h2>用户列表</h2><p>查看和管理系统中的用户资料、角色和账号状态。</p></div><button className="primary-button small" onClick={() => setShowCreate(true)}>新增用户</button></div>
          <form className="filters" onSubmit={searchUsers}><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="用户名" maxLength={50} placeholder="输入用户名，例如 demo_018" value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} /></label><button className="primary-button search-button" type="submit" disabled={loading}>查询</button><button className="secondary-button" type="button" disabled={loading || (!usernameInput && !usernameQuery)} onClick={() => void resetSearch()}>重置</button></form>
          {error && <div className="error-banner inline">{error}</div>}
          <div className="table-wrap"><table><thead><tr><th>用户</th><th>联系方式</th><th>性别</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td className="empty" colSpan={7}>加载中...</td></tr> : users.length === 0 ? <tr><td className="empty" colSpan={7}>暂无用户</td></tr> : users.map((user) => <tr key={user.id}><td><div className="user-cell"><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><div><strong>{user.username}</strong><small>ID {user.id}</small></div></div></td><td><div>{user.phone || "未填写"}</div><small>{user.email || "未填写邮箱"}</small></td><td>{genderLabel(user.gender)}</td><td><span className={`role-tag ${user.role === 1 ? "admin" : ""}`}>{user.role === 1 ? "管理员" : "普通用户"}</span></td><td><span className={`status-tag ${user.status === 1 ? "active" : "disabled"}`}><i />{user.status === 1 ? "正常" : "禁用"}</span></td><td className="muted">{formatDate(user.lastLoginAt)}</td><td><div className="action-buttons"><button className="link-button" onClick={() => { setError(""); setResetTarget(user) }}>重置密码</button><button className="link-button" onClick={() => void toggleStatus(user)}>{user.status === 1 ? "禁用" : "启用"}</button></div></td></tr>)}</tbody></table></div>
          {pagination && <div className="pagination"><span>共 <strong>{pagination.total}</strong> 条 · 每页 10 条</span>{pagination.totalPages > 1 && <nav aria-label="用户列表分页"><button className="page-arrow" aria-label="上一页" disabled={loading || pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1, usernameQuery)}>‹</button><div className="desktop-pages">{buildPageItems(pagination.page, pagination.totalPages).map((item) => typeof item === "number" ? <button key={item} className={item === pagination.page ? "active" : ""} aria-current={item === pagination.page ? "page" : undefined} disabled={loading} onClick={() => void loadUsers(item, usernameQuery)}>{item}</button> : <span key={item}>…</span>)}</div><b className="mobile-page-summary">第 {pagination.page} / {pagination.totalPages} 页</b><button className="page-arrow" aria-label="下一页" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void loadUsers(pagination.page + 1, usernameQuery)}>›</button></nav>}</div>}
        </section>
      </main> : activeSection === "miniapp-users" ? <MiniappUsersPage request={request} onUnauthorized={logout} onLogout={logout} /> : activeSection === "circles" ? <CirclesPage request={request} onUnauthorized={logout} onLogout={logout} /> : <main className="content">
        <header className="topbar"><div><p className="eyebrow">POST TOPICS</p><h1>分类管理</h1></div><button className="ghost-button" onClick={logout}>退出登录</button></header>
        <CategoryManagement />
      </main>}
      {showCreate && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false) }}><form className="modal" onSubmit={createUser}><div className="modal-heading"><div><p className="eyebrow">NEW USER</p><h2>新增用户</h2></div><button type="button" className="close-button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="error-banner">{error}</div>}<div className="form-grid"><label>用户名<input required value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} /></label><label>初始密码<input required minLength={8} type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} /></label><label>手机号<input value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} /></label><label>邮箱<input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></label><label>性别<select value={createForm.gender} onChange={(event) => setCreateForm({ ...createForm, gender: Number(event.target.value) })}><option value={0}>未设置</option><option value={1}>男</option><option value={2}>女</option></select></label><label>角色<select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: Number(event.target.value) })}><option value={0}>普通用户</option><option value={1}>管理员</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" type="submit">创建用户</button></div></form></div>}
      {resetTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetTarget(null) }}><form className="modal" onSubmit={resetPassword}><div className="modal-heading"><div><p className="eyebrow">PASSWORD RESET</p><h2>重置 {resetTarget.username} 的密码</h2></div><button type="button" className="close-button" onClick={() => setResetTarget(null)}>×</button></div>{error && <div className="error-banner">{error}</div>}<label>新密码<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={resetForm.password} onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })} /></label><label>重置原因<input required maxLength={500} value={resetForm.reason} onChange={(event) => setResetForm({ ...resetForm, reason: event.target.value })} /></label><p className="hint">重置后，该用户已登录的会话会立即失效。</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setResetTarget(null)}>取消</button><button className="primary-button" type="submit">确认重置</button></div></form></div>}
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
