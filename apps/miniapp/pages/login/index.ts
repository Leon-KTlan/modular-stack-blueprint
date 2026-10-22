// Set to the HTTPS domain registered as a request domain in the WeChat mini program console.
const API_BASE_URL = "https://api.example.com"
const TOKEN_KEY = "miniapp_access_token"

type MiniappUser = { id: string; nickname: string; avatarUrl: string | null; status: "active" | "disabled"; createdAt: string }
type ApiError = { error?: { code?: string; message?: string } }
type RequestError = { status: number; message: string }

type LoginPageData = {
  user: MiniappUser | null
  loading: boolean
  checkingSession: boolean
  hasStoredToken: boolean
  previewMode: boolean
  error: string
}

type LoginPageContext = {
  setData(data: Partial<LoginPageData>): void
}

function isApiConfigured(): boolean {
  return !API_BASE_URL.includes("example.com")
}

function request<T>(path: string, method: "GET" | "POST", token?: string, data?: object): Promise<T> {
  if (!isApiConfigured()) {
    return Promise.reject({
      status: 0,
      message: "登录服务尚未配置，请联系管理员",
    } satisfies RequestError)
  }

  return new Promise((resolve, reject) => wx.request({
    url: `${API_BASE_URL}${path}`, method, data,
    header: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    success(response) {
      if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T)
      else reject({ status: response.statusCode, message: (response.data as ApiError)?.error?.message || "登录暂时不可用，请稍后再试" })
    },
    fail() { reject({ status: 0, message: "网络连接失败，请稍后重试" }) },
  }))
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return fallback
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
    const user = await request<MiniappUser>("/api/miniapp/users/me", "GET", token)
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
    user: null as MiniappUser | null,
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
      const result = await request<{ accessToken: string; user: MiniappUser }>("/api/miniapp/auth/login", "POST", undefined, { code })
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
