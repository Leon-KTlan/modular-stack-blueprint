# 开耍 Expo App

Android 黑客松演示客户端，固定使用 Expo SDK 54，适配对应版本的 Expo Go。它与 `apps/miniapp` 独立，不修改微信小程序代码。

## 启动

1. 将 `.env.example` 复制为 `.env.local`，把 API 地址改为 Android 手机可访问的局域网地址或 HTTPS 地址。
2. 服务端非生产环境配置 `MOBILE_DEMO_AUTH_ENABLED=true`、`MOBILE_DEMO_USER_ID` 和 `MINIAPP_JWT_SECRET`；安卓真机走局域网时还需设置 `HOST=0.0.0.0`。
3. 在终端运行（升级或降级 SDK 后先清除 Metro 缓存）：

```bash
cd /Users/leon/Desktop/Code/modular-stack-blueprint/apps/mobile
./node_modules/.bin/expo start --clear --port 8081
```

手机与电脑连接同一 Wi-Fi，用支持 SDK 54 的 Android Expo Go 扫描二维码。终端使用端口 8081，按 `Ctrl+C` 停止。未配置 API 时仍可进入明确标记的离线预览；离线预览不会伪造发布或评论写入。

## 检查

```bash
pnpm --filter @cangqiong/mobile typecheck
pnpm --filter @cangqiong/mobile lint
pnpm --filter @cangqiong/mobile doctor
```
