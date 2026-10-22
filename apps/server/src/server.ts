import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify"
import fastifyJwt from "@fastify/jwt"
import "dotenv/config"
import { closeDatabase } from "./database.js"
import { createCircle, findCircleById, listCircleMembers, listCircles, softDeleteCircle, updateCircle, updateCircleStatus } from "./circles.js"
import {
  createUser,
  findMiniappUserById,
  findUserById,
  findUserByUsername,
  listMiniappUsers,
  loginMiniappUser,
  listActiveCircleMembershipsForUser,
  listUsers,
  markLogin,
  resetUserPassword,
  USER_PAGE_SIZE,
  upgradePasswordHash,
  updateProfile,
  updateMiniappUserStatus,
  updateUserStatus,
  type UserRow,
} from "./db.js"
import { hashPassword, verifyPassword } from "./password.js"
import { exchangeWechatCode, WechatLoginError } from "./wechat-login.js"
import {
  addPostLike,
  countPostLikes,
  createComment,
  createTextPost,
  findComment,
  findPost,
  listComments,
  listPosts,
  removePostLike,
  softDeleteComment,
  softDeletePost,
  updateCommentStatus,
  updatePostStatus,
  type AdminContentStatus,
} from "./posts.js"
import {
  categoryPageSizeMax,
  createCategory,
  listCategories,
  listSelectableCategories,
  softDeleteCategory,
  toCategoryView,
  updateCategory,
  updateCategoryStatus,
  type CategoryStatus,
} from "./categories.js"
import {
  toAdminMiniappUserDetailView,
  toAdminMiniappUserListItemView,
  toAdminCircleView,
  toUserView,
  toMiniappUserView,
  type CircleMemberStatus,
  type CircleStatus,
  type ContentType,
  type MiniappUserStatus,
  type UserGender,
  type UserRole,
} from "./types.js"

const app = Fastify({ logger: true })
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith("replace-")) throw new Error("JWT_SECRET must be set to at least 32 characters")
const miniappJwtSecret = process.env.MINIAPP_JWT_SECRET
if (miniappJwtSecret && (miniappJwtSecret.length < 32 || miniappJwtSecret.startsWith("replace-") || miniappJwtSecret === jwtSecret)) {
  throw new Error("MINIAPP_JWT_SECRET must be a separate secret of at least 32 characters")
}

await app.register(fastifyJwt, {
  secret: jwtSecret,
})

interface JwtPayload {
  userId: number
  tokenVersion: number
}

interface MiniappJwtPayload {
  sub: string
  actorType: "MINIAPP_USER"
  tokenVersion: number
  aud: "miniapp"
}

type AuthenticatedRequest = FastifyRequest & { user: JwtPayload }

function parseGender(value: unknown): UserGender {
  const gender = Number(value)
  if (![0, 1, 2].includes(gender)) throw new Error("INVALID_GENDER")
  return gender as UserGender
}

function normalizeNullable(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  return String(value).trim()
}

function normalizeEmail(value: unknown): string | null {
  return normalizeNullable(value)?.toLowerCase() ?? null
}

function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "23505"
}

function parseBigintId(value: string): bigint | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  const id = BigInt(value)
  return id <= 9_223_372_036_854_775_807n ? id : null
}

const CIRCLE_PAGE_SIZE = 10

function parseCirclePagination(pageValue: string | undefined, pageSizeValue: string | undefined): { page: number; pageSize: number } | null {
  const page = Number(pageValue ?? 1)
  const pageSize = Number(pageSizeValue ?? CIRCLE_PAGE_SIZE)
  if (!Number.isSafeInteger(page) || page < 1 || pageSize !== CIRCLE_PAGE_SIZE) return null
  return { page, pageSize: CIRCLE_PAGE_SIZE }
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string"
}

function normalizeCircleText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null
  return value.trim() || null
}

function parseCategoryFields(input: { name?: unknown; code?: unknown; sortOrder?: unknown }, partial = false): {
  name?: string
  code?: string
  sortOrder?: number
} | null {
  const output: { name?: string; code?: string; sortOrder?: number } = {}
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== "string") return null
    const name = input.name.trim()
    if (!name || name.length > 50) return null
    output.name = name
  }
  if (!partial || input.code !== undefined) {
    if (typeof input.code !== "string") return null
    const code = input.code.trim()
    if (code.length > 50 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) return null
    output.code = code
  }
  if (!partial || input.sortOrder !== undefined) {
    if (input.sortOrder === undefined && !partial) {
      output.sortOrder = 0
    } else {
      if (!Number.isSafeInteger(input.sortOrder) || Number(input.sortOrder) < 0 || Number(input.sortOrder) > 1000000) return null
      output.sortOrder = Number(input.sortOrder)
    }
  }
  if (partial && Object.keys(output).length === 0) return null
  return output
}

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<UserRow | null> {
  try {
    await request.jwtVerify()
    const authRequest = request as AuthenticatedRequest
    const currentUser = await findUserById(authRequest.user.userId)
    if (!currentUser || currentUser.status !== 1 || currentUser.token_version !== authRequest.user.tokenVersion) {
      await reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "登录已失效" } })
      return null
    }
    return currentUser
  } catch {
    await reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录" } })
    return null
  }
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<UserRow | null> {
  const user = await authenticate(request, reply)
  if (!user) return null
  if (user.role !== 1) {
    await reply.code(403).send({ error: { code: "FORBIDDEN", message: "需要管理员权限" } })
    return null
  }
  return user
}

async function requireMiniappUser(request: FastifyRequest, reply: FastifyReply) {
  if (!miniappJwtSecret) {
    await reply.code(503).send({ error: { code: "MINIAPP_AUTH_NOT_CONFIGURED", message: "小程序认证尚未配置" } })
    return null
  }
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.authorization ?? "")
  if (!match) {
    await reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录" } })
    return null
  }
  try {
    const payload = app.jwt.verify<MiniappJwtPayload>(match[1]!, { key: miniappJwtSecret })
    const id = parseBigintId(payload.sub)
    if (payload.actorType !== "MINIAPP_USER" || payload.aud !== "miniapp" || !id || !Number.isSafeInteger(payload.tokenVersion)) throw new Error("invalid miniapp token")
    const user = await findMiniappUserById(id)
    if (!user || user.status !== 1 || user.token_version !== payload.tokenVersion) throw new Error("inactive miniapp token")
    return user
  } catch {
    await reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "登录已失效" } })
    return null
  }
}

function parsePageParams(pageValue: string | undefined, pageSizeValue: string | undefined) {
  const page = Number(pageValue ?? 1)
  const pageSize = Number(pageSizeValue ?? 10)
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) return null
  return { page, pageSize }
}

function parseContentStatus(value: string | undefined): AdminContentStatus | undefined | null {
  if (value === undefined || value === "") return undefined
  return value === "published" || value === "hidden" || value === "deleted" ? value : null
}

function parseContentType(value: string | undefined): ContentType | undefined | null {
  if (value === undefined || value === "") return undefined
  return value === "TEXT" || value === "IMAGE_TEXT" || value === "VIDEO" ? value : null
}

const MINIAPP_TOKEN_EXPIRES_IN = 7200

app.post<{ Body: { code?: unknown } }>("/api/miniapp/auth/login", async (request, reply) => {
  const code = request.body?.code
  if (typeof code !== "string" || code.length < 1 || code.length > 512 || /\s|[\x00-\x1f\x7f]/.test(code)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "微信登录 code 不合法" } })
  }
  const appId = process.env.WECHAT_MINIAPP_APP_ID
  const appSecret = process.env.WECHAT_MINIAPP_APP_SECRET
  if (!miniappJwtSecret || !appId || !appSecret || appId.startsWith("replace-") || appSecret.startsWith("replace-")) {
    return reply.code(503).send({ error: { code: "MINIAPP_AUTH_NOT_CONFIGURED", message: "小程序登录尚未配置" } })
  }
  try {
    const identity = await exchangeWechatCode(code, { appId, appSecret })
    const user = await loginMiniappUser(identity.openid, identity.unionid)
    if (user.status !== 1) return reply.code(403).send({ error: { code: "MINIAPP_USER_DISABLED", message: "用户已被禁用" } })
    const accessToken = await app.jwt.sign({ sub: user.id.toString(), actorType: "MINIAPP_USER", tokenVersion: user.token_version, aud: "miniapp" }, {
      key: miniappJwtSecret,
      expiresIn: MINIAPP_TOKEN_EXPIRES_IN,
    })
    return { accessToken, expiresIn: MINIAPP_TOKEN_EXPIRES_IN, user: toMiniappUserView(user) }
  } catch (error) {
    if (error instanceof WechatLoginError) {
      const httpStatus = { WECHAT_LOGIN_CODE_INVALID: 401, WECHAT_LOGIN_BLOCKED: 403, WECHAT_LOGIN_RATE_LIMITED: 429, WECHAT_SERVICE_ERROR: 502 }[error.code]
      const message = { WECHAT_LOGIN_CODE_INVALID: "微信登录凭证无效", WECHAT_LOGIN_BLOCKED: "微信登录受到限制", WECHAT_LOGIN_RATE_LIMITED: "微信登录请求过于频繁", WECHAT_SERVICE_ERROR: "微信登录服务暂时不可用" }[error.code]
      return reply.code(httpStatus).send({ error: { code: error.code, message } })
    }
    // Do not log raw database errors: identity values may be part of the error detail.
    request.log.error("小程序登录写入失败")
    return reply.code(502).send({ error: { code: "WECHAT_SERVICE_ERROR", message: "微信登录服务暂时不可用" } })
  }
})

app.get("/api/miniapp/users/me", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  return user ? toMiniappUserView(user) : undefined
})

app.get<{ Querystring: { page?: string; pageSize?: string; circleId?: string; categoryId?: string; contentType?: string } }>("/api/miniapp/posts", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const pagination = parsePageParams(request.query.page, request.query.pageSize)
  const circleId = request.query.circleId === undefined ? undefined : parseBigintId(request.query.circleId)
  const categoryId = request.query.categoryId === undefined ? undefined : parseBigintId(request.query.categoryId)
  const contentType = parseContentType(request.query.contentType)
  if (!pagination || (request.query.circleId !== undefined && !circleId) || (request.query.categoryId !== undefined && !categoryId) || contentType === null) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子筛选或分页参数不合法" } })
  }
  const result = await listPosts({ audience: "public", ...pagination, circleId: circleId ?? undefined, categoryId: categoryId ?? undefined, contentType })
  return { items: result.items, pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) } }
})

app.get<{ Params: { id: string } }>("/api/miniapp/posts/:id", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 不合法" } })
  const post = await findPost(id, "public")
  if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return post
})

app.post<{ Body: { circleId?: unknown; categoryId?: unknown; contentType?: unknown; content?: unknown; media?: unknown } }>("/api/miniapp/posts", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const circleId = typeof request.body?.circleId === "string" ? parseBigintId(request.body.circleId) : null
  const categoryId = typeof request.body?.categoryId === "string" ? parseBigintId(request.body.categoryId) : null
  const contentType = typeof request.body?.contentType === "string" ? parseContentType(request.body.contentType) : null
  const content = typeof request.body?.content === "string" ? request.body.content.trim() : ""
  if (!circleId || !categoryId || !contentType || contentType === null || !content || request.body?.media !== undefined) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子内容、圈子、分类或内容类型不合法；媒体上传尚未配置" } })
  }
  const result = await createTextPost({ userId: user.id, circleId, categoryId, contentType, content })
  if (result.kind === "media-not-configured") return reply.code(503).send({ error: { code: "MEDIA_STORAGE_NOT_CONFIGURED", message: "图片和视频发布需等待对象存储配置" } })
  if (result.kind === "circle-not-available") return reply.code(409).send({ error: { code: "CIRCLE_NOT_AVAILABLE", message: "圈子不可用" } })
  if (result.kind === "category-not-available") return reply.code(409).send({ error: { code: "CATEGORY_NOT_AVAILABLE", message: "分类不可用" } })
  if (result.kind === "not-a-member") return reply.code(403).send({ error: { code: "CIRCLE_MEMBERSHIP_REQUIRED", message: "加入圈子后才能发帖" } })
  return reply.code(201).send(result.post)
})

app.delete<{ Params: { id: string } }>("/api/miniapp/posts/:id", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 不合法" } })
  const result = await softDeletePost(id, { userId: user.id })
  if (result === "forbidden") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "只能删除自己的帖子" } })
  if (result === "not-found") return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return reply.code(204).send()
})

app.put<{ Params: { id: string } }>("/api/miniapp/posts/:id/likes/me", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 不合法" } })
  if (await addPostLike(id, user.id) === "not-found") return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return { liked: true, likeCount: await countPostLikes(id) }
})

app.delete<{ Params: { id: string } }>("/api/miniapp/posts/:id/likes/me", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 不合法" } })
  if (await removePostLike(id, user.id) === "not-found") return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return { liked: false, likeCount: await countPostLikes(id) }
})

app.get<{ Params: { id: string }; Querystring: { page?: string; pageSize?: string } }>("/api/miniapp/posts/:id/comments", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  const pagination = parsePageParams(request.query.page, request.query.pageSize)
  if (!id || !pagination) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 或分页参数不合法" } })
  if (!await findPost(id, "public")) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  const result = await listComments({ audience: "public", postId: id, ...pagination })
  return { items: result.items, pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) } }
})

app.post<{ Params: { id: string }; Body: { content?: unknown } }>("/api/miniapp/posts/:id/comments", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  const content = typeof request.body?.content === "string" ? request.body.content.trim() : ""
  if (!id || !content || content.length > 2000) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 或评论内容不合法" } })
  const comment = await createComment(id, user.id, content)
  if (!comment) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return reply.code(201).send(comment)
})

app.delete<{ Params: { id: string } }>("/api/miniapp/comments/:id", async (request, reply) => {
  const user = await requireMiniappUser(request, reply)
  if (!user) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "评论 ID 不合法" } })
  const result = await softDeleteComment(id, { userId: user.id })
  if (result === "forbidden") return reply.code(403).send({ error: { code: "FORBIDDEN", message: "只能删除自己的评论" } })
  if (result === "not-found") return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "评论不存在" } })
  return reply.code(204).send()
})

app.get<{ Querystring: { page?: string; pageSize?: string; circleId?: string; categoryId?: string; userId?: string; contentType?: string; status?: string } }>("/admin-api/posts", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const pagination = parsePageParams(request.query.page, request.query.pageSize)
  const circleId = request.query.circleId === undefined ? undefined : parseBigintId(request.query.circleId)
  const categoryId = request.query.categoryId === undefined ? undefined : parseBigintId(request.query.categoryId)
  const userId = request.query.userId === undefined ? undefined : parseBigintId(request.query.userId)
  const contentType = parseContentType(request.query.contentType)
  const status = parseContentStatus(request.query.status)
  if (!pagination || (request.query.circleId !== undefined && !circleId) || (request.query.categoryId !== undefined && !categoryId)
    || (request.query.userId !== undefined && !userId) || contentType === null || status === null) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子筛选或分页参数不合法" } })
  }
  const result = await listPosts({ audience: "admin", ...pagination, circleId: circleId ?? undefined, categoryId: categoryId ?? undefined, userId: userId ?? undefined, contentType, status })
  return { items: result.items, pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) } }
})

app.get<{ Params: { id: string } }>("/admin-api/posts/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 不合法" } })
  const post = await findPost(id, "admin", true)
  if (!post) return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return post
})

app.post<{ Params: { id: string }; Body: { status?: string; reason?: string } }>("/admin-api/posts/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const statusValue = request.body?.status
  const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : ""
  if (!id || (statusValue !== "published" && statusValue !== "hidden") || !reason || reason.length > 500) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID、状态和 1–500 位操作原因均为必填项" } })
  }
  const result = await updatePostStatus(id, statusValue === "published" ? 1 : 0, {
    operatorId: admin.id, operatorRole: admin.role, reason, requestId: request.id,
  })
  if (result === "not-found") return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  const post = await findPost(id, "admin")
  return post
})

app.delete<{ Params: { id: string }; Body: { reason?: string } }>("/admin-api/posts/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : ""
  if (!id || !reason || reason.length > 500) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "帖子 ID 和 1–500 位删除原因均为必填项" } })
  const result = await softDeletePost(id, { operatorId: admin.id, operatorRole: admin.role, reason, requestId: request.id })
  if (result === "not-found") return reply.code(404).send({ error: { code: "POST_NOT_FOUND", message: "帖子不存在" } })
  return reply.code(204).send()
})

app.get<{ Querystring: { page?: string; pageSize?: string; postId?: string; userId?: string; status?: string } }>("/admin-api/comments", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const pagination = parsePageParams(request.query.page, request.query.pageSize)
  const postId = request.query.postId === undefined ? undefined : parseBigintId(request.query.postId)
  const userId = request.query.userId === undefined ? undefined : parseBigintId(request.query.userId)
  const status = parseContentStatus(request.query.status)
  if (!pagination || (request.query.postId !== undefined && !postId) || (request.query.userId !== undefined && !userId) || status === null) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "评论筛选或分页参数不合法" } })
  }
  const result = await listComments({ audience: "admin", ...pagination, postId: postId ?? undefined, userId: userId ?? undefined, status })
  return { items: result.items, pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) } }
})

app.get<{ Params: { id: string } }>("/admin-api/comments/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "评论 ID 不合法" } })
  const comment = await findComment(id, "admin")
  if (!comment) return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "评论不存在" } })
  return comment
})

app.post<{ Params: { id: string }; Body: { status?: string; reason?: string } }>("/admin-api/comments/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const statusValue = request.body?.status
  const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : ""
  if (!id || (statusValue !== "published" && statusValue !== "hidden") || !reason || reason.length > 500) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "评论 ID、状态和 1–500 位操作原因均为必填项" } })
  }
  const result = await updateCommentStatus(id, statusValue === "published" ? 1 : 0, {
    operatorId: admin.id, operatorRole: admin.role, reason, requestId: request.id,
  })
  if (result === "not-found") return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "评论不存在" } })
  return findComment(id, "admin")
})

app.delete<{ Params: { id: string }; Body: { reason?: string } }>("/admin-api/comments/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : ""
  if (!id || !reason || reason.length > 500) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "评论 ID 和 1–500 位删除原因均为必填项" } })
  const result = await softDeleteComment(id, { operatorId: admin.id, operatorRole: admin.role, reason, requestId: request.id })
  if (result === "not-found") return reply.code(404).send({ error: { code: "COMMENT_NOT_FOUND", message: "评论不存在" } })
  return reply.code(204).send()
})

app.get("/health", async () => ({ ok: true }))

app.get("/api/miniapp/categories", async () => ({
  items: (await listSelectableCategories()).map((category) => ({
    id: category.id.toString(),
    name: category.name,
    code: category.code,
    sortOrder: category.sortOrder,
  })),
}))

app.get<{ Querystring: { page?: string; pageSize?: string; keyword?: string; status?: string } }>("/admin-api/categories", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const page = Number(request.query.page ?? 1)
  const pageSize = Number(request.query.pageSize ?? 10)
  const keyword = request.query.keyword?.trim()
  const status = request.query.status
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > categoryPageSizeMax
    || (request.query.keyword !== undefined && (keyword!.length > 50))
    || (status !== undefined && status !== "active" && status !== "disabled")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分页或筛选参数不合法" } })
  }
  const result = await listCategories({ page, pageSize, keyword: keyword || undefined, status: status as CategoryStatus | undefined })
  return {
    items: result.items.map(toCategoryView),
    pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
  }
})

app.post<{ Body: { name?: unknown; code?: unknown; sortOrder?: unknown } }>("/admin-api/categories", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const fields = parseCategoryFields(request.body ?? {})
  if (!fields || fields.name === undefined || fields.code === undefined || fields.sortOrder === undefined) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分类名称、代码或排序值不合法" } })
  }
  try {
    const category = await createCategory({ name: fields.name, code: fields.code, sortOrder: fields.sortOrder, operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
    return reply.code(201).send(toCategoryView(category))
  } catch (error) {
    if (isUniqueViolation(error)) return reply.code(409).send({ error: { code: "CATEGORY_ALREADY_EXISTS", message: "分类名称或代码已存在" } })
    throw error
  }
})

app.patch<{ Params: { id: string }; Body: { name?: unknown; code?: unknown; sortOrder?: unknown } }>("/admin-api/categories/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const fields = parseCategoryFields(request.body ?? {}, true)
  if (!id || !fields) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分类 ID 或更新内容不合法" } })
  try {
    const category = await updateCategory(id, { ...fields, operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
    if (!category) return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "分类不存在" } })
    return toCategoryView(category)
  } catch (error) {
    if (isUniqueViolation(error)) return reply.code(409).send({ error: { code: "CATEGORY_ALREADY_EXISTS", message: "分类名称或代码已存在" } })
    throw error
  }
})

app.patch<{ Params: { id: string }; Body: { status?: string } }>("/admin-api/categories/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const status = request.body?.status
  if (!id || (status !== "active" && status !== "disabled")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分类 ID 或状态不合法" } })
  }
  const category = await updateCategoryStatus(id, status, { operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  if (!category) return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "分类不存在" } })
  return toCategoryView(category)
})

app.delete<{ Params: { id: string } }>("/admin-api/categories/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分类 ID 不合法" } })
  const deleted = await softDeleteCategory(id, { operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  if (!deleted) return reply.code(404).send({ error: { code: "CATEGORY_NOT_FOUND", message: "分类不存在" } })
  return reply.code(204).send()
})

app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (request, reply) => {
  const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : ""
  const password = request.body?.password
  if (!username || typeof password !== "string" || password.length === 0 || password.length > 128) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "请输入用户名和密码" } })
  }

  const user = await findUserByUsername(username)
  if (!user || user.status !== 1) {
    return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "用户名或密码错误" } })
  }
  const verification = await verifyPassword(password, user.password_hash)
  if (!verification.valid) {
    return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "用户名或密码错误" } })
  }
  if (verification.upgradedHash) await upgradePasswordHash(user.id, verification.upgradedHash)

  await markLogin(user.id)
  const accessToken = await app.jwt.sign({ userId: user.id, tokenVersion: user.token_version }, { expiresIn: "2h" })
  return { accessToken, user: toUserView(user) }
})

app.get("/api/users/me", async (request, reply) => {
  const user = await authenticate(request, reply)
  return user ? toUserView(user) : undefined
})

app.patch<{ Body: { phone?: string | null; email?: string | null; gender?: number } }>("/api/users/me", async (request, reply) => {
  const user = await authenticate(request, reply)
  if (!user) return undefined
  try {
    await updateProfile(user.id, {
      phone: normalizeNullable(request.body.phone),
      email: normalizeEmail(request.body.email),
      gender: parseGender(request.body.gender ?? user.gender),
    })
    const updated = await findUserById(user.id)
    return updated ? toUserView(updated) : undefined
  } catch (error) {
    if ((error as Error).message === "INVALID_GENDER") {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "性别不合法" } })
    }
    if (isUniqueViolation(error)) {
      return reply.code(409).send({ error: { code: "CONTACT_ALREADY_EXISTS", message: "手机号或邮箱已被使用" } })
    }
    throw error
  }
})

app.get<{ Querystring: { page?: string; username?: string } }>("/admin-api/users", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const page = Number(request.query.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "页码必须是正整数" } })
  }
  const username = request.query.username?.trim()
  if (username && username.length > 50) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "用户名查询条件不能超过 50 个字符" } })
  }
  const result = await listUsers({ page, username })
  return {
    items: result.items.map(toUserView),
    pagination: { page, pageSize: USER_PAGE_SIZE, total: result.total, totalPages: Math.ceil(result.total / USER_PAGE_SIZE) },
  }
})

app.get<{ Querystring: { page?: string; pageSize?: string; keyword?: string; status?: string } }>("/admin-api/miniapp-users", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const page = Number(request.query.page ?? 1)
  const pageSize = Number(request.query.pageSize ?? 10)
  const keyword = request.query.keyword?.trim()
  const statusValue = request.query.status?.trim()
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "页码必须是正整数，每页数量必须在 1–100 之间" } })
  }
  if (keyword && keyword.length > 50) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "关键词不能超过 50 个字符" } })
  }
  if (statusValue && statusValue !== "active" && statusValue !== "disabled") {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "用户状态不合法" } })
  }
  const status: MiniappUserStatus | undefined = statusValue === "active" ? 1 : statusValue === "disabled" ? 0 : undefined
  const result = await listMiniappUsers({ page, pageSize, keyword, status })
  return {
    items: result.items.map(toAdminMiniappUserListItemView),
    pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
  }
})

app.get<{ Params: { id: string } }>("/admin-api/miniapp-users/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "小程序用户 ID 不合法" } })
  const user = await findMiniappUserById(id)
  if (!user) return reply.code(404).send({ error: { code: "MINIAPP_USER_NOT_FOUND", message: "小程序用户不存在" } })
  const memberships = await listActiveCircleMembershipsForUser(id)
  return toAdminMiniappUserDetailView(user, memberships)
})

app.post<{ Params: { id: string }; Body: { status?: string } }>("/admin-api/miniapp-users/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const statusValue = request.body?.status
  if (!id || (statusValue !== "active" && statusValue !== "disabled")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "小程序用户 ID 或状态不合法" } })
  }
  const status: MiniappUserStatus = statusValue === "active" ? 1 : 0
  const user = await updateMiniappUserStatus(id, status, {
    operatorId: admin.id,
    operatorRole: admin.role,
    requestId: request.id,
  })
  if (!user) return reply.code(404).send({ error: { code: "MINIAPP_USER_NOT_FOUND", message: "小程序用户不存在" } })
  return { id: user.id.toString(), status: user.status === 1 ? "active" : "disabled", updatedAt: user.updated_at }
})

app.get<{ Querystring: { page?: string; pageSize?: string; keyword?: string; status?: string } }>("/admin-api/circles", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const pagination = parseCirclePagination(request.query.page, request.query.pageSize)
  const keyword = request.query.keyword?.trim()
  const statusValue = request.query.status?.trim()
  if (!pagination || (keyword && keyword.length > 50) || (statusValue && statusValue !== "active" && statusValue !== "disabled")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分页、关键词或状态参数不合法", requestId: request.id } })
  }
  const status: CircleStatus | undefined = statusValue === "active" ? 1 : statusValue === "disabled" ? 0 : undefined
  const result = await listCircles({ ...pagination, keyword, status })
  return {
    items: result.items.map((item) => toAdminCircleView(item.circle, item.memberCount)),
    pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) },
  }
})

app.post<{ Body: { name?: string; description?: string | null; coverUrl?: string | null } }>("/admin-api/circles", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  if (!isNullableString(request.body?.description) || !isNullableString(request.body?.coverUrl)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子简介和封面地址必须是字符串或 null", requestId: request.id } })
  }
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : ""
  const description = normalizeCircleText(request.body?.description)
  const coverUrl = normalizeCircleText(request.body?.coverUrl)
  if (!name || name.length > 50 || (description && description.length > 500) || (coverUrl && coverUrl.length > 500)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子名称需为 1–50 个字符，简介和封面地址不能超过字段限制", requestId: request.id } })
  }
  const created = await createCircle({ name, description, coverUrl, operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  return reply.code(201).send(toAdminCircleView(created.circle, created.memberCount))
})

app.get<{ Params: { id: string } }>("/admin-api/circles/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子 ID 不合法", requestId: request.id } })
  const circle = await findCircleById(id)
  if (!circle) return reply.code(404).send({ error: { code: "CIRCLE_NOT_FOUND", message: "圈子不存在", requestId: request.id } })
  return toAdminCircleView(circle.circle, circle.memberCount)
})

app.patch<{ Params: { id: string }; Body: { name?: string; description?: string | null; coverUrl?: string | null } }>("/admin-api/circles/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const body = request.body ?? {}
  if ((body.name !== undefined && typeof body.name !== "string") || !isNullableString(body.description) || !isNullableString(body.coverUrl)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子更新字段类型不合法", requestId: request.id } })
  }
  const name = typeof body.name === "string" ? body.name.trim() : undefined
  const description = body.description === undefined ? undefined : normalizeCircleText(body.description)
  const coverUrl = body.coverUrl === undefined ? undefined : normalizeCircleText(body.coverUrl)
  if (!id || (body.name !== undefined && (!name || name.length > 50)) || (description && description.length > 500) || (coverUrl && coverUrl.length > 500) || (name === undefined && description === undefined && coverUrl === undefined)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子 ID 或更新内容不合法", requestId: request.id } })
  }
  const circle = await updateCircle(id, { name, description, coverUrl, operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  if (!circle) return reply.code(404).send({ error: { code: "CIRCLE_NOT_FOUND", message: "圈子不存在", requestId: request.id } })
  return toAdminCircleView(circle.circle, circle.memberCount)
})

app.delete<{ Params: { id: string } }>("/admin-api/circles/:id", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  if (!id) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子 ID 不合法", requestId: request.id } })
  const result = await softDeleteCircle(id, { operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  if (result === "not-found") {
    return reply.code(404).send({ error: { code: "CIRCLE_NOT_FOUND", message: "圈子不存在", requestId: request.id } })
  }
  return reply.code(204).send()
})

app.post<{ Params: { id: string }; Body: { status?: string } }>("/admin-api/circles/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const statusValue = request.body?.status
  if (!id || (statusValue !== "active" && statusValue !== "disabled")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "圈子 ID 或状态不合法", requestId: request.id } })
  }
  const status: CircleStatus = statusValue === "active" ? 1 : 0
  const circle = await updateCircleStatus(id, status, { operatorId: admin.id, operatorRole: admin.role, requestId: request.id })
  if (!circle) return reply.code(404).send({ error: { code: "CIRCLE_NOT_FOUND", message: "圈子不存在", requestId: request.id } })
  return toAdminCircleView(circle.circle, circle.memberCount)
})

app.get<{ Params: { id: string }; Querystring: { page?: string; pageSize?: string; keyword?: string; status?: string } }>("/admin-api/circles/:id/members", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = parseBigintId(request.params.id)
  const pagination = parseCirclePagination(request.query.page, request.query.pageSize)
  const keyword = request.query.keyword?.trim()
  const statusValue = request.query.status?.trim()
  if (!id || !pagination || (keyword && keyword.length > 50) || (statusValue && statusValue !== "active" && statusValue !== "left")) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "成员分页参数不合法", requestId: request.id } })
  }
  if (!await findCircleById(id)) return reply.code(404).send({ error: { code: "CIRCLE_NOT_FOUND", message: "圈子不存在", requestId: request.id } })
  const status: CircleMemberStatus | undefined = statusValue === "active" ? 1 : statusValue === "left" ? 0 : undefined
  const result = await listCircleMembers({ circleId: id, ...pagination, keyword, status })
  return {
    items: result.items.map((item) => ({
      userId: item.userId.toString(),
      nickname: item.nickname,
      avatarUrl: item.avatarUrl,
      status: item.status === 1 ? "active" : "left",
      joinedAt: item.joinedAt,
      updatedAt: item.updatedAt,
    })),
    pagination: { ...pagination, total: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) },
  }
})

app.post<{ Body: { username?: string; password?: string; phone?: string; email?: string; gender?: number; role?: number } }>("/admin-api/users", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : ""
  const password = request.body?.password
  if (!username || username.length > 50 || !/^[a-z0-9_]+$/.test(username) || !isValidPassword(password)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "用户名需为 1–50 位英文、数字或下划线，密码需为 8–128 位" } })
  }
  const role = Number(request.body.role ?? 0)
  if (![0, 1].includes(role)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "角色不合法" } })
  }
  try {
    const id = await createUser({
      username,
      passwordHash: await hashPassword(password),
      phone: normalizeNullable(request.body.phone),
      email: normalizeEmail(request.body.email),
      gender: parseGender(request.body.gender ?? 0),
      role: role as UserRole,
    })
    const user = await findUserById(id)
    return reply.code(201).send(user ? toUserView(user) : undefined)
  } catch (error) {
    if ((error as Error).message === "INVALID_GENDER") {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "性别不合法" } })
    }
    if (isUniqueViolation(error)) {
      return reply.code(409).send({ error: { code: "USER_ALREADY_EXISTS", message: "用户名、手机号或邮箱已存在" } })
    }
    throw error
  }
})

app.post<{ Params: { id: string }; Body: { status?: number } }>("/admin-api/users/:id/status", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = Number(request.params.id)
  const status = Number(request.body?.status)
  if (!Number.isSafeInteger(id) || id < 1 || ![0, 1].includes(status)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "参数不合法" } })
  }
  if (id === admin.id && status === 0) {
    return reply.code(400).send({ error: { code: "CANNOT_DISABLE_SELF", message: "不能禁用当前管理员" } })
  }
  const updated = await updateUserStatus(id, status as 0 | 1)
  if (!updated) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "用户不存在" } })
  const user = await findUserById(id)
  return user ? toUserView(user) : undefined
})

app.post<{ Params: { id: string }; Body: { password?: string; reason?: string } }>("/admin-api/users/:id/password-reset", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const id = Number(request.params.id)
  const password = request.body?.password
  const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : ""
  if (!Number.isSafeInteger(id) || id < 1 || !isValidPassword(password) || !reason || reason.length > 500) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "用户 ID、8–128 位新密码和 1–500 位重置原因均为必填项" } })
  }

  const audit = await resetUserPassword(id, await hashPassword(password), {
    operatorId: admin.id,
    operatorRole: admin.role,
    reason,
    requestId: request.id,
  })
  if (!audit) return reply.code(404).send({ error: { code: "USER_NOT_FOUND", message: "用户不存在" } })
  request.log.info({ audit: { ...audit, resourceId: audit.resourceId.toString() } }, "管理员重置用户密码")
  return reply.code(204).send()
})

app.addHook("onClose", async () => {
  await closeDatabase()
})

export { app }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: "127.0.0.1" })
}
