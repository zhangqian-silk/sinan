/**
 * 学习计划的护栏。
 *
 * planner 是整个项目最容易悄悄改坏的一块：覆盖表的两条硬门槛、贪心的三档预算、
 * 跨专题去重、递进排序。这些逻辑改坏了不会抛异常，只会让选出来的代表题变差 ——
 * 所以这里分两层守：
 *
 * 1. **不变量**：无论数据怎么变都必须成立的性质（不跨平台代表、零重合不算代表、
 *    难度不回退、主线题量不超预算…）。它们描述的是设计意图，比数字断言经得起改动。
 * 2. **快照**：把每个专题选出的代表题固化下来，任何一处打分或阈值的改动都会显形。
 *    改动是有意的就跑 `UPDATE_GOLDEN=1 npm test` 刷新，然后**看 diff**。
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { overlap } from "../approach.js";
import * as planner from "../planner.js";
import { DIFF_RANK } from "../store.js";
import { FIXTURE_DIR, miniStore } from "./helpers.js";

const store = miniStore();
const GOLDEN = join(FIXTURE_DIR, "plans.golden.json");
const UPDATE = process.env["UPDATE_GOLDEN"] === "1";

/** 快照覆盖的专题：一个中等池子的子标签、一个极小池子、一个大类、一份题单，外加四条主线。 */
const SNAPSHOT_TOPICS = ["monotonic", "dp-interval", "iterator", "bs-answer", "tree"];
const SNAPSHOT_LISTS = ["lc:leetcode-75"];

// --- 不变量 --------------------------------------------------------------------

test("覆盖表：自反、对称，且绝不跨平台", () => {
  const pool = store.problems;
  const cover = planner.coverageMap(pool, store.similar());
  const srcOf = new Map(pool.map((p) => [p.slug, p.source]));

  for (const [slug, members] of cover) {
    assert.ok(members.has(slug), `${slug} 没有覆盖自己`);
    for (const other of members) {
      if (other === slug) continue;
      assert.equal(srcOf.get(other), srcOf.get(slug),
        `${slug}(${srcOf.get(slug)}) 跨平台代表了 ${other}(${srcOf.get(other)})`);
      assert.ok(cover.get(other)?.has(slug), `覆盖关系不对称：${slug} -> ${other}`);
    }
  }
});

test("覆盖表：纯标签猜出来的指纹没资格代表别人，也不该被别人代表", () => {
  const pool = store.problems;
  const cover = planner.coverageMap(pool, store.similar());
  const guessed = new Set(pool
    .filter((p) => !(p.approach ?? []).length || p.approach![0].from === "tags")
    .map((p) => p.slug));

  for (const slug of guessed) {
    assert.deepEqual([...(cover.get(slug) ?? [])], [slug],
      `${slug} 的指纹是猜的，却参与了代表关系`);
  }
});

test("覆盖表：没有任何共同思路的两道题不会互相代表", () => {
  const pool = store.problems;
  const cover = planner.coverageMap(pool, store.similar());
  const fp = new Map(pool.map((p) => [p.slug, p.approach ?? []]));
  let checked = 0;
  for (const [slug, members] of cover) {
    for (const other of members) {
      if (other === slug) continue;
      const a = fp.get(slug)!;
      const b = fp.get(other)!;
      assert.ok(a.some((x) => b.some((y) => y.id === x.id)),
        `${slug} 与 ${other} 思路零重合，却成了代表关系`);
      assert.ok(overlap(a, b) > 0);
      checked += 1;
    }
  }
  assert.ok(checked > 50, `只检查了 ${checked} 对代表关系，夹具可能退化了`);
});

test("重要度：频次越高越值得练，题单背书再加一档", () => {
  const base = { freq: 0, id: "1", acRate: 0.5 } as never;
  void base;
  const low = planner.importance({ freq: 0 } as never, false);
  const mid = planner.importance({ freq: 100 } as never, false);
  const high = planner.importance({ freq: 1000 } as never, false);
  assert.ok(low < mid && mid < high, "频次没有单调加分");
  assert.ok(planner.importance({ freq: 100 } as never, true) > mid, "题单背书没有加分");
});

test("每个专题：难度不回退、步骤都在池子里、理由和链接齐全", () => {
  for (const id of [...SNAPSHOT_TOPICS, ...SNAPSHOT_LISTS]) {
    const topic = store.topics().get(id)!;
    const plan = planner.planTopic(store, topic, { mode: "minimal" });
    const poolSlugs = new Set(store.members(topic, { quality: true }).map((p) => p.slug));
    assert.ok(plan.steps.length > 0, `${id} 一步都没排出来`);

    for (const sec of plan.sections) {
      const ranks = sec.steps.map((s) => DIFF_RANK[s.p.difficulty]);
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${id}/${sec.key} 难度回退了`);
    }
    for (const step of plan.steps) {
      assert.ok(poolSlugs.has(step.p.slug), `${id} 排进了池子外的题 ${step.p.slug}`);
      assert.ok(step.reasons.length > 0, `${step.p.slug} 没有「为什么选它」`);
      assert.ok(step.p.url, `${step.p.slug} 没有平台链接`);
      assert.ok(!step.covers.some((q) => q.slug === step.p.slug), "代表列表里混进了自己");
    }
    // 最小覆盖模式下，选出来的一定比池子少
    assert.ok(plan.steps.length <= plan.poolSize);
    assert.ok(plan.coveragePct > 0 && plan.coveragePct <= 100);
  }
});

test("门面题：先看跟这个标签贴不贴，再看经典度", () => {
  for (const id of ["tree-traversal", "monotonic", "hash-count", "dp-knapsack"]) {
    const topic = store.topics().get(id)!;
    const pool = store.members(topic, { quality: true });
    const picks = planner.signatureProblems(store, topic, 3);
    assert.ok(picks.length > 0, `${id} 一道门面题都没有`);
    for (const p of picks) assert.ok(p.url, `${p.slug} 没有平台链接`);

    // 有足够多「以这个标签为主」的题时，门面题不许挑沾边的那种：
    // 只按题号选的话，「二叉树遍历」会拿 #22 括号生成 当门面。
    const mainOnes = pool.filter((p) => p.mainTag === id);
    if (mainOnes.length >= picks.length) {
      for (const p of picks) {
        assert.equal(p.mainTag, id, `${id} 的门面题选了 ${p.slug}，它的主标签是 ${p.mainTag}`);
      }
    }
  }
});

test("同一份数据跑两次，计划完全一样", () => {
  const topic = store.topics().get("monotonic")!;
  const a = planner.planTopic(store, topic, { mode: "minimal" }).steps.map((s) => s.p.slug);
  const b = planner.planTopic(miniStore(), topic, { mode: "minimal" }).steps.map((s) => s.p.slug);
  assert.deepEqual(a, b, "计划不可复现");
});

test("主线：题量不超过每专题预算，跨专题不重复", () => {
  for (const route of planner.ROUTES) {
    const plan = planner.planRoute(store, route);
    const seen = new Set<string>();
    for (const sec of plan.sections) {
      if (route.perTopic) {
        assert.ok(sec.steps.length <= route.perTopic,
          `${route.id}/${sec.key} 排了 ${sec.steps.length} 步，超过预算 ${route.perTopic}`);
      }
      for (const s of sec.steps) {
        assert.ok(!seen.has(s.p.slug), `${route.id} 里 ${s.p.slug} 重复出现`);
        seen.add(s.p.slug);
      }
    }
    if (route.diffs.length) {
      for (const s of plan.steps) assert.ok(route.diffs.includes(s.p.difficulty));
    }
    if (route.hotOnly) for (const s of plan.steps) assert.ok(s.p.freq > 0);
  }
});

test("full 模式列出整池，minimal 模式只给代表题", () => {
  const topic = store.topics().get("monotonic")!;
  const full = planner.planTopic(store, topic, { mode: "full" });
  const minimal = planner.planTopic(store, topic, { mode: "minimal" });
  assert.equal(full.steps.length, full.poolSize);
  assert.ok(minimal.steps.length < full.steps.length);
  // full 模式里标 ★ 的那些，就是 minimal 会给的那些
  assert.deepEqual(
    new Set(full.steps.filter((s) => s.core).map((s) => s.p.slug)),
    new Set(minimal.steps.map((s) => s.p.slug)));
});

test("节奏档位改变难度配比：重攻坚比重覆盖排的困难题多", () => {
  const topic = store.topics().get("tree")!;
  const depth = planner.planTopic(store, topic, { mode: "minimal", pace: "depth" });
  const coverage = planner.planTopic(store, topic, { mode: "minimal", pace: "coverage" });
  assert.ok(depth.mix.get("困难") >= coverage.mix.get("困难"),
    `depth 困难 ${depth.mix.get("困难")} 反而少于 coverage ${coverage.mix.get("困难")}`);
});

// --- 快照 ----------------------------------------------------------------------

interface Snapshot {
  [key: string]: {
    poolSize: number;
    covered: number;
    sections: { key: string; pool: number; steps: string[] }[];
  };
}

function snapshot(): Snapshot {
  const out: Snapshot = {};
  const record = (key: string, plan: planner.Plan): void => {
    out[key] = {
      poolSize: plan.poolSize,
      covered: plan.covered,
      sections: plan.sections
        .filter((s) => s.steps.length)
        .map((s) => ({ key: s.key, pool: s.pool, steps: s.steps.map((x) => x.p.slug) })),
    };
  };
  for (const id of [...SNAPSHOT_TOPICS, ...SNAPSHOT_LISTS]) {
    record(`topic:${id}`, planner.planTopic(store, store.topics().get(id)!, { mode: "minimal" }));
  }
  for (const route of planner.ROUTES) record(`route:${route.id}`, planner.planRoute(store, route));
  return out;
}

test("学习计划快照：选出来的代表题没变", () => {
  const current = snapshot();
  if (UPDATE || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(current, null, 2)}\n`, "utf-8");
    process.stdout.write(`  已刷新快照 ${GOLDEN}\n`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, "utf-8")) as Snapshot;
  for (const key of Object.keys(golden)) {
    assert.deepEqual(current[key], golden[key],
      `${key} 的计划变了。确认是有意的改动之后跑 UPDATE_GOLDEN=1 npm test 刷新快照`);
  }
  assert.deepEqual(Object.keys(current).sort(), Object.keys(golden).sort());
});
