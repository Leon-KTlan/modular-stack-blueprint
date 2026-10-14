# 苍穹项目

## 项目定位

苍穹是一个面向 Web 的单体应用，包含用户前端、管理后台和 TypeScript 后端服务。

当前第一版技术方案采用：

- React + TypeScript 用户前端
- React + TypeScript 管理后台
- Fastify + TypeScript 后端
- 内部类型安全 SDK
- PostgreSQL 数据库
- 模块化单体架构
- RBAC 权限模型

## 文档

- [第一版技术方案](./docs/architecture/technical-solution-v1.md)
- [技术开发规范](./docs/development/development-guide-v1.md)
- [API 与 SDK 约定](./docs/api/api-conventions-v1.md)

## 文档状态

当前文档属于 V1 草案，用于统一开发方向和边界。具体业务模块、字段和权限点应在实现前通过模块设计文档或 ADR 继续补充。
