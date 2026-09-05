"""从题解**代码**里读出真实解法。

为什么不能只看标签和题解标题
----------------------------
官方标签只说「这题和树有关」；题解标题会说「递归」，但递归成什么样、
访问顺序是前序还是后序，只有代码里看得出来。所以这里直接分析代码结构：

- **遍历次序**：找出递归函数自调用的行号，和「访问节点」的行号（碰 val 并写结果），
  访问在自调用之前是前序、夹在两次自调用之间是中序、之后是后序。
- **DP 形状**：dp[i] 是一维递推，dp[i][j] 是二维，带 @cache/记忆表就是记忆化搜索。
- **数据结构**：deque+popleft 是 BFS，while stack 且 pop 是迭代深搜，
  `while stack and stack[-1] < x: pop` 是单调栈，`i += i & -i` 是树状数组……
- **数学**：`range(i*i, n, i)` 的内层循环是筛法，`while n: if n & 1` 是快速幂。

Python 代码还会额外走一遍 AST 做交叉验证；其它语言只做行/词级匹配。
证据按「多少份题解里出现过」加权，出现在越多份题解里的解法越可信。
"""

from __future__ import annotations

import ast
import re
import warnings

# --- 词级探针 -------------------------------------------------------------------
# 宁可漏判也别误判：误判会污染相似度，漏判只是少一条证据。
# 所以模式都盯着「只有这种解法才会写出来的东西」，不用容器名之类的弱信号。
TOKEN_PROBES: tuple[tuple[str, str], ...] = (
    # 队列真的当 FIFO 用才算 BFS（Java 的 Deque 常被当栈使，不能只看类型名）
    ("graph-bfs", r"popleft\(\)|\.poll\(\)|\.pop\(0\)|\.removeFirst\(\)|\bq\.front\(\)|queue\.front\(\)"),
    # 层序的特征是「先量一层有多少个，再一次处理完这一层」，而且量的必须是队列
    ("tree-levelorder", r"for\s+_\s+in\s+range\(\s*len\(\s*\w*(q|que|queue|dq|deque|cur|level|nodes|tmp)\w*\s*\)\s*\)"
                        r"|\b(size|sz|n|cnt|count|levelSize)\s*=\s*\w*(q|que|queue|dq|deque|level|nodes)\w*\.size\(\)"
                        r"|\blen\s*\(\s*\w*(q|que|queue|dq|level)\w*\s*\)[\s\S]{0,60}?for\b"),
    ("heap", r"\bheapq\b|heappush|heappop|PriorityQueue<|priority_queue<|nlargest\(|nsmallest\("),
    ("graph-union-find", r"parent\s*\[\s*\w+\s*\]\s*=\s*find\(|def\s+union\s*\(|void\s+union\s*\(|\bUnionFind\b|\bDSU\b"),
    ("trie", r"\bTrie\b|children\s*=\s*\[?\s*(None|\{\}|new\s+\w+\[26\])|\bchildren\[|next\s*\[\s*26\s*\]"),
    ("segment-tree", r"lazy\s*\[|pushDown|pushdown|build\s*\(\s*\w+\s*,\s*\w+\s*,\s*\w+\s*\)"
                     r"|4\s*\*\s*(n|len)|node\s*<<\s*1|2\s*\*\s*node\b"),
    ("fenwick", r"[-+]=\s*\w+\s*&\s*\(?\s*-\s*\w+|lowbit|&\s*\(-\s*\w+\s*\)"),
    ("math-sieve", r"range\(\s*\w+\s*\*\s*\w+\s*,\s*[^,)]+,\s*\w+\s*\)|for\s*\(\s*\w+\s+\w+\s*=\s*\w+\s*\*\s*\w+\s*;"),
    ("math-fast-pow", r"(>>=\s*1|//=\s*2|/=\s*2)[\s\S]{0,120}?(&\s*1|%\s*2)|(&\s*1|%\s*2)[\s\S]{0,120}?(>>=\s*1|//=\s*2)"
                      r"|pow\(\s*\w+\s*,\s*\w+\s*,\s*\w+\s*\)"),
    ("math-xor", r"\^=|\^\s*nums|\bxor\b|bin\(\s*\w+\s*\)\.count|bit_count\(\)|popcount|Integer\.bitCount"),
    ("math-gcd", r"math\.gcd|\bgcd\s*\(|\bGCD\s*\("),
    # 数位拆解：一位一位地取余、除十，再拼回去（整数反转、回文数、各位和这一族）
    ("math-base", r"%\s*10\b[\s\S]{0,60}?(//=?\s*10|/=\s*10|/\s*10\b)"
                  r"|(//=?\s*10|/=\s*10)[\s\S]{0,60}?%\s*10\b"
                  r"|divmod\s*\(\s*\w+\s*,\s*10\s*\)"
                  r"|\*\s*10\s*\+\s*\w+\s*%\s*10"
                  r"|int\s*\(\s*str\s*\(|\bstr\s*\(\s*\w+\s*\)\s*\[\s*::\s*-\s*1\s*\]"),
    # 摩尔投票的变量名五花八门（cand/ans/hp/擂主…），只认结构：计数器按「是否等于擂主」±1
    ("math-moore", r"\+=\s*1\s+if\s+[\w\[\]\.]+\s*==\s*[\w\[\]\.]+\s+else\s+-\s*1"
                   r"|(\+=|-=)\s*[^;\n]*\?\s*1\s*:\s*-\s*1"
                   r"|(candidate|cand|major\w*)\b[\s\S]{0,200}?(count|cnt|votes?)\b[\s\S]{0,60}?(\+\+|--|\+=\s*1|-=\s*1)"),
    ("math-combi", r"\bcomb\(|factorial|binom|C\s*\[\s*\w+\s*\]\s*\[\s*\w+\s*\]"),
    ("prefix-sum", r"\w*(pre|prefix|pre_?sum|presum)\w*\s*\[\s*\w+\s*\+\s*1\s*\]\s*=|itertools\.accumulate|\baccumulate\("),
    ("diff-array", r"\bdiff\s*\[\s*\w+\s*\]\s*\+=|\bd\s*\[\s*\w+\s*\+\s*1\s*\]\s*-="),
    ("binary-search", r"(mid|mi|m)\s*=\s*\(?\s*\w+\s*\+\s*\(?\s*\w+\s*(-\s*\w+\s*\)?\s*)?\)?\s*(//\s*2|>>\s*1|/\s*2)"
                      r"|bisect_(left|right)|lower_bound|upper_bound"),
    ("two-pointers", r"while\s+\(?\s*\w*(left|l|lo|i)\b[\s\S]{0,6}<[\s\S]{0,6}\w*(right|r|hi|j)\b[\s\S]{0,220}?"
                     r"(right|r|hi|j)\s*(-=\s*1|--)"),
    ("fast-slow", r"fast\s*=\s*fast(\.next\.next|->next->next|\.next\.next)|slow\s*=\s*slow\.next[\s\S]{0,80}?fast\s*=\s*fast"),
    ("sort-then", r"\.sort\(|sorted\(|Arrays\.sort|sort\(\s*\w+\.begin"),
    ("hash", r"Counter\(|defaultdict\(|unordered_map<|HashMap<|new\s+HashSet|unordered_set<"),
    ("dp-memo", r"@cache|@lru_cache|@functools\.cache|memo\s*\[|memo\.get|unordered_map<[^>]*>\s*memo|\bmemo\b\s*="),
    ("graph-dijkstra", r"\bdijkstra\b|\bDijkstra\b"),
    # 网格搜索：把走过的格子改掉（沉岛），或者开二维 visited
    ("graph-dfs", r"grid\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*['\"]?0['\"]?"
                  r"|visited\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*(True|true|1)"
                  r"|vis\s*\[[^\]]+\]\s*\[[^\]]+\]\s*=\s*(True|true|1)"),
    ("graph-topo", r"indeg|inDegree|in_degree|topolog"),
    ("graph-mst", r"kruskal|\bprim\b|minimum.?spanning"),
    ("ordered-set", r"SortedList|SortedDict|TreeMap<|multiset<|std::set<"),
    ("kmp", r"\bkmp\b|failure\s*\[|partial_match|\bnxt\s*\[\s*i\s*\]\s*=\s*j"),
    ("manacher", r"manacher"),
    ("palindrome-center", r"while\s+\w+\s*>=\s*0\s+and\s+\w+\s*<\s*\w+\s+and\s+s\[\s*\w+\s*\]\s*==\s*s\[|expand(AroundCenter|Center)?\s*\("),
    ("rolling-hash", r"\bhash\s*=\s*\(?\s*hash\s*\*|\bBASE\b|\bMOD\b\s*=\s*\d{6,}"),
    ("design", r"class\s+(LRUCache|LFUCache|MyQueue|MyStack|Twitter|RandomizedSet|Skiplist)"),
    ("bit-enum", r"for\s+\w+\s+in\s+range\(\s*1\s*<<|1\s*<<\s*n|for\s*\(\s*int\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\(\s*1\s*<<"),
    ("quickselect", r"partition\s*\(|nth_element|quickSelect|quick_select"),
    ("merge-sort", r"merge\s*\(\s*\w+\s*,\s*\w+\s*,\s*\w+|mergeSort|merge_sort"),
    # 区间 DP 有三种长相，都要认：
    #   ① 枚举分割点：f[i][k] + f[k][j] / f[k+1][j]
    #   ② 区间往里收：f[i][j] 由 f[i+1][j-1] 推出（回文那一类）
    #   ③ 记忆化版的分割：solve(l, i) + solve(i, r)
    ("dp-interval", r"\w+\s*\[\s*\w+\s*\]\s*\[\s*(k|m|mid|p)\s*\][\s\S]{0,50}?\[\s*(k|m|mid|p)\s*(\+\s*1\s*)?\]\s*\["
                    r"|\[\s*\w+\s*\+\s*1\s*\]\s*\[\s*\w+\s*-\s*1\s*\]"
                    r"|\b(\w+)\s*\(\s*\w+\s*,\s*(\w+)\s*\)\s*\+\s*\4\s*\(\s*\5\s*,"
                    r"|for\s+(len|length|L|size)\w*\s+in\s+range\(\s*[23]\s*,"
                    r"|for\s*\(\s*int\s+(len|length|L)\w*\s*=\s*[23]\s*;"),
    # 状压 DP：把集合塞进整数下标
    ("dp-bitmask", r"\b(dp|f|g|memo)\s*\[\s*1\s*<<|\b(dp|f|g|memo)\s*\[[^\]]*\bmask\b"
                   r"|\bmask\s*\^\s*\(?\s*1\s*<<|\bmask\s*(&|\|)\s*\(?\s*1\s*<<"),
)

COMPILED = tuple((aid, re.compile(rx, re.M)) for aid, rx in TOKEN_PROBES)

# 需要「同一段里配合出现」才算的组合探针：(思路, 触发词正则, 附近必须出现的正则, 窗口行数)
NEAR_PROBES: tuple[tuple[str, str, str, int], ...] = (
    # 单调栈：while 条件里带栈 + 紧跟着 pop
    ("monotonic-stack",
     r"while\s*\(?\s*!?\s*\w*(stack|stk|st)\w*(\.isEmpty\(\)|\.empty\(\)|\s|\))*(&&|and)\s",
     r"(pop|pop_back|removeLast)\s*\(", 4),
    # 单调队列：while 条件里带队列 + 从尾部弹出（滑窗最值的写法）
    ("monotonic-queue",
     r"while\s*\(?\s*!?\s*\w*(q|que|deque|dq|window|win)\w*(\.isEmpty\(\)|\.empty\(\)|\s|\))*(&&|and)\s",
     r"(pop\(\)|pop_back|pollLast|removeLast)", 4),
    # 滑动窗口：外层遍历右端点 + 内层收缩左端点
    ("sliding-window",
     r"(for|while)[^\n]*\b(right|r|j|end)\b",
     r"\b(left|l|start|lo)\s*(\+=\s*1|\+\+)", 12),
    # 栈模拟：有 push/pop 但不带单调条件（括号匹配、表达式求值）
    ("stack-sim", r"\w*(stack|stk|st)\w*\.(append|push|push_back)\s*\(", r"(pop|pop_back)\s*\(", 12),
    # 回溯：加入 -> 递归 -> 撤销。中间必须真的递归下去，否则只是普通的 push/pop
    ("backtracking", r"\w+\.(append|add|push_back|push)\s*\(",
     r"(dfs|DFS|backtrack|helper|recur|solve|self\.\w+|this\.\w+)\s*\([\s\S]{0,240}?"
     r"\w*\.(pop|pop_back|removeLast|erase)\s*\(", 10),
    # 网格搜索：方向数组
    ("graph-dfs", r"(dirs?|directions|DIR)\s*=\s*[\[\(]|\{\{-?1\s*,|for\s+d[xy]?,\s*d[xy]\s+in",
     r"(dfs|DFS|bfs)\s*\(", 24),
    # Dijkstra 写法一：堆里存 (距离, 点)，出堆后松弛邻居的 dis
    ("graph-dijkstra",
     r"(heappop|heappush|\.poll\(\)|\.push\(|pq\.top\(\)|\.offer\()",
     r"\b(dis|dist|d)\w*\s*\[[^\]]+\]\s*=\s*\w", 14),
    # Dijkstra 写法二：朴素 O(n^2)，每轮在未确定的点里挑 dis 最小的
    ("graph-dijkstra",
     r"\b(done|visited|vis|used)\b[\s\S]{0,20}(\[|=)",
     r"\b(dis|dist)\w*\s*\[\s*\w+\s*\]\s*<\s*(dis|dist)\w*\s*\[\s*\w+\s*\]", 12),
    # 摩尔投票的经典写法：计数器归零就换擂主，同一个计数器既 ++ 又 --
    ("math-moore",
     r"if\s*\(?\s*(count|cnt|votes?|hp|freq)\s*==\s*0\s*\)?\s*[:{]",
     r"(\+\+|\+=\s*1)[\s\S]{0,200}?(--|-=\s*1)|(--|-=\s*1)[\s\S]{0,200}?(\+\+|\+=\s*1)", 12),
    # 索引型递归 dfs(i-1, ...) 只有在真的有网格/图时才算图搜索，否则那是 DP 的记忆化搜索
    ("graph-dfs",
     r"(dfs|DFS|flood\w*)\s*\(\s*\w+\s*[-+]\s*1\s*,",
     r"\b(grid|board|matrix|adj|graph|neighbo\w*)\b", 10),
    # 图上递归搜索：标记访问过 + 递归进邻居（用 set 记 visited 的一维写法）
    ("graph-dfs",
     r"(visited|vis|seen)\s*\.\s*(add|insert)\s*\(|(visited|vis|seen)\s*\[\s*\w+\s*\]\s*=\s*(True|true|1)",
     r"(dfs|DFS)\s*\(", 8),
)

NEAR_COMPILED = tuple((aid, re.compile(a, re.M), re.compile(b, re.M), win)
                      for aid, a, b, win in NEAR_PROBES)

VISIT_RE = re.compile(r"(\.val|->val|\bval\b)[\s\S]{0,40}?(append|push_back|add|push|res|ans|out|\+=)"
                      r"|(append|push_back|add|push)\s*\([^)]*(\.val|->val)")
SELF_CALL_TPL = r"\b%s\s*\("
DEF_RE = re.compile(r"^\s*(?:def\s+(\w+)|(?:public|private|static|void|int|bool|boolean|char|TreeNode\*?|vector<[^>]*>|func)\s+(\w+)\s*\()")


# 「把子树的结果合起来」：return / 赋值 里出现 max、min、+ 这类合并动作。
# 注意 = 两侧不能加 \b —— `rob = l + r` 的等号两边都是空格，\b 会匹配不上。
COMBINE_RE = re.compile(r"(\breturn\b|=)[^\n]*(max|min|\+|\|\||&&|\band\b|\bor\b|,)")
# 状态压缩的招牌动作：把某一位翻转 / 置上 / 取出来看
BITSTATE_RE = re.compile(r"\^\s*\(?\s*1\s*<<|\|\s*\(?\s*1\s*<<|>>\s*\w+\s*&\s*1"
                         r"|\*\s*\(\s*1\s*<<|\[\s*1\s*<<")
# while (l < r) 里只是交换元素 —— 那是在反转数组，是别的解法里顺手写的工具循环，
# 不能算成「这题考双指针 / 滑动窗口」。真正的双指针题，循环体里是在比较或累加。
REVERSE_LOOP = re.compile(
    r"while\s*\(?\s*\w*(left|l|lo|i|start)\w*\s*<\s*\w*(right|r|hi|j|end)\w*\s*\)?\s*[:{][\s\S]{0,220}?"
    r"(swap\s*\(|temp\s*=\s*\w+\s*\[|\w+\s*\[[^\]]+\]\s*,\s*\w+\s*\[[^\]]+\]\s*=\s*\w+\s*\[)")
ASSIGN_FROM_CALL = re.compile(r"(?:\w+\s+)?(\w+)\s*=\s*[^=\n]*\b%s\s*\(")


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def _body_range(lines: list[str], start: int) -> range:
    """函数体从 def 的下一行开始，到缩进退回 def 层级为止。

    这一步不能省：`def dfs(...)` 外面通常还有一句 `dfs(root)` driver 调用，
    如果把它也当成递归，"最后一次递归"的位置就会算错，后序就判不出来了。
    """
    base = _indent(lines[start])
    for i in range(start + 1, len(lines)):
        ln = lines[i]
        if ln.strip() and _indent(ln) <= base:
            return range(start + 1, i)
    return range(start + 1, len(lines))


def traversal_orders(code: str) -> set[str]:
    """看「处理当前节点」发生在两次子树递归之前 / 之间 / 之后，判前序 / 中序 / 后序。

    后序有两种长相，都要认：
      1. 显式访问：`dfs(l); dfs(r); res.append(node.val)`
      2. 自底向上：`l = dfs(node.left); r = dfs(node.right); return max(l, r) + 1`
         —— 这种没有 append，但「先拿到子树答案再合并」正是后序，树形 DP 全是这个形状。

    一篇题解里可能同时贴了三种顺序（"三种遍历一次讲清"），所以每个递归函数都判一遍、
    全部返回，最后靠多篇题解投票定主次。
    """
    if not TREE_HINT.search(code):     # 网格/图上的 dfs 不算树遍历
        return set()
    lines = code.splitlines()
    defs: list[tuple[str, int]] = []
    for i, ln in enumerate(lines):
        m = DEF_RE.match(ln)
        if m and (m.group(1) or m.group(2)):
            defs.append((m.group(1) or m.group(2), i))
    out: set[str] = set()
    for name, at in defs:
        rx = re.compile(SELF_CALL_TPL % re.escape(name))
        body = _body_range(lines, at)
        calls = [i for i in body if rx.search(lines[i]) and not DEF_RE.match(lines[i])]
        if not calls:
            continue
        # 一行里递归两次（`return max(dfs(l), dfs(r)) + 1`）本身就是合并子树答案
        for i in calls:
            if len(rx.findall(lines[i])) >= 2 and COMBINE_RE.search(lines[i]):
                out.add("tree-postorder")
        if len(calls) < 2:
            continue
        lo, hi = min(calls), max(calls)
        span = range(max(body.start, lo - 6), min(body.stop, hi + 7))
        visits = [i for i in span if VISIT_RE.search(lines[i])]
        if any(v < lo for v in visits):
            out.add("tree-preorder")
        if any(lo < v < hi for v in visits):
            out.add("tree-inorder")
        if any(v > hi for v in visits):
            out.add("tree-postorder")
        # 自底向上：子树结果先存进变量，递归结束后再合并
        holders = {m.group(1) for ln in lines[lo:hi + 1]
                   for m in [re.search(ASSIGN_FROM_CALL.pattern % re.escape(name), ln)] if m}
        if holders:
            for ln in lines[hi + 1:min(body.stop, hi + 7)]:
                if any(re.search(r"\b%s\b" % re.escape(h), ln) for h in holders) and COMBINE_RE.search(ln):
                    out.add("tree-postorder")
                    break
    return out


def _near_hits(code: str) -> set[str]:
    """组合探针：触发词出现后，紧邻若干行内必须出现配套写法。"""
    lines = code.splitlines()
    out: set[str] = set()
    for aid, trigger, need, win in NEAR_COMPILED:
        for i, ln in enumerate(lines):
            if not trigger.search(ln):
                continue
            window = "\n".join(lines[i:i + win + 1])
            if need.search(window):
                out.add(aid)
                break
    return out


def dp_shape(code: str) -> list[str]:
    """dp[i] 是一维、dp[i][j] 是二维。

    一篇题解常常先写二维再压成滚动数组，两种形状会同时出现，所以两条都判、都返回，
    不做二选一 —— 「先二维推状态、再压维」本身就是该题要考的东西。
    """
    out: list[str] = []
    if re.search(r"\b(dp|f|g|memo)\s*\[[^\]]+\]\s*\[[^\]]+\]", code):
        out.append("dp-2d")
    # dp[i] = ... 只会匹配真正的一维赋值：dp[i][j] 后面跟的是 '[' 而不是 '='
    if re.search(r"\b(dp|f|g)\s*\[[^\]]+\]\s*=[^=]", code) \
            or (re.search(r"\bdp\s*=\s*\[?\s*(0|1|inf|float)", code) and "for" in code):
        out.append("dp-1d")
    return out


# 只认二叉树：Trie、线段树、并查集的代码里也有 self.root，光看 root 会把它们全算成二叉树。
TREE_HINT = re.compile(r"\bTreeNode\b|\.left\b|\.right\b|->left\b|->right\b|\bleft\s*,\s*right\b")
GRAPHY_HINT = re.compile(r"\bgrid\b|\badj\b|\bgraph\b|neighbo|\bvisited\b|\bseen\b|\bboard\b")


def _python_ast_signals(code: str) -> set[str]:
    """Python 能解析成 AST 的话，做几个比正则更硬的判断。

    AST 只用来确认「结构」（有没有自递归、while 里是不是真的在弹队列），
    「这是什么问题」仍然交给上下文词判断 —— 否则任何带 while+pop 的代码都会被当成图搜索。
    """
    try:
        # 题解代码里常有 "\d" 这类正则字面量，parse 时会刷一堆 SyntaxWarning，跟分析无关
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            tree = ast.parse(code)
    except (SyntaxError, ValueError):
        return set()
    treeish = bool(TREE_HINT.search(code))
    graphy = bool(GRAPHY_HINT.search(code))
    out: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            for dec in node.decorator_list:
                name = getattr(dec, "id", None) or getattr(getattr(dec, "func", None), "id", None) \
                    or getattr(dec, "attr", None)
                if name in ("cache", "lru_cache"):
                    out.add("dp-memo")
            # 函数体里调用自己 => 递归。但只有在代码确实在处理树时才记成树递归
            if treeish:
                for sub in ast.walk(node):
                    if not isinstance(sub, ast.Call):
                        continue
                    # dfs(...) 和 self.invertTree(...) 两种写法都算自递归
                    called = getattr(sub.func, "id", None) or getattr(sub.func, "attr", None)
                    if called == node.name:
                        out.add("tree-recursion")
                        break
        if isinstance(node, ast.While):
            src = ast.dump(node)
            if "popleft" in src:
                out.add("graph-bfs" if graphy else "tree-levelorder")
            elif graphy and "'pop'" in src:
                out.add("graph-dfs")
    return out


def analyze_blocks(blocks: list[dict]) -> dict[str, float]:
    """返回 {思路 id: 证据强度}。强度 = 有多少**篇**题解的代码支持它（归一化）。

    按篇而不是按代码块投票：一篇题解常把「记忆化 / 二维 / 压成一维」全贴出来，
    那是同一个人的同一套思路，算一票；两个不同作者都这么写才说明这是公认解法。
    """
    if not blocks:
        return {}
    per_article: dict[str, set[str]] = {}
    for idx, b in enumerate(blocks):
        code = b.get("code") or ""
        if not code:
            continue
        seen: set[str] = set()
        for aid, rx in COMPILED:
            if rx.search(code):
                seen.add(aid)
        seen.update(_near_hits(code))
        orders = traversal_orders(code)
        seen.update(orders)
        seen.update(dp_shape(code))
        if b.get("lang") == "python":
            seen.update(_python_ast_signals(code))
        treeish = bool(TREE_HINT.search(code))
        # 反转用的对撞循环：撤掉，别让工具代码冒充解法。
        # 这里不改标成「链表反转」—— 反的多半是数组的一段（下一个排列就是这样），
        # 硬标成链表反而错得更远。
        if REVERSE_LOOP.search(code):
            seen.discard("sliding-window")
            seen.discard("two-pointers")
        # 「先量一层再处理一层」出现在网格/图上，那是分层 BFS，不是二叉树层序
        if "tree-levelorder" in seen and not treeish:
            seen.discard("tree-levelorder")
            seen.add("graph-bfs")
        # 单调栈成立时，普通栈模拟这条就不必再报了
        if "monotonic-stack" in seen:
            seen.discard("stack-sim")
        # 树上用显式栈 = 迭代遍历，不是普通的栈模拟
        if treeish and ("stack-sim" in seen or "monotonic-stack" in seen):
            seen.add("tree-iterative")
            seen.discard("stack-sim")
        # 有遍历次序说明是树递归
        if orders:
            seen.add("tree-recursion")
        # 树形 DP 的招牌：后序合并子树答案，而且一次返回多个状态（选 / 不选）
        if "tree-postorder" in seen and re.search(r"return\s*[\(\[]?\s*\w+\s*,\s*\w+", code):
            seen.add("dp-tree")
        # 状压 DP = 状态是个二进制集合 + 真的在做 DP（记忆化或递推表），缺一不算
        if seen & {"dp-memo", "dp-1d", "dp-2d"} and BITSTATE_RE.search(code):
            seen.add("dp-bitmask")
        key = (b.get("t") or "").strip() or f"#{idx}"
        per_article.setdefault(key, set()).update(seen)

    if not per_article:
        return {}
    hits: dict[str, int] = {}
    for seen in per_article.values():
        for aid in seen:
            hits[aid] = hits.get(aid, 0) + 1
    total = len(per_article)
    return {aid: round(min(hits[aid] / total, 1.0), 3) for aid in hits}


# --- 验证用例 ------------------------------------------------------------------
# 规则驱动的抽取必须能量化，否则调一处就坏一处。
# 格式：题目 slug -> (必须认出来的, 绝对不能出现的)
CASES: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "binary-tree-preorder-traversal": (("tree-preorder",), ("kmp", "graph-dijkstra")),
    "binary-tree-inorder-traversal": (("tree-inorder",), ("kmp", "graph-bfs")),
    "binary-tree-postorder-traversal": (("tree-postorder",), ("kmp",)),
    "binary-tree-level-order-traversal": (("graph-bfs", "tree-levelorder"), ("kmp", "monotonic-stack")),
    "daily-temperatures": (("monotonic-stack",), ("graph-bfs", "kmp", "tree-inorder")),
    "sliding-window-maximum": (("monotonic-queue",), ("kmp",)),
    "largest-rectangle-in-histogram": (("monotonic-stack",), ("graph-bfs",)),
    "number-of-islands": (("graph-dfs",), ("kmp", "monotonic-stack")),
    "count-primes": (("math-sieve",), ("graph-bfs", "kmp")),
    "coin-change": (("dp-1d",), ("kmp",)),
    "edit-distance": (("dp-2d",), ("kmp", "graph-bfs")),
    "majority-element": (("math-moore",), ("kmp",)),
    "two-sum": (("hash",), ("graph-bfs", "kmp", "monotonic-stack")),
    "lru-cache": (("design",), ("kmp", "math-sieve")),
    # 215 的高赞题解代码全是快速选择 / 直接排序，没有一份用堆 —— 按代码打标就该是 quickselect
    "kth-largest-element-in-an-array": (("quickselect",), ("kmp",)),
    "course-schedule": (("graph-topo",), ("kmp",)),
    "network-delay-time": (("graph-dijkstra",), ("kmp",)),
    "search-in-rotated-sorted-array": (("binary-search",), ("kmp", "graph-bfs")),
    "linked-list-cycle": (("fast-slow",), ("kmp", "math-sieve")),
    "implement-trie-prefix-tree": (("trie",), ("kmp", "graph-bfs")),
    "subsets": (("backtracking",), ("kmp", "graph-bfs")),
    "powx-n": (("math-fast-pow",), ("kmp",)),
    "single-number": (("math-xor",), ("kmp", "graph-bfs")),
    "merge-intervals": (("sort-then",), ("kmp", "graph-bfs")),
    "longest-substring-without-repeating-characters": (("sliding-window",), ("kmp", "graph-bfs")),
    "container-with-most-water": (("two-pointers",), ("kmp", "graph-bfs")),
    # 反面用例：状压 DP 的题解里带了个反转数组的工具循环，不能因此判成双指针 / 滑动窗口
    "partition-to-k-equal-sum-subsets": (("dp-bitmask",), ("kmp", "sliding-window", "two-pointers")),
    # 307 抓到的题解清一色树状数组（lowbit 写法），线段树只在文字里被提到、没有代码
    "range-sum-query-mutable": (("fenwick",), ("kmp",)),
    # 区间 DP / 状压 DP / 树形 DP：这三类光看官方标签分不出形状，必须看状态怎么摆
    "burst-balloons": (("dp-interval",), ("kmp", "graph-bfs")),
    "longest-palindromic-subsequence": (("dp-interval", "dp-2d"), ("kmp",)),
    "house-robber-iii": (("dp-tree", "tree-postorder"), ("kmp", "graph-dijkstra")),
    "binary-tree-maximum-path-sum": (("tree-postorder",), ("kmp", "graph-bfs")),
    "binary-tree-level-order-traversal": (("tree-levelorder",), ("kmp",)),
    "binary-tree-inorder-traversal": (("tree-inorder",), ("kmp", "graph-dijkstra")),
    "01-matrix": (("graph-bfs",), ("tree-levelorder", "kmp")),
    # 数位拆解：这类题以前指纹是空的，只能靠官方标签猜成「GCD」
    "reverse-integer": (("math-base",), ("math-gcd", "kmp")),
    "palindrome-number": (("math-base",), ("math-gcd",)),
}


def validate(records: dict[str, dict]) -> dict:
    """跑一遍验证用例，返回精度/召回统计。records: slug -> {'blocks': [...]}"""
    total = hit = 0
    violations: list[str] = []
    misses: list[str] = []
    for slug, (want, forbid) in CASES.items():
        rec = records.get(slug)
        if not rec or not rec.get("blocks"):
            continue
        ev = analyze_blocks(rec["blocks"])
        got = set(ev)
        for aid in forbid:
            if aid in got:
                violations.append(f"{slug}: 误判 {aid}")
        ok = [aid for aid in want if aid in got]
        total += len(want)
        hit += len(ok)
        for aid in want:
            if aid not in got:
                misses.append(f"{slug}: 漏判 {aid}（认出 {sorted(got)[:6]}）")
    return {"recall": f"{hit}/{total}", "violations": violations, "misses": misses}


def load_code_records(path: str | None = None) -> dict[str, dict]:
    """读抓下来的题解代码：slug -> {'blocks': [...]}。"""
    import json
    import pathlib

    p = pathlib.Path(path) if path else pathlib.Path(__file__).parent / "data/raw/solution_code.jsonl"
    out: dict[str, dict] = {}
    if not p.exists():
        return out
    with p.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = rec.get("_key")
            if key:
                out[key] = rec
    return out


# --- 代码证据 → 标签体系 --------------------------------------------------------
# 思路指纹管「两道题像不像」，标签管「这题该归到哪个专题下练」，两件事分开。
# 有几个思路（摩尔投票、公式推导、分块）在 65 个子标签里没有合适的位置，
# 就只留作指纹、不硬塞进某个专题 —— 硬塞会把专题稀释掉。
CODE_TO_TAG: dict[str, str] = {
    "tree-preorder": "tree-traversal", "tree-inorder": "tree-traversal",
    "tree-postorder": "tree-traversal", "tree-levelorder": "tree-traversal",
    "tree-morris": "tree-traversal", "tree-iterative": "tree-traversal",
    "tree-recursion": "tree-traversal", "bst-inorder": "bst",
    "tree-construct": "tree-build", "tree-serialize": "tree-build",
    "tree-lca": "tree-path",
    "graph-dfs": "dfs-basic", "graph-bfs": "bfs-shortest",
    "graph-union-find": "union-find", "graph-topo": "topo",
    "graph-dijkstra": "shortest-path", "graph-bellman": "shortest-path",
    "graph-floyd": "shortest-path", "graph-mst": "graph-advanced",
    "graph-bipartite": "graph-advanced", "graph-scc": "graph-advanced",
    "graph-euler": "graph-advanced", "graph-flow": "graph-advanced",
    "dp-memo": "memo-search", "dp-1d": "dp-linear", "dp-2d": "dp-linear",
    "dp-knapsack-01": "dp-knapsack", "dp-knapsack-full": "dp-knapsack",
    "dp-knapsack": "dp-knapsack", "dp-interval": "dp-interval",
    "dp-tree": "dp-tree", "dp-bitmask": "dp-bitmask", "dp-digit": "dp-digit",
    "dp-lis": "dp-sequence", "dp-lcs": "dp-sequence", "dp-machine": "dp-machine",
    "dp-prob": "probability", "dp-opt": "monotonic",
    "math-sieve": "number-theory", "math-fast-pow": "number-theory",
    "math-fermat": "number-theory", "math-euler-phi": "number-theory",
    "math-gcd": "number-theory", "math-mod": "number-theory",
    "math-base": "number-theory", "math-inclusion": "combinatorics",
    "math-catalan": "combinatorics", "math-combi": "combinatorics",
    "math-xor": "bit", "math-geometry": "geometry", "math-game": "game-theory",
    "monotonic-stack": "monotonic", "monotonic-queue": "monotonic",
    "sliding-window": "sliding-window", "two-pointers": "two-pointers",
    "fast-slow": "two-pointers", "prefix-sum": "prefix-sum",
    "diff-array": "prefix-sum", "sweep-line": "interval",
    "binary-search": "bs-array", "binary-search-answer": "bs-answer",
    "heap": "heap", "quickselect": "quickselect", "merge-sort": "divide-conquer",
    "hash": "hash-count", "sort-then": "sorting", "stack-sim": "stack-queue",
    "deque": "stack-queue", "trie": "trie", "segment-tree": "segment-tree",
    "fenwick": "fenwick", "ordered-set": "ordered-set",
    "list-reverse": "linked-list", "list-dummy": "linked-list",
    "list-merge": "linked-list",
    "backtracking": "backtracking", "pruning": "backtracking",
    "bidirectional": "search-advanced", "astar": "search-advanced",
    "kmp": "string-match", "zfunc": "string-match", "rolling-hash": "string-match",
    "manacher": "palindrome", "palindrome-center": "palindrome",
    "string-scan": "string-basic",
    "greedy": "greedy-basic", "exchange-argument": "greedy-basic",
    "simulate": "simulation", "brute-force": "enumeration", "bit-enum": "bit",
    "design": "ds-design", "concurrency": "concurrency", "sql": "db-shell",
}


def _base_weight(specificity: float) -> int:
    """越具体的解法，作为标签越可信：KMP 出现在代码里几乎就等于这题考 KMP，
    「用了哈希表」则说明不了什么。"""
    if specificity >= 3.0:
        return 88
    if specificity >= 2.5:
        return 80
    if specificity >= 2.0:
        return 70
    if specificity >= 1.5:
        return 58
    return 38


def tag_seeds(evidence: dict[str, float], weight_of: dict[str, float],
              src: str = "题解代码", scale: float = 1.0) -> list[tuple[str, int, str]]:
    """把代码证据翻译成 taxonomy.tag_problem() 认识的 seeds。

    权重 = 解法本身的具体程度 × 证据强度 × 通道折扣。
    题面推理走同一条路，只是折扣低一点（``scale``）—— 推出来的不如看见的硬。
    """
    seeds: list[tuple[str, int, str]] = []
    for aid, strength in evidence.items():
        sub = CODE_TO_TAG.get(aid)
        if not sub:
            continue
        base = _base_weight(weight_of.get(aid, 1.0))
        seeds.append((sub, round(base * (0.6 + 0.4 * min(strength, 1.0)) * scale), src))
    return seeds


if __name__ == "__main__":
    recs = load_code_records()
    print(f"题解代码：{len(recs)} 题，其中 {sum(1 for r in recs.values() if r.get('blocks'))} 题有代码块")
    report = validate(recs)
    print(f"召回: {report['recall']}    误判: {len(report['violations'])}")
    for line in report["violations"]:
        print("  !", line)
    for line in report["misses"]:
        print("  -", line)
