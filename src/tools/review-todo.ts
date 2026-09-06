/**
 * 人工判定的待办清单：把还没评的力扣题按「影响面」排好序打出来，方便一批批往下推。
 *
 * 排序依据（从重到轻）：
 *   1. 出现在几条学习计划里 —— 计划是用户真正会看到的地方，误标在这里最刺眼
 *   2. 面试频次与题单背书 —— 用户实际会碰到的题
 *   3. 题号
 *
 * 洛谷题不列：题库里没有题面，读不了题就下不了判定。
 * 抓不到题面的力扣题（会员题居多）也不列，理由相同。
 *
 * 跑法：
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js            # 看统计
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js --limit 40 # 取下一批
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js --tag dp-tree
 */

import { join } from "node:path";

import { distDir, rawDir, readJsonl } from "../build/io.js";
import { loadReviews } from "../build/reviews.js";
import * as planner from "../planner.js";
import { Store } from "../store.js";
import type { Problem } from "../types.js";

interface Detail { _key: string; content?: string }

function main(): void {
  const argv = process.argv.slice(2);
  const flag = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? "") : "";
  };
  const limit = parseInt(flag("--limit") || "0", 10) || 0;
  const tag = flag("--tag");

  const store = new Store({ dataDir: distDir(), progressFile: "/dev/null" });
  const done = loadReviews();

  // 有题面才评得动
  const readable = new Set<string>();
  for (const row of readJsonl<Detail>(join(rawDir(), "leetcode_detail.jsonl"))) {
    if ((row.content ?? "").length > 50) readable.add(row._key);
  }

  // 每道题出现在几条计划里
  const inPlan = new Map<string, number>();
  const bump = (slug: string): void => { inPlan.set(slug, (inPlan.get(slug) ?? 0) + 1); };
  for (const r of planner.ROUTE_BY_ID.values()) {
    for (const s of planner.planRoute(store, r).steps) bump(s.p.slug);
  }
  for (const t of store.topics().values()) {
    if (t.kind === "list") continue;
    try {
      for (const s of planner.planTopic(store, t, { mode: "minimal" }).steps) bump(s.p.slug);
    } catch { /* 空题池的专题排不出计划，跳过 */ }
  }

  const listCount = (p: Problem): number => store.listNamesOf(p).length;
  const weight = (p: Problem): number =>
    (inPlan.get(p.slug) ?? 0) * 1000 + Math.min(p.freq, 500) + listCount(p) * 10;

  const all = [...store.bySlug.values()].filter((p) => !p.slug.startsWith("luogu:"));
  const pool = all.filter((p) => readable.has(p.slug));
  const todo = pool
    .filter((p) => !done.has(p.slug))
    .filter((p) => !tag || p.tags.some((t) => t.id === tag))
    .sort((a, b) => weight(b) - weight(a) || a.slug.localeCompare(b.slug));

  const reviewed = pool.filter((p) => done.has(p.slug)).length;
  process.stdout.write(
    `力扣 ${String(all.length)} 题 · 有题面 ${String(pool.length)} · 已评 ${String(reviewed)} · 待评 ${String(todo.length)}\n`,
  );
  if (!limit) {
    const planLeft = todo.filter((p) => inPlan.has(p.slug)).length;
    process.stdout.write(`其中在学习计划里的还有 ${String(planLeft)} 道\n`);
    return;
  }
  for (const p of todo.slice(0, limit)) {
    const marks = [
      inPlan.has(p.slug) ? `计划×${String(inPlan.get(p.slug))}` : "",
      p.freq ? `频次${String(p.freq)}` : "",
      listCount(p) ? `题单${String(listCount(p))}` : "",
    ].filter(Boolean).join(" ");
    process.stdout.write(`${p.slug}\t#${p.id}\t${p.title}\t${p.difficultyCn}\t${marks}\n`);
  }
}

main();
