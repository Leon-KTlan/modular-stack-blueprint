# 开耍小程序

微信原生小程序工程，使用 TypeScript、WXML 和 WXSS。

## 当前范围

- 已实现：五项自定义底部导航、首页、圈子、发布、消息、我的和帖子详情静态界面。
- 已实现：本地演示交互，包括点赞、圈子加入、分类选择和空内容校验。
- 未实现：微信登录、真实 API 请求、图片上传、搜索、关注、通知已读和私信。
- 页面中的用户、帖子、人数和消息均为明确标注的演示数据。

## 本地启动

1. 安装工作区依赖：

   ```bash
   pnpm install
   ```

2. 首次使用时创建本地项目配置：

   ```bash
   cp apps/miniapp/project.config.example.json apps/miniapp/project.config.json
   ```

3. 在 `project.config.json` 中填写自己的微信小程序 AppID。
4. 使用微信开发者工具导入 `apps/miniapp` 目录，后端服务选择“不使用云服务”。
5. 点击“编译”。

真实 `project.config.json` 和 `project.private.config.json` 已被 Git 忽略。AppSecret 只能配置在服务端环境变量中，不得写入小程序代码、Markdown 或 Git。

## 检查命令

```bash
pnpm --filter @cangqiong/miniapp typecheck
pnpm typecheck
pnpm build
```

微信开发者工具编译仍是 WXML、WXSS 和运行时行为的最终本地检查；TypeScript 类型检查不能替代它。

## 数据边界

- 所有业务 ID 接入接口后必须按字符串处理。
- 圈子只能由管理后台创建，小程序用户只能浏览、加入和退出。
- “运动搭子”当前仅作为已确认的产品方向和演示入口；数据库 seed 与接口尚未落地。
- 私信属于 V2，M1 不提供伪聊天能力。
