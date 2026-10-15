import { index, integer, pgTable, serial, smallint, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"
import type { UserGender, UserRole, UserStatus } from "./types.js"

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
  resourceId: integer("resource_id").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  requestId: varchar("request_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_operator_created").on(table.operatorId, table.createdAt),
])
