import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm"
import { database } from "./database.js"
import { auditLogs, circleMembers, circles, miniappUsers } from "./schema.js"
import type { CircleMemberStatus, CircleStatus } from "./types.js"

export type CircleRow = typeof circles.$inferSelect

export interface CircleWithMemberCount {
  circle: CircleRow
  memberCount: number
}

function now(): string {
  return new Date().toISOString()
}

export async function listCircles(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: CircleStatus
}): Promise<{ items: CircleWithMemberCount[]; total: number }> {
  const filters: SQL[] = [isNull(circles.deleted_at)]
  if (params.keyword) filters.push(ilike(circles.name, `%${params.keyword}%`))
  if (params.status !== undefined) filters.push(eq(circles.status, params.status))
  const where = and(...filters)
  const offset = (params.page - 1) * params.pageSize
  const [items, totalResult] = await Promise.all([
    database.select({ circle: circles, memberCount: count(circleMembers.id) })
      .from(circles)
      .leftJoin(circleMembers, and(
        eq(circleMembers.circle_id, circles.id),
        eq(circleMembers.status, 1),
      ))
      .where(where)
      .groupBy(circles.id)
      .orderBy(desc(circles.created_at), desc(circles.id))
      .limit(params.pageSize)
      .offset(offset),
    database.select({ value: count() }).from(circles).where(where),
  ])
  return { items, total: totalResult[0]?.value ?? 0 }
}

export async function findCircleById(id: bigint): Promise<CircleWithMemberCount | null> {
  const [result] = await database.select({ circle: circles, memberCount: count(circleMembers.id) })
    .from(circles)
    .leftJoin(circleMembers, and(
      eq(circleMembers.circle_id, circles.id),
      eq(circleMembers.status, 1),
    ))
    .where(and(eq(circles.id, id), isNull(circles.deleted_at)))
    .groupBy(circles.id)
    .limit(1)
  return result ?? null
}

export async function createCircle(input: {
  name: string
  description: string | null
  coverUrl: string | null
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CircleWithMemberCount> {
  const circle = await database.transaction(async (transaction) => {
    const [created] = await transaction.insert(circles).values({
      name: input.name,
      description: input.description,
      cover_url: input.coverUrl,
    }).returning()
    if (!created) throw new Error("创建圈子失败")
    await transaction.insert(auditLogs).values({
      operatorId: input.operatorId,
      operatorRole: input.operatorRole,
      action: "circle.create",
      resourceType: "circle",
      resourceId: created.id,
      reason: "后台创建圈子",
      requestId: input.requestId,
    })
    return created
  })
  return { circle, memberCount: 0 }
}

export async function updateCircle(id: bigint, input: {
  name?: string
  description?: string | null
  coverUrl?: string | null
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CircleWithMemberCount | null> {
  const values: Partial<typeof circles.$inferInsert> = { updated_at: now() }
  if (input.name !== undefined) values.name = input.name
  if (input.description !== undefined) values.description = input.description
  if (input.coverUrl !== undefined) values.cover_url = input.coverUrl

  const updated = await database.transaction(async (transaction) => {
    const [circle] = await transaction.update(circles).set(values)
      .where(and(eq(circles.id, id), isNull(circles.deleted_at)))
      .returning()
    if (!circle) return null
    await transaction.insert(auditLogs).values({
      operatorId: input.operatorId,
      operatorRole: input.operatorRole,
      action: "circle.update",
      resourceType: "circle",
      resourceId: circle.id,
      reason: "后台更新圈子资料",
      requestId: input.requestId,
    })
    return circle
  })
  if (!updated) return null
  return findCircleById(updated.id)
}

export async function updateCircleStatus(id: bigint, status: CircleStatus, audit: {
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CircleWithMemberCount | null> {
  const result = await database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(circles)
      .where(and(eq(circles.id, id), isNull(circles.deleted_at)))
      .limit(1)
    if (!current) return null
    if (current.status === status) return current

    const [updated] = await transaction.update(circles).set({ status, updated_at: now() })
      .where(and(eq(circles.id, id), isNull(circles.deleted_at)))
      .returning()
    if (!updated) return null
    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "circle.status.update",
      resourceType: "circle",
      resourceId: updated.id,
      reason: status === 1 ? "后台启用圈子" : "后台禁用圈子",
      requestId: audit.requestId,
    })
    return updated
  })
  return result ? findCircleById(result.id) : null
}

export type SoftDeleteCircleResult = "deleted" | "already-deleted" | "not-found"

export async function softDeleteCircle(id: bigint, audit: {
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<SoftDeleteCircleResult> {
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select({ deletedAt: circles.deleted_at })
      .from(circles)
      .where(eq(circles.id, id))
      .limit(1)
    if (!current) return "not-found"
    if (current.deletedAt) return "already-deleted"

    const deletedAt = now()
    const [deleted] = await transaction.update(circles).set({
      status: 0,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    }).where(and(eq(circles.id, id), isNull(circles.deleted_at))).returning({ id: circles.id })
    if (!deleted) return "already-deleted"

    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "circle.delete",
      resourceType: "circle",
      resourceId: id,
      reason: "后台删除圈子",
      requestId: audit.requestId,
    })
    return "deleted"
  })
}

export async function listCircleMembers(params: {
  circleId: bigint
  page: number
  pageSize: number
  keyword?: string
  status?: CircleMemberStatus
}): Promise<{ items: Array<{
  userId: bigint
  nickname: string
  avatarUrl: string | null
  status: CircleMemberStatus
  joinedAt: string
  updatedAt: string
}>; total: number }> {
  const filters: SQL[] = [eq(circleMembers.circle_id, params.circleId)]
  if (params.status !== undefined) filters.push(eq(circleMembers.status, params.status))
  if (params.keyword) {
    const id = /^[1-9]\d*$/.test(params.keyword) ? BigInt(params.keyword) : null
    const keywordFilter = id && id <= 9_223_372_036_854_775_807n
      ? or(eq(miniappUsers.id, id), ilike(miniappUsers.nickname, `%${params.keyword}%`))
      : ilike(miniappUsers.nickname, `%${params.keyword}%`)
    if (keywordFilter) filters.push(keywordFilter)
  }
  const where = and(...filters)
  const offset = (params.page - 1) * params.pageSize
  const [items, totalResult] = await Promise.all([
    database.select({
      userId: miniappUsers.id,
      nickname: miniappUsers.nickname,
      avatarUrl: miniappUsers.avatar_url,
      status: circleMembers.status,
      joinedAt: circleMembers.joined_at,
      updatedAt: circleMembers.updated_at,
    }).from(circleMembers)
      .innerJoin(miniappUsers, eq(circleMembers.user_id, miniappUsers.id))
      .where(where)
      .orderBy(desc(circleMembers.joined_at), desc(circleMembers.id))
      .limit(params.pageSize)
      .offset(offset),
    database.select({ value: count() })
      .from(circleMembers)
      .innerJoin(miniappUsers, eq(circleMembers.user_id, miniappUsers.id))
      .where(where),
  ])
  return { items, total: totalResult[0]?.value ?? 0 }
}
