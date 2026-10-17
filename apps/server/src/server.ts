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
  type CircleMemberStatus,
  type CircleStatus,
  type MiniappUserStatus,
  type UserGender,
  type UserRole,
} from "./types.js"

const app = Fastify({ logger: true })
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith("replace-")) throw new Error("JWT_SECRET must be set to at least 32 characters")

await app.register(fastifyJwt, {
  secret: jwtSecret,
})

interface JwtPayload {
  userId: number
  tokenVersion: number
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
