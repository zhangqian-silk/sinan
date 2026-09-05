"""一条命令跑完整个数据管线：抓 LeetCode → CodeTop → 特殊题单 → 打标构建。

用法：sinan sync [--skip-fetch]
抓取有断点续传，中断了直接重跑即可。

产出目录由环境变量 SINAN_DATA_ROOT 决定（CLI 会自动传），默认 ~/.sinan/data。
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = [
    ("抓取 LeetCode 题库与题面", ["fetch_leetcode.py"]),
    ("抓取社区题解（提取真实解法思路）", ["fetch_solutions.py"]),
    ("抓取 CodeTop 面试高频", ["fetch_codetop.py"]),
    ("抓取特殊题单（官方学习计划 + CodeTop 公司榜）", ["fetch_curated.py"]),
    ("打标 + 思路指纹 + 相似度", ["build.py"]),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-fetch", action="store_true", help="只重新打标构建，不重新抓取")
    args = ap.parse_args()

    steps = STEPS[-1:] if args.skip_fetch else STEPS
    for i, (label, cmd) in enumerate(steps, 1):
        print(f"\n=== [{i}/{len(steps)}] {label}", flush=True)
        result = subprocess.run([sys.executable, str(HERE / cmd[0]), *cmd[1:]], cwd=HERE)
        if result.returncode != 0:
            sys.exit(f"步骤失败：{label}")

    from common import DIST_DIR
    print(f"\n完成。产出在 {DIST_DIR}，看概览：sinan")


if __name__ == "__main__":
    main()
