import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema.js"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL must be set")

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
})

export const database = drizzle({ client: pool, schema })

export async function closeDatabase(): Promise<void> {
  await pool.end()
}
