import assert from "node:assert/strict"
import { test } from "node:test"
import { exchangeWechatCode, WechatLoginError } from "./wechat-login.js"

const config = { appId: "mock-app-id", appSecret: "mock-secret" }
function mockResponse(body: unknown, status = 200): typeof fetch {
  return (async (input) => {
    const url = new URL(String(input))
    assert.equal(url.origin, "https://api.weixin.qq.com")
    assert.equal(url.searchParams.get("grant_type"), "authorization_code")
    assert.equal(url.searchParams.get("js_code"), "code-once")
    assert.equal(url.searchParams.get("secret"), config.appSecret)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}

test("code2Session returns only identity, ignores session key", async () => {
  assert.deepEqual(await exchangeWechatCode("code-once", config, mockResponse({ openid: "open-id", session_key: "secret-key", unionid: "union-id" })), {
    openid: "open-id", unionid: "union-id",
  })
  assert.deepEqual(await exchangeWechatCode("code-once", config, mockResponse({ openid: "open-id", session_key: "secret-key" })), {
    openid: "open-id", unionid: null,
  })
})

test("WeChat error codes are classified without exposing response body", async () => {
  for (const [wechatCode, expected] of [[40029, "WECHAT_LOGIN_CODE_INVALID"], [40163, "WECHAT_LOGIN_CODE_INVALID"], [45011, "WECHAT_LOGIN_RATE_LIMITED"], [40226, "WECHAT_LOGIN_BLOCKED"], [-1, "WECHAT_SERVICE_ERROR"]] as const) {
    await assert.rejects(exchangeWechatCode("code-once", config, mockResponse({ errcode: wechatCode, errmsg: "sensitive" })), (error: unknown) =>
      error instanceof WechatLoginError && error.code === expected && !error.message.includes("sensitive"))
  }
})

test("malformed, HTTP and network responses are service errors", async () => {
  for (const request of [mockResponse({ openid: "abc" }), mockResponse({ openid: "abc", session_key: "k", unionid: 3 }), mockResponse({}, 500), (async () => { throw new Error("secret in URL") }) as typeof fetch]) {
    await assert.rejects(exchangeWechatCode("code-once", config, request), (error: unknown) => error instanceof WechatLoginError && error.code === "WECHAT_SERVICE_ERROR" && !error.message.includes("secret"))
  }
})
