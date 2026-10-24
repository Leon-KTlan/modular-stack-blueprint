import { config, isApiConfigured } from "@/config";
import { sessionStorage } from "@/services/session-storage";

type ApiErrorBody = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code = "REQUEST_FAILED") {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authenticated?: boolean;
} = {}): Promise<T> {
  if (!isApiConfigured()) throw new ApiError(0, "尚未配置真机可访问的 API 地址", "API_NOT_CONFIGURED");
  const token = options.authenticated === false ? null : await sessionStorage.getToken();
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "无法连接服务端，请检查手机网络和 API 地址", "NETWORK_ERROR");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) {
    if (response.status === 401) await sessionStorage.clearToken();
    throw new ApiError(response.status, data.error?.message ?? "请求失败，请稍后重试", data.error?.code);
  }
  return data as T;
}
