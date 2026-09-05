"""特殊题单：把抓来的官方学习计划 / CodeTop 公司榜落到本地题库上，再派生几份题单。

派生的部分不需要额外抓取：
- CodeTop 全站高频 Top 100 / Top 200（用已有的频次排名切）
- LCR（剑指 Offer 专项突破 + 面试经典）、程序员面试金典、力扣杯 LCP（用题号前缀切）
- 一题多解精选（解法覆盖 3 个以上大类的高频题，专门练"一题多解"）
"""

from __future__ import annotations

import re

DIFF_CN = {"EASY": "简单", "MEDIUM": "中等", "HARD": "困难"}


def _stats(slugs: list[str], by_slug: dict[str, dict]) -> dict:
    rows = [by_slug[s] for s in slugs if s in by_slug]
    diff = {"EASY": 0, "MEDIUM": 0, "HARD": 0}
    for r in rows:
        diff[r["difficulty"]] = diff.get(r["difficulty"], 0) + 1
    return {
        "resolved": len(rows),
        "hot": sum(1 for r in rows if r["freq"]),
        "paid": sum(1 for r in rows if r["paid"]),
        "difficulty": {DIFF_CN[k]: v for k, v in diff.items()},
    }


def _prefix_list(items: list[dict], prefix: str) -> list[str]:
    return [p["slug"] for p in items if str(p["id"]).startswith(prefix)]


def derive_lists(items: list[dict]) -> list[dict]:
    by_rank = sorted((p for p in items if p["freqRank"]), key=lambda p: p["freqRank"])
    derived: list[dict] = []

    for size in (100, 200):
        slugs = [p["slug"] for p in by_rank[:size]]
        if len(slugs) < size * 0.6:
            continue
        derived.append({
            "id": f"codetop:global-{size}",
            "name": f"CodeTop 全站高频 Top {size}",
            "desc": f"所有公司汇总后被面到次数最多的 {size} 题，面试前优先级最高的一批",
            "source": "codetop", "kind": "hot", "url": "https://codetop.cc/home",
            "groups": [], "slugs": slugs,
        })

    prefixes = [
        ("LCR", "lc:lcr", "LCR · 剑指 Offer 专项 & 面试经典", "力扣把剑指 Offer 与面试经典重编为 LCR 系列，国内面试出现频率很高"),
        ("面试题", "lc:ctci", "程序员面试金典", "《程序员面试金典》配套题库，偏工程实现与边界处理"),
        ("LCP", "lc:lcp", "力扣杯 LCP", "力扣杯竞赛题，思维量大、常需要组合多种算法"),
    ]
    for prefix, lid, name, desc in prefixes:
        slugs = _prefix_list(items, prefix)
        if len(slugs) < 10:
            continue
        derived.append({
            "id": lid, "name": name, "desc": desc, "source": "leetcode", "kind": "series",
            "url": "https://leetcode.cn/problemset/", "groups": [], "slugs": slugs,
        })

    multi = [p for p in items
             if p["catSpan"] >= 3 and p["freq"] >= 20 and not p["paid"]]
    multi.sort(key=lambda p: (-p["catSpan"], -p["freq"]))
    if len(multi) >= 20:
        derived.append({
            "id": "special:multi-approach",
            "name": "一题多解精选",
            "desc": "解法横跨 3 个以上大类的高频题，一道题能同时练几种套路，性价比最高",
            "source": "mixed", "kind": "special", "url": "",
            "groups": [], "slugs": [p["slug"] for p in multi[:80]],
        })

    return derived


def build_curated(items: list[dict], raw_lists: list[dict]) -> list[dict]:
    by_slug = {p["slug"]: p for p in items}
    out: list[dict] = []

    for lst in list(raw_lists) + derive_lists(items):
        slugs = [s for s in lst.get("slugs", []) if s in by_slug]
        if len(slugs) < 5:
            continue
        groups = []
        for g in lst.get("groups", []):
            members = [s for s in g.get("slugs", []) if s in by_slug]
            if members:
                groups.append({"name": g["name"], "slugs": members})
        entry = {
            "id": lst["id"],
            "name": lst["name"],
            "desc": lst.get("desc", ""),
            "source": lst.get("source", ""),
            "kind": lst.get("kind", "official"),
            "url": lst.get("url", ""),
            "declaredNum": lst.get("declaredNum") or len(lst.get("slugs", [])),
            "groups": groups,
            "slugs": slugs,
            "stats": _stats(slugs, by_slug),
        }
        if lst.get("freq"):
            entry["freq"] = {s: v for s, v in lst["freq"].items() if s in by_slug}
        out.append(entry)

    order = {"official": 0, "hot": 1, "company": 2, "series": 3, "special": 4}
    out.sort(key=lambda l: (order.get(l["kind"], 9), -l["stats"]["resolved"]))
    return out
