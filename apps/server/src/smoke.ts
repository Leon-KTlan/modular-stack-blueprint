import "dotenv/config"
import { randomBytes } from "node:crypto"
import { readAuditLogs } from "./audit.js"
import bcrypt from "bcryptjs"
import { and, eq, or } from "drizzle-orm"
import { database } from "./database.js"
import { hashPassword, verifyPassword } from "./password.js"
import { auditLogs, categories, circleMembers, circles, comments, miniappUserFollows, miniappUsers, postLikes, posts } from "./schema.js"

process.env.MINIAPP_JWT_SECRET ??= randomBytes(32).toString("hex")
const { app } = await import("./server.js")
const originalFetch = globalThis.fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

let smokeCircleId: bigint | null = null
let smokeMiniappUserId: bigint | null = null
let smokePostId: bigint | null = null
let smokeCommentId: bigint | null = null
let smokeOtherUserId: bigint | null = null
let smokeLoginUserId: bigint | null = null

function miniappHeaders(userId: bigint, tokenVersion = 0) {
  const token = app.jwt.sign({
    sub: userId.toString(),
    actorType: "MINIAPP_USER",
    tokenVersion,
    aud: "miniapp",
  }, { key: process.env.MINIAPP_JWT_SECRET!, expiresIn: "2h" })
  return { authorization: `Bearer ${token}` }
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

  const unauthorizedMiniappPosts = await app.inject({ method: "GET", url: "/api/miniapp/posts" })
  assert(unauthorizedMiniappPosts.statusCode === 401, "未登录小程序用户不应访问帖子接口")
  const activeCircle = await app.inject({ method: "POST", url: `/admin-api/circles/${smokeCircleId}/status`, headers, payload: { status: "active" } })
  assert(activeCircle.statusCode === 200, "帖子烟测需要启用圈子")
  const [smokeCategory] = await database.select({ id: categories.id }).from(categories).where(eq(categories.status, 1)).limit(1)
  assert(smokeCategory, "帖子烟测需要启用分类")
  const miniappAuth = miniappHeaders(smokeMiniappUserId)

  const createdPost = await app.inject({
    method: "POST",
    url: "/api/miniapp/posts",
    headers: miniappAuth,
    payload: { circleId: smokeCircleId.toString(), categoryId: smokeCategory.id.toString(), contentType: "TEXT", content: "帖子模块冒烟测试" },
  })
  assert(createdPost.statusCode === 201, `小程序创建帖子失败: ${createdPost.body}`)
  smokePostId = BigInt(createdPost.json<{ id: string }>().id)
  assert(createdPost.json().content === "帖子模块冒烟测试", "创建帖子响应内容错误")

  const postList = await app.inject({ method: "GET", url: "/api/miniapp/posts?page=1&pageSize=10", headers: miniappAuth })
  assert(postList.statusCode === 200 && postList.json().items.some((item: { id: string }) => item.id === smokePostId!.toString()), "小程序帖子列表应包含新帖子")
  const postDetail = await app.inject({ method: "GET", url: `/api/miniapp/posts/${smokePostId}`, headers: miniappAuth })
  assert(postDetail.statusCode === 200 && postDetail.json().likeCount === 0 && postDetail.json().viewCount === 1, "小程序帖子详情、初始点赞数或浏览量错误")
  const viewedAgain = await app.inject({ method: "GET", url: `/api/miniapp/posts/${smokePostId}`, headers: miniappAuth })
  assert(viewedAgain.json().viewCount === 2, "每次打开帖子详情应原子递增浏览量")

  const unsupportedMediaPost = await app.inject({
    method: "POST",
    url: "/api/miniapp/posts",
    headers: miniappAuth,
    payload: { circleId: smokeCircleId.toString(), categoryId: smokeCategory.id.toString(), contentType: "IMAGE_TEXT", content: "图片尚未配置" },
  })
  assert(unsupportedMediaPost.statusCode === 503 && unsupportedMediaPost.json().error.code === "MEDIA_STORAGE_NOT_CONFIGURED", "未配置对象存储时不应接受图文发帖")

  const like = await app.inject({ method: "PUT", url: `/api/miniapp/posts/${smokePostId}/likes/me`, headers: miniappAuth })
  assert(like.statusCode === 200 && like.json().liked && like.json().likeCount === 1, "点赞接口失败")
  const duplicateLike = await app.inject({ method: "PUT", url: `/api/miniapp/posts/${smokePostId}/likes/me`, headers: miniappAuth })
  assert(duplicateLike.json().likeCount === 1, "重复点赞必须幂等")

  const createdComment = await app.inject({ method: "POST", url: `/api/miniapp/posts/${smokePostId}/comments`, headers: miniappAuth, payload: { content: "帖子模块评论烟测" } })
  assert(createdComment.statusCode === 201, `小程序创建评论失败: ${createdComment.body}`)
  smokeCommentId = BigInt(createdComment.json<{ id: string }>().id)
  const commentList = await app.inject({ method: "GET", url: `/api/miniapp/posts/${smokePostId}/comments`, headers: miniappAuth })
  assert(commentList.statusCode === 200 && commentList.json().pagination.total === 1, "小程序评论列表失败")

  const adminPostList = await app.inject({ method: "GET", url: "/admin-api/posts?page=1&pageSize=10", headers })
  assert(adminPostList.statusCode === 200 && adminPostList.json().items.some((item: { id: string }) => item.id === smokePostId!.toString()), "后台帖子列表失败")
  const adminCommentList = await app.inject({ method: "GET", url: `/admin-api/comments?postId=${smokePostId}`, headers })
  assert(adminCommentList.statusCode === 200 && adminCommentList.json().pagination.total === 1, "后台评论列表失败")

  const hiddenPost = await app.inject({ method: "POST", url: `/admin-api/posts/${smokePostId}/status`, headers, payload: { status: "hidden", reason: "帖子状态烟测" } })
  assert(hiddenPost.statusCode === 200 && hiddenPost.json().status === "hidden", "后台隐藏帖子失败")
  const hiddenPostDetail = await app.inject({ method: "GET", url: `/api/miniapp/posts/${smokePostId}`, headers: miniappAuth })
  assert(hiddenPostDetail.statusCode === 404, "已隐藏帖子不应对小程序可见")
  const restoredPost = await app.inject({ method: "POST", url: `/admin-api/posts/${smokePostId}/status`, headers, payload: { status: "published", reason: "恢复帖子烟测" } })
  assert(restoredPost.statusCode === 200 && restoredPost.json().status === "published", "后台恢复帖子失败")

  const hiddenComment = await app.inject({ method: "POST", url: `/admin-api/comments/${smokeCommentId}/status`, headers, payload: { status: "hidden", reason: "评论状态烟测" } })
  assert(hiddenComment.statusCode === 200 && hiddenComment.json().status === "hidden", "后台隐藏评论失败")
  const hiddenCommentList = await app.inject({ method: "GET", url: `/api/miniapp/posts/${smokePostId}/comments`, headers: miniappAuth })
  assert(hiddenCommentList.json().pagination.total === 0, "已隐藏评论不应对小程序可见")
  const restoredComment = await app.inject({ method: "POST", url: `/admin-api/comments/${smokeCommentId}/status`, headers, payload: { status: "published", reason: "恢复评论烟测" } })
  assert(restoredComment.statusCode === 200 && restoredComment.json().status === "published", "后台恢复评论失败")

  const [otherUser] = await database.insert(miniappUsers).values({ wx_openid: `smoke_other_${Date.now()}`, nickname: "其他烟测用户" }).returning({ id: miniappUsers.id })
  assert(otherUser, "创建帖子归属校验用户失败")
  smokeOtherUserId = otherUser.id
  const otherMiniappAuth = miniappHeaders(smokeOtherUserId)

  const updatedProfile = await app.inject({
    method: "PUT",
    url: "/api/miniapp/users/me",
    headers: miniappAuth,
    payload: { nickname: "校园玩家", bio: "在校园里，和有趣的人做有趣的事。", gender: "male" },
  })
  assert(updatedProfile.statusCode === 200 && updatedProfile.json().nickname === "校园玩家", `更新小程序资料失败: ${updatedProfile.body}`)
  assert(updatedProfile.json().bio === "在校园里，和有趣的人做有趣的事。", `个人简介没有保存: ${updatedProfile.body}`)
  assert(updatedProfile.json().gender === "male" && updatedProfile.json().nicknameChange.remaining === 2, "性别或昵称修改额度没有正确保存")
  assert(updatedProfile.json().stats.receivedLikeCount === 1, "获赞数应从有效帖子点赞动态聚合")
  const invalidProfile = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "   " } })
  assert(invalidProfile.statusCode === 400, "空昵称应该返回 400")
  const invalidNicknameCharacter = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "校园@玩家" } })
  assert(invalidNicknameCharacter.statusCode === 400, "昵称不应接受白名单外字符")
  const invalidNicknameLength = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "二十一字昵称长度限制测试一二三四五六七八九十" } })
  assert(invalidNicknameLength.statusCode === 400, "超长昵称应该返回 400")
  const sqlLookingBio = "想去玩'; DROP TABLE miniapp_users; --"
  const safeBio = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { bio: sqlLookingBio } })
  assert(safeBio.statusCode === 200 && safeBio.json().bio === sqlLookingBio, "简介应作为参数化数据安全保存")
  assert(await database.select({ id: miniappUsers.id }).from(miniappUsers).where(eq(miniappUsers.id, smokeMiniappUserId)).limit(1), "SQL 风格文本不应影响数据表")
  const secondNicknameChange = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "校园玩家二" } })
  const thirdNicknameChange = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "校园玩家三" } })
  const limitedNicknameChange = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { nickname: "校园玩家四" } })
  assert(secondNicknameChange.statusCode === 200 && thirdNicknameChange.statusCode === 200, "30 天内前三次昵称修改应成功")
  assert(limitedNicknameChange.statusCode === 429 && limitedNicknameChange.json().error.code === "NICKNAME_CHANGE_LIMIT", "30 天内第四次昵称修改应被限流")
  const selfFollow = await app.inject({ method: "PUT", url: `/api/miniapp/users/${smokeOtherUserId}/follow`, headers: otherMiniappAuth })
  assert(selfFollow.statusCode === 400 && selfFollow.json().error.code === "SELF_FOLLOW", "用户不能关注自己")
  const follow = await app.inject({ method: "PUT", url: `/api/miniapp/users/${smokeMiniappUserId}/follow`, headers: otherMiniappAuth })
  assert(follow.statusCode === 200 && follow.json().following && follow.json().followerCount === 1, "关注用户失败")
  const duplicateFollow = await app.inject({ method: "PUT", url: `/api/miniapp/users/${smokeMiniappUserId}/follow`, headers: otherMiniappAuth })
  assert(duplicateFollow.statusCode === 200 && duplicateFollow.json().followerCount === 1, "重复关注必须幂等")
  const publicProfile = await app.inject({ method: "GET", url: `/api/miniapp/users/${smokeMiniappUserId}`, headers: otherMiniappAuth })
  assert(publicProfile.statusCode === 200 && publicProfile.json().isFollowing && !publicProfile.json().isSelf && publicProfile.json().gender === "male", "公开主页应返回关注关系和公开性别")
  const privateGender = await app.inject({ method: "PUT", url: "/api/miniapp/users/me", headers: miniappAuth, payload: { gender: "private" } })
  assert(privateGender.statusCode === 200 && privateGender.json().gender === "private", "用户本人应看到保密性别设置")
  const publicProfileWithPrivateGender = await app.inject({ method: "GET", url: `/api/miniapp/users/${smokeMiniappUserId}`, headers: otherMiniappAuth })
  assert(publicProfileWithPrivateGender.json().gender === null, "保密性别不应在公开主页显示")
  const followerList = await app.inject({ method: "GET", url: `/api/miniapp/users/${smokeMiniappUserId}/followers`, headers: miniappAuth })
  assert(followerList.statusCode === 200 && followerList.json().pagination.total === 1, "粉丝列表失败")
  const followingList = await app.inject({ method: "GET", url: `/api/miniapp/users/${smokeOtherUserId}/following`, headers: otherMiniappAuth })
  assert(followingList.statusCode === 200 && followingList.json().items[0].id === smokeMiniappUserId.toString(), "关注列表失败")
  const invalidFollowPageSize = await app.inject({ method: "GET", url: `/api/miniapp/users/${smokeMiniappUserId}/followers?pageSize=20`, headers: miniappAuth })
  assert(invalidFollowPageSize.statusCode === 400, "关注列表每页必须固定为 10 条")
  const unfollow = await app.inject({ method: "DELETE", url: `/api/miniapp/users/${smokeMiniappUserId}/follow`, headers: otherMiniappAuth })
  assert(unfollow.statusCode === 200 && !unfollow.json().following && unfollow.json().followerCount === 0, "取消关注失败")
  const duplicateUnfollow = await app.inject({ method: "DELETE", url: `/api/miniapp/users/${smokeMiniappUserId}/follow`, headers: otherMiniappAuth })
  assert(duplicateUnfollow.statusCode === 200 && duplicateUnfollow.json().followerCount === 0, "重复取消关注必须幂等")

  const forbiddenDelete = await app.inject({ method: "DELETE", url: `/api/miniapp/posts/${smokePostId}`, headers: miniappHeaders(smokeOtherUserId) })
  assert(forbiddenDelete.statusCode === 403, "用户不应删除他人的帖子")

  const unlike = await app.inject({ method: "DELETE", url: `/api/miniapp/posts/${smokePostId}/likes/me`, headers: miniappAuth })
  assert(unlike.statusCode === 200 && unlike.json().likeCount === 0, "取消点赞失败")
  const deletedComment = await app.inject({ method: "DELETE", url: `/api/miniapp/comments/${smokeCommentId}`, headers: miniappAuth })
  assert(deletedComment.statusCode === 204, "作者软删除自己的评论失败")
  const deletedCommentList = await app.inject({ method: "GET", url: "/admin-api/comments?status=deleted", headers })
  assert(deletedCommentList.statusCode === 200 && deletedCommentList.json().items.some((item: { id: string }) => item.id === smokeCommentId!.toString()), "后台删除评论筛选失败")

  const deletedPost = await app.inject({ method: "DELETE", url: `/admin-api/posts/${smokePostId}`, headers, payload: { reason: "帖子删除烟测" } })
  assert(deletedPost.statusCode === 204, `后台软删除帖子失败: ${deletedPost.body}`)
  const repeatedPostDelete = await app.inject({ method: "DELETE", url: `/admin-api/posts/${smokePostId}`, headers, payload: { reason: "重复删除烟测" } })
  assert(repeatedPostDelete.statusCode === 204, "重复删除帖子应幂等成功")
  const deletedPostList = await app.inject({ method: "GET", url: "/admin-api/posts?status=deleted", headers })
  assert(deletedPostList.statusCode === 200 && deletedPostList.json().items.some((item: { id: string }) => item.id === smokePostId!.toString()), "后台删除帖子筛选失败")
  const deletedPostDetail = await app.inject({ method: "GET", url: `/admin-api/posts/${smokePostId}`, headers })
  assert(deletedPostDetail.statusCode === 200 && deletedPostDetail.json().deletedAt, "后台详情应可查看软删除帖子")
  const contentAudits = (await readAuditLogs()).filter((entry) => (entry.resourceType === "post" && entry.resourceId === smokePostId) || (entry.resourceType === "comment" && entry.resourceId === smokeCommentId))
  assert(contentAudits.filter((entry) => entry.action === "post.delete").length === 1, "帖子重复删除不应重复写审计")
  assert(contentAudits.filter((entry) => entry.action === "post.status.update").length === 2, "帖子状态变更审计缺失")
  assert(contentAudits.filter((entry) => entry.action === "comment.status.update").length === 2, "评论状态变更审计缺失")
  const disabledAfterContentTests = await app.inject({ method: "POST", url: `/admin-api/circles/${smokeCircleId}/status`, headers, payload: { status: "disabled" } })
  assert(disabledAfterContentTests.statusCode === 200, "恢复圈子烟测状态失败")

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
  // No real WeChat network calls: test login through the HTTP route with a mocked code2Session.
  process.env.WECHAT_MINIAPP_APP_ID = "smoke-miniapp-id"
  process.env.WECHAT_MINIAPP_APP_SECRET = "smoke-miniapp-secret"
  const wechatCode = `smoke_${randomBytes(12).toString("hex")}`
  const loginIdentity = `smoke_login_${randomBytes(12).toString("hex")}`
  let wechatPayload: Record<string, unknown> = { openid: loginIdentity, session_key: "smoke-session-key" }
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input))
    assert(url.hostname === "api.weixin.qq.com" && url.searchParams.get("js_code") === wechatCode, "微信登录必须仅调用 code2Session")
    return new Response(JSON.stringify(wechatPayload), { status: 200 })
  }) as typeof fetch
  const loginRequest = () => app.inject({ method: "POST", url: "/api/miniapp/auth/login", payload: { code: wechatCode } })
  const [firstLogin, concurrentLogin] = await Promise.all([loginRequest(), loginRequest()])
  assert(firstLogin.statusCode === 200 && concurrentLogin.statusCode === 200, "首次并发登录必须幂等成功")
  const firstBody = firstLogin.json<{ accessToken: string; expiresIn: number; user: { id: string } }>()
  assert(firstBody.user.id === concurrentLogin.json().user.id && firstBody.expiresIn === 7200, "微信用户不能重复创建")
  assert(!firstLogin.body.includes("openid") && !firstLogin.body.includes("session_key"), "登录响应不能泄漏微信标识和会话密钥")
  const loginUserId = BigInt(firstBody.user.id)
  smokeLoginUserId = loginUserId
  const miniappMe = await app.inject({ method: "GET", url: "/api/miniapp/users/me", headers: { authorization: `Bearer ${firstBody.accessToken}` } })
  assert(miniappMe.statusCode === 200 && miniappMe.json().id === firstBody.user.id, "小程序令牌必须访问当前用户")
  const adminMe = await app.inject({ method: "GET", url: "/api/miniapp/users/me", headers })
  assert(adminMe.statusCode === 401, "管理端令牌不能访问小程序用户")
  wechatPayload = { openid: loginIdentity, unionid: `union_${wechatCode}`, session_key: "new-key" }
  assert((await loginRequest()).statusCode === 200, "再次登录必须复用同一用户")
  const [afterUnionid] = await database.select().from(miniappUsers).where(eq(miniappUsers.id, loginUserId))
  assert(afterUnionid?.wx_unionid === `union_${wechatCode}`, "后续登录应补全 unionid")
  wechatPayload = { errcode: 40029, errmsg: "invalid code" }
  assert((await loginRequest()).statusCode === 401, "无效 code 不允许登录")
  wechatPayload = { errcode: 45011, errmsg: "rate limited" }
  assert((await loginRequest()).statusCode === 429, "微信限流应转为 429")
  wechatPayload = { errcode: -1, errmsg: "system error" }
  assert((await loginRequest()).statusCode === 502, "微信服务异常应转为 502")
  wechatPayload = { openid: loginIdentity, session_key: "new-key" }
  await database.update(miniappUsers).set({ status: 0, token_version: 1, updated_at: new Date().toISOString() }).where(eq(miniappUsers.id, loginUserId))
  assert((await loginRequest()).statusCode === 403, "禁用用户不能重新登录")
  assert((await app.inject({ method: "GET", url: "/api/miniapp/users/me", headers: { authorization: `Bearer ${firstBody.accessToken}` } })).statusCode === 401, "禁用后旧 token 必须失效")
  console.log("PASS: 用户资料与关注、圈子管理、帖子/媒体关联、点赞、评论治理、审计、权限隔离和密码安全")
} finally {
  globalThis.fetch = originalFetch
  if (smokePostId) {
    await database.delete(auditLogs).where(and(eq(auditLogs.resourceType, "post"), eq(auditLogs.resourceId, smokePostId)))
    await database.delete(postLikes).where(eq(postLikes.post_id, smokePostId))
    await database.delete(comments).where(eq(comments.post_id, smokePostId))
    await database.delete(posts).where(eq(posts.id, smokePostId))
  }
  if (smokeCommentId) await database.delete(auditLogs).where(and(eq(auditLogs.resourceType, "comment"), eq(auditLogs.resourceId, smokeCommentId)))
  if (smokeCircleId) {
    await database.delete(auditLogs).where(and(eq(auditLogs.resourceType, "circle"), eq(auditLogs.resourceId, smokeCircleId)))
    await database.delete(circleMembers).where(eq(circleMembers.circle_id, smokeCircleId))
    await database.delete(circles).where(eq(circles.id, smokeCircleId))
  }
  const smokeMiniappUserIds = [smokeMiniappUserId, smokeOtherUserId, smokeLoginUserId].filter((id): id is bigint => id !== null)
  for (const userId of smokeMiniappUserIds) {
    await database.delete(miniappUserFollows).where(or(
      eq(miniappUserFollows.follower_user_id, userId),
      eq(miniappUserFollows.following_user_id, userId),
    ))
  }
  if (smokeMiniappUserId) await database.delete(miniappUsers).where(eq(miniappUsers.id, smokeMiniappUserId))
  if (smokeOtherUserId) await database.delete(miniappUsers).where(eq(miniappUsers.id, smokeOtherUserId))
  if (smokeLoginUserId) await database.delete(miniappUsers).where(eq(miniappUsers.id, smokeLoginUserId))
  await app.close()
}
