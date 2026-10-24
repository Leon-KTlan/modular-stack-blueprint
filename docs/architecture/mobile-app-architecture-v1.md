# “开耍”Expo Android App 架构 V1

- **状态**：黑客松实施基线
- **目标**：两天内通过 Expo Go 在 Android 真机演示真实帖子主流程
- **客户端目录**：`apps/mobile`
- **共享服务端**：`apps/server`

## 1. 决策与边界

移动端固定使用 Expo SDK 54、React Native 0.81.5、React 19.1、TypeScript 和 Expo Router 6。Expo Go 是本阶段唯一交付载体，不生成 APK/AAB，不进入应用商店。升级 Expo SDK 必须作为单独任务验证，不跟随脚手架自动升级。

`apps/mobile` 是独立客户端，禁止修改 `apps/miniapp`。两端只共享后端契约和十进制字符串 ID，不共享页面、导航或样式实现。服务端改动必须是向后兼容的新增，不能改变现有小程序路由语义。

## 2. 目标能力

已纳入本阶段：

- 演示用户登录和 JWT 恢复。
- 帖子列表、详情、点赞/取消点赞。
- 一级评论列表和发表评论。
- 纯文字发布。
- 个人资料展示。
- 圈子和消息的明确降级页。
- 加载、空数据、无网络、401 失效状态。

非目标：

- APK/AAB、应用商店、推送、私信、实时通知。
- 图片/视频上传、搜索、推荐算法。
- 微信身份与移动 App 身份互通。
- 数据库结构调整和跨端 UI 组件库。

## 3. 目录与职责

```text
apps/mobile/
├── src/app/              # Expo Router 页面，只处理展示和页面交互
├── src/components/       # 最小可复用视图组件
├── src/services/         # API client、认证和 SecureStore
├── src/data/             # 明确标记的离线演示数据
├── src/types/            # HTTP DTO，所有社区 ID 为 string
├── src/theme/            # 橙绿校园视觉令牌
├── src/config.ts         # 公开运行配置与校验
└── assets/               # 复制后的 App 自有静态资源
```

不为单一页面建立 repository/store 层。页面超过两处共享的状态或行为才提取组件或 service。

## 4. 运行与数据流

```text
Expo Router 页面
  -> src/services/api.ts
  -> Authorization: Bearer <JWT>
  -> apps/server Fastify API
  -> PostgreSQL
```

`EXPO_PUBLIC_API_BASE_URL` 提供真机可访问的服务端地址。Android 真机不能使用只指向电脑自身的 `localhost`；局域网测试需使用电脑局域网地址，并让服务端显式配置 `HOST=0.0.0.0`，远程演示使用 HTTPS 地址。仅在可信局域网临时开放监听，演示结束后恢复默认 `127.0.0.1`。

Token 只通过 Expo SecureStore 读写。请求层统一负责 JSON、Authorization、错误解析和 401 清理，页面不得直接调用 SecureStore 或拼接认证头。

## 5. 演示认证

新增 `POST /api/mobile/auth/demo`，复用现有 `miniapp_users` 演示记录和小程序用户 JWT 格式，因此其余社区 API 无需复制。

路由仅在以下条件全部满足时工作：

1. `NODE_ENV !== production`。
2. `MOBILE_DEMO_AUTH_ENABLED=true`。
3. `MOBILE_DEMO_USER_ID` 是有效十进制 BIGINT 且对应启用用户。
4. `MINIAPP_JWT_SECRET` 已配置。

任何配置缺失均返回稳定错误；生产环境始终返回 `404`。客户端不保存固定 Token、账号或密码。

## 6. 视觉方向

沿用小程序的“橙绿校园”方向：暖白 `#FFF9F1` 背景、橙色 `#FF641E` 主行动、深绿 `#174C3B` 品牌色。移动端保留护照章、校园公告板、粗线图形等识别元素，但按 React Native 布局重新实现，不逐行翻译 WXSS。

底部导航保留“首页 / 圈子 / 发布 / 消息 / 我的”。发布入口是中心强调动作；未接入的消息能力展示诚实的阶段说明。

## 7. 兼容性和失败策略

- 接口不可达：展示重试和离线演示说明，不自动伪造成功。
- JWT 失效：清理 SecureStore 并返回登录页。
- 发布条件不足：展示服务端原始业务消息，不在客户端假写成功帖子。
- 圈子/分类选择：优先使用真实接口；接口不足时使用标注为演示配置的固定 ID，正式环境不得沿用。
- 所有 BIGINT ID 保持字符串，不参与数值运算。

## 8. 演进出口

黑客松后若继续产品化，按顺序替换演示认证、补齐用户圈子查询、实现正式移动端身份体系、媒体上传、通知和发布构建。演示登录接口应在正式身份上线后删除，而不是长期扩展。
