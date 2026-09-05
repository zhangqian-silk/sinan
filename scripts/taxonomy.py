"""两级标签体系：13 个大类 / 60+ 个子类，以及把原始题库标签映射过来的打标规则。

设计取舍：
- 大类按"解题时脑子里先想什么"划分，不是按数据结构教科书目录；
- 子类要能独立当一个专题练（一般 15 题以上），太稀疏的合并掉；
- leetcode.cn 的 175 个原始标签长尾很细（Manacher、分块、SSP），
  细标签直接给高权重，粗标签（数组、字符串、数学）给低权重，
  再用"标签组合 + 标题正则"补上官方没打的类型（状压 DP、二分答案、股票 DP 等）。

这里是**多标签打标**，不是单选分类：一道题有几种解法就打几个标签。
接雨水会同时拿到「单调栈 / 双指针 / 线性 DP / 栈」，第 K 大会同时拿到
「快速选择 / 堆 / 分治 / 排序」。权重只用来决定列表里显示哪个当主标签，
不用来做互斥裁决。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Sub:
    id: str
    name: str
    desc: str


@dataclass(frozen=True)
class Cat:
    id: str
    name: str
    desc: str
    subs: tuple[Sub, ...]


CATEGORIES: tuple[Cat, ...] = (
    Cat("basics", "基础与模拟", "把题意翻译成代码的基本功：模拟、枚举、位运算、排序。没有算法门槛，但决定手速和 bug 率。", (
        Sub("simulation", "模拟与实现", "按题意一步步照做，考验边界处理与代码组织。"),
        Sub("enumeration", "枚举与暴力", "数据范围小的时候直接枚举答案或状态，也是很多优化解法的出发点。"),
        Sub("matrix", "矩阵与网格", "二维数组的遍历、旋转、螺旋、原地变换。"),
        Sub("bit", "位运算", "异或性质、lowbit、子集枚举、位计数。"),
        Sub("sorting", "排序与自定义比较", "排序本身，以及「先排序再做」这一类预处理套路。"),
    )),
    Cat("array", "数组与区间技巧", "线性表上的经典套路，面试出现频率最高的一层。", (
        Sub("two-pointers", "双指针", "对撞指针、快慢指针、同向双指针，把 O(n²) 压到 O(n)。"),
        Sub("sliding-window", "滑动窗口", "定长/变长窗口维护区间性质，配合哈希计数。"),
        Sub("prefix-sum", "前缀和与差分", "区间求和 O(1)，差分处理区间修改，二维扩展成矩阵前缀和。"),
        Sub("interval", "区间与扫描线", "区间合并、重叠判定、按端点扫描处理日程与覆盖。"),
    )),
    Cat("ds-basic", "基础数据结构", "面试最爱考的容器：哈希、栈队列、链表、堆。要能手写，也要知道复杂度。", (
        Sub("hash-count", "哈希与计数", "哈希表去重、分组、频次统计，以及「用空间换时间」的思路。"),
        Sub("stack-queue", "栈与队列", "括号匹配、表达式求值、双端队列、用栈模拟递归。"),
        Sub("monotonic", "单调栈与单调队列", "下一个更大元素、柱状图最大矩形、定长窗口最值。"),
        Sub("linked-list", "链表", "翻转、环检测、合并、双向链表与 LRU 的骨架。"),
        Sub("heap", "堆（优先队列）", "Top-K、多路归并、动态维护最值。"),
        Sub("ordered-set", "有序集合", "TreeMap/SortedList 维护有序结构，支持前驱后继查询。"),
    )),
    Cat("string", "字符串", "从基础处理到匹配算法，中文岗位面试里字符串题占比不低。", (
        Sub("string-basic", "字符串基础", "分割、翻转、大小写、进制与数字转换、字符统计。"),
        Sub("palindrome", "回文", "中心扩展、回文 DP、Manacher。"),
        Sub("string-match", "字符串匹配", "KMP、Z 函数、滚动哈希、AC 自动机。"),
        Sub("trie", "字典树", "前缀检索、异或最大值、词典类设计题。"),
    )),
    Cat("binary-search", "二分与分治", "只要答案具有单调性，就能二分；分治则把问题切两半再合并。", (
        Sub("bs-array", "有序数组二分", "查找边界、旋转数组、二维矩阵二分。"),
        Sub("bs-answer", "二分答案", "最小化最大值 / 最大化最小值，二分猜答案再 check。"),
        Sub("divide-conquer", "分治", "归并排序思想、逆序对、区间合并型分治。"),
        Sub("quickselect", "快速选择与 Top-K", "快排划分求第 K 大，期望 O(n)。"),
    )),
    Cat("tree", "树", "递归思维的主战场：先想清楚「当前节点该干什么」。", (
        Sub("tree-traversal", "二叉树遍历", "前中后序、层序、迭代写法与 Morris。"),
        Sub("bst", "二叉搜索树", "中序有序性、查找插入删除、平衡性判断。"),
        Sub("tree-build", "树的构造与序列化", "从遍历序列还原、序列化/反序列化、克隆。"),
        Sub("tree-path", "路径与最近公共祖先", "路径和、直径、LCA、倍增。"),
    )),
    Cat("search", "搜索与回溯", "在状态空间里穷举：怎么走、怎么剪、怎么记忆化。", (
        Sub("backtracking", "回溯", "子集、排列、组合、棋盘类，模板是「选择-递归-撤销」。"),
        Sub("dfs-basic", "深度优先搜索", "一条路走到黑再回头，树、图、网格上的通用遍历骨架。"),
        Sub("flood-fill", "网格搜索", "岛屿、区域填充、多源扩散，DFS/BFS 都能写。"),
        Sub("bfs-shortest", "BFS 最短步数", "无权图最短路、状态压缩成节点做 BFS。"),
        Sub("memo-search", "记忆化搜索", "自顶向下的 DP，先写暴力递归再加缓存。"),
        Sub("search-advanced", "双向与启发式搜索", "双向 BFS、A*、中途相遇。"),
    )),
    Cat("dp", "动态规划", "定义状态 → 写转移 → 定边界。题量最大、区分度最高的一类。", (
        Sub("dp-linear", "线性 DP", "爬楼梯、打家劫舍这类一维递推，入门首选。"),
        Sub("dp-sequence", "序列 DP", "LIS、LCS、编辑距离，两个序列或子序列上的 DP。"),
        Sub("dp-knapsack", "背包 DP", "01 背包、完全背包、多重背包，凑数与选择问题的统一模型。"),
        Sub("dp-grid", "网格 DP", "路径数、最小路径和、二维矩阵上的递推。"),
        Sub("dp-interval", "区间 DP", "在区间上合并，戳气球、石子合并、回文划分。"),
        Sub("dp-tree", "树形 DP", "在树上做 DP，选或不选当前节点、换根。"),
        Sub("dp-bitmask", "状压 DP", "用二进制表示集合状态，处理小规模全排列/覆盖问题。"),
        Sub("dp-machine", "状态机 DP", "股票买卖系列，按持股/冷冻期等状态转移。"),
        Sub("dp-digit", "数位 DP", "按数位逐位统计满足条件的数，配合记忆化。"),
    )),
    Cat("graph", "图论", "建图往往比算法难：先想清楚点是什么、边是什么。", (
        Sub("graph-basic", "建图与遍历", "邻接表、连通分量、DFS/BFS 在一般图上的应用。"),
        Sub("topo", "拓扑排序", "有向无环图的依赖排序、课程表模型、判环。"),
        Sub("shortest-path", "最短路", "Dijkstra、Bellman-Ford、Floyd、0-1 BFS。"),
        Sub("union-find", "并查集", "连通性合并、带权并查集、按秩合并与路径压缩。"),
        Sub("graph-advanced", "进阶图论", "最小生成树、二分图匹配、强连通分量、网络流。"),
    )),
    Cat("greedy", "贪心与构造", "证明比写代码难：要说服自己局部最优能推出全局最优。", (
        Sub("greedy-basic", "贪心策略", "每步取当前最优，常配合排序或哈希。"),
        Sub("greedy-interval", "区间贪心", "按右端点排序选不重叠区间、最少箭数、会议安排。"),
        Sub("greedy-heap", "堆贪心与调度", "用优先队列动态维护当前最优选择，任务调度类。"),
        Sub("construct", "构造与思维题", "摩尔投票、抽屉原理、找规律，代码短但需要洞察。"),
    )),
    Cat("math", "数学", "数论、组合、几何、概率与博弈，公式想明白代码就几行。", (
        Sub("number-theory", "数论", "GCD/LCM、质因数分解、筛法、快速幂与同余。"),
        Sub("combinatorics", "组合数学", "排列组合计数、容斥、卡特兰数。"),
        Sub("geometry", "计算几何", "点线关系、面积、凸包、最近点对。"),
        Sub("probability", "概率与随机化", "期望计算、随机采样、水塘抽样、拒绝采样。"),
        Sub("game-theory", "博弈论", "必胜态判定、极小化极大、Nim 与 SG 函数。"),
    )),
    Cat("advanced-ds", "高级数据结构", "竞赛味更重的一层，面试出现少但能拉开上限。", (
        Sub("segment-tree", "线段树与区间查询", "区间求和/最值、懒标记、动态开点、Sparse Table、分块。"),
        Sub("fenwick", "树状数组", "单点修改区间查询，配合离散化求逆序对。"),
        Sub("balanced-tree", "平衡树与可持久化", "Treap/Splay、笛卡尔树、可持久化结构、K-D 树。"),
        Sub("suffix", "后缀结构", "后缀数组、后缀自动机、回文树。"),
    )),
    Cat("design", "设计与工程", "偏工程的一类：接口怎么定、复杂度怎么摊、并发怎么控。", (
        Sub("ds-design", "数据结构设计", "LRU/LFU、跳表、时间映射，组合已有结构达到目标复杂度。"),
        Sub("data-stream", "数据流", "在线处理无限输入，中位数、滑动平均、Top-K。"),
        Sub("iterator", "迭代器与惰性求值", "展开嵌套结构、按需产出下一个元素。"),
        Sub("concurrency", "多线程", "锁、信号量、条件变量，按顺序打印类题目。"),
        Sub("db-shell", "数据库与 Shell", "SQL 查询与文本处理，独立于算法的一条支线。"),
    )),
)

SUB_TO_CAT: dict[str, str] = {s.id: c.id for c in CATEGORIES for s in c.subs}
CAT_BY_ID: dict[str, Cat] = {c.id: c for c in CATEGORIES}
SUB_BY_ID: dict[str, Sub] = {s.id: s for c in CATEGORIES for s in c.subs}

# 学习顺序：既是先修关系，也是学习计划里大类的推进顺序。
CAT_ORDER: tuple[str, ...] = (
    "basics", "array", "ds-basic", "string", "binary-search",
    "tree", "search", "dp", "graph", "greedy", "math", "advanced-ds", "design",
)

# --- 原始标签 -> 子类。权重代表"这个标签有多能说明题目类型" ----------------------
TAG_MAP: dict[str, tuple[str, int]] = {
    # 基础
    "simulation": ("simulation", 30), "brute-force-search": ("enumeration", 35),
    "array": ("simulation", 16),  # 「数组」太泛，只当兜底信号
    "enumeration": ("enumeration", 28), "matrix": ("matrix", 33),
    "bit-manipulation": ("bit", 42), "bitmask": ("bit", 44),
    "sorting": ("sorting", 24), "sort": ("sorting", 24),
    "counting-sort": ("sorting", 52), "bucket-sort": ("sorting", 52),
    "radix-sort": ("sorting", 52), "bubble-sort": ("sorting", 52),
    "tournament-sort": ("sorting", 52), "timsort": ("sorting", 52),
    # 数组与区间
    "two-pointers": ("two-pointers", 52), "floyds-cycle-finding-algorithm": ("two-pointers", 66),
    "sliding-window": ("sliding-window", 72), "prefix-sum": ("prefix-sum", 56),
    "sweep-line": ("interval", 84),
    # 基础数据结构
    "hash-table": ("hash-count", 26), "counting": ("hash-count", 28),
    "hash-function": ("hash-count", 46),
    "stack": ("stack-queue", 46), "queue": ("stack-queue", 46),
    "bracket-sequences": ("stack-queue", 64),
    "monotonic-stack": ("monotonic", 86), "monotonic-queue": ("monotonic", 86),
    "linked-list": ("linked-list", 62), "doubly-linked-list": ("linked-list", 66),
    "heap-priority-queue": ("heap", 60), "ordered-set": ("ordered-set", 56),
    # 字符串
    "string": ("string-basic", 20),
    "manacher": ("palindrome", 90), "palindromic-tree": ("palindrome", 90),
    "string-matching": ("string-match", 76), "rolling-hash": ("string-match", 76),
    "knuth-morris-pratt-algorithm": ("string-match", 90), "z-algorithm": ("string-match", 90),
    "boyer-moore-string-search-algorithm": ("string-match", 90),
    "aho-corasick-algorithm": ("string-match", 90),
    "lexicographically-minimal-string-rotation": ("string-match", 88),
    "lyndon-factorization": ("string-match", 88),
    "trie": ("trie", 80),
    # 二分与分治
    "binary-search": ("bs-array", 46), "ternary-search": ("bs-array", 60),
    "divide-and-conquer": ("divide-conquer", 60), "merge-sort": ("divide-conquer", 66),
    "quickselect": ("quickselect", 82), "quicksort": ("quickselect", 62),
    # 树
    "tree": ("tree-traversal", 36), "binary-tree": ("tree-traversal", 46),
    "binary-search-tree": ("bst", 70),
    "lowest-common-ancestor": ("tree-path", 86), "binary-lifting": ("tree-path", 84),
    # 搜索
    "backtracking": ("backtracking", 76), "algorithm-x": ("backtracking", 86),
    "dancing-links": ("backtracking", 86),
    "depth-first-search": ("dfs-basic", 40), "breadth-first-search": ("bfs-shortest", 40),
    "memoization": ("memo-search", 66), "recursion": ("memo-search", 32),
    "bidirectional-search": ("search-advanced", 84), "a-search": ("search-advanced", 86),
    "heuristic-search": ("search-advanced", 84), "meet-in-the-middle": ("search-advanced", 84),
    # 动态规划
    "dynamic-programming": ("dp-linear", 55),
    "longest-increasing-subsequence": ("dp-sequence", 90),
    "longest-common-subsequence": ("dp-sequence", 90),
    "knapsack-problem": ("dp-knapsack", 90), "0-1-knapsack": ("dp-knapsack", 92),
    "complete-knapsack": ("dp-knapsack", 92), "multiple-knapsack": ("dp-knapsack", 92),
    "mixed-knapsack": ("dp-knapsack", 92),
    "dp-on-trees": ("dp-tree", 95),
    # 图论
    "graph": ("graph-basic", 42), "directed-acyclic-graph": ("graph-basic", 60),
    "graph-coloring": ("graph-basic", 62), "planar-graph": ("graph-basic", 70),
    "topological-sort": ("topo", 86),
    "shortest-path": ("shortest-path", 86), "dijkstra": ("shortest-path", 92),
    "bellman-ford-algorithm": ("shortest-path", 92), "floyd-warshall-algorithm": ("shortest-path", 92),
    "0-1-bfs": ("shortest-path", 88), "k-shortest-path": ("shortest-path", 92),
    "successive-shortest-path-algorithm": ("graph-advanced", 90),
    "union-find": ("union-find", 78),
    "minimum-spanning-tree": ("graph-advanced", 90), "kruskals-algorithm": ("graph-advanced", 90),
    "prims-algorithm": ("graph-advanced", 90), "boruvkas-algorithm": ("graph-advanced", 90),
    "bipartite-graph": ("graph-advanced", 86), "matching-graph": ("graph-advanced", 86),
    "maximum-matching": ("graph-advanced", 88), "perfect-matching": ("graph-advanced", 88),
    "hungarian-algorithm": ("graph-advanced", 90), "flow-network": ("graph-advanced", 90),
    "maximum-flow": ("graph-advanced", 90), "minimum-cut": ("graph-advanced", 90),
    "minimum-cost-flow": ("graph-advanced", 90), "dinics-algorithm": ("graph-advanced", 92),
    "edmonds-karp-algorithm": ("graph-advanced", 92), "mpm-algorithm": ("graph-advanced", 92),
    "push-relabel-algorithm": ("graph-advanced", 92),
    "strongly-connected-component": ("graph-advanced", 88),
    "tarjans-scc-algorithm": ("graph-advanced", 90), "kosarajus-algorithm": ("graph-advanced", 90),
    "biconnected-component": ("graph-advanced", 88), "articulation-point": ("graph-advanced", 88),
    "bridge-graph": ("graph-advanced", 88), "eulerian-path": ("graph-advanced", 88),
    "eulerian-circuit": ("graph-advanced", 88), "eulerian-graph": ("graph-advanced", 88),
    "semi-eulerian-graph": ("graph-advanced", 88), "hamiltonian-path": ("graph-advanced", 88),
    # 贪心与构造
    "greedy": ("greedy-basic", 46), "brainteaser": ("construct", 62),
    "pigeonhole-principle": ("construct", 72),
    "boyer-moore-majority-vote-algorithm": ("construct", 76),
    # 数学
    "math": ("number-theory", 18), "number-theory": ("number-theory", 62),
    "greatest-common-divisor": ("number-theory", 70), "euclidean-algorithm": ("number-theory", 72),
    "extended-euclidean-algorithm": ("number-theory", 76), "least-common-multiple": ("number-theory", 70),
    "prime-factorization": ("number-theory", 72), "primality-test": ("number-theory", 72),
    "sieve-theory": ("number-theory", 76), "prime-number-sieve": ("number-theory", 76),
    "fermats-little-theorem": ("number-theory", 76), "eulers-totient-function": ("number-theory", 78),
    "eulers-theorem": ("number-theory", 78), "bezouts-lemma": ("number-theory", 78),
    "newtons-method": ("number-theory", 70), "linear-algebra": ("number-theory", 70),
    "combinatorics": ("combinatorics", 66), "inclusion-exclusion-principle": ("combinatorics", 76),
    "geometry": ("geometry", 66), "polygons": ("geometry", 72), "convex-hull": ("geometry", 82),
    "nearest-pair-of-points": ("geometry", 82), "triangulation": ("geometry", 82),
    "minimum-enclosing-circle": ("geometry", 82),
    "probability-and-statistics": ("probability", 70), "randomized": ("probability", 70),
    "reservoir-sampling": ("probability", 86), "rejection-sampling": ("probability", 86),
    "game-theory": ("game-theory", 80), "minimax-algorithm": ("game-theory", 80),
    "zero-sum-game": ("game-theory", 80), "impartial-game": ("game-theory", 84),
    "nim-game": ("game-theory", 88), "sprague-grundy-theorem": ("game-theory", 88),
    # 高级数据结构
    "segment-tree": ("segment-tree", 88), "li-chao-tree": ("segment-tree", 92),
    "range-minimum-maximum-query": ("segment-tree", 84), "sparse-table": ("segment-tree", 86),
    "sqrt-decomposition": ("segment-tree", 86),
    "binary-indexed-tree": ("fenwick", 90),
    "treap": ("balanced-tree", 84), "splay-tree": ("balanced-tree", 84),
    "cartesian-tree": ("balanced-tree", 80), "k-d-tree": ("balanced-tree", 86),
    "persistent-data-structure": ("balanced-tree", 90),
    "suffix-array": ("suffix", 88), "suffix-tree": ("suffix", 88),
    "suffix-automaton": ("suffix", 88),
    # 设计
    "design": ("ds-design", 60), "interactive": ("ds-design", 66),
    "data-stream": ("data-stream", 72), "iterator": ("iterator", 72),
    "concurrency": ("concurrency", 96), "database": ("db-shell", 98), "shell": ("db-shell", 98),
}


@dataclass(frozen=True)
class Rule:
    """标签组合 + 标题正则的补充规则，用来补官方标签没覆盖到的题型。"""

    sub: str
    weight: int
    all_tags: tuple[str, ...] = ()
    any_tags: tuple[str, ...] = ()
    title: str = ""
    not_tags: tuple[str, ...] = ()
    why: str = ""
    _re: re.Pattern[str] | None = field(default=None, compare=False)

    def matches(self, tags: set[str], title: str) -> bool:
        if self.all_tags and not set(self.all_tags) <= tags:
            return False
        if self.any_tags and not (set(self.any_tags) & tags):
            return False
        if self.not_tags and (set(self.not_tags) & tags):
            return False
        if self.title and not re.search(self.title, title):
            return False
        return True


RULES: tuple[Rule, ...] = (
    # —— DP 的细分：官方只给一个"动态规划"，类型全靠组合和标题认 ——
    Rule("dp-bitmask", 96, all_tags=("dynamic-programming", "bitmask"), why="动态规划+位掩码"),
    Rule("dp-tree", 94, all_tags=("dynamic-programming",), any_tags=("tree", "binary-tree"), why="动态规划+树"),
    Rule("dp-grid", 86, all_tags=("dynamic-programming", "matrix"), why="动态规划+矩阵"),
    Rule("dp-grid", 84, all_tags=("dynamic-programming",), title=r"路径|网格|方格|棋盘|三角形", why="标题含网格路径"),
    Rule("dp-machine", 92, all_tags=("dynamic-programming",), title=r"股票|买卖", why="标题含股票买卖"),
    Rule("dp-knapsack", 88, all_tags=("dynamic-programming",),
         title=r"背包|零钱|硬币|目标和|等和子集|分割等和|组合总和 Ⅳ|完全平方数", why="标题含背包型关键词"),
    Rule("dp-sequence", 88, all_tags=("dynamic-programming",),
         title=r"子序列|编辑距离|公共前缀|公共子串|通配符|正则|交错字符串|不同的子序列", why="标题含序列型关键词"),
    Rule("dp-interval", 88, all_tags=("dynamic-programming",),
         title=r"戳气球|石子|石头|合并.*区间|区间|括号|移除盒子|奇怪的打印机|扎气球", why="标题含区间合并型关键词"),
    Rule("dp-linear", 88, all_tags=("dynamic-programming",),
         title=r"拆分|方案数|多少种|不同的方法|种方法|计数", why="标题含方案计数"),
    Rule("dp-digit", 90, all_tags=("dynamic-programming",), title=r"数位|至少有 1 位重复|不含连续|范围内.*整数", why="标题含数位统计"),
    Rule("dp-digit", 88, any_tags=("dynamic-programming",), title=r"统计.*(整数|数字).*(数目|个数)", why="标题含数位统计"),
    Rule("dp-sequence", 86, any_tags=("dynamic-programming",), title=r"最长(递增|上升|连续递增)", why="标题含最长递增子序列"),
    # —— 二分答案：官方没有这个标签，得自己认。
    # 这里只留「最小化最大值」这种无歧义的说法当兜底；「至少/最少几次」「速度」「制作」
    # 这些词太散（每日温度、有效三角形都会误命中），交给 statement.py 去读题面判断 ——
    # 那边有 37 条验证用例盯着，比在标题上碰运气准得多。
    Rule("bs-answer", 82, all_tags=("binary-search",),
         title=r"最小(化)?.{0,8}最大|最大(化)?.{0,8}最小|最小的?最大值|最大的?最小值",
         why="二分+最值语义"),
    Rule("bs-array", 66, all_tags=("binary-search", "divide-and-conquer"), why="二分+分治"),
    Rule("bfs-shortest", 84, any_tags=("breadth-first-search",),
         title=r"最短|最少步|最少次数|最少操作|最小步|最少的?步数", why="BFS+最短语义"),
    # —— 网格搜索：DFS/BFS + 矩阵 ——
    Rule("flood-fill", 80, any_tags=("depth-first-search", "breadth-first-search"), all_tags=("matrix",), why="搜索+矩阵"),
    Rule("flood-fill", 78, any_tags=("depth-first-search", "breadth-first-search"),
         title=r"岛屿|区域|感染|腐烂|填充|迷宫|矩阵", why="标题含网格扩散"),
    # 裸的 DFS/BFS 标签要看上下文：在图上是图遍历，在树上是树遍历
    Rule("graph-basic", 62, any_tags=("depth-first-search", "breadth-first-search"),
         all_tags=("graph",), why="搜索+图"),
    Rule("tree-traversal", 62, any_tags=("depth-first-search", "breadth-first-search"),
         all_tags=("binary-tree",), why="搜索+二叉树"),
    Rule("tree-traversal", 58, any_tags=("depth-first-search", "breadth-first-search"),
         all_tags=("tree",), why="搜索+树"),
    # —— 树：官方 tree/binary-tree 太粗 ——
    Rule("tree-build", 74, any_tags=("tree", "binary-tree"), title=r"构造|还原|序列化|反序列化|克隆|复制|恢复", why="树+构造语义"),
    Rule("tree-path", 74, any_tags=("tree", "binary-tree"), title=r"路径|祖先|直径|距离|深度和", why="树+路径语义"),
    Rule("bst", 72, any_tags=("tree", "binary-tree"), title=r"搜索树|BST|有序", why="树+有序语义"),
    # —— 贪心细分 ——
    Rule("greedy-heap", 80, all_tags=("greedy", "heap-priority-queue"), why="贪心+堆"),
    Rule("greedy-interval", 78, all_tags=("greedy",), title=r"区间|会议|日程|重叠|气球|覆盖|排程|安排", why="贪心+区间语义"),
    Rule("interval", 74, any_tags=("array", "sorting"), title=r"区间|会议|日程|重叠|覆盖", why="标题含区间"),
    # —— 其它常见套路 ——
    Rule("prefix-sum", 70, any_tags=("array",), title=r"前缀和|区间和|子数组和|差分", why="标题含前缀和"),
    # 「连续」两个字太宽（最长连续序列其实是哈希/并查集），必须落到子串/子数组上
    Rule("sliding-window", 76, any_tags=("string", "array"),
         title=r"最长(子串|子数组)|最短(子串|子数组)|窗口|连续子数组|连续子串|定长|长度为 ?[Kk]",
         why="标题含定/变长窗口"),
    Rule("palindrome", 74, any_tags=("string", "dynamic-programming"), title=r"回文", why="标题含回文"),
    Rule("linked-list", 70, any_tags=("linked-list",), title=r"链表|环|节点", why="链表语义"),
    Rule("ds-design", 74, any_tags=("design",), title=r"设计|实现.*(类|结构)|缓存|LRU|LFU|跳表|迭代器", why="设计类题面"),
    Rule("memo-search", 70, all_tags=("memoization",), why="官方标注记忆化"),
    # 「游戏」太宽（矩阵取数游戏是区间 DP），只认真正的博弈关键词
    Rule("game-theory", 82, any_tags=("dynamic-programming", "math"),
         title=r"博弈|石子游戏|取石子|猜数字|必胜|Nim|翻硬币|谁先", why="标题含博弈"),
    Rule("bit", 60, any_tags=("bit-manipulation",), title=r"异或|位|二进制|汉明", why="标题含位运算"),
)

# 一个题目啥都没匹配上时的兜底子类。
FALLBACK_SUB = "simulation"

# 低于这个权重的标签只是结构噪音（数组/数学/字符串这种），不单独成标；
# 但如果一道题只剩这些信号，会保留权重最高的那个兜底。
KEEP_THRESHOLD = 24
MAX_TAGS = 8

# 更具体的标签出现时，压掉泛化标签，避免「网格搜索 + 深度优先搜索」这种重复表述。
SUPPRESS: dict[str, tuple[str, ...]] = {
    "dfs-basic": ("flood-fill", "graph-basic", "tree-traversal", "backtracking", "memo-search", "dp-tree"),
    "bfs-shortest": ("flood-fill", "topo", "tree-traversal"),
}

# 主标签校正：规则算出来的主标签不合适时手工钉一下（同时保证该标签一定在标签集里）。
# 只钉经典题，不做穷举；不会删掉题目已有的其它解法标签。
MAIN_TAG_PINS: dict[str, str] = {
    # 二分答案：题面里没有"最小化最大值"这种字眼，纯靠语义
    "410": "bs-answer", "875": "bs-answer", "1011": "bs-answer", "1482": "bs-answer",
    "1552": "bs-answer", "1760": "bs-answer", "2064": "bs-answer", "2226": "bs-answer",
    "1231": "bs-answer", "2517": "bs-answer", "1283": "bs-answer", "1898": "bs-answer",
    "668": "bs-answer", "719": "bs-answer", "378": "bs-answer", "774": "bs-answer",
    # 数位 DP
    "233": "dp-digit", "357": "dp-digit", "600": "dp-digit", "902": "dp-digit",
    "1012": "dp-digit", "2376": "dp-digit", "2719": "dp-digit",
    # 区间 DP / 状态机 DP 的代表作
    "1000": "dp-interval", "1547": "dp-interval", "664": "dp-interval", "546": "dp-interval",
    "309": "dp-machine", "714": "dp-machine",
    # 经典题但标签容易误导
    "139": "dp-linear",   # 单词拆分：字典树只是可选优化
    "4": "bs-array",      # 寻找两个正序数组的中位数
    "218": "interval",    # 天际线：扫描线
    "315": "fenwick",     # 计算右侧小于当前元素的个数
    "42": "monotonic",    # 接雨水
    "460": "ds-design", "146": "ds-design",
}

# 一题多解的补充：某个解法成立时，另一种常见解法通常也成立。
# 只写确实等价的对子，避免污染标签。
ALT_APPROACHES: dict[str, tuple[tuple[str, int], ...]] = {
    "quickselect": (("heap", 58), ("sorting", 40)),
    "monotonic": (("stack-queue", 44),),
    "memo-search": (("dp-linear", 50),),
    "dp-knapsack": (("memo-search", 46),),
    "dp-tree": (("tree-traversal", 46),),
    "bs-answer": (("bs-array", 44),),
    "flood-fill": (("bfs-shortest", 44),),
    "topo": (("graph-basic", 46),),
    "shortest-path": (("graph-basic", 44), ("heap", 42)),
    "union-find": (("graph-basic", 42),),
    "trie": (("hash-count", 40),),
}


def tag_problem(tag_slugs: list[str], title: str, qid: str = "",
                tag_names: dict[str, str] | None = None,
                seeds: list[tuple[str, int, str]] | None = None) -> tuple[str, list[dict]]:
    """给一道题打上全部成立的解法标签。

    返回 (主标签, [{id, w, src}, ...])，按权重降序。src 记录这个标签是怎么来的，
    便于在页面上解释，也便于回头调规则。
    seeds 用来接别的题源已经标好的类型（洛谷的「区间 DP」这类）。
    """
    names = tag_names or {}
    tags = set(tag_slugs)
    hits: dict[str, dict] = {}

    def add(sub: str, weight: int, src: str) -> None:
        cur = hits.setdefault(sub, {"w": 0, "src": []})
        cur["w"] = max(cur["w"], weight)
        if src not in cur["src"]:
            cur["src"].append(src)

    for slug in tag_slugs:
        hit = TAG_MAP.get(slug)
        if hit:
            add(hit[0], hit[1], names.get(slug, slug))

    for sub, weight, src in seeds or ():
        if sub in SUB_BY_ID:
            add(sub, weight, src)

    for rule in RULES:
        if rule.matches(tags, title):
            add(rule.sub, rule.weight, rule.why or "组合规则")

    # 解法联想：等价解法互相带出来，权重压一档，避免盖过原生信号
    for sub, alts in list(ALT_APPROACHES.items()):
        if sub in hits and hits[sub]["w"] >= 60:
            for alt, weight in alts:
                add(alt, weight, f"{SUB_BY_ID[sub].name}的等价解法")

    pinned = MAIN_TAG_PINS.get(qid)
    if pinned:
        add(pinned, 100, "人工校正")

    if not hits:
        return FALLBACK_SUB, [{"id": FALLBACK_SUB, "w": 10, "src": ["兜底"]}]

    ranked = sorted(hits.items(), key=lambda kv: (-kv[1]["w"], kv[0]))
    kept = [(s, v) for s, v in ranked if v["w"] >= KEEP_THRESHOLD] or ranked[:1]
    for weak, stronger in SUPPRESS.items():
        if any(s == weak for s, _ in kept) and any(
                s in stronger and v["w"] >= 50 for s, v in kept):
            kept = [(s, v) for s, v in kept if s != weak]
    kept = kept[:MAX_TAGS]
    main = pinned if pinned and any(s == pinned for s, _ in kept) else kept[0][0]
    return main, [{"id": s, "w": v["w"], "src": v["src"]} for s, v in kept]


def export() -> list[dict]:
    """给前端用的分类树。"""
    return [
        {
            "id": c.id,
            "name": c.name,
            "desc": c.desc,
            "order": CAT_ORDER.index(c.id),
            "subs": [{"id": s.id, "name": s.name, "desc": s.desc} for s in c.subs],
        }
        for c in CATEGORIES
    ]
