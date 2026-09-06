"""把打标规则表从 Python 机器搬运到 TypeScript。

规则表是几千行的词表和正则，手抄一定会错。这里直接 import 原模块、按值导出，
正则源码原样落成字符串，由 TS 侧的 pyre.py() 负责语义翻译。

这是一次性的搬运工具，全部搬完之后连同 scripts/ 一起删掉。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import approach as ap
import codeprint as cp
import extra_sources as ex
import statement as stm
import taxonomy as tx

OUT = Path(__file__).resolve().parent.parent / "src" / "build" / "rules"
OUT.mkdir(parents=True, exist_ok=True)


def j(x) -> str:
    return json.dumps(x, ensure_ascii=False)


def header(title: str) -> str:
    return (f"/**\n * {title}\n *\n"
            " * 由 scripts/gen_rules.py 从原 Python 规则表搬运而来，正则源码原样保留，\n"
            " * 语义翻译交给 pyre.py()。改规则请改这里。\n */\n")


def write(name: str, body: str) -> None:
    (OUT / name).write_text(body, encoding="utf-8")
    print(f"wrote {name}  {len(body)/1024:.0f} KB")


# --- taxonomy ------------------------------------------------------------------

def gen_taxonomy() -> None:
    lines = [header("标签体系：13 个大类 / 65 个子标签，以及把原始题库标签映射过来的打标规则。")]
    lines.append("""
export interface Sub { id: string; name: string; desc: string }
export interface Cat { id: string; name: string; desc: string; subs: Sub[] }

/** 标签组合 + 标题正则的补充规则，用来补官方标签没覆盖到的题型。 */
export interface Rule {
  sub: string;
  weight: number;
  allTags?: string[];
  anyTags?: string[];
  notTags?: string[];
  title?: string;
  why?: string;
}
""")
    lines.append("export const CATEGORIES: Cat[] = [")
    for c in tx.CATEGORIES:
        lines.append(f"  {{ id: {j(c.id)}, name: {j(c.name)}, desc: {j(c.desc)}, subs: [")
        for s in c.subs:
            lines.append(f"    {{ id: {j(s.id)}, name: {j(s.name)}, desc: {j(s.desc)} }},")
        lines.append("  ] },")
    lines.append("];\n")

    lines.append(f"export const CAT_ORDER: string[] = {j(list(tx.CAT_ORDER))};\n")

    lines.append("/** 原始标签 slug -> [子标签, 权重] */")
    lines.append("export const TAG_MAP: Record<string, [string, number]> = {")
    for slug, (sub, w) in tx.TAG_MAP.items():
        lines.append(f"  {j(slug)}: [{j(sub)}, {w}],")
    lines.append("};\n")

    lines.append("export const RULES: Rule[] = [")
    for r in tx.RULES:
        parts = [f"sub: {j(r.sub)}", f"weight: {r.weight}"]
        if r.all_tags:
            parts.append(f"allTags: {j(list(r.all_tags))}")
        if r.any_tags:
            parts.append(f"anyTags: {j(list(r.any_tags))}")
        if r.not_tags:
            parts.append(f"notTags: {j(list(r.not_tags))}")
        if r.title:
            parts.append(f"title: {j(r.title)}")
        if r.why:
            parts.append(f"why: {j(r.why)}")
        lines.append(f"  {{ {', '.join(parts)} }},")
    lines.append("];\n")

    lines.append(f"export const FALLBACK_SUB = {j(tx.FALLBACK_SUB)};")
    lines.append(f"export const KEEP_THRESHOLD = {tx.KEEP_THRESHOLD};")
    lines.append(f"export const MAX_TAGS = {tx.MAX_TAGS};\n")

    lines.append("/** 更具体的标签出现时，压掉泛化标签。 */")
    lines.append(f"export const SUPPRESS: Record<string, string[]> = "
                 f"{j({k: list(v) for k, v in tx.SUPPRESS.items()})};\n")
    lines.append("/** 主标签校正：规则算出来不合适时手工钉一下。 */")
    lines.append(f"export const MAIN_TAG_PINS: Record<string, string> = {j(tx.MAIN_TAG_PINS)};\n")
    lines.append("/** 一题多解的补充：某个解法成立时，另一种常见解法通常也成立。 */")
    lines.append("export const ALT_APPROACHES: Record<string, [string, number][]> = {")
    for sub, alts in tx.ALT_APPROACHES.items():
        inner = ", ".join(f"[{j(a)}, {w}]" for a, w in alts)
        lines.append(f"  {j(sub)}: [{inner}],")
    lines.append("};")
    write("taxonomy.data.ts", "\n".join(lines) + "\n")


# --- approach ------------------------------------------------------------------

def gen_approach() -> None:
    lines = [header("解法思路词表：96 种思路的识别正则与区分度权重。")]
    lines.append("""
export interface ApproachDef {
  id: string;
  name: string;
  domain: string;
  pattern: string;
  /** 区分度：3.0 认准了就是这一类；2.0 明确套路；1.0 泛化说法，只能当辅助 */
  weight: number;
}
""")
    lines.append("export const APPROACHES: ApproachDef[] = [")
    for a in ap.APPROACHES:
        lines.append(f"  {{ id: {j(a.id)}, name: {j(a.name)}, domain: {j(a.domain)}, "
                     f"weight: {a.weight}, pattern: {j(a.pattern)} }},")
    lines.append("];\n")
    lines.append("/** 没有题解数据时（洛谷题、刚出的周赛题）的兜底：从标签粗略映射一个思路。 */")
    lines.append("export const TAG_FALLBACK: Record<string, string[]> = "
                 + j({k: list(v) for k, v in ap.TAG_FALLBACK.items()}) + ";\n")
    lines.append(f"export const KEEP_CONF = {ap.KEEP_CONF};")
    lines.append(f"export const MAX_LABELS = {ap.MAX_LABELS};")
    lines.append(f"export const CHANNEL_CN: Record<string, string> = {j(ap.CHANNEL_CN)};")
    write("approach.data.ts", "\n".join(lines) + "\n")


# --- codeprint -----------------------------------------------------------------

def gen_codeprint() -> None:
    lines = [header("读题解代码判解法：词级探针、组合探针、结构正则，以及自检用例。")]
    lines.append("""
/** [思路 id, 正则] —— 代码里出现这个写法就算这个思路 */
export type TokenProbe = [string, string];
/** [思路 id, 正则 A, 正则 B, 行窗口] —— A 和 B 在相邻若干行内同时出现才算 */
export type NearProbe = [string, string, string, number];
""")
    lines.append("export const TOKEN_PROBES: TokenProbe[] = [")
    for aid, rx in cp.TOKEN_PROBES:
        lines.append(f"  [{j(aid)}, {j(rx)}],")
    lines.append("];\n")
    lines.append("export const NEAR_PROBES: NearProbe[] = [")
    for aid, a, b, win in cp.NEAR_PROBES:
        lines.append(f"  [{j(aid)}, {j(a)}, {j(b)}, {win}],")
    lines.append("];\n")

    lines.append("/** 散落的结构正则，源码原样搬。 */")
    lines.append("export const RAW = {")
    for name in ("VISIT_RE", "DEF_RE", "COMBINE_RE", "BITSTATE_RE", "REVERSE_LOOP",
                 "TREE_HINT", "GRAPHY_HINT", "ASSIGN_FROM_CALL"):
        obj = getattr(cp, name)
        pat = obj.pattern if hasattr(obj, "pattern") else obj
        lines.append(f"  {name}: {j(pat)},")
    lines.append(f"  SELF_CALL_TPL: {j(cp.SELF_CALL_TPL)},")
    lines.append("} as const;\n")

    lines.append("/** 代码证据 -> 标签体系。有几个思路在 65 个子标签里没有合适位置，就只留作指纹。 */")
    lines.append(f"export const CODE_TO_TAG: Record<string, string> = {j(cp.CODE_TO_TAG)};\n")

    lines.append("/** 自检用例：题目 slug -> [必须认出来的, 绝对不能出现的] */")
    lines.append("export const CASES: Record<string, [string[], string[]]> = {")
    for slug, (must, never) in cp.CASES.items():
        lines.append(f"  {j(slug)}: [{j(list(must))}, {j(list(never))}],")
    lines.append("};")
    write("codeprint.data.ts", "\n".join(lines) + "\n")


# --- statement -----------------------------------------------------------------

def gen_statement() -> None:
    lines = [header("读题面判解法：问法规则、输入结构规则、否决条件、数据范围预算，以及自检用例。")]
    lines.append("""
/** [思路 id, 正则, 强度, 为什么] */
export type PhraseProbe = [string, string, number, string];
/** [思路 id, [必须命中的问法...], [数据范围上界...], 为什么] */
export type BudgetRule = [string[], string[], string];
""")
    for name, probes in (("PHRASE_PROBES", stm.PHRASE_PROBES), ("STRUCT_PROBES", stm.STRUCT_PROBES)):
        lines.append(f"export const {name}: PhraseProbe[] = [")
        for aid, rx, s, why in probes:
            lines.append(f"  [{j(aid)}, {j(rx)}, {s}, {j(why)}],")
        lines.append("];\n")

    lines.append("/** 否决条件：命中就把这个思路撤掉。 */")
    lines.append(f"export const GUARDS: Record<string, string> = {j(stm.GUARDS)};\n")

    lines.append("export const BUDGET_RULES: Record<string, BudgetRule> = {")
    for aid, (a, b, why) in stm.BUDGET_RULES.items():
        lines.append(f"  {j(aid)}: [{j(list(a))}, {j(list(b))}, {j(why)}],")
    lines.append("};\n")

    lines.append("export const RAW = {")
    for name in ("SUP", "SUB", "TAG", "SIZE_VAR", "VALUE_VAR", "TOKEN",
                 "SET_DECISION", "RETURN_ALL"):
        obj = getattr(stm, name)
        lines.append(f"  {name}: {j(obj.pattern if hasattr(obj, 'pattern') else obj)},")
    lines.append("} as const;\n")

    lines.append("/** 自检用例：题目 slug -> [必须认出来的, 绝对不能出现的] */")
    lines.append("export const CASES: Record<string, [string[], string[]]> = {")
    for slug, (must, never) in stm.CASES.items():
        lines.append(f"  {j(slug)}: [{j(list(must))}, {j(list(never))}],")
    lines.append("};")
    write("statement.data.ts", "\n".join(lines) + "\n")


# --- extra sources -------------------------------------------------------------

def gen_extra() -> None:
    lines = [header("洛谷等其它题源的标签与难度对照表。")]
    lines.append(f"export const CN_TAG_ALIAS: Record<string, string> = {j(ex.CN_TAG_ALIAS)};\n")
    lines.append(f"export const DIFF_ALIAS: Record<string, string> = {j(ex.DIFF_ALIAS)};\n")
    lines.append(f"export const CN_SUB_ALIAS: Record<string, string> = {j(ex.CN_SUB_ALIAS)};\n")
    lines.append(f"export const LATIN_TAIL = {j(ex.LATIN_TAIL.pattern)};")
    write("extra.data.ts", "\n".join(lines) + "\n")


if __name__ == "__main__":
    gen_taxonomy()
    gen_approach()
    gen_codeprint()
    gen_statement()
    gen_extra()
    print(f"\n共 {len(tx.TAG_MAP)} 条标签映射 / {len(tx.RULES)} 条组合规则 / "
          f"{len(ap.APPROACHES)} 种思路 / {len(cp.TOKEN_PROBES)} 条词级探针 + "
          f"{len(cp.NEAR_PROBES)} 条组合探针 / {len(stm.PHRASE_PROBES)} 条问法规则")
    print(f"自检用例：codeprint {len(cp.CASES)} 条，statement {len(stm.CASES)} 条")
