import { app } from "./server.js"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

try {
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "Admin123!" } })
  assert(login.statusCode === 200, `管理员登录失败: ${login.body}`)
  const token = login.json<{ accessToken: string }>().accessToken
  const headers = { authorization: `Bearer ${token}` }

  const unauthorized = await app.inject({ method: "GET", url: "/admin-api/users" })
  assert(unauthorized.statusCode === 401, "未登录用户不应访问管理接口")

  let list = await app.inject({ method: "GET", url: "/admin-api/users?page=1&pageSize=10", headers })
  assert(list.statusCode === 200 && list.json().pagination.total >= 3, "种子用户查询失败")

  let demo = list.json().items.find((user: { username: string }) => user.username === "demo")
  if (!demo) {
    const created = await app.inject({ method: "POST", url: "/admin-api/users", headers,
      payload: { username: "demo", password: "Demo12345!", email: "demo@example.com", gender: 0, role: 0 },
    })
    assert(created.statusCode === 201, `新增用户失败: ${created.body}`)
    demo = created.json()
  }

  const demoLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "demo", password: "Demo12345!" } })
  assert(demoLogin.statusCode === 200, "普通用户登录失败")
  const demoToken = demoLogin.json<{ accessToken: string }>().accessToken
  const denied = await app.inject({ method: "GET", url: "/admin-api/users", headers: { authorization: `Bearer ${demoToken}` } })
  assert(denied.statusCode === 403, "普通用户不应访问管理接口")

  const disabled = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/status`, headers, payload: { status: 0 } })
  assert(disabled.statusCode === 200 && disabled.json().status === 0, "禁用用户失败")
  const oldToken = await app.inject({ method: "GET", url: "/api/users/me", headers: { authorization: `Bearer ${demoToken}` } })
  assert(oldToken.statusCode === 401, "禁用后旧 JWT 应失效")
  const enabled = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/status`, headers, payload: { status: 1 } })
  assert(enabled.statusCode === 200 && enabled.json().status === 1, "启用用户失败")

  list = await app.inject({ method: "GET", url: "/admin-api/users?keyword=demo", headers })
  assert(list.statusCode === 200 && list.json().pagination.total === 1, "搜索新增用户失败")
  console.log("PASS: JWT 登录、权限隔离、用户列表/搜索、新增、启用/禁用和旧 JWT 失效")
} finally {
  await app.close()
}
