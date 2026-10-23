import { getErrorMessage, isApiConfigured, request, TOKEN_KEY } from "../../services/api"
import { cacheProfile, clearProfileCache, getCachedProfile } from "../../services/profile"
import type { MiniappProfile } from "../../types/models"

type Gender = MiniappProfile["gender"]

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/[\t\r\n ]+/g, " ").trim()
}

function normalizeBio(value: string): string {
  return value.replace(/[\t\r\n ]+/g, " ").trim()
}

function validNickname(value: string): boolean {
  const length = [...value].length
  return length >= 2 && length <= 20 && /^[\p{L}\p{N}_·\- ]+$/u.test(value)
}

function genderLabel(gender: Gender): string {
  return gender === "male" ? "男" : gender === "female" ? "女" : "保密"
}

Page({
  data: {
    profile: getCachedProfile(),
    avatarText: "游",
    genderLabel: "保密",
    saving: false,
  },

  onLoad() {
    this.applyProfile(getCachedProfile())
  },

  applyProfile(profile: MiniappProfile) {
    this.setData({
      profile,
      avatarText: [...profile.nickname][0] || "游",
      genderLabel: genderLabel(profile.gender),
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/profile/profile" }) })
  },

  async saveChange(values: Partial<Pick<MiniappProfile, "nickname" | "bio" | "gender">>) {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const profile = isApiConfigured()
        ? await request<MiniappProfile>("/api/miniapp/users/me", { method: "PUT", data: values })
        : { ...this.data.profile, ...values }
      cacheProfile(profile)
      this.applyProfile(profile)
      wx.showToast({ title: "已保存", icon: "success" })
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error, "保存失败，请重试"), icon: "none" })
    } finally {
      this.setData({ saving: false })
    }
  },

  editNickname() {
    wx.showModal({
      title: "修改昵称",
      content: this.data.profile.nickname,
      editable: true,
      placeholderText: "2-20 个中英文、数字或 _·-",
      success: (result) => {
        if (!result.confirm) return
        const nickname = normalizeText(result.content || "")
        if (!validNickname(nickname)) {
          wx.showToast({ title: "昵称格式不符合要求", icon: "none" })
          return
        }
        void this.saveChange({ nickname })
      },
    })
  },

  editBio() {
    wx.showModal({
      title: "修改个人简介",
      content: this.data.profile.bio || "",
      editable: true,
      placeholderText: "最多 100 字",
      success: (result) => {
        if (!result.confirm) return
        const bio = normalizeBio(result.content || "") || null
        if (bio && ([...bio].length > 100 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(bio))) {
          wx.showToast({ title: "个人简介最多 100 字", icon: "none" })
          return
        }
        void this.saveChange({ bio })
      },
    })
  },

  editGender() {
    const options: Gender[] = ["male", "female", "private"]
    wx.showActionSheet({
      itemList: ["男", "女", "保密"],
      success: ({ tapIndex }) => void this.saveChange({ gender: options[tapIndex] }),
    })
  },

  chooseAvatar() {
    if (isApiConfigured()) {
      wx.showToast({ title: "头像上传需先配置对象存储", icon: "none" })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: ({ tempFiles }) => {
        const tempFilePath = tempFiles[0]?.tempFilePath
        if (!tempFilePath) return
        wx.getFileSystemManager().saveFile({
          tempFilePath,
          success: ({ savedFilePath }) => {
            const profile = { ...this.data.profile, avatarUrl: savedFilePath }
            cacheProfile(profile)
            this.applyProfile(profile)
            wx.showToast({ title: "已保存到本机预览", icon: "none" })
          },
          fail: () => wx.showToast({ title: "头像保存失败", icon: "none" }),
        })
      },
    })
  },

  switchAccount() {
    wx.removeStorageSync(TOKEN_KEY)
    clearProfileCache()
    wx.reLaunch({ url: "/pages/login/index" })
  },
})
