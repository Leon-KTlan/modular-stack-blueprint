# “开耍”小程序（原生微信小程序预览工程）

本目录已实现登录入口、五个主导航页面和帖子详情页。内部页面当前使用演示数据，方便先在微信开发者工具中检查页面与交互；真实账号、圈子、帖子及消息数据仍需后端接口接入。

1. 微信开发者工具导入本目录作为小程序项目，使用你自己的**小程序 AppID**（`project.config.json` 中的 `touristappid` 仅是占位；不要用移动应用 AppID）。项目已启用开发者工具内置 TypeScript 编译插件，使用支持该插件的工具版本；工具写入的测试号和 `project.private.config.json` 不要提交。
2. 在服务端环境配置 `MINIAPP_JWT_SECRET`（与后台 `JWT_SECRET` 不同）、`WECHAT_MINIAPP_APP_ID`、`WECHAT_MINIAPP_APP_SECRET`；绝不将真实 AppSecret 写入本目录。部署时服务端可访问 `api.weixin.qq.com`。
3. 将 `pages/login/index.ts` 的 `API_BASE_URL` 替换成后端的 HTTPS 域名，在微信公众平台将该域名登记为小程序 request 合法域名。开发工具中临时关闭域名校验只适合本地调试，不是正式部署方案。
4. `API_BASE_URL` 仍为占位值时，登录页显示“内部页面预览”，点击后直接进入首页，不发起微信登录；配置正式地址后，点击“微信快捷登录”会触发 `wx.login`，将一次性 code 发送给 `POST /api/miniapp/auth/login`。成功后本地保存自有 JWT 并进入首页。401 会清除缓存令牌；退出按钮仅清理本机缓存，**不是服务端撤销其他设备令牌**。

当前可预览首页、圈子、发布、消息、我的和帖子详情。其中首页分类卡可筛选信息流，热门话题卡可进入对应帖子详情。真实微信端到端登录仍需要有效的小程序 AppID、AppSecret、HTTPS API 地址和合法域名配置；令牌刷新、服务端退出、头像昵称编辑及业务数据接口尚未接入。
