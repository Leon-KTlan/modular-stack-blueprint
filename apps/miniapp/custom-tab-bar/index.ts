Component({
  data: {
    selected: 0,
    unread: 4,
    list: [
      { pagePath: "/pages/home/home", text: "首页", icon: "⌂" },
      { pagePath: "/pages/circles/circles", text: "圈子", icon: "◉" },
      { pagePath: "/pages/publish/publish", text: "发布", icon: "+", raised: true },
      { pagePath: "/pages/messages/messages", text: "消息", icon: "▣" },
      { pagePath: "/pages/profile/profile", text: "我的", icon: "○" },
    ],
  },
  methods: {
    switchTab(event: WechatMiniprogram.TouchEvent) {
      const { path } = event.currentTarget.dataset as { path: string }
      wx.switchTab({ url: path })
    },
  },
})
