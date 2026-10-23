import { and, count, desc, eq, isNull, sql } from "drizzle-orm"
import { database } from "./database.js"
import { miniappUserFollows, miniappUsers, postLikes, posts } from "./schema.js"
import type { MiniappGender } from "./types.js"

export const MINIAPP_PROFILE_PAGE_SIZE = 10
export const MINIAPP_NICKNAME_CHANGE_LIMIT = 3
export const MINIAPP_NICKNAME_CHANGE_WINDOW_DAYS = 30
const NICKNAME_CHANGE_WINDOW_MS = MINIAPP_NICKNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000

function nicknameChangeState(user: typeof miniappUsers.$inferSelect) {
  const windowStartedAt = user.nickname_change_window_started_at
  if (!windowStartedAt) return { remaining: MINIAPP_NICKNAME_CHANGE_LIMIT, resetAt: null }
  const resetAt = new Date(new Date(windowStartedAt).getTime() + NICKNAME_CHANGE_WINDOW_MS)
  if (resetAt.getTime() <= Date.now()) return { remaining: MINIAPP_NICKNAME_CHANGE_LIMIT, resetAt: null }
  return {
    remaining: Math.max(0, MINIAPP_NICKNAME_CHANGE_LIMIT - user.nickname_change_count),
    resetAt: resetAt.toISOString(),
  }
}

function profileView(user: typeof miniappUsers.$inferSelect, stats: {
  followingCount: number
  followerCount: number
  receivedLikeCount: number
}, viewerUserId: bigint, isFollowing: boolean) {
  const isSelf = user.id === viewerUserId
  return {
    id: user.id.toString(),
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    gender: user.gender === 1
      ? "male" as const
      : user.gender === 2
        ? "female" as const
        : isSelf ? "private" as const : null,
    status: "active" as const,
    createdAt: user.created_at,
    stats,
    isSelf,
    isFollowing,
    nicknameChange: isSelf ? nicknameChangeState(user) : undefined,
  }
}

async function findActiveUser(id: bigint) {
  const [user] = await database.select().from(miniappUsers)
    .where(and(eq(miniappUsers.id, id), eq(miniappUsers.status, 1)))
    .limit(1)
  return user ?? null
}

async function countFollowers(userId: bigint): Promise<number> {
  const [result] = await database.select({ value: count() }).from(miniappUserFollows)
    .where(and(eq(miniappUserFollows.following_user_id, userId), eq(miniappUserFollows.status, 1)))
  return result?.value ?? 0
}

export async function getMiniappProfile(userId: bigint, viewerUserId: bigint) {
  const user = await findActiveUser(userId)
  if (!user) return null

  const [followingResult, followerResult, receivedLikeResult, relation] = await Promise.all([
    database.select({ value: count() }).from(miniappUserFollows)
      .where(and(eq(miniappUserFollows.follower_user_id, userId), eq(miniappUserFollows.status, 1))),
    database.select({ value: count() }).from(miniappUserFollows)
      .where(and(eq(miniappUserFollows.following_user_id, userId), eq(miniappUserFollows.status, 1))),
    database.select({ value: count() }).from(postLikes)
      .innerJoin(posts, eq(postLikes.post_id, posts.id))
      .where(and(eq(posts.user_id, userId), eq(posts.status, 1), isNull(posts.deleted_at))),
    userId === viewerUserId
      ? Promise.resolve([])
      : database.select({ id: miniappUserFollows.id }).from(miniappUserFollows)
          .where(and(
            eq(miniappUserFollows.follower_user_id, viewerUserId),
            eq(miniappUserFollows.following_user_id, userId),
            eq(miniappUserFollows.status, 1),
          )).limit(1),
  ])

  return profileView(user, {
    followingCount: followingResult[0]?.value ?? 0,
    followerCount: followerResult[0]?.value ?? 0,
    receivedLikeCount: receivedLikeResult[0]?.value ?? 0,
  }, viewerUserId, relation.length > 0)
}

export async function updateMiniappProfile(userId: bigint, values: {
  nickname?: string
  bio?: string | null
  gender?: MiniappGender
}) {
  const result = await database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(miniappUsers)
      .where(and(eq(miniappUsers.id, userId), eq(miniappUsers.status, 1)))
      .for("update")
      .limit(1)
    if (!current) return { kind: "not-found" as const }

    const nicknameChanged = values.nickname !== undefined && values.nickname !== current.nickname
    let windowStartedAt = current.nickname_change_window_started_at
    let changeCount = current.nickname_change_count
    if (nicknameChanged) {
      const windowExpired = !windowStartedAt
        || new Date(windowStartedAt).getTime() + NICKNAME_CHANGE_WINDOW_MS <= Date.now()
      if (windowExpired) {
        windowStartedAt = new Date().toISOString()
        changeCount = 0
      }
      if (changeCount >= MINIAPP_NICKNAME_CHANGE_LIMIT) {
        const retryAt = new Date(new Date(windowStartedAt!).getTime() + NICKNAME_CHANGE_WINDOW_MS).toISOString()
        return { kind: "rate-limited" as const, retryAt }
      }
      changeCount += 1
    }

    await transaction.update(miniappUsers).set({
      ...values,
      nickname_change_window_started_at: windowStartedAt,
      nickname_change_count: changeCount,
      updated_at: new Date().toISOString(),
    }).where(eq(miniappUsers.id, userId))
    return { kind: "updated" as const }
  })
  if (result.kind !== "updated") return result
  const profile = await getMiniappProfile(userId, userId)
  return profile ? { kind: "updated" as const, profile } : { kind: "not-found" as const }
}

export async function followMiniappUser(followerUserId: bigint, followingUserId: bigint) {
  if (followerUserId === followingUserId) return { kind: "self-follow" as const }
  if (!await findActiveUser(followingUserId)) return { kind: "not-found" as const }
  const now = new Date().toISOString()
  await database.insert(miniappUserFollows).values({
    follower_user_id: followerUserId,
    following_user_id: followingUserId,
    status: 1,
    followed_at: now,
    updated_at: now,
  }).onConflictDoUpdate({
    target: [miniappUserFollows.follower_user_id, miniappUserFollows.following_user_id],
    set: { status: 1, followed_at: now, updated_at: now },
  })
  return { kind: "followed" as const, followerCount: await countFollowers(followingUserId) }
}

export async function unfollowMiniappUser(followerUserId: bigint, followingUserId: bigint) {
  if (followerUserId === followingUserId) return { kind: "self-follow" as const }
  if (!await findActiveUser(followingUserId)) return { kind: "not-found" as const }
  await database.update(miniappUserFollows).set({ status: 0, updated_at: new Date().toISOString() })
    .where(and(
      eq(miniappUserFollows.follower_user_id, followerUserId),
      eq(miniappUserFollows.following_user_id, followingUserId),
      eq(miniappUserFollows.status, 1),
    ))
  return { kind: "unfollowed" as const, followerCount: await countFollowers(followingUserId) }
}

export async function listMiniappUserConnections(input: {
  userId: bigint
  kind: "followers" | "following"
  page: number
  pageSize: number
}) {
  if (!await findActiveUser(input.userId)) return null
  const relationFilter = input.kind === "followers"
    ? eq(miniappUserFollows.following_user_id, input.userId)
    : eq(miniappUserFollows.follower_user_id, input.userId)
  const userJoin = input.kind === "followers"
    ? eq(miniappUsers.id, miniappUserFollows.follower_user_id)
    : eq(miniappUsers.id, miniappUserFollows.following_user_id)
  const where = and(relationFilter, eq(miniappUserFollows.status, 1), eq(miniappUsers.status, 1))
  const offset = (input.page - 1) * input.pageSize

  const [rows, totalResult] = await Promise.all([
    database.select({
      id: miniappUsers.id,
      nickname: miniappUsers.nickname,
      avatarUrl: miniappUsers.avatar_url,
      bio: miniappUsers.bio,
      followedAt: miniappUserFollows.followed_at,
    }).from(miniappUserFollows)
      .innerJoin(miniappUsers, userJoin)
      .where(where)
      .orderBy(desc(miniappUserFollows.followed_at), desc(miniappUserFollows.id))
      .limit(input.pageSize)
      .offset(offset),
    database.select({ value: sql<number>`count(*)::int` }).from(miniappUserFollows)
      .innerJoin(miniappUsers, userJoin)
      .where(where),
  ])

  return {
    items: rows.map((row) => ({ ...row, id: row.id.toString() })),
    total: totalResult[0]?.value ?? 0,
  }
}
