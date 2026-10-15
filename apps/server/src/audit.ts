import { appendFile, mkdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

export interface AuditLogRecord {
  operatorId: number
  operatorRole: number
  action: "user.password.reset"
  resourceType: "user"
  resourceId: number
  reason: string
  requestId: string
  createdAt: string
}

const dataDirectory = fileURLToPath(new URL("../data/", import.meta.url))
const auditFile = fileURLToPath(new URL("../data/audit-logs.jsonl", import.meta.url))
let writeQueue: Promise<unknown> = Promise.resolve()

export function appendAuditLog(input: Omit<AuditLogRecord, "createdAt">): Promise<AuditLogRecord> {
  const record: AuditLogRecord = { ...input, createdAt: new Date().toISOString() }
  const operation = writeQueue.then(async () => {
    await mkdir(dataDirectory, { recursive: true })
    await appendFile(auditFile, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 })
    return record
  })
  writeQueue = operation.catch(() => undefined)
  return operation
}

export async function readAuditLogs(): Promise<AuditLogRecord[]> {
  await writeQueue
  try {
    const content = await readFile(auditFile, "utf8")
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditLogRecord)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}
