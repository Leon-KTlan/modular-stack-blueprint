// Set to the HTTPS domain registered as a request domain in the WeChat mini program console.
const API_BASE_URL = "https://api.example.com"
const TOKEN_KEY = "miniapp_access_token"

type MiniappUser = { id: string; nickname: string; avatarUrl: string | null; status: "active" | "disabled"; createdAt: string }
type ApiError = { error?: { code?: string; message?: string } }

declare const wx: {
  login(options: { success(result: { code: string }): void; fail(error: unknown): void }): void
  request(options: { url: string; method: "GET" | "POST"; header?: Record<string, string>; data?: object; success(result: { statusCode: number; data: unknown }): void; fail(error: unknown): void }): void
  getStorageSync(key: string): string | undefined
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
}
declare function Page(options: Record<string, unknown>): void

function request<T>(path: string, method: "GET" | "POST", token?: string, data?: object): Promise<T> {
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

Page({
  data: { user: null as MiniappUser | null, loading: false, error: "" },
  async onShow(this: { setData(data: object): void }) {
    const token = wx.getStorageSync(TOKEN_KEY)
    if (!token) return
    try {
      const user = await request<MiniappUser>("/api/miniapp/users/me", "GET", token)
      this.setData({ user, error: "" })
    } catch (error) {
      if ((error as { status: number }).status === 401) wx.removeStorageSync(TOKEN_KEY)
      this.setData({ user: null })
    }
  },
  async login(this: { setData(data: object): void }) {
    this.setData({ loading: true, error: "" })
    try {
      const code = await new Promise<string>((resolve, reject) => wx.login({ success: ({ code }) => code ? resolve(code) : reject(new Error("没有取得登录凭证")), fail: reject }))
      const result = await request<{ accessToken: string; user: MiniappUser }>("/api/miniapp/auth/login", "POST", undefined, { code })
      wx.setStorageSync(TOKEN_KEY, result.accessToken)
      this.setData({ user: result.user })
    } catch (error) {
      this.setData({ error: (error as { message?: string }).message || "登录失败，请重试" })
    } finally {
      this.setData({ loading: false })
    }
  },
  logout(this: { setData(data: object): void }) {
    wx.removeStorageSync(TOKEN_KEY)
    this.setData({ user: null, error: "" })
  },
})
