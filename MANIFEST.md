# MANIFEST

> 第三方二进制、源码与逆向对象的登记；产物本身不入库。
> 许可结论为空即条目不完整。npm / PyPI 的传递依赖不在此逐条列出，其完整性由 `package-lock.json`、`deno.lock` 与 `requirements*.txt` 承载，本表只登记「不通过包管理器分发」或「运行期由外部提供」的条目。

| 名称 | 来源 URL | 版本 | SHA256 | 用途 | 许可结论 |
| --- | --- | --- | --- | --- | --- |
| Chromium / Google Chrome | https://www.chromium.org/ | 用户环境提供，不随包分发 | 不适用（非入库资产） | 被管理的浏览器进程；应用只调用，不复制其代码 | Chromium: BSD-3-Clause；Chrome: 专有。仅进程调用，无再分发 |
| PyInstaller | https://pyinstaller.org/ | >=6.0.0（见 `requirements-dev.txt`） | 由 PyPI 文件摘要锁定，见安装时的 `pip download --hash` 输出 | 把 sidecar 打包为单文件可执行 | GPL-2.0-or-later 附 bootloader 例外，允许打包并分发任意许可的程序 |
| Python | https://www.python.org/ | 3.11+（开发机 3.12） | 由官方发布页公布的安装包摘要 | sidecar 运行时；由 PyInstaller 打进产物 | PSF-2.0 |
| Node.js | https://nodejs.org/ | `engines.node`: ^22.18 \|\| ^24.11 \|\| >=26 | 由官方 SHASUMS256.txt 公布 | 前端构建与测试运行时 | MIT |
| Deno | https://deno.com/ | 2.9.8 | 由官方发布页公布（当前 2.x 线） | 任务运行器与 TS 工具链 | MIT |
| selenium-webdriver | https://www.npmjs.com/package/selenium-webdriver | ^4.43.0 | 见 `package-lock.json` 的 `integrity` 字段 | 打包版 E2E 的 WebDriver 客户端 | Apache-2.0 |
| playwright-core | https://www.npmjs.com/package/playwright-core | ^1.60.0 | 见 `package-lock.json` 的 `integrity` 字段 | 本地浏览器自动化（导航、截图、下载拦截） | Apache-2.0 |
| tauri-driver / WebKitWebDriver | https://v2.tauri.app/develop/tests/webdriver/ | 随 Tauri CLI 与系统 WebKitGTK 提供 | 由 cargo / 系统包管理器校验 | Linux 打包版 E2E 的 WebDriver 服务端 | tauri-driver: MIT 或 Apache-2.0；WebKitWebDriver: LGPL-2.1（仅调用，未修改，未再分发） |
| Rust 工具链 | https://rustup.rs/ | 由 `src-tauri/Cargo.lock` 与 CI 的 toolchain action 锁定 | 由 rustup 校验 | 构建 Rust 桥 | MIT 或 Apache-2.0 |
