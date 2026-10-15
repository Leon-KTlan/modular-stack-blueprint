export type UserRole = 0 | 1
export type UserStatus = 0 | 1
export type UserGender = 0 | 1 | 2

export interface UserRecord {
  id: number
  username: string
  password_hash: string
  phone: string | null
  email: string | null
  gender: UserGender
  role: UserRole
  status: UserStatus
  token_version: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserView {
  id: number
  username: string
  phone: string | null
  email: string | null
  gender: UserGender
  role: UserRole
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

export function toUserView(user: UserRecord): UserView {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    email: user.email,
    gender: user.gender,
    role: user.role,
    status: user.status,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  }
}
