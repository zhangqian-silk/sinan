/**
 * 数据层的行为。
 *
 * 重点在两处容易改坏又不容易发现的地方：查询各条件的组合，
 * 以及分面计数「算某个维度时要排除该维度自身的条件」这条语义 ——
 * 写错了页面上不会报错，只会让筛选框里的数字变得没法比较。
 */

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { DIFF_RANK, sortProblems, Store } from "../store.js";
import { MINI_DIR, miniStore } from "./helpers.js";

const store = miniStore();

test("夹具装得起来，索引齐全", () => {
  assert.ok(store.problems.length > 200, `夹具只有 ${store.problems.length} 题`);
  assert.equal(store.bySlug.size, store.problems.length);
  assert.equal(store.cats.length, 13);
  assert.equal(store.subById.size, 65);
  assert.ok(store.curated.length > 5);
  // 大类按 order 排过序
  const orders = store.cats.map((c) => c.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test("query 各条件都生效，且可以叠加", () => {
  const all = store.query();
  assert.ok(all.every((p) => !p.paid), "默认不含会员题");

  for (const p of store.query({ tag: "monotonic" })) {
    assert.ok(p.tagIds.includes("monotonic"));
  }
  for (const p of store.query({ cat: "tree" })) assert.ok(p.cats.includes("tree"));
  for (const p of store.query({ source: "luogu" })) assert.equal(p.source, "luogu");
  for (const p of store.query({ hot: true })) assert.ok(p.freq > 0);
  for (const p of store.query({ multi: true })) assert.ok(p.catSpan >= 3);
  for (const p of store.query({ diffs: new Set(["HARD"]) })) assert.equal(p.difficulty, "HARD");

  // 叠加 = 取交集
  const both = store.query({ cat: "tree", diffs: new Set(["EASY"]) });
  for (const p of both) {
    assert.ok(p.cats.includes("tree"));
    assert.equal(p.difficulty, "EASY");
  }
  assert.ok(both.length < store.query({ cat: "tree" }).length);
});

test("query 的关键词搜题号、标题、标签、思路", () => {
  const byId = store.query({ text: "42" });
  assert.ok(byId.some((p) => String(p.id) === "42"), "按题号搜不到");
  const byApproach = store.query({ approach: "单调栈" });
  assert.ok(byApproach.length > 0);
  for (const p of byApproach) {
    assert.ok((p.approach ?? []).some((a) => a.name.includes("单调")), `${p.slug} 不该命中`);
  }
});

test("分面计数排除自身维度 —— 选了大类之后，大类那一栏还要能互相比较", () => {
  const base = store.facets({});
  const withCat = store.facets({ cat: "tree" });

  // 大类维度不受 cat 条件影响（否则只剩 tree 一个有数字）
  assert.deepEqual(withCat["cats"], base["cats"], "算大类时没有排除 cat 条件");
  // 其它维度要收紧到交集
  const treeCount = base["cats"]["tree"];
  const subsTotal = Object.values(withCat["subs"]).reduce((a, b) => a + b, 0);
  assert.ok(subsTotal > 0);
  assert.ok(Object.keys(withCat["subs"]).length < Object.keys(base["subs"]).length,
    "选了大类之后子标签没有收窄");
  assert.equal(store.query({ cat: "tree" }).length, treeCount);
});

test("分面：选了子标签之后，各难度计数等于交集查询的结果", () => {
  const f = store.facets({ tag: "monotonic" });
  for (const [diff, n] of Object.entries(f["diffs"])) {
    assert.equal(n, store.query({ tag: "monotonic", diffs: new Set([diff]) }).length,
      `难度 ${diff} 的分面计数对不上`);
  }
});

test("members 的「值得练」筛选只会缩小池子，池子太小就不筛", () => {
  const topic = store.topics().get("monotonic")!;
  const full = store.members(topic);
  const quality = store.members(topic, { quality: true });
  assert.ok(quality.length <= full.length);
  for (const p of quality) assert.ok(full.some((q) => q.slug === p.slug));

  const tiny = store.topics().get("iterator")!;
  assert.deepEqual(
    store.members(tiny, { quality: true }).map((p) => p.slug),
    store.members(tiny).map((p) => p.slug),
    "池子不足 12 道时不该再筛");
});

test("findTopic 支持 id、名称与简写", () => {
  assert.equal(store.findTopic("monotonic")?.id, "monotonic");
  assert.equal(store.findTopic("单调栈与单调队列")?.id, "monotonic");
  assert.equal(store.findTopic("tree")?.kind, "cat");
  assert.equal(store.findTopic("__nope__"), null);
});

test("按题号排序：力扣在前、洛谷在后，数字段按数值比", () => {
  const rows = sortProblems(store.problems, "id");
  let lastLeet = -1;
  rows.forEach((p, i) => { if (p.source === "leetcode") lastLeet = i; });
  const firstOther = rows.findIndex((p) => p.source !== "leetcode");
  if (firstOther !== -1) assert.ok(lastLeet < firstOther, "题源没有分段");
  const nums = rows.filter((p) => p.source === "leetcode" && /^\d+$/.test(p.id)).map((p) => Number(p.id));
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), "数字题号没有按数值排");

  const byDiff = sortProblems(store.problems, "diff");
  const ranks = byDiff.map((p) => DIFF_RANK[p.difficulty]);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test("打卡往返：写进去、读出来、再取消", () => {
  const home = mkdtempSync(join(tmpdir(), "sinan-progress-"));
  const progressFile = join(home, "progress.json");
  const st = new Store({ dataDir: MINI_DIR, solutions: [], progressFile });
  const p = st.problems[0];
  assert.equal(st.isDone(p), false);
  assert.equal(st.toggleCheckin(p, "测试"), true);
  assert.equal(st.isDone(p), true);

  const reopened = new Store({ dataDir: MINI_DIR, solutions: [], progressFile });
  assert.equal(reopened.isChecked(p), true, "重新打开读不到打卡记录");
  assert.equal(reopened.toggleCheckin(p), false);
  assert.equal(new Store({ dataDir: MINI_DIR, solutions: [], progressFile }).isDone(p), false);
});

test("approachStats 汇总的题数与逐条查询一致", () => {
  const stats = store.approachStats();
  assert.ok(stats.length > 20);
  for (const s of stats.slice(0, 8)) {
    const n = store.problems.filter((p) => (p.approach ?? []).some((a) => a.id === s.id)).length;
    assert.equal(s.total, n, `${s.id} 的题数对不上`);
  }
});
