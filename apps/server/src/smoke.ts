import { app } from "./server.js"
import { readAuditLogs } from "./audit.js"
import bcrypt from "bcryptjs"
import { hashPassword, verifyPassword } from "./password.js"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

try {
  const argonHash = await hashPassword("SmokePassword123!")
  assert(argonHash.startsWith("$argon2id$"), "新密码必须使用 Argon2id")
  assert((await verifyPassword("SmokePassword123!", argonHash)).valid, "Argon2id 密码验证失败")
  const legacyHash = await bcrypt.hash("LegacyPassword123!", 4)
  const legacyVerification = await verifyPassword("LegacyPassword123!", legacyHash)
  assert(legacyVerification.valid && legacyVerification.upgradedHash?.startsWith("$argon2id$"), "bcrypt 旧哈希应在验证后升级")

  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "Admin123!" } })
  assert(login.statusCode === 200, `管理员登录失败: ${login.body}`)
  const loginBody = login.json<{ accessToken: string; user: { id: number } }>()
  const token = loginBody.accessToken
  const adminId = loginBody.user.id
  const headers = { authorization: `Bearer ${token}` }

  const unauthorized = await app.inject({ method: "GET", url: "/admin-api/users" })
  assert(unauthorized.statusCode === 401, "未登录用户不应访问管理接口")

  let list = await app.inject({ method: "GET", url: "/admin-api/users?page=1", headers })
  assert(list.statusCode === 200 && list.json().pagination.total >= 3, "种子用户查询失败")
  assert(list.json().pagination.pageSize === 10 && list.json().items.length <= 10, "用户列表必须固定每页 10 条")

  const invalidPage = await app.inject({ method: "GET", url: "/admin-api/users?page=0", headers })
  assert(invalidPage.statusCode === 400, "非法页码应该返回 400")

  let demo = list.json().items.find((user: { username: string }) => user.username === "demo")
  if (!demo) {
    const created = await app.inject({ method: "POST", url: "/admin-api/users", headers,
      payload: { username: "demo", password: "Demo12345!", email: "demo@example.com", gender: 0, role: 0 },
    })
    assert(created.statusCode === 201, `新增用户失败: ${created.body}`)
    demo = created.json()
  }

  const setupReset = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/password-reset`, headers,
    payload: { password: "Demo12345!", reason: "smoke test setup" },
  })
  assert(setupReset.statusCode === 204, `初始化演示用户密码失败: ${setupReset.body}`)

  const demoLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "demo", password: "Demo12345!" } })
  assert(demoLogin.statusCode === 200, "普通用户登录失败")
  const demoToken = demoLogin.json<{ accessToken: string }>().accessToken
  const denied = await app.inject({ method: "GET", url: "/admin-api/users", headers: { authorization: `Bearer ${demoToken}` } })
  assert(denied.statusCode === 403, "普通用户不应访问管理接口")

  const deniedReset = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/password-reset`,
    headers: { authorization: `Bearer ${demoToken}` },
    payload: { password: "Demo67890!", reason: "普通用户不应有重置权限" },
  })
  assert(deniedReset.statusCode === 403, "普通用户不应重置密码")

  const reset = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/password-reset`, headers,
    payload: { password: "Demo67890!", reason: "smoke test password reset" },
  })
  assert(reset.statusCode === 204, `管理员重置密码失败: ${reset.body}`)
  const tokenAfterReset = await app.inject({ method: "GET", url: "/api/users/me", headers: { authorization: `Bearer ${demoToken}` } })
  assert(tokenAfterReset.statusCode === 401, "密码重置后旧 JWT 应失效")
  const oldPassword = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "demo", password: "Demo12345!" } })
  assert(oldPassword.statusCode === 401, "密码重置后旧密码不应继续登录")
  const newPassword = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "demo", password: "Demo67890!" } })
  assert(newPassword.statusCode === 200, "密码重置后新密码应可登录")
  const audit = (await readAuditLogs()).slice().reverse().find((entry) => entry.reason === "smoke test password reset")
  assert(audit?.operatorId === adminId && audit.resourceId === demo.id, "密码重置审计日志缺失")
  assert(!JSON.stringify(audit).includes("Demo67890!"), "审计日志不应包含密码")

  const restorePassword = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/password-reset`, headers,
    payload: { password: "Demo12345!", reason: "smoke test cleanup" },
  })
  assert(restorePassword.statusCode === 204, "恢复演示用户密码失败")
  const restoredLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "demo", password: "Demo12345!" } })
  assert(restoredLogin.statusCode === 200, "恢复后的演示用户无法登录")
  const restoredToken = restoredLogin.json<{ accessToken: string }>().accessToken

  const disabled = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/status`, headers, payload: { status: 0 } })
  assert(disabled.statusCode === 200 && disabled.json().status === 0, "禁用用户失败")
  const oldToken = await app.inject({ method: "GET", url: "/api/users/me", headers: { authorization: `Bearer ${restoredToken}` } })
  assert(oldToken.statusCode === 401, "禁用后旧 JWT 应失效")
  const enabled = await app.inject({ method: "POST", url: `/admin-api/users/${demo.id}/status`, headers, payload: { status: 1 } })
  assert(enabled.statusCode === 200 && enabled.json().status === 1, "启用用户失败")

  list = await app.inject({ method: "GET", url: "/admin-api/users?username=demo", headers })
  assert(list.statusCode === 200 && list.json().pagination.total >= 1, "按用户名搜索新增用户失败")
  assert(list.json().items.every((user: { username: string }) => user.username.includes("demo")), "用户名搜索返回了无关用户")
  console.log("PASS: PostgreSQL 用户分页、用户名检索、Argon2id 登录、密码重置审计、权限隔离和旧 JWT 失效")
} finally {
  await app.close()
}
