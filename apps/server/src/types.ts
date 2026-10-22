export type UserRole = 0 | 1
export type UserStatus = 0 | 1
export type UserGender = 0 | 1 | 2
export type MiniappUserStatus = 0 | 1
export type CircleStatus = 0 | 1
export type CircleMemberStatus = 0 | 1
export type ContentType = "TEXT" | "IMAGE_TEXT" | "VIDEO"
export type MediaType = "IMAGE" | "VIDEO"
export type CommentStatus = 0 | 1

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

export interface MiniappUserRecord {
  id: bigint
  wx_openid: string
  wx_unionid: string | null
  nickname: string
  avatar_url: string | null
  status: MiniappUserStatus
  token_version: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminMiniappUserListItemView {
  id: string
  nickname: string
  avatarUrl: string | null
  status: "active" | "disabled"
  lastLoginAt: string | null
  createdAt: string
}

export interface AdminMiniappUserDetailView extends AdminMiniappUserListItemView {
  wechatOpenIdMasked: string
  updatedAt: string
  circleMemberships: AdminMiniappUserCircleMembershipView[]
}

export interface AdminMiniappUserCircleMembershipView {
  circleId: string
  circleName: string
  circleStatus: "active" | "disabled"
  joinedAt: string
}

export interface MiniappUserCircleMembershipRecord {
  circleId: bigint
  circleName: string
  circleStatus: CircleStatus
  joinedAt: string
}

export interface CircleRecord {
  id: bigint
  name: string
  description: string | null
  cover_url: string | null
  status: CircleStatus
  created_at: string
  updated_at: string
}

export interface AdminCircleView {
  id: string
  name: string
  description: string | null
  coverUrl: string | null
  status: "active" | "disabled"
  memberCount: number
  createdAt: string
  updatedAt: string
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

function toMiniappUserStatus(status: MiniappUserStatus): "active" | "disabled" {
  return status === 1 ? "active" : "disabled"
}

export function toMiniappUserView(user: MiniappUserRecord) {
  return {
    id: user.id.toString(),
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    status: toMiniappUserStatus(user.status),
    createdAt: user.created_at,
  }
}

export function toAdminMiniappUserListItemView(user: MiniappUserRecord): AdminMiniappUserListItemView {
  return {
    id: user.id.toString(),
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    status: toMiniappUserStatus(user.status),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  }
}

export function toAdminMiniappUserDetailView(
  user: MiniappUserRecord,
  memberships: MiniappUserCircleMembershipRecord[],
): AdminMiniappUserDetailView {
  return {
    ...toAdminMiniappUserListItemView(user),
    wechatOpenIdMasked: `${"*".repeat(Math.max(0, user.wx_openid.length - 6))}${user.wx_openid.slice(-6)}`,
    updatedAt: user.updated_at,
    circleMemberships: memberships.map((membership) => ({
      circleId: membership.circleId.toString(),
      circleName: membership.circleName,
      circleStatus: membership.circleStatus === 1 ? "active" : "disabled",
      joinedAt: membership.joinedAt,
    })),
  }
}

export function toAdminCircleView(circle: CircleRecord, memberCount: number): AdminCircleView {
  return {
    id: circle.id.toString(),
    name: circle.name,
    description: circle.description,
    coverUrl: circle.cover_url,
    status: circle.status === 1 ? "active" : "disabled",
    memberCount,
    createdAt: circle.created_at,
    updatedAt: circle.updated_at,
  }
}
