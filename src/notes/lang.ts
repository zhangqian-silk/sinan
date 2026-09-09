/**
 * 语言基础速查：用某门语言写算法题时够用的最小代码示例。
 *
 * 这块和标签树、题库、学习计划都不相干 —— 它不挂题、不计进度、不进计划，纯粹是
 * 「手边忘了语法翻一眼」的参考卡。所以单独成模块，不塞进 taxonomy（塞进去会在
 * 知识刻度、覆盖率、min-cover 里冒出一个 0 题的假分区）。
 *
 * 两条自己定的规矩：
 * 1. 每段代码都能直接跑、直接用，只留算法题真会写到的写法，不做语言教程。
 * 2. 注释讲「为什么这么写 / 坑在哪」，不复述代码字面意思。
 *
 * 结构留了多语言的位子（GUIDES 是数组），当前先给 Python。
 */

export interface Snippet {
  /** 这段在解决什么 */
  title: string;
  /** 最小代码示例，行内注释讲要点 */
  code: string;
}

export interface LangSection {
  id: string;
  name: string;
  /** 一句话说明这一节覆盖什么 */
  blurb: string;
  snippets: Snippet[];
}

export interface LangGuide {
  id: string;
  name: string;
  /** 语言在算法题里的一句话定位 */
  tagline: string;
  sections: LangSection[];
}

const PYTHON: LangGuide = {
  id: "python",
  name: "Python",
  tagline: "整数天生无上限、标准库自带堆和有序二分，写起来最短 —— 代价是常数大，卡常题要留意。",
  sections: [
    {
      id: "io",
      name: "读入与输出",
      blurb: "力扣是补全函数、不用读入；洛谷 / ACM 要自己读。竞赛骨架就这几句。",
      snippets: [
        {
          title: "标准输入骨架",
          code: `import sys
input = sys.stdin.readline      # 换掉内置 input，省掉逐行开销

n = int(input())                # 读一个整数
a, b = map(int, input().split())          # 一行读多个整数
arr = list(map(int, input().split()))     # 读一整行成列表
# 读 n 行矩阵：
grid = [list(map(int, input().split())) for _ in range(n)]`,
        },
        {
          title: "输出",
          code: `print(ans)
print(*arr)                     # 用空格把列表摊平成一行
print("\\n".join(map(str, arr)))   # 大量输出一次性拼好再打，快很多`,
        },
      ],
    },
    {
      id: "arithmetic",
      name: "算术与数值",
      blurb: "加减乘除、整除取余、幂、绝对值、最值 —— 以及负数取整这个最常见的坑。",
      snippets: [
        {
          title: "四则与整除取余",
          code: `7 / 2       # 3.5   真除法，结果一定是 float
7 // 2      # 3     向下取整除法
7 % 2       # 1     取余，符号跟着除数走
-7 // 2     # -4    注意是向下取整，不是截断
divmod(7, 2)    # (3, 1)  商和余数一次拿到`,
        },
        {
          title: "幂、绝对值、最值",
          code: `2 ** 10         # 1024
pow(2, 10, MOD) # 带模的快速幂，比 (2 ** 10) % MOD 快
abs(-3)         # 3
max(a, b); min(a, b)
max(arr); sum(arr)
MOD = 10 ** 9 + 7   # 常用模数；整数无上限，不会溢出`,
        },
        {
          title: "常用数学",
          code: `import math
math.gcd(12, 18)    # 6
math.isqrt(10)      # 3   整数平方根，不会有浮点误差（3.8+）
math.inf            # 正无穷，初始化最值用
math.comb(5, 2)     # 组合数 C(5,2)=10（3.8+）`,
        },
      ],
    },
    {
      id: "variables",
      name: "变量与对象声明",
      blurb: "赋值、交换、解包、常量，以及给自定义对象定义排序规则。",
      snippets: [
        {
          title: "赋值、交换、解包",
          code: `x = 0
a = b = c = 0           # 一起置零
a, b = b, a            # 交换,不需要临时变量
first, *rest = [1, 2, 3, 4]    # first=1, rest=[2,3,4]
n = None               # 空值,判定用 if x is None
INF = float("inf")     # 正无穷`,
        },
        {
          title: "类型转换",
          code: `int("42"); str(42); float("1.5")
int("1010", 2)   # 二进制字符串转十进制 = 10
bin(10)          # '0b1010' ；oct / hex 同理
list("abc")      # ['a','b','c']
ord("a")         # 97 ；chr(97) == 'a'`,
        },
        {
          title: "可排序 / 可哈希的自定义对象",
          code: `from dataclasses import dataclass, field

@dataclass(order=True)      # 自动按字段顺序生成比较,能直接进堆 / 排序
class Item:
    cost: int
    name: str = field(compare=False)   # 不参与比较,只是附带数据`,
        },
      ],
    },
    {
      id: "control",
      name: "流程控制",
      blurb: "分支、三种 range 循环、break/continue、三元、推导式、并行遍历。",
      snippets: [
        {
          title: "分支与三元",
          code: `if x > 0:
    sign = 1
elif x == 0:
    sign = 0
else:
    sign = -1

y = a if cond else b     # 三元表达式`,
        },
        {
          title: "三种 range",
          code: `for i in range(n):            # 0, 1, ..., n-1
    ...
for i in range(1, n + 1):     # 1, 2, ..., n
    ...
for i in range(n - 1, -1, -1):    # 倒序 n-1, ..., 0
    ...`,
        },
        {
          title: "遍历技巧",
          code: `for x in arr: ...
for i, x in enumerate(arr): ...       # 同时要下标和值
for a, b in zip(xs, ys): ...          # 两个数组并排走
for k, v in d.items(): ...            # 遍历字典

while q:
    x = q.popleft()
    if seen(x): continue     # 跳过本轮
    if done(x): break        # 直接跳出`,
        },
        {
          title: "推导式",
          code: `squares = [i * i for i in range(n)]
evens = [x for x in arr if x % 2 == 0]     # 带过滤
pairs = [(i, j) for i in range(n) for j in range(i + 1, n)]   # 双层
seen = {x for x in arr}                     # 集合推导
idx = {x: i for i, x in enumerate(arr)}     # 字典推导`,
        },
      ],
    },
    {
      id: "strings",
      name: "字符串",
      blurb: "索引切片、拆分拼接、大小写判定、字母与数字的相互映射。",
      snippets: [
        {
          title: "索引与切片",
          code: `s = "abcde"
s[0]; s[-1]        # 首 / 末字符
s[1:3]             # 'bc'  左闭右开
s[::-1]            # 'edcba'  反转
len(s)`,
        },
        {
          title: "拆分、拼接、查找",
          code: `s.split()           # 按空白切
s.split(",")        # 按逗号切
"".join(chars)      # 拼字符串,别用 += 在循环里拼(O(n^2))
s.strip(); s.lower(); s.upper()
s.count("a"); s.find("b"); "ab" in s`,
        },
        {
          title: "字符与数字",
          code: `ord("a")            # 97
chr(97)             # 'a'
idx = ord(c) - ord("a")     # 小写字母映射到 0..25
c.isdigit(); c.isalpha()
int("7")            # 数字字符转数值
f"{x} + {y} = {x + y}"      # f-string 格式化`,
        },
      ],
    },
    {
      id: "containers",
      name: "容器操作",
      blurb: "list / dict / set / tuple 的声明与常用操作，以及二维数组的正确初始化。",
      snippets: [
        {
          title: "list —— 动态数组 / 栈",
          code: `a = [0] * n                        # 定长初始化
g = [[0] * m for _ in range(n)]    # 二维,必须这样写
a.append(x); a.pop()               # 尾部进出 O(1),当栈用
a.pop(0)                           # 头部弹出 O(n),要队列请用 deque
a[-1]                              # 栈顶
a.reverse(); a[::-1]               # 原地反转 / 生成反转副本`,
        },
        {
          title: "排序",
          code: `a.sort()                    # 原地升序
a.sort(reverse=True)        # 降序
a.sort(key=lambda t: (t[0], -t[1]))   # 先按第一维升,再按第二维降
b = sorted(a)               # 返回新列表,不动原数组`,
        },
        {
          title: "dict —— 哈希表",
          code: `d = {}
d[k] = d.get(k, 0) + 1      # 计数的惯用写法
d.setdefault(k, []).append(v)
k in d                      # 判存在 O(1)
for k, v in d.items(): ...`,
        },
        {
          title: "set / tuple",
          code: `seen = set()
seen.add(x); x in seen      # 去重 / 判存在 O(1)
seen.discard(x)             # 删除,不存在也不报错
a & b; a | b; a - b         # 交 / 并 / 差

t = (r, c)                  # 元组不可变,可以当 dict 键 / 进 set`,
        },
      ],
    },
    {
      id: "stdlib",
      name: "常用标准库",
      blurb: "算法题里几乎每题都会用到的几个：计数、双端队列、堆、二分、记忆化。",
      snippets: [
        {
          title: "collections",
          code: `from collections import Counter, defaultdict, deque

cnt = Counter(arr)          # 一行计数
cnt.most_common(2)          # 出现次数前 2 的 (值, 次数)

g = defaultdict(list)       # 访问不存在的键自动建空列表
g[u].append(v)              # 建图不用先判 key

q = deque([start])          # BFS 队列
q.append(x); q.popleft()    # 两端都是 O(1)`,
        },
        {
          title: "heapq —— 优先队列",
          code: `import heapq
heapq.heapify(a)            # 原地建小顶堆 O(n)
heapq.heappush(a, x)
top = heapq.heappop(a)      # 弹最小
# 大顶堆:存 -x,取出时再取反`,
        },
        {
          title: "bisect —— 有序数组二分",
          code: `import bisect
bisect.bisect_left(a, x)    # 第一个 >= x 的位置
bisect.bisect_right(a, x)   # 第一个 > x 的位置
bisect.insort(a, x)         # 插入并保持有序`,
        },
        {
          title: "记忆化 / 迭代器工具",
          code: `from functools import lru_cache

@lru_cache(maxsize=None)    # 自顶向下 DP,一行加缓存（3.9+ 可简写 @cache）
def dfs(i, j):
    ...

from itertools import accumulate, permutations, combinations
list(accumulate(a))         # 前缀和
permutations(a, 2)          # 全排列 / combinations 组合`,
        },
      ],
    },
    {
      id: "pitfalls",
      name: "易错点",
      blurb: "Python 写算法题最常踩的几个坑，单独拎出来。",
      snippets: [
        {
          title: "二维数组别用 * 复制",
          code: `g = [[0] * m] * n     # 错!n 行是同一个列表,改一行全变
g = [[0] * m for _ in range(n)]   # 对`,
        },
        {
          title: "可变默认参数",
          code: `def f(acc=[]):        # 错!默认列表只创建一次,跨调用共享
    ...
def f(acc=None):      # 对
    if acc is None:
        acc = []`,
        },
        {
          title: "负数取整与递归深度",
          code: `-7 // 2         # -4  向下取整
int(-7 / 2)     # -3  想要朝零截断用这个

import sys
sys.setrecursionlimit(10 ** 6)   # 深递归先抬上限,否则 RecursionError`,
        },
      ],
    },
  ],
};

export const GUIDES: LangGuide[] = [PYTHON];

export function langGuide(id?: string): LangGuide | null {
  if (!id) return GUIDES[0] ?? null;
  return GUIDES.find((g) => g.id === id) ?? null;
}

export function langSection(guide: LangGuide, sectionId: string): LangSection | null {
  return guide.sections.find((s) => s.id === sectionId) ?? null;
}
