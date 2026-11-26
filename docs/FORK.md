# Fork 关系与本地差异说明

## 与上游的关系

- 上游仓库：`yanx9/thePrivator`（GitHub 标记为 parent / source，上游默认分支 `master`，另有 `3.0`、`dev` 等分支）
- 本仓：`Janlhin/thePrivator`，公开仓库，默认分支 `main`
- 本仓是上游的 fork，产品代码、文档与既有工作流以上游为准；本批治理改动只落在治理层（`docs/`、`.github/`、根目录治理文件、`tools/`），不改上游核心代码、构建配置与既有工作流。

## 本仓相对上游的差异

可核对的事实（2026-11-26，本地 `--depth 1` 克隆，比对上游 `master`）：

- 本仓 `main` HEAD：`1e2d889`，提交信息 "docs: point the release notes at main"。
- `git rev-list --left-right --count upstream/master...HEAD` 为 `1  1`；浅克隆下完整合并基点未核对，历史提交分叉范围未核对。
- `git diff upstream/master HEAD` 检出 3 个文件差异，均为**分支名适配**：上游 `master` 改成本仓 `main`：
  - `.github/workflows/ci.yml`：`push` 触发分支与注释中的分支名。
  - `.github/workflows/release.yml`：`push` 触发分支。
  - `README.md`：一处说明文字中的分支名。
- 除上述分支名适配外，未在本次浅快照比对中检出其他文件级改动；更细的逐提交差异未核对。

本批治理分支上新增的内容（仅治理层，不属于上游产品代码）：

- `docs/FORK.md`：本文件。
- `.github/pull_request_template.md`：PR 填写模板。
- `.github/dependabot.yml`：仅跟踪 `github-actions` 生态的版本更新；npm / pip / cargo 依赖更新交给上游。
- `.github/workflows/verify.yml`：只检查本仓治理文件是否齐全、结构是否完整。
- `tools/check-governance.py`：治理文件自检脚本（纯标准库）。

## 既有 CHANGELOG 口径

根目录 `CHANGELOG.md` 是上游的发布说明（SemVer 条目），本仓不回写、不改写。本仓治理层改动记录在对应 PR 描述与本文件中，不进入上游发布说明。

## 既有开放 PR 概况（只读统计，不操作）

截至 2026-11-26，本仓有 24 个处于 `open` 状态的 PR（#1–#24）。本次治理**不合并、不关闭、不评论**任何既有 PR，仅做状态统计：

- 可合并性：24 个均为 `MERGEABLE`，合并状态 `CLEAN`（#1 首次查询返回 `UNKNOWN`，二次查询计算完成后为 `MERGEABLE / CLEAN`）。
- CI 上报：24 个 PR 头部的 `statusCheckRollup` 均为空，即没有已上报到 PR 的检查结论。
- 仓库唯一一次 Actions 运行：`main` 分支由 `workflow_dispatch` 触发的 `CI`，结论 `cancelled`（run `45576670926`，7m40s，2026-11-25 08:29:08Z；其中 TypeScript+Vitest、Rust bridge ubuntu、Python sidecar ubuntu/windows 成功，macOS 矩阵任务被取消）。

## 禁止本地魔改的目录与文件

以下内容来自上游，本地分支不得修改、不得格式化重排：

- `src/`、`src-tauri/`、`theprivator_sidecar/`、`tests/`、`scripts/`、`packaging/`、`public/`：上游前端、Rust 桥接、Python sidecar、测试、脚本与打包目录。
- `docs/`：上游既有文档与截图。
- `index.html`、`img/`、根目录既有截图 PNG：上游既有页面与素材。
- `package.json`、`package-lock.json`、`requirements.txt`、`requirements-dev.txt`、`requirements-automation.txt`、`setup.py`、`MANIFEST.in`、`tsconfig.json`、`vite.config.ts`、`vitest.setup.ts`：上游清单、锁文件与构建配置。
- `README.md`、`LICENSE`、`CHANGELOG.md`、`FINGERPRINTING_V3.md`：上游既有正文与许可。
- `.github/workflows/ci.yml`、`.github/workflows/release.yml`：上游既有工作流，本批不改动、不复刻。

如确需改动上述内容，应先向上游提交并在本仓同步，而不是在 fork 内单独魔改。

## 同步上游的步骤

1. 添加上游远程（本地备份中已添加）：

   ```bash
   git remote add upstream https://github.com/yanx9/thePrivator.git
   ```

2. 拉取上游最新 `master`：

   ```bash
   git fetch upstream master
   ```

3. 在治理分支上合并或变基上游（注意上游默认分支是 `master`，不是 `main`）：

   ```bash
   git merge upstream/master   # 或 git rebase upstream/master
   ```

4. 冲突只允许出现在治理文件上；若上游核心目录出现冲突，先核对是否误改。

5. 上游检查命令以上游工作流与文档为准（前端 `npm ci` / verify / vitest / tsc、Python sidecar pytest、Rust `cargo test`）；这些不在本仓治理 CI 中重复运行。

6. 推送前确认 `git diff --stat upstream/master` 中不包含被禁止魔改的目录。

## CI 口径说明

本仓治理工作流**不复刻**上游 `ci.yml` / `release.yml`：不在治理 CI 中安装 npm / pip / cargo 依赖，不跑 vitest、tsc、pytest 或 cargo test。上游既有 CI 的运行与失败排查以上游仓库为准；本仓观察到的上次 `cancelled` 结论已在上方记录，原因未深挖，本次未改动上游工作流配置。
