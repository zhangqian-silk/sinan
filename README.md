# 司南 sinan

跑在终端里的刷题训练台。从六千多道题里告诉你**该做哪些、按什么顺序做**，
而不是再给你一份题号列表。

题库覆盖 LeetCode 全量 + 洛谷，叠加 CodeTop 面试频次和 28 份官方/公司题单。
每道题按多标签解法体系打标（13 个大类 / 65 个子标签），再按**真实解法思路**
算相似度、按思路递进和最小覆盖生成学习计划。终端和网页共用同一份数据与规划逻辑。

```bash
npx sinan sync        # 抓数据 + 打标构建（首次，约十几分钟）
npx sinan             # 概览
npx sinan serve       # 网页端 → http://127.0.0.1:8848
```

## 「这题考什么」是怎么判出来的

不是从官方标签抄的。官方标签只说「这题和数学有关」，说不出一道用埃氏筛、
一道用快速幂 —— 而这两道题彼此毫无可替代性。所以解法判定走**三条互相独立的证据通道**，
交叉印证：

| 通道 | 依据 | 覆盖 |
| --- | --- | --- |
| 题解代码 | 26666 段社区题解代码，正则 + 缩进结构还原判遍历次序与递归 | 2456 题 |
| 自己读题面 | 问法 + 数据范围 + 输入结构（`n ≤ 16` 该状压、`n` 到 `1e5` 排除二维 DP） | 810 题 |
| 题解措辞 | 题解标题与自带标签，兜底 | 609 题 |

其中 279 题被两条以上通道同时指出，可信度显著提高。反过来，**有代码摆在那儿却没这么写**
本身就是反证，纯文字证据要打折。每道题都能翻出「我为什么这么判」：

```bash
sinan show 875        # 解法标签 + 判定依据 + 相似题 + 题面 + 我的题解
```

## 学习计划不是题号列表

一个专题里几十上百道题，真正需要动手的只有一小部分，剩下多半是同一个知识点组合的变体。
所以先算「谁能代表谁」（思路指纹重合 + 相似度达标 + 同平台 + 两边都有真实证据），
再用贪心最小覆盖挑代表题，最后按**难度 → 思路数量 → 重要度**排成递进路径。

难度配比默认 `depth`：先用简单/中等题把覆盖打足建立手感，再把困难题作为**增量的深度层**
叠上去。依据是实测数据 —— 困难题能替代掉的题数并不比简单题多（5.05 vs 4.91），
但平均带 1.22 个硬技巧（简单题只有 0.35），而线段树、状压 DP、Tarjan 这类技巧只存在于困难题里。

```bash
sinan routes                      # 4 条主线：入门筑基 / 面试冲刺 / 进阶通关 / 补弱项
sinan plan starter                # 展开：30 题 · 跨 10 个专题 · 约 11 小时
sinan plan monotonic --minimal    # 单调栈，只给最少的代表题
sinan plan hot100 --day 5         # 热题 100，按每天 5 题切
```

> 4 条主线才是「学习计划」。13 个大类 / 65 个子标签 / 28 份题单是**专题** ——
> 练习素材的索引，可以按需即时生成计划，但它们本身不是计划。

## 每个专题都有讲解

```bash
sinan learn monotonic   # 核心思想 / 什么时候想到它 / 模板骨架 / 常见坑 / OI-Wiki
```

78 张教学卡片，OI-Wiki 延伸阅读的链接全部核过。其中「什么时候想到它」不是手写的，
而是直接引用打标规则表算出来的 —— 那批规则本来就是「看到这种问法 → 该用这个解法」，
所以教学写的判断依据和系统实际打标的依据是同一份数据，不可能漂移。

## 全部命令

```
sinan                       概览
sinan topics [大类]         标签体系：13 个大类 / 65 个子标签
sinan lists                 特殊题单：热题 100、面试经典 150、CodeTop 公司榜…
sinan routes                学习计划：4 条跨专题的主线
sinan approaches [领域]     题解思路词表
sinan list [关键词]         题库查询（按大类/子标签/思路/难度/题单/来源筛）
sinan show <题>             题目详情
sinan plan <主线|专题>      展开主线，或按专题即时生成计划
sinan learn <专题>          专题讲解
sinan next                  下一步该做什么
sinan done <题>...          打卡 / 取消打卡
sinan stats                 题库统计
sinan serve                 网页端
sinan sync                  抓数据 + 重新构建
sinan where                 数据、题解、打卡记录分别在哪
```

`sinan <子命令> --help` 看每个命令的选项。

## 安装

```bash
npm i -g sinan     # 或者不装，直接 npx sinan
```

只需要 Node 20+，零运行时依赖 —— HTTP 服务、参数解析、抓取、打标构建全部走 Node
内置能力，不装任何第三方包。

## 数据放在哪

题库数据几十 MB，**不进 git、不进 npm 包**，由 `sinan sync` 抓取生成。
三样东西的位置都可以覆盖，优先级是「命令行参数 > 环境变量 > 配置文件 > 约定位置」：

| | 默认位置 | 覆盖方式 |
| --- | --- | --- |
| 构建产物 | `~/.sinan/data/dist` | `--data-dir` / `SINAN_DATA` |
| 本地题解 | 未配置 | `--solutions`（可重复）/ `SINAN_SOLUTIONS`（`:` 分隔） |
| 打卡记录 | `~/.sinan/progress.json` | `SINAN_HOME` |

本地题解目录里，**文件名以题号开头**的文件会被认成「这题刷过了」
（`0146. LRU 缓存机制.py`、`42_trapping_rain_water.go` 都认）。配置文件长这样：

```json
// ~/.sinan/config.json
{
  "solutions": ["~/code/leetcode/all_codes", "~/code/leetcode/go"]
}
```

跑 `sinan where` 可以确认当前实际用的是哪几个路径。

## 开发

```
src/
  store.ts          加载产物、查询、六维分面、进度
  planner.ts        谁能代表谁、贪心最小覆盖、4 条主线
  render.ts         终端渲染：中英混排对齐、颜色、表格
  cli.ts / args.ts  15 个子命令与参数解析
  serve.ts          Web 端：静态页面 + 一组 JSON 接口
  notes/            78 张教学卡片；识别信号从打标规则直接反查
  build/
    pyre.ts         Python 正则语义翻译（\b \w 按 Unicode 口径）
    codeprint.ts    读题解代码判解法，自带 37 条用例
    statement.ts    读题面判解法（57 条问法规则 + 数据范围），自带 45 条用例
    taxonomy.ts     13 大类 / 65 子标签的打标逻辑
    fingerprint.ts  三条证据通道合成思路指纹
    build.ts        打标 + 相似度 + 题单 → dist/*.json
    fetch/          六个抓取器，断点续传
    rules/          规则表：175 条标签映射 / 96 种思路 / 48 条代码探针 / 57 条问法规则
  test/             五层测试；fixtures/mini 是入库的 285 题迷你夹具
  tools/            开发用小工具：切夹具、体检 OI-Wiki 链接
web/                前端，无框架无构建
```

```bash
npm run build       # 编译
npm run lint        # tsc 管不到的那部分
npm test            # 全部测试；有抓取数据时会连带跑 82 条打标自检用例
npm run check:links # 体检教学卡片里的 86 个 OI-Wiki 链接（要联网）
```

改打标规则、改 planner、换夹具的流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 关于打标规则里的正则

`rules/*.data.ts` 里的正则按 **Python 的语义**书写，编译时由 `pyre.ts` 翻译。
原因是两处真实差异：Python 的 `\w` 认中日韩、JS 的只认 ASCII，所以 `\bdfs\b`
直接照搬会让「用dfs解」凭空命中；而开启 `u` 标志（`\p{...}` 需要）之后，
JS 又会拒绝 `\-` 这类 Python 容忍的多余转义。翻译层把这两件事一起处理掉，
250+ 条规则都有编译用例守着。

## 致谢与声明

本项目与 LeetCode、洛谷、CodeTop、OI-Wiki 均无隶属关系。
发布物不包含任何平台的题面原文，只保留题号、标题、难度等元数据和指向原站的链接；
题面通过 `sinan sync` 在本地抓取，仅供个人学习使用。

- <https://leetcode.cn/problemset/>
- <https://www.luogu.com.cn/problem/list>
- <https://codetop.cc/home>
- <https://oi-wiki.org/>

MIT License。
