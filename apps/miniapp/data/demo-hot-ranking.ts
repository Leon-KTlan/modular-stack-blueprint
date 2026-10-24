import { demoPosts } from "./demo"

// Frontend fixtures only: these are sample daily interactions, not live totals.
export const demoHotPosts = [
  { id: "101", title: "图书馆靠窗的位置，谁懂这一刻的治愈", today: { likeCount: 128, favoriteCount: 36, commentCount: 24 } },
  { id: "102", title: "今天的操场晚霞，值得一场散步", today: { likeCount: 96, favoriteCount: 18, commentCount: 18 } },
  { id: "103", title: "夜跑搭子集合！新手也能轻松加入", today: { likeCount: 42, favoriteCount: 17, commentCount: 11 } },
  { id: "104", title: "九成新宿舍台灯，给好物找个新主人", today: { likeCount: 18, favoriteCount: 3, commentCount: 6 } },
].map((item) => {
  const post = demoPosts.find((post) => post.id === item.id)!
  return { ...item, circle: post.circle, author: post.author, content: post.content }
})
