export type Circle = {
  id: string
  name: string
  description: string
  memberCount: string
  tone: "green" | "orange" | "blue" | "yellow"
  icon: string
  joined: boolean
}

export type Post = {
  id: string
  author: string
  avatarText: string
  time: string
  circle: string
  category: "学习" | "运动" | "校园生活" | "二手"
  content: string
  cover: "library" | "sunset"
  profileTitle: string
  profileCover: "track" | "library" | "running" | "desk"
  likeCount: number
  commentCount: number
  viewCount: number
  liked: boolean
  favorited: boolean
}

export type EntrySummary = {
  label: string
  count: number
  tone: "red" | "blue" | "green"
}

export type DmConversation = {
  id: string
  avatarText: string
  name: string
  tag?: string
  preview: string
  time: string
  unread: number
  tone: "blue" | "orange" | "teal" | "green" | "deep"
}

export type MiniappUserSummary = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  gender: "private" | "male" | "female"
  status: "active" | "disabled"
  createdAt: string
}

export type MiniappProfile = MiniappUserSummary & {
  stats: {
    followingCount: number
    followerCount: number
    receivedLikeCount: number
  }
  isSelf: boolean
  isFollowing: boolean
  nicknameChange?: {
    remaining: number
    resetAt: string | null
  }
}

export type MiniappConnection = Pick<MiniappUserSummary, "id" | "nickname" | "avatarUrl" | "bio"> & {
  followedAt: string
}
