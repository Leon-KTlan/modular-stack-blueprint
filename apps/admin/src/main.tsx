import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "./styles.css"

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
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

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
  const body = await response.json()
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? "请求失败"), { status: response.status })
  return body as T
}

function formatDate(value: string | null) {
  if (!value) return "从未登录"
  return new Date(value).toLocaleString("zh-CN", { hour12: false })
}

function genderLabel(gender: User["gender"]) {
  return ["未设置", "男", "女"][gender]
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey))
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<UserListResponse["pagination"] | null>(null)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [loginForm, setLoginForm] = useState({ username: "", password: "" })
  const [createForm, setCreateForm] = useState({ username: "", password: "", phone: "", email: "", gender: 0, role: 0 })
  const [showCreate, setShowCreate] = useState(false)

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

  async function loadUsers(page = 1) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" })
      if (keyword.trim()) params.set("keyword", keyword.trim())
      if (status) params.set("status", status)
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
    if (token) void loadUsers()
  }, [token])

  async function toggleStatus(user: User) {
    try {
      await request(`/admin-api/users/${user.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: user.status === 1 ? 0 : 1 }),
      })
      await loadUsers(pagination?.page ?? 1)
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
      await loadUsers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败")
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
        <nav><a className="active">用户管理</a><a className="disabled-link">业务模块（待接入）</a></nav>
        <div className="sidebar-footer"><span className="status-dot" />系统运行正常</div>
      </aside>
      <main className="content">
        <header className="topbar"><div><p className="eyebrow">ADMINISTRATION</p><h1>用户管理</h1></div><button className="ghost-button" onClick={() => { localStorage.removeItem(tokenKey); setToken(null) }}>退出登录</button></header>
        <section className="stats"><div><span>用户总数</span><strong>{pagination?.total ?? "—"}</strong></div><div><span>当前筛选</span><strong>{status === "1" ? "正常" : status === "0" ? "禁用" : "全部"}</strong></div><div><span>管理方式</span><strong>JWT</strong></div></section>
        <section className="panel">
          <div className="panel-heading"><div><h2>用户列表</h2><p>查看和管理系统中的用户资料、角色和账号状态。</p></div><button className="primary-button small" onClick={() => setShowCreate(true)}>新增用户</button></div>
          <div className="filters"><input placeholder="搜索用户名、手机号或邮箱" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadUsers() }} /><select value={status} onChange={(event) => { setStatus(event.target.value) }}><option value="">全部状态</option><option value="1">正常</option><option value="0">禁用</option></select><button className="secondary-button" onClick={() => void loadUsers()}>查询</button></div>
          {error && <div className="error-banner inline">{error}</div>}
          <div className="table-wrap"><table><thead><tr><th>用户</th><th>联系方式</th><th>性别</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td className="empty" colSpan={7}>加载中...</td></tr> : users.length === 0 ? <tr><td className="empty" colSpan={7}>暂无用户</td></tr> : users.map((user) => <tr key={user.id}><td><div className="user-cell"><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><div><strong>{user.username}</strong><small>ID {user.id}</small></div></div></td><td><div>{user.phone || "未填写"}</div><small>{user.email || "未填写邮箱"}</small></td><td>{genderLabel(user.gender)}</td><td><span className={`role-tag ${user.role === 1 ? "admin" : ""}`}>{user.role === 1 ? "管理员" : "普通用户"}</span></td><td><span className={`status-tag ${user.status === 1 ? "active" : "disabled"}`}><i />{user.status === 1 ? "正常" : "禁用"}</span></td><td className="muted">{formatDate(user.lastLoginAt)}</td><td><button className="link-button" onClick={() => void toggleStatus(user)}>{user.status === 1 ? "禁用" : "启用"}</button></td></tr>)}</tbody></table></div>
          {pagination && pagination.totalPages > 1 && <div className="pagination"><span>共 {pagination.total} 条</span><div><button disabled={pagination.page <= 1} onClick={() => void loadUsers(pagination.page - 1)}>上一页</button><b>{pagination.page} / {pagination.totalPages}</b><button disabled={pagination.page >= pagination.totalPages} onClick={() => void loadUsers(pagination.page + 1)}>下一页</button></div></div>}
        </section>
      </main>
      {showCreate && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false) }}><form className="modal" onSubmit={createUser}><div className="modal-heading"><div><p className="eyebrow">NEW USER</p><h2>新增用户</h2></div><button type="button" className="close-button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="error-banner">{error}</div>}<div className="form-grid"><label>用户名<input required value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} /></label><label>初始密码<input required minLength={8} type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} /></label><label>手机号<input value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} /></label><label>邮箱<input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></label><label>性别<select value={createForm.gender} onChange={(event) => setCreateForm({ ...createForm, gender: Number(event.target.value) })}><option value={0}>未设置</option><option value={1}>男</option><option value={2}>女</option></select></label><label>角色<select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: Number(event.target.value) })}><option value={0}>普通用户</option><option value={1}>管理员</option></select></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>取消</button><button className="primary-button" type="submit">创建用户</button></div></form></div>}
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
