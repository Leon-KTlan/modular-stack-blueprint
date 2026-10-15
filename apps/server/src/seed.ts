import { seedUsers } from "./db.js"
import { closeDatabase } from "./database.js"

if (process.env.NODE_ENV === "production") {
  throw new Error("演示用户不能写入生产环境")
}
try {
  const users = await seedUsers()
  console.table(users.map(({ id, username, role, status }) => ({ id, username, role, status })))
} finally {
  await closeDatabase()
}
