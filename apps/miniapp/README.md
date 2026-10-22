# “开耍”小程序登录入口（最小可运行原生工程）

本目录仅实现登录页、微信登录与当前用户资料展示，不表示五个主导航及其他业务页面已完成。

1. 微信开发者工具导入本目录作为小程序项目，使用你自己的**小程序 AppID**（`project.config.json` 中的 `touristappid` 仅是占位；不要用移动应用 AppID）。项目已启用开发者工具内置 TypeScript 编译插件，使用支持该插件的工具版本；工具写入的测试号和 `project.private.config.json` 不要提交。
2. 在服务端环境配置 `MINIAPP_JWT_SECRET`（与后台 `JWT_SECRET` 不同）、`WECHAT_MINIAPP_APP_ID`、`WECHAT_MINIAPP_APP_SECRET`；绝不将真实 AppSecret 写入本目录。部署时服务端可访问 `api.weixin.qq.com`。
3. 将 `pages/login/index.ts` 的 `API_BASE_URL` 替换成后端的 HTTPS 域名，在微信公众平台将该域名登记为小程序 request 合法域名。开发工具中临时关闭域名校验只适合本地调试，不是正式部署方案。
4. 点击“微信快捷登录”触发 `wx.login`，将一次性 code 发送给 `POST /api/miniapp/auth/login`。成功后本地保存自有 JWT，进入页面时调用 `GET /api/miniapp/users/me` 验证有效性。401 会清除缓存令牌；退出按钮仅清理本机缓存，**不是服务端撤销其他设备令牌**。

目前无法用占位 AppID/Secret 进行真实微信端到端登录；后端可通过独立的模拟微信响应测试验证。完整业务小程序页面、令牌刷新/服务端退出、头像和昵称编辑均未实现。
