import { sql } from "drizzle-orm"
import { bigint, check, index, integer, pgTable, serial, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import type { MiniappUserStatus, UserGender, UserRole, UserStatus } from "./types.js"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  gender: smallint("gender").$type<UserGender>().notNull().default(0),
  role: smallint("role").$type<UserRole>().notNull().default(0),
  status: smallint("status").$type<UserStatus>().notNull().default(1),
  token_version: integer("token_version").notNull().default(0),
  last_login_at: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_users_username").on(table.username),
  uniqueIndex("uk_users_phone").on(table.phone),
  uniqueIndex("uk_users_email").on(table.email),
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
  status: smallint("status").$type<MiniappUserStatus>().notNull().default(1),
  token_version: integer("token_version").notNull().default(0),
  last_login_at: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uk_miniapp_users_wx_openid").on(table.wx_openid),
  uniqueIndex("uk_miniapp_users_wx_unionid").on(table.wx_unionid),
  check("ck_miniapp_users_nickname_not_blank", sql`char_length(btrim(${table.nickname})) BETWEEN 1 AND 50`),
  check("ck_miniapp_users_status", sql`${table.status} IN (0, 1)`),
  index("idx_miniapp_users_status_created").on(table.status, table.created_at, table.id),
  index("idx_miniapp_users_created").on(table.created_at, table.id),
])
