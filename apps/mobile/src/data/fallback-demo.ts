import type { MiniappProfile, Post } from "@/types/models";

const now = new Date().toISOString();

export const fallbackProfile: MiniappProfile = {
  id: "9001",
  nickname: "校园漫游者",
  avatarUrl: null,
  bio: "在校园里找到同频的人，一起把普通日常玩出花。",
  gender: "private",
  status: "active",
  createdAt: now,
  stats: { followingCount: 18, followerCount: 42, receivedLikeCount: 126 },
  isSelf: true,
  isFollowing: false,
};

export const fallbackPosts: Post[] = [
  { id: "101", user: { id: "9002", nickname: "图书馆守夜人", avatarUrl: null }, circle: { id: "201", name: "学习搭子" }, category: { id: "301", name: "学习", code: "study" }, contentType: "TEXT", content: "今晚七点图书馆三楼，一起冲刺两个番茄钟。结束去吃夜宵，有人来吗？", status: "published", createdAt: now, updatedAt: now, deletedAt: null, likeCount: 28, commentCount: 7, viewCount: 146, media: [] },
  { id: "102", user: { id: "9003", nickname: "橘子汽水", avatarUrl: null }, circle: { id: "202", name: "校园生活" }, category: { id: "302", name: "校园生活", code: "campus-life" }, contentType: "TEXT", content: "发现一条从宿舍到操场的落日路线。五点四十出发刚刚好，今天的云像打翻的橘子汽水。", status: "published", createdAt: now, updatedAt: now, deletedAt: null, likeCount: 51, commentCount: 12, viewCount: 233, media: [] },
  { id: "103", user: { id: "9004", nickname: "夜跑不鸽", avatarUrl: null }, circle: { id: "203", name: "运动搭子" }, category: { id: "303", name: "运动", code: "sport" }, contentType: "TEXT", content: "操场八点轻松跑 3 公里，新手友好，不卷配速。跑完一起拉伸。", status: "published", createdAt: now, updatedAt: now, deletedAt: null, likeCount: 19, commentCount: 5, viewCount: 98, media: [] },
];
