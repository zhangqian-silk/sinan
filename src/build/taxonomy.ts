/**
 * 两级标签体系的打标逻辑。
 *
 * 这里是**多标签打标**，不是单选分类：一道题有几种解法就打几个标签。
 * 接雨水会同时拿到「单调栈 / 双指针 / 线性 DP / 栈」，第 K 大会同时拿到
 * 「快速选择 / 堆 / 分治 / 排序」。权重只用来决定列表里显示哪个当主标签，
 * 不用来做互斥裁决。
 */

import { py } from "./pyre.js";
import {
  ALT_APPROACHES, CAT_ORDER, CATEGORIES, FALLBACK_SUB, KEEP_THRESHOLD, MAIN_TAG_PINS,
  MAX_TAGS, RULES, SUPPRESS, TAG_MAP, type Cat, type Rule, type Sub,
} from "./rules/taxonomy.data.js";

export { CATEGORIES, CAT_ORDER };
export type { Cat, Sub };

export const SUB_BY_ID = new Map<string, Sub>();
export const SUB_TO_CAT = new Map<string, string>();
for (const c of CATEGORIES) {
  for (const s of c.subs) {
    SUB_BY_ID.set(s.id, s);
    SUB_TO_CAT.set(s.id, c.id);
  }
}

/** 树上任意一个节点的位置信息。depth：1=分区，2=子标签，3 及以下=更细的技巧。 */
export interface NodeInfo {
  node: Sub;
  cat: string;
  parent: string;
  depth: number;
}

/** 二级及以下的全部节点，按 id 索引。层数不限，深的枝就多几层。 */
export const NODE_BY_ID = new Map<string, NodeInfo>();

(function indexTree(): void {
  const walk = (nodes: readonly Sub[], cat: string, parent: string, depth: number): void => {
    for (const n of nodes) {
      if (NODE_BY_ID.has(n.id)) throw new Error(`标签 id 重复：${n.id}，全树必须唯一`);
      NODE_BY_ID.set(n.id, { node: n, cat, parent, depth });
      if (n.kids?.length) walk(n.kids, cat, n.id, depth + 1);
    }
  };
  for (const c of CATEGORIES) walk(c.subs, c.id, c.id, 2);
}());

/** 按深度从浅到深排好的深层节点（depth ≥ 3），打标时要一层层往下加。 */
const DEEP_NODES = [...NODE_BY_ID.values()]
  .filter((n) => n.depth >= 3)
  .sort((a, b) => a.depth - b.depth);

/**
 * 这道题该挂哪些深层标签：思路命中了这个节点，且它的父节点也在场。
 *
 * 要求父节点在场是为了让树自洽 —— 不然 #21 合并两个有序链表 会因为题解里有一句
 * 「迭代写法」而挂到「二叉树遍历 / 迭代写法」下面去。这类低置信度的技巧痕迹
 * 仍然留在题解思路里，只是不进标签树。
 *
 * 逐层推进，所以第四级只有在第三级也成立时才挂得上，层数再多也是这套规则。
 */
export function deepTagsFor(
  tagIds: readonly string[],
  approachIds: readonly string[],
): { id: string; parent: string; depth: number }[] {
  const present = new Set<string>(tagIds);
  const hit = new Set(approachIds);
  const out: { id: string; parent: string; depth: number }[] = [];
  for (const info of DEEP_NODES) {
    const id = info.node.id;
    if (!hit.has(id) || !present.has(info.parent)) continue;
    present.add(id);
    out.push({ id, parent: info.parent, depth: info.depth });
  }
  return out;
}

function ruleMatches(rule: Rule, tags: Set<string>, title: string): boolean {
  if (rule.allTags?.length && !rule.allTags.every((t) => tags.has(t))) return false;
  if (rule.anyTags?.length && !rule.anyTags.some((t) => tags.has(t))) return false;
  if (rule.notTags?.length && rule.notTags.some((t) => tags.has(t))) return false;
  if (rule.title && !py(rule.title).test(title)) return false;
  return true;
}

export interface TagHit {
  id: string;
  w: number;
  src: string[];
}

export type Seed = [sub: string, weight: number, src: string];

/**
 * 给一道题打上全部成立的解法标签。
 *
 * 返回 [主标签, [{id, w, src}, ...]]，按权重降序。src 记录这个标签是怎么来的，
 * 便于在页面上解释，也便于回头调规则。
 * seeds 用来接别的题源已经标好的类型（洛谷的「区间 DP」这类）。
 */
export function tagProblem(
  tagSlugs: readonly string[],
  title: string,
  qid = "",
  tagNames: Record<string, string> = {},
  seeds: readonly Seed[] = [],
): [string, TagHit[]] {
  const tags = new Set(tagSlugs);
  const hits = new Map<string, { w: number; src: string[] }>();

  const add = (sub: string, weight: number, src: string): void => {
    const cur = hits.get(sub) ?? { w: 0, src: [] };
    cur.w = Math.max(cur.w, weight);
    if (!cur.src.includes(src)) cur.src.push(src);
    hits.set(sub, cur);
  };

  for (const slug of tagSlugs) {
    const hit = TAG_MAP[slug];
    if (hit) add(hit[0], hit[1], tagNames[slug] ?? slug);
  }
  for (const [sub, weight, src] of seeds) {
    if (SUB_BY_ID.has(sub)) add(sub, weight, src);
  }
  for (const rule of RULES) {
    if (ruleMatches(rule, tags, title)) add(rule.sub, rule.weight, rule.why || "组合规则");
  }

  // 解法联想：等价解法互相带出来，权重压一档，避免盖过原生信号
  for (const [sub, alts] of Object.entries(ALT_APPROACHES)) {
    const cur = hits.get(sub);
    if (cur && cur.w >= 60) {
      for (const [alt, weight] of alts) add(alt, weight, `${SUB_BY_ID.get(sub)!.name}的等价解法`);
    }
  }

  const pinned = MAIN_TAG_PINS[qid];
  if (pinned) add(pinned, 100, "人工校正");

  if (!hits.size) return [FALLBACK_SUB, [{ id: FALLBACK_SUB, w: 10, src: ["兜底"] }]];

  const ranked = [...hits.entries()].sort((x, y) => (y[1].w - x[1].w) || (x[0] < y[0] ? -1 : 1));
  let kept = ranked.filter(([, v]) => v.w >= KEEP_THRESHOLD);
  if (!kept.length) kept = ranked.slice(0, 1);
  for (const [weak, stronger] of Object.entries(SUPPRESS)) {
    const hasWeak = kept.some(([s]) => s === weak);
    const hasStrong = kept.some(([s, v]) => stronger.includes(s) && v.w >= 50);
    if (hasWeak && hasStrong) kept = kept.filter(([s]) => s !== weak);
  }
  kept = kept.slice(0, MAX_TAGS);
  const main = pinned && kept.some(([s]) => s === pinned) ? pinned : kept[0][0];
  return [main, kept.map(([s, v]) => ({ id: s, w: v.w, src: v.src }))];
}

/** 给前端用的分类树。 */
export function exportTaxonomy(): {
  id: string; name: string; desc: string; order: number;
  subs: Sub[];
}[] {
  const clone = (n: Sub): Sub => ({
    id: n.id,
    name: n.name,
    desc: n.desc,
    ...(n.kids?.length ? { kids: n.kids.map(clone) } : {}),
  });
  return CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    desc: c.desc,
    order: CAT_ORDER.indexOf(c.id),
    subs: c.subs.map(clone),
  }));
}
