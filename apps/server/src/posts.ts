import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm"
import { database } from "./database.js"
import { auditLogs, categories, circleMembers, circles, comments, miniappUsers, postLikes, postMedia, posts } from "./schema.js"
import type { ContentType, MediaType } from "./types.js"

export type AdminContentStatus = "published" | "hidden" | "deleted"
export type PublicContentStatus = "published" | "hidden"

type MediaView = { id: string; type: MediaType; url: string; sortOrder: number; createdAt: string }

type JoinedPostRow = {
  post: typeof posts.$inferSelect
  author: { id: bigint; nickname: string; avatarUrl: string | null }
  circle: { id: bigint; name: string }
  category: { id: bigint; name: string; code: string }
  likeCount: number
  commentCount: number
}

type JoinedCommentRow = {
  comment: typeof comments.$inferSelect
  author: { id: bigint; nickname: string; avatarUrl: string | null }
  post: { id: bigint; content: string; circleName: string }
}

function postView(row: JoinedPostRow, media: MediaView[] = []) {
  return {
    id: row.post.id.toString(),
    user: { id: row.author.id.toString(), nickname: row.author.nickname, avatarUrl: row.author.avatarUrl },
    circle: { id: row.circle.id.toString(), name: row.circle.name },
    category: { id: row.category.id.toString(), name: row.category.name, code: row.category.code },
    contentType: row.post.content_type,
    content: row.post.content,
    status: row.post.status === 1 ? "published" as const : "hidden" as const,
    createdAt: row.post.created_at,
    updatedAt: row.post.updated_at,
    deletedAt: row.post.deleted_at,
    likeCount: Number(row.likeCount),
    commentCount: Number(row.commentCount),
    viewCount: row.post.view_count,
    media,
  }
}

function commentView(row: JoinedCommentRow) {
  return {
    id: row.comment.id.toString(),
    post: { id: row.post.id.toString(), content: row.post.content, circleName: row.post.circleName },
    user: { id: row.author.id.toString(), nickname: row.author.nickname, avatarUrl: row.author.avatarUrl },
    content: row.comment.content,
    status: row.comment.status === 1 ? "published" as const : "hidden" as const,
    createdAt: row.comment.created_at,
    updatedAt: row.comment.updated_at,
    deletedAt: row.comment.deleted_at,
  }
}

async function loadMedia(postIds: bigint[]): Promise<Map<string, MediaView[]>> {
  const result = new Map<string, MediaView[]>()
  if (postIds.length === 0) return result
  const rows = await database.select().from(postMedia)
    .where(inArray(postMedia.post_id, postIds))
    .orderBy(asc(postMedia.sort_order), asc(postMedia.id))
  for (const row of rows) {
    const key = row.post_id.toString()
    const list = result.get(key) ?? []
    list.push({ id: row.id.toString(), type: row.media_type, url: row.media_url, sortOrder: row.sort_order, createdAt: row.created_at })
    result.set(key, list)
  }
  return result
}

function joinedPostSelect() {
  return database.select({
    post: posts,
    author: { id: miniappUsers.id, nickname: miniappUsers.nickname, avatarUrl: miniappUsers.avatar_url },
    circle: { id: circles.id, name: circles.name },
    category: { id: categories.id, name: categories.name, code: categories.code },
    likeCount: sql<number>`(SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = ${posts.id})`,
    commentCount: sql<number>`(SELECT count(*)::int FROM comments c WHERE c.post_id = ${posts.id} AND c.status = 1 AND c.deleted_at IS NULL)`,
  }).from(posts)
    .innerJoin(miniappUsers, eq(posts.user_id, miniappUsers.id))
    .innerJoin(circles, eq(posts.circle_id, circles.id))
    .innerJoin(categories, eq(posts.category_id, categories.id))
}

function postFilters(params: {
  audience: "public" | "admin"
  status?: AdminContentStatus
  circleId?: bigint
  categoryId?: bigint
  userId?: bigint
  contentType?: ContentType
  postId?: bigint
  includeDeleted?: boolean
}): SQL[] {
  const filters: SQL[] = []
  if (params.postId) filters.push(eq(posts.id, params.postId))
  if (params.circleId) filters.push(eq(posts.circle_id, params.circleId))
  if (params.categoryId) filters.push(eq(posts.category_id, params.categoryId))
  if (params.userId) filters.push(eq(posts.user_id, params.userId))
  if (params.contentType) filters.push(eq(posts.content_type, params.contentType))
  if (params.audience === "public") {
    filters.push(eq(posts.status, 1), isNull(posts.deleted_at), eq(miniappUsers.status, 1), eq(circles.status, 1), isNull(circles.deleted_at))
  } else if (params.status === "deleted") {
    filters.push(isNotNull(posts.deleted_at))
  } else {
    if (!params.includeDeleted) filters.push(isNull(posts.deleted_at))
    if (params.status) filters.push(eq(posts.status, params.status === "published" ? 1 : 0))
  }
  return filters
}

export async function listPosts(params: {
  audience: "public" | "admin"
  page: number
  pageSize: number
  status?: AdminContentStatus
  circleId?: bigint
  categoryId?: bigint
  userId?: bigint
  contentType?: ContentType
}): Promise<{ items: ReturnType<typeof postView>[]; total: number }> {
  const where = and(...postFilters(params))
  const offset = (params.page - 1) * params.pageSize
  const [rows, totalResult] = await Promise.all([
    joinedPostSelect().where(where).orderBy(desc(posts.created_at), desc(posts.id)).limit(params.pageSize).offset(offset),
    database.select({ value: count() }).from(posts)
      .innerJoin(miniappUsers, eq(posts.user_id, miniappUsers.id))
      .innerJoin(circles, eq(posts.circle_id, circles.id))
      .innerJoin(categories, eq(posts.category_id, categories.id))
      .where(where),
  ])
  const media = await loadMedia(rows.map((row) => row.post.id))
  return {
    items: rows.map((row) => postView(row, media.get(row.post.id.toString()) ?? [])),
    total: totalResult[0]?.value ?? 0,
  }
}

export async function findPost(id: bigint, audience: "public" | "admin", includeDeleted = false) {
  const where = and(...postFilters({ audience, postId: id, includeDeleted }))
  const [row] = await joinedPostSelect().where(where).limit(1)
  if (!row) return null
  const media = await loadMedia([row.post.id])
  return postView(row, media.get(row.post.id.toString()) ?? [])
}

export async function incrementPostViewCount(id: bigint) {
  const [updated] = await database.update(posts)
    .set({ view_count: sql`${posts.view_count} + 1` })
    .where(and(eq(posts.id, id), eq(posts.status, 1), isNull(posts.deleted_at)))
    .returning({ viewCount: posts.view_count })
  return updated?.viewCount ?? null
}

export async function createTextPost(input: {
  userId: bigint
  circleId: bigint
  categoryId: bigint
  contentType: ContentType
  content: string
}) {
  if (input.contentType !== "TEXT") return { kind: "media-not-configured" as const }
  const [circle] = await database.select({ id: circles.id }).from(circles)
    .where(and(eq(circles.id, input.circleId), eq(circles.status, 1), isNull(circles.deleted_at))).limit(1)
  if (!circle) return { kind: "circle-not-available" as const }
  const [category] = await database.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.status, 1), isNull(categories.deleted_at))).limit(1)
  if (!category) return { kind: "category-not-available" as const }
  const [membership] = await database.select({ id: circleMembers.id }).from(circleMembers)
    .where(and(eq(circleMembers.circle_id, input.circleId), eq(circleMembers.user_id, input.userId), eq(circleMembers.status, 1))).limit(1)
  if (!membership) return { kind: "not-a-member" as const }

  const [created] = await database.insert(posts).values({
    user_id: input.userId,
    circle_id: input.circleId,
    category_id: input.categoryId,
    content_type: input.contentType,
    content: input.content,
  }).returning({ id: posts.id })
  if (!created) throw new Error("创建帖子失败")
  const post = await findPost(created.id, "public")
  if (!post) throw new Error("创建后的帖子不可见")
  return { kind: "created" as const, post }
}

export type SoftDeletePostResult = "deleted" | "already-deleted" | "not-found" | "forbidden"

export async function softDeletePost(id: bigint, input: {
  userId?: bigint
  operatorId?: number
  operatorRole?: number
  reason?: string
  requestId?: string
}): Promise<SoftDeletePostResult> {
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(posts).where(eq(posts.id, id)).for("update").limit(1)
    if (!current) return "not-found"
    if (input.userId && current.user_id !== input.userId) return "forbidden"
    if (current.deleted_at) return "already-deleted"
    const deletedAt = new Date().toISOString()
    await transaction.update(posts).set({ status: 0, deleted_at: deletedAt, updated_at: deletedAt }).where(eq(posts.id, id))
    if (input.operatorId !== undefined && input.operatorRole !== undefined && input.reason && input.requestId) {
      await transaction.insert(auditLogs).values({
        operatorId: input.operatorId,
        operatorRole: input.operatorRole,
        action: "post.delete",
        resourceType: "post",
        resourceId: id,
        reason: input.reason,
        requestId: input.requestId,
      })
    }
    return "deleted"
  })
}

export async function updatePostStatus(id: bigint, status: 0 | 1, audit: {
  operatorId: number
  operatorRole: number
  reason: string
  requestId: string
}): Promise<"updated" | "unchanged" | "not-found"> {
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(posts).where(eq(posts.id, id)).for("update").limit(1)
    if (!current || current.deleted_at) return "not-found"
    if (current.status === status) return "unchanged"
    const updatedAt = new Date().toISOString()
    await transaction.update(posts).set({ status, updated_at: updatedAt }).where(eq(posts.id, id))
    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "post.status.update",
      resourceType: "post",
      resourceId: id,
      reason: audit.reason,
      requestId: audit.requestId,
    })
    return "updated"
  })
}

export async function listComments(params: {
  page: number
  pageSize: number
  audience: "public" | "admin"
  postId?: bigint
  userId?: bigint
  status?: AdminContentStatus
}): Promise<{ items: ReturnType<typeof commentView>[]; total: number }> {
  const filters: SQL[] = []
  if (params.postId) filters.push(eq(comments.post_id, params.postId))
  if (params.userId) filters.push(eq(comments.user_id, params.userId))
  if (params.audience === "public") {
    filters.push(eq(comments.status, 1), isNull(comments.deleted_at), eq(posts.status, 1), isNull(posts.deleted_at), eq(circles.status, 1), isNull(circles.deleted_at), eq(miniappUsers.status, 1))
  } else if (params.status === "deleted") {
    filters.push(isNotNull(comments.deleted_at))
  } else {
    filters.push(isNull(comments.deleted_at))
    if (params.status) filters.push(eq(comments.status, params.status === "published" ? 1 : 0))
  }
  const where = and(...filters)
  const offset = (params.page - 1) * params.pageSize
  const query = database.select({
    comment: comments,
    author: { id: miniappUsers.id, nickname: miniappUsers.nickname, avatarUrl: miniappUsers.avatar_url },
    post: { id: posts.id, content: posts.content, circleName: circles.name },
  }).from(comments)
    .innerJoin(miniappUsers, eq(comments.user_id, miniappUsers.id))
    .innerJoin(posts, eq(comments.post_id, posts.id))
    .innerJoin(circles, eq(posts.circle_id, circles.id))
  const [rows, totalResult] = await Promise.all([
    query.where(where).orderBy(desc(comments.created_at), desc(comments.id)).limit(params.pageSize).offset(offset),
    database.select({ value: count() }).from(comments)
      .innerJoin(miniappUsers, eq(comments.user_id, miniappUsers.id))
      .innerJoin(posts, eq(comments.post_id, posts.id))
      .innerJoin(circles, eq(posts.circle_id, circles.id))
      .where(where),
  ])
  return { items: rows.map(commentView), total: totalResult[0]?.value ?? 0 }
}

export async function findComment(id: bigint, audience: "public" | "admin") {
  const filters: SQL[] = [eq(comments.id, id)]
  if (audience === "public") {
    filters.push(eq(comments.status, 1), isNull(comments.deleted_at), eq(posts.status, 1), isNull(posts.deleted_at), eq(circles.status, 1), isNull(circles.deleted_at), eq(miniappUsers.status, 1))
  }
  const rows = await database.select({
    comment: comments,
    author: { id: miniappUsers.id, nickname: miniappUsers.nickname, avatarUrl: miniappUsers.avatar_url },
    post: { id: posts.id, content: posts.content, circleName: circles.name },
  }).from(comments)
    .innerJoin(miniappUsers, eq(comments.user_id, miniappUsers.id))
    .innerJoin(posts, eq(comments.post_id, posts.id))
    .innerJoin(circles, eq(posts.circle_id, circles.id))
    .where(and(...filters))
    .limit(1)
  return rows[0] ? commentView(rows[0]) : null
}

export async function createComment(postId: bigint, userId: bigint, content: string) {
  const [post] = await database.select({ id: posts.id }).from(posts)
    .innerJoin(circles, eq(posts.circle_id, circles.id))
    .where(and(eq(posts.id, postId), eq(posts.status, 1), isNull(posts.deleted_at), eq(circles.status, 1), isNull(circles.deleted_at))).limit(1)
  if (!post) return null
  const [created] = await database.insert(comments).values({ post_id: postId, user_id: userId, content }).returning({ id: comments.id })
  return created ? findComment(created.id, "public") : null
}

export type SoftDeleteCommentResult = "deleted" | "already-deleted" | "not-found" | "forbidden"

export async function softDeleteComment(id: bigint, input: {
  userId?: bigint
  operatorId?: number
  operatorRole?: number
  reason?: string
  requestId?: string
}): Promise<SoftDeleteCommentResult> {
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(comments).where(eq(comments.id, id)).for("update").limit(1)
    if (!current) return "not-found"
    if (input.userId && current.user_id !== input.userId) return "forbidden"
    if (current.deleted_at) return "already-deleted"
    const deletedAt = new Date().toISOString()
    await transaction.update(comments).set({ status: 0, deleted_at: deletedAt, updated_at: deletedAt }).where(eq(comments.id, id))
    if (input.operatorId !== undefined && input.operatorRole !== undefined && input.reason && input.requestId) {
      await transaction.insert(auditLogs).values({
        operatorId: input.operatorId,
        operatorRole: input.operatorRole,
        action: "comment.delete",
        resourceType: "comment",
        resourceId: id,
        reason: input.reason,
        requestId: input.requestId,
      })
    }
    return "deleted"
  })
}

export async function updateCommentStatus(id: bigint, status: 0 | 1, audit: {
  operatorId: number
  operatorRole: number
  reason: string
  requestId: string
}): Promise<"updated" | "unchanged" | "not-found"> {
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(comments).where(eq(comments.id, id)).for("update").limit(1)
    if (!current || current.deleted_at) return "not-found"
    if (current.status === status) return "unchanged"
    const updatedAt = new Date().toISOString()
    await transaction.update(comments).set({ status, updated_at: updatedAt }).where(eq(comments.id, id))
    await transaction.insert(auditLogs).values({
      operatorId: audit.operatorId,
      operatorRole: audit.operatorRole,
      action: "comment.status.update",
      resourceType: "comment",
      resourceId: id,
      reason: audit.reason,
      requestId: audit.requestId,
    })
    return "updated"
  })
}

export async function addPostLike(postId: bigint, userId: bigint): Promise<"liked" | "not-found"> {
  const [post] = await database.select({ id: posts.id }).from(posts)
    .innerJoin(miniappUsers, eq(posts.user_id, miniappUsers.id))
    .innerJoin(circles, eq(posts.circle_id, circles.id))
    .where(and(eq(posts.id, postId), eq(posts.status, 1), isNull(posts.deleted_at), eq(miniappUsers.status, 1), eq(circles.status, 1), isNull(circles.deleted_at))).limit(1)
  if (!post) return "not-found"
  await database.insert(postLikes).values({ post_id: postId, user_id: userId }).onConflictDoNothing({ target: [postLikes.post_id, postLikes.user_id] })
  return "liked"
}

export async function removePostLike(postId: bigint, userId: bigint): Promise<"unliked" | "not-found"> {
  const post = await findPost(postId, "public")
  if (!post) return "not-found"
  await database.delete(postLikes).where(and(eq(postLikes.post_id, postId), eq(postLikes.user_id, userId)))
  return "unliked"
}

export async function countPostLikes(postId: bigint): Promise<number> {
  const [result] = await database.select({ value: count() }).from(postLikes).where(eq(postLikes.post_id, postId))
  return result?.value ?? 0
}
