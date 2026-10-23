import { demoConnections } from "../../data/demo"
import { getErrorMessage, getStoredToken, isApiConfigured, request } from "../../services/api"
import { getCachedProfile } from "../../services/profile"
import type { MiniappConnection } from "../../types/models"

type ConnectionTab = "following" | "followers"
type ConnectionItem = MiniappConnection & { avatarText: string }

function connectionItems(items: MiniappConnection[]): ConnectionItem[] {
  return items.map((item) => ({ ...item, avatarText: [...item.nickname][0] || "友" }))
}

Page({
  data: {
    tabs: [
      { id: "following" as ConnectionTab, label: "关注" },
      { id: "followers" as ConnectionTab, label: "粉丝" },
    ],
    activeTab: "following" as ConnectionTab,
    userId: "",
    items: [] as ConnectionItem[],
    loading: false,
    demoMode: false,
  },

  onLoad(options: { tab?: string; userId?: string }) {
    const activeTab: ConnectionTab = options.tab === "followers" ? "followers" : "following"
    const userId = options.userId || getCachedProfile().id
    this.setData({ activeTab, userId })
    void this.loadConnections()
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/profile/profile" }) })
  },

  selectTab(event: WechatMiniprogram.TouchEvent) {
    const activeTab = event.currentTarget.dataset.tab as ConnectionTab
    if (activeTab === this.data.activeTab) return
    this.setData({ activeTab })
    void this.loadConnections()
  },

  async loadConnections() {
    if (!isApiConfigured() || !getStoredToken()) {
      this.setData({ items: connectionItems(demoConnections[this.data.activeTab]), demoMode: true, loading: false })
      return
    }
    this.setData({ loading: true, demoMode: false })
    try {
      const response = await request<{ items: MiniappConnection[] }>(
        `/api/miniapp/users/${this.data.userId}/${this.data.activeTab}?page=1&pageSize=10`,
      )
      this.setData({ items: connectionItems(response.items) })
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        wx.reLaunch({ url: "/pages/login/index" })
      } else {
        this.setData({ items: [] })
        wx.showToast({ title: getErrorMessage(error, "列表加载失败"), icon: "none" })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  showProfile() {
    wx.showToast({ title: "他人主页将在下一阶段接入", icon: "none" })
  },
})
