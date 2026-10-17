import { seedUsers } from "./db.js"
import { seedCategories } from "./categories.js"
import { closeDatabase } from "./database.js"

if (process.env.NODE_ENV === "production") {
  throw new Error("演示用户不能写入生产环境")
}
try {
  const users = await seedUsers()
  const categories = await seedCategories()
  console.table(users.map(({ id, username, role, status }) => ({ id, username, role, status })))
  console.table(categories.map(({ id, name, code, sortOrder }) => ({ id: id.toString(), name, code, sortOrder })))
} finally {
  await closeDatabase()
}
