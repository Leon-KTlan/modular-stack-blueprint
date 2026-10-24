import { demoConversations } from "../../data/demo"
import type { EntrySummary } from "../../types/models"

Page({
  data: {
    entries: [
      { label: "赞", count: 12, tone: "red" },
      { label: "评论", count: 8, tone: "blue" },
      { label: "通知", count: 4, tone: "green" },
    ] as EntrySummary[],
    conversations: demoConversations,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 3, unread: 4 })
  },

  showDemoNotice() {
    wx.showToast({ title: "当前为界面演示", icon: "none" })
  },
})
