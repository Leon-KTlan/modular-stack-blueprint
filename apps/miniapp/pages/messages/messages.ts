import { demoMessages } from "../../data/demo"

Page({
  data: {
    tabs: ["互动", "私信", "系统"],
    activeTab: "互动",
    summary: [
      { label: "赞", count: 12, icon: "♥", tone: "red" },
      { label: "评论", count: 8, icon: "●", tone: "blue" },
      { label: "关注", count: 6, icon: "+", tone: "green" },
    ],
    messages: demoMessages,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 3, unread: 4 })
  },

  selectTab(event: WechatMiniprogram.TouchEvent) {
    const { name } = event.currentTarget.dataset as { name: string }
    this.setData({ activeTab: name })
  },

  showDemoNotice() {
    wx.showToast({ title: "当前为界面演示", icon: "none" })
  },
})
