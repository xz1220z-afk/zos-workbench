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

## Fix round 1/5（2026-08-16）

### 修复范围

- Agent 任务分析改为以 `archiveId` 为键的 in-flight Map，并以 `localBusy.agentTaskArchives` 精确跟踪；重复点击共用同一 Promise，失败仅清该任务 busy，草稿和重试入口保留。不同 archive 不互相清理。
- 来源刷新改为 `localBusy.refreshSources` 集合；各来源按钮只反映自己的 Promise 生命周期。
- 情报问答改为以 `externalId` 分区的 Promise Map 和问题/回答状态；旧问题的成功或失败不会改写当前 drawer 的新问题，切回后仍保留该题输入与重试状态。
- Agent 详情与移动 AI sheet 的关闭按钮均调整为实际 `44px × 44px`；原有 reduced-motion 规则保持不变。

### 严格 TDD 记录

RED：先新增 `tests/mobile-interaction-followup.test.mjs`，执行：

```sh
node --test tests/mobile-interaction-followup.test.mjs
```

结果：4 项失败（Agent 双击实际触发 2 次；刷新无 `refreshSources`；Q1/Q2 被全局问答 Promise 串行；两个 close selector 缺少 44px 尺寸）。

GREEN：实现后，先补 Agent 失败后真实重试断言，执行同一命令结果为 4/4 通过。

### 验证

定向回归：

```sh
node --test tests/mobile-interaction-performance.test.mjs tests/mobile-interaction-followup.test.mjs tests/apple-interaction-system.test.mjs tests/app-composition.test.mjs tests/dashboard-production-fixes.test.mjs tests/intelligence-responsive-layout.test.mjs tests/v2-app-actions.test.mjs tests/intelligence-question-actions.test.mjs tests/intelligence-edge.test.mjs tests/intelligence-center.test.mjs tests/auto-refresh-controller.test.mjs
```

结果：72/72 通过。

全量回归：

```sh
node --test tests/*.test.mjs
```

结果：685/685 通过。

静态检查：`git diff --check`、`node --check src/app.mjs`、`node --check src/legacy-app.mjs` 通过；`rg 'transition:\\s*all' assets/app.css` 无匹配。

## Fix round 2/5（2026-08-16）

### 修复范围

- 直接 Agent 分析的 in-flight 由单个 Promise 改为按 `agentId` 的 Map，因而同一 Agent 重入复用同一请求、不同 Agent 可独立并发。
- 直接 Agent 分析状态同样按 `agentId` 存在 `runtime.agentAnalysisStates`；当前详情只显示当前 Agent 的状态，旧 Agent 的完成或失败不会覆盖另一个 Agent 的结果。
- `localBusy.agentIds` 的状态粒度与上述 Promise Map 一致：每个 Agent 的按钮仅在自己的请求期间 `aria-busy`/禁用。

### 严格 TDD 记录

RED：先新增“direct Agent analysis partitions concurrent work, busy state, and outcomes by Agent ID”行为测试，执行：

```sh
node --test tests/mobile-interaction-followup.test.mjs
```

结果：5 项中 1 项按预期失败；旧全局 `agentAnalysisWork` 仅调用 `WANJIA-001`，`HUAHUO-001` 未发起真实调用。

GREEN：改为 ID Map 并按 ID 保存结果/错误后，执行同一命令结果为 5/5 通过。测试覆盖 A/A 重入仅一条调用、A/B 各自真实调用、B 完成不清 A busy、以及 A 错误与 B 成功的状态归属。

### 验证

定向回归：

```sh
node --test tests/mobile-interaction-followup.test.mjs tests/mobile-interaction-performance.test.mjs tests/agent-os-view.test.mjs tests/v2-app-actions.test.mjs tests/app-actions.test.mjs tests/intelligence-question-actions.test.mjs
```

结果：32/32 通过。

全量回归：

```sh
node --test tests/*.test.mjs
```

结果：686/686 通过。

静态检查：`git diff --check` 与 `node --check src/app.mjs` 通过。

## 最终审查 Important 2（2026-08-16）

### 修复范围

- 按住说话现在按 `pointerId` 跟踪完整生命周期；即使手指移出按钮，匹配的 `pointerup` 仍会结束当前收音，其他指针不会误停。
- 按住期间的转写先存在临时 session；`pointerup` 使用 stop/commit，`pointercancel` 和关闭移动 AI sheet 使用 abort/discard，取消不会覆盖原有键盘草稿。
- 指针在 240ms 阈值前移出、取消或关闭 sheet 会清除延迟定时器，不会在明确手势结束后开始收音。
- abort 后通过 voice generation 隔离旧 recognition 回调，迟到的转写结果不会再改写输入。保留点击开始和显式 API 手势，没有持续监听。

### TDD 记录

RED：新增 `tests/mobile-voice-pointer-lifecycle.test.mjs` 后执行：

```sh
node --test tests/mobile-voice-pointer-lifecycle.test.mjs
```

结果：0/4 通过。四项分别因为语音提前覆盖键盘草稿、移出后仍延迟启动、`pointercancel` 未 abort、关闭 sheet 未清除 pending timer 而失败。

GREEN：实现最小 pointer/session 修复后，同一命令 4/4 通过。

### 定向验证

```sh
node --test tests/mobile-voice-pointer-lifecycle.test.mjs tests/ai-command-voice-integration.test.mjs tests/voice-input.test.mjs tests/mobile-command-sheet.test.mjs tests/mobile-command-sheet-accessibility.test.mjs tests/mobile-high-frequency-flows.test.mjs
```

结果：23/23 通过。
