import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify"
import fastifyJwt from "@fastify/jwt"
import bcrypt from "bcryptjs"
import "dotenv/config"
import {
  createUser,
  findUserById,
  findUserByUsername,
  listUsers,
  markLogin,
  updateProfile,
  updateUserStatus,
  type UserRow,
} from "./db.js"
import { toUserView, type UserGender, type UserRole } from "./types.js"

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

app.post<{ Body: { username?: string; password?: string } }>("/api/auth/login", async (request, reply) => {
  const username = request.body?.username?.trim().toLowerCase()
  const password = request.body?.password
  if (!username || !password) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "请输入用户名和密码" } })
  }

  const user = await findUserByUsername(username)
  if (!user || user.status !== 1 || !(await bcrypt.compare(password, user.password_hash))) {
    return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "用户名或密码错误" } })
  }

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
      email: normalizeNullable(request.body.email),
      gender: parseGender(request.body.gender ?? user.gender),
    })
    const updated = await findUserById(user.id)
    return updated ? toUserView(updated) : undefined
  } catch (error) {
    if ((error as Error).message === "INVALID_GENDER") {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "性别不合法" } })
    }
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return reply.code(409).send({ error: { code: "CONTACT_ALREADY_EXISTS", message: "手机号或邮箱已被使用" } })
    }
    throw error
  }
})

app.get<{ Querystring: { page?: string; pageSize?: string; keyword?: string; status?: string } }>("/admin-api/users", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const page = Number(request.query.page ?? 1)
  const pageSize = Number(request.query.pageSize ?? 10)
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "分页参数不合法" } })
  }
  const rawStatus = request.query.status
  if (rawStatus !== undefined && rawStatus !== "0" && rawStatus !== "1") {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "状态参数不合法" } })
  }
  const status = rawStatus === "0" || rawStatus === "1" ? Number(rawStatus) as 0 | 1 : undefined
  const result = await listUsers({ page, pageSize, keyword: request.query.keyword?.trim(), status })
  return {
    items: result.items.map(toUserView),
    pagination: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) },
  }
})

app.post<{ Body: { username?: string; password?: string; phone?: string; email?: string; gender?: number; role?: number } }>("/admin-api/users", async (request, reply) => {
  const admin = await requireAdmin(request, reply)
  if (!admin) return undefined
  const username = request.body?.username?.trim().toLowerCase()
  const password = request.body?.password
  if (!username || username.length > 50 || !/^[a-z0-9_]+$/.test(username) || !password || password.length < 8) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "用户名需为 1–50 位英文、数字或下划线，密码至少 8 位" } })
  }
  const role = Number(request.body.role ?? 0)
  if (![0, 1].includes(role)) {
    return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "角色不合法" } })
  }
  try {
    const id = await createUser({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      phone: normalizeNullable(request.body.phone),
      email: normalizeNullable(request.body.email),
      gender: parseGender(request.body.gender ?? 0),
      role: role as UserRole,
    })
    const user = await findUserById(id)
    return reply.code(201).send(user ? toUserView(user) : undefined)
  } catch (error) {
    if ((error as Error).message === "INVALID_GENDER") {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "性别不合法" } })
    }
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
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

export { app }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: "127.0.0.1" })
}
