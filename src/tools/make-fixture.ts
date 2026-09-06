/**
 * 从一份完整的构建产物里切出一个迷你题库，供测试用。
 *
 * 为什么要入库一份数据：planner 是整个项目最容易改坏的一块（覆盖表的两条硬门槛、
 * 贪心的三档预算、跨专题去重），而它的行为只有喂真实形状的数据才看得出来。
 * 只跑纯函数的单测拦不住「代表题选错了」这类回归。
 *
 * 挑题的原则是覆盖不同代码路径，不是求全：
 * - 中等池子的子标签（贪心三档都会走到）
 * - 极小池子的子标签（触发「题量少，一并练掉」的下限兜底）
 * - 一个大类（多节 + 跨节去重）
 * - 一份官方题单（自带知识点分组这条分支）
 * - 一批洛谷题（验「不跨平台代表」这条硬门槛）
 *
 * 跑法：SINAN_DATA=<完整 dist> npm run fixture
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStore } from "../host-node.js";
import type { CuratedList, Problem, SimilarEntry } from "../types.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "test", "fixtures", "mini");

/**
 * 这些专题一起构成夹具的骨架，各自负责一条代码路径。每个限量取，
 * 因为夹具要进 git —— 目标是覆盖分支，不是复刻题库。
 */
const TAGS = ["monotonic", "two-pointers", "dp-interval", "iterator", "bs-answer"];
const CATS = ["tree"];
const LISTS = ["lc:leetcode-75"];
const PER_TOPIC = 45;
const LUOGU = 30;

function main(): void {
  const store = openStore({ progressFile: join(OUT, "__no_progress__.json") });
  const topics = store.topics();
  const picked = new Set<string>();

  const take = (rows: Problem[], limit = Infinity): void => {
    for (const p of rows.slice(0, limit)) picked.add(p.slug);
  };
  for (const id of [...TAGS, ...CATS, ...LISTS]) {
    const topic = topics.get(id);
    if (!topic) throw new Error(`夹具里点名的专题不存在：${id}`);
    take(store.members(topic, { includePaid: true }), PER_TOPIC);
  }
  take(store.problems.filter((p) => p.source === "luogu"), LUOGU);

  // 不做邻居扩展：覆盖表只认「候选也在同一个池子里」的邻居（coverageMap 的 inside 判断），
  // 池子外的邻居本来就会被丢掉，带进来只会让夹具白白涨几 MB。
  const sim = store.similar();
  const slugs = [...picked].sort();
  const inside = new Set(slugs);
  const problems = slugs.map((s) => store.bySlug.get(s)!);

  const similar: Record<string, SimilarEntry[]> = {};
  for (const s of slugs) {
    const kept = (sim[s] ?? []).filter((n) => inside.has(n.slug));
    if (kept.length) similar[s] = kept;
  }

  const curated: CuratedList[] = [];
  for (const lst of store.curated) {
    const kept = lst.slugs.filter((s) => inside.has(s));
    if (kept.length < 5) continue;
    curated.push({
      ...lst,
      slugs: kept,
      groups: (lst.groups ?? [])
        .map((g) => ({ name: g.name, slugs: g.slugs.filter((s) => inside.has(s)) }))
        .filter((g) => g.slugs.length),
    });
  }

  mkdirSync(OUT, { recursive: true });
  const write = (name: string, obj: unknown): void => {
    const text = JSON.stringify(obj);
    writeFileSync(join(OUT, name), `${text}\n`, "utf-8");
    process.stdout.write(`  ${name}  ${Math.round(text.length / 1024)} KB\n`);
  };
  write("problems.json", problems);
  write("similar.json", similar);
  write("curated.json", curated);
  write("taxonomy.json", store.cats);
  // 统计必须按子集重算 —— 直接抄全量的会让「已刷 x/5648」这类比值大于 1，
  // 夹具自己就成了脏数据源
  const count = <T>(rows: T[], key: (p: T) => string[]): Record<string, number> => {
    const acc: Record<string, number> = {};
    for (const r of rows) for (const k of key(r)) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  };
  const has = (p: Problem, kind: string): boolean => (p.approachFrom ?? "").includes(kind);
  write("meta.json", {
    ...store.meta,
    builtAt: "fixture",
    sources: [...new Set(problems.map((p) => p.source))].map((src) => ({
      id: src,
      name: problems.find((p) => p.source === src)!.sourceName,
      count: problems.filter((p) => p.source === src).length,
      url: "",
    })),
    overlays: [],
    stats: {
      total: problems.length,
      free: problems.filter((p) => !p.paid).length,
      withContent: 0,
      avgTags: Number((problems.reduce((s, p) => s + p.tagIds.length, 0) / problems.length).toFixed(2)),
      multiApproach: problems.filter((p) => p.catSpan >= 3).length,
      withApproach: problems.filter((p) => p.approachFrom === "solutions" || has(p, "code")).length,
      withCode: problems.filter((p) => p.codeBlocks).length,
      approachFromCode: problems.filter((p) => has(p, "code")).length,
      approachFromStatement: problems.filter((p) => has(p, "statement")).length,
      approachCrossChecked: problems.filter((p) => has(p, "code") && has(p, "statement")).length,
      avgApproaches: Number((problems.reduce((s, p) => s + (p.approachIds ?? []).length, 0) / problems.length).toFixed(2)),
      difficulty: count(problems, (p) => [p.difficultyCn]),
      cats: count(problems, (p) => p.cats),
      subs: count(problems, (p) => p.tagIds),
    },
  });

  process.stdout.write(`\n夹具：${problems.length} 题 / ${Object.keys(similar).length} 题有邻居 / `
    + `${curated.length} 份题单 / ${store.cats.length} 个大类\n`);
}

main();
