Component({
  data: {
    selected: 0,
    unread: 4,
    list: [
      { pagePath: "/pages/home/home", text: "首页", icon: "home" },
      { pagePath: "/pages/circles/circles", text: "圈子", icon: "circles" },
      { pagePath: "/pages/publish/publish", text: "发布", icon: "publish", raised: true },
      { pagePath: "/pages/messages/messages", text: "消息", icon: "message" },
      { pagePath: "/pages/profile/profile", text: "我的", icon: "profile" },
    ],
  },
  methods: {
    switchTab(event: WechatMiniprogram.TouchEvent) {
      const { path } = event.currentTarget.dataset as { path: string }
      wx.switchTab({ url: path })
    },
  },
})
