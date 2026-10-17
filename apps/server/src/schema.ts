import { sql } from "drizzle-orm"
import { bigint, check, index, integer, pgTable, serial, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import { binaryStatusColumn, nullableDeletedAtColumn, timestampColumns } from "./schema-fields.js"
import type { CircleMemberStatus, CircleStatus, MiniappUserStatus, UserGender, UserRole, UserStatus } from "./types.js"

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
  status: binaryStatusColumn<MiniappUserStatus>(),
  token_version: integer("token_version").notNull().default(0),
  last_login_at: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  ...timestampColumns(),
}, (table) => [
  uniqueIndex("uk_miniapp_users_wx_openid").on(table.wx_openid),
  uniqueIndex("uk_miniapp_users_wx_unionid").on(table.wx_unionid),
  check("ck_miniapp_users_nickname_not_blank", sql`char_length(btrim(${table.nickname})) BETWEEN 1 AND 50`),
  check("ck_miniapp_users_status", sql`${table.status} IN (0, 1)`),
  index("idx_miniapp_users_status_created").on(table.status, table.created_at, table.id),
  index("idx_miniapp_users_created").on(table.created_at, table.id),
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
