"""从打标规则反查「什么时候想到它」，生成 src/notes/signals.ts。

为什么要生成而不是手写：`statement.py` 的问法规则本来就是「看到这种问法 →
该用这个解法」，正是识别信号本身。手写一遍等于把同一件事说两遍，改了一处
另一处就会过时。教学卡片上写的判断依据，因此和系统实际打标的依据永远一致。

改完 statement.py 的规则后跑一次：python3 scripts/gen_signals.py
"""

from __future__ import annotations

import json
from pathlib import Path

import codeprint as cp
import statement as stm

OUT = Path(__file__).resolve().parent.parent / "src" / "notes" / "signals.ts"

# 弱信号不写进教学，免得误导
MIN_STRENGTH = 0.55

HEADER = '''/**
 * 识别信号：「看到这种问法就该想到它」。
 *
 * 本文件由 scripts/gen_signals.py 从 statement.py 的问法规则生成，请勿手改。
 * 打标用的是同一套规则，所以教学卡片上写的识别信号，和实际打标的依据永远一致。
 */

export const SIGNALS: Record<string, string[]> = {'''


def main() -> None:
    by_sub: dict[str, list[str]] = {}
    for aid, _rx, strength, why in stm.PHRASE_PROBES:
        sub = cp.CODE_TO_TAG.get(aid)
        if not sub or strength < MIN_STRENGTH:
            continue
        bucket = by_sub.setdefault(sub, [])
        if why not in bucket:
            bucket.append(why)

    lines = [HEADER]
    for sub, whys in by_sub.items():
        lines.append(f"  {json.dumps(sub, ensure_ascii=False)}: [")
        for why in whys:
            lines.append(f"    {json.dumps(why, ensure_ascii=False)},")
        lines.append("  ],")
    lines.append("};\n")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    total = sum(len(v) for v in by_sub.values())
    print(f"wrote {OUT}: {len(by_sub)} 个子标签 / {total} 条识别信号")


if __name__ == "__main__":
    main()
