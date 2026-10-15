import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { hashPassword } from "./password.js"
import type { UserRecord } from "./types.js"

// 单进程开发版文件存储。MySQL 接入时保持这些方法的调用方式不变。
export type UserRow = UserRecord

const dataFile = fileURLToPath(new URL("../data/users.json", import.meta.url))
let writeQueue: Promise<unknown> = Promise.resolve()

function now(): string {
  return new Date().toISOString()
}

async function initialUsers(): Promise<UserRow[]> {
  const createdAt = now()
  const adminHash = await hashPassword("Admin123!")
  const userHash = await hashPassword("User123!")
  return [
    { id: 1, username: "admin", password_hash: adminHash, phone: "13800000001", email: "admin@example.com", gender: 1, role: 1, status: 1, token_version: 0, last_login_at: null, created_at: createdAt, updated_at: createdAt },
    { id: 2, username: "leon", password_hash: userHash, phone: "13800000002", email: "leon@example.com", gender: 1, role: 0, status: 1, token_version: 0, last_login_at: null, created_at: createdAt, updated_at: createdAt },
    { id: 3, username: "alice", password_hash: userHash, phone: null, email: "alice@example.com", gender: 2, role: 0, status: 0, token_version: 0, last_login_at: null, created_at: createdAt, updated_at: createdAt },
  ]
}

async function ensureFile(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("本地 JSON 演示存储不能用于生产环境")
  }
  await mkdir(fileURLToPath(new URL("../data/", import.meta.url)), { recursive: true })
  try {
    const file = await open(dataFile, "wx", 0o600)
    try {
      await file.writeFile(JSON.stringify(await initialUsers(), null, 2) + "\n")
    } finally {
      await file.close()
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
}

async function readUsers(): Promise<UserRow[]> {
  await ensureFile()
  const users: unknown = JSON.parse(await readFile(dataFile, "utf8"))
  if (!Array.isArray(users)) throw new Error("users.json 不是用户数组")
  return users as UserRow[]
}

async function saveUsers(users: UserRow[]): Promise<void> {
  const temp = `${dataFile}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(users, null, 2) + "\n", { mode: 0o600 })
  await rename(temp, dataFile)
}

function mutate<T>(change: (users: UserRow[]) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const users = await readUsers()
    const result = await change(users)
    await saveUsers(users)
    return result
  })
  writeQueue = operation.catch(() => undefined)
  return operation
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const users = await readUsers()
  return users.find((user) => user.username === username) ?? null
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const users = await readUsers()
  return users.find((user) => user.id === id) ?? null
}

export async function listUsers(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: 0 | 1
}): Promise<{ items: UserRow[]; total: number }> {
  const keyword = params.keyword?.toLowerCase()
  const filtered = (await readUsers()).filter((user) =>
    (params.status === undefined || user.status === params.status) &&
    (!keyword || [user.username, user.phone, user.email].some((field) => field?.toLowerCase().includes(keyword))),
  )
  filtered.sort((a, b) => b.id - a.id)
  const offset = (params.page - 1) * params.pageSize
  return { items: filtered.slice(offset, offset + params.pageSize), total: filtered.length }
}

export async function createUser(input: {
  username: string
  passwordHash: string
  phone: string | null
  email: string | null
  gender: 0 | 1 | 2
  role: 0 | 1
}): Promise<number> {
  return mutate((users) => {
    if (users.some((user) =>
      user.username === input.username ||
      (input.phone !== null && user.phone === input.phone) ||
      (input.email !== null && user.email?.toLowerCase() === input.email.toLowerCase()),
    )) throw Object.assign(new Error("用户已存在"), { code: "ER_DUP_ENTRY" })
    const id = Math.max(0, ...users.map((user) => user.id)) + 1
    const timestamp = now()
    users.push({
      id, username: input.username, password_hash: input.passwordHash,
      phone: input.phone, email: input.email, gender: input.gender,
      role: input.role, status: 1, token_version: 0,
      last_login_at: null, created_at: timestamp, updated_at: timestamp,
    })
    return id
  })
}

export async function updateProfile(id: number, input: {
  phone: string | null
  email: string | null
  gender: 0 | 1 | 2
}): Promise<void> {
  await mutate((users) => {
    const user = users.find((entry) => entry.id === id)
    if (!user) throw new Error("用户不存在")
    if (users.some((entry) => entry.id !== id && (
      (input.phone !== null && entry.phone === input.phone) ||
      (input.email !== null && entry.email?.toLowerCase() === input.email.toLowerCase())
    ))) throw Object.assign(new Error("联系方式已存在"), { code: "ER_DUP_ENTRY" })
    Object.assign(user, { ...input, updated_at: now() })
  })
}

export async function updateUserStatus(id: number, status: 0 | 1): Promise<boolean> {
  return mutate((users) => {
    const user = users.find((entry) => entry.id === id)
    if (!user) return false
    user.status = status
    user.token_version += 1
    user.updated_at = now()
    return true
  })
}

export async function upgradePasswordHash(id: number, passwordHash: string): Promise<void> {
  await mutate((users) => {
    const user = users.find((entry) => entry.id === id)
    if (!user) return
    user.password_hash = passwordHash
    user.updated_at = now()
  })
}

export async function resetUserPassword(id: number, passwordHash: string): Promise<boolean> {
  return mutate((users) => {
    const user = users.find((entry) => entry.id === id)
    if (!user) return false
    user.password_hash = passwordHash
    user.token_version += 1
    user.updated_at = now()
    return true
  })
}

export async function markLogin(id: number): Promise<void> {
  await mutate((users) => {
    const user = users.find((entry) => entry.id === id)
    if (user) user.last_login_at = now()
  })
}

export async function seedUsers(): Promise<UserRow[]> {
  return readUsers()
}
