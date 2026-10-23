import { demoPosts } from "../../data/demo"
import { getErrorMessage, getStoredToken, isApiConfigured, request } from "../../services/api"
import { cacheProfile, getCachedProfile } from "../../services/profile"
import type { MiniappProfile, Post } from "../../types/models"

type ProfileTab = "posts" | "likes" | "favorites" | "history"

const tabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "posts", label: "帖子" },
  { id: "likes", label: "点赞" },
  { id: "favorites", label: "收藏" },
  { id: "history", label: "足迹" },
]

const profilePosts = [demoPosts[1], demoPosts[0], demoPosts[2], demoPosts[3]]

function postsForTab(tab: ProfileTab): Post[] {
  if (tab === "likes") return profilePosts.filter((post) => post.liked)
  if (tab === "favorites") return profilePosts.filter((post) => post.favorited)
  if (tab === "history") return profilePosts.slice(0, 3)
  return profilePosts
}

Page({
  data: {
    profile: getCachedProfile(),
    avatarText: "游",
    genderSymbol: "♂",
    tabs,
    activeTab: "posts" as ProfileTab,
    visiblePosts: postsForTab("posts"),
    loading: false,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 4 })
    this.applyProfile(getCachedProfile())
    if (isApiConfigured() && getStoredToken()) void this.loadProfile()
  },

  applyProfile(profile: MiniappProfile) {
    this.setData({
      profile,
      avatarText: [...profile.nickname][0] || "游",
      genderSymbol: profile.gender === "male" ? "♂" : profile.gender === "female" ? "♀" : "",
    })
  },

  async loadProfile() {
    this.setData({ loading: true })
    try {
      const profile = await request<MiniappProfile>("/api/miniapp/users/me")
      cacheProfile(profile)
      this.applyProfile(profile)
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        wx.reLaunch({ url: "/pages/login/index" })
      } else {
        wx.showToast({ title: getErrorMessage(error, "资料加载失败"), icon: "none" })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  selectTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab as ProfileTab
    this.setData({ activeTab: tab, visiblePosts: postsForTab(tab) })
  },

  openEditor() {
    wx.navigateTo({ url: "/pages/profile-edit/profile-edit" })
  },

  openPost(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${event.currentTarget.dataset.id}` })
  },

  openConnections(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab as "following" | "followers"
    wx.navigateTo({ url: `/pages/connections/connections?tab=${tab}&userId=${this.data.profile.id}` })
  },
})
