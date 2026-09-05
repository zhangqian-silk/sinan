/**
 * 专题的教学卡片：核心思想、模板骨架、常见坑、延伸阅读。
 *
 * 两条自己给自己定的规矩：
 *
 * 1. **「什么时候想到它」不写在这里**，而是从打标规则反查（见 signals.ts，
 *    由 scripts/gen_signals.py 从 statement.py 的问法规则生成）。那批规则本来
 *    就是「看到这种问法 → 该用这个解法」，正是识别信号本身。手写一遍等于把同一
 *    件事说两遍，改了一处另一处就会过时。
 * 2. **延伸阅读只放真实存在的页面**。URL 全部对着 oi-wiki.org 的 sitemap 核过。
 *
 * 模板骨架统一用 Python 写，只留骨架和关键不变量，不写完整可提交的解 ——
 * 背模板没意义，能看出「循环边界为什么这么定」才有意义。
 */

export interface Note {
  /** 核心思想，2~4 句 */
  idea?: string;
  /** 模板骨架 */
  template?: string;
  /** 常见坑 */
  pitfalls?: string[];
  /** 典型复杂度 */
  complexity?: string;
  /** [标题, URL] */
  refs?: [string, string][];
}

const OI = "https://oi-wiki.org";
const oi = (path: string): string => `${OI}${path}`;


/** 13 个大类：只讲「这一大块在解决什么问题」。 */
export const CAT_NOTES: Record<string, Note> = {
  "basics": {
    idea: "没有专门算法的那一类：按题意把过程翻译成代码，靠枚举和整理把复杂度压下来。这块看着简单，但下标、边界、方向的错误占了面试里绝大多数的调试时间。",
    pitfalls: ["下标从 0 还是 1，一道题里必须统一", "循环里改动正在遍历的容器", "整数溢出与除零，取模要边算边取"],
    refs: [
      ["模拟", oi("/basic/simulate/")],
      ["枚举", oi("/basic/enumerate/")],
      ["复杂度", oi("/basic/complexity/")],
    ],
  },
  "array": {
    idea: "一维序列上的四把工具：双指针（把 O(n²) 的两层循环压成一层）、滑动窗口（约束单调时收缩左端）、前缀和 / 差分（把区间操作变成端点操作）、区间排序后扫描。判断用哪个，先问「约束是否单调」「问的是区间还是端点」。",
    refs: [
      ["尺取法 / 双指针", oi("/misc/two-pointer/")],
      ["前缀和", oi("/basic/prefix-sum/")],
      ["扫描线", oi("/geometry/scanning/")],
    ],
  },
  "ds-basic": {
    idea: "选数据结构就是选「你需要哪种查询在 O(1) 或 O(log n) 内完成」：按值查位置用哈希，后进先出用栈，要最值用堆，要有序还要动态插删用有序集合。单调栈 / 单调队列是这块的重点，它们把「找左右第一个更大」和「窗口最值」变成线性。",
    refs: [
      ["哈希表", oi("/ds/hash/")],
      ["栈", oi("/ds/stack/")],
      ["队列", oi("/ds/queue/")],
      ["堆", oi("/ds/heap/")],
      ["单调栈", oi("/ds/monotonic-stack/")],
      ["单调队列", oi("/ds/monotonic-queue/")],
    ],
  },
  "string": {
    idea: "字符串题先分清是「子串」还是「子序列」：子串连续，多半是窗口 / 哈希 / KMP；子序列不连续，多半是 DP。回文是单独一族，中心扩展够用，要线性就上 Manacher。",
    refs: [
      ["字符串基础", oi("/string/basic/")],
      ["KMP", oi("/string/kmp/")],
      ["字符串哈希", oi("/string/hash/")],
      ["Manacher", oi("/string/manacher/")],
      ["字典树", oi("/string/trie/")],
    ],
  },
  "binary-search": {
    idea: "二分的前提只有一个：**答案具有单调性**。在有序数组上二分是找位置；在答案空间上二分是「猜一个答案，写个 check 判断可不可行」——后者才是面试真正拉分的地方，因为难点全在怎么设计 check。",
    refs: [
      ["二分", oi("/basic/binary/")],
      ["分治", oi("/basic/divide-and-conquer/")],
      ["快速排序 / 快速选择", oi("/basic/quick-sort/")],
    ],
  },
  "tree": {
    idea: "树上递归只需要想清楚三件事：递归边界、当前节点该干什么、以及这件事发生在递归子树之**前**（前序，自顶向下传信息）还是之**后**（后序，自底向上收答案）。绝大多数树题就是在这两者里选一个。",
    refs: [
      ["树基础", oi("/graph/tree-basic/")],
      ["二叉搜索树", oi("/ds/bst/")],
      ["最近公共祖先", oi("/graph/lca/")],
    ],
  },
  "search": {
    idea: "在状态空间里穷举。三个问题决定写法：状态怎么表示、怎么剪枝、要不要记忆化。求「所有方案」用回溯，求「最少步数」用 BFS，求「存在性」两者都行、有重复子问题就加记忆化——加上记忆化的 DFS 就已经是 DP 了。",
    refs: [
      ["DFS", oi("/search/dfs/")],
      ["BFS", oi("/search/bfs/")],
      ["回溯", oi("/search/backtracking/")],
      ["记忆化搜索", oi("/dp/memo/")],
      ["剪枝", oi("/search/opt/")],
    ],
  },
  "dp": {
    idea: "DP 三步：定义状态（把「已经决定了什么」塞进下标）、写转移（当前这一步有哪些选择）、定边界和顺序。卡住的时候先写记忆化搜索——它和递推等价但好想得多，写出来再机械地翻译成循环。数据范围决定状态能开几维。",
    refs: [
      ["动态规划基础", oi("/dp/basic/")],
      ["记忆化搜索", oi("/dp/memo/")],
      ["背包", oi("/dp/knapsack/")],
      ["区间 DP", oi("/dp/interval/")],
      ["状压 DP", oi("/dp/state/")],
      ["树形 DP", oi("/dp/tree/")],
      ["数位 DP", oi("/dp/number/")],
    ],
  },
  "graph": {
    idea: "图论题的第一步永远是**建图**：把题面里的关系翻译成邻接表。然后按「边有没有权、权有没有负」选算法：无权最短路 BFS、非负权 Dijkstra、有负权 Bellman-Ford、要所有点对 Floyd。依赖关系是拓扑排序，连通性是并查集。",
    refs: [
      ["图的存储", oi("/graph/save/")],
      ["最短路", oi("/graph/shortest-path/")],
      ["拓扑排序", oi("/graph/topo/")],
      ["并查集", oi("/ds/dsu/")],
      ["最小生成树", oi("/graph/mst/")],
    ],
  },
  "greedy": {
    idea: "贪心的门槛不在写代码，在**证明**。常用两招：交换论证（把最优解里的两个元素换成贪心的选法，答案不会变差）和反悔贪心（先都要，超了再用堆退掉最差的）。证不出来就别用贪心，换 DP。",
    refs: [
      ["贪心", oi("/basic/greedy/")],
      ["构造", oi("/basic/construction/")],
    ],
  },
  "math": {
    idea: "数学题彼此几乎不可替代——每道题吃的是各自那条定理。所以这块不适合刷量，适合按定理逐个过：筛法、GCD / 裴蜀、快速幂与逆元、组合数、容斥、博弈的 SG 函数。认出是哪条定理，题就做完了。",
    refs: [
      ["数论基础", oi("/math/number-theory/basic/")],
      ["筛法", oi("/math/number-theory/sieve/")],
      ["快速幂", oi("/math/binary-exponentiation/")],
      ["组合数", oi("/math/combinatorics/combination/")],
      ["博弈论", oi("/math/game-theory/intro/")],
    ],
  },
  "advanced-ds": {
    idea: "共同的问题是「又要改又要查区间」。单点改 + 区间和用树状数组（短、快）；区间改 + 区间查用线段树（懒标记）；要动态第 k 大用平衡树 / 权值线段树。面试里出现频率不高，但出现了基本就是分水岭。",
    refs: [
      ["树状数组", oi("/ds/fenwick/")],
      ["线段树", oi("/ds/seg/")],
      ["平衡树", oi("/ds/treap/")],
      ["可持久化", oi("/ds/persistent/")],
    ],
  },
  "design": {
    idea: "设计题考的是「用现成结构拼出要求的复杂度」。看到 O(1) 就想哈希，看到「最近 / 最久」就想双向链表，看到「动态中位数 / 第 k 大」就想对顶堆。先把接口和不变量写清楚，再填实现。",
    refs: [
      ["数据结构总览", oi("/ds/")],
      ["链表", oi("/ds/linked-list/")],
      ["堆", oi("/ds/heap/")],
      ["迭代器", oi("/lang/csl/iterator/")],
    ],
  },
};

/** 65 个子标签：核心思想 + 模板 + 坑。 */
export const SUB_NOTES: Record<string, Note> = {
  "simulation": {
    idea: "题面就是伪代码，照着做。难点是把状态和步骤拆干净，别让一个循环干三件事。",
    pitfalls: ["方向数组写成常量放外面，别在循环里手写四个 if", "先想清楚「一步」的定义，再决定循环条件"],
    complexity: "通常 O(n) ~ O(n²)，取决于题面描述的过程",
    refs: [
      ["模拟", oi("/basic/simulate/")],
    ],
  },
  "enumeration": {
    idea: "把答案的可能取值全试一遍。关键是用数学或约束把枚举量压到能跑，以及保证「不重不漏」——枚举顺序固定就能天然去重。",
    pitfalls: ["枚举组合时固定「下标递增」来去重，别靠事后 set"],
    complexity: "O(枚举量 × 单次判定)",
    refs: [
      ["枚举", oi("/basic/enumerate/")],
    ],
  },
  "matrix": {
    idea: "二维题多半是下标变换：转置 + 每行翻转 = 顺时针旋转 90°；螺旋遍历用四个边界变量逐层收缩；需要 O(1) 空间标记时，拿第一行 / 第一列当标记位。",
    template: `# 顺时针旋转 90°：先沿主对角线转置，再每行反转
for i in range(n):
    for j in range(i + 1, n):            # 只走上三角，走满会转回去
        g[i][j], g[j][i] = g[j][i], g[i][j]
for row in g:
    row.reverse()

# 螺旋遍历：四个边界向内收，每收一次立刻判空
top, bottom, left, right = 0, m - 1, 0, n - 1
while top <= bottom and left <= right:
    for j in range(left, right + 1): out.append(g[top][j])
    top += 1
    for i in range(top, bottom + 1): out.append(g[i][right])
    right -= 1
    if top > bottom or left > right: break   # 这一句不能省
    ...`,
    pitfalls: ["螺旋遍历每走完一条边都要重新判边界，否则单行 / 单列会重复输出"],
    complexity: "O(mn)",
    refs: [
      ["模拟", oi("/basic/simulate/")],
    ],
  },
  "bit": {
    idea: "常用的就几条：`x & -x` 取最低位的 1；`x & (x-1)` 去掉最低位的 1；异或的自反性（`a ^ a = 0`）用来找单独出现的数；`for s in range(1 << n)` 枚举子集。",
    template: `x & -x            # lowbit：最低位的 1
x & (x - 1)       # 抹掉最低位的 1，循环次数 = 1 的个数
x >> i & 1        # 取第 i 位
x | (1 << i)      # 置 1        x & ~(1 << i)  # 置 0    x ^ (1 << i)  # 翻转

# 枚举 mask 的所有子集（含空集），复杂度 O(3^n) 而不是 O(4^n)
sub = mask
while True:
    ...
    if sub == 0: break
    sub = (sub - 1) & mask`,
    pitfalls: ["Python 的整数没有位宽，负数右移不会变成 0，判负要另写", "优先级：`&` 比 `==` 低，条件里记得加括号"],
    complexity: "单次位运算 O(1)；枚举全部子集 O(2^n)，枚举子集的子集 O(3^n)",
    refs: [
      ["位运算", oi("/math/bit/")],
      ["状态压缩", oi("/math/binary-set/")],
    ],
  },
  "sorting": {
    idea: "面试里很少让你手写排序，考的是「按什么排」：自定义比较器、多关键字、以及「排完之后能顺手做什么」（相邻比较、双指针、贪心）。",
    template: `items.sort(key=lambda x: (x[0], -x[1]))   # 第一关键字升，第二关键字降

# 需要真正的比较函数时（比如「拼接成最大数」这种传递性靠比较定义的场景）
from functools import cmp_to_key
nums.sort(key=cmp_to_key(lambda a, b: 1 if a + b < b + a else -1))`,
    pitfalls: ["自定义比较必须满足传递性，否则结果不确定", "Python 的 sort 是稳定的，需要稳定性时别改成别的写法"],
    complexity: "O(n log n)；值域小的时候计数排序 O(n + U)",
    refs: [
      ["排序总览", oi("/basic/sort-intro/")],
      ["排序的应用", oi("/basic/use-of-sort/")],
    ],
  },
  "two-pointers": {
    idea: "两根指针把两层循环压成一层。两种形态：**对撞**（有序数组里一头一尾往中间走，和太大就右移，太小就左移）和**同向**（快指针探路、慢指针写结果，用于原地删改）。",
    template: `# 对撞：有序数组里找和为 target 的一对
l, r = 0, n - 1
while l < r:
    s = a[l] + a[r]
    if s == target: return l, r
    if s < target: l += 1        # 只能让和变大
    else: r -= 1

# 同向：原地保留满足条件的元素，slow 指向下一个写入位
slow = 0
for fast in range(n):
    if keep(a[fast]):
        a[slow] = a[fast]
        slow += 1
return slow                      # 新长度`,
    pitfalls: ["对撞指针成立的前提是「移动方向能单调改变目标值」，无序数组要先排序", "三数之和这类要去重：同一层里跳过与前一个相同的值"],
    complexity: "O(n)（若需先排序则 O(n log n)）",
    refs: [
      ["双指针 / 尺取法", oi("/misc/two-pointer/")],
    ],
  },
  "sliding-window": {
    idea: "窗口右端一直往右扩，一旦违反约束就收缩左端。成立的**前提是约束单调**：窗口变大时约束只会越来越难满足。不单调（比如「0 和 1 数量相同」）就不能用窗口，那是前缀和 + 哈希。",
    template: `# 变长窗口：求满足条件的最长窗口
left = ans = 0
cnt = Counter()
for right, ch in enumerate(s):
    cnt[ch] += 1
    while 违反约束(cnt):           # while 不是 if：可能要连收缩好几步
        cnt[s[left]] -= 1
        if cnt[s[left]] == 0: del cnt[s[left]]
        left += 1
    ans = max(ans, right - left + 1)

# 定长窗口：进一个、出一个，先补满再统计
for right, x in enumerate(a):
    add(x)
    if right < k - 1: continue
    ans = max(ans, query())
    remove(a[right - k + 1])`,
    pitfalls: [
      "收缩必须用 while，用 if 只收一步就会漏",
      "求最短窗口时在「满足条件」的时刻更新答案；求最长窗口时在「已恢复合法」后更新",
      "哈希计数减到 0 要删键，否则「不同字符数」会算错",
    ],
    complexity: "O(n)，每个元素最多进窗一次、出窗一次",
    refs: [
      ["尺取法", oi("/misc/two-pointer/")],
    ],
  },
  "prefix-sum": {
    idea: "前缀和把「区间求和」变成两个端点相减；差分反过来，把「区间加」变成两个端点修改，最后求一次前缀和还原。配上哈希表，前缀和还能数出「和为 k 的子数组个数」。",
    template: `# 前缀和：pre[i] = a[0..i-1] 之和，区间 [l, r] 的和 = pre[r+1] - pre[l]
pre = [0] * (n + 1)
for i, x in enumerate(a):
    pre[i + 1] = pre[i] + x

# 和为 k 的子数组个数：边扫边记「某个前缀和出现过几次」
cnt = Counter({0: 1})            # 空前缀，别漏
s = ans = 0
for x in a:
    s += x
    ans += cnt[s - k]            # 先查再记，避免自己配自己
    cnt[s] += 1

# 差分：把 [l, r] 全体 += v
d[l] += v
d[r + 1] -= v                    # 数组要开 n+1 长`,
    pitfalls: ["下标偏移：`pre` 长度是 n+1，`pre[0] = 0` 那一位是空前缀", "哈希版必须先查后记，且初始要放一个 `{0: 1}`", "差分数组要多开一位，否则 `r+1` 越界"],
    complexity: "预处理 O(n)，单次查询 O(1)",
    refs: [
      ["前缀和与差分", oi("/basic/prefix-sum/")],
    ],
  },
  "interval": {
    idea: "区间题的通用套路：**排序 + 扫一遍**。合并区间按左端点排；选最多不重叠区间按右端点排；问「某时刻同时有几个」就把起止拆成事件排序扫描（扫描线）。",
    template: `# 合并重叠区间：按左端点排序，能接上就伸长右端点
iv.sort()
out = [iv[0]]
for l, r in iv[1:]:
    if l <= out[-1][1]: out[-1][1] = max(out[-1][1], r)
    else: out.append([l, r])

# 扫描线：最多同时进行的区间数（会议室 II）
events = [(l, 1) for l, r in iv] + [(r, -1) for l, r in iv]
events.sort()                    # 同一时刻先出后进 => -1 排在 +1 前，正好符合升序
cur = best = 0
for _, delta in events:
    cur += delta
    best = max(best, cur)`,
    pitfalls: ["端点相接算不算重叠，看题面定义，直接决定用 `<=` 还是 `<`", "扫描线里同一坐标上「结束」和「开始」的先后顺序会改变答案"],
    complexity: "O(n log n)，瓶颈在排序",
    refs: [
      ["扫描线", oi("/geometry/scanning/")],
      ["贪心", oi("/basic/greedy/")],
    ],
  },
  "hash-count": {
    idea: "把「按值找位置」和「统计出现次数」变成 O(1)。经典用法是「边扫边查」：扫到当前元素时，查它需要的另一半是否已经出现过。",
    template: `seen = {}
for i, x in enumerate(a):
    if target - x in seen: return [seen[target - x], i]
    seen[x] = i                  # 先查后记：避免把自己算进去`,
    pitfalls: ["先查后记的顺序不能反", "Counter 减到 0 不会自动删键，判断「种类数」时要显式删"],
    complexity: "平均 O(1)，最坏 O(n)（哈希冲突）",
    refs: [
      ["哈希表", oi("/ds/hash/")],
    ],
  },
  "stack-queue": {
    idea: "栈用来处理「就近配对」和「延后处理」：括号匹配、表达式求值、路径化简。队列用来处理「按到达顺序」：BFS、滑窗、生产消费。",
    template: `# 括号匹配：左括号入栈，右括号必须和栈顶配对
pairs = {')': '(', ']': '[', '}': '{'}
st = []
for ch in s:
    if ch in pairs:
        if not st or st.pop() != pairs[ch]: return False
    else:
        st.append(ch)
return not st                    # 结尾必须空栈`,
    pitfalls: ["弹栈前一定先判空", "结束时别忘了检查栈是否已清空"],
    complexity: "O(n)",
    refs: [
      ["栈", oi("/ds/stack/")],
      ["队列", oi("/ds/queue/")],
    ],
  },
  "monotonic": {
    idea: "单调栈回答「左右两边第一个比我大 / 小的元素在哪」——栈里维持单调，被弹出的那一刻就知道答案。单调队列回答「滑动窗口内的最值」——队尾弹掉不可能成为答案的、队头弹掉出窗的。",
    template: `# 单调栈：找每个元素右边第一个更大的下标
st, res = [], [-1] * n
for i, x in enumerate(a):
    while st and a[st[-1]] < x:  # 严格小于弹出 => 相等时保留左边那个
        res[st.pop()] = i
    st.append(i)

# 单调队列：窗口最大值，队列里存下标，值单调递减
from collections import deque
q = deque()
for i, x in enumerate(a):
    while q and a[q[-1]] <= x: q.pop()        # 尾部：比新来的小，永无出头之日
    q.append(i)
    if q[0] <= i - k: q.popleft()             # 头部：出窗
    if i >= k - 1: out.append(a[q[0]])`,
    pitfalls: ["`<` 还是 `<=` 决定相等元素归谁，做「面积 / 计数」类题时会改变答案", "存下标而不是存值，否则判不了是否出窗", "先弹队尾再入队，再弹队头，顺序错了窗口大小就不对"],
    complexity: "O(n)，每个下标进出各一次",
    refs: [
      ["单调栈", oi("/ds/monotonic-stack/")],
      ["单调队列", oi("/ds/monotonic-queue/")],
    ],
  },
  "linked-list": {
    idea: "链表题就三招：**虚拟头节点**（省掉「删的是头节点吗」的分支）、**快慢指针**（找中点、判环、找倒数第 k 个）、**三指针反转**。画个图再写，比在脑子里推靠得住。",
    template: `# 虚拟头：删除值为 val 的所有节点
dummy = ListNode(next=head)
cur = dummy
while cur.next:
    if cur.next.val == val: cur.next = cur.next.next
    else: cur = cur.next
return dummy.next

# 反转：pre 在后、cur 在前，逐个掰方向
pre, cur = None, head
while cur:
    nxt = cur.next               # 先存住，否则断链后找不到
    cur.next = pre
    pre, cur = cur, nxt
return pre

# 快慢指针：找中点（偶数长度时 slow 落在后半段第一个）
slow = fast = head
while fast and fast.next:
    slow, fast = slow.next, fast.next.next`,
    pitfalls: [
      "反转时必须先把 `next` 存下来再改指针",
      "判环用 `while fast and fast.next`，两个条件都要",
      "返回 `dummy.next` 而不是 `head`——head 可能已经被删了",
    ],
    complexity: "O(n)，空间 O(1)",
    refs: [
      ["链表", oi("/ds/linked-list/")],
    ],
  },
  "heap": {
    idea: "只关心最值、不需要全序时用堆。求「前 k 大」维护一个大小为 k 的**小**顶堆（堆顶是这 k 个里最小的，新元素比它大就换掉）——反过来会退化成全排序。",
    template: `import heapq
# 前 k 大：维护大小为 k 的小顶堆
h = []
for x in a:
    heapq.heappush(h, x)
    if len(h) > k: heapq.heappop(h)   # 挤掉当前最小的
return h[0]                            # 第 k 大

# Python 只有小顶堆，要大顶堆就取反
heapq.heappush(h, -x)

# 带优先级的元组：先按第一维，相同再比第二维（第二维必须可比较）
heapq.heappush(h, (dist, node))`,
    pitfalls: ["元组入堆时第二维也会参与比较，放不可比较的对象会报错", "堆里存的是「候选」，出堆时要判断是否已过期（Dijkstra 的懒删除）"],
    complexity: "建堆 O(n)，单次插入 / 弹出 O(log n)，前 k 大 O(n log k)",
    refs: [
      ["堆", oi("/ds/heap/")],
      ["二叉堆", oi("/ds/binary-heap/")],
    ],
  },
  "ordered-set": {
    idea: "既要有序、又要动态插删时用有序集合（C++ 的 `set` / Java 的 `TreeMap`）。Python 标准库没有，面试里通常用 `sortedcontainers.SortedList`，或者改用「对顶堆」「离散化 + 树状数组」绕过去。",
    template: `from sortedcontainers import SortedList
sl = SortedList()
sl.add(x); sl.remove(x)
i = sl.bisect_left(x)        # 有多少个比 x 小
sl[0], sl[-1]                # 最小 / 最大
sl[k]                        # 第 k+1 小，O(log n)`,
    pitfalls: ["面试环境可能没有 sortedcontainers，先问一句或准备退路"],
    complexity: "插入 / 删除 / 查排名均 O(log n)",
    refs: [
      ["二叉搜索树", oi("/ds/bst/")],
      ["关联容器", oi("/lang/csl/associative-container/")],
    ],
  },
  "string-basic": {
    idea: "计数（26 个字母的定长数组比哈希快）、按字符分组（排序后的串当 key）、双指针原地处理。大部分「简单」字符串题就是这三样的组合。",
    template: `# 字母异位词分组：排序后的串作为 key
groups = defaultdict(list)
for w in words:
    groups[''.join(sorted(w))].append(w)

# 只有小写字母时，用长度 26 的计数数组当 key 更快（O(len) 而不是 O(len log len)）
key = tuple(Counter(w)[c] for c in string.ascii_lowercase)`,
    complexity: "O(总长度) ~ O(总长度 × log 单词长度)",
    refs: [
      ["字符串基础", oi("/string/basic/")],
    ],
  },
  "palindrome": {
    idea: "回文的对称性决定了两种做法：**中心扩展**（枚举中心往两边扩，奇偶各一次，O(n²)）和 **Manacher**（O(n)）。判断「是不是回文」是双指针；求「最长回文子序列」不连续，那是区间 DP。",
    template: `# 中心扩展：枚举 2n-1 个中心（n 个字符 + n-1 个间隙）
def expand(l, r):
    while l >= 0 and r < n and s[l] == s[r]:
        l -= 1; r += 1
    return r - l - 1             # 退出时多走了一步，长度要 -1

for i in range(n):
    best = max(best, expand(i, i), expand(i, i + 1))`,
    pitfalls: ["奇偶两种中心都要试，只写一种会漏掉偶数长度的回文", "扩展结束时指针已越界一格，算长度记得修正"],
    complexity: "中心扩展 O(n²)，Manacher O(n)",
    refs: [
      ["Manacher", oi("/string/manacher/")],
      ["回文自动机", oi("/string/pam/")],
    ],
  },
  "string-match": {
    idea: "在长串里找模式串。KMP 靠 next 数组（最长相等前后缀）做到失配时不回退主串；字符串哈希更好写——把子串映射成数字，O(1) 比较，代价是有极小概率冲突。",
    template: `# KMP：先算 next（nxt[i] = s[0..i] 的最长相等真前后缀长度）
nxt = [0] * m
j = 0
for i in range(1, m):
    while j and p[i] != p[j]: j = nxt[j - 1]
    if p[i] == p[j]: j += 1
    nxt[i] = j

j = 0                            # 再拿同一套逻辑扫主串
for i, ch in enumerate(s):
    while j and ch != p[j]: j = nxt[j - 1]
    if ch == p[j]: j += 1
    if j == m:
        hit(i - m + 1)
        j = nxt[j - 1]           # 允许重叠匹配`,
    pitfalls: ["next 数组的定义（前缀函数 / 失配位置）有多种写法，别混用", "哈希要选大质数模数，单哈希在对抗性数据下会被卡"],
    complexity: "KMP O(n + m)；哈希 O(n + m) 但有冲突概率",
    refs: [
      ["字符串匹配", oi("/string/match/")],
      ["KMP", oi("/string/kmp/")],
      ["字符串哈希", oi("/string/hash/")],
    ],
  },
  "trie": {
    idea: "把一批字符串按公共前缀压成一棵树，从而 O(len) 完成「插入 / 查询 / 前缀查询」。变体：01-Trie 把整数按二进制位插入，用来求最大异或对。",
    template: `class Trie:
    def __init__(self):
        self.ch = {}             # 也可用长度 26 的数组，更快
        self.end = False

    def insert(self, w):
        node = self
        for c in w:
            node = node.ch.setdefault(c, Trie())
        node.end = True          # 标记「这里结束了一个完整单词」

    def find(self, w):
        node = self
        for c in w:
            if c not in node.ch: return None
            node = node.ch[c]
        return node              # 调用方决定是看 end（整词）还是看存在（前缀）`,
    pitfalls: ["「存在这个前缀」和「存在这个单词」是两件事，靠 end 标记区分", "支持删除时要维护计数而不是布尔标记"],
    complexity: "插入 / 查询 O(单词长度)，空间 O(总长度 × 字符集)",
    refs: [
      ["字典树", oi("/string/trie/")],
    ],
  },
  "bs-array": {
    idea: "在有序数组里找位置。**只背一个模板**：闭区间 `[l, r]`，循环条件 `l <= r`，把「找左边界」统一成「找第一个 >= target 的位置」，其它情况都能由它推出来。",
    template: `# 第一个 >= target 的下标（不存在则返回 n），等价于 bisect_left
l, r = 0, n                      # 左闭右开：r 取 n，答案落在 [0, n]
while l < r:
    mid = (l + r) // 2
    if a[mid] < target: l = mid + 1
    else: r = mid                # a[mid] >= target，答案可能就是 mid
return l

# 由它推出其余四种：
# 第一个 > target   -> lower(target + 1)
# 最后一个 < target -> lower(target) - 1
# 最后一个 <= target-> lower(target + 1) - 1`,
    pitfalls: [
      "区间开闭一旦选定，`mid` 的归属和循环条件必须一致，混用必死循环",
      "旋转数组二分要先判断 `mid` 落在哪一段，再决定丢哪半边",
      "Python 直接用 `bisect_left / bisect_right` 更稳，手写只在需要自定义判定时",
    ],
    complexity: "O(log n)",
    refs: [
      ["二分", oi("/basic/binary/")],
    ],
  },
  "bs-answer": {
    idea: "答案本身单调时，不去推答案，而是**猜一个答案再验证**。识别方法：问「最小的最大值」「最少多少天 / 多小的速度能完成」，而且给定一个候选答案很容易判断可行性。难点全在 check 函数。",
    template: `def check(x) -> bool:
    """x 可行吗？必须保证：x 可行 => 所有更大的 x 也可行（单调）"""
    ...

l, r = 最小可能答案, 最大可能答案
while l < r:
    mid = (l + r) // 2
    if check(mid): r = mid       # mid 可行，答案不会更大
    else: l = mid + 1
return l`,
    pitfalls: ["先验证单调性，不单调用二分会得到随机答案", "上下界要取到极端值（比如速度上界取 max(piles)），取窄了会漏答案", "求「最大化最小值」时把比较方向整体反过来，别在循环里凑"],
    complexity: "O(log(值域) × check 的复杂度)",
    refs: [
      ["二分", oi("/basic/binary/")],
    ],
  },
  "divide-conquer": {
    idea: "拆成规模更小的同类子问题，解完再合并。归并排序是范式：合并那一步顺手就能数出逆序对。判断能不能分治，看「合并是否比重新算便宜」。",
    template: `def solve(l, r):
    if r - l <= 1: return 基本情形
    mid = (l + r) // 2
    left = solve(l, mid)
    right = solve(mid, r)
    return merge(left, right)    # 关键在这一步能不能高效合并

# 归并时数逆序对：右半段元素出列时，左半段剩下的都比它大
while i < len(L) and j < len(R):
    if L[i] <= R[j]: out.append(L[i]); i += 1
    else: cnt += len(L) - i; out.append(R[j]); j += 1`,
    pitfalls: ["区间划分要保证子问题严格变小，否则无限递归", "跨越中点的情况最容易漏，那正是合并要处理的部分"],
    complexity: "典型 O(n log n)（主定理：T(n) = 2T(n/2) + O(n)）",
    refs: [
      ["分治", oi("/basic/divide-and-conquer/")],
      ["归并排序", oi("/basic/merge-sort/")],
    ],
  },
  "quickselect": {
    idea: "只要第 k 大，不必全排序：借快排的划分，每轮只递归**包含答案的那一半**，期望 O(n)。基准要随机选，否则有序输入会退化成 O(n²)。",
    template: `import random
def quick_select(a, k):          # 返回第 k 小（k 从 0 计）
    pivot = random.choice(a)     # 随机化是关键，不能固定取首尾
    small = [x for x in a if x < pivot]
    equal = [x for x in a if x == pivot]
    large = [x for x in a if x > pivot]
    if k < len(small): return quick_select(small, k)
    if k < len(small) + len(equal): return pivot
    return quick_select(large, k - len(small) - len(equal))`,
    pitfalls: ["必须随机选基准", "要单独处理「等于基准」的那一组，否则有重复元素时会死循环"],
    complexity: "期望 O(n)，最坏 O(n²)（随机化后概率极低）",
    refs: [
      ["快速排序", oi("/basic/quick-sort/")],
    ],
  },
  "tree-traversal": {
    idea: "递归写法只差一行位置：处理当前节点写在递归**之前**是前序（自顶向下传参数），写在两次递归**之间**是中序（BST 中序即升序），写在**之后**是后序（自底向上收集子树答案，树形 DP 全靠它）。按层组织答案就用 BFS。",
    template: `def dfs(node):
    if not node: return
    # 前序：visit(node) 放这里
    dfs(node.left)
    # 中序：visit(node) 放这里
    dfs(node.right)
    # 后序：visit(node) 放这里

# 后序的另一种长相：自底向上合并，没有 visit 语句
def height(node):
    if not node: return 0
    return max(height(node.left), height(node.right)) + 1

# 层序：先量一层有多少个，再一次处理完这一层
q = deque([root])
while q:
    for _ in range(len(q)):      # len(q) 必须在进循环前取
        node = q.popleft()
        if node.left: q.append(node.left)
        if node.right: q.append(node.right)`,
    pitfalls: ["层序里 `range(len(q))` 的 len 要在循环外求值，否则边加边算层就串了", "递归深度可能爆栈（链状树 n=1e5），必要时改迭代 + 显式栈"],
    complexity: "O(n)，递归栈空间 O(树高)",
    refs: [
      ["树基础", oi("/graph/tree-basic/")],
      ["DFS", oi("/search/dfs/")],
      ["BFS", oi("/search/bfs/")],
    ],
  },
  "bst": {
    idea: "BST 的全部性质浓缩成一句：**中序遍历是升序**。于是「第 k 小」「验证 BST」「转有序链表」「找最小差值」都变成中序遍历时顺手做的事。",
    template: `# 验证 BST：中序必须严格递增（不能只比较父子，要传上下界或记前驱）
pre = -inf
def dfs(node):
    global pre
    if not node: return True
    if not dfs(node.left): return False
    if node.val <= pre: return False
    pre = node.val
    return dfs(node.right)

# 查找 / 插入：靠大小关系单边下降，O(树高)
while node:
    if target < node.val: node = node.left
    elif target > node.val: node = node.right
    else: return node`,
    pitfalls: ["验证 BST 只比较父子是错的，必须传上下界或用中序前驱", "删除节点分三种情况（无子、单子、双子），双子要用后继替换"],
    complexity: "平衡时 O(log n)，退化成链时 O(n)",
    refs: [
      ["二叉搜索树", oi("/ds/bst/")],
    ],
  },
  "tree-build": {
    idea: "由遍历序列重建树：前序 / 后序给出**根的位置**，中序给出**左右子树的分界**，两者结合才能唯一确定。序列化则是选一种遍历 + 显式记录空节点。",
    template: `# 前序 + 中序重建：前序的第一个是根，在中序里找到它，左右一分为二
idx = {v: i for i, v in enumerate(inorder)}   # 预处理，避免每层 O(n) 查找

def build(pl, pr, il, ir):
    if pl > pr: return None
    root = TreeNode(preorder[pl])
    k = idx[preorder[pl]]
    left_size = k - il
    root.left = build(pl + 1, pl + left_size, il, k - 1)
    root.right = build(pl + left_size + 1, pr, k + 1, ir)
    return root`,
    pitfalls: ["左子树长度算错是唯一的高频错误，先算 left_size 再写四个下标", "序列化必须记录空节点（比如写成 '#'），否则无法唯一还原"],
    complexity: "O(n)（用哈希表定位根）",
    refs: [
      ["树基础", oi("/graph/tree-basic/")],
    ],
  },
  "tree-path": {
    idea: "路径类题目分两种：**必须经过根**的（在后序里用左右链和更新全局答案）和**任意两点**的（LCA）。直径 = 对每个节点算「左链 + 右链」取最大。",
    template: `# 二叉树直径 / 最大路径和：返回「向下的单链」，答案在过程中更新
ans = 0
def dfs(node):
    if not node: return 0
    l = max(dfs(node.left), 0)   # 负贡献就不要，截断成 0
    r = max(dfs(node.right), 0)
    global ans
    ans = max(ans, l + r + node.val)   # 路径拐弯，只能在这里统计
    return max(l, r) + node.val        # 往上返回只能选一条链

# LCA（普通二叉树）：左右都找到就是当前节点
def lca(node, p, q):
    if not node or node is p or node is q: return node
    L, R = lca(node.left, p, q), lca(node.right, p, q)
    return node if L and R else (L or R)`,
    pitfalls: ["「返回值」和「答案」是两件事：返回单链，答案可以拐弯", "负值节点要截断成 0，否则最大路径和会被拖累"],
    complexity: "O(n)；带倍增预处理的 LCA 查询 O(log n)",
    refs: [
      ["最近公共祖先", oi("/graph/lca/")],
      ["树的直径", oi("/graph/tree-diameter/")],
    ],
  },
  "backtracking": {
    idea: "三步循环：**做选择 → 递归 → 撤销选择**。写之前先回答三个问题：路径是什么、选择列表是什么、什么时候收集答案。去重靠「排序 + 跳过同层重复」，不要靠事后 set。",
    template: `path, ans = [], []
def dfs(start):
    if 满足终止条件:
        ans.append(path[:])      # 必须拷贝，path 后面还会被改
        return
    for i in range(start, n):
        if i > start and a[i] == a[i - 1]: continue   # 同层去重（需先排序）
        if 剪枝条件: break                            # 排序后可以 break 而不是 continue
        path.append(a[i])
        dfs(i + 1)               # 元素可重复选就传 i
        path.pop()               # 撤销`,
    pitfalls: [
      "收集答案时忘了 `path[:]` 拷贝——最经典的错，结果全是空列表",
      "去重条件是 `i > start`（同层）而不是 `i > 0`",
      "排序后不满足条件可以直接 break，比 continue 快很多",
    ],
    complexity: "O(方案数 × 单个方案长度)，剪枝决定实际能跑多大",
    refs: [
      ["回溯", oi("/search/backtracking/")],
      ["剪枝", oi("/search/opt/")],
    ],
  },
  "dfs-basic": {
    idea: "沿一条路走到底再回头。图上 DFS 必须标记访问过的点，否则会绕圈；标记时机（进入时标记 vs 回溯时清除）决定了是「求连通块」还是「求所有路径」。",
    template: `visited = set()
def dfs(u):
    visited.add(u)               # 求连通块：进入即标记，永不清除
    for v in g[u]:
        if v not in visited: dfs(v)

# 求所有路径时反过来：回溯时要清除，否则别的路径走不了
def dfs_path(u):
    path.append(u); visited.add(u)
    ...
    path.pop(); visited.remove(u)`,
    pitfalls: ["忘标记 visited 会无限递归", "「连通块」和「所有路径」对 visited 的处理正好相反"],
    complexity: "O(V + E)",
    refs: [
      ["DFS", oi("/search/dfs/")],
      ["图的 DFS", oi("/graph/dfs/")],
    ],
  },
  "flood-fill": {
    idea: "网格连通块。DFS 和 BFS 都行，「沉岛」（把走过的格子直接改掉）比开 visited 更省事。多个起点同时扩散就是**多源 BFS**（把所有起点一次性入队）。",
    template: `DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))

def dfs(i, j):
    if not (0 <= i < m and 0 <= j < n) or g[i][j] != '1': return
    g[i][j] = '0'                # 沉岛：直接改，等于标记已访问
    for di, dj in DIRS: dfs(i + di, j + dj)

# 多源 BFS：所有起点先全部入队，天然按距离分层
q = deque([(i, j) for i, j in 所有起点])
dist = [[0] * n for _ in range(m)]
while q:
    i, j = q.popleft()
    for di, dj in DIRS:
        x, y = i + di, j + dj
        if 越界或已访问: continue
        dist[x][y] = dist[i][j] + 1
        q.append((x, y))`,
    pitfalls: ["边界判断写在递归入口，别在调用处写四遍", "改原数组会破坏输入，题目要求保留时得另开 visited", "递归可能爆栈（大网格），改 BFS 更稳"],
    complexity: "O(mn)",
    refs: [
      ["BFS", oi("/search/bfs/")],
      ["DFS", oi("/search/dfs/")],
    ],
  },
  "bfs-shortest": {
    idea: "**每步代价相同**时，BFS 第一次到达即最短。边权只有 0 和 1 用双端队列（0 权头插、1 权尾插）；起点终点都已知且状态空间大，用双向 BFS 把 b^d 降成 2·b^(d/2)。",
    template: `from collections import deque
q = deque([start])
dist = {start: 0}
while q:
    u = q.popleft()
    if u == target: return dist[u]
    for v in neighbors(u):
        if v in dist: continue   # 第一次到达就是最短，之后不用再管
        dist[v] = dist[u] + 1
        q.append(v)

# 需要「第几层」时用分层写法
step = 0
while q:
    for _ in range(len(q)):
        ...
    step += 1`,
    pitfalls: ["入队时就标记 visited，出队才标记会导致同一个点重复入队", "边权不全相同就不能用 BFS，得上 Dijkstra"],
    complexity: "O(V + E)",
    refs: [
      ["BFS", oi("/search/bfs/")],
      ["双向搜索", oi("/search/bidirectional/")],
    ],
  },
  "memo-search": {
    idea: "DP 想不出递推顺序时的救命写法：先写朴素递归（把「还剩什么没决定」写成参数），再加一行缓存。写出来之后想优化空间，再机械地翻译成递推。",
    template: `from functools import cache

@cache                           # 参数必须可哈希；用完考虑 dfs.cache_clear()
def dfs(i, j):
    if 边界: return 基本值
    return 合并(dfs(i - 1, j), dfs(i, j - 1))   # 「选 / 不选」通常就是这两支

# 翻译成递推：把参数变下标，把递归方向变循环方向（依赖谁就先算谁）`,
    pitfalls: ["参数里不能放 list（不可哈希），要转成 tuple 或用下标", "递归深度受限，n 上万时递推更稳", "多组测试数据之间要清缓存，否则结果串"],
    complexity: "O(状态数 × 单个状态的转移数)",
    refs: [
      ["记忆化搜索", oi("/dp/memo/")],
    ],
  },
  "search-advanced": {
    idea: "状态空间太大时的三个补救办法：双向 BFS（两头同时扩，在中间会合）、A*（用估价函数优先扩展更可能靠近终点的状态）、迭代加深（限深 DFS 逐步放宽，省内存）。",
    pitfalls: ["A* 的估价函数必须不高估真实距离，否则结果不是最优解"],
    complexity: "双向搜索把 b^d 降到约 2·b^(d/2)",
    refs: [
      ["双向搜索", oi("/search/bidirectional/")],
      ["A*", oi("/search/astar/")],
      ["迭代加深", oi("/search/iterative/")],
    ],
  },
  "dp-linear": {
    idea: "状态只有一维、按下标递推。写法固定：`dp[i]` 表示「以 i 结尾 / 前 i 个」的答案，转移时枚举「上一步是什么」。爬楼梯、打家劫舍、最大子数组和都是这一族。",
    template: `dp = [0] * (n + 1)
dp[0] = 基本情形
for i in range(1, n + 1):
    dp[i] = 合并(dp[i - 1], dp[i - 2], ...)

# 只依赖前两项时可以压成两个变量（滚动）
a, b = 0, 1
for _ in range(n):
    a, b = b, a + b`,
    pitfalls: ["「以 i 结尾」和「前 i 个里最优」是两种定义，转移和答案位置都不同，别混", "最大子数组和要在遍历中取全局最大，不是 dp[n]"],
    complexity: "O(n)，压维后空间 O(1)",
    refs: [
      ["动态规划基础", oi("/dp/basic/")],
    ],
  },
  "dp-sequence": {
    idea: "两大范式：**LIS**（最长递增子序列，贪心 + 二分能做到 O(n log n)）和 **LCS / 编辑距离**（两个串对齐，二维 DP，`dp[i][j]` 表示前 i 和前 j 的答案）。「子序列」不连续，所以一定是 DP 而不是窗口。",
    template: `# LIS：tails[k] = 长度为 k+1 的递增子序列的最小结尾
tails = []
for x in a:
    i = bisect_left(tails, x)    # 非严格递增用 bisect_right
    if i == len(tails): tails.append(x)
    else: tails[i] = x
return len(tails)

# 编辑距离：三种操作对应三个来源
for i in range(1, m + 1):
    for j in range(1, n + 1):
        if s[i-1] == t[j-1]: dp[i][j] = dp[i-1][j-1]
        else: dp[i][j] = 1 + min(dp[i-1][j],      # 删
                                 dp[i][j-1],      # 插
                                 dp[i-1][j-1])    # 改`,
    pitfalls: [
      "LIS 的 `tails` 不是答案序列本身，只有长度有意义",
      "严格 / 非严格递增决定用 bisect_left 还是 bisect_right",
      "二维 DP 的第 0 行 / 第 0 列是空串的边界，必须初始化",
    ],
    complexity: "LIS O(n log n)；LCS / 编辑距离 O(mn)",
    refs: [
      ["动态规划基础", oi("/dp/basic/")],
    ],
  },
  "dp-knapsack": {
    idea: "「选或不选」的经典模型。**01 背包**每件最多一次，一维压维时容量要**倒序**枚举；**完全背包**每件无限次，容量**正序**枚举。这一个循环方向就是全部区别，背下来不如想清楚：倒序保证 `dp[j-w]` 还是上一轮的值。",
    template: `# 01 背包（每件一次）：容量倒序
dp = [0] * (W + 1)
for w, v in items:
    for j in range(W, w - 1, -1):        # 倒序！
        dp[j] = max(dp[j], dp[j - w] + v)

# 完全背包（每件无限）：容量正序
for w, v in items:
    for j in range(w, W + 1):            # 正序！
        dp[j] = max(dp[j], dp[j - w] + v)

# 求方案数就把 max 换成加法；求「恰好装满」把初值设成 -inf（0 除外）`,
    pitfalls: [
      "循环方向搞反 = 01 背包变成完全背包，样例还可能刚好过",
      "「恰好装满」和「不超过容量」的初始化不同：前者 -inf，后者 0",
      "两层循环谁在外面也有讲究：求方案数时物品在外、容量在内才是组合数",
    ],
    complexity: "O(件数 × 容量)",
    refs: [
      ["背包 DP", oi("/dp/knapsack/")],
    ],
  },
  "dp-grid": {
    idea: "在网格里从一角走到另一角，且方向单调（只能向下 / 向右）——那就是二维递推，`dp[i][j]` 只依赖上方和左方。方向不单调（能四向走）就不是 DP 而是 BFS。",
    template: `dp = [[0] * n for _ in range(m)]
for i in range(m):
    for j in range(n):
        if 障碍: dp[i][j] = 0; continue
        if i == 0 and j == 0: dp[i][j] = 起点值; continue
        up = dp[i-1][j] if i else 无效值
        left = dp[i][j-1] if j else 无效值
        dp[i][j] = 合并(up, left) + g[i][j]

# 可以压成一维：dp[j] 复用，天然就是「上方」，dp[j-1] 是「左方」`,
    pitfalls: ["第一行 / 第一列要单独处理，别用统一公式越界", "有障碍时初始化要在遇到障碍处截断，后面全是 0"],
    complexity: "O(mn)，压维后空间 O(n)",
    refs: [
      ["动态规划基础", oi("/dp/basic/")],
    ],
  },
  "dp-interval": {
    idea: "`dp[i][j]` 表示区间 `[i, j]` 的答案，转移时枚举「最后处理哪个 / 从哪里劈开」。两种长相：**枚举分割点** `dp[i][k] + dp[k+1][j]`，**区间往里收** `dp[i+1][j-1]`（回文那一族）。循环必须**按区间长度从小到大**，不然依赖的小区间还没算。",
    template: `# 按区间长度递增；或者 i 倒序、j 正序，效果一样
for length in range(2, n + 1):
    for i in range(n - length + 1):
        j = i + length - 1
        for k in range(i, j):            # 枚举分割点
            dp[i][j] = max(dp[i][j], dp[i][k] + dp[k+1][j] + 合并代价(i, k, j))

# 戳气球那类「最后戳哪个」：把 k 当成区间里最后被处理的，两边就独立了
dp[i][j] = max(dp[i][k] + dp[k][j] + val[i]*val[k]*val[j] for k in range(i+1, j))`,
    pitfalls: [
      "循环顺序错了就会读到未初始化的值——先短区间后长区间是硬要求",
      "「枚举最后处理谁」往往比「枚举先处理谁」好写，因为处理完两边才独立",
      "边界常需要在两端加虚拟元素（如两个 1），省掉大量特判",
    ],
    complexity: "O(n³)，所以数据范围通常 n <= 300~500",
    refs: [
      ["区间 DP", oi("/dp/interval/")],
    ],
  },
  "dp-tree": {
    idea: "在树上做「选 / 不选」的决策：后序遍历，每个节点向父亲返回**多个状态**（选它的最优值、不选它的最优值），父亲据此合并。这就是后序遍历 + DP 状态。",
    template: `def dfs(node):
    """返回 (选这个节点的最优值, 不选的最优值)"""
    if not node: return 0, 0
    l_take, l_skip = dfs(node.left)
    r_take, r_skip = dfs(node.right)
    take = node.val + l_skip + r_skip            # 选它 => 儿子都不能选
    skip = max(l_take, l_skip) + max(r_take, r_skip)   # 不选它 => 儿子随意
    return take, skip

return max(dfs(root))`,
    pitfalls: ["返回元组而不是单值，是树形 DP 和普通递归最直观的区别", "「不选当前」时儿子是「选或不选取最大」，不是「必须选」"],
    complexity: "O(n × 状态数)",
    refs: [
      ["树形 DP", oi("/dp/tree/")],
    ],
  },
  "dp-bitmask": {
    idea: "把「哪些元素已经用过」这个集合压成一个整数当下标。触发条件很明确：**n ≤ 20 左右**，而且要在整个集合上做划分 / 全覆盖 / 排列决策。看到这个数据范围基本就是它。",
    template: `# dp[mask] = 用掉 mask 这些元素时的最优值
dp = [inf] * (1 << n)
dp[0] = 0
for mask in range(1 << n):
    if dp[mask] == inf: continue
    for i in range(n):
        if mask >> i & 1: continue        # i 已经用过
        nxt = mask | 1 << i
        dp[nxt] = min(dp[nxt], dp[mask] + cost(mask, i))
return dp[(1 << n) - 1]                   # 全选满

# 记忆化写法更好想：@cache def dfs(mask, ...)`,
    pitfalls: ["`1 << i` 的优先级低于 `+`，表达式里记得加括号", "n 到 20 就是 100 万状态，每个状态的转移要控制在 O(n)", "要求「返回所有方案」时状压帮不上忙，那是回溯"],
    complexity: "O(2^n × n)，n=20 时约 2×10^7",
    refs: [
      ["状压 DP", oi("/dp/state/")],
      ["状态压缩", oi("/math/binary-set/")],
    ],
  },
  "dp-machine": {
    idea: "把「当前处于哪个阶段」显式写进状态：持有 / 不持有股票、已用几次交易、冷冻期还剩几天。画一张状态转移图，边就是转移方程。股票问题全族都是这个模型。",
    template: `# 买卖股票（含冷冻期）：hold=持有，sold=刚卖出，rest=空仓可买
hold, sold, rest = -inf, -inf, 0
for p in prices:
    hold, sold, rest = max(hold, rest - p), hold + p, max(rest, sold)
return max(sold, rest)`,
    pitfalls: ["同一轮里各状态必须用上一轮的值，Python 的同时赋值正好满足", "初值要用 -inf 表示「不可能」，用 0 会得到错误的最优解"],
    complexity: "O(n × 状态数)",
    refs: [
      ["动态规划基础", oi("/dp/basic/")],
      ["有限状态自动机", oi("/misc/fsm/")],
    ],
  },
  "dp-digit": {
    idea: "统计「区间 [0, N] 内满足某数位性质的数有多少个」。按位从高到低填，状态里带三个东西：填到第几位、是否仍贴着上界（limit）、前面是否全是前导零（zero）。",
    template: `s = str(N)

@cache
def dfs(i, 自定义状态, limit, zero):
    if i == len(s): return 1 if 合法 else 0
    res = 0
    up = int(s[i]) if limit else 9        # 贴着上界时这一位不能超
    for d in range(0 if not zero else 0, up + 1):
        res += dfs(i + 1, 新状态, limit and d == up, zero and d == 0)
    return res`,
    pitfalls: ["limit 和 zero 必须进状态，否则缓存会串", "求 [L, R] 用 f(R) - f(L-1)"],
    complexity: "O(位数 × 状态数 × 10)",
    refs: [
      ["数位 DP", oi("/dp/number/")],
    ],
  },
  "graph-basic": {
    idea: "第一步永远是建图：把题面的关系翻译成邻接表。然后再问「有没有环」「连不连通」「有没有方向」——这些决定了后面用什么算法。",
    template: `g = [[] for _ in range(n)]           # 邻接表；稠密图才考虑邻接矩阵
for u, v, w in edges:
    g[u].append((v, w))
    g[v].append((u, w))                  # 无向图才加这一行

# 节点编号从 1 开始时开 n+1，别在下标上省事`,
    pitfalls: ["有向 / 无向弄错是最常见的错，建图时就要确认", "节点编号 0-based 还是 1-based，全程统一"],
    complexity: "建图 O(V + E)，空间 O(V + E)",
    refs: [
      ["图论基础", oi("/graph/concept/")],
      ["图的存储", oi("/graph/save/")],
    ],
  },
  "topo": {
    idea: "有向图上求一个满足所有依赖的顺序。Kahn 算法：统计入度，把入度为 0 的入队，出队时把邻居入度减一、减到 0 就入队。**出队总数 < n 就说明有环**——所以拓扑排序同时也是有向图判环的标准手段。",
    template: `indeg = [0] * n
for u, v in edges:                       # u -> v，做 v 前必须先做 u
    g[u].append(v); indeg[v] += 1

q = deque(i for i in range(n) if indeg[i] == 0)
order = []
while q:
    u = q.popleft()
    order.append(u)
    for v in g[u]:
        indeg[v] -= 1
        if indeg[v] == 0: q.append(v)

return order if len(order) == n else []  # 长度不足 => 有环`,
    pitfalls: ["边的方向：「先修课 a 才能上 b」是 a -> b，反了结果就反了", "别忘了最后用长度判环", "要求字典序最小的拓扑序时把队列换成堆"],
    complexity: "O(V + E)",
    refs: [
      ["拓扑排序", oi("/graph/topo/")],
    ],
  },
  "shortest-path": {
    idea: "按边权选算法，别硬套：**无权用 BFS**；**非负权用 Dijkstra**（堆优化）；**有负权用 Bellman-Ford / SPFA**；**要所有点对且 n 小用 Floyd**。Dijkstra 遇到负权会给出错误答案，这是面试常问的点。",
    template: `# Dijkstra（堆优化 + 懒删除）
import heapq
dis = [inf] * n
dis[src] = 0
h = [(0, src)]
while h:
    d, u = heapq.heappop(h)
    if d > dis[u]: continue              # 过期的旧记录，跳过（懒删除）
    for v, w in g[u]:
        if d + w < dis[v]:
            dis[v] = d + w
            heapq.heappush(h, (dis[v], v))

# Floyd：三重循环，k 必须在最外层
for k in range(n):
    for i in range(n):
        for j in range(n):
            d[i][j] = min(d[i][j], d[i][k] + d[k][j])`,
    pitfalls: [
      "Dijkstra 不能处理负权边",
      "Floyd 的 k 循环必须在最外层，否则答案不对",
      "堆里的过期记录要用 `if d > dis[u]: continue` 跳过，不然复杂度退化",
    ],
    complexity: "Dijkstra O(E log V)；Floyd O(V³)；Bellman-Ford O(VE)",
    refs: [
      ["最短路", oi("/graph/shortest-path/")],
    ],
  },
  "union-find": {
    idea: "回答「这两个点连没连上」。两个优化必须都写：**路径压缩**（查的时候顺手把整条链挂到根）和**按大小合并**。加上之后单次操作近似 O(1)。它只能合并、不能分裂，所以「删边」类问题要倒着处理。",
    template: `fa = list(range(n))
size = [1] * n

def find(x):
    while fa[x] != x:
        fa[x] = fa[fa[x]]        # 路径压缩（一次跳两级，写法最短）
        x = fa[x]
    return x

def union(a, b) -> bool:
    ra, rb = find(a), find(b)
    if ra == rb: return False    # 本来就连着 => 这条边成环
    if size[ra] < size[rb]: ra, rb = rb, ra
    fa[rb] = ra
    size[ra] += size[rb]
    return True`,
    pitfalls: [
      "合并时要合并**根**，写成 `fa[a] = b` 是错的",
      "union 的返回值很有用：False 说明这条边多余（冗余连接、Kruskal 判环）",
      "只支持合并不支持删除，删边问题要离线倒序",
    ],
    complexity: "近似 O(1)（严格是反阿克曼函数）",
    refs: [
      ["并查集", oi("/ds/dsu/")],
    ],
  },
  "graph-advanced": {
    idea: "最小生成树（Kruskal = 排序边 + 并查集判环）、强连通分量（Tarjan）、二分图判定（染色 / BFS 交替上色）、网络流（最大流最小割）。面试出现频率低，但一旦出现就是拉开差距的地方。",
    template: `# Kruskal：边按权排序，能合并就要
edges.sort(key=lambda e: e[2])
total = 0
for u, v, w in edges:
    if union(u, v): total += w   # union 返回 False 说明会成环

# 二分图染色
color = [0] * n
def dfs(u, c):
    color[u] = c
    return all(color[v] != c and (color[v] or dfs(v, -c)) for v in g[u])`,
    complexity: "Kruskal O(E log E)；Tarjan O(V + E)",
    refs: [
      ["最小生成树", oi("/graph/mst/")],
      ["强连通分量", oi("/graph/scc/")],
      ["二分图", oi("/graph/bi-graph/")],
      ["网络流", oi("/graph/flow/")],
    ],
  },
  "greedy-basic": {
    idea: "每步取局部最优，且能证明整体也最优。证明常用**交换论证**：假设最优解和贪心第一次不同，把那一步换成贪心的选法，答案不会变差。证不出来就别用——贪心错了样例往往还能过。",
    pitfalls: ["先证明再写；写完拿反例试一下「局部最优是否会毁掉后面」", "「最少几步」类题目要区分是贪心还是 BFS：状态有分支就是 BFS"],
    complexity: "通常 O(n log n)（排序主导）",
    refs: [
      ["贪心", oi("/basic/greedy/")],
    ],
  },
  "greedy-interval": {
    idea: "区间贪心的口诀：**要选最多不重叠区间，按右端点排序**（右端点越早结束，留给后面的空间越大）；**要用最少区间覆盖，按左端点排序**后每次跳最远。排序关键字选错，整题就错。",
    template: `# 最多不重叠区间数（等价于「最少删几个使不重叠」）
iv.sort(key=lambda x: x[1])      # 按右端点
cnt, end = 0, -inf
for l, r in iv:
    if l >= end:                 # 端点相接算不算重叠，看题面
        cnt += 1
        end = r`,
    pitfalls: ["按左端点排会得到错误答案，这是区间贪心最经典的坑", "`l >= end` 还是 `l > end`，取决于端点相接是否视为重叠"],
    complexity: "O(n log n)",
    refs: [
      ["贪心", oi("/basic/greedy/")],
    ],
  },
  "greedy-heap": {
    idea: "**反悔贪心**：先无脑全都要，一旦超出限制，就用堆把「最差的那个决定」退掉。适用于「选 k 个使总和最大 / 任务调度」这类，比直接想清楚顺序容易得多。",
    template: `# 任务调度：按截止时间排序，先都做；超时就退掉耗时最长的那个
h = []
cur = 0
for cost, deadline in sorted(tasks, key=lambda t: t[1]):
    heapq.heappush(h, -cost); cur += cost
    if cur > deadline:           # 超了，反悔：退掉最贵的
        cur += heapq.heappop(h)  # 存的是负数，加即减
return len(h)`,
    pitfalls: ["反悔时退掉的是「已选集合里最差的」，不一定是刚加进来的那个"],
    complexity: "O(n log n)",
    refs: [
      ["贪心", oi("/basic/greedy/")],
      ["堆", oi("/ds/heap/")],
    ],
  },
  "construct": {
    idea: "要求给出一个满足条件的方案（而不是最优值）。做法通常是找规律 + 归纳：先手玩 n=1,2,3，猜出构造方式，再证明它对任意 n 都成立。无解时要能说清为什么。",
    pitfalls: ["先判无解条件（奇偶性、总和、上下界），再构造", "构造题的样例往往不唯一，别对着样例硬凑"],
    refs: [
      ["构造", oi("/basic/construction/")],
    ],
  },
  "number-theory": {
    idea: "面试够用的就四件：埃氏筛（求范围内所有质数）、GCD / 裴蜀定理、快速幂（配合取模）、乘法逆元（除法转乘法）。认出来是哪一条，题基本就做完了。",
    template: `# 埃氏筛：从 i*i 开始标记，外层只需到 sqrt(n)
is_p = [True] * (n + 1)
is_p[0] = is_p[1] = False
for i in range(2, int(n ** 0.5) + 1):
    if is_p[i]:
        for j in range(i * i, n + 1, i):     # 从 i*i 起，小的已被更小的质数标记过
            is_p[j] = False

# 快速幂（取模）
def qpow(a, b, mod):
    res = 1
    while b:
        if b & 1: res = res * a % mod
        a = a * a % mod
        b >>= 1
    return res

import math; math.gcd(a, b)      # 别手写，除非要扩展欧几里得
pow(a, mod - 2, mod)             # 费马小定理求逆元（mod 为质数）`,
    pitfalls: ["筛法内层从 `i*i` 开始，从 `2*i` 开始会重复很多次", "取模要边算边取，别等到最后", "逆元用费马小定理的前提是模数为质数且 a 不是模数的倍数"],
    complexity: "埃氏筛 O(n log log n)；快速幂 O(log b)；GCD O(log min(a,b))",
    refs: [
      ["筛法", oi("/math/number-theory/sieve/")],
      ["GCD", oi("/math/number-theory/gcd/")],
      ["快速幂", oi("/math/binary-exponentiation/")],
      ["逆元", oi("/math/number-theory/inverse/")],
    ],
  },
  "combinatorics": {
    idea: "计数题的三件工具：组合数（杨辉三角递推或阶乘 + 逆元）、容斥原理（正难则反，加加减减）、卡特兰数（合法括号序列 / 出栈序列的个数）。「答案取模 1e9+7」几乎总是在提示这一族。",
    template: `# 杨辉三角预处理组合数（n 不大时最省心）
C = [[0] * (n + 1) for _ in range(n + 1)]
for i in range(n + 1):
    C[i][0] = 1
    for j in range(1, i + 1):
        C[i][j] = (C[i-1][j-1] + C[i-1][j]) % MOD

# n 大时用阶乘 + 逆元
fac = [1] * (n + 1)
for i in range(1, n + 1): fac[i] = fac[i-1] * i % MOD
comb = fac[n] * pow(fac[k] * fac[n-k] % MOD, MOD - 2, MOD) % MOD`,
    pitfalls: ["减法取模后可能为负，要 `(x % MOD + MOD) % MOD`", "容斥的符号规律是 (-1)^(集合大小+1)，写错就全错"],
    complexity: "预处理 O(n²) 或 O(n)，单次查询 O(1) / O(log MOD)",
    refs: [
      ["组合数", oi("/math/combinatorics/combination/")],
      ["容斥原理", oi("/math/combinatorics/inclusion-exclusion-principle/")],
      ["卡特兰数", oi("/math/combinatorics/catalan/")],
    ],
  },
  "geometry": {
    idea: "面试里的几何基本只到：叉积判方向（`cross > 0` 表示逆时针）、两点距离（比较大小时用平方，避免开方误差）、矩形是否相交（按维度分别判）。凸包用 Andrew 单调链。",
    template: `def cross(o, a, b):     # OA × OB，>0 逆时针，=0 共线
    return (a[0]-o[0]) * (b[1]-o[1]) - (a[1]-o[1]) * (b[0]-o[0])

# 比较距离时不要开方
d2 = (x1-x2)**2 + (y1-y2)**2`,
    pitfalls: ["浮点比较要带 eps，能用整数就全程整数", "共线（叉积为 0）的处理决定凸包是否包含边上的点"],
    complexity: "凸包 O(n log n)",
    refs: [
      ["二维计算几何", oi("/geometry/2d/")],
      ["凸包", oi("/geometry/convex-hull/")],
    ],
  },
  "probability": {
    idea: "两类：**算概率 / 期望**（期望的线性性最有用：总期望 = 各部分期望之和，倒推常比正推容易）和**随机化**（洗牌要用 Fisher-Yates，按权重抽样用前缀和 + 二分）。",
    template: `# Fisher-Yates 洗牌：从后往前，和 [0, i] 里随机一个交换
for i in range(n - 1, 0, -1):
    j = random.randint(0, i)     # 上界必须含 i，写成 i-1 就不均匀了
    a[i], a[j] = a[j], a[i]

# 按权重随机：前缀和 + 二分
pre = list(itertools.accumulate(w))
idx = bisect_left(pre, random.uniform(0, pre[-1]))`,
    pitfalls: ["洗牌的随机上界要含当前下标，否则分布不均匀", "期望题优先考虑倒推（从终止状态往回）"],
    complexity: "洗牌 O(n)；按权重抽样 O(log n)",
    refs: [
      ["概率基础", oi("/math/probability/basic-conception/")],
      ["期望与方差", oi("/math/probability/exp-var/")],
      ["概率 DP", oi("/dp/probability/")],
    ],
  },
  "game-theory": {
    idea: "双方轮流且都走最优。小规模直接记忆化搜「当前局面是否必胜」；能拆成独立子游戏时用 SG 函数（异或和为 0 即先手必败）。Nim 游戏就是「所有堆异或为 0 则先手败」。",
    template: `@cache
def win(state) -> bool:
    """当前轮到的人是否必胜：存在一个后继让对手必败，就必胜"""
    return any(not win(nxt) for nxt in moves(state))

# Nim：各堆石子数异或
return reduce(xor, piles) != 0`,
    pitfalls: ["「必胜」的定义要以「当前行动方」为准，中途换视角就乱了", "SG 定理的前提是各子游戏相互独立"],
    complexity: "记忆化 O(状态数 × 分支)；SG 取决于子游戏规模",
    refs: [
      ["博弈论入门", oi("/math/game-theory/intro/")],
      ["公平组合游戏", oi("/math/game-theory/impartial-game/")],
    ],
  },
  "segment-tree": {
    idea: "既要**区间修改**又要**区间查询**时用它。核心是懒标记（lazy）：改区间时只在覆盖节点上打个标记，等真要往下走时再下推。只需要「单点改 + 区间和」的话，树状数组更短更快。",
    template: `# 数组式建树：节点 o 管区间 [l, r]，左右儿子是 2o 和 2o+1
def build(o, l, r):
    if l == r: t[o] = a[l]; return
    m = (l + r) // 2
    build(2*o, l, m); build(2*o+1, m+1, r)
    t[o] = t[2*o] + t[2*o+1]

def push_down(o, l, r):          # 懒标记下推，改和查之前都要先推
    if lazy[o]:
        ...  # 把标记作用到两个儿子，并清空自己

def query(o, l, r, ql, qr):
    if ql <= l and r <= qr: return t[o]      # 完全覆盖，直接用
    push_down(o, l, r)
    ...`,
    pitfalls: ["数组要开 4n，开 2n 会越界", "递归进儿子之前必须 push_down", "「完全覆盖就返回」是复杂度保证，不能改成逐点递归"],
    complexity: "建树 O(n)，单次修改 / 查询 O(log n)，空间开 4n",
    refs: [
      ["线段树", oi("/ds/seg/")],
    ],
  },
  "fenwick": {
    idea: "单点修改 + 前缀和查询的最短实现，核心就是 `lowbit = i & -i`。**下标必须从 1 开始**。求逆序对、动态排名（配离散化）都用它。",
    template: `tree = [0] * (n + 1)             # 1-based！

def update(i, v):                # 下标 i 加上 v
    while i <= n:
        tree[i] += v
        i += i & -i              # 跳到管辖自己的父节点

def query(i):                    # 前缀 [1, i] 的和
    s = 0
    while i > 0:
        s += tree[i]
        i -= i & -i              # 跳到前一个不重叠的区间
    return s

# 区间 [l, r] = query(r) - query(l - 1)`,
    pitfalls: ["下标 0 会让 `i & -i` 恒为 0 而死循环，必须 1-based", "值域大时先离散化再用", "要区间修改 + 区间查询就得上线段树或双树状数组"],
    complexity: "单次 O(log n)，空间 O(n)",
    refs: [
      ["树状数组", oi("/ds/fenwick/")],
    ],
  },
  "balanced-tree": {
    idea: "要动态维护有序集合并支持「第 k 大 / 某数的排名」。竞赛里常用 Treap / Splay；面试里通常用语言自带的有序容器，或者「离散化 + 权值线段树 / 树状数组上二分」绕过手写平衡树。",
    complexity: "期望 O(log n)",
    refs: [
      ["Treap", oi("/ds/treap/")],
      ["Splay", oi("/ds/splay/")],
      ["可持久化数据结构", oi("/ds/persistent/")],
    ],
  },
  "suffix": {
    idea: "处理「一个串的所有后缀」：后缀数组 + height 数组能回答大量子串问题，后缀自动机是所有子串的最小自动机。这块面试极少考，属于竞赛内容。",
    complexity: "后缀数组 O(n log n)，SAM O(n)",
    refs: [
      ["后缀数组", oi("/string/sa/")],
      ["后缀自动机", oi("/string/sam/")],
      ["AC 自动机", oi("/string/ac-automaton/")],
    ],
  },
  "ds-design": {
    idea: "设计题先定不变量，再选结构。最常见的组合是**哈希表 + 双向链表**：哈希给 O(1) 定位，链表给 O(1) 移动，合起来就是 LRU。先把接口的复杂度要求写下来，反推该用什么。",
    template: `# LRU：哈希 -> 节点，链表按最近使用排序（头新尾旧）
class Node:
    __slots__ = 'key', 'val', 'prev', 'next'

def get(key):
    if key not in mp: return -1
    node = mp[key]
    remove(node); push_front(node)       # 命中就挪到最前
    return node.val

def put(key, val):
    if key in mp: remove(mp[key])
    node = Node(key, val); mp[key] = node; push_front(node)
    if len(mp) > cap:
        last = tail.prev                 # 淘汰尾部
        remove(last); del mp[last.key]

# 用两个哨兵节点 head / tail，省掉所有空判断`,
    pitfalls: [
      "删除节点时哈希表里的键也要删，否则内存泄漏 + 计数错",
      "用哨兵头尾节点，能消掉几乎所有边界分支",
      "Python 里 `OrderedDict.move_to_end` 可以直接用，但面试通常要求手写",
    ],
    complexity: "各操作 O(1)",
    refs: [
      ["数据结构总览", oi("/ds/")],
      ["链表", oi("/ds/linked-list/")],
    ],
  },
  "data-stream": {
    idea: "数据来一个处理一个，不能回头。求动态中位数用**对顶堆**（大顶堆存较小的一半、小顶堆存较大的一半，两边大小差不超过 1）；求滑动窗口统计用单调队列；求 Top-K 用固定大小的堆。",
    template: `# 对顶堆求中位数：small 是大顶堆（存负数），large 是小顶堆
def add(x):
    heapq.heappush(small, -heapq.heappushpop(large, x))
    if len(small) > len(large):
        heapq.heappush(large, -heapq.heappop(small))

def median():
    if len(large) > len(small): return large[0]
    return (large[0] - small[0]) / 2`,
    pitfalls: ["两个堆的大小关系是不变量，每次插入后都要重新平衡", "先 pushpop 再转移，能保证元素落在正确的那一半"],
    complexity: "插入 O(log n)，取中位数 O(1)",
    refs: [
      ["堆", oi("/ds/heap/")],
    ],
  },
  "iterator": {
    idea: "把「展开 / 生成」推迟到真正取值的时候。实现要点是 `hasNext` 里做预取，并把嵌套结构用显式栈拍平（不能在构造函数里一次性展开，那就失去惰性的意义了）。",
    template: `class FlattenIterator:
    def __init__(self, nested):
        self.st = list(reversed(nested))     # 逆序入栈，弹出顺序才对

    def hasNext(self):
        while self.st and isinstance(self.st[-1], list):
            self.st.extend(reversed(self.st.pop()))   # 展开一层
        return bool(self.st)

    def next(self):
        return self.st.pop() if self.hasNext() else None`,
    pitfalls: ["预取逻辑要放在 hasNext 里，且 next 之前必须先调 hasNext"],
    complexity: "均摊 O(1)",
    refs: [
      ["迭代器", oi("/lang/csl/iterator/")],
    ],
  },
  "concurrency": {
    idea: "按「谁等谁」建模：固定顺序用信号量链（A 放行 B、B 放行 C），交替执行用两个信号量互相唤醒，生产消费用条件变量 + 缓冲区。先画出等待关系图，再翻译成同步原语。",
    template: `from threading import Semaphore
# 顺序打印 first -> second -> third
s2, s3 = Semaphore(0), Semaphore(0)

def first(printFirst):  printFirst(); s2.release()
def second(printSecond): s2.acquire(); printSecond(); s3.release()
def third(printThird):  s3.acquire(); printThird()`,
    pitfalls: ["初值给错会直接死锁：只有第一个环节的信号量初值为 1（或不用等）", "acquire / release 必须成对，异常路径也要释放"],
  },
  "db-shell": {
    idea: "SQL 题的常见套路：分组聚合（GROUP BY + HAVING）、自连接（比较同表不同行）、窗口函数（RANK / ROW_NUMBER 求组内排名）、以及用 LEFT JOIN 找「不存在的记录」。",
    template: `-- 组内排名取前 N：窗口函数最直接
SELECT * FROM (
  SELECT *, DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM emp
) t WHERE rk <= 3;

-- 找「没有下单的用户」：LEFT JOIN + IS NULL
SELECT u.name FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.id IS NULL;`,
    pitfalls: ["RANK 会跳号、DENSE_RANK 不跳号、ROW_NUMBER 强制唯一，按题意选", "HAVING 作用在聚合后，WHERE 在聚合前"],
  },
};
