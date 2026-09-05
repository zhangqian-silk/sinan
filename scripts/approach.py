"""解法思路指纹：从真实题解里提取「这题到底怎么做」。

为什么需要它
------------
题目标签只能说明「这题和树有关」，说不出是前序、中序还是层序；
说明「这题是动态规划」，说不出状态转移长什么样；数学题一律标「数学」，
可实际上一道用埃氏筛、一道用快速幂、一道用容斥，彼此毫无可替代性。

所以判断两道题是否真的相似，依据是**题解思路**，不是标签：

- 数据来自 `fetch_solutions.py` 抓的社区题解（标题 + 题解自带算法标签 + 点赞数），
  标题里写得很直白：「迭代法」「Morris 遍历」「埃氏筛」「贪心 + dfs」「记忆化搜索」。
- 词表按领域切到「同思路即可互相替代」的粒度：树分前/中/后/层序，
  图分 DFS/BFS/并查集/拓扑/Dijkstra，DP 分状态转移形状，数学落到具体定理。
- 定理类标签权重高且彼此不重合，所以两道用不同定理的数学题指纹重叠为 0——
  这正是数学题相似度天然很低的原因，不需要额外打补丁。
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Approach:
    id: str
    name: str
    domain: str
    pattern: str
    weight: float = 1.0        # 区分度：定理/特定算法高，泛化说法低


# 权重档位：3.0 = 认准了就是这一类；2.0 = 明确的套路；1.0 = 泛化说法，只能当辅助
APPROACHES: tuple[Approach, ...] = (
    # —— 树：遍历次序是关键，前序和层序不是一回事 ——
    Approach("tree-preorder", "前序遍历", "tree", r"前序|preorder", 2.0),
    Approach("tree-inorder", "中序遍历", "tree", r"中序|inorder", 2.0),
    Approach("tree-postorder", "后序遍历", "tree", r"后序|postorder", 2.0),
    Approach("tree-levelorder", "层序遍历", "tree", r"层序|层次遍历|levelorder|按层|逐层", 2.0),
    Approach("tree-morris", "Morris 遍历", "tree", r"morris|线索二叉树", 3.0),
    Approach("tree-iterative", "迭代 + 显式栈", "tree", r"迭代|iterativ|显式栈|用栈模拟|颜色标记", 1.5),
    Approach("tree-recursion", "递归", "tree", r"递归|recursi|dfs 递归", 1.0),
    Approach("tree-lca", "最近公共祖先", "tree", r"最近公共祖先|公共祖先|\blca\b", 2.5),
    Approach("tree-serialize", "序列化/反序列化", "tree", r"序列化|反序列化|serial", 2.5),
    Approach("tree-construct", "由遍历序列重建", "tree", r"重建|还原|由.{0,8}构造|构造二叉树", 2.5),
    Approach("bst-inorder", "BST 中序有序性", "tree", r"搜索树|\bbst\b|中序有序", 2.0),
    # —— 图：走法本身就是解法 ——
    Approach("graph-dfs", "DFS 深搜", "graph", r"\bdfs\b|深度优先|深搜|洪水填充|flood.?fill|沉岛|染色", 1.5),
    Approach("graph-bfs", "BFS 广搜", "graph", r"\bbfs\b|广度优先|广搜|多源扩散|逐层扩散", 1.5),
    Approach("graph-union-find", "并查集", "graph", r"并查集|union.?find|\bdsu\b", 2.5),
    Approach("graph-topo", "拓扑排序", "graph", r"拓扑|topolog|入度|kahn", 2.5),
    Approach("graph-dijkstra", "Dijkstra", "graph", r"dijkstra|迪杰斯特拉|堆优化最短路", 3.0),
    Approach("graph-bellman", "Bellman-Ford / SPFA", "graph", r"bellman|spfa", 3.0),
    Approach("graph-floyd", "Floyd 多源最短路", "graph", r"floyd.?warshall|弗洛伊德|多源最短路", 3.0),
    Approach("graph-mst", "最小生成树", "graph", r"最小生成树|kruskal|\bprim\b", 3.0),
    Approach("graph-bipartite", "二分图判定/匹配", "graph", r"二分图|染色法|匈牙利|最大匹配", 3.0),
    # 中文没有词边界：「割点」会被「找分割点」命中，「桥」会被「桥牌」之类命中，
    # 所以这两个词必须带上下文限定。
    Approach("graph-scc", "Tarjan 连通性", "graph",
             r"tarjan|强连通|(?<!分)割点|割边|关键连接|桥\s*(边|梁结构)?(?=\s|$|、|，)", 3.0),
    Approach("graph-euler", "欧拉路径", "graph", r"欧拉(回路|路径|图)|hierholzer", 3.0),
    Approach("graph-flow", "网络流", "graph", r"网络流|最大流|最小割|dinic", 3.0),
    # —— DP：看状态转移的形状 ——
    Approach("dp-memo", "记忆化搜索", "dp", r"记忆化|\bmemo|递归\s*\+\s*缓存|自顶向下", 2.0),
    Approach("dp-1d", "一维线性递推", "dp", r"一维|滚动数组|线性\s?dp|递推公式|滚动优化", 1.5),
    Approach("dp-2d", "二维状态转移", "dp", r"二维\s?dp|二维数组|dp\[i\]\[j\]|双序列", 1.5),
    Approach("dp-knapsack-01", "01 背包", "dp", r"0-?1\s?背包|01背包", 3.0),
    Approach("dp-knapsack-full", "完全背包", "dp", r"完全背包|多重背包", 3.0),
    Approach("dp-knapsack", "背包模型", "dp", r"背包", 2.0),
    Approach("dp-interval", "区间 DP", "dp", r"区间\s?dp|区间动态规划|石子合并|环形区间", 3.0),
    Approach("dp-tree", "树形 DP", "dp", r"树形\s?dp|树上\s?dp|换根", 3.0),
    Approach("dp-bitmask", "状压 DP", "dp", r"状压|状态压缩|bitmask", 3.0),
    Approach("dp-digit", "数位 DP", "dp", r"数位\s?dp|按位统计", 3.0),
    Approach("dp-lis", "LIS（贪心+二分）", "dp", r"\blis\b|最长上升|最长递增|贪心\s*\+\s*二分", 2.5),
    Approach("dp-lcs", "LCS / 编辑距离", "dp", r"\blcs\b|最长公共子序列|编辑距离|最短编辑", 2.5),
    Approach("dp-machine", "状态机 DP", "dp", r"状态机|持股|买卖股票|冷冻期", 2.5),
    Approach("dp-prob", "概率期望 DP", "dp", r"期望\s?dp|概率\s?dp|数学期望", 3.0),
    Approach("dp-opt", "单调队列/斜率优化", "dp", r"斜率优化|单调队列优化|决策单调|四边形不等式", 3.0),
    # —— 数学：落到具体定理，彼此天然不重合 ——
    Approach("math-sieve", "质数筛（埃氏/线性）", "math", r"埃氏筛|埃拉托斯特尼|线性筛|欧拉筛|质数筛|素数筛", 3.0),
    Approach("math-fast-pow", "快速幂", "math", r"快速幂|矩阵快速幂|二进制取幂", 3.0),
    Approach("math-fermat", "费马小定理/逆元", "math", r"费马小定理|乘法逆元|逆元", 3.0),
    Approach("math-euler-phi", "欧拉函数/欧拉定理", "math", r"欧拉函数|欧拉定理", 3.0),
    Approach("math-gcd", "GCD / 裴蜀定理", "math", r"最大公约数|辗转相除|裴蜀|欧几里得|\bgcd\b", 2.5),
    Approach("math-inclusion", "容斥原理", "math", r"容斥", 3.0),
    Approach("math-catalan", "卡特兰数", "math", r"卡特兰|catalan", 3.0),
    Approach("math-combi", "组合计数", "math", r"组合数|排列数|杨辉三角|二项式|阶乘", 2.5),
    Approach("math-moore", "摩尔投票", "math", r"摩尔投票|boyer.?moore|投票法", 3.0),
    Approach("math-xor", "异或性质", "math", r"异或|\bxor\b|lowbit|位运算性质", 2.0),
    Approach("math-base", "进制/数位拆解", "math", r"进制|数位拆|十进制|各位数字", 2.0),
    Approach("math-geometry", "几何公式", "math", r"几何|向量|叉积|凸包|海伦|三角形面积", 2.5),
    Approach("math-game", "博弈/SG 函数", "math", r"\bsg\s?函数|博弈|必胜态|\bnim\b", 3.0),
    Approach("math-mod", "同余与取模", "math", r"同余|取模技巧|模运算", 2.0),
    Approach("math-formula", "公式推导/找规律", "math", r"数学推导|找规律|公式|规律|数学法", 0.8),
    # —— 线性结构与技巧 ——
    Approach("monotonic-stack", "单调栈", "ds", r"单调栈", 3.0),
    Approach("monotonic-queue", "单调队列", "ds", r"单调队列", 3.0),
    Approach("sliding-window", "滑动窗口", "ds", r"滑动窗口|滑窗|不定长窗口|定长窗口", 2.5),
    Approach("two-pointers", "双指针", "ds", r"双指针|对撞指针|左右指针|同向指针", 2.0),
    Approach("fast-slow", "快慢指针", "ds", r"快慢指针|判圈|floyd 判圈|龟兔", 3.0),
    Approach("prefix-sum", "前缀和", "ds", r"前缀和|后缀和|前缀积", 2.5),
    Approach("diff-array", "差分数组", "ds", r"差分", 3.0),
    Approach("binary-search", "二分查找", "ds", r"二分查找|二分法|二分搜索|折半", 2.0),
    Approach("binary-search-answer", "二分答案", "ds", r"二分答案|最小化最大|最大化最小|二分\s*\+\s*(判定|check|贪心|验证)", 3.0),
    Approach("heap", "堆 / 优先队列", "ds", r"优先队列|priority.?queue|小根堆|大根堆|\bheap\b|top.?k", 2.0),
    Approach("quickselect", "快速选择", "ds", r"快速选择|quickselect|快排划分|partition", 3.0),
    Approach("merge-sort", "归并", "ds", r"归并", 2.5),
    Approach("hash", "哈希表", "ds", r"哈希(?!函数)|\bhash\b|字典(?!树)", 1.0),
    # 「排序」要排除拓扑排序 / 快速排序 / 归并排序 / 计数排序 / 桶排序这些已有专门标签的说法
    Approach("sort-then", "排序后处理", "ds",
             r"(?<!拓扑)(?<!快速)(?<!归并)(?<!计数)(?<!基数)(?<!桶)排序", 1.0),
    Approach("stack-sim", "栈模拟", "ds", r"用栈|栈模拟|括号匹配|表达式求值|逆波兰", 2.0),
    Approach("deque", "双端队列", "ds", r"双端队列|\bdeque\b", 2.0),
    Approach("trie", "字典树", "ds", r"字典树|\btrie\b|前缀树", 3.0),
    Approach("segment-tree", "线段树", "ds", r"线段树|zkw", 3.0),
    Approach("fenwick", "树状数组", "ds", r"树状数组|fenwick", 3.0),
    Approach("ordered-set", "有序集合", "ds", r"treemap|sortedlist|有序集合|multiset|平衡树", 2.5),
    Approach("block", "分块 / 莫队", "ds", r"分块|莫队", 3.0),
    # —— 链表 ——
    Approach("list-reverse", "链表反转", "list", r"反转链表|翻转链表|头插法", 2.5),
    Approach("list-dummy", "虚拟头节点", "list", r"哨兵|虚拟头|dummy", 2.0),
    Approach("list-merge", "链表归并", "list", r"合并.*链表|链表.*合并", 2.5),
    # —— 搜索 ——
    Approach("backtracking", "回溯", "search", r"回溯|backtrack|全排列|组合枚举", 2.0),
    Approach("pruning", "剪枝", "search", r"剪枝|prune", 2.0),
    Approach("bidirectional", "双向搜索", "search", r"双向\s?bfs|双向搜索|meet.?in.?the.?middle|中途相遇", 3.0),
    Approach("astar", "A* / 启发式", "search", r"\ba\*|启发式搜索", 3.0),
    # —— 字符串 ——
    Approach("kmp", "KMP", "string", r"\bkmp\b|next 数组|失配指针", 3.0),
    Approach("zfunc", "Z 函数 / 扩展 KMP", "string", r"z 函数|z-algorithm|扩展 kmp", 3.0),
    Approach("rolling-hash", "字符串哈希", "string", r"字符串哈希|滚动哈希|rabin.?karp", 3.0),
    Approach("manacher", "Manacher", "string", r"manacher|马拉车", 3.0),
    Approach("palindrome-center", "中心扩展", "string", r"中心扩展|中心扩散", 2.5),
    # —— 贪心与其它 ——
    Approach("greedy", "贪心", "greedy", r"贪心|greedy", 1.5),
    Approach("exchange-argument", "交换论证/反悔贪心", "greedy", r"反悔|交换论证|后悔", 3.0),
    Approach("simulate", "模拟", "other", r"模拟|simulat|按题意", 0.8),
    Approach("brute-force", "暴力枚举", "other", r"暴力|枚举|穷举", 0.8),
    Approach("bit-enum", "子集枚举", "other", r"子集枚举|二进制枚举|枚举子集", 2.5),
    Approach("design", "结构设计", "other", r"设计|双向链表\s*\+\s*哈希|\blru\b|\blfu\b", 2.0),
    Approach("sweep-line", "扫描线/差分事件", "ds", r"扫描线|事件排序|上下车", 3.0),
    Approach("string-scan", "字符串扫描处理", "string", r"遍历字符|逐字符|字符统计|分割字符串|双指针扫描", 1.0),
    Approach("concurrency", "锁/信号量", "other", r"信号量|\block\b|互斥|条件变量|semaphore|synchronized", 3.0),
    Approach("sql", "SQL 查询", "other", r"\bsql\b|连接查询|\bjoin\b|group\s?by|窗口函数|子查询", 2.0),
)

BY_ID: dict[str, Approach] = {a.id: a for a in APPROACHES}
COMPILED: tuple[tuple[Approach, re.Pattern[str]], ...] = tuple(
    (a, re.compile(a.pattern, re.I)) for a in APPROACHES)

# 没有题解数据时（洛谷题、刚出的周赛题）的兜底：从我们的标签粗略映射一个思路
TAG_FALLBACK: dict[str, tuple[str, ...]] = {
    "tree-traversal": ("tree-recursion",), "bst": ("bst-inorder",),
    "tree-build": ("tree-construct",), "tree-path": ("tree-lca",),
    "graph-basic": ("graph-dfs", "graph-bfs"), "topo": ("graph-topo",),
    "shortest-path": ("graph-dijkstra",), "union-find": ("graph-union-find",),
    "dp-linear": ("dp-1d",), "dp-sequence": ("dp-lcs",), "dp-knapsack": ("dp-knapsack",),
    "dp-grid": ("dp-2d",), "dp-interval": ("dp-interval",), "dp-tree": ("dp-tree",),
    "dp-bitmask": ("dp-bitmask",), "dp-machine": ("dp-machine",), "dp-digit": ("dp-digit",),
    "memo-search": ("dp-memo",), "backtracking": ("backtracking",),
    "flood-fill": ("graph-dfs",), "bfs-shortest": ("graph-bfs",),
    "dfs-basic": ("graph-dfs",), "search-advanced": ("bidirectional",),
    "monotonic": ("monotonic-stack",), "sliding-window": ("sliding-window",),
    "two-pointers": ("two-pointers",), "prefix-sum": ("prefix-sum",),
    "bs-array": ("binary-search",), "bs-answer": ("binary-search-answer",),
    "quickselect": ("quickselect",), "divide-conquer": ("merge-sort",),
    "heap": ("heap",), "hash-count": ("hash",), "sorting": ("sort-then",),
    "stack-queue": ("stack-sim",), "linked-list": ("list-reverse",),
    "trie": ("trie",), "segment-tree": ("segment-tree",), "fenwick": ("fenwick",),
    "ordered-set": ("ordered-set",), "balanced-tree": ("ordered-set",),
    "palindrome": ("palindrome-center",),
    "combinatorics": ("math-combi",),
    "geometry": ("math-geometry",), "game-theory": ("math-game",),
    "bit": ("math-xor",),
    # 下面这几个子标签是「大类」而不是「某个技巧」，力扣的官方标签又很宽
    # （一道数学题只标 `math`），所以只能退到低区分度的通用思路上。
    # 猜成具体定理会造出成片的假同质簇：`math` → GCD 曾让 109 道毫不相干的题
    # （整数反转、阿姆斯特朗数、线性方程组）互相 100% 思路重合。
    "number-theory": ("math-formula",),
    "probability": ("math-formula",),
    "string-match": ("string-scan",),
    "suffix": ("string-scan",),
    "graph-advanced": ("graph-dfs",),
    "greedy-basic": ("greedy",), "greedy-heap": ("heap",), "greedy-interval": ("greedy",),
    "construct": ("brute-force",), "simulation": ("simulate",),
    "enumeration": ("brute-force",), "matrix": ("simulate",),
    "ds-design": ("design",), "data-stream": ("design",), "iterator": ("design",),
    "interval": ("sweep-line",), "string-basic": ("string-scan",),
    "concurrency": ("concurrency",), "db-shell": ("sql",),
}

KEEP_CONF = 0.06
MAX_LABELS = 8


CHANNEL_CN = {"code": "题解代码", "statement": "题面推理",
              "solutions": "题解文字", "tags": "官方标签"}


def fingerprint(articles: list[dict], tag_ids: list[str],
                code_evidence: dict[str, float] | None = None,
                stmt_evidence: dict[str, float] | None = None) -> list[dict]:
    """提取思路指纹：[{id, name, domain, conf, w, hits, from}]。

    四条**互相独立**的证据通道，可信度依次递减：

    1. ``code``     —— 题解代码里真的这么写了（正则 + AST 结构判断）。看得见的最硬。
    2. ``statement``—— 自己读题面推出来的：问法 + 数据范围 + 输入结构。
                       这条不依赖任何人的题解，所以能覆盖没人写题解的题，
                       也能发现「高赞题解只贴了最优解、但这题其实还能这么做」。
    3. ``solutions``—— 题解标题/标签这么说。说得出不一定做得到，也可能只是顺口提一句。
    4. ``tags``     —— 只剩官方标签的兜底。官方标签讲「涉及什么」，不讲「怎么解」。

    独立通道的价值在**交叉印证**：一个思路被两条以上通道同时指出，可信度显著提高；
    只被一条指出就保持谨慎。另外，**有代码可看时，某思路在代码里没出现本身就是反证**，
    所以纯文字证据要打折 —— 但如果题面推理也支持它，就不打折，因为那说明这是
    「可行但没人贴」的解法，正是多标签想收进来的东西。
    """
    code_evidence = code_evidence or {}
    stmt_evidence = stmt_evidence or {}
    scored: dict[str, dict] = {}
    total = 0.0

    for art in articles:
        text = f"{art.get('t', '')} {' '.join(art.get('g') or [])}"
        if not text.strip():
            continue
        w = math.log1p(max(art.get("v", 0), 0)) + 0.5
        total += w
        for ap, rx in COMPILED:
            if rx.search(text):
                cur = scored.setdefault(ap.id, {"score": 0.0, "hits": 0})
                cur["score"] += w
                cur["hits"] += 1

    text_conf = {aid: min(v["score"] / total, 1.0) for aid, v in scored.items()} if total > 0 else {}
    # 三条通道各自换算成可信度。代码是观察到的，题面是推理出来的，推理略低一档。
    channels: dict[str, dict[str, float]] = {
        "code": {aid: min(0.35 + 0.65 * s, 1.0) for aid, s in code_evidence.items() if aid in BY_ID},
        "statement": {aid: min(0.25 + 0.60 * s, 1.0) for aid, s in stmt_evidence.items() if aid in BY_ID},
        "solutions": text_conf,
    }

    out: list[dict] = []
    for aid in {a for ch in channels.values() for a in ch}:
        ap = BY_ID.get(aid)
        if not ap:
            continue
        backers = [name for name, ch in channels.items() if aid in ch]
        conf = max(channels[name][aid] for name in backers)
        # 多条独立通道同时指向它 => 加成
        conf = min(conf + 0.12 * (len(backers) - 1), 1.0)
        if backers == ["solutions"]:
            v = scored[aid]
            if conf < KEEP_CONF and v["hits"] < 2:
                continue
            if code_evidence:
                # 代码摆在那儿却没这么写，而且只有一篇题解顺口提过 => 噪声，直接丢。
                # （典型例子：某篇题解标题里写「找分割点」，就被当成了图论的「割点」。）
                if v["hits"] < 2:
                    continue
                conf *= 0.7               # 有人这么说但代码里看不到，压一档
        out.append({"id": aid, "name": ap.name, "domain": ap.domain,
                    "conf": round(conf, 3), "w": ap.weight,
                    "hits": scored.get(aid, {}).get("hits", 0),
                    "from": "+".join(backers)})

    if out:
        # 同样的 conf×w，看得见的代码排在推理前面，推理排在道听途说前面
        def rank(x: dict) -> float:
            bonus = 1.0 + 0.15 * ("code" in x["from"]) + 0.07 * ("statement" in x["from"])
            return -x["conf"] * x["w"] * bonus
        out.sort(key=lambda x: (rank(x), x["id"]))
        return out[:MAX_LABELS]

    # 没有题解可用，退回标签映射，标记来源以便区分可信度
    seen: dict[str, dict] = {}
    for tid in tag_ids:
        for aid in TAG_FALLBACK.get(tid, ()):
            ap = BY_ID.get(aid)
            if ap and aid not in seen:
                seen[aid] = {"id": aid, "name": ap.name, "domain": ap.domain,
                             "conf": 0.3, "w": ap.weight, "hits": 0, "from": "tags"}
    return list(seen.values())[:MAX_LABELS]


def vector(fp: list[dict], idf: dict[str, float]) -> dict[str, float]:
    """把指纹变成可以算余弦的向量。"""
    raw = {a["id"]: a["conf"] * a["w"] * idf.get(a["id"], 1.0) for a in fp}
    norm = math.sqrt(sum(v * v for v in raw.values())) or 1.0
    return {k: v / norm for k, v in raw.items()}


def overlap(fp_a: list[dict], fp_b: list[dict]) -> float:
    """两道题的思路有多少是真正共通的 = 加权 Jaccard × 共有思路的区分度。

    区分度折扣是关键：两道题「都用了递归」「都是公式推导」并不说明它们可以互相替代，
    而「都用埃氏筛」「都是区间 DP」就说明。所以只有共有的思路本身足够具体，
    重合度才算得高——这也是为什么不同定理的数学题相似度天然很低。
    """
    wa = {a["id"]: a["w"] for a in fp_a}
    wb = {b["id"]: b["w"] for b in fp_b}
    if not wa or not wb:
        return 0.0
    shared = set(wa) & set(wb)
    if not shared:
        return 0.0
    keys = set(wa) | set(wb)
    inter = sum(min(wa.get(k, 0.0), wb.get(k, 0.0)) for k in keys)
    union = sum(max(wa.get(k, 0.0), wb.get(k, 0.0)) for k in keys)
    if not union:
        return 0.0
    mean_w = sum(max(wa[k], wb[k]) for k in shared) / len(shared)
    spec = min(1.0, max(0.15, (mean_w - 0.8) / 1.7))
    return (inter / union) * spec


def specificity(fp: list[dict]) -> float:
    """指纹整体有多"认得出"：全是递归/模拟这类泛化说法就接近 0。"""
    if not fp:
        return 0.0
    top = max(a["w"] for a in fp)
    return min(1.0, max(0.0, (top - 0.8) / 1.7))
