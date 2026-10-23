import { getErrorMessage, isApiConfigured, request, TOKEN_KEY } from "../../services/api"
import type { MiniappUserSummary } from "../../types/models"

type LoginPageData = {
  user: MiniappUserSummary | null
  loading: boolean
  checkingSession: boolean
  hasStoredToken: boolean
  previewMode: boolean
  error: string
}

type LoginPageContext = {
  setData(data: Partial<LoginPageData>): void
}

async function restoreSession(page: LoginPageContext): Promise<void> {
  if (!isApiConfigured()) {
    page.setData({
      user: null,
      checkingSession: false,
      hasStoredToken: false,
      error: "",
    })
    return
  }

  const token = wx.getStorageSync(TOKEN_KEY)
  if (!token) {
    page.setData({ checkingSession: false, hasStoredToken: false })
    return
  }

  page.setData({ checkingSession: true, hasStoredToken: true, error: "" })

  try {
    const user = await request<MiniappUserSummary>("/api/miniapp/users/me", { token })
    page.setData({ user, checkingSession: false, error: "" })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401) {
      wx.removeStorageSync(TOKEN_KEY)
      page.setData({
        user: null,
        checkingSession: false,
        hasStoredToken: false,
        error: "登录状态已过期，请重新登录",
      })
      return
    }

    page.setData({
      user: null,
      checkingSession: false,
      hasStoredToken: true,
      error: getErrorMessage(error, "暂时无法确认登录状态，请稍后重试"),
    })
  }
}

Page({
  data: {
    user: null as MiniappUserSummary | null,
    loading: false,
    checkingSession: true,
    hasStoredToken: false,
    previewMode: !isApiConfigured(),
    error: "",
  },
  onShow(this: LoginPageContext) {
    void restoreSession(this)
  },
  retrySession(this: LoginPageContext) {
    void restoreSession(this)
  },
  async login(this: LoginPageContext) {
    if (!isApiConfigured()) {
      wx.switchTab({ url: "/pages/home/home" })
      return
    }

    this.setData({ loading: true, error: "" })
    try {
      const code = await new Promise<string>((resolve, reject) => wx.login({ success: ({ code }) => code ? resolve(code) : reject(new Error("没有取得登录凭证")), fail: reject }))
      const result = await request<{ accessToken: string; user: MiniappUserSummary }>("/api/miniapp/auth/login", { method: "POST", token: null, data: { code } })
      wx.setStorageSync(TOKEN_KEY, result.accessToken)
      this.setData({ user: result.user, hasStoredToken: true })
      wx.switchTab({ url: "/pages/home/home" })
    } catch (error) {
      this.setData({ error: getErrorMessage(error, "登录失败，请重试") })
    } finally {
      this.setData({ loading: false })
    }
  },
  logout(this: LoginPageContext) {
    wx.removeStorageSync(TOKEN_KEY)
    this.setData({ user: null, hasStoredToken: false, error: "" })
  },
})
