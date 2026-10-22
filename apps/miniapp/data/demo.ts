import type { Circle, MessageItem, Post } from "../types/models"

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
    likeCount: 128,
    commentCount: 24,
    liked: false,
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
    likeCount: 96,
    commentCount: 18,
    liked: true,
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
    likeCount: 42,
    commentCount: 11,
    liked: false,
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
    likeCount: 18,
    commentCount: 6,
    liked: false,
  },
]

export const demoMessages: MessageItem[] = [
  { id: "m1", avatarText: "陈", name: "陈以南", preview: "评论了你：这张拍得真好！", time: "5 分钟前", unread: 2, tone: "blue" },
  { id: "m2", avatarText: "林", name: "林念", preview: "赞了你的帖子", time: "28 分钟前", unread: 1, tone: "orange" },
  { id: "m3", avatarText: "动", name: "运动搭子圈", preview: "产品方向已确认，工程接入待完成", time: "今天", unread: 1, tone: "green" },
]
