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

const GO: LangGuide = {
  id: "go",
  name: "Go",
  tagline: "静态类型、编译快、常数小,卡常题稳;代价是啰嗦 —— 堆要自己实现接口,集合得用 map 模拟。",
  sections: [
    {
      id: "io",
      name: "读入与输出",
      blurb: "力扣是补全函数、不用读入;ACM / 洛谷要自己读。用带缓冲的读写,别用裸 fmt.Scan。",
      snippets: [
        {
          title: "标准输入骨架",
          code: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()          // 忘了 flush 就没有输出

	var n int
	fmt.Fscan(in, &n)          // 读一个整数,空白和换行都算分隔
	a := make([]int, n)
	for i := range a {
		fmt.Fscan(in, &a[i])   // 循环读一整行 / 一个矩阵
	}
	fmt.Fprintln(out, n)       // 走缓冲输出,比 fmt.Println 快得多
}`,
        },
        {
          title: "输出",
          code: `fmt.Fprintln(out, ans)        // 一个值 + 换行
fmt.Fprintln(out, x, y)       // 多个值用空格隔开

// 输出整段数组:用 Builder 拼,别在循环里一个个 Fprint(慢)
sb := &strings.Builder{}
for i, x := range a {
	if i > 0 {
		sb.WriteByte(' ')
	}
	sb.WriteString(strconv.Itoa(x))
}
fmt.Fprintln(out, sb.String())`,
        },
      ],
    },
    {
      id: "arithmetic",
      name: "算术与数值",
      blurb: "整除朝零截断(和 Python 相反)、取余符号跟被除数、int 是 64 位、溢出与 gcd 要自己管。",
      snippets: [
        {
          title: "四则与整除取余",
          code: `7 / 2        // 3    整数除法直接截断
-7 / 2       // -3   朝零截断(Python 是向下取整 -4)
7 % 2        // 1
-7 % 2       // -1   余数符号跟着被除数走
q, r := 7/2, 7%2    // 商和余数
1 << 20             // 位移拿 2 的幂`,
        },
        {
          title: "幂、绝对值、最值",
          code: `import "math"
math.Pow(2, 10)     // 1024,但返回 float64 有精度损失
math.Abs(-3.0)      // 3,只吃 float64
min(a, b); max(a, b)    // 内置,Go 1.21+;更早得自己写

func abs(x int) int { if x < 0 { return -x }; return x }   // 整数 abs 自己写
const MOD = 1_000_000_007   // int 在 64 位平台是 64 位,1e9 级不溢出`,
        },
        {
          title: "常用数学",
          code: `import "math"
math.MaxInt, math.MinInt    // int 上下界(1.17+),初始化最值用
math.MaxInt64
math.Inf(1)                 // 正无穷(float64)
math.Sqrt(10)               // float64

func gcd(a, b int) int { for b != 0 { a, b = b, a%b }; return a }   // 标准库没有整数 gcd`,
        },
      ],
    },
    {
      id: "variables",
      name: "变量与对象声明",
      blurb: "var 与 :=、零值、批量声明、常量、指针,以及结构体的定义。",
      snippets: [
        {
          title: "声明、交换、零值",
          code: `var x int          // 零值:int 0、string ""、bool false、slice/map/指针 nil
y := 42            // 短声明,自动推类型
a, b := 1, 2
a, b = b, a        // 交换,不需要临时变量
var (              // 批量声明
	n, m int
	s    string
)
const K = 100
p := &x            // 取地址;*p 解引用`,
        },
        {
          title: "类型转换",
          code: `n, _ := strconv.Atoi("42")   // string -> int(返回值 + error)
strconv.Itoa(42)             // int -> string
float64(n); int(f)           // 数值互转必须显式,不会隐式提升
strconv.ParseInt("1010", 2, 64)   // 二进制字符串转十进制
int(c - '0')                 // 数字字符转数值
string(rune(97))             // "a";别写 string(97)(vet 会警告)`,
        },
        {
          title: "结构体",
          code: `type Item struct {
	Cost int
	Name string
}
it := Item{Cost: 5, Name: "x"}
it2 := Item{5, "x"}          // 按字段顺序
// 排序 / 进堆见「容器」「标准库」:sort.Slice + 自定义 Less`,
        },
      ],
    },
    {
      id: "control",
      name: "流程控制",
      blurb: "if(可带初始化)、只有 for 一种循环、switch 不穿透、带标签的 break。",
      snippets: [
        {
          title: "分支",
          code: `if x > 0 {
	sign = 1
} else if x == 0 {
	sign = 0
} else {
	sign = -1
}

if v, ok := m[k]; ok {   // if 里带初始化,作用域只在这个 if
	use(v)
}
// Go 没有三元表达式,老实写 if`,
        },
        {
          title: "for 的几种形态",
          code: `for i := 0; i < n; i++ { }        // 经典
for i := n - 1; i >= 0; i-- { }   // 倒序
for cond { }                      // 相当于 while
for { }                           // 死循环,配 break

for i, x := range a { }           // 下标 + 值
for _, x := range a { }           // 只要值
for k, v := range m { }           // map:顺序随机!
for i, c := range s { }           // 字符串:i 是字节位,c 是 rune`,
        },
        {
          title: "switch 与标签",
          code: `switch x {
case 1, 2:          // 逗号并列多个值
	...
default:
	...
}
switch {            // 不带表达式 = if-else 链
case x > 0:
	...
}
// case 默认不穿透,要穿透用 fallthrough

outer:
for ... {
	for ... {
		break outer   // 一次跳出外层循环
	}
}`,
        },
      ],
    },
    {
      id: "strings",
      name: "字符串",
      blurb: "字符串是只读字节序列:索引拿到 byte、遍历拿到 rune,改动要转 []byte / []rune。",
      snippets: [
        {
          title: "索引与切片",
          code: `s := "abcde"
s[0]          // 97,是 byte 不是字符
len(s)        // 字节数(不是字符数)
s[1:3]        // "bc",子串是 O(1) 视图,不复制

r := []rune(s)          // 要按字符处理 / 含中文时转 rune
for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
	r[i], r[j] = r[j], r[i]     // 反转
}
string(r)`,
        },
        {
          title: "strings / 拼接",
          code: `import "strings"
strings.Split(s, ",")       // 切成 []string
strings.Fields(s)           // 按空白切
strings.Join(parts, "")     // 拼接
strings.ToLower(s); strings.TrimSpace(s)
strings.Count(s, "a"); strings.Index(s, "b"); strings.Contains(s, "ab")

var sb strings.Builder      // 拼大字符串用它,别用 +=(每次都复制,O(n^2))
sb.WriteByte('x'); sb.WriteString("yz")
sb.String()`,
        },
        {
          title: "字符与数字",
          code: `c := s[i]                   // byte
idx := int(c - 'a')         // 小写字母映射到 0..25
c >= '0' && c <= '9'        // 判数字
int(c - '0')                // 数字字符转数值
string(rune(97))            // "a"
fmt.Sprintf("%d+%d=%d", x, y, x+y)   // 格式化成字符串`,
        },
      ],
    },
    {
      id: "containers",
      name: "容器操作",
      blurb: "slice / map / 结构体,以及用 map 模拟 set;二维 slice 必须逐行 make。",
      snippets: [
        {
          title: "slice —— 动态数组 / 栈",
          code: `a := make([]int, n)         // 长度 n,全 0
a := make([]int, 0, n)      // 长度 0,预留容量 n(已知规模时更快)
a = append(a, x)            // 追加,可能触发扩容
a = a[:len(a)-1]            // 弹尾,当栈用
a[len(a)-1]                 // 栈顶

g := make([][]int, n)       // 二维:先建外层
for i := range g {
	g[i] = make([]int, m)   // 再逐行建,不能一步到位
}`,
        },
        {
          title: "map —— 哈希表",
          code: `m := map[string]int{}
m[k]++                      // 计数:不存在按零值 0 起算
v, ok := m[k]              // 判存在用两返回值
delete(m, k)
for k, v := range m { }     // 遍历,顺序随机`,
        },
        {
          title: "set(用 map 模拟)",
          code: `set := map[int]struct{}{}   // struct{} 不占空间
set[x] = struct{}{}         // 加入
_, ok := set[x]             // 判存在
delete(set, x)
// 图省事也可以用 map[int]bool,写起来更短`,
        },
        {
          title: "排序",
          code: `import "sort"
sort.Ints(a)                // 升序
sort.Sort(sort.Reverse(sort.IntSlice(a)))   // 降序
sort.Slice(a, func(i, j int) bool { return a[i] < a[j] })
sort.Slice(items, func(i, j int) bool {     // 多关键字
	if items[i].x != items[j].x {
		return items[i].x < items[j].x
	}
	return items[i].y > items[j].y
})`,
        },
      ],
    },
    {
      id: "stdlib",
      name: "常用标准库",
      blurb: "二分查、堆、字符串数字互转;堆要自己实现接口,是 Go 写题最啰嗦的一块。",
      snippets: [
        {
          title: "二分查找",
          code: `import "sort"
sort.SearchInts(a, x)       // 第一个 >= x 的下标,没有则返回 len(a)
sort.Search(n, func(i int) bool { return a[i] >= x })   // 通用二分
// 二分答案:在 [lo, hi) 上找第一个满足 check 的
sort.Search(hi-lo, func(i int) bool { return check(lo + i) }) + lo`,
        },
        {
          title: "堆(container/heap)",
          code: `import "container/heap"
// Go 的堆要自己定义类型实现 heap.Interface:
type Hp []int
func (h Hp) Len() int            { return len(h) }
func (h Hp) Less(i, j int) bool  { return h[i] < h[j] }   // 小顶堆
func (h Hp) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *Hp) Push(x any)         { *h = append(*h, x.(int)) }
func (h *Hp) Pop() any           { o := *h; n := len(o); x := o[n-1]; *h = o[:n-1]; return x }

h := &Hp{}
heap.Init(h)
heap.Push(h, 3)     // 入堆
top := heap.Pop(h)  // 弹最小;any 即 interface{}(1.18+)`,
        },
        {
          title: "slices / maps 包(1.21+)",
          code: `import "slices"
slices.Sort(a)              // 比 sort.Ints 更省事
slices.Max(a); slices.Min(a)
slices.Contains(a, x)
slices.Reverse(a)
slices.Index(a, x)         // 找不到返回 -1
// 老版本(< 1.21)没有这个包,回退用 sort + 手写`,
        },
      ],
    },
    {
      id: "pitfalls",
      name: "易错点",
      blurb: "Go 写算法题最常踩的几个坑,单独拎出来。",
      snippets: [
        {
          title: "二维 slice 不能一行建",
          code: `g := make([][]int, n)       // 只建了外层,里面全是 nil
for i := range g {
	g[i] = make([]int, m)   // 必须逐行 make
}`,
        },
        {
          title: "整除与取余和 Python 不同",
          code: `-7 / 2    // -3  朝零截断(Python 是 -4)
-7 % 2    // -1  符号跟被除数(Python 是 1)
// 想要向下取整,自己修正:
func floorDiv(a, b int) int { q := a / b; if (a%b != 0) && ((a < 0) != (b < 0)) { q-- }; return q }`,
        },
        {
          title: "range 是副本 / map 未初始化",
          code: `for _, x := range a { x *= 2 }   // 白改,x 是副本;要用 a[i] *= 2

var m map[int]int
m[1] = 1          // panic:nil map 不能写,要先 m = map[int]int{}

b := a[:2]
b = append(b, 99) // 可能复用底层数组,悄悄改到 a[2]`,
        },
      ],
    },
  ],
};

export const GUIDES: LangGuide[] = [PYTHON, GO];

export function langGuide(id?: string): LangGuide | null {
  if (!id) return GUIDES[0] ?? null;
  return GUIDES.find((g) => g.id === id) ?? null;
}

export function langSection(guide: LangGuide, sectionId: string): LangSection | null {
  return guide.sections.find((s) => s.id === sectionId) ?? null;
}
