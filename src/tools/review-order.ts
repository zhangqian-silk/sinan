/**
 * 判定待办的排序规则，review-todo 和 review-dump 共用。
 *
 * 排序依据（从重到轻）：
 *   1. 出现在几条学习计划里 —— 计划是用户真正会看到的地方，误标在这里最刺眼
 *   2. 面试频次与题单背书 —— 用户实际会碰到的题
 *   3. slug 字典序，保证同权重下每次取到的批次稳定
 *
 * 洛谷题不列：题库里没有题面，读不了题就下不了判定。
 * 抓不到题面的力扣题（会员题居多）也不列，理由相同。
 */

import { join } from "node:path";

import { rawDir, readJsonl } from "../build/io.js";
import * as planner from "../planner.js";
import type { Store } from "../store.js";
import type { Problem } from "../types.js";

interface Detail { _key: string; content?: string }

export interface Todo {
  /** 有题面、非洛谷的全部力扣题 */
  pool: Problem[];
  /** 上面这些里还没评的，已按影响面排好序 */
  todo: Problem[];
  /** 力扣题总数，含没抓到题面的 */
  total: number;
  /** 每道题出现在几条学习计划里 */
  inPlan: Map<string, number>;
}

/** 读一遍抓到的题面，只留够长的 —— 太短的多半是会员题的占位。 */
export function readableSlugs(): Set<string> {
  const readable = new Set<string>();
  for (const row of readJsonl<Detail>(join(rawDir(), "leetcode_detail.jsonl"))) {
    if ((row.content ?? "").length > 50) readable.add(row._key);
  }
  return readable;
}

export function buildTodo(store: Store, done: ReadonlySet<string> | ReadonlyMap<string, unknown>, tag?: string): Todo {
  const readable = readableSlugs();

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

  return { pool, todo, total: all.length, inPlan };
}
