import { sql } from "drizzle-orm"
import { bigint, check, date, foreignKey, index, integer, jsonb, pgTable, serial, smallint, text, timestamp, uniqueIndex, uuid, varchar, type AnyPgColumn } from "drizzle-orm/pg-core"
import { binaryStatusColumn, nullableDeletedAtColumn, stateColumn, timestampColumns } from "./schema-fields.js"
import type { CircleMemberStatus, CircleStatus, CommentStatus, ContentType, MediaType, MiniappGender, MiniappUserFollowStatus, MiniappUserStatus, UserGender, UserRole, UserStatus } from "./types.js"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  gender: smallint("gender").$type<UserGender>().notNull().default(0),
  role: smallint("role").$type<UserRole>().notNull().default(0),
  status: binaryStatusColumn<UserStatus>(),
  token_version: integer("token_version").notNull().default(0),
  last_login_at: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("uk_users_username").on(table.username),
  uniqueIndex("uk_users_phone").on(table.phone),
  uniqueIndex("uk_users_email").on(table.email),
  check("ck_users_gender", sql`${table.gender} IN (0, 1, 2)`),
  check("ck_users_role", sql`${table.role} IN (0, 1)`),
  check("ck_users_status", sql`${table.status} IN (0, 1)`),
  index("idx_users_status").on(table.status),
  index("idx_users_role_status").on(table.role, table.status),
])

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  operatorRole: smallint("operator_role").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: bigint("resource_id", { mode: "bigint" }).notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  requestId: varchar("request_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_operator_created").on(table.operatorId, table.createdAt),
])

export const miniappUsers = pgTable("miniapp_users", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  wx_openid: varchar("wx_openid", { length: 64 }).notNull(),
  wx_unionid: varchar("wx_unionid", { length: 64 }),
  nickname: varchar("nickname", { length: 50 }).notNull().default("微信用户"),
  avatar_url: varchar("avatar_url", { length: 500 }),
  bio: varchar("bio", { length: 100 }),
  gender: smallint("gender").$type<MiniappGender>().notNull().default(0),
  nickname_change_window_started_at: timestamp("nickname_change_window_started_at", { withTimezone: true, mode: "string" }),
  nickname_change_count: smallint("nickname_change_count").notNull().default(0),
  status: binaryStatusColumn<MiniappUserStatus>(),
  token_version: integer("token_version").notNull().default(0),
  last_login_at: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("uk_miniapp_users_wx_openid").on(table.wx_openid),
  uniqueIndex("uk_miniapp_users_wx_unionid").on(table.wx_unionid),
  check("ck_miniapp_users_nickname_not_blank", sql`char_length(btrim(${table.nickname})) BETWEEN 2 AND 20`),
  check("ck_miniapp_users_bio_not_blank", sql`${table.bio} IS NULL OR char_length(btrim(${table.bio})) BETWEEN 1 AND 100`),
  check("ck_miniapp_users_gender", sql`${table.gender} IN (0, 1, 2)`),
  check("ck_miniapp_users_nickname_change_count", sql`${table.nickname_change_count} BETWEEN 0 AND 3`),
  check("ck_miniapp_users_status", sql`${table.status} IN (0, 1)`),
  index("idx_miniapp_users_status_created").on(table.status, table.created_at, table.id),
  index("idx_miniapp_users_created").on(table.created_at, table.id),
])

export const miniappUserFollows = pgTable("miniapp_user_follows", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  follower_user_id: bigint("follower_user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  following_user_id: bigint("following_user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  status: binaryStatusColumn<MiniappUserFollowStatus>(),
  followed_at: timestamp("followed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_miniapp_user_follows_pair").on(table.follower_user_id, table.following_user_id),
  check("ck_miniapp_user_follows_not_self", sql`${table.follower_user_id} <> ${table.following_user_id}`),
  check("ck_miniapp_user_follows_status", sql`${table.status} IN (0, 1)`),
  index("idx_miniapp_user_follows_follower_status_followed").on(table.follower_user_id, table.status, table.followed_at.desc(), table.id.desc()),
  index("idx_miniapp_user_follows_following_status_followed").on(table.following_user_id, table.status, table.followed_at.desc(), table.id.desc()),
])

export const circles = pgTable("circles", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 50 }).notNull(),
  description: varchar("description", { length: 500 }),
  cover_url: varchar("cover_url", { length: 500 }),
  status: binaryStatusColumn<CircleStatus>(),
  ...timestampColumns(),
  deleted_at: nullableDeletedAtColumn(),
}, (table) => [
  check("ck_circles_name_not_blank", sql`char_length(btrim(${table.name})) BETWEEN 1 AND 50`),
  check("ck_circles_status", sql`${table.status} IN (0, 1)`),
  index("idx_circles_status_created")
    .on(table.status, table.created_at.desc(), table.id.desc())
    .where(sql`${table.deleted_at} IS NULL`),
])

export const circleMembers = pgTable("circle_members", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  circle_id: bigint("circle_id", { mode: "bigint" }).notNull().references(() => circles.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  status: binaryStatusColumn<CircleMemberStatus>(),
  joined_at: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_circle_members_circle_user").on(table.circle_id, table.user_id),
  check("ck_circle_members_status", sql`${table.status} IN (0, 1)`),
  index("idx_circle_members_circle_status_joined").on(table.circle_id, table.status, table.joined_at.desc(), table.id.desc()),
  index("idx_circle_members_user_status_joined").on(table.user_id, table.status, table.joined_at.desc(), table.id.desc()),
])

export const categories = pgTable("categories", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 50 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  status: binaryStatusColumn<0 | 1>(),
  ...timestampColumns(),
  deleted_at: nullableDeletedAtColumn(),
}, (table) => [
  check("ck_categories_name_not_blank", sql`char_length(btrim(${table.name})) BETWEEN 1 AND 50`),
  check("ck_categories_code_format", sql`${table.code} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("ck_categories_sort_order", sql`${table.sortOrder} >= 0`),
  check("ck_categories_status", sql`${table.status} IN (0, 1)`),
  uniqueIndex("uk_categories_code").on(table.code),
  uniqueIndex("uk_categories_name_live").on(table.name).where(sql`${table.deleted_at} IS NULL`),
  index("idx_categories_live_sort").on(table.status, table.sortOrder, table.id).where(sql`${table.deleted_at} IS NULL`),
])

export const posts = pgTable("posts", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  circle_id: bigint("circle_id", { mode: "bigint" }).notNull().references(() => circles.id, { onDelete: "restrict" }),
  category_id: bigint("category_id", { mode: "bigint" }).notNull().references(() => categories.id, { onDelete: "restrict" }),
  content_type: varchar("content_type", { length: 20 }).$type<ContentType>().notNull(),
  content: text("content").notNull(),
  view_count: integer("view_count").notNull().default(0),
  status: binaryStatusColumn<0 | 1>(),
  ...timestampColumns(),
  deleted_at: nullableDeletedAtColumn(),
}, (table) => [
  check("ck_posts_content_type", sql`${table.content_type} IN ('TEXT', 'IMAGE_TEXT', 'VIDEO')`),
  check("ck_posts_content_not_blank", sql`char_length(btrim(${table.content})) > 0`),
  check("ck_posts_view_count", sql`${table.view_count} >= 0`),
  check("ck_posts_status", sql`${table.status} IN (0, 1)`),
  index("idx_posts_circle_created").on(table.circle_id, table.created_at.desc(), table.id.desc()),
  index("idx_posts_category_created").on(table.category_id, table.created_at.desc(), table.id.desc()),
  index("idx_posts_user_created").on(table.user_id, table.created_at.desc(), table.id.desc()),
  index("idx_posts_live_status_created").on(table.status, table.created_at.desc(), table.id.desc()).where(sql`${table.deleted_at} IS NULL`),
])

export const postMedia = pgTable("post_media", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references(() => posts.id, { onDelete: "restrict" }),
  media_type: varchar("media_type", { length: 10 }).$type<MediaType>().notNull(),
  media_url: varchar("media_url", { length: 1000 }).notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  check("ck_post_media_type", sql`${table.media_type} IN ('IMAGE', 'VIDEO')`),
  check("ck_post_media_sort_order", sql`${table.sort_order} >= 0`),
  index("idx_post_media_post_sort").on(table.post_id, table.sort_order, table.id),
])

export const postLikes = pgTable("post_likes", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references(() => posts.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_post_likes_post_user").on(table.post_id, table.user_id),
  index("idx_post_likes_user_created").on(table.user_id, table.created_at.desc(), table.id.desc()),
])

export const comments = pgTable("comments", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references(() => posts.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references(() => miniappUsers.id, { onDelete: "restrict" }),
  content: varchar("content", { length: 2000 }).notNull(),
  status: binaryStatusColumn<CommentStatus>(),
  ...timestampColumns(),
  deleted_at: nullableDeletedAtColumn(),
}, (table) => [
  check("ck_comments_content_not_blank", sql`char_length(btrim(${table.content})) BETWEEN 1 AND 2000`),
  check("ck_comments_status", sql`${table.status} IN (0, 1)`),
  index("idx_comments_post_created").on(table.post_id, table.created_at, table.id),
  index("idx_comments_user_created").on(table.user_id, table.created_at.desc(), table.id.desc()),
  index("idx_comments_live_status_created").on(table.status, table.created_at.desc(), table.id.desc()).where(sql`${table.deleted_at} IS NULL`),
])

// Treehole persistent schema; SQL migration 009 carries the same constraints.

export const treeholePosts = pgTable("treehole_posts", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  content: text("content"),
  moderation_status: stateColumn("moderation_status", 0).notNull(),
  review_version: integer("review_version").notNull().default(0),
  submitted_at: timestamp("submitted_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  content_fingerprint: varchar("content_fingerprint", { length: 64 }).notNull(),
  dedupe_window_started_at: timestamp("dedupe_window_started_at", { withTimezone: true, mode: "string" }).notNull(),
  published_at: timestamp("published_at", { withTimezone: true, mode: "string" }),
  client_request_id: uuid("client_request_id").notNull(),
  request_hash: varchar("request_hash", { length: 64 }).notNull(),
  deleted_at: nullableDeletedAtColumn(),
  purged_at: timestamp("purged_at", { withTimezone: true, mode: "string" }),
  ttl_hours: stateColumn("ttl_hours", 24).notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_posts_1", sql.raw('(purged_at IS NOT NULL AND content IS NULL) OR (purged_at IS NULL AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 1000)')),
  check("ck_treehole_posts_2", sql.raw('moderation_status IN (0,1,2,3)')),
  check("ck_treehole_posts_3", sql.raw('review_version >= 0')),
  check("ck_treehole_posts_4", sql.raw("dedupe_window_started_at <= submitted_at AND submitted_at < dedupe_window_started_at + interval '24 hours'")),
  check("ck_treehole_posts_5", sql.raw('ttl_hours IN (1,6,12,24)')),
  check("ck_treehole_posts_6", sql.raw("(published_at IS NULL AND expires_at IS NULL) OR (published_at IS NOT NULL AND expires_at = published_at + ttl_hours * interval '1 hour')")),
  uniqueIndex("uk_treehole_posts_request").on(t.user_id, t.client_request_id),
  index("idx_treehole_posts_mine").on(t.user_id, t.submitted_at.desc(), t.id.desc()),
  index("idx_treehole_posts_pending").on(t.submitted_at, t.id).where(sql.raw('moderation_status=0 AND published_at IS NULL')),
  index("idx_treehole_posts_dedupe").on(t.user_id, t.content_fingerprint, t.dedupe_window_started_at.desc()),
  index("idx_treehole_posts_public").on(t.published_at.desc(), t.id.desc()).where(sql.raw('moderation_status=1 AND deleted_at IS NULL AND published_at IS NOT NULL')),
  index("idx_treehole_posts_expiry").on(t.expires_at, t.id),
])

export const treeholeComments = pgTable("treehole_comments", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  reply_to_comment_id: bigint("reply_to_comment_id", { mode: "bigint" }),
  content: text("content"),
  moderation_status: stateColumn("moderation_status", 0).notNull(),
  review_version: integer("review_version").notNull().default(0),
  submitted_at: timestamp("submitted_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  content_fingerprint: varchar("content_fingerprint", { length: 64 }).notNull(),
  dedupe_window_started_at: timestamp("dedupe_window_started_at", { withTimezone: true, mode: "string" }).notNull(),
  published_at: timestamp("published_at", { withTimezone: true, mode: "string" }),
  client_request_id: uuid("client_request_id").notNull(),
  request_hash: varchar("request_hash", { length: 64 }).notNull(),
  deleted_at: nullableDeletedAtColumn(),
  purged_at: timestamp("purged_at", { withTimezone: true, mode: "string" }),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_comments_1", sql.raw('(purged_at IS NOT NULL AND content IS NULL) OR (purged_at IS NULL AND content IS NOT NULL AND char_length(btrim(content)) BETWEEN 1 AND 500)')),
  check("ck_treehole_comments_2", sql.raw('moderation_status IN (0,1,2,3)')),
  check("ck_treehole_comments_3", sql.raw('review_version >= 0')),
  check("ck_treehole_comments_4", sql.raw("dedupe_window_started_at <= submitted_at AND submitted_at < dedupe_window_started_at + interval '24 hours'")),
  check("ck_treehole_comments_5", sql.raw('reply_to_comment_id IS NULL OR reply_to_comment_id <> id')),
  foreignKey({name: "fk_treehole_comments_reply",columns: [t.reply_to_comment_id, t.post_id],foreignColumns: [t.id, t.post_id]}).onDelete("restrict"),
  uniqueIndex("uk_treehole_comments_request").on(t.user_id, t.client_request_id),
  index("idx_treehole_comments_mine").on(t.user_id, t.submitted_at.desc(), t.id.desc()),
  index("idx_treehole_comments_pending").on(t.submitted_at, t.id).where(sql.raw('moderation_status=0 AND published_at IS NULL')),
  index("idx_treehole_comments_dedupe").on(t.user_id, t.content_fingerprint, t.dedupe_window_started_at.desc()),
  uniqueIndex("uk_treehole_comments_id_post").on(t.id, t.post_id),
  index("idx_treehole_comments_post").on(t.post_id, t.published_at, t.id),
])

export const treeholeParticipants = pgTable("treehole_participants", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  nickname: varchar("nickname", { length: 50 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uk_treehole_participants_user").on(t.post_id, t.user_id),
  uniqueIndex("uk_treehole_participants_nickname").on(t.post_id, t.nickname),
])

export const treeholePostLikes = pgTable("treehole_post_likes", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uk_treehole_post_likes_user").on(t.post_id, t.user_id),
])

export const treeholeReviews = pgTable("treehole_reviews", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  post_id: bigint("post_id", { mode: "bigint" }).references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  comment_id: bigint("comment_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeComments.id, { onDelete: "restrict" }),
  previous_review_id: bigint("previous_review_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeReviews.id, { onDelete: "restrict" }),
  target_review_version: integer("target_review_version").notNull(),
  source: stateColumn("source").notNull(),
  reviewer_type: stateColumn("reviewer_type").notNull(),
  status: stateColumn("status", 0).notNull(),
  decision: stateColumn("decision"),
  rule_version: varchar("rule_version", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }),
  violation_code: varchar("violation_code", { length: 50 }),
  points: stateColumn("points"),
  counted_violation_id: bigint("counted_violation_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeViolations.id, { onDelete: "restrict" }),
  reason: text("reason"),
  evidence_quotes: jsonb("evidence_quotes"),
  content_snapshot: text("content_snapshot"),
  context_snapshot: jsonb("context_snapshot"),
  dedupe_key: varchar("dedupe_key", { length: 100 }).notNull(),
  attempt_count: integer("attempt_count").notNull().default(0),
  budget_day: date("budget_day"),
  budget_attempts: integer("budget_attempts").notNull().default(0),
  next_attempt_at: timestamp("next_attempt_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  locked_until: timestamp("locked_until", { withTimezone: true, mode: "string" }),
  lease_token: uuid("lease_token"),
  operator_id: integer("operator_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
  completed_at: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  purge_after: timestamp("purge_after", { withTimezone: true, mode: "string" }),
  purged_at: timestamp("purged_at", { withTimezone: true, mode: "string" }),
  decision_request_id: uuid("decision_request_id"),
  decision_request_hash: varchar("decision_request_hash", { length: 64 }),
  decision_result: jsonb("decision_result"),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_reviews_1", sql.raw('(post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1')),
  check("ck_treehole_reviews_2", sql.raw('target_review_version > 0')),
  check("ck_treehole_reviews_3", sql.raw('source IN (0,1,2,3,4)')),
  check("ck_treehole_reviews_4", sql.raw('reviewer_type IN (0,1,2)')),
  check("ck_treehole_reviews_5", sql.raw('status IN (0,1,2,3)')),
  check("ck_treehole_reviews_6", sql.raw('decision IS NULL OR decision IN (0,1,2)')),
  check("ck_treehole_reviews_7", sql.raw('points IS NULL OR points BETWEEN 1 AND 20')),
  check("ck_treehole_reviews_8", sql.raw('attempt_count >= 0')),
  check("ck_treehole_reviews_budget", sql.raw('budget_attempts >= 0')),
  check("ck_treehole_reviews_9", sql.raw('(decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)')),
  check("ck_treehole_reviews_10", sql.raw('(locked_until IS NULL) = (lease_token IS NULL)')),
  uniqueIndex("uk_treehole_reviews_dedupe").on(t.dedupe_key),
  uniqueIndex("uk_treehole_reviews_post_version").on(t.post_id, t.target_review_version).where(sql.raw('post_id IS NOT NULL')),
  uniqueIndex("uk_treehole_reviews_comment_version").on(t.comment_id, t.target_review_version).where(sql.raw('comment_id IS NOT NULL')),
  index("idx_treehole_reviews_queue").on(t.reviewer_type, t.status, t.next_attempt_at, t.id),
  index("idx_treehole_reviews_post").on(t.post_id, t.created_at, t.id).where(sql.raw('post_id IS NOT NULL')),
  index("idx_treehole_reviews_comment").on(t.comment_id, t.created_at, t.id).where(sql.raw('comment_id IS NOT NULL')),
  index("idx_treehole_reviews_purge").on(t.purge_after),
])

export const treeholeReports = pgTable("treehole_reports", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  reporter_user_id: bigint("reporter_user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  post_id: bigint("post_id", { mode: "bigint" }).references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  comment_id: bigint("comment_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeComments.id, { onDelete: "restrict" }),
  reason: stateColumn("reason").notNull(),
  description: varchar("description", { length: 500 }),
  status: stateColumn("status", 0).notNull(),
  review_id: bigint("review_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeReviews.id, { onDelete: "restrict" }),
  decision_reason: varchar("decision_reason", { length: 1000 }),
  operator_id: integer("operator_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
  resolved_at: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  decision_request_id: uuid("decision_request_id"),
  decision_request_hash: varchar("decision_request_hash", { length: 64 }),
  decision_result: jsonb("decision_result"),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_reports_1", sql.raw('(post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1')),
  check("ck_treehole_reports_2", sql.raw('reason IN (0,1,2,3,4,5)')),
  check("ck_treehole_reports_3", sql.raw('status IN (0,1,2)')),
  check("ck_treehole_reports_4", sql.raw('(decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)')),
  uniqueIndex("uk_treehole_reports_post").on(t.reporter_user_id, t.post_id).where(sql.raw('post_id IS NOT NULL')),
  uniqueIndex("uk_treehole_reports_comment").on(t.reporter_user_id, t.comment_id).where(sql.raw('comment_id IS NOT NULL')),
  index("idx_treehole_reports_queue").on(t.status, t.created_at, t.id),
])

export const treeholeViolations = pgTable("treehole_violations", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  post_id: bigint("post_id", { mode: "bigint" }).references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  comment_id: bigint("comment_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeComments.id, { onDelete: "restrict" }),
  review_id: bigint("review_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholeReviews.id, { onDelete: "restrict" }),
  violation_code: varchar("violation_code", { length: 50 }).notNull(),
  points: stateColumn("points").notNull(),
  rule_version: varchar("rule_version", { length: 50 }).notNull(),
  dedupe_fingerprint: varchar("dedupe_fingerprint", { length: 64 }).notNull(),
  dedupe_window_started_at: timestamp("dedupe_window_started_at", { withTimezone: true, mode: "string" }).notNull(),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  revoked_at: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  revoke_reason: varchar("revoke_reason", { length: 1000 }),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_violations_1", sql.raw('(post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1')),
  check("ck_treehole_violations_2", sql.raw('points BETWEEN 1 AND 20')),
  uniqueIndex("uk_treehole_violations_post").on(t.post_id).where(sql.raw('post_id IS NOT NULL')),
  uniqueIndex("uk_treehole_violations_comment").on(t.comment_id).where(sql.raw('comment_id IS NOT NULL')),
  uniqueIndex("uk_treehole_violations_batch").on(t.user_id, t.dedupe_fingerprint, t.dedupe_window_started_at),
  index("idx_treehole_violations_score").on(t.user_id, t.confirmed_at, t.id).where(sql.raw('revoked_at IS NULL')),
])

export const treeholePenalties = pgTable("treehole_penalties", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  trigger_violation_id: bigint("trigger_violation_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeViolations.id, { onDelete: "restrict" }),
  review_id: bigint("review_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeReviews.id, { onDelete: "restrict" }),
  tier: stateColumn("tier").notNull(),
  status: stateColumn("status").notNull(),
  basis: stateColumn("basis").notNull(),
  score_snapshot: integer("score_snapshot").notNull(),
  rule_version: varchar("rule_version", { length: 50 }).notNull(),
  reason: varchar("reason", { length: 1000 }).notNull(),
  starts_at: timestamp("starts_at", { withTimezone: true, mode: "string" }),
  ends_at: timestamp("ends_at", { withTimezone: true, mode: "string" }),
  notified_at: timestamp("notified_at", { withTimezone: true, mode: "string" }),
  operator_id: integer("operator_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
  supersedes_penalty_id: bigint("supersedes_penalty_id", { mode: "bigint" }).references((): AnyPgColumn => treeholePenalties.id, { onDelete: "restrict" }),
  revoked_at: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  revoke_reason: varchar("revoke_reason", { length: 1000 }),
  revoke_operator_id: integer("revoke_operator_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
  decision_request_id: uuid("decision_request_id"),
  decision_request_hash: varchar("decision_request_hash", { length: 64 }),
  decision_result: jsonb("decision_result"),
  revoke_request_id: uuid("revoke_request_id"),
  revoke_request_hash: varchar("revoke_request_hash", { length: 64 }),
  revoke_result: jsonb("revoke_result"),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_penalties_1", sql.raw('tier BETWEEN 0 AND 5')),
  check("ck_treehole_penalties_2", sql.raw('status IN (0,1,2,3,4,5)')),
  check("ck_treehole_penalties_3", sql.raw('basis IN (0,1,2)')),
  check("ck_treehole_penalties_4", sql.raw('score_snapshot >= 0')),
  check("ck_treehole_penalties_5", sql.raw('(status IN (0,5) AND starts_at IS NULL AND ends_at IS NULL AND notified_at IS NULL) OR (status IN (1,2,3,4) AND starts_at IS NOT NULL AND notified_at IS NOT NULL AND ((tier=0 AND ends_at=starts_at AND status<>1) OR (tier BETWEEN 1 AND 4 AND ends_at>starts_at) OR (tier=5 AND ends_at IS NULL)))')),
  check("ck_treehole_penalties_6", sql.raw('status IN (0,5) OR tier < 3 OR operator_id IS NOT NULL')),
  check("ck_treehole_penalties_7", sql.raw('basis <> 1 OR operator_id IS NOT NULL')),
  check("ck_treehole_penalties_8", sql.raw('basis <> 2 OR (tier BETWEEN 1 AND 2 AND review_id IS NOT NULL AND ends_at IS NOT NULL)')),
  check("ck_treehole_penalties_9", sql.raw("operator_id IS NOT NULL OR status IN (0,5) OR tier=0 OR (tier IN (1,2) AND ends_at <= starts_at + interval '24 hours')")),
  check("ck_treehole_penalties_10", sql.raw('(decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)')),
  check("ck_treehole_penalties_11", sql.raw('(revoke_request_id IS NULL AND revoke_request_hash IS NULL AND revoke_result IS NULL) OR (revoke_request_id IS NOT NULL AND revoke_request_hash IS NOT NULL AND revoke_result IS NOT NULL)')),
  index("idx_treehole_penalties_user").on(t.user_id, t.status, t.starts_at, t.id),
  index("idx_treehole_penalties_queue").on(t.status, t.created_at, t.id),
])

export const treeholePenaltyContents = pgTable("treehole_penalty_contents", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  penalty_id: bigint("penalty_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholePenalties.id, { onDelete: "restrict" }),
  post_id: bigint("post_id", { mode: "bigint" }).references((): AnyPgColumn => treeholePosts.id, { onDelete: "restrict" }),
  comment_id: bigint("comment_id", { mode: "bigint" }).references((): AnyPgColumn => treeholeComments.id, { onDelete: "restrict" }),
  hidden_at: timestamp("hidden_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  released_at: timestamp("released_at", { withTimezone: true, mode: "string" }),
}, (t) => [
  check("ck_treehole_penalty_contents_1", sql.raw('(post_id IS NOT NULL)::integer + (comment_id IS NOT NULL)::integer = 1')),
  uniqueIndex("uk_treehole_penalty_contents_post").on(t.penalty_id, t.post_id).where(sql.raw('post_id IS NOT NULL')),
  uniqueIndex("uk_treehole_penalty_contents_comment").on(t.penalty_id, t.comment_id).where(sql.raw('comment_id IS NOT NULL')),
  index("idx_treehole_penalty_contents_hidden_post").on(t.post_id).where(sql.raw('released_at IS NULL')),
  index("idx_treehole_penalty_contents_hidden_comment").on(t.comment_id).where(sql.raw('released_at IS NULL')),
])

export const treeholeAppeals = pgTable("treehole_appeals", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  penalty_id: bigint("penalty_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => treeholePenalties.id, { onDelete: "restrict" }),
  user_id: bigint("user_id", { mode: "bigint" }).notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  reason: varchar("reason", { length: 1000 }).notNull(),
  status: stateColumn("status", 0).notNull(),
  decision_reason: varchar("decision_reason", { length: 1000 }),
  operator_id: integer("operator_id").references((): AnyPgColumn => users.id, { onDelete: "restrict" }),
  resolved_at: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  client_request_id: uuid("client_request_id").notNull(),
  request_hash: varchar("request_hash", { length: 64 }).notNull(),
  decision_request_id: uuid("decision_request_id"),
  decision_request_hash: varchar("decision_request_hash", { length: 64 }),
  decision_result: jsonb("decision_result"),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_appeals_1", sql.raw('status IN (0,1,2)')),
  check("ck_treehole_appeals_2", sql.raw('(decision_request_id IS NULL AND decision_request_hash IS NULL AND decision_result IS NULL) OR (decision_request_id IS NOT NULL AND decision_request_hash IS NOT NULL AND decision_result IS NOT NULL)')),
  uniqueIndex("uk_treehole_appeals_request").on(t.user_id, t.client_request_id),
  uniqueIndex("uk_treehole_appeals_pending").on(t.penalty_id).where(sql.raw('status=0')),
  index("idx_treehole_appeals_queue").on(t.status, t.created_at, t.id),
  index("idx_treehole_appeals_mine").on(t.user_id, t.created_at.desc(), t.id.desc()),
])

export const treeholeUserStates = pgTable("treehole_user_states", {
  user_id: bigint("user_id", { mode: "bigint" }).primaryKey().notNull().references((): AnyPgColumn => miniappUsers.id, { onDelete: "restrict" }),
  quota_date: date("quota_date", { mode: "string" }).notNull(),
  post_count: integer("post_count").notNull().default(0),
  comment_count: integer("comment_count").notNull().default(0),
  last_post_submitted_at: timestamp("last_post_submitted_at", { withTimezone: true, mode: "string" }),
  last_comment_submitted_at: timestamp("last_comment_submitted_at", { withTimezone: true, mode: "string" }),
  last_enforced_tier: stateColumn("last_enforced_tier", -1).notNull(),
  ...timestampColumns(),
}, (t) => [
  check("ck_treehole_user_states_1", sql.raw('post_count >= 0')),
  check("ck_treehole_user_states_2", sql.raw('comment_count >= 0')),
  check("ck_treehole_user_states_3", sql.raw('last_enforced_tier IN (-1,0,1,2,3,4,5)')),
])
