import type { Circle, MessageItem, MiniappConnection, MiniappProfile, Post } from "../types/models"

export const demoProfile: MiniappProfile = {
  id: "10240001",
  nickname: "校园玩家",
  avatarUrl: null,
  bio: "在校园里，和有趣的人做有趣的事。持续探索，保持热爱。",
  gender: "male",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  stats: { followingCount: 12, followerCount: 3, receivedLikeCount: 24 },
  isSelf: true,
  isFollowing: false,
}

export const demoConnections: Record<"following" | "followers", MiniappConnection[]> = {
  following: [
    { id: "10240002", nickname: "林念", avatarUrl: null, bio: "图书馆固定出没，一起认真也一起吃饭。", followedAt: "2026-10-22T10:00:00.000Z" },
    { id: "10240003", nickname: "陈以南", avatarUrl: null, bio: "喜欢晚霞、散步和记录校园日常。", followedAt: "2026-10-21T08:30:00.000Z" },
    { id: "10240004", nickname: "周野", avatarUrl: null, bio: "轻松跑新手，周五晚操场见。", followedAt: "2026-10-20T12:00:00.000Z" },
  ],
  followers: [
    { id: "10240005", nickname: "夏橙", avatarUrl: null, bio: "闲置交换，也想认识爱逛校园的人。", followedAt: "2026-10-22T16:00:00.000Z" },
    { id: "10240006", nickname: "顾知秋", avatarUrl: null, bio: "摄影、羽毛球和周末探店。", followedAt: "2026-10-19T09:20:00.000Z" },
  ],
}

export const demoCircles: Circle[] = [
  { id: "1", name: "学习搭子", description: "一起自习，一起进步", memberCount: "2.3 万", tone: "green", icon: "学", joined: true },
  { id: "2", name: "校园生活", description: "记录日常，分享新鲜事", memberCount: "1.8 万", tone: "yellow", icon: "校", joined: true },
  { id: "3", name: "运动搭子", description: "约球、跑步、一起流汗", memberCount: "1.5 万", tone: "blue", icon: "动", joined: false },
  { id: "4", name: "二手闲置", description: "让好物遇见新主人", memberCount: "0.9 万", tone: "orange", icon: "集", joined: false },
]

export const demoPosts: Post[] = [
  {
    id: "101",
    author: "林念",
    avatarText: "林",
    time: "2 小时前",
    circle: "学习搭子",
    category: "学习",
    content: "图书馆靠窗的位置真的很治愈，有没有一起备考的搭子？专注学习，也一起吃好喝好。",
    cover: "library",
    profileTitle: "图书馆自习",
    profileCover: "library",
    likeCount: 128,
    commentCount: 24,
    viewCount: 392,
    liked: false,
    favorited: true,
  },
  {
    id: "102",
    author: "陈以南",
    avatarText: "陈",
    time: "4 小时前",
    circle: "校园生活",
    category: "校园生活",
    content: "傍晚的操场和晚霞，永远让人心情变好。今晚有人一起散步吗？",
    cover: "sunset",
    profileTitle: "操场的晚霞",
    profileCover: "track",
    likeCount: 96,
    commentCount: 18,
    viewCount: 267,
    liked: true,
    favorited: false,
  },
  {
    id: "103",
    author: "周野",
    avatarText: "周",
    time: "今天",
    circle: "运动搭子",
    category: "运动",
    content: "周五晚八点操场轻松跑，有没有想一起坚持夜跑的同学？新手也欢迎。",
    cover: "sunset",
    profileTitle: "今晚一起跑步",
    profileCover: "running",
    likeCount: 42,
    commentCount: 11,
    viewCount: 186,
    liked: false,
    favorited: true,
  },
  {
    id: "104",
    author: "夏橙",
    avatarText: "夏",
    time: "昨天",
    circle: "二手闲置",
    category: "二手",
    content: "出一个九成新的宿舍台灯，亮度可调，想要的同学可以在帖子里留言。",
    cover: "library",
    profileTitle: "闲置台灯",
    profileCover: "desk",
    likeCount: 18,
    commentCount: 6,
    viewCount: 142,
    liked: false,
    favorited: false,
  },
]

export const demoMessages: MessageItem[] = [
  { id: "m1", avatarText: "陈", name: "陈以南", preview: "评论了你：这张拍得真好！", time: "5 分钟前", unread: 2, tone: "blue" },
  { id: "m2", avatarText: "林", name: "林念", preview: "赞了你的帖子", time: "28 分钟前", unread: 1, tone: "orange" },
  { id: "m3", avatarText: "动", name: "运动搭子圈", preview: "产品方向已确认，工程接入待完成", time: "今天", unread: 1, tone: "green" },
]
