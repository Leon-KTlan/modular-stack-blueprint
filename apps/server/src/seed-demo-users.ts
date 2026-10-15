import { closeDatabase, database } from "./database.js"
import { hashPassword } from "./password.js"
import { users } from "./schema.js"
import type { UserGender } from "./types.js"

const DEMO_USER_COUNT = 72
const DEMO_PASSWORD = "Demo12345!"

if (process.env.NODE_ENV === "production") {
  throw new Error("演示用户不能写入生产环境")
}

try {
  const demoUsers = []
  for (let index = 1; index <= DEMO_USER_COUNT; index += 1) {
    const suffix = String(index).padStart(3, "0")
    demoUsers.push({
      username: `demo_${suffix}`,
      password_hash: await hashPassword(DEMO_PASSWORD),
      phone: `1391${String(index).padStart(7, "0")}`,
      email: `demo_${suffix}@example.com`,
      gender: (index % 3) as UserGender,
      role: 0 as const,
      status: index % 6 === 0 ? 0 as const : 1 as const,
    })
  }

  const inserted = await database.insert(users)
    .values(demoUsers)
    .onConflictDoNothing({ target: users.username })
    .returning({ id: users.id })

  console.log(`演示用户准备完成：新增 ${inserted.length} 条，目标 ${DEMO_USER_COUNT} 条。`)
} finally {
  await closeDatabase()
}
