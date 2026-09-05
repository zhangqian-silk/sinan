"""从题面本身推解法 —— 不看别人的题解，自己读题。

为什么要有这一层：题解代码告诉你「别人怎么做的」，题面告诉你「这题在考什么」。
两者不是一回事 ——

  * 高赞题解只会贴最优解，可行的其它解法（能过的暴力、能过的 O(n^2) DP）看不见；
  * 854 道题（会员题、冷门题）根本没有题解代码可抓；
  * 更重要的是：**数据范围本身就是提示**。n <= 16 摆明了让你状压，
    n <= 300 摆明了留给 O(n^3) 的区间 DP，n <= 1e5 就把二维 DP 排除了。
    这条推理跟任何人的题解都无关，是竞赛里最基本的读题动作。

所以这里做三件事：

  1. 读**问法**：「使最大值最小」→ 二分答案；「返回所有组合」→ 回溯；
     「下一个更大元素」→ 单调栈。问法是出题人给的最直接的信号。
  2. 读**数据范围**：换算出允许的复杂度，据此放大或否掉候选解法。
  3. 读**输入结构**：TreeNode / ListNode / grid / edges 决定了大方向。

每条结论都带一句人话理由（``why``），因为「凭什么这么打标」必须能当场验证。
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

# --- 题面清洗 ------------------------------------------------------------------

SUP = re.compile(r"<sup>\s*([^<]*?)\s*</sup>")
SUB = re.compile(r"<sub>\s*([^<]*?)\s*</sub>")
TAG = re.compile(r"<[^>]+>")


def to_text(content: str) -> str:
    """题面 HTML -> 纯文本。指数要保住：10<sup>5</sup> 得变成 10^5，不能变成 "10 5"。"""
    s = content or ""
    s = SUP.sub(r"^\1", s)
    s = SUB.sub(r"_\1", s)
    s = TAG.sub(" ", s)
    s = html.unescape(s)
    return re.sub(r"[ \t\u00a0]+", " ", s)


def split_sections(text: str) -> tuple[str, str]:
    """切成「题干（含示例）」和「提示（数据范围）」两段，两段的读法不一样。"""
    for marker in ("提示：", "提示:", "Constraints:"):
        i = text.find(marker)
        if i > 0:
            return text[:i], text[i:]
    return text, ""


# --- 数据范围 ------------------------------------------------------------------

SIZE_VAR = re.compile(
    r"^(n|m|len|length|size|numsSize"
    r"|\w+\s*\.\s*(length|size)(\s*\(\s*\))?"
    r"|len\s*\(\s*\w+\s*\)"
    r"|\w+\s*\[\s*i\s*\]\s*\.\s*length)$", re.I)
VALUE_VAR = re.compile(
    r"^(\w+\s*\[\s*[ij]\s*\]|target|amount|sum|total|val|value|w|weight|cost|price|time)$", re.I)

# 提示区经常是一整行 "1 <= nums.length <= 10^4 1 <= nums[i] <= 10^9"，
# 用一个大正则去套会在 "10^4 1" 这种相邻数字处截断，所以改成先分词、再按运算符串链。
# 注意 5 * 10^4 必须整体当成一个数：漏了这条会把 nums.length <= 5 * 10^4 读成 <= 5，
# 于是「排序数组」「接雨水」这些题都会被当成 n 很小、可以状压 —— 一处解析错，全线错。
TOKEN = re.compile(r"(<=|>=|==|<|>)|("
                   r"\d+\s*\*\s*\d+\s*\^\s*\d+"
                   r"|\d+\s*\^\s*\d+(?:\s*[-+]\s*\d+)?"
                   r"|[\w\.\[\]]+(?:\s*\(\s*\)|\(\s*\w+\s*\))?)")


def _num(tok: str) -> int | None:
    """把 '10^5'、'2^31 - 1'、'1000' 换成整数；换不了返回 None。"""
    t = (tok or "").strip().replace(" ", "")
    if not t:
        return None
    m = re.fullmatch(r"(\d+)\*(\d+)\^(\d+)", t)          # 5 * 10^4
    if m:
        return int(m.group(1)) * int(m.group(2)) ** int(m.group(3))
    m = re.fullmatch(r"(\d+)\^(\d+)(?:([-+])(\d+))?", t)
    if m:
        v = int(m.group(1)) ** int(m.group(2))
        if m.group(3) == "-":
            v -= int(m.group(4))
        elif m.group(3) == "+":
            v += int(m.group(4))
        return v
    return int(t) if re.fullmatch(r"\d+", t) else None


@dataclass
class Limits:
    size: int | None = None      # 输入规模上界
    value: int | None = None     # 元素值上界
    raw: list[str] = field(default_factory=list)

    @property
    def budget(self) -> str:
        """规模换算成「能跑什么复杂度」。"""
        n = self.size
        if n is None:
            return "unknown"
        if n <= 22:
            return "exp"          # 2^n 可以，随便指数级
        if n <= 45:
            return "half"         # 2^(n/2)，折半搜索
        if n <= 120:
            return "cubic"        # O(n^3)：区间 DP、Floyd
        if n <= 1200:
            return "quad"         # O(n^2)：二维 DP
        if n <= 20000:
            return "quad-ish"
        return "linear"           # 只剩 O(n) / O(n log n)


def _chains(text: str) -> list[list[str]]:
    """把提示区切成一条条比较链：['1', '<=', 'nums.length', '<=', '10^4']。

    两个非运算符 token 挨在一起（"10^4" 后面又跟 "1"）就说明上一条链结束了。
    """
    out: list[list[str]] = []
    cur: list[str] = []
    prev_was_op = True
    for m in TOKEN.finditer(text):
        op, word = m.group(1), m.group(2)
        if op:
            if not cur:            # 链不能以运算符开头
                continue
            cur.append(op)
            prev_was_op = True
            continue
        if not prev_was_op and cur:  # 连着两个变量/数字 => 换链
            out.append(cur)
            cur = []
        cur.append(word.strip())
        prev_was_op = False
    if cur:
        out.append(cur)
    return [c for c in out if len(c) >= 3]


def parse_limits(hint_text: str) -> Limits:
    """从提示区抽数据范围。只认「变量 <= 数」这种直接约束，读不出来就留空 —— 宁缺勿错。"""
    lim = Limits()
    sizes: list[int] = []
    values: list[int] = []
    for chain in _chains(hint_text):
        # 只处理递增方向的链（a <= b <= c），> 号的链跳过，免得把下界当上界
        if any(op in (">", ">=") for op in chain[1::2]):
            continue
        for i, tok in enumerate(chain[::2]):
            if _num(tok) is not None:
                continue
            upper = next((v for v in (_num(t) for t in chain[2 * i + 2::2]) if v is not None), None)
            if upper is None:
                continue
            if SIZE_VAR.match(tok):
                sizes.append(upper)
                lim.raw.append(f"{tok} <= {upper}")
            elif VALUE_VAR.match(tok):
                values.append(upper)
    if sizes:
        lim.size = max(sizes)
    if values:
        lim.value = max(values)
    return lim


# --- 问法 ----------------------------------------------------------------------
# (思路 id, 正则, 强度, 为什么)
# 强度 = 「看到这种问法，这题多大概率真这么解」。只收有辨识度的问法：
# 泛泛的「求最大值」不写，写了等于没写，还会把相似度搅浑。
PHRASE_PROBES: tuple[tuple[str, str, float, str], ...] = (
    ("binary-search-answer", r"最大值\s*最小|最小值\s*最大|最小化.{0,6}最大|最大化.{0,6}最小"
                             r"|使得?.{0,12}最大值.{0,4}最小|minimi[sz]e the max", 0.9,
     "问的是「最大值最小 / 最小值最大」，判定单调 → 二分答案"),
    # 这一条只认「阈值型」问法：要求的是一个速率 / 容量 / 期限，check 一下就知道够不够。
    # 「最少需要几次操作」「最小值」这种不能算 —— 前者绝大多数是贪心 / BFS / DP，
    # 后者几乎每道题都会出现。宁可漏，不能把整个专题冲淡。
    ("binary-search-answer", r"(速度|容量|载重|运载能力|运力|吞吐|带宽|工作量|每天.{0,4}(数量|个数)).{0,6}最(小|低|少)"
                             r"|最(小|低|少)的?\s*(速度|容量|载重|运载能力|运力|吞吐|带宽|阈值|天数)"
                             r"|(能否|可以|必须)在\s*\w{0,4}\s*(小时|天|次|个月|分钟)内.{0,12}(完成|吃|运|读|搬|制造|修)", 0.6,
     "问的是「多快 / 多大的容量才够」这种阈值，check 一下就知道够不够 → 二分答案"),
    # 滑动窗口的成立条件是「窗口两端单调移动」，所以只认三种问法：
    #   ① 最长 / 最短的子串或子数组（回文除外：扩了不能缩，那是中心扩展 / 区间 DP）
    #   ② 带「至多 / 恰好 K 个不同」这类单调约束
    #   ③ 定长窗口
    # 特意不收「连续子数组」四个字：最大子数组和也这么说，但那题有负数、窗口不单调，
    # 是 Kadane 递推。也不收「不含重复」：全排列的输入描述里就有「不含重复数字」。
    # 例外里除了回文，还得排掉「最长有效括号」：括号的合法性不是单调的，
    # 窗口右扩后左边不能靠收缩恢复合法，所以那题是栈 / DP 而不是滑窗。
    ("sliding-window", r"最长(?!.{0,4}回文)(?!.{0,6}有效括号).{0,8}子串"
                       r"|最短(?!.{0,4}回文).{0,8}子串"
                       r"|恰好.{0,6}个不同|至多.{0,4}个不同|至多包含.{0,6}个"
                       r"|无重复字符|长度为\s*k\s*的?(连续)?子数组", 0.72,
     "求「连续的子串 / 子数组」，两端单调移动 → 滑动窗口"),
    # 「最长/最短子数组」只能算弱信号：约束单调（和 >= target）时是滑窗，
    # 约束不单调（0 和 1 数量相同）时其实是前缀和 + 哈希，光看问法分不出来，
    # 所以给低强度，让它出现但不占主位。
    ("sliding-window", r"(最长|最短|最小长度|长度最小|长度最短).{0,8}(连续)?子数组", 0.5,
     "求「最长 / 最短的连续子数组」，约束单调的话就是滑动窗口"),
    ("dp-sequence", r"子序列", 0.5, "「子序列」可以不连续，一般按位置做 DP → 序列 DP"),
    ("dp-lis", r"最长\s*(严格)?(递增|上升|递减|下降).{0,4}子序列", 0.9,
     "最长递增子序列的原题形状 → LIS（DP 或贪心 + 二分）"),
    ("dp-lcs", r"最长\s*公共\s*子序列|编辑距离|最少.{0,8}(操作|编辑).{0,8}(相同|转换)", 0.9,
     "两个串对齐着比 → LCS / 编辑距离的二维 DP"),
    ("backtracking", r"返回\s*所有|列出所有|所有可能的?.{0,6}(组合|排列|子集|结果|方案|路径|拆分)"
                     r"|不能包含重复的?(组合|排列|子集)|以任意顺序返回", 0.85,
     "要枚举出所有方案而不是只要个数 → 回溯 + 剪枝"),
    ("bit-enum", r"所有.{0,4}子集|幂集", 0.6, "求所有子集 → 二进制枚举也能做"),
    ("math-combi", r"(有多少|多少种|方案数|种不同的方案).{0,24}(取模|模\s*10\^9|10\^9\s*\+\s*7)", 0.7,
     "求方案数还要取模 → 计数类（组合数学或计数 DP）"),
    # 只说「答案取模」不代表在做组合计数，那只说明要处理同余
    ("math-mod", r"答案.{0,10}(取模|对\s*10\^9)|结果.{0,8}取模|返回.{0,10}取模后", 0.55,
     "答案要取模 → 同余处理（边算边取模，防溢出）"),
    ("dp-1d", r"(有多少种|多少种不同的)\s*(方法|方式|走法|爬法|路径)", 0.6,
     "问「有多少种走法」，从子问题累加 → 线性递推"),
    # 「下一个更大」得是下一个更大的**元素**：「不存在下一个更大的排列」说的是别的事
    ("monotonic-stack", r"下一个\s*(更大|更小|比它大|比它小)的?\s*(元素|数字|温度|值|数|字符)"
                        r"|右边第一个.{0,6}(大|小)|左边第一个.{0,6}(大|小)"
                        r"|接雨水|柱状图.{0,10}最大(的)?矩形|每日温度|下一个更大元素", 0.9,
     "问「右边第一个更大的元素」这类，正是单调栈的定义式用法"),
    ("monotonic-queue", r"滑动窗口.{0,10}最大值|窗口.{0,6}最(大|小)值", 0.85,
     "窗口在滑、还要窗口内最值 → 单调队列"),
    ("heap", r"第\s*k\s*(个)?(大|小|高|多|近|远)|前\s*k\s*个|k\s*个最(大|小|接近|频繁)|top\s*k", 0.7,
     "只要前 k 个而不是全序 → 堆（或快速选择）"),
    ("quickselect", r"第\s*k\s*(个)?(大|小)的?元素", 0.55, "只找第 k 个，不必整体排序 → 快速选择"),
    ("ordered-set", r"(动态|实时|随时).{0,10}(插入|删除|查询).{0,10}(排名|中位数|第 k)"
                    r"|数据流.{0,10}中位数", 0.7,
     "边插边查有序信息 → 有序集合 / 对顶堆"),
    ("prefix-sum", r"(区间|子数组).{0,6}(和|总和)\s*(等于|为|是)|前缀和|区间和"
                   r"|(和|总和)\s*(为|等于)\s*\w{0,4}\s*的?\s*(子数组|子矩阵|连续)"
                   # 「可被 K 整除」要落在子数组上才是前缀和；「可被三整除的最大和」是 DP
                   r"|(子数组|子串|子矩阵).{0,12}可被.{0,6}整除"
                   r"|可被.{0,6}整除的?(子数组|子串)", 0.7,
     "反复问区间和 → 前缀和（配哈希能数「和为 k」）"),
    ("diff-array", r"(区间|范围).{0,8}(同时)?(加|减|增加).{0,8}(操作|次)|航班预订|区间更新", 0.7,
     "对一整段加减、最后才看结果 → 差分数组"),
    ("two-pointers", r"原地|不使用额外(的)?空间|O\(1\)\s*额外|双指针|有序数组.{0,12}两个数", 0.55,
     "要求原地 / O(1) 空间，或在有序数组里凑数 → 双指针"),
    ("fast-slow", r"是否.{0,4}(存在)?环|入环|链表.{0,8}环|中间(的)?节点|倒数第\s*\w+\s*个节点", 0.8,
     "链表判环 / 找中点 / 找倒数第 k 个 → 快慢指针"),
    ("hash", r"两数之和|是否存在.{0,10}重复|出现次数|字母异位词|变位词", 0.5,
     "按值找位置或统计出现次数 → 哈希表"),
    # 「前缀」不能光秃秃地用：「前缀和」里也有它，那是完全不同的技巧
    ("trie", r"前缀(?!和)|字典树|自动补全|以.{0,8}开头的?单词", 0.7, "按前缀检索一批字符串 → 字典树"),
    ("sweep-line", r"重叠(的)?区间|会议室|日程|区间.{0,8}(合并|交集)|最多.{0,8}同时", 0.7,
     "区间起止事件排一起处理 → 扫描线 / 差分事件"),
    # 不要收「尽可能 / 尽量」：题目说明里的「请尝试尽可能多的方法来解题」也会命中，
    # 那是给做题人的话，不是题目的目标函数。
    ("greedy", r"(至少|最少).{0,8}(几|多少).{0,6}(个|次|步|段)"
               r"|尽可能(多|少|大|小).{0,10}(选|取|放|删|移除|合并|分割|覆盖|安排)", 0.4,
     "问「最少几步」且每步有明显最优选择 → 贪心（要能证明）"),
    ("graph-topo", r"先修|前置条件|依赖关系|完成所有课程|构建顺序|拓扑", 0.85,
     "存在「做 A 前必须先做 B」的依赖 → 拓扑排序"),
    ("graph-union-find", r"连通(的)?(块|分量|区域)|同一(个)?集合|合并.{0,6}集合|冗余连接|账户合并", 0.8,
     "反复问「这两个点连没连上」→ 并查集"),
    ("graph-dijkstra", r"(最短|最小).{0,8}(时间|距离|花费|代价|路径|权值)[\s\S]{0,80}?(权重|耗时|花费|距离|时间)"
                       r"|信号.{0,8}传递|概率最大的?路径", 0.7,
     "边带权还要最短路 → Dijkstra（有负权则 Bellman-Ford）"),
    ("graph-bfs", r"最少.{0,8}(步|次转换|次操作).{0,20}(到达|变成|得到)|最短.{0,6}(步数|转换序列)"
                  r"|(最少|最短).{0,8}(经过|穿过).{0,6}(格|房间)", 0.75,
     "每步代价相同、求最少步数 → BFS 分层"),
    ("graph-floyd", r"任意两(点|个节点)(之间)?的?(最短|距离)|所有点对", 0.7, "要所有点对之间的距离 → Floyd"),
    ("graph-bipartite", r"分成两(组|部分|队)|二分图|染色.{0,10}相邻.{0,6}不同", 0.75,
     "要把点分成互不冲突的两组 → 二分图判定"),
    ("tree-postorder", r"(最大|最小)?(深度|高度|直径)|是否(是)?平衡|路径(和|总和)|翻转二叉树|合并二叉树", 0.7,
     "答案要先知道左右子树的结果才能算 → 后序（自底向上）"),
    ("tree-levelorder", r"层序|每(一)?层|逐层|自(顶向下|底向上).{0,6}层|锯齿|之字形|右视图", 0.9,
     "答案是按层组织的 → 层序遍历（BFS）"),
    ("bst-inorder", r"二叉搜索树|BST|搜索树.{0,10}(第 k|中序|有序)", 0.75,
     "二叉搜索树的中序就是升序，很多题吃这个性质"),
    ("tree-lca", r"最近公共祖先|公共祖先|LCA", 0.95, "求最近公共祖先"),
    ("tree-serialize", r"序列化|反序列化|编码.{0,8}解码.{0,8}树", 0.9, "树的序列化 / 反序列化"),
    ("tree-construct", r"(根据|由|从).{0,14}(遍历|序列).{0,8}(构造|还原|重建)", 0.9,
     "由遍历序列反推树形 → 树的构造"),
    ("dp-tree", r"树上.{0,10}(选|不选|最大)|不能同时选.{0,12}(父|相邻).{0,6}节点|监控二叉树|打家劫舍\s*III", 0.8,
     "在树上做「选 / 不选」的决策 → 树形 DP"),
    ("graph-dfs", r"岛屿|相邻的?(陆地|格子).{0,12}(连成|相连)|被围绕的区域|飞地|感染|腐烂|省份", 0.8,
     "在网格 / 图里扩散、数连通块 → DFS（BFS 也行）"),
    ("dp-2d", r"(左上角|起点).{0,24}(右下角|终点)|只能(向下|向右)|三角形.{0,10}最小路径", 0.8,
     "在网格里从一角走到另一角、方向单调 → 网格 DP"),
    # 回文链表没法中心扩展（链表不能往左走），那题走的是快慢指针 + 反转
    # 只有「去找回文」才用得上中心扩展；「验证是不是回文」是双指针，「回文数」是数位处理
    ("palindrome-center", r"(最长|统计|多少个|所有|分割|计算).{0,10}回文(?!子序列)(?!链表)"
                          r"|回文(子串|子数组)(?!的?个数不)", 0.6, "要去找回文，天然从中心往两边扩"),
    ("dp-interval", r"回文\s*子序列|戳(破)?气球|移除盒子|合并.{0,8}(石头|区间).{0,10}代价", 0.8,
     "在一段区间里枚举「最后处理哪个」→ 区间 DP"),
    ("string-match", r"子串.{0,8}(第一次)?出现的?(位置|下标)|实现\s*strStr|模式串|字符串匹配", 0.6,
     "在长串里定位模式串 → 字符串匹配（KMP / 哈希）"),
    # 中文子串碰撞的重灾区：「元素数目」里有「素数」，「符合数量」里有「合数」。
    # 两个字的术语一律要带断言或上下文。
    ("math-sieve", r"质数|(?<!元)素数(?!目)|因数分解|(是|个|求|判断|所有)合数|合数的?(个数|数量)", 0.7,
     "跟质数有关，多半要筛"),
    ("math-gcd", r"最大公约数|最小公倍数|互质|gcd", 0.8, "涉及 GCD / 互质"),
    # 「幂」单字会命中「幂集」，那是子集枚举，不是快速幂
    ("math-fast-pow", r"计算\s*x\s*的\s*n\s*次|快速幂|次幂|幂次|幂运算|幂模|次方.{0,12}取模", 0.7,
     "求幂且指数大 → 快速幂"),
    ("math-xor", r"异或|只出现一次|出现一次的?数字|二进制中\s*1\s*的个数", 0.75, "异或 / 位计数的性质题"),
    ("math-moore", r"多数元素|众数.{0,12}(超过|大于).{0,10}(一半|n\s*/\s*2)|出现次数.{0,6}超过.{0,8}一半", 0.8,
     "「出现次数超过一半」是摩尔投票的招牌条件"),
    ("math-game", r"先手|后手|必胜|轮流|游戏.{0,12}(最优|赢)", 0.85, "双方轮流且都走最优 → 博弈"),
    # 「期望」要排掉判题模板里的「期望答案 / 期望输出」，那是给测试用的话
    ("dp-prob", r"概率|数学期望|期望(?!答案|输出|结果|长度|的长度|函数|数组|值为)", 0.7, "求概率 / 期望"),
    ("math-geometry", r"平面上.{0,10}点|直角坐标|欧(几里得|氏)距离|斜率|凸包|圆心"
                      r"|(矩形|三角形|多边形).{0,10}(相交|重叠)", 0.6, "平面几何"),
    ("segment-tree", r"(单点|区间).{0,6}(更新|修改)[\s\S]{0,60}?(区间|范围).{0,8}(查询|求和|最值)"
                     r"|(区间|范围).{0,8}(查询|求和)[\s\S]{0,60}?(单点|区间).{0,6}(更新|修改)", 0.8,
     "既要改又要查区间 → 线段树 / 树状数组"),
    ("fenwick", r"逆序对|比它小的?元素的?个数|右侧小于当前", 0.75,
     "统计「前面有多少个比我小」→ 树状数组（或归并）"),
    ("merge-sort", r"逆序对|翻转对", 0.7, "逆序对也能在归并的合并过程里顺手数出来"),
    ("design", r"设计(并|和)?实现|设计一个|实现一个?.{0,20}(类|结构|缓存|队列|栈)"
               r"|实现\s*\w+\s*类|支持以下操作|满足.{0,10}约束的?数据结构", 0.85,
     "题面直接让你设计一个数据结构"),
    ("concurrency", r"线程|并发|交替打印|信号量", 0.9, "多线程题"),
    ("sql", r"编写(一个)?\s*SQL|查询结果的?格式|表：\s*\w+|Table:", 0.9, "SQL 题"),
)

COMPILED_PHRASE = tuple((aid, re.compile(rx), s, why) for aid, rx, s, why in PHRASE_PROBES)

# --- 输入结构 ------------------------------------------------------------------
STRUCT_PROBES: tuple[tuple[str, str, float, str], ...] = (
    ("tree-recursion", r"TreeNode|二叉树|树的根节点", 0.4, "输入是一棵树"),
    ("list-dummy", r"ListNode|链表", 0.45, "输入是链表，多半要用虚拟头节点省掉边界判断"),
    ("graph-dfs", r"edges\s*\[|无向图|有向图|邻接|节点\s*\d*\s*和\s*节点", 0.35, "输入是图，得先建图"),
)
# 注意这里没有「输入是网格 -> BFS」这一条：网格题可能是 DFS、可能是 BFS、
# 也可能是网格 DP，光看到二维数组推不出用哪个，硬推只会把标签冲淡。
COMPILED_STRUCT = tuple((aid, re.compile(rx), s, why) for aid, rx, s, why in STRUCT_PROBES)

# 守卫条件：某些结论必须题面里真有对应的东西才成立。
# 不加这一层的话，「最小路径和」会因为「路径和」被判成二叉树后序，
# 「接雨水」会因为「高度」被判成求树高 —— 问法对了，对象错了。
GUARDS: dict[str, str] = {
    **{aid: r"TreeNode|二叉树|二叉搜索树|BST|树的根节点|根节点|子树|叶子"
       for aid in ("tree-preorder", "tree-inorder", "tree-postorder", "tree-levelorder",
                   "tree-recursion", "tree-iterative", "bst-inorder", "tree-lca",
                   "tree-serialize", "tree-construct", "dp-tree")},
    **{aid: r"节点|edges|无向图|有向图|邻接|城市|课程|网络|路线|航班|连通|顶点"
       for aid in ("graph-dijkstra", "graph-floyd", "graph-bipartite", "graph-topo",
                   "graph-union-find")},
    **{aid: r"ListNode|链表" for aid in ("fast-slow", "list-dummy", "list-reverse", "list-merge")},
    "dp-2d": r"二维|网格|矩阵|m\s*x\s*n|grid|board|棋盘|三角形|地图",
    # 快速选择是在数组上划分：BST 里「第 k 小」靠中序，把树拍平再快选是脱靶
    "quickselect": r"数组|\bnums\b|列表|\barr\b",
    # 计算几何得真有坐标系：柱状图里的「最大矩形面积」是单调栈，不是几何
    "math-geometry": r"坐标|平面|x\s*轴|y\s*轴|欧(几里得|氏)|斜率|直线|圆|凸包|经纬",
}
COMPILED_GUARDS = {aid: re.compile(rx) for aid, rx in GUARDS.items()}

# 「要在一整个集合上做决策」的说法：划分、分配、全覆盖、走遍所有点……
# 只有这类问题配上小 n，才真的指向状压 / 爆搜。
# 特意不收「排列 / 组合 / 子集」这三个词：它们在题面里出现得太随意 ——
# 零钱兑换只是提了一句「没有任何一种硬币组合能组成总金额」，并不是让你状压。
SET_DECISION = re.compile(
    r"划分|分割成|分成\s*k|分配给|分成若干|分组"
    r"|访问(过)?所有|经过所有|走遍|覆盖所有|遍历所有|两两配对|完美匹配"
    r"|最短(的)?超级串|旅行商|哈密顿|全排列")

# 要求「把所有方案列出来」的题，答案是一张清单而不是一个最优值，状压 DP 帮不上忙 ——
# 那是回溯的活。这一条用来在小 n 规则里把状压排除掉。
RETURN_ALL = re.compile(r"返回\s*所有|列出所有|生成所有|所有可能的?.{0,12}(组合|排列|子集|结果|方案|路径|拆分)"
                        r"|以任意顺序返回")

# --- 数据范围推理 ---------------------------------------------------------------
# 规模 -> (够得着的思路, 该否掉的思路, 理由)
BUDGET_RULES: dict[str, tuple[tuple[str, ...], tuple[str, ...], str]] = {
    "exp":   (("bit-enum", "dp-bitmask", "backtracking", "brute-force", "dp-memo"),
              ("dp-interval",),
              "n <= {n}，2^n 完全跑得动 —— 出题人就是要你指数级枚举（状压 / 回溯）"),
    "half":  (("bidirectional", "bit-enum", "backtracking"), (),
              "n <= {n}，2^n 太大但 2^(n/2) 可以 —— 折半搜索"),
    "cubic": (("dp-interval", "dp-2d", "graph-floyd", "dp-knapsack"), (),
              "n <= {n}，O(n^3) 都能过 —— 区间 DP、Floyd 这类三重循环是允许的"),
    "quad":  (("dp-2d", "dp-knapsack", "dp-lcs", "dp-interval"), (),
              "n <= {n}，O(n^2) 很舒服 —— 二维 DP 的主场"),
    "quad-ish": (("dp-2d",), (), "n <= {n}，O(n^2) 勉强、O(n sqrt n) 舒服"),
    "linear": (("sliding-window", "prefix-sum", "monotonic-stack", "heap", "binary-search",
                "hash", "two-pointers", "sort-then", "dp-1d"),
               ("dp-interval", "dp-bitmask", "bit-enum", "graph-floyd", "dp-2d"),
               "n 到 {n}，只剩 O(n) / O(n log n) —— 二维 DP、状压、Floyd 全部超时，"
               "得往窗口 / 单调栈 / 前缀和 / 堆这些线性工具上想"),
}


def analyze(title: str, content: str) -> dict[str, dict]:
    """读题面，返回 {思路 id: {"s": 强度, "why": [理由]}}。"""
    text = to_text(content)
    if len(text.strip()) < 40:
        return {}
    body, hints = split_sections(text)
    lim = parse_limits(hints)
    hay = f"{title} {body}"

    out: dict[str, dict] = {}

    def add(aid: str, s: float, why: str) -> None:
        guard = COMPILED_GUARDS.get(aid)
        if guard and not guard.search(hay):
            return                      # 问法像，但题面里根本没有这个东西
        cur = out.setdefault(aid, {"s": 0.0, "why": []})
        cur["s"] = max(cur["s"], s)
        if why not in cur["why"]:
            cur["why"].append(why)

    for aid, rx, s, why in COMPILED_PHRASE:
        if rx.search(hay):
            add(aid, s, why)
    for aid, rx, s, why in COMPILED_STRUCT:
        if rx.search(hay):
            add(aid, s, why)

    # 数据范围：够得着的放大，跑不动的否掉
    boost, veto, tpl = BUDGET_RULES.get(lim.budget, ((), (), ""))
    if tpl:
        reason = tpl.format(n=lim.size)
        for aid in boost:
            if aid in out:
                out[aid]["s"] = min(out[aid]["s"] + 0.2, 1.0)
                out[aid]["why"].append(reason)
        for aid in veto:
            if aid in out:
                out[aid]["s"] *= 0.35
                out[aid]["why"].append(f"但 {reason}")

    # 光看范围就足以立论的情况。门槛必须收紧：n 小不等于状压 ——
    # 一堆简单题的 n 也只有 10，那是因为题本身简单，不是让你压状态。
    # 真正的信号是「小 n + 要在一个集合上做划分 / 排列 / 全覆盖的决策」。
    if lim.budget in ("exp", "half") and SET_DECISION.search(hay):
        if not RETURN_ALL.search(hay):
            add("dp-bitmask", 0.55,
                f"n <= {lim.size}，而且要在一个集合上做划分 / 全覆盖的决策 —— 把集合压进状态最省事")
        add("backtracking", 0.5, f"n <= {lim.size}，爆搜加剪枝就够，不必想复杂")
    # 值域大、规模小，只作为「已经怀疑二分答案」时的加成，单独不足以立论
    if lim.value and lim.size and lim.value >= 10 ** 6 and lim.size <= 10 ** 5 \
            and "binary-search-answer" in out:
        out["binary-search-answer"]["s"] = min(out["binary-search-answer"]["s"] + 0.15, 1.0)
        out["binary-search-answer"]["why"].append(
            f"值域到 {lim.value} 但规模只有 {lim.size} —— 在答案上二分比在数据上枚举便宜")

    return {aid: v for aid, v in out.items() if v["s"] >= 0.3}


def evidence(title: str, content: str) -> dict[str, float]:
    """只要强度，喂给指纹用。"""
    return {aid: round(v["s"], 3) for aid, v in analyze(title, content).items()}


# --- 验证用例 ------------------------------------------------------------------
# 只放「光凭题面就该读出来」的东西。需要看代码才知道的（比如某题用了 Morris 遍历）不放这里。
CASES: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "split-array-largest-sum": (("binary-search-answer",), ("kmp", "trie")),
    "koko-eating-bananas": (("binary-search-answer",), ("kmp", "dp-interval")),
    "longest-substring-without-repeating-characters": (("sliding-window",), ("dp-interval",)),
    "sliding-window-maximum": (("monotonic-queue",), ("kmp",)),
    "daily-temperatures": (("monotonic-stack",), ("kmp", "trie")),
    "trapping-rain-water": (("monotonic-stack",), ("kmp",)),
    "subsets": (("backtracking",), ("kmp", "graph-dijkstra")),
    "permutations": (("backtracking",), ("kmp",)),
    "course-schedule": (("graph-topo",), ("kmp", "trie")),
    "number-of-islands": (("graph-dfs",), ("kmp", "trie")),
    "network-delay-time": (("graph-dijkstra",), ("kmp",)),
    "binary-tree-level-order-traversal": (("tree-levelorder",), ("kmp",)),
    "lowest-common-ancestor-of-a-binary-tree": (("tree-lca",), ("kmp",)),
    "serialize-and-deserialize-binary-tree": (("tree-serialize",), ("kmp",)),
    "kth-largest-element-in-an-array": (("heap",), ("kmp", "trie")),
    "majority-element": (("math-moore",), ("kmp",)),
    "single-number": (("math-xor",), ("kmp",)),
    "partition-to-k-equal-sum-subsets": (("dp-bitmask",), ("kmp",)),
    "burst-balloons": (("dp-interval",), ("kmp", "sliding-window")),
    "longest-increasing-subsequence": (("dp-lis",), ("kmp",)),
    "edit-distance": (("dp-lcs",), ("kmp",)),
    "unique-paths": (("dp-2d",), ("kmp", "trie")),
    "linked-list-cycle": (("fast-slow",), ("kmp", "trie")),
    "implement-trie-prefix-tree": (("trie",), ("kmp",)),
    "lru-cache": (("design",), ("kmp",)),
    "merge-intervals": (("sweep-line",), ("kmp",)),
    "subarray-sum-equals-k": (("prefix-sum",), ("kmp",)),
    "house-robber-iii": (("dp-tree",), ("kmp",)),
    "find-median-from-data-stream": (("ordered-set",), ("kmp",)),
    "nim-game": (("math-game",), ("kmp",)),
    # 反面用例：小 n 只是因为题简单，不是让你状压 / 爆搜
    "roman-to-integer": ((), ("dp-bitmask", "backtracking", "binary-search-answer")),
    "climbing-stairs": (("dp-1d",), ("dp-bitmask", "graph-dijkstra", "bidirectional")),
    "valid-parentheses": ((), ("dp-2d", "dp-interval", "dp-bitmask")),
    # 反面用例：网格输入不等于 BFS
    "unique-paths-ii": (("dp-2d",), ("graph-dijkstra", "dp-bitmask")),
    # 反面用例：问法像树，但题面里没有树
    "minimum-path-sum": (("dp-2d",), ("tree-postorder", "tree-recursion")),
    "triangle": (("dp-2d",), ("tree-postorder",)),
    "largest-rectangle-in-histogram": (("monotonic-stack",), ("tree-postorder", "tree-recursion")),
    # 反面用例：题目说明里对做题人说的话（「至少有三种解法」）不是题目的目标函数
    "tenth-line": ((), ("greedy", "dp-1d", "binary-search-answer")),
    # 反面用例：「最小值」「最少需要几次」不是二分答案的信号，否则整个专题会被冲淡
    "longest-harmonious-subsequence": ((), ("binary-search-answer",)),
    "na-ying-bi": ((), ("binary-search-answer",)),
    "o8SXZn": ((), ("binary-search-answer",)),
    # 「至少需要等待的天数」是单调栈题的问法，不是阈值二分（LCR 038 每日温度）
    "iIQa4I": (("monotonic-stack",), ("binary-search-answer",)),
    # 正面用例：阈值型问法要留住
    "capacity-to-ship-packages-within-d-days": (("binary-search-answer",), ("kmp",)),
    "minimum-number-of-days-to-make-m-bouquets": (("binary-search-answer",), ("kmp",)),
    # 反面用例：数据范围写成 5 * 10^4 / 2 * 10^4，不能读成 n <= 5、n <= 2
    "sort-an-array": ((), ("dp-bitmask", "bit-enum")),
    # 反面用例：要「返回所有排列」，答案是一张清单，状压 DP 帮不上忙
    "permutations": (("backtracking",), ("dp-bitmask",)),
    # 反面用例：最长回文子串不是滑动窗口；合并有序数组跟质数无关
    "longest-palindromic-substring": (("palindrome-center",), ("sliding-window", "dp-bitmask")),
    "merge-sorted-array": ((), ("math-sieve", "dp-bitmask")),
    # 反面用例：回文链表不能中心扩展。
    # （这题实际用快慢指针找中点 + 反转，但题面里推不出来 —— 那是实现选择，
    #   所以这里只断言「不该出现什么」，不假装能推出解法。）
    "palindrome-linked-list": ((), ("palindrome-center", "trie")),
    "subarray-sum-equals-k": (("prefix-sum",), ("kmp", "trie")),
    "subsets": (("backtracking",), ("kmp", "graph-dijkstra", "math-fast-pow")),
    # 反面用例：最大子数组和有负数、窗口不单调，是 Kadane 递推不是滑动窗口
    "maximum-subarray": ((), ("sliding-window", "dp-bitmask")),
    # 反面用例：「不含重复数字」是输入描述，不是滑窗信号
    "permutations-ii": ((), ("sliding-window",)),
    # 反面用例：只提了一句「硬币组合」，不是让你状压
    "coin-change": ((), ("dp-bitmask", "sliding-window")),
    "combination-sum": ((), ("dp-bitmask",)),
    "generate-parentheses": ((), ("dp-bitmask",)),
    # 正面用例：真正的滑动窗口题要留住
    "minimum-size-subarray-sum": (("sliding-window",), ("kmp",)),
    "longest-substring-without-repeating-characters": (("sliding-window",), ("dp-interval",)),
    # 反面用例：判题模板里的「期望答案」不是概率期望
    "remove-duplicates-from-sorted-array": ((), ("dp-prob", "sliding-window")),
    # 反面用例：「不存在下一个更大的排列」不是单调栈
    "next-permutation": ((), ("monotonic-stack",)),
    # 反面用例：验证回文 / 回文数用不上中心扩展
    "valid-palindrome": ((), ("palindrome-center",)),
    "palindrome-number": ((), ("palindrome-center",)),
    # 反面用例：BST 第 k 小靠中序，不是把树拍平快选
    "kth-smallest-element-in-a-bst": (("bst-inorder",), ("quickselect",)),
    # 正面用例：这些回文题确实该有中心扩展
    "palindromic-substrings": (("palindrome-center",), ("kmp",)),
    "palindrome-partitioning": (("palindrome-center", "backtracking"), ("kmp",)),
    # 反面用例：最长有效括号的合法性不单调，不是滑动窗口
    "longest-valid-parentheses": ((), ("sliding-window",)),
    # 反面用例：柱状图 / 矩阵里的「最大矩形面积」是单调栈，不是计算几何
    "maximal-rectangle": ((), ("math-geometry",)),
    # 反面用例：「可被三整除的最大和」是 DP，不是前缀和
    "greatest-sum-divisible-by-three": ((), ("prefix-sum",)),
    # 正面用例：「和可被 K 整除的子数组」才是前缀和
    "subarray-sums-divisible-by-k": (("prefix-sum",), ("kmp",)),
}


def validate(details: dict[str, dict], titles: dict[str, str]) -> dict:
    total = hit = 0
    violations: list[str] = []
    misses: list[str] = []
    for slug, (want, forbid) in CASES.items():
        det = details.get(slug)
        if not det or not det.get("content"):
            misses.append(f"{slug}: 没有题面")
            continue
        got = analyze(titles.get(slug, ""), det["content"])
        total += len(want)
        for aid in forbid:
            if aid in got:
                violations.append(f"{slug}: 误判 {aid}")
        for aid in want:
            if aid in got:
                hit += 1
            else:
                misses.append(f"{slug}: 漏判 {aid}（读出 {sorted(got)[:7]}）")
    return {"recall": f"{hit}/{total}", "violations": violations, "misses": misses}


if __name__ == "__main__":
    import json
    import pathlib

    root = pathlib.Path(__file__).parent
    details = {}
    for line in (root / "data/raw/leetcode_detail.jsonl").open(encoding="utf-8"):
        r = json.loads(line)
        if not r.get("_error"):
            details[r["_key"]] = r
    titles = {p["titleSlug"]: (p.get("titleCn") or p.get("title") or "")
              for p in json.loads((root / "data/raw/leetcode_list.json").read_text(encoding="utf-8"))}
    rep = validate(details, titles)
    print(f"题面召回: {rep['recall']}    误判: {len(rep['violations'])}")
    for line in rep["violations"]:
        print("  !", line)
    for line in rep["misses"]:
        print("  -", line)
