---
name: problem-review
description: 给 sinan 题库做人工判定：逐题分析各种解法、定标签、写进 reviews/*.jsonl。只用于评题，不用于改抓取流程或调打标脚本。
---

# 人工判定

有判定的题，标签整体以人工为准，覆盖脚本打标。

## 流程

1. 取题面（已评过的自动跳过）：
   ```bash
   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --route interview --limit 8
   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --topic monotonic
   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js 200 300 84
   ```
2. 逐题读题面和数据范围，写记录，追加到 `reviews/<批次名>.jsonl`。一批一个文件。
3. 重建并校验。

## 记录格式

一行一题：

```json
{"slug": "number-of-islands", "id": "200", "solutions": [{"tags": ["flood-fill", "dfs-basic", "matrix"], "name": "DFS 沉岛", "idea": "岛屿数 = 连通块个数。每遇到一块没处理过的陆地就把答案加一，再从它出发递归四个方向把整片陆地改成水 ——「沉岛」既标记了已访问，又不用额外开 visited。", "time": "O(mn)", "space": "O(mn) 递归栈最坏"}], "pitfall": "沉岛会改坏输入；不允许修改原网格时要额外开 visited。"}
```

| 字段 | 说明 |
| --- | --- |
| `slug` / `id` | 题目 slug 与题号 |
| `solutions` | 按上手顺序排，第一条是最简可行解 |
| `solutions[].tags` | 标签树上的节点 id，可以是任意层；一个解法用到几个技巧就写几个 |
| `solutions[].name` | 这个解法在本题里的叫法 |
| `solutions[].idea` | 这个技巧的核心思想落到本题上是什么样子 |
| `solutions[].time` / `space` | 两个都必填 |
| `pitfall` | 本题最容易错的地方，可选 |

标签 id 查这里：`src/build/rules/taxonomy.data.ts`。深层节点的父链由构建自动补，不用手写。

## 判定规则

- 常见解法都要列，不是只留最简的那个；但只列真的会有人写的，别凑数。只有一种解法就写一条。
- `idea` 讲「为什么是它」而不是「它是什么」：这个技巧的核心思想如何映射到本题、它省掉了什么。
- 不提出处（官方题解、题解区、社区），不写日期，不加「最简」「推荐」「第一条最好上手」这类补充语。
- 每种解法自己重新讲一遍，不引用现成题解的措辞。
- 脚本判错的直接纠正：主次颠倒、沾边标签、被官方标签或题解措辞带偏的，都改掉。
- 现有标签装不下这道题时，可以改标签树（`src/build/rules/taxonomy.data.ts`），改完同步 `LEAF_TAG_MAP` 与相关规则。

## 重建与校验

```bash
npm run build
node bin/sinan.js sync --skip-fetch --data-dir <数据根>/dist
SINAN_DATA=<数据根>/dist npm run fixture
SINAN_DIST=<数据根>/dist npm run baseline
SINAN_DATA_ROOT=<数据根> npm test
npm run lint
```

`npm test` 里守着判定的四条：标签必须在树上、至少落到二级节点、每条解法要有名字/说明/时间/空间、正文不许出现出处和日期。

学习计划快照变了先查根因 —— 哪道题的标签改动导致的、生产计划（完整数据）是否也受影响。确认是判定带来的正常后果，再 `UPDATE_GOLDEN=1 npm test` 刷新。
