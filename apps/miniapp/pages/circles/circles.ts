Page({
  data: { contentTop: 100, rulesVisible: false },
  onLoad() {
    const capsule = wx.getMenuButtonBoundingClientRect()
    const window = wx.getWindowInfo()
    this.setData({ contentTop: (capsule.bottom || window.statusBarHeight + 44) + 16 })
  },
  onShow() { this.getTabBar()?.setData({ selected: 1, hidden: false }) },
  enterTreehole() { wx.navigateTo({ url: '/pages/treehole/index' }) },
  showRules() { this.setData({ rulesVisible: true }) },
  hideRules() { this.setData({ rulesVisible: false }) },
  stopPropagation() {},
})
