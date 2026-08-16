# ZOS CEO OS v2.10.0 生产验收记录

记录日期：2026-08-16
当前状态：PENDING。此文档只记录已执行证据；截至本记录，未 push、未部署、未访问正式站，未创建正式 `zos-workbench-v2.10.0` tag。

## 发布前本地证据

- 三轮独立完整自动化均为 686/686 通过、0 失败、0 跳过；详见 `docs/releases/zos-ceo-os-v2.10.0.md`。
- `git diff --check`、`node --check src/app.mjs`、`node --check src/legacy-app.mjs`、`node --check sw.js` 均通过。
- 已建立仅本地回滚 tag `zos-workbench-v2.9.0-mobile-preflight` → `87c784a`。

## 正式资源回读

| 资源 | HTTP 状态 | 版本/内容回读 | 状态 |
| --- | --- | --- | --- |
| `/zos-workbench/` | PENDING | `2.10.0` 页面入口 | PENDING |
| `/zos-workbench/manifest.json` | PENDING | `version = 2.10.0` | PENDING |
| `/zos-workbench/sw.js` | PENDING | `zos-workbench-v2.10.0` | PENDING |
| `/zos-workbench/src/app.mjs` | PENDING | 模块导入 `?v=2.10.0` | PENDING |
| `/zos-workbench/src/app/mobile-navigation.mjs` | PENDING | 可回读 | PENDING |
| `/zos-workbench/src/app/mobile-dashboard.mjs` | PENDING | 可回读 | PENDING |
| `/zos-workbench/src/app/mobile-agent-directory.mjs` | PENDING | 可回读 | PENDING |

## 四尺寸真实交互验收

所有以下项目均为 PENDING，尚未在正式 URL 或本地浏览器执行；不得据此视为通过。

| 视口 | 路由/交互 | 需观察结果 | 状态 |
| --- | --- | --- | --- |
| iPhone 390×844 | `#dashboard`、中央语音面板、`#agent-workbench`、`#calendar`、`#intelligence`、更多 | 正文非空；`scrollWidth <= innerWidth`；一次点击一次转场；控制台 0 error；语音权限失败后文字保留 | PENDING |
| Android 412×915 | 同上及键盘/语音回退 | 正文非空；无横向溢出；一次点击一次转场；控制台 0 error；语音回退保留文字 | PENDING |
| iPad 834×1194 | 同上 | 分栏和抽屉可用；无桌面表格溢出；正文非空；一次点击一次转场；控制台 0 error | PENDING |
| Desktop 1440×900 | 左侧导航与 `#dashboard` | 既有左侧导航和工作首页完整；无横向溢出；一次点击一次转场；控制台 0 error | PENDING |

## 明确延后项

- 原生 iOS、后台唤醒词、锁屏常驻和无需用户手势的监听未实施，保持不在本版生产验收范围。

## 放行规则

完成正式资源 HTTP 200/版本回读及四尺寸全部 PENDING 项后，才可创建并推送 `zos-workbench-v2.10.0` 正式 tag。任一项失败时不得打 tag；保留失败证据并以新的缓存世代修复重发。
