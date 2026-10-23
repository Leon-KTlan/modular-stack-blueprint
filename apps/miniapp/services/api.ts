// Replace this value with the HTTPS request domain registered in the WeChat mini program console.
export const API_BASE_URL = "https://api.example.com"
export const TOKEN_KEY = "miniapp_access_token"

type ApiError = { error?: { code?: string; message?: string } }
export type RequestError = { status: number; message: string }

export function isApiConfigured(): boolean {
  return !API_BASE_URL.includes("example.com")
}

export function getStoredToken(): string {
  return wx.getStorageSync(TOKEN_KEY) || ""
}

export function request<T>(path: string, options: {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  token?: string | null
  data?: object
} = {}): Promise<T> {
  if (!isApiConfigured()) {
    return Promise.reject({ status: 0, message: "服务尚未配置，请联系管理员" } satisfies RequestError)
  }
  const token = options.token === undefined ? getStoredToken() : options.token
  return new Promise((resolve, reject) => wx.request({
    url: `${API_BASE_URL}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    success(response) {
      if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T)
      else reject({ status: response.statusCode, message: (response.data as ApiError)?.error?.message || "请求失败，请稍后再试" } satisfies RequestError)
    },
    fail() { reject({ status: 0, message: "网络连接失败，请稍后重试" } satisfies RequestError) },
  }))
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return fallback
}
