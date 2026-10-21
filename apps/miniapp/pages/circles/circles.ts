import { demoCircles } from "../../data/demo"

Page({
  data: {
    filters: ["全部", "学习", "运动", "校园生活", "二手"],
    activeFilter: "全部",
    circles: demoCircles,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 1 })
  },

  setFilter(event: WechatMiniprogram.TouchEvent) {
    const { filter } = event.currentTarget.dataset as { filter: string }
    this.setData({ activeFilter: filter })
  },

  showBuilding() {
    wx.showToast({ title: "搜索功能建设中", icon: "none" })
  },

  toggleJoin(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    const circles = this.data.circles.map((circle) =>
      circle.id === id ? { ...circle, joined: !circle.joined } : circle,
    )
    this.setData({ circles })
    wx.showToast({ title: "仅保存于本次演示", icon: "none" })
  },
})
