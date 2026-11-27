# ThePrivator 3.0

A desktop manager for isolated browser profiles. Each profile is its own browser
identity — separate cookies and storage, its own proxy, and a fingerprint you
control surface by surface — so accounts that must not be linked stay unlinked.

![The profile list](docs/screenshot.png)

Everything stays on your machine. There is no account, no server of ours, and no
telemetry. Profiles travel between your own devices only if you point the app at
a folder your own sync client already keeps up to date.

## What it does

- **Profiles as a table.** Folders, tags, notes, favourites, start URLs, bulk
  launch and stop, and a trash you can restore from.
- **Fingerprint control across 11 surfaces** — browser, navigator, screen,
  locale, canvas, audio, WebGL, WebRTC, geolocation, media devices and local
  port access. Each is `real`, `masked`, `custom` or noise-seeded, with curated
  API-generated presets as a starting point, plus **Real** to disable all masking.
- **A consistency check, not just a mask.** Masking is not monotonic: a
  geolocation that contradicts your proxy's exit country makes a profile *more*
  identifiable, not less. The app warns when surfaces disagree.
- **Proxies per profile**, including authenticated SOCKS5 — Chromium cannot do
  SOCKS authentication itself, so the sidecar runs a local relay for it. A proxy
  check reports what it actually proved, and says "not established" when it
  proved nothing. Use **Check proxy** in a profile's context menu to refresh
  its observed public exit IP and country flag in the proxy column. The country
  is an IP-geolocation estimate, not a guarantee of the server's physical location.
- **Cookie import and export** directly from a profile's **Cookies** context
  submenu. Import accepts browser-export JSON arrays as well as ThePrivator
  JSON and Netscape `cookies.txt`. JSON export uses the same browser-array format
  as import; export is JSON-only (legacy TXT import remains available),
  and whole-profile `.tpkg` packages that carry the fingerprint, the proxy and
  the browsing data — but never the proxy password.
- **Cookie bot** visits your URLs in the selected profile with its proxy and
  fingerprint, with bounded same-origin link crawling. Cookies come from the
  websites themselves; the bot does not fabricate sessions or guarantee that
  a site will set cookies. You can cancel a run or close the profile when it ends.
- **Profile synchronisation through a folder** you already sync with Google
  Drive, Syncthing or rclone. No OAuth, no token, nothing sent to us.
- **A local automation endpoint** for Selenium, Playwright or Puppeteer. It
  listens on loopback and needs an access token, which is never displayed —
  copying puts it on the clipboard and nowhere else.

## Profile tools and saved preferences

Use **Import packages**, **Export selected**, or **Export all** above the table
for batch `.tpkg` transfer. Each profile reports its own result; cancelling skips
remaining profiles after the current operation finishes. Stop browsers before
exporting. Packages omit proxy passwords and are separate from vault protection.

Paste `host:port:user:pass` into **Paste proxy** or the proxy Host field to fill
all credentials. Proxy checks survive tag, note and other unrelated edits;
changing the endpoint or credentials invalidates the previous check.

The **Platform** column summarizes the configured OS, architecture and browser
version. Hover or focus a note to read it, click to pin it, and press Escape to
close it. Edit notes in the profile's **General** settings. Launch history updates
only after successful starts. **App data** in the footer opens a disk usage
breakdown. Appearance, column layout and sidebar preferences are saved locally.

API-generated fingerprints remain available in both profile creation and editing.
Their native overrides stay attached for the browser lifetime and are applied to
new page/iframe targets before those targets resume. Ordinary managed launches
use a nonzero local debugging port. Google sign-in with a generated profile was
confirmed on Linux Mint during 3.2 release validation; acceptance can still vary
by account and configuration.

## Optional encrypted storage

Enable protection under **Settings → Data protection**, using a PIN or password
of at least six characters. A longer password is preferable to a short PIN.
Enabling protection immediately locks the library. **Lock now** and normal app
exit stop browsers, jobs and the app-owned automation server before sealing data.
An independently started automation server must be stopped before locking.

The vault covers the local profile store (including proxy credentials, notes,
Chromium cookies and session files) and local sync configuration. Appearance
preferences remain available on the unlock screen. Copies exported or synced
elsewhere are not encrypted by this setting. Protection is off by default;
proxy credentials are then stored as plaintext with restricted file permissions.

Chromium needs decrypted files while the app is unlocked. A crash, power loss or
forced termination can leave those files on disk. On the next start, enter the
password to recover the latest session, then lock again. Full-disk encryption
is needed to protect an interrupted unlocked session. Deletion does not promise
secure erasure of previous disk blocks, backups or filesystem snapshots.
There is no forgotten-password reset.

Internally, a random 256-bit data key is wrapped with a scrypt-derived key
(N=131072, r=8, p=1, random salt). AES-GCM authenticates both the wrapped key and
the streaming archive. Snapshots are verified before plaintext is removed;
restore verifies the archive before extracting it. Interrupted cleanup retains
the complete encrypted snapshot. Vault keys are kept in native process memory
and private sidecar IPC, and never returned to the UI or written to disk.
Persistent diagnostic logging is suspended while vault protection is enabled.
The profile store migrates version 4 to version 5 while retaining existing data;
older application builds must not be used to write the migrated library.

## Cookies from the profile menu

Right-click a profile and open **Cookies** to import or export without leaving
the profile list. Stop the profile before importing or exporting. Import
replaces its existing cookie set, so export a backup first if you need one.
Cookie exports can contain active login sessions: keep them private and only
import sessions you are authorized to use.

JSON cookie files are a top-level array (no wrapper), with `name`, `path`,
`value`, `domain`, `secure`, `session`, `storeId`, `hostOnly`, `httpOnly`,
`sameSite`, and `expirationDate`. Exports use `storeId: "Default"` and SameSite
values `Lax`, `Strict`, `None`, or `Unspecified`. Session cookies have
`expirationDate: 0`; persistent expiry is Unix seconds, preserving fractions
up to Chromium's microsecond precision. No epoch is guessed from a number's size.
Import honors `hostOnly` over a conflicting leading dot in `domain`, normalizing
the domain to the scope Chromium stores. Source `storeId` does not select the
destination profile. Internal `.tpkg` cookie payloads retain their versioned
format and whole-second expiry for compatibility with older package readers.

**Run Cookie Bot** accepts URLs separated by spaces, commas or newlines. Bare
hostnames use HTTPS. Leaving the list empty uses the default websites shown in
the dialog. The bot follows a limited set of same-origin links; it does not
submit forms, log in, accept consent banners, or click purchase buttons. Sites
may therefore set few or no cookies. Page, depth and time limits keep each run
bounded, and cancellation stops the run without deleting existing cookies.

## Install

Download a build from the [releases](../../releases) page:

| Platform | Files |
| --- | --- |
| Linux | `.deb`, `.rpm`, `.AppImage` |
| macOS | `.dmg` (Apple silicon and Intel) |
| Windows | `.msi`, `.exe` |

You also need Chromium or Google Chrome installed; the app launches the browser
you already have rather than shipping one. Point it somewhere specific with
`THEPRIVATOR_CHROMIUM_PATH` if it is not on the usual path.

## Build from source

Requires **Node 22.18+, 24.11+ or 26+** (the Vite+ 1.7 engine range),
**Python 3.11+**, **Rust 1.77+**, and on Linux the WebKitGTK development
packages:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

Then:

```bash
npm ci
python -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
npm run tauri build
```

Installers land in `src-tauri/target/release/bundle/`.

For distributable Linux builds, use the Ubuntu 22.04 container so newer host
libraries do not make the bundled Python runtime incompatible with Linux Mint:

```bash
bash scripts/linux/build.sh
```

This requires Docker, builds Linux x86-64 `.deb`, `.rpm` and `.AppImage` packages, and writes
them with checksums to `src-tauri/target/release/bundle/linux/`. The container targets Ubuntu 22.04 / Mint 21
and newer. A native build on a rolling-release distribution is only suitable for
that host unless tested against the intended older runtime.

On macOS, build with `npm run tauri build -- --bundles app,dmg`. The sidecar
uses a directory-based Python runtime in `Contents/Frameworks`, avoiding
temporary library extraction on every launch. To verify the shipped runtime:

```bash
THEPRIVATOR_VERIFY_SIDECAR_BINARY="src-tauri/target/release/bundle/macos/ThePrivator.app/Contents/MacOS/theprivator-sidecar" npm run verify:sidecar
```

For development, `npm run tauri dev` rebuilds the frontend on save.

Frontend tooling runs through Vite+ 1.7 (`vp`): `vp dev`, `vp build` and
`vp test`, forwarded by the npm scripts and by the matching `deno task`
entries. `vite` itself is only present as Vite+'s own alias, so run builds
through `vp`, not `vite`.

**One build produces one platform.** The Python sidecar is packed with
PyInstaller, which bundles the host's interpreter and native libraries and has
no cross-compilation mode — so a macOS build needs a Mac and a Windows build
needs Windows, whatever the Rust side could otherwise manage. The
[release workflow](.github/workflows/release.yml) runs one runner per platform
for exactly that reason.

Pushes to `main` and `3.*` branches publish development prereleases after all
builds and tests succeed. Version tags publish stable releases. The workflow also
builds Arch packages and versioned PKGBUILDs; optional AUR publishing and platform
signing are described in [the release setup guide](docs/releases.md).

## Run it from a fresh clone（从零跑起来）

Prerequisites match the CI matrix and `engines.node`:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.18+, 24.11+ or 26+ | `engines.node`: `^22.18 \|\| ^24.11 \|\| >=26`; CI runs Node 24 |
| Python | 3.11 or 3.12 | sidecar runtime and its test suite; CI matrix is 3.11 / 3.12 |
| Rust | 1.77+ | only needed to build the Tauri bridge or run `cargo test` |
| PowerShell | 7.4+ (`pwsh`) | every verify and hook entrypoint; no `.cmd` / `.bat` |
| Chromium or Chrome | installed by you | the app launches your existing browser |
| Deno | 2.9.8 | task runner, and the local fallback installer below |

Then, from the repository root:

```bash
npm ci
python -m venv .venv
# Windows:  .venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt
# Linux/macOS: .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
npm run verify
```

`npm run verify` chains format, lint, stylelint, typecheck, test with coverage,
dead code, duplication and the docs gate, in that order, as defined in
`scripts/verify.ps1`. It exits `0` only when every step passes; a failing check
is fixed, never bypassed. Coverage gates are 80% statements and 70% branches.

Local host caveats (not CI conditions):

- The sidecar probes in the test suite find their interpreter through the
  `PYTHON` environment variable, falling back to `python3`. On Windows, point
  it at the venv before verifying: `$env:PYTHON = ".venv\Scripts\python.exe"`.
- On the development host used for this lane, the bundled npm 12.2.2 crashes in
  arborist against this lockfile, so `npm ci` cannot populate `node_modules`
  there. The working local fallback is `deno install`, which reads
  `package.json` and `deno.lock` and installs the same dependency set. CI and
  other working npm installs use `npm ci`.

## Opening a pull request（提 PR）

- Branch off the target base and keep commits atomic: one change per commit,
  with refactors split from behavior changes.
- Commit messages follow Conventional Commits, enforced by the commit-msg hook
  (commitlint, `@commitlint/config-conventional`):
  `<type>(<scope>): <subject>`. Types in use: `feat`, `fix`, `docs`, `style`,
  `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`.
- Run `npm run verify` and get exit `0` before opening the PR. The pre-commit
  hook already runs lint-staged (oxlint/oxfmt on staged `ts`, `tsx`, `css`,
  `json`, `yml`, `yaml`; stylelint on `css`) and a typecheck; the commit-msg
  hook validates the message. Do not skip hooks with `--no-verify`.
- The PR description should state what changed and why, the verification
  evidence (commands and exit codes), anything left unverified, and open
  decisions — the delivery checklist is in [AGENTS.md](AGENTS.md) §10.

## Engineering baseline

### Stack and versions

| Layer | Stack | Version |
| --- | --- | --- |
| Frontend | React + TypeScript | React 19.3.1, TypeScript 7.0.2 |
| Build and test | Vite+ (`vp`, backed by oxlint/oxfmt) | 1.7.x; `vite` exists only as Vite+'s alias |
| Desktop shell | Tauri | CLI `3.0.0-alpha.6`, API `3.0.0-alpha.3` (alpha channel) |
| Rust bridge | `tauri` + `tauri-runtime-wry` | pinned by `src-tauri/Cargo.lock` |
| Python sidecar | FastAPI + uvicorn | Python 3.11+ (development host: 3.12) |
| Unit tests | Vitest | 5.1.0, v8 coverage provider |
| E2E smoke | Playwright (`@playwright/test`) | 1.60, drives the host Chrome; no Playwright browser binary is downloaded |
| Gates | oxlint, oxfmt, stylelint, knip, jscpd | oxlint 1.94, oxfmt 0.79, stylelint 18 (standard config), knip 6, jscpd 5 |
| Git hooks | husky + lint-staged + commitlint | husky 9, lint-staged 17, commitlint 21 (conventional) |
| Task runner | Deno | 2.9.8 |
| Node runtime | — | `engines.node`: `^22.18 \|\| ^24.11 \|\| >=26` |
| Automation shell | PowerShell | 7.4+ (`pwsh` only, no `.cmd`/`.bat`) |

### Top-level layout

| Path | Responsibility |
| --- | --- |
| `src/` | React frontend: profile table, settings, i18n, sidecar client and its typed wrappers |
| `src-tauri/` | Rust bridge: transport, timeouts, diagnostics — it owns no domain state |
| `theprivator_sidecar/` | Python sidecar: profile store, proxy runtime, fingerprint engine, browser lifecycle |
| `src/styles/` | CSS layers plus `tokens.css`; business styles read tokens, never raw colours |
| `tests/` | Python sidecar suite and release-tooling tests |
| `e2e/` | Playwright web-shell smoke specs; `playwright.config.ts` holds the channel and dev-server settings |
| `docs/` | Product notes, release records, verification write-ups |
| `scripts/` | Sidecar build, release verification, platform probes |
| `packaging/`, `public/`, `img/` | Packaging templates, static UI assets, images |
| `.github/` | CI and release workflows |
| `AGENTS.md`, `DECISIONS.md`, `TASKS.md`, `MANIFEST.md`, `README.md` | Rules carrier, decision log, task queue, provenance, project readme |
| `package.json`, `package-lock.json`, `deno.json`, `deno.lock` | npm/Deno manifest and lockfiles |
| `tsconfig.json`, `vite.config.ts`, `vitest.setup.ts` | TypeScript, Vite and Vitest configuration |
| `.gitattributes`, `.gitignore`, `.npmrc` | VCS and npm configuration |
| `.oxlintrc.json`, `.stylelintrc.json`, `.jscpd.json`, `commitlint.config.js`, `knip.json` | Lint, duplication and commit-tool configuration |
| `setup.py`, `MANIFEST.in`, `requirements.txt`, `requirements-dev.txt`, `requirements-automation.txt` | Python packaging metadata and dependency pins |
| `index.html` | Vite HTML entry |
| `LICENSE` | Licence text |
| `CHANGELOG.md` | Release notes |
| `install_chromium_helper.py` | Standalone Chromium availability probe; root placement pending a possible move under `scripts/` (TASKS.md pending list) |

### Acceptance (machine-decidable)

Run from the repository root; each command must exit `0`.

```bash
npm ci               # lockfile is the only source of truth
npm run verify       # format, lint, stylelint, typecheck, test+coverage, deadcode, dupes
npm run build        # production frontend build
npm run test:e2e     # Playwright web-shell smoke against the dev server (host Chrome)
```

A change is not "done" until `npm run verify` exits `0`. A failing check is fixed, never bypassed.

### Gates

`scripts/verify.ps1` is the only place where gates are chained; every `npm run`
entry above is a one-line forward to it (`-Only <step>` runs a single gate).
`scripts/hooks/*.ps1` hold the git-hook logic, and the `.husky/` files are
single `exec pwsh` lines — no gate logic lives in shell or in `package.json`.

| Gate | Command | Fails when |
| --- | --- | --- |
| Format | `npm run format:check` | any file under `src`, `tests`, `scripts` differs from oxfmt |
| Lint | `npm run lint` | oxlint reports a warning or error (`--deny-warnings`) |
| Style | `npm run stylelint` | a hex colour, `!important` or nesting depth rule is broken |
| Types | `npm run typecheck` | `tsc --noEmit` finds an error |
| Tests | `npm test` | a test fails or coverage drops below 80% statements / 70% branches |
| Dead code | `npm run deadcode` | knip finds an unused file, export, type or dependency |
| Duplication | `npm run dupes` | jscpd finds more than 3% duplicated lines |

### Known limits

- Tauri 3 is still on the alpha channel; a break in an alpha API is fixed forward, not pinned away.
- One build produces one platform: PyInstaller bundles the host interpreter and has no cross-compilation mode.
- `npm run test:e2e` is the Playwright web-shell smoke: it boots the Vite dev server and mounts the frontend in the host Chrome, asserting the shell renders with no uncaught page error. The packaged Tauri window itself is still covered by `npm run verify:s06` (`scripts/verify-s06.mjs`), which drives Chromium over WebDriver; that channel needs `tauri-driver`, a packaged build and a platform WebDriver, and exits non-zero at preflight when any of them is missing.
- Coverage is a necessary condition, not a proof of quality — it measures what executed, not what was asserted.
- The local `pwsh` is the 7.7 preview channel while CI runs the stable channel; scripts must not rely on preview-only syntax.
- `scripts/*.mjs` are not linted yet (`TASKS.md` T-017): they predate the oxlint profile and carry legacy warnings.
- Chromium is supplied by your environment; the app launches what you already have.
- With vault protection off, proxy credentials are stored as plaintext with restricted file permissions.

### Verification scope

CI runs on every push and on the latest commit of each pull request. It does **not** verify every commit individually. Per-commit buildability is maintained by the atomic-commit rule and checked with `git bisect` when needed — it is not claimed as a CI guarantee.

## How it fits together

```text
React frontend  ──invoke──▶  Rust bridge  ──NDJSON over stdio──▶  Python sidecar  ──▶  Chromium
   src/                       src-tauri/                           theprivator_sidecar/
```

The Rust bridge owns nothing but transport, timeouts and diagnostics. The
sidecar owns the profile store, the proxy runtime, the fingerprint engine and
the browser lifecycle. The frontend never talks to the filesystem or spawns a
process.

Two rules run through the whole codebase and are worth knowing before changing
anything:

- **The redaction perimeter.** Absolute paths, proxy credentials, browser
  command lines and automation tokens must not reach the UI. The sidecar redacts
  and the TypeScript client independently rejects — a response carrying one is
  refused, not rendered. Errors carry an opaque reference instead, which
  Settings → Diagnostics exchanges for the detail behind it.
- **Strict-key parsing.** Every sidecar response is validated field by field on
  both sides. An unexpected key is an error, not something to ignore, so a
  protocol drift surfaces at the boundary rather than three screens later.

## Tests

```bash
npx tsc --noEmit        # types
npm test                # frontend and component tests through vp test
python -m pytest tests/ # sidecar
cd src-tauri && cargo test
npm run verify:sidecar  # the packed binary, not the source
```

That last one matters more than it looks: the sidecar imports some modules
lazily, so a missing `--hidden-import` can leave a feature broken only in the
packaged build while every from-source test passes.

## Licence

MIT — see [LICENSE](LICENSE).
