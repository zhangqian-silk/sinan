# 参与开发

```bash
npm ci
npm run build      # 编译
npm run lint       # tsc 管不到的那部分
npm test           # 编译后跑全部测试
```

需要 Node 22+。运行时零依赖，`devDependencies` 只有 TypeScript 和 ESLint。

## 测试是怎么分层的

| 层 | 跑在什么上 | 拦什么 |
| --- | --- | --- |
| 纯函数用例 | 无 | Python 语义对齐（取整、字宽、正则口径）、参数解析、思路重合度 |
| 教学卡片体检 | 规则表 | 卡片漏了子标签、id 拼错成了孤儿卡片 |
| planner / store | `src/test/fixtures/mini`（285 题，入库） | 覆盖表的硬门槛、贪心选题、分面语义 |
| CLI 冒烟 | 同上 | 渲染崩溃、占位符没替换、空结果分支、报错可读性 |
| 打标自检 | 真实抓取数据（没有就跳过） | 读代码 / 读题面判解法的召回与误判 |

前三层不需要网络也不需要题库，CI 里全量跑。

## 改了打标规则之后

规则表在 `src/build/rules/*.data.ts`，正则按 **Python 的语义**书写（`\b` `\w` 认中文），
编译时由 `src/build/pyre.ts` 翻译成 JS 等价写法。加规则时照着现有条目写就行，
`pyre.test.ts` 会保证每一条都能编译。

改完跑一遍打标自检（需要 `SINAN_DATA_ROOT` 指到有 `raw/` 的目录）：

```bash
SINAN_DATA_ROOT=~/.sinan/data npm test
```

## 改了 planner 之后

`planner.test.ts` 里有一份快照，固化了每个专题选出的代表题。改动打分或阈值会让它失败 ——
这是设计如此。确认改动是有意的之后：

```bash
UPDATE_GOLDEN=1 npm test    # 刷新快照
git diff src/test/fixtures/plans.golden.json   # 然后一定要看 diff
```

**看 diff 这一步不能省。** 快照的价值全在「代表题从 A 变成 B，我认可这个变化」这个确认动作上。

## 换一份夹具

迷你夹具是从完整产物里切出来的，挑的是能覆盖不同代码路径的专题（中等池子、
极小池子、大类、官方题单、跨平台题）。要重切：

```bash
SINAN_DATA=<完整 dist> npm run fixture
UPDATE_GOLDEN=1 npm test
```

夹具里**只有题目元数据**（题号、标题、难度、标签、思路指纹），没有任何题面原文。

## 提交约定

- 分支用 `codex/` 或 `feat/` 前缀
- 提交信息写清楚**为什么**这么改，不只是改了什么 —— 这个仓库里大量决策依赖于当时的
  实测数据（比如「困难题平均带 1.22 个硬技巧」），不记下来后人无从判断能不能推翻
