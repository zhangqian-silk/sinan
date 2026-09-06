/**
 * GitHub Pages 静态站的体检。
 *
 * 静态站的立身之本是「和命令行共用同一套 store / planner」，代价是那条依赖链
 * 上任何一个模块都不能碰 node。这一条靠自觉守不住，所以在这里钉死：
 * 只要有人往 store.ts 之类的地方加回一个 `node:fs`，构建和测试会同时红。
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { expand, type Packed } from "../baseline.js";
import { createMemoryHost } from "../host-memory.js";
import { BASELINE_DIR } from "../paths.js";
import { Store } from "../store.js";
import { collectModules } from "../tools/build-site.js";
import { makeBackend } from "../web-boot.js";

const BASELINE = join(BASELINE_DIR, "baseline.json");
const skip = !existsSync(BASELINE) && "仓库里还没有基线数据，跑 npm run baseline 生成";

test("静态站要加载的模块里没有 node 依赖", () => {
  // collectModules 自己就会在遇到 node: 或外部包时抛错，这里顺带确认它真的爬到了东西
  const mods = collectModules();
  assert.ok(mods.length > 5, `只爬到 ${String(mods.length)} 个模块，依赖链可能断了`);
  assert.ok(mods.includes("store.js") && mods.includes("planner.js") && mods.includes("api.js"),
    "静态站应当直接复用 store / planner / api，而不是另写一份");
});

test("浏览器侧能用基线装出一个可用的后端", { skip }, () => {
  const data = expand(JSON.parse(readFileSync(BASELINE, "utf-8")) as Packed);
  const backend = makeBackend(new Store(createMemoryHost(data)));

  const meta = backend.call("/api/meta") as { meta: { baseline: boolean; stats: { total: number } } };
  assert.equal(meta.meta.baseline, true, "静态站永远是基线模式");
  assert.ok(meta.meta.stats.total > 1000);

  // 标签筛选与分面 —— 网页上最核心的两件事
  const list = backend.call("/api/problems", { tag: "monotonic-stack", limit: 3 }) as {
    total: number; items: unknown[]; facets: Record<string, Record<string, number>>;
  };
  assert.ok(list.total > 0, "按技巧标签筛不出题");
  assert.equal(list.items.length, 3);
  assert.ok(Object.keys(list.facets["cats"] ?? {}).length > 1, "分面计数没算出来");

  // 人工判定的解法要能透出到网页
  const detail = backend.call("/api/problem", { slug: "trapping-rain-water" }) as {
    tags: unknown[]; content: string;
    review: { solutions: { name: string; tagPaths: string[] }[] } | null;
  };
  assert.ok(detail.tags.length > 0);
  assert.ok((detail.review?.solutions.length ?? 0) >= 2, "接雨水应当带着多种解法");
  assert.ok(detail.review?.solutions[0]?.tagPaths[0]?.includes("›"), "解法标签要给全路径");
  assert.equal(detail.content, "", "基线里不该有题面原文");

  // 学习计划
  const plan = backend.call("/api/plan", { topic: "dp-interval" }) as { sections: { steps: unknown[] }[] };
  assert.ok(plan.sections.flatMap((s) => s.steps).length > 0, "排不出学习计划");

  // 打卡：静态站靠 localStorage，同一个后端里应当能翻转回来
  const first = backend.checkin("two-sum") as { checked: boolean };
  const second = backend.checkin("two-sum") as { checked: boolean };
  assert.equal(first.checked, !second.checked);
});

test("依赖频次的主线在基线下要给出可操作的提示而不是空计划", { skip }, () => {
  const data = expand(JSON.parse(readFileSync(BASELINE, "utf-8")) as Packed);
  const backend = makeBackend(new Store(createMemoryHost(data)));
  const got = backend.call("/api/plan", { route: "interview" }) as { error?: string; needsSync?: boolean };
  assert.equal(got.needsSync, true);
  assert.match(got.error ?? "", /sync/);
});
