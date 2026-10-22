/** WeChat mini program code2Session. Never log the request URL: it contains AppSecret and code. */
export type WechatLoginErrorCode = "WECHAT_LOGIN_CODE_INVALID" | "WECHAT_LOGIN_BLOCKED" | "WECHAT_LOGIN_RATE_LIMITED" | "WECHAT_SERVICE_ERROR"

export class WechatLoginError extends Error {
  constructor(readonly code: WechatLoginErrorCode) {
    super(code)
  }
}

export interface WechatIdentity {
  openid: string
  unionid: string | null
}

export async function exchangeWechatCode(code: string, config: { appId: string; appSecret: string }, request: typeof fetch = fetch): Promise<WechatIdentity> {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session")
  url.search = new URLSearchParams({ appid: config.appId, secret: config.appSecret, js_code: code, grant_type: "authorization_code" }).toString()
  let response: Response
  try {
    response = await request(url, { method: "GET", signal: AbortSignal.timeout(5000), redirect: "error" })
  } catch {
    throw new WechatLoginError("WECHAT_SERVICE_ERROR")
  }
  if (!response.ok) throw new WechatLoginError(response.status === 429 ? "WECHAT_LOGIN_RATE_LIMITED" : "WECHAT_SERVICE_ERROR")
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new WechatLoginError("WECHAT_SERVICE_ERROR")
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new WechatLoginError("WECHAT_SERVICE_ERROR")
  const result = data as Record<string, unknown>
  if (result.errcode !== undefined && result.errcode !== 0) {
    if (result.errcode === 40029 || result.errcode === 40163) throw new WechatLoginError("WECHAT_LOGIN_CODE_INVALID")
    if (result.errcode === 45011) throw new WechatLoginError("WECHAT_LOGIN_RATE_LIMITED")
    if (result.errcode === 40226) throw new WechatLoginError("WECHAT_LOGIN_BLOCKED")
    throw new WechatLoginError("WECHAT_SERVICE_ERROR")
  }
  if (typeof result.openid !== "string" || result.openid.length < 1 || result.openid.length > 64 ||
      typeof result.session_key !== "string" || !result.session_key ||
      (result.unionid !== undefined && (typeof result.unionid !== "string" || !result.unionid || result.unionid.length > 64))) {
    throw new WechatLoginError("WECHAT_SERVICE_ERROR")
  }
  // session_key is deliberately neither persisted nor exposed to the mini program.
  return { openid: result.openid, unionid: typeof result.unionid === "string" ? result.unionid : null }
}
