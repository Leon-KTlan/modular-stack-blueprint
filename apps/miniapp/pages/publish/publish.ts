Page({
  data: {
    circles: [
      { name: "学习搭子", icon: "学" },
      { name: "运动搭子", icon: "动" },
      { name: "校园生活", icon: "校" },
      { name: "二手闲置", icon: "集" },
    ],
    categories: ["学习", "运动", "校园生活", "二手"],
    selectedCircle: "运动搭子",
    selectedCategory: "运动",
    content: "",
    contentLength: 0,
  },

  onShow() {
    this.getTabBar()?.setData({ selected: 2 })
  },

  chooseCircle(event: WechatMiniprogram.TouchEvent) {
    const { name } = event.currentTarget.dataset as { name: string }
    this.setData({ selectedCircle: name })
  },

  chooseCategory(event: WechatMiniprogram.TouchEvent) {
    const { name } = event.currentTarget.dataset as { name: string }
    this.setData({ selectedCategory: name })
  },

  updateContent(event: WechatMiniprogram.TextareaInput) {
    const content = event.detail.value.slice(0, 500)
    this.setData({ content, contentLength: content.length })
  },

  showMediaNotice() {
    wx.showToast({ title: "图片上传下一阶段接入", icon: "none" })
  },

  submitPost() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: "先写点想分享的吧", icon: "none" })
      return
    }

    wx.showModal({
      title: "静态演示",
      content: "页面交互已完成，当前不会向后端提交内容。",
      showCancel: false,
    })
  },
})
