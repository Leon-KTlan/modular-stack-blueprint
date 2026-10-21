import { demoPosts } from "../../data/demo"
import type { Post } from "../../types/models"

const fallbackPost = demoPosts[0]

Page({
  data: {
    post: fallbackPost as Post,
    comments: [
      { id: "c1", avatarText: "夏", name: "夏橙", content: "靠窗的位置确实很舒服，下次可以一起。", time: "1 小时前" },
      { id: "c2", avatarText: "周", name: "周野", content: "先蹲一个自习搭子！", time: "36 分钟前" },
    ],
  },

  onLoad(options: Record<string, string | undefined>) {
    const post = demoPosts.find((item) => item.id === options.id) ?? fallbackPost
    this.setData({ post })
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: "/pages/home/home" }),
    })
  },

  toggleLike() {
    const post = this.data.post
    this.setData({
      post: {
        ...post,
        liked: !post.liked,
        likeCount: post.likeCount + (post.liked ? -1 : 1),
      },
    })
  },

  showDemoNotice() {
    wx.showToast({ title: "评论接口待接入", icon: "none" })
  },
})
