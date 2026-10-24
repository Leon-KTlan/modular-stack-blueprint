import { smallint, timestamp } from "drizzle-orm/pg-core"

export type BinaryStatus = 0 | 1

export function binaryStatusColumn<T extends BinaryStatus>() {
  return smallint("status").$type<T>().notNull().default(1 as T)
}

export function timestampColumns() {
  return {
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  }
}

export function nullableDeletedAtColumn() {
  return timestamp("deleted_at", { withTimezone: true, mode: "string" })
}

export function stateColumn(name: string, defaultValue?: number) {
  const column = smallint(name)
  return defaultValue === undefined ? column : column.default(defaultValue)
}
