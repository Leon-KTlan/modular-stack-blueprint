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
  likeCount: number
  commentCount: number
  liked: boolean
}

export type MessageItem = {
  id: string
  avatarText: string
  name: string
  preview: string
  time: string
  unread: number
  tone: "green" | "orange" | "blue"
}
