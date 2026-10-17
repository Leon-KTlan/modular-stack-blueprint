import { and, asc, count, eq, ilike, isNull, or } from "drizzle-orm"
import { database } from "./database.js"
import { auditLogs, categories } from "./schema.js"

export type CategoryRow = typeof categories.$inferSelect
export type CategoryStatus = "active" | "disabled"
const PAGE_SIZE_MAX = 100

function statusValue(status: CategoryStatus): 0 | 1 {
  return status === "active" ? 1 : 0
}

function toStatus(status: number): CategoryStatus {
  return status === 1 ? "active" : "disabled"
}

function toView(row: CategoryRow) {
  return {
    id: row.id.toString(),
    name: row.name,
    code: row.code,
    sortOrder: row.sortOrder,
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const toCategoryView = toView

export async function seedCategories(): Promise<CategoryRow[]> {
  await database.insert(categories).values([
    { name: "校园生活", code: "campus-life", sortOrder: 10 },
    { name: "学习交流", code: "study", sortOrder: 20 },
    { name: "失物招领", code: "lost-found", sortOrder: 30 },
    { name: "求助问答", code: "help", sortOrder: 40 },
    { name: "经验分享", code: "experience", sortOrder: 50 },
    { name: "其他", code: "other", sortOrder: 60 },
  ]).onConflictDoNothing({ target: categories.code })
  return listSelectableCategories()
}

export async function listCategories(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: CategoryStatus
}): Promise<{ items: CategoryRow[]; total: number }> {
  const conditions = [isNull(categories.deleted_at)]
  if (params.status) conditions.push(eq(categories.status, statusValue(params.status)))
  if (params.keyword) {
    conditions.push(or(ilike(categories.name, `%${params.keyword}%`), ilike(categories.code, `%${params.keyword}%`))!)
  }
  const where = and(...conditions)
  const offset = (params.page - 1) * params.pageSize
  const [items, totalResult] = await Promise.all([
    database.select().from(categories).where(where).orderBy(asc(categories.sortOrder), asc(categories.id)).limit(params.pageSize).offset(offset),
    database.select({ value: count() }).from(categories).where(where),
  ])
  return { items, total: totalResult[0]?.value ?? 0 }
}

export async function listSelectableCategories(): Promise<CategoryRow[]> {
  return database.select().from(categories)
    .where(and(eq(categories.status, 1), isNull(categories.deleted_at)))
    .orderBy(asc(categories.sortOrder), asc(categories.id))
}

export async function createCategory(input: {
  name: string
  code: string
  sortOrder: number
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CategoryRow> {
  return database.transaction(async (transaction) => {
    const [created] = await transaction.insert(categories).values({
      name: input.name,
      code: input.code,
      sortOrder: input.sortOrder,
    }).returning()
    if (!created) throw new Error("创建分类失败")
    await transaction.insert(auditLogs).values({
      operatorId: input.operatorId,
      operatorRole: input.operatorRole,
      action: "category.create",
      resourceType: "category",
      resourceId: created.id,
      reason: "后台新增分类",
      requestId: input.requestId,
    })
    return created
  })
}

export async function updateCategory(id: bigint, input: {
  name?: string
  code?: string
  sortOrder?: number
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CategoryRow | null> {
  return database.transaction(async (transaction) => {
    const [existing] = await transaction.select().from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deleted_at))).for("update").limit(1)
    if (!existing) return null
    const [updated] = await transaction.update(categories).set({
      name: input.name ?? existing.name,
      code: input.code ?? existing.code,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updated_at: new Date().toISOString(),
    }).where(eq(categories.id, id)).returning()
    if (!updated) return null
    await transaction.insert(auditLogs).values({
      operatorId: input.operatorId,
      operatorRole: input.operatorRole,
      action: "category.update",
      resourceType: "category",
      resourceId: id,
      reason: "后台编辑分类",
      requestId: input.requestId,
    })
    return updated
  })
}

export async function updateCategoryStatus(id: bigint, status: CategoryStatus, audit: {
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<CategoryRow | null> {
  return database.transaction(async (transaction) => {
    const [updated] = await transaction.update(categories).set({
      status: statusValue(status),
      updated_at: new Date().toISOString(),
    }).where(and(eq(categories.id, id), isNull(categories.deleted_at))).returning()
    if (!updated) return null
    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: status === "active" ? "category.enable" : "category.disable",
      resourceType: "category",
      resourceId: id,
      reason: status === "active" ? "后台启用分类" : "后台停用分类",
      requestId: audit.requestId,
    })
    return updated
  })
}

export async function softDeleteCategory(id: bigint, audit: {
  operatorId: number
  operatorRole: number
  requestId: string
}): Promise<boolean> {
  return database.transaction(async (transaction) => {
    const [deleted] = await transaction.update(categories).set({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).where(and(eq(categories.id, id), isNull(categories.deleted_at))).returning({ id: categories.id })
    if (!deleted) return false
    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "category.delete",
      resourceType: "category",
      resourceId: id,
      reason: "后台软删除分类",
      requestId: audit.requestId,
    })
    return true
  })
}

export const categoryPageSizeMax = PAGE_SIZE_MAX
