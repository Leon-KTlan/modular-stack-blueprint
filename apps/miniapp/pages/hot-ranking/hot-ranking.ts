import { demoHotPosts } from "../../data/demo-hot-ranking"
import { getBeijingDate, HOT_RANKING_WEIGHTS, rankHotPosts } from "../../utils/hot-ranking"

const ranking = rankHotPosts(demoHotPosts)

Page({
  data: {
    contentTop: 100,
    navTop: 54,
    date: getBeijingDate(new Date()),
    ranking,
    champion: ranking[0] ?? null,
    remaining: ranking.slice(1),
    weights: HOT_RANKING_WEIGHTS,
    rulesVisible: false,
    refreshing: false,
  },

  onLoad() {
    const capsule = wx.getMenuButtonBoundingClientRect()
    const window = wx.getWindowInfo()
    this.setData({ navTop: capsule.top || window.statusBarHeight + 4, contentTop: (capsule.bottom || window.statusBarHeight + 44) + 16 })
  },

  onShow() {
    this.setData({ date: getBeijingDate(new Date()) })
  },

  onHide() {
    this.closeRules()
  },

  refreshRanking() {
    const ranking = rankHotPosts(demoHotPosts)
    this.setData({ ranking, champion: ranking[0] ?? null, remaining: ranking.slice(1), date: getBeijingDate(new Date()), refreshing: false })
    wx.showToast({ title: "当前为演示榜单，数据待接入", icon: "none" })
  },

  goBack() {
    wx.navigateBack()
  },

  openPost(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset as { id: string }
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },

  showRules() {
    this.setData({ rulesVisible: true })
  },
  closeRules() {
    this.setData({ rulesVisible: false })
  },
  stopPropagation() {},
})
