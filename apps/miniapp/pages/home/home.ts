import { demoPosts } from "../../data/demo"

Page({
  data: {
    categories: [
      { name: "学习搭子", caption: "一起自习", icon: "学", tone: "green" },
      { name: "运动搭子", caption: "一起流汗", icon: "动", tone: "blue" },
      { name: "校园生活", caption: "吃喝玩乐", icon: "校", tone: "yellow" },
      { name: "二手闲置", caption: "闲置交换", icon: "集", tone: "orange" },
    ],
    topics: [
      { rank: "No.1", title: "开学搭子集合", heat: "2.8 万人参与", tone: "orange" },
      { rank: "No.2", title: "图书馆自习", heat: "1.9 万人参与", tone: "yellow" },
      { rank: "No.3", title: "操场夜跑", heat: "1.6 万人参与", tone: "blue" },
    ],
    posts: demoPosts,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 0 })
  },

  showBuilding() {
    wx.showToast({ title: "功能建设中", icon: "none" })
  },

  openPublish() {
    wx.switchTab({ url: "/pages/publish/publish" })
  },

  openPost(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  toggleLike(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const posts = this.data.posts.map((post) =>
      post.id === id
        ? { ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) }
        : post,
    )
    this.setData({ posts })
  },
})
