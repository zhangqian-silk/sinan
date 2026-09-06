/**
 * 解法思路词表：96 种思路的识别正则与区分度权重。
 *
 * 由 scripts/gen_rules.py 从原 Python 规则表搬运而来，正则源码原样保留，
 * 语义翻译交给 pyre.py()。改规则请改这里。
 */


export interface ApproachDef {
  id: string;
  name: string;
  domain: string;
  pattern: string;
  /** 区分度：3.0 认准了就是这一类；2.0 明确套路；1.0 泛化说法，只能当辅助 */
  weight: number;
}

export const APPROACHES: ApproachDef[] = [
  { id: "tree-preorder", name: "前序遍历", domain: "tree", weight: 2.0, pattern: "前序|preorder" },
  { id: "tree-inorder", name: "中序遍历", domain: "tree", weight: 2.0, pattern: "中序|inorder" },
  { id: "tree-postorder", name: "后序遍历", domain: "tree", weight: 2.0, pattern: "后序|postorder" },
  { id: "tree-levelorder", name: "层序遍历", domain: "tree", weight: 2.0, pattern: "层序|层次遍历|levelorder|按层|逐层" },
  { id: "tree-morris", name: "Morris 遍历", domain: "tree", weight: 3.0, pattern: "morris|线索二叉树" },
  { id: "tree-iterative", name: "迭代 + 显式栈", domain: "tree", weight: 1.5, pattern: "迭代|iterativ|显式栈|用栈模拟|颜色标记" },
  { id: "tree-recursion", name: "递归", domain: "tree", weight: 1.0, pattern: "递归|recursi|dfs 递归" },
  { id: "tree-lca", name: "最近公共祖先", domain: "tree", weight: 2.5, pattern: "最近公共祖先|公共祖先|\\blca\\b" },
  { id: "tree-serialize", name: "序列化/反序列化", domain: "tree", weight: 2.5, pattern: "序列化|反序列化|serial" },
  { id: "tree-construct", name: "由遍历序列重建", domain: "tree", weight: 2.5, pattern: "重建|还原|由.{0,8}构造|构造二叉树" },
  { id: "bst-inorder", name: "BST 中序有序性", domain: "tree", weight: 2.0, pattern: "搜索树|\\bbst\\b|中序有序" },
  { id: "graph-dfs", name: "DFS 深搜", domain: "graph", weight: 1.5, pattern: "\\bdfs\\b|深度优先|深搜|洪水填充|flood.?fill|沉岛|染色" },
  { id: "graph-bfs", name: "BFS 广搜", domain: "graph", weight: 1.5, pattern: "\\bbfs\\b|广度优先|广搜|多源扩散|逐层扩散" },
  { id: "graph-union-find", name: "并查集", domain: "graph", weight: 2.5, pattern: "并查集|union.?find|\\bdsu\\b" },
  { id: "graph-topo", name: "拓扑排序", domain: "graph", weight: 2.5, pattern: "拓扑|topolog|入度|kahn" },
  { id: "graph-dijkstra", name: "Dijkstra", domain: "graph", weight: 3.0, pattern: "dijkstra|迪杰斯特拉|堆优化最短路" },
  { id: "graph-bellman", name: "Bellman-Ford / SPFA", domain: "graph", weight: 3.0, pattern: "bellman|spfa" },
  { id: "graph-floyd", name: "Floyd 多源最短路", domain: "graph", weight: 3.0, pattern: "floyd.?warshall|弗洛伊德|多源最短路" },
  { id: "graph-mst", name: "最小生成树", domain: "graph", weight: 3.0, pattern: "最小生成树|kruskal|\\bprim\\b" },
  { id: "graph-bipartite", name: "二分图判定/匹配", domain: "graph", weight: 3.0, pattern: "二分图|染色法|匈牙利|最大匹配" },
  { id: "graph-scc", name: "Tarjan 连通性", domain: "graph", weight: 3.0, pattern: "tarjan|强连通|(?<!分)割点|割边|关键连接|桥\\s*(边|梁结构)?(?=\\s|$|、|，)" },
  { id: "graph-euler", name: "欧拉路径", domain: "graph", weight: 3.0, pattern: "欧拉(回路|路径|图)|hierholzer" },
  { id: "graph-flow", name: "网络流", domain: "graph", weight: 3.0, pattern: "网络流|最大流|最小割|dinic" },
  { id: "dp-memo", name: "记忆化搜索", domain: "dp", weight: 2.0, pattern: "记忆化|\\bmemo|递归\\s*\\+\\s*缓存|自顶向下" },
  { id: "dp-1d", name: "一维线性递推", domain: "dp", weight: 1.5, pattern: "一维|滚动数组|线性\\s?dp|递推公式|滚动优化" },
  { id: "dp-2d", name: "二维状态转移", domain: "dp", weight: 1.5, pattern: "二维\\s?dp|二维数组|dp\\[i\\]\\[j\\]|双序列" },
  { id: "dp-knapsack-01", name: "01 背包", domain: "dp", weight: 3.0, pattern: "0-?1\\s?背包|01背包" },
  { id: "dp-knapsack-full", name: "完全背包", domain: "dp", weight: 3.0, pattern: "完全背包|多重背包" },
  { id: "dp-knapsack", name: "背包模型", domain: "dp", weight: 2.0, pattern: "背包" },
  { id: "dp-interval", name: "区间 DP", domain: "dp", weight: 3.0, pattern: "区间\\s?dp|区间动态规划|石子合并|环形区间" },
  { id: "dp-tree", name: "树形 DP", domain: "dp", weight: 3.0, pattern: "树形\\s?dp|树上\\s?dp|换根" },
  { id: "dp-bitmask", name: "状压 DP", domain: "dp", weight: 3.0, pattern: "状压|状态压缩|bitmask" },
  { id: "dp-digit", name: "数位 DP", domain: "dp", weight: 3.0, pattern: "数位\\s?dp|按位统计" },
  { id: "dp-lis", name: "LIS（贪心+二分）", domain: "dp", weight: 2.5, pattern: "\\blis\\b|最长上升|最长递增|贪心\\s*\\+\\s*二分" },
  { id: "dp-lcs", name: "LCS / 编辑距离", domain: "dp", weight: 2.5, pattern: "\\blcs\\b|最长公共子序列|编辑距离|最短编辑" },
  { id: "dp-machine", name: "状态机 DP", domain: "dp", weight: 2.5, pattern: "状态机|持股|买卖股票|冷冻期" },
  { id: "dp-prob", name: "概率期望 DP", domain: "dp", weight: 3.0, pattern: "期望\\s?dp|概率\\s?dp|数学期望" },
  { id: "dp-opt", name: "单调队列/斜率优化", domain: "dp", weight: 3.0, pattern: "斜率优化|单调队列优化|决策单调|四边形不等式" },
  { id: "math-sieve", name: "质数筛（埃氏/线性）", domain: "math", weight: 3.0, pattern: "埃氏筛|埃拉托斯特尼|线性筛|欧拉筛|质数筛|素数筛" },
  { id: "math-fast-pow", name: "快速幂", domain: "math", weight: 3.0, pattern: "快速幂|矩阵快速幂|二进制取幂" },
  { id: "math-fermat", name: "费马小定理/逆元", domain: "math", weight: 3.0, pattern: "费马小定理|乘法逆元|逆元" },
  { id: "math-euler-phi", name: "欧拉函数/欧拉定理", domain: "math", weight: 3.0, pattern: "欧拉函数|欧拉定理" },
  { id: "math-gcd", name: "GCD / 裴蜀定理", domain: "math", weight: 2.5, pattern: "最大公约数|辗转相除|裴蜀|欧几里得|\\bgcd\\b" },
  { id: "math-inclusion", name: "容斥原理", domain: "math", weight: 3.0, pattern: "容斥" },
  { id: "math-catalan", name: "卡特兰数", domain: "math", weight: 3.0, pattern: "卡特兰|catalan" },
  { id: "math-combi", name: "组合计数", domain: "math", weight: 2.5, pattern: "组合数|排列数|杨辉三角|二项式|阶乘" },
  { id: "math-moore", name: "摩尔投票", domain: "math", weight: 3.0, pattern: "摩尔投票|boyer.?moore|投票法" },
  { id: "math-xor", name: "异或性质", domain: "math", weight: 2.0, pattern: "异或|\\bxor\\b|lowbit|位运算性质" },
  { id: "math-base", name: "进制/数位拆解", domain: "math", weight: 2.0, pattern: "进制|数位拆|十进制|各位数字" },
  { id: "math-geometry", name: "几何公式", domain: "math", weight: 2.5, pattern: "几何|向量|叉积|凸包|海伦|三角形面积" },
  { id: "math-game", name: "博弈/SG 函数", domain: "math", weight: 3.0, pattern: "\\bsg\\s?函数|博弈|必胜态|\\bnim\\b" },
  { id: "math-mod", name: "同余与取模", domain: "math", weight: 2.0, pattern: "同余|取模技巧|模运算" },
  { id: "math-formula", name: "公式推导/找规律", domain: "math", weight: 0.8, pattern: "数学推导|找规律|公式|规律|数学法" },
  { id: "monotonic-stack", name: "单调栈", domain: "ds", weight: 3.0, pattern: "单调栈" },
  { id: "monotonic-queue", name: "单调队列", domain: "ds", weight: 3.0, pattern: "单调队列" },
  { id: "sliding-window", name: "滑动窗口", domain: "ds", weight: 2.5, pattern: "滑动窗口|滑窗|不定长窗口|定长窗口" },
  { id: "two-pointers", name: "双指针", domain: "ds", weight: 2.0, pattern: "双指针|对撞指针|左右指针|同向指针" },
  { id: "fast-slow", name: "快慢指针", domain: "ds", weight: 3.0, pattern: "快慢指针|判圈|floyd 判圈|龟兔" },
  { id: "prefix-sum", name: "前缀和", domain: "ds", weight: 2.5, pattern: "前缀和|后缀和|前缀积" },
  { id: "diff-array", name: "差分数组", domain: "ds", weight: 3.0, pattern: "差分" },
  { id: "binary-search", name: "二分查找", domain: "ds", weight: 2.0, pattern: "二分查找|二分法|二分搜索|折半" },
  { id: "binary-search-answer", name: "二分答案", domain: "ds", weight: 3.0, pattern: "二分答案|最小化最大|最大化最小|二分\\s*\\+\\s*(判定|check|贪心|验证)" },
  { id: "heap", name: "堆 / 优先队列", domain: "ds", weight: 2.0, pattern: "优先队列|priority.?queue|小根堆|大根堆|\\bheap\\b|top.?k" },
  { id: "quickselect", name: "快速选择", domain: "ds", weight: 3.0, pattern: "快速选择|quickselect|快排划分|partition" },
  { id: "merge-sort", name: "归并", domain: "ds", weight: 2.5, pattern: "归并" },
  { id: "hash", name: "哈希表", domain: "ds", weight: 1.0, pattern: "哈希(?!函数)|\\bhash\\b|字典(?!树)" },
  { id: "sort-then", name: "排序后处理", domain: "ds", weight: 1.0, pattern: "(?<!拓扑)(?<!快速)(?<!归并)(?<!计数)(?<!基数)(?<!桶)排序" },
  { id: "stack-sim", name: "栈模拟", domain: "ds", weight: 2.0, pattern: "用栈|栈模拟|括号匹配|表达式求值|逆波兰" },
  { id: "deque", name: "双端队列", domain: "ds", weight: 2.0, pattern: "双端队列|\\bdeque\\b" },
  { id: "trie", name: "字典树", domain: "ds", weight: 3.0, pattern: "字典树|\\btrie\\b|前缀树" },
  { id: "segment-tree", name: "线段树", domain: "ds", weight: 3.0, pattern: "线段树|zkw" },
  { id: "fenwick", name: "树状数组", domain: "ds", weight: 3.0, pattern: "树状数组|fenwick" },
  { id: "ordered-set", name: "有序集合", domain: "ds", weight: 2.5, pattern: "treemap|sortedlist|有序集合|multiset|平衡树" },
  { id: "block", name: "分块 / 莫队", domain: "ds", weight: 3.0, pattern: "分块|莫队" },
  { id: "list-reverse", name: "链表反转", domain: "list", weight: 2.5, pattern: "反转链表|翻转链表|头插法" },
  { id: "list-dummy", name: "虚拟头节点", domain: "list", weight: 2.0, pattern: "哨兵|虚拟头|dummy" },
  { id: "list-merge", name: "链表归并", domain: "list", weight: 2.5, pattern: "合并.*链表|链表.*合并" },
  { id: "backtracking", name: "回溯", domain: "search", weight: 2.0, pattern: "回溯|backtrack|全排列|组合枚举" },
  { id: "pruning", name: "剪枝", domain: "search", weight: 2.0, pattern: "剪枝|prune" },
  { id: "bidirectional", name: "双向搜索", domain: "search", weight: 3.0, pattern: "双向\\s?bfs|双向搜索|meet.?in.?the.?middle|中途相遇" },
  { id: "astar", name: "A* / 启发式", domain: "search", weight: 3.0, pattern: "\\ba\\*|启发式搜索" },
  { id: "kmp", name: "KMP", domain: "string", weight: 3.0, pattern: "\\bkmp\\b|next 数组|失配指针" },
  { id: "zfunc", name: "Z 函数 / 扩展 KMP", domain: "string", weight: 3.0, pattern: "z 函数|z-algorithm|扩展 kmp" },
  { id: "rolling-hash", name: "字符串哈希", domain: "string", weight: 3.0, pattern: "字符串哈希|滚动哈希|rabin.?karp" },
  { id: "manacher", name: "Manacher", domain: "string", weight: 3.0, pattern: "manacher|马拉车" },
  { id: "palindrome-center", name: "中心扩展", domain: "string", weight: 2.5, pattern: "中心扩展|中心扩散" },
  { id: "greedy", name: "贪心", domain: "greedy", weight: 1.5, pattern: "贪心|greedy" },
  { id: "exchange-argument", name: "交换论证/反悔贪心", domain: "greedy", weight: 3.0, pattern: "反悔|交换论证|后悔" },
  { id: "simulate", name: "模拟", domain: "other", weight: 0.8, pattern: "模拟|simulat|按题意" },
  { id: "brute-force", name: "暴力枚举", domain: "other", weight: 0.8, pattern: "暴力|枚举|穷举" },
  { id: "bit-enum", name: "子集枚举", domain: "other", weight: 2.5, pattern: "子集枚举|二进制枚举|枚举子集" },
  { id: "design", name: "结构设计", domain: "other", weight: 2.0, pattern: "设计|双向链表\\s*\\+\\s*哈希|\\blru\\b|\\blfu\\b" },
  { id: "sweep-line", name: "扫描线/差分事件", domain: "ds", weight: 3.0, pattern: "扫描线|事件排序|上下车" },
  { id: "string-scan", name: "字符串扫描处理", domain: "string", weight: 1.0, pattern: "遍历字符|逐字符|字符统计|分割字符串|双指针扫描" },
  { id: "concurrency", name: "锁/信号量", domain: "other", weight: 3.0, pattern: "信号量|\\block\\b|互斥|条件变量|semaphore|synchronized" },
  { id: "sql", name: "SQL 查询", domain: "other", weight: 2.0, pattern: "\\bsql\\b|连接查询|\\bjoin\\b|group\\s?by|窗口函数|子查询" },
];

/** 没有题解数据时（洛谷题、刚出的周赛题）的兜底：从标签粗略映射一个思路。 */
export const TAG_FALLBACK: Record<string, string[]> = {"tree-traversal": ["tree-recursion"], "bst": ["bst-inorder"], "tree-build": ["tree-construct"], "tree-path": ["tree-lca"], "graph-basic": ["graph-dfs", "graph-bfs"], "topo": ["graph-topo"], "shortest-path": ["graph-dijkstra"], "union-find": ["graph-union-find"], "dp-linear": ["dp-1d"], "dp-sequence": ["dp-lcs"], "dp-knapsack": ["dp-knapsack"], "dp-grid": ["dp-2d"], "dp-interval": ["dp-interval"], "dp-tree": ["dp-tree"], "dp-bitmask": ["dp-bitmask"], "dp-machine": ["dp-machine"], "dp-digit": ["dp-digit"], "memo-search": ["dp-memo"], "backtracking": ["backtracking"], "flood-fill": ["graph-dfs"], "bfs-shortest": ["graph-bfs"], "dfs-basic": ["graph-dfs"], "search-advanced": ["bidirectional"], "monotonic": ["monotonic-stack"], "sliding-window": ["sliding-window"], "two-pointers": ["two-pointers"], "prefix-sum": ["prefix-sum"], "bs-array": ["binary-search"], "bs-answer": ["binary-search-answer"], "quickselect": ["quickselect"], "divide-conquer": ["merge-sort"], "heap": ["heap"], "hash-count": ["hash"], "sorting": ["sort-then"], "stack-queue": ["stack-sim"], "linked-list": ["list-reverse"], "trie": ["trie"], "segment-tree": ["segment-tree"], "fenwick": ["fenwick"], "ordered-set": ["ordered-set"], "balanced-tree": ["ordered-set"], "palindrome": ["palindrome-center"], "combinatorics": ["math-combi"], "geometry": ["math-geometry"], "game-theory": ["math-game"], "bit": ["math-xor"], "number-theory": ["math-formula"], "probability": ["math-formula"], "string-match": ["string-scan"], "suffix": ["string-scan"], "graph-advanced": ["graph-dfs"], "greedy-basic": ["greedy"], "greedy-heap": ["heap"], "greedy-interval": ["greedy"], "construct": ["brute-force"], "simulation": ["simulate"], "enumeration": ["brute-force"], "matrix": ["simulate"], "ds-design": ["design"], "data-stream": ["design"], "iterator": ["design"], "interval": ["sweep-line"], "string-basic": ["string-scan"], "concurrency": ["concurrency"], "db-shell": ["sql"]};

export const KEEP_CONF = 0.06;
export const MAX_LABELS = 8;
export const CHANNEL_CN: Record<string, string> = {"code": "题解代码", "statement": "题面推理", "solutions": "题解文字", "tags": "官方标签"};
