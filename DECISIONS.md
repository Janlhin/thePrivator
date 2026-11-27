# 决策日志

> 追加写入，不覆盖；历史由 Git 保存。每条记录含日期、决策、背景、被否决的替代方案与理由、影响面、复核标准与复核时间。

## D-001 规则载体收敛为根目录 AGENTS.md

- 日期：2026-11-17
- 决策：协作规则只写在根目录 `AGENTS.md`；`.cursorrules`、`CLAUDE.md`、`copilot-instructions.md` 若出现，只能写一行「规则见 AGENTS.md」。
- 背景：规则副本一定会漂移。出现两份措辞不同的版本时，没有依据判断哪份生效，实际执行变成看谁最后写。
- 被否决的替代方案与理由：把规则分散到各目录的局部 README —— 否决。同一件事会出现多份版本，且新人不知道从哪份读起。
- 影响面：`AGENTS.md` 成为唯一入口；`README.md`、`DECISIONS.md`、`TASKS.md`、`MANIFEST.md` 只放事实，不承载规则。
- 复核标准与复核时间：`grep -rl "npm run verify" --include="*.md" .` 只命中 `AGENTS.md` 与 `README.md`；2027-01-17 复核。

## D-002 五份项目文档放仓库根目录

- 日期：2026-11-17
- 决策：`README.md`、`AGENTS.md`、`DECISIONS.md`、`TASKS.md`、`MANIFEST.md` 都在根目录，统一 `.md`，不保留同名 `.adoc`。
- 背景：三个角色（人、模型、脚本）找文档的默认路径是根目录；放进子目录后，脚本要先知道布局才能校验，形成循环依赖。
- 被否决的替代方案与理由：放 `docs/` —— 否决。`docs/` 已是产品说明与发布记录的所在，混入治理文档会让「读产品文档的人被规则噪音打断」。
- 影响面：根目录白名单新增这五份文件；`docs/` 只放产品说明与发布记录。
- 复核标准与复核时间：根目录存在且仅存在这五份治理文档；无同名 `.adoc`；2027-01-17 复核。

## D-003 PowerShell 入口复用本机已有的 7.7.0-preview.5

- 日期：2026-11-17
- 决策：所有自动化入口统一 `pwsh`，不额外安装。
- 背景：本机 `pwsh.exe` 已可用（WindowsApps 别名，7.7.0-preview.5），满足 ≥7.4。另有一份位于会话运行时目录的同版本副本，但该目录随会话变化，属于不可依赖的路径。
- 被否决的替代方案与理由：安装稳定版 7.4 —— 否决，本机已有满足版本要求的可用程序，安装不增加能力；回退 Windows PowerShell 5.1 —— 否决，不满足 ≥7.4，且 `&&`、`??`、`-Encoding` 语义与 7 不同。
- 影响面：全部 `.ps1`、`package.json` 入口、Git 钩子、CI 步骤。
- 风险登记：本机是 preview 通道，CI（GitHub ubuntu runner）是稳定版通道。脚本不得依赖 preview 独有语法，差异由 CI 实跑暴露。
- 复核标准与复核时间：`pwsh -NoLogo -NoProfile -File scripts/verify.ps1` 在本地与 CI 均退出 0；2027-01-17 复核。

## D-004 既有 `.mjs` 验证脚本保留为被调实现，`.ps1` 只做唯一入口

- 日期：2026-11-17
- 决策：`scripts/` 下 30 个既有 `.mjs` 不重写；新增 `.ps1` 入口统一转调它们，`.mjs` 登记为豁免并附到期时间。
- 背景：这些脚本覆盖 sidecar 构建、release 校验与 M004/M005/S01–S06 平台探测，本身有 1000+ 条断言在测。重写的收益是「文件后缀统一」，代价是全部验证语义重新证明一遍。
- 被否决的替代方案与理由：全部重写为 `.ps1` —— 否决，回归风险高于收益；只把 npm 入口改成 `pwsh` 转发、`.mjs` 原样保留 —— 否决，入口达标但逻辑仍散在 `.mjs`，「业务逻辑只在 `.ps1`」没有落实。
- 影响面：`package.json` scripts、`scripts/`、Git 钩子、CI 调用方式。
- 复核标准与复核时间：所有验证都从 `.ps1` 进入且不绕过；豁免清单在到期前复查；2027-02-17 复核。

## D-005 Lint 与 Format 走项目既有的 Vite+（oxlint/oxfmt），不另装 ESLint + Prettier

- 日期：2026-11-17
- 决策：`lint` = `vp lint`（警告视为失败），`format:check` = `vp fmt --check`。
- 背景：项目工具链已是 Vite+ 1.7，`vp lint` 转发 oxlint、`vp fmt` 转发 oxfmt，`vp fmt --check` 本身就是可用的格式门禁。另装 ESLint + Prettier 会让同一能力存在两套配置。
- 被否决的替代方案与理由：装 ESLint + Prettier 全家桶 —— 否决。两份规则必然漂移，谁覆盖谁说不清，且新增约 10 个依赖只为换名字。
- 影响面：`package.json` scripts、pre-commit、CI。
- 复核标准与复核时间：`vp fmt --check` 退出 0 且 `vp lint` 零警告；2027-01-17 复核。

## D-006 样式保持原生 CSS + `tokens.css`，不迁移 SCSS

- 日期：2026-11-17
- 决策：保留 `src/styles/` 的原生 CSS，接入 Stylelint；`color-no-hex` 只对 `tokens.css` 放行，其余文件禁止颜色字面量。
- 背景：`src/styles` 只有 3 个文件，实测颜色字面量全部集中在 `tokens.css`（87 处），业务样式 0 处。Token 层已经存在，缺的只是拦截手段。
- 被否决的替代方案与理由：迁移到 SCSS —— 否决。为了满足「样式预处理器」这一形式，引入编译层与变量语法，收益为零，且会动到所有样式文件。
- 影响面：`src/styles/`、Stylelint 配置。
- 复核标准与复核时间：`npx stylelint "src/**/*.css"` 退出 0；颜色字面量仅出现在 `tokens.css`；2027-01-17 复核。

## D-007 不引入 Zod，沿用 sidecar 响应的 strict-key 逐字段校验

- 日期：2026-11-17
- 决策：外部输入边界（sidecar 响应、导入文件）沿用既有逐字段校验：未知键即错误，错误在边界暴露。只有在既有实现无法覆盖的新形态出现时才提案引入 schema 库。
- 背景：前后端两侧已经逐字段校验 sidecar 响应，这是项目既有的协议漂移防线；再引入第二套 schema 会形成两个真相源。
- 被否决的替代方案与理由：引入 Zod 全量替换 —— 否决，功能重复且需要改动所有边界；只在新区块用 Zod —— 否决，新旧两套校验并存，边界行为不一致。
- 影响面：`src/sidecar/` 与 sidecar 侧校验函数。
- 复核标准与复核时间：新增边界复用既有校验函数；出现无法覆盖的形态时提交提案再定；2027-01-17 复核。

## D-008 根目录散文与截图移入 `docs/` 与 `img/`

- 日期：2026-11-17
- 决策：`FINGERPRINTING_V3.md` 移入 `docs/`，两张 `browserleaks-*.png` 移入 `img/`，同步更新引用。
- 背景：根目录白名单只允许源码、文档、配置、CI、法律、构建产物六类；散文文档与验证截图都不在其中，留在根目录会让白名单校验失效。
- 被否决的替代方案与理由：保留并在 README 登记例外 —— 否决，例外一开，后续同类新增无法拦截；直接删除 —— 否决，截图是某次指纹验证的证据，不可逆且价值不明。
- 影响面：两个文件的路径，以及引用它们的文档。
- 复核标准与复核时间：根目录跟踪项与白名单逐条比对为零差异；`git grep` 不到旧路径；2027-01-17 复核。

## D-009 覆盖率门禁先修测试再设阈值

- 日期：2026-11-17
- 决策：先把套件修到全绿（`40ba9d7`），再测基线，再按实测值设阈值；阈值只升不降。
- 背景：门禁接入前套件是 46/47，唯一失败是解释器解析不一致。带着红灯接门禁，等于一开始就给自己留一个豁免口子。
- 被否决的替代方案与理由：在门禁里排除该用例 —— 否决，红灯豁免只会被继续扩大；只告警不阻断 —— 否决，阈值不生效等于没接。
- 影响面：`npm run test`、CI、`verify.ps1` 的 check 顺序。
- 复核标准与复核时间：语句覆盖率 ≥80%、分支覆盖率 ≥70%，`npm run verify` 在未达标时退出非零；2027-02-17 复核。

## D-010 lint 走 oxlint 直接调用，不修补 `vp lint`

- 日期：2026-11-17
- 决策：`npm run lint` 转发到 `scripts/verify.ps1`，内部直接执行 `node_modules/.bin/oxlint.ps1`；不修补 `vp lint`。
- 背景：`vp lint` 依赖 `tsrs-lint` 的 `.bin` 可执行文件，当前 Deno 安装布局不生成该 shim，命令以 `Unable to resolve type-aware lint executable` 失败。在 `.bin` 手造 shim 属于自建包装器，与「禁包装器」直接冲突。
- 被否决的替代方案与理由：自建 `tsrs-lint` shim —— 否决，包装器掩盖上游缺失，升级后行为不可预测；改用 ESLint —— 否决，见 D-005，Vite+ 已内置 oxlint，同时维护两套规则源必然漂移。
- 影响面：`package.json` 的 `lint`、`scripts/verify.ps1`、CI 的 lint 步骤。
- 复核标准与复核时间：`npm run lint` 退出码 0 且输出 `Found 0 warnings and 0 errors.`；Vite+ 修复该入口后重新评估；2027-01-17 复核。

## D-011 markdown 不纳入格式化范围

- 日期：2026-11-17
- 决策：`scripts/verify.ps1` 的 format 步骤只覆盖 `src`、`tests`、`scripts`；markdown 与 `docs/` 一律不交给 oxfmt。
- 背景：实测 120 列配置下，oxfmt 会按 prose 规则重排段落，中文正文被拆行后阅读成本上升，且每次改动都产生与内容无关的噪声。
- 被否决的替代方案与理由：把 markdown 一并格式化求「全绿」—— 否决，中文文档的可读性受损且不可控；给 markdown 单独配置忽略 —— 否决，oxfmt 无 per-language 开关，配置面做不到。
- 影响面：`verify.ps1` 的 format 步骤、`lint-staged` 对 `*.md` 的处理。
- 复核标准与复核时间：`npm run format:check` 的检查清单里不出现任何 `.md`；2027-01-17 复核。

## D-012 覆盖率只统计交付源码

- 日期：2026-11-17
- 决策：Vitest 的 `coverage.include` 只含 `src/**/*.{ts,tsx}`，并排除 `*.test.*`、`src/testing/**`、`src/vite-env.d.ts`；阈值取语句 80%、分支 70%、函数与行 80%。
- 背景：不设 include 时测量把 47 个测试文件自身也算进去，得出 59% 的假低值；排除后真实覆盖为语句 87.51%、分支 82.08%。用错误口径设阈值会让门禁永远红或过早放宽。
- 被否决的替代方案与理由：把阈值降到 59% 迁就旧口径 —— 否决，等于把测量错误固化成标准；关闭阈值只存报告 —— 否决，见 D-009。
- 影响面：`vite.config.ts` 的 `test.coverage`、`npm test`、CI。
- 复核标准与复核时间：`npm test` 在语句覆盖率低于 80% 或分支低于 70% 时退出非零；2027-02-17 复核。

## D-013 三条 oxlint 规则长期关闭并写明理由

- 日期：2026-11-17（2026-11-27 复核：移出 `react/set-state-in-effect`）
- 决策：关闭 `vitest/require-mock-type-parameters`、`vitest/no-conditional-expect`、`no-control-regex` 三条规则，理由写在 `.oxlintrc.json` 与提交正文里。`react/set-state-in-effect` 已于 2026-11-27 随 T-016 恢复为 `error`，不再列入长期关闭清单。
- 背景：这三条规则在本仓库的告警分别是 174、39、1 条。前两条要求的是测试写法与类型标注，而类型已由 tsc 强制、断言在参数化循环里本就写在循环内；no-control-regex 的命中是剪贴板清洗正则，匹配控制字符是它的目的。`react/set-state-in-effect` 关闭时记为 10 处；T-016 实测为 11 处：5 处改为渲染期派生状态或删除冗余 effect（`ColumnManager` 草稿对齐、`useProxyChecks` 缓存裁剪、`AppearanceSettings` 挂载重读、`FingerprintForm` 抓取状态复位、`ProfilesPage` 选择裁剪），其余 6 处是 sidecar 初始加载或窗口/sidecar 事件订阅，属外部系统同步，保留带理由的单行豁免。
- 被否决的替代方案与理由：为清零而重写 174 处测试类型标注 —— 否决，收益是消除噪声而非发现缺陷，且会与 tsc 重复；把 set-state-in-effect 的命中硬改 —— 已在 T-016 逐条处置，外部加载/订阅处不强行事件化。
- 影响面：`.oxlintrc.json`、`npm run lint` 的告警预算。
- 复核标准与复核时间：`npm run lint` 输出 `Found 0 warnings and 0 errors.`；剩余三条 2027-01-17 复核。

## D-014 knip 与 jscpd 的排除项写进配置文件

- 日期：2026-11-17
- 决策：`knip.json` 把 `scripts/**/*.mjs`、`tests/**/*.cjs` 登记为 entry，`ignoreExportsUsedInFile` 打开，`ignoreBinaries` 含 `pwsh`、`rustc`，`ignoreDependencies` 含 `vite`、`@commitlint/cli`、`jscpd`、`lint-staged`；`.jscpd.json` 排除 `tokens.css`、测试文件与 `src/i18n/messages/**`。
- 背景：knip 只解析 JS 生态的引用，无法看到 PowerShell 脚本里调用的 CLI，也无法区分主题 token 的同名声明与真实重复。不把这些排除项写进配置，`npm run deadcode` 会长期红，团队就会习惯性忽略门禁。
- 被否决的替代方案与理由：关掉 knip 的依赖检查 —— 否决，未使用依赖正是要抓的项；把阈值调到 0 —— 否决，dupes 阈值是 3%，调 0 等于永久红。
- 影响面：`npm run deadcode`、`npm run dupes`、CI。
- 复核标准与复核时间：两条命令均退出 0，且 `knip` 不再输出 `Configuration hints`；2027-01-17 复核。

## D-015 npm 脚本只做转发，串联逻辑只在 `scripts/verify.ps1`

- 日期：2026-11-17
- 决策：`package.json` 里每个校验脚本都写成 `pwsh -NoLogo -NoProfile -File scripts/verify.ps1 [-Only <step>]`；git 钩子逻辑放在 `scripts/hooks/*.ps1`，`.husky/` 文件只有一行 `exec pwsh`。
- 背景：入口一多就会漂移：CI 跑一套、钩子跑一套、开发者手跑第三套。三套中任一套漏步骤，绿灯就不代表同一件事。
- 被否决的替代方案与理由：脚本里直接写 `npx` 命令链 —— 否决，Windows 上 `npx` 经 `cmd.exe` 启动，与「禁 cmd」冲突且不可控；把逻辑写在 `.husky` 的 sh 里 —— 否决，sh 无法调用 pwsh 之外的判定，且跨平台行为不一致。
- 影响面：`package.json`、`.husky/`、`scripts/hooks/`、CI。
- 复核标准与复核时间：`grep -c "pwsh -NoLogo -NoProfile -File" package.json` 等于校验脚本条数；`.husky/pre-commit` 与 `.husky/commit-msg` 各自只有一行 `exec pwsh`；2027-01-17 复核。

## D-016 E2E 通道选 Playwright web-shell 冒烟，verify:s06 保留为打包 WebDriver 通道

- 日期：2026-11-27
- 决策：T-018 采用 Playwright 通道：`@playwright/test` 1.60.0、根目录 `playwright.config.ts`、`e2e/` 冒烟规格，入口 `npm run test:e2e`。该通道只在 Vite dev server 上挂载前端、断言 shell 渲染且无未捕获页面错误；打包后的 Tauri 窗口仍由 `npm run verify:s06`（`scripts/verify-s06.mjs`）经 WebDriver 驱动，两条通道不互相替代。
- 背景：本机实测 `node scripts/verify-s06.mjs --preflight-only` 退出 1，缺 `tauri-driver` 与可解析的 Chromium（Chrome 已装但不在 PATH），且无 `src-tauri/target/release/bundle` 打包产物；全量冒烟还需要平台 WebDriver 与会话。Playwright 侧：既有 `playwright-core` 1.60.0，系统 Chrome 可经 `channel: "chrome"` 直接启动，无需下载 Playwright 浏览器二进制；dev server 可启动，前端在普通浏览器中挂载且 `pageerror` 为空。
- 被否决的替代方案与理由：把 verify:s06 直接登记为等价 e2e 通道 —— 否决，本机实测 preflight 非零，登记命令无法退出 0，属于造绿；下载 Playwright 自带 Chromium —— 否决，宿主已有 Chrome，复用即可，避免约百兆二进制与额外网络依赖；用 plain `playwright-core` 自写驱动替代官方测试运行器 —— 否决，`playwright.config.ts` 与 `test:e2e` 的约定需要 `@playwright/test` 的配置与发现机制。
- 影响面：新增 devDependency `@playwright/test` 1.60.0（传递 `playwright` 1.60.0，复用既有 `playwright-core` 1.60.0）；`e2e/`、`playwright.config.ts`、`scripts/e2e.mjs`；`vite.config.ts` 的 `test.exclude` 纳入 `e2e/**`；`knip.json` 入口与项目 glob 纳入 e2e。Node 选择：Playwright 1.60 通过 `node:module.register` 注册 ESM loader；本机默认 Node 28 nightly 已移除该 API（仅余 `registerHooks`），`scripts/e2e.mjs` 先探测 `module.register`，缺失时回退到 Vite+ 备用 Node 26.13.1 再启动 CLI。
- 复核标准与复核时间：`npm run test:e2e` 退出 0 且规格全绿；`npm run verify` 退出 0；备用 Node 回退路径在默认 Node 恢复 `module.register` 后变为直连；2027-01-17 复核。

## D-017 重建 npm 锁文件，并将 vitest 与 coverage-v8 钉到 5.1.1

- 日期：2026-11-27
- 决策：`vitest` 与 `@vitest/coverage-v8` 在 `package.json` 中精确钉到 `5.1.1`（不使用 `^` 范围）；删除旧锁文件，由 npm 11.21.3 重新生成 `package-lock.json`，依赖安装只走 `npm ci`。
- 背景：旧 `package-lock.json` 由另一套任务运行器写出，连 `@vitest/coverage-v8` 条目都缺失，不是可用的 npm 锁文件。`@vitest/coverage-v8: ^5.1.0` 会解析到 5.1.2，其 peer 要求 `vitest@5.1.2`；而 `vite-plus@1.7.0` 内置的 runner 是 `vitest@5.1.1`，其 `define-config` 里的 `assertCoverageProviderVersionMatch` 又要求 coverage provider 必须等于这个内置版本。这个依赖集在 npm 里既解析不了（arborist 崩 `Cannot read properties of null (reading 'children')`）也跑不了（`vp test` 直接抛 provider 版本不匹配）。5.1.1 与 vite-plus 内置 runner 一致，peer 集闭合。
- 被否决的替代方案与理由：保留 `^5.1.0` 范围让 npm 自行解析 —— 否决，会解析到 5.1.2，触发上述 peer 冲突与版本守卫；`--legacy-peer-deps` 强行安装 —— 否决，实测会缺 `vite`，`vp fmt` 报 `Cannot find package 'vite'`；在旧锁文件上手工补条目 —— 否决，旧锁文件缺条目且不是 npm 生成，补条目等于手工伪造锁文件。
- 影响面：`package.json`、`package-lock.json`、`npm ci` 与 `npm run verify` 的安装和测试步骤；README 技术栈表的 Vitest 版本。
- 复核标准与复核时间：`npm ci` 退出 0；`npm run verify` 退出 0；锁文件中 `node_modules/vitest` 与 `node_modules/@vitest/coverage-v8` 版本均为 5.1.1；2027-02-27 复核。
