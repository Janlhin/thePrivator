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
| T-014 | 严格类型：可空索引访问 | 开启 `noUncheckedIndexedAccess` 并修完实测 82 处错误 | T-005 | 中 | `tsc --noEmit` 退出 0；`noUncheckedIndexedAccess` 为 `true` | TASK_BACKLOG | 2026-11-17 | — |
| T-015 | 严格类型：精确可选属性 | 开启 `exactOptionalPropertyTypes` 并修完实测 32 处错误 | T-014 | 中 | `tsc --noEmit` 退出 0；`exactOptionalPropertyTypes` 为 `true` | TASK_BACKLOG | 2026-11-17 | — |
| T-006 | Lint 与格式门禁 | 以 `vp lint`、`vp fmt --check` 作为通道，接入 `npm run lint` / `format:check` | T-003 | 高 | 两条命令均退出 0，且 `vp lint` 零警告 | TASK_BACKLOG | 2026-11-17 | — |
| T-007 | 样式门禁 | 装 `stylelint` 与 `stylelint-config-standard`，`color-no-hex` 仅对 `tokens.css` 放行 | T-006 | 高 | `stylelint "src/**/*.css"` 退出 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-008 | 覆盖率门禁 | 装 `@vitest/coverage-v8`，测基线后设语句 ≥80%、分支 ≥70% | T-001 | 中 | `npm run test` 在覆盖率不达标时退出非零，达标时退出 0 | TASK_BACKLOG | 2026-11-17 | — |
| T-009 | 死代码与重复检查 | 装 `knip`、`jscpd`，接入 `npm run deadcode` / `dupes`；`knip --fix` 不开 `--allow-remove-files` | T-008 | 高 | 两条命令退出 0；`knip.json` 无 `--allow-remove-files` | TASK_BACKLOG | 2026-11-17 | — |
| T-010 | PowerShell 单入口 | 新增 `scripts/verify.ps1`、`scripts/hooks/pre-commit.ps1`、`scripts/hooks/commit-msg.ps1`、husky 薄壳（LF）、`commitlint.config.js`、`lint-staged` 配置、`.npmrc` | T-006 | 中 | `pwsh -NoLogo -NoProfile -File scripts/verify.ps1` 退出 0；`git commit` 触发两条钩子；hooks 文件字节为 LF | TASK_BACKLOG | 2026-11-17 | — |
| T-011 | CI 统一 pwsh | 工作流加 `defaults.run.shell: pwsh`，全部步骤 `shell: pwsh`，保留 `npm ci` | T-010 | 中 | 工作流文件无 `shell: cmd` / `shell: powershell`；`npm ci` 出现且无 `npm install` | TASK_BACKLOG | 2026-11-17 | — |
| T-012 | 文档三层校验 | 接入 markdownlint、链接校验、代码块抽取实跑 | T-011 | 高 | 三条命令退出 0；断链数为 0 | TASK_BACKLOG | 2026-11-17 | — |

## 待裁决清单

当前无待裁决项。
