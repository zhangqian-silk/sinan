/**
 * 特殊题单：把抓来的官方学习计划 / CodeTop 公司榜落到本地题库上，再派生几份题单。
 *
 * 派生的部分不需要额外抓取：
 * - CodeTop 全站高频 Top 100 / Top 200（用已有的频次排名切）
 * - LCR（剑指 Offer 专项突破 + 面试经典）、程序员面试金典、力扣杯 LCP（用题号前缀切）
 * - 一题多解精选（解法覆盖 3 个以上大类的高频题，专门练「一题多解」）
 */

import type { CuratedList, Problem } from "../types.js";
import { sortBy } from "../util.js";

const DIFF_CN: Record<string, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };

/** 抓下来的原始题单（或派生出来的），落库之前的形状。 */
export interface RawList {
  id: string;
  name: string;
  desc?: string;
  source?: string;
  kind?: string;
  url?: string;
  declaredNum?: number;
  groups?: { name: string; slugs: string[] }[];
  slugs?: string[];
  freq?: Record<string, number>;
}

function statsOf(slugs: string[], bySlug: Map<string, Problem>): CuratedList["stats"] {
  const rows = slugs.map((s) => bySlug.get(s)).filter((p): p is Problem => Boolean(p));
  const diff: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const r of rows) diff[r.difficulty] = (diff[r.difficulty] ?? 0) + 1;
  const difficulty: Record<string, number> = {};
  for (const [k, v] of Object.entries(diff)) difficulty[DIFF_CN[k] ?? k] = v;
  return {
    resolved: rows.length,
    hot: rows.filter((r) => r.freq).length,
    paid: rows.filter((r) => r.paid).length,
    difficulty,
  };
}

const prefixList = (items: readonly Problem[], prefix: string): string[] =>
  items.filter((p) => String(p.id).startsWith(prefix)).map((p) => p.slug);

export function deriveLists(items: readonly Problem[]): RawList[] {
  const byRank = sortBy(items.filter((p) => p.freqRank), (p) => [p.freqRank]);
  const derived: RawList[] = [];

  for (const size of [100, 200]) {
    const slugs = byRank.slice(0, size).map((p) => p.slug);
    if (slugs.length < size * 0.6) continue;
    derived.push({
      id: `codetop:global-${size}`,
      name: `CodeTop 全站高频 Top ${size}`,
      desc: `所有公司汇总后被面到次数最多的 ${size} 题，面试前优先级最高的一批`,
      source: "codetop", kind: "hot", url: "https://codetop.cc/home",
      groups: [], slugs,
    });
  }

  const prefixes: [string, string, string, string][] = [
    ["LCR", "lc:lcr", "LCR · 剑指 Offer 专项 & 面试经典",
      "力扣把剑指 Offer 与面试经典重编为 LCR 系列，国内面试出现频率很高"],
    ["面试题", "lc:ctci", "程序员面试金典",
      "《程序员面试金典》配套题库，偏工程实现与边界处理"],
    ["LCP", "lc:lcp", "力扣杯 LCP", "力扣杯竞赛题，思维量大、常需要组合多种算法"],
  ];
  for (const [prefix, lid, name, desc] of prefixes) {
    const slugs = prefixList(items, prefix);
    if (slugs.length < 10) continue;
    derived.push({
      id: lid, name, desc, source: "leetcode", kind: "series",
      url: "https://leetcode.cn/problemset/", groups: [], slugs,
    });
  }

  const multi = sortBy(
    items.filter((p) => p.catSpan >= 3 && p.freq >= 20 && !p.paid),
    (p) => [-p.catSpan, -p.freq],
  );
  if (multi.length >= 20) {
    derived.push({
      id: "special:multi-approach",
      name: "一题多解精选",
      desc: "解法横跨 3 个以上大类的高频题，一道题能同时练几种套路，性价比最高",
      source: "mixed", kind: "special", url: "",
      groups: [], slugs: multi.slice(0, 80).map((p) => p.slug),
    });
  }
  return derived;
}

export function buildCurated(items: readonly Problem[], rawLists: readonly RawList[]): CuratedList[] {
  const bySlug = new Map(items.map((p) => [p.slug, p]));
  const out: CuratedList[] = [];

  for (const lst of [...rawLists, ...deriveLists(items)]) {
    const slugs = (lst.slugs ?? []).filter((s) => bySlug.has(s));
    if (slugs.length < 5) continue;
    const groups: { name: string; slugs: string[] }[] = [];
    for (const g of lst.groups ?? []) {
      const members = (g.slugs ?? []).filter((s) => bySlug.has(s));
      if (members.length) groups.push({ name: g.name, slugs: members });
    }
    const entry: CuratedList & { freq?: Record<string, number> } = {
      id: lst.id,
      name: lst.name,
      desc: lst.desc ?? "",
      source: lst.source ?? "",
      kind: lst.kind ?? "official",
      url: lst.url ?? "",
      declaredNum: lst.declaredNum || (lst.slugs ?? []).length,
      groups,
      slugs,
      stats: statsOf(slugs, bySlug),
    };
    if (lst.freq) {
      const freq: Record<string, number> = {};
      for (const [s, v] of Object.entries(lst.freq)) if (bySlug.has(s)) freq[s] = v;
      entry.freq = freq;
    }
    out.push(entry);
  }

  const order: Record<string, number> = { official: 0, hot: 1, company: 2, series: 3, special: 4 };
  return sortBy(out, (l) => [order[l.kind] ?? 9, -l.stats.resolved]);
}
