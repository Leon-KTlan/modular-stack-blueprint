import { demoPosts } from "../../data/demo"
import type { Post } from "../../types/models"

function getVisiblePosts(posts: Post[], filter: string): Post[] {
  return filter === "推荐" ? posts : posts.filter((post) => post.category === filter)
}

Page({
  data: {
    categories: [
      { name: "学习搭子", caption: "一起自习", icon: "学", tone: "green", filter: "学习" },
      { name: "运动搭子", caption: "一起流汗", icon: "动", tone: "blue", filter: "运动" },
      { name: "校园生活", caption: "吃喝玩乐", icon: "校", tone: "yellow", filter: "校园生活" },
      { name: "二手闲置", caption: "闲置交换", icon: "集", tone: "orange", filter: "二手" },
    ],
    topics: [
      { rank: "No.1", title: "开学搭子集合", heat: "精选帖子", tone: "orange", postId: "101" },
      { rank: "No.2", title: "图书馆自习", heat: "学习搭子", tone: "yellow", postId: "101" },
      { rank: "No.3", title: "操场夜跑", heat: "运动搭子", tone: "blue", postId: "103" },
    ],
    feedTabs: ["推荐", "校园生活", "学习", "运动", "二手"],
    activeFeed: "推荐",
    allPosts: demoPosts,
    posts: demoPosts,
    scrollTarget: "",
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 0 })
  },

  showBuilding() {
    wx.showToast({ title: "功能建设中", icon: "none" })
  },

  openHotRanking() {
    wx.navigateTo({ url: "/pages/hot-ranking/hot-ranking" })
  },

  openPublish() {
    wx.switchTab({ url: "/pages/publish/publish" })
  },

  openPost(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  openTopic(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  selectFeed(event: WechatMiniprogram.TouchEvent) {
    const { filter } = event.currentTarget.dataset as { filter: string }
    const posts = getVisiblePosts(this.data.allPosts, filter)
    this.setData({ activeFeed: filter, posts, scrollTarget: "" }, () => {
      this.setData({ scrollTarget: "feed-section" })
    })
  },

  toggleLike(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const allPosts = this.data.allPosts.map((post) =>
      post.id === id
        ? { ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) }
        : post,
    )
    this.setData({
      allPosts,
      posts: getVisiblePosts(allPosts, this.data.activeFeed),
    })
  },
})
