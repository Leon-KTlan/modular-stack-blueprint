import { desc } from "drizzle-orm"
import { database } from "./database.js"
import { auditLogs } from "./schema.js"

export type AuditLogRecord = typeof auditLogs.$inferSelect

export async function readAuditLogs(): Promise<AuditLogRecord[]> {
  return database.select().from(auditLogs).orderBy(desc(auditLogs.id))
}
