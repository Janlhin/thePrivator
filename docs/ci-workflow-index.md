# CI workflow indexing probe (T-023)

> 诊断记录，不改代码、不改 workflow。结论、实测输出与剩余风险都在本条里；需要改仓库设置或 workflow 的部分只登记为待办，未直接动手。

## 1. 现象

仓库 `Janlhin/thePrivator`，默认分支 `main`。

- PR #1–#24 全部 open，`gh pr checks <n>` 返回 no checks reported；这些 PR 的 head commit 上 check-suite 计数为 0。
- PR #25（head `gov/2026-11-26-skeleton`，base `main`）上三条 workflow 都跑了：CI、Release、verify-governance；CI 与 Release 总体结论 failure，verify-governance success。
- 诊断时点 `actions/runs` 历史很少：最初只有 4 条 —— #25 的 3 条 + 一次 main 上的 `workflow_dispatch`（cancelled）。
- 新建的 PR #26（head `tasks/t011-ci-pwsh`，base `tasks/24-npm-return`）在创建后几秒内就排上了 CI 与 Release 两条 workflow、14 个 check-run。

## 2. 排查路径与实测输出

### 2.1 路径一：workflow 注册与索引缓存

命令：

```powershell
gh api repos/Janlhin/thePrivator/actions/workflows
```

实测输出（摘字段）：

```json
{
  "total_count": 3,
  "workflows": [
    { "name": "CI",               "path": ".github/workflows/ci.yml",     "state": "active", "created_at": "2026-11-25T16:19:27.000+08:00" },
    { "name": "Release",          "path": ".github/workflows/release.yml", "state": "active", "created_at": "2026-11-25T16:19:27.000+08:00" },
    { "name": "verify-governance","path": ".github/workflows/verify.yml",  "state": "active", "created_at": "2026-11-26T19:06:14.000+08:00" }
  ]
}
```

main 上触碰 `.github/workflows/` 的提交历史：

```text
2026-11-25T08:19:15Z  bac857d  ci: target the main branch after the rename
2026-11-13T19:24:22Z  8a74158  fix(release): publish new tags and safely resume draft uploads
2026-11-13T18:54:32Z  6e6ce63  Automate native desktop releases and Arch packaging (#10)
```

workflow 的 `created_at`（08:19:27Z）紧随入库提交 `bac857d`（08:19:15Z）之后。三条 workflow 都是 `active`，索引不是陈旧缓存：新提交上来立刻能被读到。

### 2.2 路径二：`ci.yml` 是否被判为无效

- 本地用 YAML 解析器解析 `ci.yml`：jobs = `frontend, sidecar, tauri`，`defaults.run = {shell: pwsh}`，13 个 `run` 步骤均可读出，语法合法。
- workflows API 中 CI / Release 均为 `active`；#25 与 #26 都基于这些定义产出了 run 与 check-run，说明 GitHub 侧能正常加载，不存在「文件被判无效而不索引」。
- 附注：`verify.yml` 只存在于 #25 分支，但同样出现在 workflows 列表里且 `active` —— GitHub 会为 `pull_request` 事件索引分支上的 workflow 文件。

### 2.3 路径三：仓库设置、分支保护与触发条件

Actions 权限：

```text
$ gh api repos/Janlhin/thePrivator/actions/permissions
{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}

$ gh api repos/Janlhin/thePrivator/actions/permissions/workflow
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}

$ gh api repos/Janlhin/thePrivator/branches/main/protection
gh: Branch not protected (HTTP 404)
```

- Actions 已启用，允许全部 action；没有 sha pinning 要求。
- workflow 默认权限 read，不影响「是否触发」，只影响 run 内可写范围；`can_approve_pull_request_reviews` 为 false 与触发无关。
- `main` 无分支保护（404），不存在必需状态检查把 run 压住。

触发条件（main 上的 `ci.yml`）：

```yaml
on:
  push:
    branches: [main, "3.*"]
  pull_request:
  workflow_dispatch:
```

`pull_request` 没有 base 分支过滤。#26 的 base 是堆叠分支 `tasks/24-npm-return`（非默认分支），run 仍然正常排上 —— base 非默认分支不是不触发的原因。

### 2.4 事件时间线核对

| PR | created_at (UTC) | head | head 提交时间 | check-suites |
| --- | --- | --- | --- | --- |
| #1 | 2026-11-17 11:50:40 | bca0e5f | 2026-11-17 11:14:52Z | 0 |
| #2–#23 | 2026-11-17 11:50–13:58 | 各 gate/tasks 分支 | 均为 11/17 | 0 |
| #24 | 2026-11-18 11:50:58 | e9d4ff0 | 2026-11-18 11:50:45Z | 0 |
| #25 | 2026-11-26 11:06:10 | gov/2026-11-26-skeleton | 11/26 | 3 条 run |
| #26 | 2026-11-26 18:03:46 | 563363c | 11/26 | 2 条 workflow run，14 个 check-run |

PR #24 的 issue timeline 只有 1 条 `committed`（开 PR 时的分支推送）和 1 条后续的 `cross-referenced`（#26 引用它）；11/25 索引之后没有任何 `synchronize` 事件。

## 3. 归因结论

**workflow 是 2026-11-25 08:19Z 才进 main 并被索引的；#1–#24 都是在那之前开的 PR，之后这些分支没有新 push，GitHub 不会为索引之前打开的旧 PR 回溯补跑 workflow。** 没有新的 `pull_request` / `synchronize` 事件，索引再新也不会重新评估这些旧 PR。

三条排查路径的排除结果：

- 不是索引缓存问题：workflows API 三条均 `active`，新提交（#26、以及 11/26 晚被重新推送的 `tasks/t019-root-whitelist`、`tasks/t022-cookie-health`）都在几秒内排上 CI。
- 不是 `ci.yml` 被判无效：YAML 可解析，定义被 GitHub 正常加载并产出 run。
- 不是仓库设置或分支保护拦截：Actions 启用、允许全部 action、main 无保护、无必需状态检查；`pull_request` 触发也不挑 base 分支。

佐证：诊断期间另外两条堆叠分支在 11/26 18:07–18:08 收到推送后，立刻各自产生了一条 `pull_request` 事件的 CI run。

## 4. 实测：新 PR #26 的检查项

head SHA `563363c62d696e665db679624ff6c06b256625b8`。

第一轮快照（创建后约 1 分钟，`commits/<sha>/check-runs`）：total 10，状态 queued / in_progress；check-suites total 2（CI、Release，均 queued）。

第二轮快照（约 5 分钟后）：check-runs total 14。

| Check-run | 结论 |
| --- | --- |
| prepare | success |
| Rust bridge (ubuntu-latest) | success |
| Linux (deb, rpm, AppImage) | failure |
| Windows (exe, msi) | failure |
| macOS (Intel) | failure |
| macOS (Apple silicon) | queued |
| TypeScript + Vitest | failure |
| Python sidecar (ubuntu-24.04, 3.11 / 3.12) | failure |
| Python sidecar (windows-2022, 3.11 / 3.12) | failure |
| Python sidecar (macos-15, 3.11 / 3.12) | queued |
| Rust bridge (macos-15) | queued |

判据对照：

- `actions/workflows` 的 `total_count` = 3，大于 0。✅
- 新建 PR #26 上出现检查项（check-suite 与 check-run 均存在，`gh pr checks 26` 可列出）。✅

**注意：出现检查项 ≠ 检查通过。** #26 上多个 job 失败，其中 TypeScript + Vitest 失败在 `npm ci` 步骤，后续步骤被跳过；sidecar 与打包 job 也有 failure。这些是 job 级别的依赖/环境问题，不是索引问题，本任务不定位、不修复。本地唯一的绿灯是 `npm run verify`，不得据此宣称 CI 通过。

## 5. 剩余风险

- 旧堆叠 PR #1–#24 在收到新 push（`synchronize`）或重新 open 之前，会一直没有检查项；GitHub 不会回溯补跑。
- CI 的 `npm ci` 在 runner 上失败（TypeScript job 第一步即挂），与本机已知的 lockfile / peer 依赖问题同源与否，需单独排查；本任务未下结论。
- workflow 默认权限为 read；发布类步骤所需的 write 权限只在 publish job 内声明，现状如此，未改动。
- `push` 触发只覆盖 `main` 与 `3.*`；堆叠特性分支只靠 `pull_request` 事件触发，单独 push 特性分支不会跑 CI。

## 6. 待办（登记，未执行）

- 依赖与 lockfile 在 CI 上转绿后，如需给旧堆叠 PR 补检查项：向各旧分支推一个空提交或 reopen PR 以产生 `synchronize` 事件；是否逐个补跑由维护者决定。
- 单独排查 CI `npm ci` 失败（lockfile / peer 依赖 / node 版本矩阵）。
- 跟进 #26 正文记录的 pwsh 多行块失败传播问题（无 bash `-e` 等价语义）。
