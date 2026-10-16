import { and, count, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm"
import { database } from "./database.js"
import { hashPassword } from "./password.js"
import { auditLogs, miniappUsers, users } from "./schema.js"
import type { MiniappUserStatus, UserGender, UserRole } from "./types.js"

export type UserRow = typeof users.$inferSelect
export type AuditLogRow = typeof auditLogs.$inferSelect
export type MiniappUserRow = typeof miniappUsers.$inferSelect
export const USER_PAGE_SIZE = 10

function now(): string {
  return new Date().toISOString()
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const [user] = await database.select().from(users).where(eq(users.username, username)).limit(1)
  return user ?? null
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const [user] = await database.select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}

export async function listUsers(params: {
  page: number
  username?: string
}): Promise<{ items: UserRow[]; total: number }> {
  const where = params.username ? ilike(users.username, `%${params.username}%`) : undefined
  const offset = (params.page - 1) * USER_PAGE_SIZE
  const [items, totalResult] = await Promise.all([
    database.select().from(users).where(where).orderBy(desc(users.id)).limit(USER_PAGE_SIZE).offset(offset),
    database.select({ value: count() }).from(users).where(where),
  ])
  return { items, total: totalResult[0]?.value ?? 0 }
}

function parseMiniappSearchId(keyword: string): bigint | null {
  if (!/^[1-9]\d*$/.test(keyword)) return null
  const id = BigInt(keyword)
  return id <= 9_223_372_036_854_775_807n ? id : null
}

export async function listMiniappUsers(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: MiniappUserStatus
}): Promise<{ items: MiniappUserRow[]; total: number }> {
  const conditions: SQL[] = []
  if (params.keyword) {
    const id = parseMiniappSearchId(params.keyword)
    const nicknameCondition = ilike(miniappUsers.nickname, `%${params.keyword}%`)
    conditions.push(id ? or(eq(miniappUsers.id, id), nicknameCondition)! : nicknameCondition)
  }
  if (params.status !== undefined) conditions.push(eq(miniappUsers.status, params.status))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (params.page - 1) * params.pageSize
  const [items, totalResult] = await Promise.all([
    database.select().from(miniappUsers).where(where).orderBy(desc(miniappUsers.created_at), desc(miniappUsers.id)).limit(params.pageSize).offset(offset),
    database.select({ value: count() }).from(miniappUsers).where(where),
  ])
  return { items, total: totalResult[0]?.value ?? 0 }
}

export async function findMiniappUserById(id: bigint): Promise<MiniappUserRow | null> {
  const [user] = await database.select().from(miniappUsers).where(eq(miniappUsers.id, id)).limit(1)
  return user ?? null
}

export async function updateMiniappUserStatus(id: bigint, status: MiniappUserStatus, audit: {
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<MiniappUserRow | null> {
  return database.transaction(async (transaction) => {
    const [updated] = await transaction.update(miniappUsers).set({
      status,
      token_version: sql`${miniappUsers.token_version} + 1`,
      updated_at: now(),
    }).where(and(eq(miniappUsers.id, id), ne(miniappUsers.status, status))).returning()

    if (!updated) {
      const [existing] = await transaction.select().from(miniappUsers).where(eq(miniappUsers.id, id)).limit(1)
      return existing ?? null
    }

    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "miniapp_user.status.update",
      resourceType: "miniapp_user",
      resourceId: id,
      reason: status === 1 ? "启用小程序用户" : "禁用小程序用户",
      requestId: audit.requestId,
    })
    return updated
  })
}

export async function createUser(input: {
  username: string
  passwordHash: string
  phone: string | null
  email: string | null
  gender: UserGender
  role: UserRole
}): Promise<number> {
  const [created] = await database.insert(users).values({
    username: input.username,
    password_hash: input.passwordHash,
    phone: input.phone,
    email: input.email,
    gender: input.gender,
    role: input.role,
  }).returning({ id: users.id })
  if (!created) throw new Error("创建用户失败")
  return created.id
}

export async function updateProfile(id: number, input: {
  phone: string | null
  email: string | null
  gender: UserGender
}): Promise<void> {
  const [updated] = await database.update(users).set({
    ...input,
    updated_at: now(),
  }).where(eq(users.id, id)).returning({ id: users.id })
  if (!updated) throw new Error("用户不存在")
}

export async function updateUserStatus(id: number, status: 0 | 1): Promise<boolean> {
  const [updated] = await database.update(users).set({
    status,
    token_version: sql`${users.token_version} + 1`,
    updated_at: now(),
  }).where(eq(users.id, id)).returning({ id: users.id })
  return Boolean(updated)
}

export async function upgradePasswordHash(id: number, passwordHash: string): Promise<void> {
  await database.update(users).set({
    password_hash: passwordHash,
    updated_at: now(),
  }).where(eq(users.id, id))
}

export async function resetUserPassword(id: number, passwordHash: string, audit: {
  operatorId: number
  operatorRole: number
  reason: string
  requestId: string
}): Promise<AuditLogRow | null> {
  return database.transaction(async (transaction) => {
    const [updated] = await transaction.update(users).set({
      password_hash: passwordHash,
      token_version: sql`${users.token_version} + 1`,
      updated_at: now(),
    }).where(eq(users.id, id)).returning({ id: users.id })
    if (!updated) return null

    const [record] = await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "user.password.reset",
      resourceType: "user",
      resourceId: BigInt(id),
      reason: audit.reason,
      requestId: audit.requestId,
    }).returning()
    if (!record) throw new Error("密码重置审计日志写入失败")
    return record
  })
}

export async function markLogin(id: number): Promise<void> {
  await database.update(users).set({ last_login_at: now() }).where(eq(users.id, id))
}

export async function seedUsers(): Promise<UserRow[]> {
  const createdAt = now()
  const adminHash = await hashPassword("Admin123!")
  const userHash = await hashPassword("User123!")
  await database.insert(users).values([
    { username: "admin", password_hash: adminHash, phone: "13800000001", email: "admin@example.com", gender: 1, role: 1, status: 1, created_at: createdAt, updated_at: createdAt },
    { username: "leon", password_hash: userHash, phone: "13800000002", email: "leon@example.com", gender: 1, role: 0, status: 1, created_at: createdAt, updated_at: createdAt },
    { username: "alice", password_hash: userHash, phone: null, email: "alice@example.com", gender: 2, role: 0, status: 0, created_at: createdAt, updated_at: createdAt },
  ]).onConflictDoNothing({ target: users.username })
  return database.select().from(users).orderBy(users.id)
}
