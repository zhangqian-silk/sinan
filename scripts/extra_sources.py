"""接入 LeetCode 以外的题源（洛谷、牛客、自建题单…）。

约定：往 cli/data/raw/ 里放 extra_<源名>.json，构建时会自动并进题库：

```json
{
  "source": "luogu",
  "name": "洛谷",
  "home": "https://www.luogu.com.cn/problem/list",
  "items": [
    {"id": "P1216", "title": "数字三角形", "url": "https://www.luogu.com.cn/problem/P1216",
     "difficulty": "EASY", "tags": ["动态规划", "递推"], "acRate": 0.62}
  ]
}
```

`tags` 写中文算法名即可，下面的别名表会翻成 LeetCode 的标签体系，
于是同一套打标规则、相似度、学习计划对新题源直接生效。
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

# 中文算法名 -> leetcode.cn 标签 slug。认不出的标签会被忽略，不影响其它标签。
CN_TAG_ALIAS: dict[str, str] = {
    "模拟": "simulation", "枚举": "enumeration", "暴力": "brute-force-search",
    "排序": "sorting", "位运算": "bit-manipulation", "状态压缩": "bitmask", "状压": "bitmask",
    "前缀和": "prefix-sum", "差分": "prefix-sum", "双指针": "two-pointers",
    "尺取法": "sliding-window", "滑动窗口": "sliding-window", "扫描线": "sweep-line",
    "哈希": "hash-table", "哈希表": "hash-table", "栈": "stack", "队列": "queue",
    "单调栈": "monotonic-stack", "单调队列": "monotonic-queue", "链表": "linked-list",
    "堆": "heap-priority-queue", "优先队列": "heap-priority-queue", "平衡树": "treap",
    "字符串": "string", "字符串匹配": "string-matching", "KMP": "knuth-morris-pratt-algorithm",
    "AC自动机": "aho-corasick-algorithm", "后缀数组": "suffix-array", "字典树": "trie", "Trie": "trie",
    "manacher": "manacher", "哈希算法": "rolling-hash",
    "二分": "binary-search", "二分查找": "binary-search", "三分": "ternary-search",
    "分治": "divide-and-conquer", "归并排序": "merge-sort",
    "树": "tree", "二叉树": "binary-tree", "二叉搜索树": "binary-search-tree",
    "最近公共祖先": "lowest-common-ancestor", "LCA": "lowest-common-ancestor", "倍增": "binary-lifting",
    "深度优先搜索": "depth-first-search", "DFS": "depth-first-search",
    "广度优先搜索": "breadth-first-search", "BFS": "breadth-first-search",
    "搜索": "depth-first-search", "剪枝": "backtracking", "回溯": "backtracking",
    "记忆化搜索": "memoization", "递归": "recursion", "递推": "dynamic-programming",
    "动态规划": "dynamic-programming", "DP": "dynamic-programming",
    "背包": "knapsack-problem", "树形DP": "dp-on-trees", "树形 DP": "dp-on-trees",
    "最长上升子序列": "longest-increasing-subsequence",
    "图论": "graph", "拓扑排序": "topological-sort", "最短路": "shortest-path",
    "并查集": "union-find", "最小生成树": "minimum-spanning-tree", "二分图": "bipartite-graph",
    "强连通分量": "strongly-connected-component", "网络流": "flow-network", "费用流": "minimum-cost-flow",
    "欧拉回路": "eulerian-circuit",
    "贪心": "greedy", "构造": "brainteaser",
    "数学": "math", "数论": "number-theory", "质数": "primality-test", "筛法": "sieve-theory",
    "gcd": "greatest-common-divisor", "组合数学": "combinatorics", "容斥": "inclusion-exclusion-principle",
    "概率论": "probability-and-statistics", "期望": "probability-and-statistics", "随机化": "randomized",
    "博弈论": "game-theory", "计算几何": "geometry", "凸包": "convex-hull",
    "线段树": "segment-tree", "树状数组": "binary-indexed-tree", "分块": "sqrt-decomposition",
    "可持久化": "persistent-data-structure", "ST表": "sparse-table",
}

DIFF_ALIAS = {"简单": "EASY", "中等": "MEDIUM", "困难": "HARD",
              "EASY": "EASY", "MEDIUM": "MEDIUM", "HARD": "HARD"}

# 有些中文标签在 LeetCode 体系里没有对应 slug（区间 DP、高精度、莫队…），
# 直接映到我们自己的子标签上，权重 70 表示「题源明确标注过」。
CN_SUB_ALIAS: dict[str, str] = {
    "区间": "dp-interval", "区间 DP": "dp-interval",
    "状压": "dp-bitmask", "状压 DP": "dp-bitmask", "状态压缩 DP": "dp-bitmask",
    "数位": "dp-digit", "数位 DP": "dp-digit",
    "树形": "dp-tree", "树形 DP": "dp-tree",
    "线性": "dp-linear", "线性 DP": "dp-linear",
    "背包": "dp-knapsack", "背包 DP": "dp-knapsack",
    "二分答案": "bs-answer", "倍增": "tree-path", "点分治": "tree-path",
    "高精度": "simulation", "离散化": "sorting",
    "构造": "construct",
    "莫队算法": "segment-tree", "分块": "segment-tree", "ST 表": "segment-tree",
    "扫描线": "interval", "差分": "prefix-sum",
    "网络流": "graph-advanced", "二分图": "graph-advanced", "最小生成树": "graph-advanced",
    "费用流": "graph-advanced", "强连通分量": "graph-advanced",
    "概率论": "probability", "期望": "probability", "随机化": "probability",
    "回文自动机": "palindrome", "manacher 算法": "palindrome",
    "后缀自动机": "suffix", "后缀数组": "suffix",
    "平衡树": "balanced-tree", "可持久化": "balanced-tree",
    "单调队列": "monotonic", "单调栈": "monotonic",
    "记忆化搜索": "memo-search", "剪枝": "backtracking", "启发式搜索": "search-advanced",
    "双向搜索": "search-advanced",
}

# 「动态规划 DP」「深度优先搜索 DFS」这类后缀，去掉尾部的英文再匹配一次
LATIN_TAIL = re.compile(r"[\s A-Za-z0-9+\-]+$")


def _lookup(table: dict[str, str], name: str) -> str | None:
    if name in table:
        return table[name]
    trimmed = LATIN_TAIL.sub("", name).strip()
    return table.get(trimmed) if trimmed else None


def load_extra_sources(raw_dir: Path) -> list[dict[str, Any]]:
    """读取所有 extra_*.json，规整成和 LeetCode 列表同构的记录。"""
    out: list[dict[str, Any]] = []
    for path in sorted(raw_dir.glob("extra_*.json")):
        blob = json.loads(path.read_text(encoding="utf-8"))
        source = blob.get("source") or path.stem.replace("extra_", "")
        name = blob.get("name") or source
        for raw in blob.get("items", []):
            names = list(raw.get("tags") or [])
            tags: list[str] = []
            sub_hits: list[tuple[str, int, str]] = []
            for tag_name in names:
                slug = _lookup(CN_TAG_ALIAS, tag_name)
                if slug:
                    tags.append(slug)
                sub = _lookup(CN_SUB_ALIAS, tag_name)
                if sub:
                    sub_hits.append((sub, 70, f"{tag_name}（{name}标注）"))
            out.append({
                "source": source,
                "sourceName": name,
                "sourceHome": blob.get("home") or "",
                "id": str(raw["id"]),
                "slug": f"{source}:{raw['id']}",
                "title": raw.get("title") or str(raw["id"]),
                "titleEn": raw.get("titleEn") or "",
                "url": raw.get("url") or blob.get("home") or "",
                "difficulty": DIFF_ALIAS.get(str(raw.get("difficulty", "MEDIUM")).upper(), "MEDIUM"),
                "acRate": float(raw.get("acRate") or 0.0),
                "rawTags": tags,
                "tagNames": names,
                "subHits": sub_hits,
            })
        print(f"[extra] {name}: {len(blob.get('items', []))} 题（{path.name}）", flush=True)
    return out
