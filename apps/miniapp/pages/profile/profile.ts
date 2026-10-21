Page({
  data: {
    stats: [
      { value: "2", label: "帖子" },
      { value: "3", label: "圈子" },
      { value: "24", label: "获赞" },
    ],
    menu: [
      { icon: "◎", title: "我的发布", caption: "查看演示内容" },
      { icon: "◉", title: "我的圈子", caption: "3 个演示圈子" },
      { icon: "☆", title: "收藏与点赞", caption: "数据接入后开放" },
      { icon: "?", title: "帮助与反馈", caption: "建设中" },
    ],
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 4 })
  },

  showDemoNotice() {
    wx.showToast({ title: "当前为界面演示", icon: "none" })
  },
})
