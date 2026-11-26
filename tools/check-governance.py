#!/usr/bin/env python3
"""本仓治理文件自检。

只检查治理层改动（FORK 说明、PR 模板、Dependabot、治理工作流），
不运行上游的前端 / Python sidecar / Rust 测试与构建流程。仅使用 Python 标准库。
上游 CHANGELOG.md 为既有发布说明，不在本脚本检查范围内。
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent

REQUIRED = [
    "docs/FORK.md",
    ".github/pull_request_template.md",
    ".github/dependabot.yml",
    ".github/workflows/verify.yml",
]

errors = []

for rel in REQUIRED:
    p = ROOT / rel
    if not p.exists():
        errors.append(f"缺少治理文件: {rel}")
    elif p.stat().st_size == 0:
        errors.append(f"治理文件为空: {rel}")

dep = ROOT / ".github/dependabot.yml"
if dep.exists():
    text = dep.read_text(encoding="utf-8")
    if 'package-ecosystem: "github-actions"' not in text:
        errors.append("dependabot.yml 未包含 github-actions 生态")
    for eco in ("pip", "npm", "pnpm", "cargo", "gomod"):
        if f'package-ecosystem: "{eco}"' in text:
            errors.append(
                f"dependabot.yml 不应跟踪上游生态 {eco}（Tier B 只跟踪 github-actions）"
            )

wf = ROOT / ".github/workflows/verify.yml"
if wf.exists():
    text = wf.read_text(encoding="utf-8")
    if "contents: read" not in text:
        errors.append("verify.yml 未声明 permissions: contents: read")
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("uses:"):
            ref = line.split("uses:", 1)[1].strip()
            action = ref.split("@", 1)[0]
            if not (action.startswith("actions/") or action.startswith("github/")):
                errors.append(f"verify.yml 引用了非官方 action: {ref}")

if errors:
    print("治理自检失败：")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("治理自检通过：治理文件齐全，Dependabot 仅跟踪 github-actions，工作流仅使用官方 actions。")
