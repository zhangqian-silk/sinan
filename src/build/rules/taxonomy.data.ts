/**
 * 标签树：13 个分区打头，下面的层级**不固定**——某一枝真的分化出并列技巧就往下长一层，
 * 分化不出来就停在原地。目前最深三级（数论 → 筛法 / 快速幂 / 取模 / GCD / 进制），
 * 但结构是递归的，将来要长第四级不用改类型。
 *
 * 深层节点的 id 直接复用思路 id（`math-sieve`、`monotonic-stack`），所以标签树和题解
 * 思路是同一套 id、同一棵树 —— 深层标签就是「这道题的题解里真的用了这个技巧」。
 *
 * 正则用 Python 的源码口径书写（`\b` `\w` 认中文），编译时交给 pyre.py() 翻译成
 * JS 等价写法。这份表就是打标规则的唯一来源，改规则请改这里。
 */


/** 标签树节点。`kids` 递归，层数由实际分化情况决定，不设上限。 */
export interface Sub { id: string; name: string; desc: string; kids?: Sub[] }
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

/**
 * 原始标签直接点名到某个深层节点的情形。
 *
 * 力扣的 `monotonic-stack`、洛谷的「素数判断」说的就是具体技巧本身，比我们从题解里
 * 反推还直接。洛谷题抓不到题解，深层标签几乎全靠这张表 —— 没有它，2000 道洛谷题
 * 就只能停在二级。
 *
 * 落成标签仍然要求父节点在场，规则和从题解判出来的那批一致。
 */
export const LEAF_TAG_MAP: Record<string, string> = {
  // 力扣（标签 slug）
  "monotonic-stack": "monotonic-stack",
  "monotonic-queue": "monotonic-queue",
  "rolling-hash": "rolling-hash",
  "knuth-morris-pratt-algorithm": "kmp",
  "sieve-theory": "math-sieve",
  "prime-number-sieve": "math-sieve",
  "primality-test": "math-sieve",
  "prime-factorization": "math-sieve",
  "greatest-common-divisor": "math-gcd",
  "euclidean-algorithm": "math-gcd",
  "extended-euclidean-algorithm": "math-gcd",
  "bezouts-lemma": "math-gcd",
  "least-common-multiple": "math-gcd",
  "fermats-little-theorem": "math-fermat",
  // 洛谷（中文标签原文）
  "单调栈": "monotonic-stack",
  "单调队列": "monotonic-queue",
  "素数判断": "math-sieve",
  "线性筛法": "math-sieve",
  "筛法": "math-sieve",
  "最大公约数 gcd": "math-gcd",
  "扩展欧几里德算法": "math-gcd",
  "进制": "math-base",
  "KMP 算法": "kmp",
  "矩阵加速": "math-fast-pow",
  "同余方程": "math-mod",
  "中国剩余定理 CRT": "math-mod",
  "dijkstra": "graph-dijkstra",
  "bellman-ford-algorithm": "graph-bellman",
  "floyd-warshall-algorithm": "graph-floyd",
  "0-1-bfs": "graph-dijkstra",
  "minimum-spanning-tree": "graph-mst",
  "kruskals-algorithm": "graph-mst",
  "prims-algorithm": "graph-mst",
  "boruvkas-algorithm": "graph-mst",
  "bipartite-graph": "graph-bipartite",
  "hungarian-algorithm": "graph-bipartite",
  "maximum-matching": "graph-bipartite",
  "perfect-matching": "graph-bipartite",
  "matching-graph": "graph-bipartite",
  "graph-coloring": "graph-bipartite",
  "strongly-connected-component": "graph-scc",
  "tarjans-scc-algorithm": "graph-scc",
  "kosarajus-algorithm": "graph-scc",
  "biconnected-component": "graph-scc",
  "articulation-point": "graph-scc",
  "bridge-graph": "graph-scc",
  "eulerian-path": "graph-euler",
  "eulerian-circuit": "graph-euler",
  "eulerian-graph": "graph-euler",
  "semi-eulerian-graph": "graph-euler",
  "flow-network": "graph-flow",
  "maximum-flow": "graph-flow",
  "minimum-cut": "graph-flow",
  "minimum-cost-flow": "graph-flow",
  "edmonds-karp-algorithm": "graph-flow",
  "dinics-algorithm": "graph-flow",
  "push-relabel-algorithm": "graph-flow",
  "0-1-knapsack": "dp-knapsack-01",
  "complete-knapsack": "dp-knapsack-full",
  "longest-increasing-subsequence": "dp-lis",
  "longest-common-subsequence": "dp-lcs",
  "z-algorithm": "zfunc",
  "manacher": "manacher",
  "floyds-cycle-finding-algorithm": "fast-slow",
  "sweep-line": "sweep-line",
  "lowest-common-ancestor": "tree-lca",
  "binary-lifting": "tree-lca",
  "inclusion-exclusion-principle": "math-inclusion",
  "eulers-totient-function": "math-euler-phi",
  "eulers-theorem": "math-euler-phi",
  "bidirectional-search": "bidirectional",
  "meet-in-the-middle": "bidirectional",
  "a-search": "astar",
  "heuristic-search": "astar",
  "Floyd 算法": "graph-floyd",
  "差分约束": "graph-bellman",
  "最短路": "graph-dijkstra",
  "生成树": "graph-mst",
  "最小生成树": "graph-mst",
  "二分图": "graph-bipartite",
  "Tarjan": "graph-scc",
  "强连通分量": "graph-scc",
  "网络流": "graph-flow",
  "最小割": "graph-flow",
  "费用流": "graph-flow",
  "欧拉回路": "graph-euler",
  "差分": "diff-array",
  "扫描线": "sweep-line",
  "剪枝": "pruning",
  "容斥原理": "math-inclusion",
  "欧拉函数": "math-euler-phi",
  "逆元": "math-fermat",
  "最近公共祖先": "tree-lca",
  "倍增": "tree-lca",
  "Catalan 数": "math-catalan",
  "manacher 算法": "manacher",
  "后缀数组": "zfunc",
  "最长上升子序列": "dp-lis",
  "双向搜索": "bidirectional",
  "启发式搜索": "astar",
};

/**
 * 一个节点要不要再往下分，只看一件事：**它底下有没有具名的技巧**。
 *
 * 不追求各枝对称，也不卡题量下限 —— 现实本来就是不齐的。最短路底下 Dijkstra 175 题、
 * Floyd 十几题，照样各占一格；回溯底下只有「剪枝」一个孩子，也照立。反过来，
 * 「深度优先搜索 → DFS」这种孩子就是父节点本身的，不立；「递归」「模拟」「暴力」
 * 这类谁都沾边的通用词也不算技巧，题再多也不立。
 *
 * 现在是 21 个二级节点各带一层，共 52 个三级节点，其余 44 个二级节点就地收尾。
 * 同一条判据将来照样适用于第四级 —— 结构是递归的，深到几层由实际情况决定。
 */
export const CATEGORIES: Cat[] = [
  { id: "basics", name: "基础与模拟", desc: "把题意翻译成代码的基本功：模拟、枚举、位运算、排序。没有算法门槛，但决定手速和 bug 率。", subs: [
    { id: "simulation", name: "模拟与实现", desc: "按题意一步步照做，考验边界处理与代码组织。" },
    { id: "enumeration", name: "枚举与暴力", desc: "数据范围小的时候直接枚举答案或状态，也是很多优化解法的出发点。" },
    { id: "matrix", name: "矩阵与网格", desc: "二维数组的遍历、旋转、螺旋、原地变换。" },
    { id: "bit", name: "位运算", desc: "异或性质、lowbit、子集枚举、位计数。", kids: [
      { id: "math-xor", name: "异或性质", desc: "自反与交换律，找落单的数、成对消去。" },
      { id: "bit-enum", name: "子集枚举", desc: "位掩码枚举子集，状压 DP 的入口。" },
    ] },
    { id: "sorting", name: "排序与自定义比较", desc: "排序本身，以及「先排序再做」这一类预处理套路。" },
  ] },
  { id: "array", name: "数组与区间技巧", desc: "线性表上的经典套路，面试出现频率最高的一层。", subs: [
    { id: "two-pointers", name: "双指针", desc: "对撞指针、快慢指针、同向双指针，把 O(n²) 压到 O(n)。", kids: [
      { id: "fast-slow", name: "快慢指针", desc: "一快一慢找环、找中点、找倒数第 k 个。" },
    ] },
    { id: "sliding-window", name: "滑动窗口", desc: "定长/变长窗口维护区间性质，配合哈希计数。" },
    { id: "prefix-sum", name: "前缀和与差分", desc: "区间求和 O(1)，差分处理区间修改，二维扩展成矩阵前缀和。", kids: [
      { id: "diff-array", name: "差分数组", desc: "区间加变成两个端点改，扫一遍还原。" },
    ] },
    { id: "interval", name: "区间与扫描线", desc: "区间合并、重叠判定、按端点扫描处理日程与覆盖。", kids: [
      { id: "sweep-line", name: "扫描线", desc: "把区间拆成端点事件，排序后一遍扫过去。" },
    ] },
  ] },
  { id: "ds-basic", name: "基础数据结构", desc: "面试最爱考的容器：哈希、栈队列、链表、堆。要能手写，也要知道复杂度。", subs: [
    { id: "hash-count", name: "哈希与计数", desc: "哈希表去重、分组、频次统计，以及「用空间换时间」的思路。" },
    { id: "stack-queue", name: "栈与队列", desc: "括号匹配、表达式求值、双端队列、用栈模拟递归。" },
    { id: "monotonic", name: "单调栈与单调队列", desc: "下一个更大元素、柱状图最大矩形、定长窗口最值。", kids: [
      { id: "dp-opt", name: "单调队列优化 DP", desc: "转移里取窗口最值，用单调队列把一层循环省掉。" },
      { id: "monotonic-stack", name: "单调栈", desc: "左右两边第一个更大 / 更小元素，弹出的那一刻出答案。" },
      { id: "monotonic-queue", name: "单调队列", desc: "滑动窗口最值，队尾去无效、队头去出窗。" },
    ] },
    { id: "linked-list", name: "链表", desc: "翻转、环检测、合并、双向链表与 LRU 的骨架。", kids: [
      { id: "list-merge", name: "链表归并", desc: "两两归并或分治归并，K 路合并的骨架。" },
      { id: "list-dummy", name: "虚拟头节点", desc: "省掉「删的是不是头节点」的分支，插删统一写法。" },
      { id: "list-reverse", name: "链表反转", desc: "三指针原地翻转，K 个一组、回文链表的基本件。" },
    ] },
    { id: "heap", name: "堆（优先队列）", desc: "Top-K、多路归并、动态维护最值。" },
    { id: "ordered-set", name: "有序集合", desc: "TreeMap/SortedList 维护有序结构，支持前驱后继查询。" },
  ] },
  { id: "string", name: "字符串", desc: "从基础处理到匹配算法，中文岗位面试里字符串题占比不低。", subs: [
    { id: "string-basic", name: "字符串基础", desc: "分割、翻转、大小写、进制与数字转换、字符统计。" },
    { id: "palindrome", name: "回文", desc: "中心扩展、回文 DP、Manacher。", kids: [
      { id: "palindrome-center", name: "中心扩展", desc: "枚举中心往两边扩，奇偶各一次。" },
      { id: "manacher", name: "Manacher", desc: "插分隔符统一奇偶，O(n) 求所有回文半径。" },
    ] },
    { id: "string-match", name: "字符串匹配", desc: "KMP、Z 函数、滚动哈希、AC 自动机。", kids: [
      { id: "zfunc", name: "Z 函数 / 扩展 KMP", desc: "每个后缀与整串的最长公共前缀。" },
      { id: "kmp", name: "KMP", desc: "失配指针 next 数组，O(n+m) 找模式串。" },
      { id: "rolling-hash", name: "字符串哈希", desc: "滚动哈希 O(1) 比较子串，注意冲突与双模。" },
    ] },
    { id: "trie", name: "字典树", desc: "前缀检索、异或最大值、词典类设计题。" },
  ] },
  { id: "binary-search", name: "二分与分治", desc: "只要答案具有单调性，就能二分；分治则把问题切两半再合并。", subs: [
    { id: "bs-array", name: "有序数组二分", desc: "查找边界、旋转数组、二维矩阵二分。" },
    { id: "bs-answer", name: "二分答案", desc: "最小化最大值 / 最大化最小值，二分猜答案再 check。" },
    { id: "divide-conquer", name: "分治", desc: "归并排序思想、逆序对、区间合并型分治。" },
    { id: "quickselect", name: "快速选择与 Top-K", desc: "快排划分求第 K 大，期望 O(n)。" },
  ] },
  { id: "tree", name: "树", desc: "递归思维的主战场：先想清楚「当前节点该干什么」。", subs: [
    { id: "tree-traversal", name: "二叉树遍历", desc: "前中后序、层序、迭代写法与 Morris。", kids: [
      { id: "tree-morris", name: "Morris 遍历", desc: "借空指针回溯，O(1) 空间完成中序。" },
      { id: "tree-preorder", name: "前序遍历", desc: "先处理当前节点再递归子树，自顶向下传信息。" },
      { id: "tree-inorder", name: "中序遍历", desc: "左-根-右，BST 的中序恰好是升序。" },
      { id: "tree-postorder", name: "后序遍历", desc: "先收齐子树答案再处理当前节点，树形 DP 全靠它。" },
      { id: "tree-levelorder", name: "层序遍历", desc: "队列按层展开，用层大小做分层处理。" },
      { id: "tree-iterative", name: "迭代写法", desc: "显式栈模拟递归，深度大时不爆栈。" },
    ] },
    { id: "bst", name: "二叉搜索树", desc: "中序有序性、查找插入删除、平衡性判断。" },
    { id: "tree-build", name: "树的构造与序列化", desc: "从遍历序列还原、序列化/反序列化、克隆。", kids: [
      { id: "tree-construct", name: "由遍历序列重建", desc: "前序定根、中序分左右，递归还原。" },
      { id: "tree-serialize", name: "序列化与反序列化", desc: "按遍历顺序编码，空节点也要占位。" },
    ] },
    { id: "tree-path", name: "路径与最近公共祖先", desc: "路径和、直径、LCA、倍增。", kids: [
      { id: "tree-lca", name: "最近公共祖先", desc: "递归回溯找分叉点，多次查询用倍增。" },
    ] },
  ] },
  { id: "search", name: "搜索与回溯", desc: "在状态空间里穷举：怎么走、怎么剪、怎么记忆化。", subs: [
    { id: "backtracking", name: "回溯", desc: "子集、排列、组合、棋盘类，模板是「选择-递归-撤销」。", kids: [
      { id: "pruning", name: "剪枝", desc: "提前判死路，回溯题的性能全在这。" },
    ] },
    { id: "dfs-basic", name: "深度优先搜索", desc: "一条路走到黑再回头，树、图、网格上的通用遍历骨架。" },
    { id: "flood-fill", name: "网格搜索", desc: "岛屿、区域填充、多源扩散，DFS/BFS 都能写。" },
    { id: "bfs-shortest", name: "BFS 最短步数", desc: "无权图最短路、状态压缩成节点做 BFS。" },
    { id: "memo-search", name: "记忆化搜索", desc: "自顶向下的 DP，先写暴力递归再加缓存。" },
    { id: "search-advanced", name: "双向与启发式搜索", desc: "双向 BFS、A*、中途相遇。", kids: [
      { id: "bidirectional", name: "双向搜索", desc: "两头同时扩，指数级搜索空间开平方。" },
      { id: "astar", name: "A* / 启发式", desc: "用估价函数决定先扩谁。" },
    ] },
  ] },
  { id: "dp", name: "动态规划", desc: "定义状态 → 写转移 → 定边界。题量最大、区分度最高的一类。", subs: [
    { id: "dp-linear", name: "线性 DP", desc: "爬楼梯、打家劫舍这类一维递推，入门首选。", kids: [
      { id: "dp-1d", name: "一维递推", desc: "dp[i] 只依赖前面若干项，多数能滚动成 O(1) 空间。" },
      { id: "dp-2d", name: "二维状态转移", desc: "dp[i][j] 描述两维状态，遍历顺序决定正确性。" },
    ] },
    { id: "dp-sequence", name: "序列 DP", desc: "LIS、LCS、编辑距离，两个序列或子序列上的 DP。", kids: [
      { id: "dp-lis", name: "最长上升子序列", desc: "贪心加二分把 O(n²) 压到 O(n log n)。" },
      { id: "dp-lcs", name: "LCS 与编辑距离", desc: "两个序列对齐，二维状态一格格推。" },
    ] },
    { id: "dp-knapsack", name: "背包 DP", desc: "01 背包、完全背包、多重背包，凑数与选择问题的统一模型。", kids: [
      { id: "dp-knapsack-01", name: "01 背包", desc: "每件最多选一次，容量维必须倒序遍历。" },
      { id: "dp-knapsack-full", name: "完全背包", desc: "每件可选无限次，容量维正序遍历。" },
    ] },
    { id: "dp-grid", name: "网格 DP", desc: "路径数、最小路径和、二维矩阵上的递推。" },
    { id: "dp-interval", name: "区间 DP", desc: "在区间上合并，戳气球、石子合并、回文划分。" },
    { id: "dp-tree", name: "树形 DP", desc: "在树上做 DP，选或不选当前节点、换根。" },
    { id: "dp-bitmask", name: "状压 DP", desc: "用二进制表示集合状态，处理小规模全排列/覆盖问题。" },
    { id: "dp-machine", name: "状态机 DP", desc: "股票买卖系列，按持股/冷冻期等状态转移。" },
    { id: "dp-digit", name: "数位 DP", desc: "按数位逐位统计满足条件的数，配合记忆化。" },
  ] },
  { id: "graph", name: "图论", desc: "建图往往比算法难：先想清楚点是什么、边是什么。", subs: [
    { id: "graph-basic", name: "建图与遍历", desc: "邻接表、连通分量、DFS/BFS 在一般图上的应用。" },
    { id: "topo", name: "拓扑排序", desc: "有向无环图的依赖排序、课程表模型、判环。" },
    { id: "shortest-path", name: "最短路", desc: "Dijkstra、Bellman-Ford、Floyd、0-1 BFS。", kids: [
      { id: "graph-dijkstra", name: "Dijkstra", desc: "非负权单源最短路，堆优化到 O(m log n)。" },
      { id: "graph-bellman", name: "Bellman-Ford / SPFA", desc: "能处理负权，也是差分约束的解法。" },
      { id: "graph-floyd", name: "Floyd 多源最短路", desc: "三重循环，顺带能求传递闭包。" },
    ] },
    { id: "union-find", name: "并查集", desc: "连通性合并、带权并查集、按秩合并与路径压缩。" },
    { id: "graph-advanced", name: "进阶图论", desc: "最小生成树、二分图匹配、强连通分量、网络流。", kids: [
      { id: "graph-mst", name: "最小生成树", desc: "Kruskal 排边加并查集，或 Prim 从点扩。" },
      { id: "graph-bipartite", name: "二分图与匹配", desc: "染色判二分图，匈牙利求最大匹配。" },
      { id: "graph-scc", name: "Tarjan 与连通性", desc: "强连通分量、割点、桥，一套 dfn/low。" },
      { id: "graph-euler", name: "欧拉路径", desc: "度数判存在性，Hierholzer 求路径。" },
      { id: "graph-flow", name: "网络流", desc: "最大流最小割，费用流跑最小费用。" },
    ] },
  ] },
  { id: "greedy", name: "贪心与构造", desc: "证明比写代码难：要说服自己局部最优能推出全局最优。", subs: [
    { id: "greedy-basic", name: "贪心策略", desc: "每步取当前最优，常配合排序或哈希。", kids: [
      { id: "exchange-argument", name: "交换论证与反悔贪心", desc: "用交换证明局部最优，反悔用堆撤销。" },
    ] },
    { id: "greedy-interval", name: "区间贪心", desc: "按右端点排序选不重叠区间、最少箭数、会议安排。" },
    { id: "greedy-heap", name: "堆贪心与调度", desc: "用优先队列动态维护当前最优选择，任务调度类。" },
    { id: "construct", name: "构造与思维题", desc: "摩尔投票、抽屉原理、找规律，代码短但需要洞察。" },
  ] },
  { id: "math", name: "数学", desc: "数论、组合、几何、概率与博弈，公式想明白代码就几行。", subs: [
    { id: "number-theory", name: "数论", desc: "GCD/LCM、质因数分解、筛法、快速幂与同余。", kids: [
      { id: "math-fermat", name: "费马小定理与逆元", desc: "模质数下用快速幂求逆元。" },
      { id: "math-euler-phi", name: "欧拉函数", desc: "积性函数，配合欧拉定理降幂。" },
      { id: "math-sieve", name: "质数与筛法", desc: "埃氏筛 / 线性筛预处理素数与最小质因子。" },
      { id: "math-fast-pow", name: "快速幂", desc: "二进制拆指数，O(log n) 求幂，也能推广到矩阵幂。" },
      { id: "math-mod", name: "同余与取模", desc: "边算边取模防溢出，除法要用逆元。" },
      { id: "math-gcd", name: "GCD 与裴蜀定理", desc: "辗转相除，以及 ax+by=gcd 的可解性判定。" },
      { id: "math-base", name: "进制与数位", desc: "按位取余拆数字、进制转换、数位处理。" },
    ] },
    { id: "combinatorics", name: "组合数学", desc: "排列组合计数、容斥、卡特兰数。", kids: [
      { id: "math-inclusion", name: "容斥原理", desc: "加加减减去重，配合位运算枚举子集。" },
      { id: "math-catalan", name: "卡特兰数", desc: "出栈序列、括号匹配、二叉树计数的同一个数列。" },
    ] },
    { id: "geometry", name: "计算几何", desc: "点线关系、面积、凸包、最近点对。" },
    { id: "probability", name: "概率与随机化", desc: "期望计算、随机采样、水塘抽样、拒绝采样。" },
    { id: "game-theory", name: "博弈论", desc: "必胜态判定、极小化极大、Nim 与 SG 函数。" },
  ] },
  { id: "advanced-ds", name: "高级数据结构", desc: "竞赛味更重的一层，面试出现少但能拉开上限。", subs: [
    { id: "segment-tree", name: "线段树与区间查询", desc: "区间求和/最值、懒标记、动态开点、Sparse Table、分块。" },
    { id: "fenwick", name: "树状数组", desc: "单点修改区间查询，配合离散化求逆序对。" },
    { id: "balanced-tree", name: "平衡树与可持久化", desc: "Treap/Splay、笛卡尔树、可持久化结构、K-D 树。" },
    { id: "suffix", name: "后缀结构", desc: "后缀数组、后缀自动机、回文树。" },
  ] },
  { id: "design", name: "设计与工程", desc: "偏工程的一类：接口怎么定、复杂度怎么摊、并发怎么控。", subs: [
    { id: "ds-design", name: "数据结构设计", desc: "LRU/LFU、跳表、时间映射，组合已有结构达到目标复杂度。" },
    { id: "data-stream", name: "数据流", desc: "在线处理无限输入，中位数、滑动平均、Top-K。" },
    { id: "iterator", name: "迭代器与惰性求值", desc: "展开嵌套结构、按需产出下一个元素。" },
    { id: "concurrency", name: "多线程", desc: "锁、信号量、条件变量，按顺序打印类题目。" },
    { id: "db-shell", name: "数据库与 Shell", desc: "SQL 查询与文本处理，独立于算法的一条支线。" },
  ] },
];

export const CAT_ORDER: string[] = ["basics", "array", "ds-basic", "string", "binary-search", "tree", "search", "dp", "graph", "greedy", "math", "advanced-ds", "design"];

/** 原始标签 slug -> [子标签, 权重] */
export const TAG_MAP: Record<string, [string, number]> = {
  "simulation": ["simulation", 30],
  "brute-force-search": ["enumeration", 35],
  "array": ["simulation", 16],
  "enumeration": ["enumeration", 28],
  "matrix": ["matrix", 33],
  "bit-manipulation": ["bit", 42],
  "bitmask": ["bit", 44],
  "sorting": ["sorting", 24],
  "sort": ["sorting", 24],
  "counting-sort": ["sorting", 52],
  "bucket-sort": ["sorting", 52],
  "radix-sort": ["sorting", 52],
  "bubble-sort": ["sorting", 52],
  "tournament-sort": ["sorting", 52],
  "timsort": ["sorting", 52],
  "two-pointers": ["two-pointers", 52],
  "floyds-cycle-finding-algorithm": ["two-pointers", 66],
  "sliding-window": ["sliding-window", 72],
  "prefix-sum": ["prefix-sum", 56],
  "sweep-line": ["interval", 84],
  "hash-table": ["hash-count", 26],
  "counting": ["hash-count", 28],
  "hash-function": ["hash-count", 46],
  "stack": ["stack-queue", 46],
  "queue": ["stack-queue", 46],
  "bracket-sequences": ["stack-queue", 64],
  "monotonic-stack": ["monotonic", 86],
  "monotonic-queue": ["monotonic", 86],
  "linked-list": ["linked-list", 62],
  "doubly-linked-list": ["linked-list", 66],
  "heap-priority-queue": ["heap", 60],
  "ordered-set": ["ordered-set", 56],
  "string": ["string-basic", 20],
  "manacher": ["palindrome", 90],
  "palindromic-tree": ["palindrome", 90],
  "string-matching": ["string-match", 76],
  "rolling-hash": ["string-match", 76],
  "knuth-morris-pratt-algorithm": ["string-match", 90],
  "z-algorithm": ["string-match", 90],
  "boyer-moore-string-search-algorithm": ["string-match", 90],
  "aho-corasick-algorithm": ["string-match", 90],
  "lexicographically-minimal-string-rotation": ["string-match", 88],
  "lyndon-factorization": ["string-match", 88],
  "trie": ["trie", 80],
  "binary-search": ["bs-array", 46],
  "ternary-search": ["bs-array", 60],
  "divide-and-conquer": ["divide-conquer", 60],
  "merge-sort": ["divide-conquer", 66],
  "quickselect": ["quickselect", 82],
  "quicksort": ["quickselect", 62],
  "tree": ["tree-traversal", 36],
  "binary-tree": ["tree-traversal", 46],
  "binary-search-tree": ["bst", 70],
  "lowest-common-ancestor": ["tree-path", 86],
  "binary-lifting": ["tree-path", 84],
  "backtracking": ["backtracking", 76],
  "algorithm-x": ["backtracking", 86],
  "dancing-links": ["backtracking", 86],
  "depth-first-search": ["dfs-basic", 40],
  "breadth-first-search": ["bfs-shortest", 40],
  "memoization": ["memo-search", 66],
  "recursion": ["memo-search", 32],
  "bidirectional-search": ["search-advanced", 84],
  "a-search": ["search-advanced", 86],
  "heuristic-search": ["search-advanced", 84],
  "meet-in-the-middle": ["search-advanced", 84],
  "dynamic-programming": ["dp-linear", 55],
  "longest-increasing-subsequence": ["dp-sequence", 90],
  "longest-common-subsequence": ["dp-sequence", 90],
  "knapsack-problem": ["dp-knapsack", 90],
  "0-1-knapsack": ["dp-knapsack", 92],
  "complete-knapsack": ["dp-knapsack", 92],
  "multiple-knapsack": ["dp-knapsack", 92],
  "mixed-knapsack": ["dp-knapsack", 92],
  "dp-on-trees": ["dp-tree", 95],
  "graph": ["graph-basic", 42],
  "directed-acyclic-graph": ["graph-basic", 60],
  "graph-coloring": ["graph-basic", 62],
  "planar-graph": ["graph-basic", 70],
  "topological-sort": ["topo", 86],
  "shortest-path": ["shortest-path", 86],
  "dijkstra": ["shortest-path", 92],
  "bellman-ford-algorithm": ["shortest-path", 92],
  "floyd-warshall-algorithm": ["shortest-path", 92],
  "0-1-bfs": ["shortest-path", 88],
  "k-shortest-path": ["shortest-path", 92],
  "successive-shortest-path-algorithm": ["graph-advanced", 90],
  "union-find": ["union-find", 78],
  "minimum-spanning-tree": ["graph-advanced", 90],
  "kruskals-algorithm": ["graph-advanced", 90],
  "prims-algorithm": ["graph-advanced", 90],
  "boruvkas-algorithm": ["graph-advanced", 90],
  "bipartite-graph": ["graph-advanced", 86],
  "matching-graph": ["graph-advanced", 86],
  "maximum-matching": ["graph-advanced", 88],
  "perfect-matching": ["graph-advanced", 88],
  "hungarian-algorithm": ["graph-advanced", 90],
  "flow-network": ["graph-advanced", 90],
  "maximum-flow": ["graph-advanced", 90],
  "minimum-cut": ["graph-advanced", 90],
  "minimum-cost-flow": ["graph-advanced", 90],
  "dinics-algorithm": ["graph-advanced", 92],
  "edmonds-karp-algorithm": ["graph-advanced", 92],
  "mpm-algorithm": ["graph-advanced", 92],
  "push-relabel-algorithm": ["graph-advanced", 92],
  "strongly-connected-component": ["graph-advanced", 88],
  "tarjans-scc-algorithm": ["graph-advanced", 90],
  "kosarajus-algorithm": ["graph-advanced", 90],
  "biconnected-component": ["graph-advanced", 88],
  "articulation-point": ["graph-advanced", 88],
  "bridge-graph": ["graph-advanced", 88],
  "eulerian-path": ["graph-advanced", 88],
  "eulerian-circuit": ["graph-advanced", 88],
  "eulerian-graph": ["graph-advanced", 88],
  "semi-eulerian-graph": ["graph-advanced", 88],
  "hamiltonian-path": ["graph-advanced", 88],
  "greedy": ["greedy-basic", 46],
  "brainteaser": ["construct", 62],
  "pigeonhole-principle": ["construct", 72],
  "boyer-moore-majority-vote-algorithm": ["construct", 76],
  "math": ["number-theory", 18],
  "number-theory": ["number-theory", 62],
  "greatest-common-divisor": ["number-theory", 70],
  "euclidean-algorithm": ["number-theory", 72],
  "extended-euclidean-algorithm": ["number-theory", 76],
  "least-common-multiple": ["number-theory", 70],
  "prime-factorization": ["number-theory", 72],
  "primality-test": ["number-theory", 72],
  "sieve-theory": ["number-theory", 76],
  "prime-number-sieve": ["number-theory", 76],
  "fermats-little-theorem": ["number-theory", 76],
  "eulers-totient-function": ["number-theory", 78],
  "eulers-theorem": ["number-theory", 78],
  "bezouts-lemma": ["number-theory", 78],
  "newtons-method": ["number-theory", 70],
  "linear-algebra": ["number-theory", 70],
  "combinatorics": ["combinatorics", 66],
  "inclusion-exclusion-principle": ["combinatorics", 76],
  "geometry": ["geometry", 66],
  "polygons": ["geometry", 72],
  "convex-hull": ["geometry", 82],
  "nearest-pair-of-points": ["geometry", 82],
  "triangulation": ["geometry", 82],
  "minimum-enclosing-circle": ["geometry", 82],
  "probability-and-statistics": ["probability", 70],
  "randomized": ["probability", 70],
  "reservoir-sampling": ["probability", 86],
  "rejection-sampling": ["probability", 86],
  "game-theory": ["game-theory", 80],
  "minimax-algorithm": ["game-theory", 80],
  "zero-sum-game": ["game-theory", 80],
  "impartial-game": ["game-theory", 84],
  "nim-game": ["game-theory", 88],
  "sprague-grundy-theorem": ["game-theory", 88],
  "segment-tree": ["segment-tree", 88],
  "li-chao-tree": ["segment-tree", 92],
  "range-minimum-maximum-query": ["segment-tree", 84],
  "sparse-table": ["segment-tree", 86],
  "sqrt-decomposition": ["segment-tree", 86],
  "binary-indexed-tree": ["fenwick", 90],
  "treap": ["balanced-tree", 84],
  "splay-tree": ["balanced-tree", 84],
  "cartesian-tree": ["balanced-tree", 80],
  "k-d-tree": ["balanced-tree", 86],
  "persistent-data-structure": ["balanced-tree", 90],
  "suffix-array": ["suffix", 88],
  "suffix-tree": ["suffix", 88],
  "suffix-automaton": ["suffix", 88],
  "design": ["ds-design", 60],
  "interactive": ["ds-design", 66],
  "data-stream": ["data-stream", 72],
  "iterator": ["iterator", 72],
  "concurrency": ["concurrency", 96],
  "database": ["db-shell", 98],
  "shell": ["db-shell", 98],
};

export const RULES: Rule[] = [
  { sub: "dp-bitmask", weight: 96, allTags: ["dynamic-programming", "bitmask"], why: "动态规划+位掩码" },
  { sub: "dp-tree", weight: 94, allTags: ["dynamic-programming"], anyTags: ["tree", "binary-tree"], why: "动态规划+树" },
  { sub: "dp-grid", weight: 86, allTags: ["dynamic-programming", "matrix"], why: "动态规划+矩阵" },
  { sub: "dp-grid", weight: 84, allTags: ["dynamic-programming"], title: "路径|网格|方格|棋盘|三角形", why: "标题含网格路径" },
  { sub: "dp-machine", weight: 92, allTags: ["dynamic-programming"], title: "股票|买卖", why: "标题含股票买卖" },
  { sub: "dp-knapsack", weight: 88, allTags: ["dynamic-programming"], title: "背包|零钱|硬币|目标和|等和子集|分割等和|组合总和 Ⅳ|完全平方数", why: "标题含背包型关键词" },
  { sub: "dp-sequence", weight: 88, allTags: ["dynamic-programming"], title: "子序列|编辑距离|公共前缀|公共子串|通配符|正则|交错字符串|不同的子序列", why: "标题含序列型关键词" },
  { sub: "dp-interval", weight: 88, allTags: ["dynamic-programming"], title: "戳气球|石子|石头|合并.*区间|区间|括号|移除盒子|奇怪的打印机|扎气球", why: "标题含区间合并型关键词" },
  { sub: "dp-linear", weight: 88, allTags: ["dynamic-programming"], title: "拆分|方案数|多少种|不同的方法|种方法|计数", why: "标题含方案计数" },
  { sub: "dp-digit", weight: 90, allTags: ["dynamic-programming"], title: "数位|至少有 1 位重复|不含连续|范围内.*整数", why: "标题含数位统计" },
  { sub: "dp-digit", weight: 88, anyTags: ["dynamic-programming"], title: "统计.*(整数|数字).*(数目|个数)", why: "标题含数位统计" },
  { sub: "dp-sequence", weight: 86, anyTags: ["dynamic-programming"], title: "最长(递增|上升|连续递增)", why: "标题含最长递增子序列" },
  { sub: "bs-answer", weight: 82, allTags: ["binary-search"], title: "最小(化)?.{0,8}最大|最大(化)?.{0,8}最小|最小的?最大值|最大的?最小值", why: "二分+最值语义" },
  { sub: "bs-array", weight: 66, allTags: ["binary-search", "divide-and-conquer"], why: "二分+分治" },
  { sub: "bfs-shortest", weight: 84, anyTags: ["breadth-first-search"], title: "最短|最少步|最少次数|最少操作|最小步|最少的?步数", why: "BFS+最短语义" },
  { sub: "flood-fill", weight: 80, allTags: ["matrix"], anyTags: ["depth-first-search", "breadth-first-search"], why: "搜索+矩阵" },
  { sub: "flood-fill", weight: 78, anyTags: ["depth-first-search", "breadth-first-search"], title: "岛屿|区域|感染|腐烂|填充|迷宫|矩阵", why: "标题含网格扩散" },
  { sub: "graph-basic", weight: 62, allTags: ["graph"], anyTags: ["depth-first-search", "breadth-first-search"], why: "搜索+图" },
  { sub: "tree-traversal", weight: 62, allTags: ["binary-tree"], anyTags: ["depth-first-search", "breadth-first-search"], why: "搜索+二叉树" },
  { sub: "tree-traversal", weight: 58, allTags: ["tree"], anyTags: ["depth-first-search", "breadth-first-search"], why: "搜索+树" },
  { sub: "tree-build", weight: 74, anyTags: ["tree", "binary-tree"], title: "构造|还原|序列化|反序列化|克隆|复制|恢复", why: "树+构造语义" },
  { sub: "tree-path", weight: 74, anyTags: ["tree", "binary-tree"], title: "路径|祖先|直径|距离|深度和", why: "树+路径语义" },
  { sub: "bst", weight: 72, anyTags: ["tree", "binary-tree"], title: "搜索树|BST|有序", why: "树+有序语义" },
  { sub: "greedy-heap", weight: 80, allTags: ["greedy", "heap-priority-queue"], why: "贪心+堆" },
  { sub: "greedy-interval", weight: 78, allTags: ["greedy"], title: "区间|会议|日程|重叠|气球|覆盖|排程|安排", why: "贪心+区间语义" },
  { sub: "interval", weight: 74, anyTags: ["array", "sorting"], title: "区间|会议|日程|重叠|覆盖", why: "标题含区间" },
  { sub: "prefix-sum", weight: 70, anyTags: ["array"], title: "前缀和|区间和|子数组和|差分", why: "标题含前缀和" },
  { sub: "sliding-window", weight: 76, anyTags: ["string", "array"], title: "最长(子串|子数组)|最短(子串|子数组)|窗口|连续子数组|连续子串|定长|长度为 ?[Kk]", why: "标题含定/变长窗口" },
  { sub: "palindrome", weight: 74, anyTags: ["string", "dynamic-programming"], title: "回文", why: "标题含回文" },
  { sub: "linked-list", weight: 70, anyTags: ["linked-list"], title: "链表|环|节点", why: "链表语义" },
  { sub: "ds-design", weight: 74, anyTags: ["design"], title: "设计|实现.*(类|结构)|缓存|LRU|LFU|跳表|迭代器", why: "设计类题面" },
  { sub: "memo-search", weight: 70, allTags: ["memoization"], why: "官方标注记忆化" },
  { sub: "game-theory", weight: 82, anyTags: ["dynamic-programming", "math"], title: "博弈|石子游戏|取石子|猜数字|必胜|Nim|翻硬币|谁先", why: "标题含博弈" },
  { sub: "bit", weight: 60, anyTags: ["bit-manipulation"], title: "异或|位|二进制|汉明", why: "标题含位运算" },
];

export const FALLBACK_SUB = "simulation";
export const KEEP_THRESHOLD = 24;
export const MAX_TAGS = 8;

/** 更具体的标签出现时，压掉泛化标签。 */
export const SUPPRESS: Record<string, string[]> = {"dfs-basic": ["flood-fill", "graph-basic", "tree-traversal", "backtracking", "memo-search", "dp-tree"], "bfs-shortest": ["flood-fill", "topo", "tree-traversal"]};

/** 主标签校正：规则算出来不合适时手工钉一下。 */
export const MAIN_TAG_PINS: Record<string, string> = {"410": "bs-answer", "875": "bs-answer", "1011": "bs-answer", "1482": "bs-answer", "1552": "bs-answer", "1760": "bs-answer", "2064": "bs-answer", "2226": "bs-answer", "1231": "bs-answer", "2517": "bs-answer", "1283": "bs-answer", "1898": "bs-answer", "668": "bs-answer", "719": "bs-answer", "378": "bs-answer", "774": "bs-answer", "233": "dp-digit", "357": "dp-digit", "600": "dp-digit", "902": "dp-digit", "1012": "dp-digit", "2376": "dp-digit", "2719": "dp-digit", "1000": "dp-interval", "1547": "dp-interval", "664": "dp-interval", "546": "dp-interval", "309": "dp-machine", "714": "dp-machine", "139": "dp-linear", "4": "bs-array", "218": "interval", "315": "fenwick", "42": "monotonic", "460": "ds-design", "146": "ds-design"};

/** 一题多解的补充：某个解法成立时，另一种常见解法通常也成立。 */
export const ALT_APPROACHES: Record<string, [string, number][]> = {
  "quickselect": [["heap", 58], ["sorting", 40]],
  "monotonic": [["stack-queue", 44]],
  "memo-search": [["dp-linear", 50]],
  "dp-knapsack": [["memo-search", 46]],
  "dp-tree": [["tree-traversal", 46]],
  "bs-answer": [["bs-array", 44]],
  "flood-fill": [["bfs-shortest", 44]],
  "topo": [["graph-basic", 46]],
  "shortest-path": [["graph-basic", 44], ["heap", 42]],
  "union-find": [["graph-basic", 42]],
  "trie": [["hash-count", 40]],
};
