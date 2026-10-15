import * as argon2 from "argon2"
import bcrypt from "bcryptjs"

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Options)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<{
  valid: boolean
  upgradedHash?: string
}> {
  if (passwordHash.startsWith("$argon2id$")) {
    try {
      const valid = await argon2.verify(passwordHash, password)
      if (!valid) return { valid: false }
      return {
        valid: true,
        upgradedHash: argon2.needsRehash(passwordHash, argon2Options)
          ? await hashPassword(password)
          : undefined,
      }
    } catch {
      return { valid: false }
    }
  }

  if (/^\$2[aby]\$/.test(passwordHash)) {
    const valid = await bcrypt.compare(password, passwordHash)
    return valid ? { valid: true, upgradedHash: await hashPassword(password) } : { valid: false }
  }

  return { valid: false }
}
