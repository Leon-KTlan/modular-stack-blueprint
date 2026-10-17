import { app } from "./server.js"
import { readAuditLogs } from "./audit.js"
import bcrypt from "bcryptjs"
import { and, eq } from "drizzle-orm"
import { database } from "./database.js"
import { hashPassword, verifyPassword } from "./password.js"
import { auditLogs, circleMembers, circles, miniappUsers } from "./schema.js"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

let smokeCircleId: bigint | null = null
let smokeMiniappUserId: bigint | null = null

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
  assert(audit?.operatorId === adminId && audit.resourceId === BigInt(demo.id), "密码重置审计日志缺失")
  assert(!JSON.stringify(audit, (_key, value) => typeof value === "bigint" ? value.toString() : value).includes("Demo67890!"), "审计日志不应包含密码")

  const unauthorizedCategories = await app.inject({ method: "GET", url: "/admin-api/categories" })
  assert(unauthorizedCategories.statusCode === 401, "未登录用户不应访问分类管理接口")
  const categoryList = await app.inject({ method: "GET", url: "/admin-api/categories", headers })
  assert(categoryList.statusCode === 200 && categoryList.json().pagination.pageSize === 10, "分类列表默认每页应为 10 条")
  const selectableCategories = await app.inject({ method: "GET", url: "/api/miniapp/categories" })
  assert(selectableCategories.statusCode === 200 && selectableCategories.json().items.length >= 1, "小程序应能读取启用分类")

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

  const unauthorizedCircles = await app.inject({ method: "GET", url: "/admin-api/circles" })
  assert(unauthorizedCircles.statusCode === 401, "未登录用户不应访问圈子管理接口")
  const invalidCirclePageSize = await app.inject({ method: "GET", url: "/admin-api/circles?pageSize=20", headers })
  assert(invalidCirclePageSize.statusCode === 400, "圈子分页每页必须固定为 10 条")
  const invalidCirclePayload = await app.inject({ method: "POST", url: "/admin-api/circles", headers, payload: { name: "非法圈子", description: 123 } })
  assert(invalidCirclePayload.statusCode === 400, "圈子文本字段类型错误应该返回 400")
  const invalidCircleDelete = await app.inject({ method: "DELETE", url: "/admin-api/circles/not-an-id", headers })
  assert(invalidCircleDelete.statusCode === 400, "删除圈子时非法 ID 应该返回 400")
  const missingCircleDelete = await app.inject({ method: "DELETE", url: "/admin-api/circles/9223372036854775807", headers })
  assert(missingCircleDelete.statusCode === 404, "删除不存在的圈子应该返回 404")

  const circleName = `冒烟圈子${Date.now()}`
  const createdCircle = await app.inject({
    method: "POST",
    url: "/admin-api/circles",
    headers,
    payload: { name: circleName, description: "圈子接口冒烟测试" },
  })
  assert(createdCircle.statusCode === 201, `创建圈子失败: ${createdCircle.body}`)
  smokeCircleId = BigInt(createdCircle.json<{ id: string }>().id)

  const unauthorizedCircleDelete = await app.inject({ method: "DELETE", url: `/admin-api/circles/${smokeCircleId}` })
  assert(unauthorizedCircleDelete.statusCode === 401, "未登录用户不应删除圈子")

  const circleList = await app.inject({ method: "GET", url: `/admin-api/circles?page=1&keyword=${encodeURIComponent(circleName)}`, headers })
  assert(circleList.statusCode === 200, `圈子分页失败: ${circleList.body}`)
  assert(circleList.json().pagination.pageSize === 10 && circleList.json().pagination.total === 1, "圈子分页元数据不正确")
  assert(circleList.json().items[0].memberCount === 0, "无成员圈子的成员数应该为 0")

  const updatedCircle = await app.inject({
    method: "PATCH",
    url: `/admin-api/circles/${smokeCircleId}`,
    headers,
    payload: { description: "更新后的冒烟测试简介" },
  })
  assert(updatedCircle.statusCode === 200 && updatedCircle.json().description === "更新后的冒烟测试简介", "更新圈子失败")

  const disabledCircle = await app.inject({ method: "POST", url: `/admin-api/circles/${smokeCircleId}/status`, headers, payload: { status: "disabled" } })
  assert(disabledCircle.statusCode === 200 && disabledCircle.json().status === "disabled", "禁用圈子失败")

  const [smokeMiniappUser] = await database.insert(miniappUsers).values({
    wx_openid: `smoke_${Date.now()}`,
    nickname: "圈子烟测用户",
  }).returning({ id: miniappUsers.id })
  assert(smokeMiniappUser, "创建圈子烟测用户失败")
  smokeMiniappUserId = smokeMiniappUser.id
  await database.insert(circleMembers).values({ circle_id: smokeCircleId, user_id: smokeMiniappUserId })

  const members = await app.inject({ method: "GET", url: `/admin-api/circles/${smokeCircleId}/members`, headers })
  assert(members.statusCode === 200 && members.json().pagination.total === 1, "圈子成员分页失败")
  const circleWithMember = await app.inject({ method: "GET", url: `/admin-api/circles/${smokeCircleId}`, headers })
  assert(circleWithMember.json().memberCount === 1, "圈子详情成员数应按有效成员关系聚合")

  const userDetail = await app.inject({ method: "GET", url: `/admin-api/miniapp-users/${smokeMiniappUserId}`, headers })
  assert(userDetail.statusCode === 200, `小程序用户详情失败: ${userDetail.body}`)
  assert(userDetail.json().circleMemberships.length === 1, "用户详情应展示当前加入的圈子")
  assert(userDetail.json().circleMemberships[0].circleStatus === "disabled", "禁用圈子仍应展示在已加入圈子中")

  await database.update(circleMembers).set({ status: 0 }).where(and(
    eq(circleMembers.circle_id, smokeCircleId),
    eq(circleMembers.user_id, smokeMiniappUserId),
  ))
  const detailAfterLeaving = await app.inject({ method: "GET", url: `/admin-api/miniapp-users/${smokeMiniappUserId}`, headers })
  assert(detailAfterLeaving.json().circleMemberships.length === 0, "用户详情不应展示已退出的圈子")
  await database.update(circleMembers).set({ status: 1 }).where(and(
    eq(circleMembers.circle_id, smokeCircleId),
    eq(circleMembers.user_id, smokeMiniappUserId),
  ))

  const deletedCircle = await app.inject({ method: "DELETE", url: `/admin-api/circles/${smokeCircleId}`, headers })
  assert(deletedCircle.statusCode === 204, `删除圈子失败: ${deletedCircle.body}`)
  const repeatedDelete = await app.inject({ method: "DELETE", url: `/admin-api/circles/${smokeCircleId}`, headers })
  assert(repeatedDelete.statusCode === 204, "重复删除圈子应幂等返回 204")

  const deletedCircleList = await app.inject({ method: "GET", url: `/admin-api/circles?page=1&keyword=${encodeURIComponent(circleName)}`, headers })
  assert(deletedCircleList.json().pagination.total === 0, "已删除圈子不应出现在列表中")
  const deletedCircleDetail = await app.inject({ method: "GET", url: `/admin-api/circles/${smokeCircleId}`, headers })
  assert(deletedCircleDetail.statusCode === 404, "已删除圈子详情应返回 404")
  const deletedCircleMembers = await app.inject({ method: "GET", url: `/admin-api/circles/${smokeCircleId}/members`, headers })
  assert(deletedCircleMembers.statusCode === 404, "已删除圈子的成员列表应返回 404")
  const userDetailAfterDelete = await app.inject({ method: "GET", url: `/admin-api/miniapp-users/${smokeMiniappUserId}`, headers })
  assert(userDetailAfterDelete.json().circleMemberships.length === 0, "用户详情不应展示已删除圈子")

  const circleAudits = (await readAuditLogs()).filter((entry) => entry.resourceType === "circle" && entry.resourceId === smokeCircleId)
  assert(circleAudits.length > 0, "圈子管理操作缺少审计记录")
  assert(circleAudits.filter((entry) => entry.action === "circle.delete").length === 1, "圈子重复删除不应重复写入审计")
  console.log("PASS: 用户管理、小程序用户圈子详情、圈子分页维护与软删除、审计、权限隔离和密码安全")
} finally {
  if (smokeCircleId) {
    await database.delete(auditLogs).where(and(eq(auditLogs.resourceType, "circle"), eq(auditLogs.resourceId, smokeCircleId)))
    await database.delete(circleMembers).where(eq(circleMembers.circle_id, smokeCircleId))
    await database.delete(circles).where(eq(circles.id, smokeCircleId))
  }
  if (smokeMiniappUserId) await database.delete(miniappUsers).where(eq(miniappUsers.id, smokeMiniappUserId))
  await app.close()
}
