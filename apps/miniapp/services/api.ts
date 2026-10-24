// Replace this value with the HTTPS request domain registered in the WeChat mini program console.
export const API_BASE_URL = "https://api.example.com"
export const TOKEN_KEY = "miniapp_access_token"

type ApiError = { error?: { code?: string; message?: string; details?: unknown; requestId?: string } }
export type RequestError = { status: number; message: string; code?: string; details?: unknown; requestId?: string; serverDate?: string }
export type ResponseMeta = { status: number; serverDate?: string }

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
  baseURL?: string
  headers?: Record<string, string>
  onResponse?: (meta: ResponseMeta) => void
} = {}): Promise<T> {
  if (!options.baseURL && !isApiConfigured()) {
    return Promise.reject({ status: 0, message: "服务尚未配置，请联系管理员" } satisfies RequestError)
  }
  const token = options.token === undefined ? getStoredToken() : options.token
  return new Promise((resolve, reject) => wx.request({
    url: `${options.baseURL ?? API_BASE_URL}${path}`,
    method: options.method ?? "GET",
    data: options.data,
    header: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...options.headers },
    success(response) {
      const dateHeader = Object.entries(response.header).find(([key]) => key.toLowerCase() === "date")?.[1]
      const serverDate = typeof dateHeader === "string" ? dateHeader : undefined
      options.onResponse?.({ status: response.statusCode, serverDate })
      if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.statusCode === 204 ? undefined as T : response.data as T)
      else {
        const error = (response.data as ApiError)?.error
        reject({ status: response.statusCode, message: error?.message || "请求失败，请稍后再试", code: error?.code, details: error?.details, requestId: error?.requestId, serverDate } satisfies RequestError)
      }
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
