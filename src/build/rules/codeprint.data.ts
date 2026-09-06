/**
 * 读题解代码判解法：词级探针、组合探针、结构正则，以及自检用例。
 *
 * 由 scripts/gen_rules.py 从原 Python 规则表搬运而来，正则源码原样保留，
 * 语义翻译交给 pyre.py()。改规则请改这里。
 */


/** [思路 id, 正则] —— 代码里出现这个写法就算这个思路 */
export type TokenProbe = [string, string];
/** [思路 id, 正则 A, 正则 B, 行窗口] —— A 和 B 在相邻若干行内同时出现才算 */
export type NearProbe = [string, string, string, number];

export const TOKEN_PROBES: TokenProbe[] = [
  ["graph-bfs", "popleft\\(\\)|\\.poll\\(\\)|\\.pop\\(0\\)|\\.removeFirst\\(\\)|\\bq\\.front\\(\\)|queue\\.front\\(\\)"],
  ["tree-levelorder", "for\\s+_\\s+in\\s+range\\(\\s*len\\(\\s*\\w*(q|que|queue|dq|deque|cur|level|nodes|tmp)\\w*\\s*\\)\\s*\\)|\\b(size|sz|n|cnt|count|levelSize)\\s*=\\s*\\w*(q|que|queue|dq|deque|level|nodes)\\w*\\.size\\(\\)|\\blen\\s*\\(\\s*\\w*(q|que|queue|dq|level)\\w*\\s*\\)[\\s\\S]{0,60}?for\\b"],
  ["heap", "\\bheapq\\b|heappush|heappop|PriorityQueue<|priority_queue<|nlargest\\(|nsmallest\\("],
  ["graph-union-find", "parent\\s*\\[\\s*\\w+\\s*\\]\\s*=\\s*find\\(|def\\s+union\\s*\\(|void\\s+union\\s*\\(|\\bUnionFind\\b|\\bDSU\\b"],
  ["trie", "\\bTrie\\b|children\\s*=\\s*\\[?\\s*(None|\\{\\}|new\\s+\\w+\\[26\\])|\\bchildren\\[|next\\s*\\[\\s*26\\s*\\]"],
  ["segment-tree", "lazy\\s*\\[|pushDown|pushdown|build\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*,\\s*\\w+\\s*\\)|4\\s*\\*\\s*(n|len)|node\\s*<<\\s*1|2\\s*\\*\\s*node\\b"],
  ["fenwick", "[-+]=\\s*\\w+\\s*&\\s*\\(?\\s*-\\s*\\w+|lowbit|&\\s*\\(-\\s*\\w+\\s*\\)"],
  ["math-sieve", "range\\(\\s*\\w+\\s*\\*\\s*\\w+\\s*,\\s*[^,)]+,\\s*\\w+\\s*\\)|for\\s*\\(\\s*\\w+\\s+\\w+\\s*=\\s*\\w+\\s*\\*\\s*\\w+\\s*;"],
  ["math-fast-pow", "(>>=\\s*1|//=\\s*2|/=\\s*2)[\\s\\S]{0,120}?(&\\s*1|%\\s*2)|(&\\s*1|%\\s*2)[\\s\\S]{0,120}?(>>=\\s*1|//=\\s*2)|pow\\(\\s*\\w+\\s*,\\s*\\w+\\s*,\\s*\\w+\\s*\\)"],
  ["math-xor", "\\^=|\\^\\s*nums|\\bxor\\b|bin\\(\\s*\\w+\\s*\\)\\.count|bit_count\\(\\)|popcount|Integer\\.bitCount"],
  ["math-gcd", "math\\.gcd|\\bgcd\\s*\\(|\\bGCD\\s*\\("],
  ["math-base", "%\\s*10\\b[\\s\\S]{0,60}?(//=?\\s*10|/=\\s*10|/\\s*10\\b)|(//=?\\s*10|/=\\s*10)[\\s\\S]{0,60}?%\\s*10\\b|divmod\\s*\\(\\s*\\w+\\s*,\\s*10\\s*\\)|\\*\\s*10\\s*\\+\\s*\\w+\\s*%\\s*10|int\\s*\\(\\s*str\\s*\\(|\\bstr\\s*\\(\\s*\\w+\\s*\\)\\s*\\[\\s*::\\s*-\\s*1\\s*\\]"],
  ["math-moore", "\\+=\\s*1\\s+if\\s+[\\w\\[\\]\\.]+\\s*==\\s*[\\w\\[\\]\\.]+\\s+else\\s+-\\s*1|(\\+=|-=)\\s*[^;\\n]*\\?\\s*1\\s*:\\s*-\\s*1|(candidate|cand|major\\w*)\\b[\\s\\S]{0,200}?(count|cnt|votes?)\\b[\\s\\S]{0,60}?(\\+\\+|--|\\+=\\s*1|-=\\s*1)"],
  ["math-combi", "\\bcomb\\(|factorial|binom|C\\s*\\[\\s*\\w+\\s*\\]\\s*\\[\\s*\\w+\\s*\\]"],
  ["prefix-sum", "\\w*(pre|prefix|pre_?sum|presum)\\w*\\s*\\[\\s*\\w+\\s*\\+\\s*1\\s*\\]\\s*=|itertools\\.accumulate|\\baccumulate\\("],
  ["diff-array", "\\bdiff\\s*\\[\\s*\\w+\\s*\\]\\s*\\+=|\\bd\\s*\\[\\s*\\w+\\s*\\+\\s*1\\s*\\]\\s*-="],
  ["binary-search", "(mid|mi|m)\\s*=\\s*\\(?\\s*\\w+\\s*\\+\\s*\\(?\\s*\\w+\\s*(-\\s*\\w+\\s*\\)?\\s*)?\\)?\\s*(//\\s*2|>>\\s*1|/\\s*2)|bisect_(left|right)|lower_bound|upper_bound"],
  ["two-pointers", "while\\s+\\(?\\s*\\w*(left|l|lo|i)\\b[\\s\\S]{0,6}<[\\s\\S]{0,6}\\w*(right|r|hi|j)\\b[\\s\\S]{0,220}?(right|r|hi|j)\\s*(-=\\s*1|--)"],
  ["fast-slow", "fast\\s*=\\s*fast(\\.next\\.next|->next->next|\\.next\\.next)|slow\\s*=\\s*slow\\.next[\\s\\S]{0,80}?fast\\s*=\\s*fast"],
  ["sort-then", "\\.sort\\(|sorted\\(|Arrays\\.sort|sort\\(\\s*\\w+\\.begin"],
  ["hash", "Counter\\(|defaultdict\\(|unordered_map<|HashMap<|new\\s+HashSet|unordered_set<"],
  ["dp-memo", "@cache|@lru_cache|@functools\\.cache|memo\\s*\\[|memo\\.get|unordered_map<[^>]*>\\s*memo|\\bmemo\\b\\s*="],
  ["graph-dijkstra", "\\bdijkstra\\b|\\bDijkstra\\b"],
  ["graph-dfs", "grid\\s*\\[[^\\]]+\\]\\s*\\[[^\\]]+\\]\\s*=\\s*['\\\"]?0['\\\"]?|visited\\s*\\[[^\\]]+\\]\\s*\\[[^\\]]+\\]\\s*=\\s*(True|true|1)|vis\\s*\\[[^\\]]+\\]\\s*\\[[^\\]]+\\]\\s*=\\s*(True|true|1)"],
  ["graph-topo", "indeg|inDegree|in_degree|topolog"],
  ["graph-mst", "kruskal|\\bprim\\b|minimum.?spanning"],
  ["ordered-set", "SortedList|SortedDict|TreeMap<|multiset<|std::set<"],
  ["kmp", "\\bkmp\\b|failure\\s*\\[|partial_match|\\bnxt\\s*\\[\\s*i\\s*\\]\\s*=\\s*j"],
  ["manacher", "manacher"],
  ["palindrome-center", "while\\s+\\w+\\s*>=\\s*0\\s+and\\s+\\w+\\s*<\\s*\\w+\\s+and\\s+s\\[\\s*\\w+\\s*\\]\\s*==\\s*s\\[|expand(AroundCenter|Center)?\\s*\\("],
  ["rolling-hash", "\\bhash\\s*=\\s*\\(?\\s*hash\\s*\\*|\\bBASE\\b|\\bMOD\\b\\s*=\\s*\\d{6,}"],
  ["design", "class\\s+(LRUCache|LFUCache|MyQueue|MyStack|Twitter|RandomizedSet|Skiplist)"],
  ["bit-enum", "for\\s+\\w+\\s+in\\s+range\\(\\s*1\\s*<<|1\\s*<<\\s*n|for\\s*\\(\\s*int\\s+\\w+\\s*=\\s*0\\s*;\\s*\\w+\\s*<\\s*\\(\\s*1\\s*<<"],
  ["quickselect", "partition\\s*\\(|nth_element|quickSelect|quick_select"],
  ["merge-sort", "merge\\s*\\(\\s*\\w+\\s*,\\s*\\w+\\s*,\\s*\\w+|mergeSort|merge_sort"],
  ["dp-interval", "\\w+\\s*\\[\\s*\\w+\\s*\\]\\s*\\[\\s*(k|m|mid|p)\\s*\\][\\s\\S]{0,50}?\\[\\s*(k|m|mid|p)\\s*(\\+\\s*1\\s*)?\\]\\s*\\[|\\[\\s*\\w+\\s*\\+\\s*1\\s*\\]\\s*\\[\\s*\\w+\\s*-\\s*1\\s*\\]|\\b(\\w+)\\s*\\(\\s*\\w+\\s*,\\s*(\\w+)\\s*\\)\\s*\\+\\s*\\4\\s*\\(\\s*\\5\\s*,|for\\s+(len|length|L|size)\\w*\\s+in\\s+range\\(\\s*[23]\\s*,|for\\s*\\(\\s*int\\s+(len|length|L)\\w*\\s*=\\s*[23]\\s*;"],
  ["dp-bitmask", "\\b(dp|f|g|memo)\\s*\\[\\s*1\\s*<<|\\b(dp|f|g|memo)\\s*\\[[^\\]]*\\bmask\\b|\\bmask\\s*\\^\\s*\\(?\\s*1\\s*<<|\\bmask\\s*(&|\\|)\\s*\\(?\\s*1\\s*<<"],
];

export const NEAR_PROBES: NearProbe[] = [
  ["monotonic-stack", "while\\s*\\(?\\s*!?\\s*\\w*(stack|stk|st)\\w*(\\.isEmpty\\(\\)|\\.empty\\(\\)|\\s|\\))*(&&|and)\\s", "(pop|pop_back|removeLast)\\s*\\(", 4],
  ["monotonic-queue", "while\\s*\\(?\\s*!?\\s*\\w*(q|que|deque|dq|window|win)\\w*(\\.isEmpty\\(\\)|\\.empty\\(\\)|\\s|\\))*(&&|and)\\s", "(pop\\(\\)|pop_back|pollLast|removeLast)", 4],
  ["sliding-window", "(for|while)[^\\n]*\\b(right|r|j|end)\\b", "\\b(left|l|start|lo)\\s*(\\+=\\s*1|\\+\\+)", 12],
  ["stack-sim", "\\w*(stack|stk|st)\\w*\\.(append|push|push_back)\\s*\\(", "(pop|pop_back)\\s*\\(", 12],
  ["backtracking", "\\w+\\.(append|add|push_back|push)\\s*\\(", "(dfs|DFS|backtrack|helper|recur|solve|self\\.\\w+|this\\.\\w+)\\s*\\([\\s\\S]{0,240}?\\w*\\.(pop|pop_back|removeLast|erase)\\s*\\(", 10],
  ["graph-dfs", "(dirs?|directions|DIR)\\s*=\\s*[\\[\\(]|\\{\\{-?1\\s*,|for\\s+d[xy]?,\\s*d[xy]\\s+in", "(dfs|DFS|bfs)\\s*\\(", 24],
  ["graph-dijkstra", "(heappop|heappush|\\.poll\\(\\)|\\.push\\(|pq\\.top\\(\\)|\\.offer\\()", "\\b(dis|dist|d)\\w*\\s*\\[[^\\]]+\\]\\s*=\\s*\\w", 14],
  ["graph-dijkstra", "\\b(done|visited|vis|used)\\b[\\s\\S]{0,20}(\\[|=)", "\\b(dis|dist)\\w*\\s*\\[\\s*\\w+\\s*\\]\\s*<\\s*(dis|dist)\\w*\\s*\\[\\s*\\w+\\s*\\]", 12],
  ["math-moore", "if\\s*\\(?\\s*(count|cnt|votes?|hp|freq)\\s*==\\s*0\\s*\\)?\\s*[:{]", "(\\+\\+|\\+=\\s*1)[\\s\\S]{0,200}?(--|-=\\s*1)|(--|-=\\s*1)[\\s\\S]{0,200}?(\\+\\+|\\+=\\s*1)", 12],
  ["graph-dfs", "(dfs|DFS|flood\\w*)\\s*\\(\\s*\\w+\\s*[-+]\\s*1\\s*,", "\\b(grid|board|matrix|adj|graph|neighbo\\w*)\\b", 10],
  ["graph-dfs", "(visited|vis|seen)\\s*\\.\\s*(add|insert)\\s*\\(|(visited|vis|seen)\\s*\\[\\s*\\w+\\s*\\]\\s*=\\s*(True|true|1)", "(dfs|DFS)\\s*\\(", 8],
];

/** 散落的结构正则，源码原样搬。 */
export const RAW = {
  VISIT_RE: "(\\.val|->val|\\bval\\b)[\\s\\S]{0,40}?(append|push_back|add|push|res|ans|out|\\+=)|(append|push_back|add|push)\\s*\\([^)]*(\\.val|->val)",
  DEF_RE: "^\\s*(?:def\\s+(\\w+)|(?:public|private|static|void|int|bool|boolean|char|TreeNode\\*?|vector<[^>]*>|func)\\s+(\\w+)\\s*\\()",
  COMBINE_RE: "(\\breturn\\b|=)[^\\n]*(max|min|\\+|\\|\\||&&|\\band\\b|\\bor\\b|,)",
  BITSTATE_RE: "\\^\\s*\\(?\\s*1\\s*<<|\\|\\s*\\(?\\s*1\\s*<<|>>\\s*\\w+\\s*&\\s*1|\\*\\s*\\(\\s*1\\s*<<|\\[\\s*1\\s*<<",
  REVERSE_LOOP: "while\\s*\\(?\\s*\\w*(left|l|lo|i|start)\\w*\\s*<\\s*\\w*(right|r|hi|j|end)\\w*\\s*\\)?\\s*[:{][\\s\\S]{0,220}?(swap\\s*\\(|temp\\s*=\\s*\\w+\\s*\\[|\\w+\\s*\\[[^\\]]+\\]\\s*,\\s*\\w+\\s*\\[[^\\]]+\\]\\s*=\\s*\\w+\\s*\\[)",
  TREE_HINT: "\\bTreeNode\\b|\\.left\\b|\\.right\\b|->left\\b|->right\\b|\\bleft\\s*,\\s*right\\b",
  GRAPHY_HINT: "\\bgrid\\b|\\badj\\b|\\bgraph\\b|neighbo|\\bvisited\\b|\\bseen\\b|\\bboard\\b",
  ASSIGN_FROM_CALL: "(?:\\w+\\s+)?(\\w+)\\s*=\\s*[^=\\n]*\\b%s\\s*\\(",
  SELF_CALL_TPL: "\\b%s\\s*\\(",
} as const;

/** 代码证据 -> 标签体系。有几个思路在 65 个子标签里没有合适位置，就只留作指纹。 */
export const CODE_TO_TAG: Record<string, string> = {"tree-preorder": "tree-traversal", "tree-inorder": "tree-traversal", "tree-postorder": "tree-traversal", "tree-levelorder": "tree-traversal", "tree-morris": "tree-traversal", "tree-iterative": "tree-traversal", "tree-recursion": "tree-traversal", "bst-inorder": "bst", "tree-construct": "tree-build", "tree-serialize": "tree-build", "tree-lca": "tree-path", "graph-dfs": "dfs-basic", "graph-bfs": "bfs-shortest", "graph-union-find": "union-find", "graph-topo": "topo", "graph-dijkstra": "shortest-path", "graph-bellman": "shortest-path", "graph-floyd": "shortest-path", "graph-mst": "graph-advanced", "graph-bipartite": "graph-advanced", "graph-scc": "graph-advanced", "graph-euler": "graph-advanced", "graph-flow": "graph-advanced", "dp-memo": "memo-search", "dp-1d": "dp-linear", "dp-2d": "dp-linear", "dp-knapsack-01": "dp-knapsack", "dp-knapsack-full": "dp-knapsack", "dp-knapsack": "dp-knapsack", "dp-interval": "dp-interval", "dp-tree": "dp-tree", "dp-bitmask": "dp-bitmask", "dp-digit": "dp-digit", "dp-lis": "dp-sequence", "dp-lcs": "dp-sequence", "dp-machine": "dp-machine", "dp-prob": "probability", "dp-opt": "monotonic", "math-sieve": "number-theory", "math-fast-pow": "number-theory", "math-fermat": "number-theory", "math-euler-phi": "number-theory", "math-gcd": "number-theory", "math-mod": "number-theory", "math-base": "number-theory", "math-inclusion": "combinatorics", "math-catalan": "combinatorics", "math-combi": "combinatorics", "math-xor": "bit", "math-geometry": "geometry", "math-game": "game-theory", "monotonic-stack": "monotonic", "monotonic-queue": "monotonic", "sliding-window": "sliding-window", "two-pointers": "two-pointers", "fast-slow": "two-pointers", "prefix-sum": "prefix-sum", "diff-array": "prefix-sum", "sweep-line": "interval", "binary-search": "bs-array", "binary-search-answer": "bs-answer", "heap": "heap", "quickselect": "quickselect", "merge-sort": "divide-conquer", "hash": "hash-count", "sort-then": "sorting", "stack-sim": "stack-queue", "deque": "stack-queue", "trie": "trie", "segment-tree": "segment-tree", "fenwick": "fenwick", "ordered-set": "ordered-set", "list-reverse": "linked-list", "list-dummy": "linked-list", "list-merge": "linked-list", "backtracking": "backtracking", "pruning": "backtracking", "bidirectional": "search-advanced", "astar": "search-advanced", "kmp": "string-match", "zfunc": "string-match", "rolling-hash": "string-match", "manacher": "palindrome", "palindrome-center": "palindrome", "string-scan": "string-basic", "greedy": "greedy-basic", "exchange-argument": "greedy-basic", "simulate": "simulation", "brute-force": "enumeration", "bit-enum": "bit", "design": "ds-design", "concurrency": "concurrency", "sql": "db-shell"};

/** 自检用例：题目 slug -> [必须认出来的, 绝对不能出现的] */
export const CASES: Record<string, [string[], string[]]> = {
  "binary-tree-preorder-traversal": [["tree-preorder"], ["kmp", "graph-dijkstra"]],
  "binary-tree-inorder-traversal": [["tree-inorder"], ["kmp", "graph-dijkstra"]],
  "binary-tree-postorder-traversal": [["tree-postorder"], ["kmp"]],
  "binary-tree-level-order-traversal": [["tree-levelorder"], ["kmp"]],
  "daily-temperatures": [["monotonic-stack"], ["graph-bfs", "kmp", "tree-inorder"]],
  "sliding-window-maximum": [["monotonic-queue"], ["kmp"]],
  "largest-rectangle-in-histogram": [["monotonic-stack"], ["graph-bfs"]],
  "number-of-islands": [["graph-dfs"], ["kmp", "monotonic-stack"]],
  "count-primes": [["math-sieve"], ["graph-bfs", "kmp"]],
  "coin-change": [["dp-1d"], ["kmp"]],
  "edit-distance": [["dp-2d"], ["kmp", "graph-bfs"]],
  "majority-element": [["math-moore"], ["kmp"]],
  "two-sum": [["hash"], ["graph-bfs", "kmp", "monotonic-stack"]],
  "lru-cache": [["design"], ["kmp", "math-sieve"]],
  "kth-largest-element-in-an-array": [["quickselect"], ["kmp"]],
  "course-schedule": [["graph-topo"], ["kmp"]],
  "network-delay-time": [["graph-dijkstra"], ["kmp"]],
  "search-in-rotated-sorted-array": [["binary-search"], ["kmp", "graph-bfs"]],
  "linked-list-cycle": [["fast-slow"], ["kmp", "math-sieve"]],
  "implement-trie-prefix-tree": [["trie"], ["kmp", "graph-bfs"]],
  "subsets": [["backtracking"], ["kmp", "graph-bfs"]],
  "powx-n": [["math-fast-pow"], ["kmp"]],
  "single-number": [["math-xor"], ["kmp", "graph-bfs"]],
  "merge-intervals": [["sort-then"], ["kmp", "graph-bfs"]],
  "longest-substring-without-repeating-characters": [["sliding-window"], ["kmp", "graph-bfs"]],
  "container-with-most-water": [["two-pointers"], ["kmp", "graph-bfs"]],
  "partition-to-k-equal-sum-subsets": [["dp-bitmask"], ["kmp", "sliding-window", "two-pointers"]],
  "range-sum-query-mutable": [["fenwick"], ["kmp"]],
  "burst-balloons": [["dp-interval"], ["kmp", "graph-bfs"]],
  "longest-palindromic-subsequence": [["dp-interval", "dp-2d"], ["kmp"]],
  "house-robber-iii": [["dp-tree", "tree-postorder"], ["kmp", "graph-dijkstra"]],
  "binary-tree-maximum-path-sum": [["tree-postorder"], ["kmp", "graph-bfs"]],
  "01-matrix": [["graph-bfs"], ["tree-levelorder", "kmp"]],
  "reverse-integer": [["math-base"], ["math-gcd", "kmp"]],
  "palindrome-number": [["math-base"], ["math-gcd"]],
};
