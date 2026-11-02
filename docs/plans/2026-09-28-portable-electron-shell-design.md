# AI 智慧门店便携桌面版封装设计

## 目标

将现有的 `smartstore-desktop.html` 静态原型封装为可离线运行的 Windows 便携版 EXE，供功能确认与演示使用。

## 架构

- 静态原型及其 `assets/` 原样复制进项目的 `static/` 目录。
- Electron 主进程仅创建桌面窗口并加载打包资源；不提供业务 API、不调用网络服务。
- `electron-builder` 使用 Windows `portable` 目标，输出单文件可执行程序。

## 运行与错误处理

- 生产包从 Electron `resources/static/` 加载 HTML，开发态从项目 `static/` 加载。
- 禁用应用菜单；窗口打开失败时显示错误页，方便演示人员定位资源缺失问题。
- 使用安全默认项：隔离渲染进程、禁用 Node 集成、限制新窗口到系统浏览器。

## 验收

1. `npm run package` 能生成 `release/AI智慧门店-原型.exe`。
2. 打包文件包含 HTML 和全部静态资源。
3. 启动后展示现有桌面原型，且离线可用。
