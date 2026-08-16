# Task 6｜Apple-style mobile interaction、性能与可访问性

## 状态

完成。没有改业务模型、版本号、Vault、飞书或生产数据。

## 变更

- `assets/app.css`：加入 mobile motion/material tokens；小屏触控目标最小 44px、定向 transition、安全区底部留白与 reduced-motion 覆盖；全文件无 `transition: all`。
- `src/legacy-app.mjs`：导航离开前以页面 ID 保存 `#content` 滚动位置到运行时 `Map`；页面进入后在 `requestAnimationFrame` 恢复。该状态不写入 storage 或同步。
- `src/app.mjs`：将活跃路由渲染命名为 `renderCurrentPage`（原调用保持兼容）；局部 AI、Agent、情报和刷新操作有 in-flight 去重与仅当前 Promise 存续期的 `aria-busy`/禁用状态。失败会清 busy，保留既有安全错误状态、输入和当前页面；L2 预览确认边界未改。
- `tests/mobile-interaction-performance.test.mjs`：覆盖 motion/accessibility 源码契约、多页差异滚动恢复、无持久化、AI 成功/失败/并发去重及局部 busy 协调。

## TDD 记录

RED：`node --test tests/mobile-interaction-performance.test.mjs`（基线 3 项失败：缺少 `--mobile-press-duration`、页面 scroll runtime memory、局部 busy/in-flight 约束）。

GREEN：同一命令最终 5/5 通过。

## 验证

定向回归：

```sh
node --test tests/mobile-interaction-performance.test.mjs tests/apple-interaction-system.test.mjs tests/app-composition.test.mjs tests/dashboard-production-fixes.test.mjs tests/intelligence-responsive-layout.test.mjs
```

结果：40/40 通过。

全量回归：

```sh
node --test tests/*.test.mjs
```

结果：681/681 通过。

静态检查：`git diff --check`、`node --check src/app.mjs`、`node --check src/legacy-app.mjs` 均通过；`rg 'transition:\\s*all' assets/app.css` 无匹配。

## 已知边界

- 滚动位置仅为当前标签页内存：刷新页面或新开标签页会回到默认位置，符合“不持久化、不同步”约束。
- 未做浏览器实机手势录屏；定向和全量自动化回归覆盖了状态、渲染和可访问性契约。
