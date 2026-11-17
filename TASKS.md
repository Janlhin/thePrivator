# TASKS.md

> 任务队列与待裁决清单的唯一出处。状态值只能取 TASK_BACKLOG / TASK_READY / TASK_IN_PROGRESS / TASK_BLOCKED / TASK_REVIEW / TASK_TESTING / TASK_DONE / TASK_CANCELLED。
> 已决条目不删除；台账条目必须含提出时间、问题、解决方法、解决时间。
> 每条任务的完成判据必须能机器判定：写命令 + 期望退出码，不写「看起来对」。

## 任务队列

| ID | 目标 | 动作 | 依赖 | 可逆性 | 完成判据（可机器判定） | 状态 | 创建时间 | 完成时间 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | 修复套件唯一失败项 | 统一 4 个 m005 脚本的 Python 解释器解析，探测名按目标平台而非宿主平台 | 无 | 高 | `vp test` 退出 0 且 47/47 文件通过 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-002 | 建立治理文档 | 新建 `AGENTS.md`、`DECISIONS.md`、`TASKS.md`、`MANIFEST.md` | T-001 | 高 | 四文件存在；`AGENTS.md` 行数 ≤150；`DECISIONS.md` 每条含六个字段 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-003 | README 补齐工程字段 | 追加技术栈与版本、顶层目录职责、验收命令与期望退出码、已知限制、顶端提交验证声明 | T-002 | 高 | `README.md` 含 7 个必填小节标题；`npm run verify` 命令串与 `package.json` 一致 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-004 | 根目录白名单对齐 | 散文移 `docs/`、截图移 `img/`，更新引用 | T-003 | 中 | `git ls-files` 根级不再含 `FINGERPRINTING_V3.md` 与 `browserleaks-*.png`；两文件位于 `docs/`、`img/`；引用数为 0 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-005 | 严格类型：未使用与语义检查 | `tsconfig.json` 开启 `noUnusedLocals`、`noUnusedParameters`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`verbatimModuleSyntax`，并清掉 4 处未使用绑定（含一条从未接线的 `onSaveNotes` prop 链） | T-003 | 中 | `tsc --noEmit` 退出 0；`tsconfig.json` 上述五项均为 `true` | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-014 | 严格类型：可空索引访问 | 开启 `noUncheckedIndexedAccess` 并修完实测 82 处错误 | T-005 | 中 | `tsc --noEmit` 退出 0；`noUncheckedIndexedAccess` 为 `true` | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-015 | 严格类型：精确可选属性 | 开启 `exactOptionalPropertyTypes` 并修完实测 32 处错误 | T-014 | 中 | `tsc --noEmit` 退出 0；`exactOptionalPropertyTypes` 为 `true` | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-006 | Lint 与格式门禁 | `vp lint` 因缺 `tsrs-lint` 的 `.bin` shim 不可用，改由 `scripts/verify.ps1` 直接调用 `node_modules/.bin/oxlint.ps1 --deny-warnings`；格式仍走 `vp fmt --check`（D-010） | T-003 | 高 | `npm run lint` 退出 0 且输出 `Found 0 warnings and 0 errors.`；`npm run format:check` 退出 0 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-007 | 样式门禁 | 装 `stylelint` 与 `stylelint-config-standard`，`color-no-hex` 仅对 `tokens.css` 放行，`!important` 只在 reduced-motion 块内以注释豁免 | T-006 | 高 | `npm run stylelint` 退出 0 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-008 | 覆盖率门禁 | 装 `@vitest/coverage-v8`，把 `coverage.include` 收窄到交付源码后测基线（语句 87.51%、分支 82.08%），阈值取语句 80%、分支 70%（D-012） | T-001 | 中 | `npm test` 在覆盖率不达标时退出非零，达标时退出 0 | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-009 | 死代码与重复检查 | 装 `knip`、`jscpd`，排除项写进 `knip.json` 与 `.jscpd.json`（D-014）；`knip --fix` 不开 `--allow-remove-files` | T-008 | 高 | `npm run deadcode` 与 `npm run dupes` 均退出 0；`knip.json` 无 `--allow-remove-files` | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-010 | PowerShell 单入口 | 新增 `scripts/verify.ps1`、`scripts/format.ps1`、`scripts/hooks/*.ps1`、husky 薄壳（LF）、`commitlint.config.js`、`lint-staged` 配置、`.npmrc` | T-006 | 中 | `npm run verify` 退出 0；`git commit` 触发两条钩子；两个 husky 文件行尾为 LF | TASK_DONE | 2026-11-17 | 2026-11-17 |
| T-011 | CI 统一 pwsh | 工作流加 `defaults.run.shell: pwsh`，全部步骤 `shell: pwsh`，保留 `npm ci` | T-010 | 中 | 工作流文件无 `shell: cmd` / `shell: powershell`；`npm ci` 出现且无 `npm install` | TASK_BACKLOG | 2026-11-17 | — |
| T-012 | 文档三层校验 | 接入 markdownlint、链接校验、代码块抽取实跑 | T-011 | 高 | 三条命令退出 0；断链数为 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-016 | 消除 `set-state-in-effect` 告警 | 重构 10 处「在 effect 里同步派生状态」的组件，改为在事件处理或 reducer 中派生；完成后撤销 D-013 对该规则的豁免 | T-010 | 低 | `react/set-state-in-effect` 恢复为 error 后 `npm run lint` 退出 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-017 | `scripts/` 纳入 lint | 清掉 70 条历史告警（28 处多余转义、26 处未使用变量等）后，从 `.oxlintrc.json` 的 `ignorePatterns` 移除 `scripts/**` | T-006 | 中 | `npm run lint` 覆盖 `scripts/` 且退出 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-018 | E2E 通道 | 二选一：新建 `playwright.config.ts` 与 `test:e2e`，或把 `scripts/verify-s06.mjs` 的 WebDriver 路径登记为等价通道并写入 README | T-010 | 中 | 选定方案后 `npm run test:e2e` 或登记命令退出 0，README 有对应命令 | TASK_BACKLOG | 2026-11-17 | — |
| T-019 | 根目录白名单比对脚本 | 新增 `scripts/check-root-whitelist.ps1`，用 `git ls-files` 与 README 顶层目录表逐条比对 | T-010 | 高 | 脚本退出 0；根级未登记项数为 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-020 | 脚本基线检查 | 新增 `scripts/check-script-baseline.ps1`：仓库内 `.cmd`/`.bat` 数为 0、项目自写代码中 `cmd.exe`/`powershell.exe` 调用数为 0、入口一律 `pwsh -File` | T-010 | 高 | 脚本退出 0；三项计数均为 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-021 | 双入口收敛 | `deno.json` 的 `deno task` 与 `package.json` 的 `npm run` 目前并存；选定一套为主、另一套降级为别名 | T-010 | 中 | 只保留一套执行 `node node_modules/vite-plus/dist/bin.js` 的定义；另一套为 `pwsh -File` 转发 | TASK_BACKLOG | 2026-11-17 | — |
| T-022 | cookie 健康检查 | 档案表增一列：身份 cookie 距过期天数、上次探活时间与结果；判定抽成纯函数（401、重定向到登录页、登录页特征视为失效），默认只提示不自动重登。**账号数量不设上限**：列与筛选都必须支持任意行数，不得按固定账号清单设计 | T-010 | 中 | `npm run verify` 退出 0；新增判定函数有单测覆盖；组件测试断言该列在 0、1、多行三种数据下都渲染 | TASK_BACKLOG | 2026-11-17 | — |
| T-023 | CI 工作流未被索引 | 三路排查：索引缓存、`ci.yml` 被判定无效、仓库设置；以 `gh api repos/Janlhin/thePrivator/actions/workflows` 的 `total_count` 为判据 | T-010 | 高 | `total_count` 大于 0，且新建 PR 上出现检查项 | TASK_READY | 2026-11-17 | — |
| T-024 | 开源入口文档 | README 增「从零跑起来」（工具链版本、`npm ci`、`npm run verify`）与「提 PR」（提交规范、提交前必过 verify）两节 | T-023 | 高 | README 含这两节；按文档从干净环境能走到 `verify passed` | TASK_BACKLOG | 2026-11-17 | — |

## 待裁决清单

| 提出时间 | 问题 | 备选与取舍 | 状态 |
| --- | --- | --- | --- |
| 2026-11-17 | `formatProxyCredentialMode`（`src/proxyControls.ts`）与 `preferenceLabel`（`src/i18n/language.ts`）没有任何调用者，已用 `@public` 标注保住 knip 绿灯 | A. 删除两函数（可逆，需确认没有外部复用）B. 继续保留 `@public` 标注（当前状态）C. 接到设置页与代理面板上 | 未裁决 |
| 2026-11-17 | `deno.json` 与 `package.json` 各有一套 `dev`/`build`/`test` 定义，违反入口唯一 | A. 以 `npm run` 为唯一入口，`deno task` 改为 `pwsh -File` 转发 B. 以 `deno task` 为主，`package.json` 降级为别名 | 未裁决（T-021） |
| 2026-11-17 | `src-tauri/icons/generated/`（16 文件）与 `src-tauri/icons/icon.ico` 始终未跟踪 | A. 提交入库（图标是构建输入）B. 加入 `.gitignore` 并在构建时生成 | 未裁决 |
| 2026-11-17 | `install_chromium_helper.py` 位于根目录，不在白名单六类之内 | A. 移入 `scripts/` 并更新引用 B. 在白名单登记为「源码类」并加注释说明用途 | 未裁决 |
| 2026-11-17 | 本机 `pwsh` 是 7.7 preview，CI 将用稳定通道；哪些语法属 preview 独有尚未逐条核验 | A. 只使用 7.4 起就稳定的语法，逐条核对三个脚本 B. 在 CI 用 preview 通道对齐本机 | 未裁决 |
