/**
 * 把抓来的原始数据加工成 CLI 与 Web 端直接消费的 JSON：打标、算相似度、生成题单。
 *
 * 输入 `<数据根>/raw/*`，输出 `<数据根>/dist/*`。
 */

import { createWriteStream, existsSync } from "node:fs";
import { join } from "node:path";

import { analyzeBlocks, tagSeeds, type CodeBlock } from "./codeprint.js";
import { buildCurated, type RawList } from "./curated.js";
import { loadExtraSources, lookup } from "./extra.js";
import { loadReviews, tagsOf, type Review } from "./reviews.js";
import { APPROACHES, fingerprint, vector } from "./fingerprint.js";
import { distDir, dumpJson, loadJson, rawDir, readJsonl } from "./io.js";
import { py } from "./pyre.js";
import { analyze as analyzeStatement } from "./statement.js";
import {
  deepTagsFor, exportTaxonomy, NODE_BY_ID, SUB_BY_ID, SUB_TO_CAT, tagProblem, CATEGORIES,
} from "./taxonomy.js";
import { CHANNEL_CN } from "./rules/approach.data.js";
import { LEAF_TAG_MAP, TAG_MAP } from "./rules/taxonomy.data.js";
import type { ApproachRef, CuratedList, Meta, Problem, SimilarEntry, TagRef } from "../types.js";

/**
 * 深层标签：思路命中了树上更细的那一层，就把它也挂成标签。
 *
 * 证据有两路：
 * 1. **题解 / 题面判出来的思路**。只认有真实证据的 —— `from === "tags"` 是「没抓到题解
 *    也读不出题面，只能由官方标签反推」，拿它生成深层标签等于自己证明自己。
 * 2. **原始标签直接点名**（力扣 `monotonic-stack`、洛谷「素数判断」）。洛谷题抓不到
 *    题解，这一路是它们唯一的深层证据。
 *
 * 两路都要求父节点在场，规则一致。
 */
function deepTagRefs(
  tagIds: readonly string[],
  fp: readonly ApproachRef[],
  rawTags: readonly string[] = [],
  tagNames: Record<string, string> = {},
): TagRef[] {
  const evidence = new Map<string, { w: number; src: string[] }>();
  const add = (id: string, w: number, src: string): void => {
    const cur = evidence.get(id) ?? { w: 0, src: [] };
    cur.w = Math.max(cur.w, w);
    if (!cur.src.includes(src)) cur.src.push(src);
    evidence.set(id, cur);
  };
  for (const a of fp) {
    if (a.from === "tags" || !NODE_BY_ID.has(a.id)) continue;
    for (const c of a.from.split("+")) add(a.id, Math.round(a.conf * 100), CHANNEL_CN[c] ?? c);
  }
  for (const t of rawTags) {
    const leaf = lookup(LEAF_TAG_MAP, t);
    if (leaf) add(leaf, 70, tagNames[t] ?? t);
  }
  return deepTagsFor(tagIds, [...evidence.keys()]).map(({ id, parent, depth }) => {
    const info = NODE_BY_ID.get(id)!;
    const ev = evidence.get(id)!;
    return {
      id, name: info.node.name, cat: info.cat, w: ev.w, src: ev.src, level: depth, parent,
    };
  });
}

/**
 * 人工判定的标签。列出来的深层节点会自动补上父链 —— 判定「用了埃氏筛」就意味着
 * 这是道数论题，没必要让人再写一遍父节点。
 */
function reviewTags(review: Review): {
  tags: TagRef[]; tagIds: string[]; deepTagIds: string[]; main: string;
} {
  const refs: TagRef[] = [];
  const seen = new Set<string>();
  const push = (id: string, explicit: boolean): void => {
    if (seen.has(id)) return;
    const info = NODE_BY_ID.get(id);
    if (!info) throw new Error(`人工判定 ${review.slug} 用了不存在的标签：${id}`);
    seen.add(id);
    refs.push({
      id,
      name: info.node.name,
      cat: info.cat,
      w: 100,
      src: [explicit ? "人工判定" : "人工判定（父节点）"],
      ...(info.depth >= 3 ? { level: info.depth, parent: info.parent } : {}),
    });
  };
  for (const id of tagsOf(review)) {
    // 先补父链再放自己，保证 tags 里父在前
    const chain: string[] = [];
    let cur: string | undefined = id;
    while (cur && NODE_BY_ID.has(cur)) {
      chain.unshift(cur);
      cur = NODE_BY_ID.get(cur)!.parent;
    }
    for (const nid of chain) push(nid, nid === id);
  }
  const tagIds = refs.filter((t) => (t.level ?? 2) === 2).map((t) => t.id);
  if (!tagIds.length) throw new Error(`人工判定 ${review.slug} 一个二级标签都没有`);
  return {
    tags: refs,
    tagIds,
    deepTagIds: refs.filter((t) => (t.level ?? 2) >= 3).map((t) => t.id),
    main: tagIds[0],
  };
}
import { Counter, fixed, pyRoundTo, sortBy } from "../util.js";
import { overlap } from "../approach.js";

const DIFF_CN: Record<string, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };

// LeetCode 题面里有大量 <p>&nbsp;</p> 占位，直接渲染会撑出很多空行
const BLANK_P = py("<p>(?:&nbsp;|\\s|<br\\s*/?>)*</p>", "g");

function cleanHtml(html: string): string {
  return html.replace(new RegExp(BLANK_P.source, "gu"), "").trim();
}

// --- 题目系列（打家劫舍 I/II/III 这种） -----------------------------------------

const SERIES_TAIL = py("[\\sⅠⅡⅢⅣⅤⅥⅦ]*\\s(I{1,3}|IV|V|VI{0,2}|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ)$");
const SERIES_DASH = py("\\s*[-—–]\\s*.*$");
const SERIES_PREFIX = py("^\\s*[\\[【][^\\]】]*[\\]】]\\s*");   // 洛谷的「[NOIP 2002 普及组]」前缀

/**
 * 题目系列。
 *
 * 必须按来源分域：力扣的「两数之和」和洛谷的「两数之和」标题一样，但完全是两道题
 * （洛谷 P1286 是给出所有两两和反推原数）。不分域会让它们被当成同一系列，
 * 白送一份 +0.12 的相似度加成。
 */
export function seriesKey(title: string, source = ""): string {
  let base = title.replace(SERIES_PREFIX, "");
  base = base.replace(SERIES_DASH, "");
  base = base.replace(SERIES_TAIL, "");
  base = base.trim();
  return source ? `${source}:${base}` : base;
}

function charBigrams(title: string): Set<string> {
  const clean = title.replace(/[\s，。、（）()【】[\]]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i += 1) out.add(clean.slice(i, i + 2));
  return out.size ? out : new Set([clean]);
}

// --- 相似度 --------------------------------------------------------------------

const SIM_KEEP = 12;

/**
 * 相似度 = 题解思路为主，标签只作辅助。
 *
 * 权重分配的道理：标签说不出「前序还是层序」「用哪个定理」，所以真正决定两道题能不能
 * 互相替代的是从题解里提取的思路指纹。标签保留一点权重是因为它能兜住题解噪音，
 * 但绝不允许仅凭标签相同就把两道题判成相似 —— 思路完全不重合且不是官方相似题的一对，
 * 分数会被封顶到代表阈值以下。
 */
export function buildSimilarity(
  items: readonly Problem[],
  details: Map<string, { similar?: { titleSlug?: string }[] }>,
): Record<string, SimilarEntry[]> {
  const n = items.length;
  const bySlug = new Map(items.map((p) => [p.slug, p]));

  // 标签词表（辅助信号）
  const tokens = (p: Problem): string[] => [...(p.rawTags ?? []), ...p.tagIds.map((t) => `sub:${t}`)];

  const df = new Map<string, number>();
  for (const p of items) for (const t of tokens(p)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(n / (1 + c)) + 1);

  const vec = new Map<string, Map<string, number>>();
  for (const p of items) {
    const raw = new Map<string, number>();
    for (const t of tokens(p)) raw.set(t, idf.get(t)!);
    let sum = 0;
    for (const v of raw.values()) sum += v * v;
    const norm = Math.sqrt(sum) || 1;
    const unit = new Map<string, number>();
    for (const [t, v] of raw) unit.set(t, v / norm);
    vec.set(p.slug, unit);
  }

  // 思路指纹词表（主信号）
  const apDf = new Map<string, number>();
  for (const p of items) for (const a of p.approachIds ?? []) apDf.set(a, (apDf.get(a) ?? 0) + 1);
  const apIdf = new Map<string, number>();
  for (const [a, c] of apDf) apIdf.set(a, Math.log(n / (1 + c)) + 1);
  const apVec = new Map<string, Map<string, number>>();
  const fpBySlug = new Map<string, ApproachRef[]>();
  for (const p of items) {
    apVec.set(p.slug, vector(p.approach ?? [], apIdf));
    fpBySlug.set(p.slug, p.approach ?? []);
  }

  const grams = new Map<string, Set<string>>();
  for (const p of items) grams.set(p.slug, charBigrams(p.title));

  // 倒排索引产候选：跳过覆盖面过大的标签，避免 O(n²)
  const tagIndex = new Map<string, string[]>();
  for (const p of items) {
    for (const t of tokens(p)) {
      if ((df.get(t) ?? 0) <= 320) (tagIndex.get(t) ?? tagIndex.set(t, []).get(t)!).push(p.slug);
    }
  }
  const apIndex = new Map<string, string[]>();
  for (const p of items) {
    for (const a of p.approachIds ?? []) {
      // 思路标签比题目标签集中，阈值放宽一些
      if ((apDf.get(a) ?? 0) <= 900) (apIndex.get(a) ?? apIndex.set(a, []).get(a)!).push(p.slug);
    }
  }
  const gramDf = new Map<string, number>();
  for (const gs of grams.values()) for (const g of gs) gramDf.set(g, (gramDf.get(g) ?? 0) + 1);
  const gramIndex = new Map<string, string[]>();
  for (const [slug, gs] of grams) {
    for (const g of gs) {
      if ((gramDf.get(g) ?? 0) <= 60) (gramIndex.get(g) ?? gramIndex.set(g, []).get(g)!).push(slug);
    }
  }

  const official = new Map<string, Set<string>>();
  const officialOf = (slug: string): Set<string> => {
    let s = official.get(slug);
    if (!s) { s = new Set(); official.set(slug, s); }
    return s;
  };
  for (const [slug, det] of details) {
    for (const sim of det.similar ?? []) {
      const other = sim.titleSlug;
      if (other && bySlug.has(other) && bySlug.has(slug)) {
        officialOf(slug).add(other);
        officialOf(other).add(slug);
      }
    }
  }

  const series = new Map<string, string[]>();
  for (const p of items) {
    const key = p.seriesKey ?? "";
    (series.get(key) ?? series.set(key, []).get(key)!).push(p.slug);
  }

  const out: Record<string, SimilarEntry[]> = {};
  for (const p of items) {
    const slug = p.slug;
    const cands = new Set<string>(officialOf(slug));
    for (const s of series.get(p.seriesKey ?? "") ?? []) cands.add(s);
    for (const a of p.approachIds ?? []) for (const s of apIndex.get(a) ?? []) cands.add(s);
    for (const t of p.rawTags ?? []) for (const s of tagIndex.get(t) ?? []) cands.add(s);
    for (const g of grams.get(slug)!) for (const s of gramIndex.get(g) ?? []) cands.add(s);
    cands.delete(slug);

    const pv = vec.get(slug)!;
    const pg = grams.get(slug)!;
    const pav = apVec.get(slug)!;
    const pfp = fpBySlug.get(slug)!;
    const pMainAp = pfp.length ? pfp[0].id : "";
    const pGuessed = pfp.length > 0 && pfp[0].from === "tags";
    const scored: [number, string, string[]][] = [];

    for (const other of cands) {
      const q = bySlug.get(other)!;
      const qv = vec.get(other)!;
      let tagCos = 0;
      if (qv.size < pv.size) { for (const [t, w] of qv) tagCos += w * (pv.get(t) ?? 0); }
      else { for (const [t, w] of pv) tagCos += w * (qv.get(t) ?? 0); }
      const qav = apVec.get(other)!;
      let apCos = 0;
      if (qav.size < pav.size) { for (const [a, w] of qav) apCos += w * (pav.get(a) ?? 0); }
      else { for (const [a, w] of pav) apCos += w * (qav.get(a) ?? 0); }
      const qfp = fpBySlug.get(other)!;
      const apOv = overlap(pfp, qfp);
      const og = grams.get(other)!;
      let inter = 0;
      for (const g of pg) if (og.has(g)) inter += 1;
      const union = new Set([...pg, ...og]).size;
      const titleSim = inter / Math.max(union, 1);
      const isOfficial = officialOf(slug).has(other) ? 1 : 0;
      const qMainAp = qfp.length ? qfp[0].id : "";
      // 主思路相同才加分，且泛化思路（递归、模拟、公式推导）几乎不给分
      let sameMain = 0;
      if (pMainAp && pMainAp === qMainAp) {
        const w = APPROACHES.find((a) => a.id === pMainAp)?.weight ?? 1;
        sameMain = Math.min(1, Math.max(0, (w - 0.8) / 1.7));
      }

      let score = 0.3 * isOfficial + 0.34 * apCos + 0.14 * apOv + 0.1 * sameMain
        + 0.08 * tagCos + 0.04 * titleSim;

      // 思路毫无重合、又没有官方背书 → 封顶到代表阈值以下，禁止互相替代
      if (apOv <= 0 && !isOfficial) score = Math.min(score, 0.2);
      // 指纹是从标签猜的（没抓到题解）→ 打折，别把猜测当事实
      if (pGuessed || (qfp.length && qfp[0].from === "tags")) score *= 0.85;
      if (score < 0.18) continue;

      const why: string[] = [];
      if (isOfficial) why.push("官方相似题");
      if (q.seriesKey === p.seriesKey) { why.push("同一系列"); score += 0.12; }
      const shared = pfp.filter((a) => qfp.some((b) => b.id === a.id)).slice(0, 2).map((a) => a.name);
      if (shared.length) why.push(`同为 ${shared.join("、")}`);
      // 用 Python 口径的定点格式：0.625 要显示成 62% 而不是 63%（四舍六入五成双）
      if (apOv >= 0.55) why.push(`思路重合 ${fixed(apOv * 100, 0)}%`);
      if (!shared.length && tagCos > 0.6) why.push("仅标签接近");
      scored.push([pyRoundTo(Math.min(score, 1), 4), other, why]);
    }

    // 候选是从集合里遍历出来的，分数并列时顺序本来跟着构造顺序走，Top-12 每次跑
    // 会取到不同的邻居子集 —— 而相似度图是学习计划的上游，一路影响到「谁能代表谁」。
    // 并列按 slug 定序，产物才可复现。
    const ranked = sortBy(scored, ([sc, s]) => [-sc, s]);
    out[slug] = ranked.slice(0, SIM_KEEP).map(([sc, s, why]) => ({ slug: s, score: sc, why }));
  }
  return out;
}

// --- 学习价值打分 --------------------------------------------------------------

/**
 * 练习价值。
 *
 * 刻意不用「题解数量」—— 题解多只说明题目老、看的人多，不代表值得刷；
 * 真正的信号是面试频次、是否经典题号、以及通过率是否落在有区分度的区间。
 */
function valueScore(p: { freq: number; id: string; acRate: number }, maxFreq: number): number {
  const freq = maxFreq ? Math.log1p(p.freq) / Math.log1p(maxFreq) : 0;
  const classic = /^[0-9]+$/.test(p.id) ? 1 / (1 + Number(p.id) / 600) : 0.3;
  const sweet = 1 - Math.abs(p.acRate - 0.5) * 1.4;   // 通过率太高太低的题教学价值都一般
  return pyRoundTo(0.54 * freq + 0.28 * classic + 0.18 * Math.max(sweet, 0), 4);
}

// --- 主流程 --------------------------------------------------------------------

interface LeetListItem {
  titleSlug: string;
  title?: string;
  titleCn?: string;
  frontendQuestionId: string;
  difficulty: string;
  acRate?: number;
  paidOnly?: boolean;
  solutionNum?: number;
  topicTags: { slug: string; name: string; nameTranslated?: string }[];
}

interface Detail {
  content?: string;
  category?: string;
  similar?: { titleSlug?: string }[];
}

/** 读一份 jsonl 并按 `_key` 建索引，跳过抓取失败的记录。 */
function keyedJsonl<T>(path: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of readJsonl<T & { _key?: string; _error?: unknown }>(path)) {
    if (r._key && !r._error) out.set(r._key, r);
  }
  return out;
}

export function build(): void {
  const RAW = rawDir();
  const DIST = distDir();

  const raw = loadJson<LeetListItem[]>(join(RAW, "leetcode_list.json"));
  const details = keyedJsonl<Detail & { _key?: string }>(join(RAW, "leetcode_detail.jsonl"));
  const codetopPath = join(RAW, "codetop.json");
  const codetop = new Map<string, { freq: number; rank: number }>();
  if (existsSync(codetopPath)) {
    const blob = loadJson<{ items: { slug: string; freq: number; rank: number }[] }>(codetopPath);
    for (const r of blob.items) codetop.set(r.slug, r);
  }
  const solutions = keyedJsonl<{ articles?: { t?: string; g?: string[]; v?: number }[] }>(
    join(RAW, "solutions.jsonl"));
  const codes = keyedJsonl<{ blocks?: CodeBlock[] }>(join(RAW, "solution_code.jsonl"));

  let maxFreq = 0;
  for (const r of codetop.values()) maxFreq = Math.max(maxFreq, r.freq);

  // 先把每题的题解代码读成「思路 -> 证据强度」，打标和指纹都用它
  const specOf: Record<string, number> = {};
  for (const a of APPROACHES) specOf[a.id] = a.weight;
  const codeEv = new Map<string, Record<string, number>>();
  for (const [slug, rec] of codes) {
    const ev = analyzeBlocks(rec.blocks ?? []);
    if (Object.keys(ev).length) codeEv.set(slug, ev);
  }
  // 再自己读一遍题面：问法 + 数据范围 + 输入结构，推出该用什么解法（带理由）
  const stmtEv = new Map<string, Record<string, { s: number; why: string[] }>>();
  for (const p of raw) {
    const det = details.get(p.titleSlug);
    if (!det?.content) continue;
    const got = analyzeStatement(p.titleCn || p.title || "", det.content);
    if (Object.keys(got).length) stmtEv.set(p.titleSlug, got);
  }

  const unmapped = new Counter<string>();
  const reviews = loadReviews();
  if (reviews.size) process.stdout.write(`[build] 人工判定 ${reviews.size} 题，这些题的标签以人工为准\n`);
  const items: Problem[] = [];

  for (const p of raw) {
    const slug = p.titleSlug;
    const det = details.get(slug) ?? {};
    const title = p.titleCn || p.title || "";
    const tags = p.topicTags.map((t) => t.slug);
    const tagNames: Record<string, string> = {};
    for (const t of p.topicTags) tagNames[t.slug] = t.nameTranslated || t.name;
    for (const t of tags) if (!(t in TAG_MAP)) unmapped.add(t);

    const ev = codeEv.get(slug) ?? {};
    const sev = stmtEv.get(slug) ?? {};
    const sevFlat: Record<string, number> = {};
    for (const [aid, v] of Object.entries(sev)) sevFlat[aid] = v.s;

    const seeds = [
      ...tagSeeds(ev, specOf),
      ...tagSeeds(sevFlat, specOf, "题面推理", 0.85),
    ];
    const [main, tagList] = tagProblem(tags, title, p.frontendQuestionId, tagNames, seeds);
    const tagIds = tagList.map((t) => t.id);
    const cats = [...new Set(tagIds.map((t) => SUB_TO_CAT.get(t)!))];
    const ct = codetop.get(slug);

    const articles = solutions.get(slug)?.articles ?? [];
    const fp = fingerprint(articles, tagIds, ev, sevFlat);
    const approachIds = fp.map((a) => a.id);
    const approachWhy: Record<string, string[]> = {};
    const idSet = new Set(approachIds);
    for (const [aid, v] of Object.entries(sev)) {
      if (idSet.has(aid)) approachWhy[aid] = v.why.slice(0, 3);
    }
    const deep = deepTagRefs(tagIds, fp, tags, tagNames);
    const review = reviews.get(slug);
    const judged = review ? reviewTags(review) : null;

    const item: Problem = {
      id: p.frontendQuestionId,
      slug,
      title,
      titleEn: p.title || "",
      difficulty: p.difficulty as Problem["difficulty"],
      difficultyCn: DIFF_CN[p.difficulty] ?? p.difficulty,
      acRate: pyRoundTo(p.acRate ?? 0, 4),
      paid: Boolean(p.paidOnly),
      solutionCount: p.solutionNum ?? 0,       // 只做展示，不参与任何打分
      rawTags: tags,
      tagNames: p.topicTags.map((t) => t.nameTranslated || t.name),
      // 多标签：一题多解就会有多个标签，w 是可信度，src 说明这个标签怎么来的
      tags: judged ? judged.tags : [
        ...tagList.map((t) => ({
          id: t.id, name: SUB_BY_ID.get(t.id)!.name, cat: SUB_TO_CAT.get(t.id)!,
          w: t.w, src: t.src,
        })),
        ...deep,
      ],
      tagIds: judged ? judged.tagIds : tagIds,
      deepTagIds: judged ? judged.deepTagIds : deep.map((t) => t.id),
      mainTag: judged ? judged.main : main,
      mainTagName: SUB_BY_ID.get(judged ? judged.main : main)!.name,
      mainCat: SUB_TO_CAT.get(judged ? judged.main : main)!,
      cats: judged
        ? [...new Set(judged.tagIds.map((t) => SUB_TO_CAT.get(t)!))]
        : cats,
      catSpan: (judged
        ? [...new Set(judged.tagIds.map((t) => SUB_TO_CAT.get(t)!))]
        : cats).length,
      freq: ct ? ct.freq : 0,
      freqRank: ct ? ct.rank : 0,
      hasContent: Boolean(det.content),
      category: det.category || "Algorithms",
      seriesKey: seriesKey(title, "leetcode"),
      source: "leetcode",
      sourceName: "LeetCode",
      url: `https://leetcode.cn/problems/${slug}/`,
      approach: fp,
      approachIds,
      mainApproach: fp.length ? fp[0].name : "",
      approachFrom: fp.length ? fp[0].from : "none",
      solutionSampled: articles.length,
      codeBlocks: (codes.get(slug)?.blocks ?? []).length,
      // 「凭什么这么判」要能当场翻出来，否则打标就是黑箱
      approachWhy,
      ...(review ? { review: {
        solutions: review.solutions,
        ...(review.pitfall ? { pitfall: review.pitfall } : {}),
      } } : {}),
      value: 0,
    };
    item.value = valueScore(item, maxFreq);
    items.push(item);
  }

  // 并入其它题源（洛谷 / 牛客 / 自建题单），走同一套打标规则
  for (const extra of loadExtraSources(RAW)) {
    const [main, tagList] = tagProblem(extra.rawTags, extra.title, "", {}, extra.subHits);
    const tagIds = tagList.map((t) => t.id);
    const cats = [...new Set(tagIds.map((t) => SUB_TO_CAT.get(t)!))];
    const fp = fingerprint([], tagIds);
    // 洛谷抓不到题解，深层证据全靠平台自己的标签：slug 和中文原名都试一遍
    const deep = deepTagRefs(tagIds, fp, [...extra.rawTags, ...extra.tagNames]);
    const item: Problem = {
      id: extra.id,
      slug: extra.slug,
      title: extra.title,
      titleEn: extra.titleEn,
      difficulty: extra.difficulty as Problem["difficulty"],
      difficultyCn: DIFF_CN[extra.difficulty] ?? extra.difficulty,
      acRate: extra.acRate,
      paid: false,
      solutionCount: 0,
      rawTags: extra.rawTags,
      tagNames: extra.tagNames,
      tags: [
        ...tagList.map((t) => ({
          id: t.id, name: SUB_BY_ID.get(t.id)!.name, cat: SUB_TO_CAT.get(t.id)!,
          w: t.w, src: t.src,
        })),
        ...deep,
      ],
      tagIds,
      deepTagIds: deep.map((t) => t.id),
      mainTag: main,
      mainTagName: SUB_BY_ID.get(main)!.name,
      mainCat: SUB_TO_CAT.get(main)!,
      cats,
      catSpan: cats.length,
      freq: 0,
      freqRank: 0,
      hasContent: false,
      category: "Algorithms",
      seriesKey: seriesKey(extra.title, extra.source || "extra"),
      source: extra.source,
      sourceName: extra.sourceName,
      sourceHome: extra.sourceHome,
      url: extra.url,
      approach: fp,
      approachIds: fp.map((a) => a.id),
      mainApproach: fp.length ? fp[0].name : "",
      approachFrom: fp.length ? fp[0].from : "none",
      solutionSampled: 0,
      codeBlocks: 0,
      value: 0,
    };
    item.value = valueScore(item, maxFreq);
    items.push(item);
  }

  // 多标签口径：一道题打了几个标签就在几个标签下各记一次
  const subCounts = new Counter<string>();
  const catCounts = new Counter<string>();
  const subMain = new Counter<string>();
  const catMain = new Counter<string>();
  for (const p of items) {
    subCounts.update(p.tagIds);
    subCounts.update(p.deepTagIds ?? []);
    catCounts.update(p.cats);
    subMain.add(p.mainTag);
    catMain.add(p.mainCat);
  }
  const multi = items.filter((p) => p.catSpan >= 3).length;
  const fromCode = items.filter((p) => (p.approachFrom ?? "").includes("code")).length;
  const fromStmt = items.filter((p) => (p.approachFrom ?? "").includes("statement")).length;
  const cross = items.filter(
    (p) => (p.approachFrom ?? "").includes("code") && (p.approachFrom ?? "").includes("statement")).length;
  const withFp = items.filter((p) => p.approachFrom === "solutions").length;
  const withCode = items.filter((p) => p.codeBlocks).length;
  const avgFp = items.reduce((s, p) => s + (p.approachIds ?? []).length, 0) / items.length;
  const avgTags = items.reduce((s, p) => s + p.tagIds.length, 0) / items.length;

  const log = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  log(`[build] 题目 ${items.length}，CodeTop 高频 ${items.filter((p) => p.freq).length} 题，`
    + `平均 ${fixed(avgTags, 2)} 个解法标签，跨 3 个以上大类的一题多解 ${multi} 题`);
  log(`[build] 证据来源：${fromCode} 题主要思路由题解代码判定，${fromStmt} 题由题面推理判定，`
    + `其中 ${cross} 题两者互相印证；仅靠题解文字 ${withFp} 题`);
  const unmappedRows = sortBy(unmapped.entries(), ([, n]) => [-n]);
  if (unmappedRows.length) {
    log(`[build] 未映射标签 ${unmappedRows.length}: `
      + `${JSON.stringify(unmappedRows.slice(0, 8))}`);
  }
  const catByName = new Map(CATEGORIES.map((c) => [c.id, c.name]));
  log(`[build] 大类打标量: ${sortBy(catCounts.entries(), ([, n]) => [-n])
    .map(([c, n]) => `${catByName.get(c) ?? c}=${n}`).join(", ")}`);
  const thin = [...SUB_BY_ID.keys()].filter((s) => subCounts.get(s) < 12);
  if (thin.length) {
    log(`[build] 题量偏少的子类: ${thin.map((s) => `${SUB_BY_ID.get(s)!.name}=${subCounts.get(s)}`).join(", ")}`);
  }

  const similar = buildSimilarity(items, details);
  const neighbours = Object.values(similar).reduce((s, v) => s + v.length, 0) / items.length;
  log(`[build] 相似度：平均每题 ${fixed(neighbours, 1)} 个邻居`);

  let rawCurated: RawList[] = [];
  const curatedPath = join(RAW, "curated.json");
  if (existsSync(curatedPath)) {
    rawCurated = loadJson<{ lists?: RawList[] }>(curatedPath).lists ?? [];
  }
  const curated: CuratedList[] = buildCurated(items, rawCurated);
  const listed = new Set(curated.flatMap((l) => l.slugs));
  log(`[build] 特殊题单 ${curated.length} 份，共收录 ${listed.size} 道题`);

  const tree = exportTaxonomy().map((cat) => ({
    ...cat,
    count: catCounts.get(cat.id),
    main: catMain.get(cat.id),
    // 层数不固定，计数也递归下去
    subs: cat.subs.map(function countNode(node): unknown {
      return {
        ...node,
        count: subCounts.get(node.id),
        main: subMain.get(node.id),
        ...(node.kids?.length ? { kids: node.kids.map(countNode) } : {}),
      };
    }),
  }));

  dumpJson(join(DIST, "taxonomy.json"), tree, true);
  dumpJson(join(DIST, "problems.json"), items, true);
  dumpJson(join(DIST, "similar.json"), similar, true);
  dumpJson(join(DIST, "curated.json"), curated, true);

  // 题面单独存成可随机读取的一行一题，前端按需取
  const index: Record<string, [number, number]> = {};
  const contentPath = join(DIST, "content.jsonl");
  const fh = createWriteStream(contentPath, { encoding: "utf-8" });
  let offset = 0;
  for (const p of items) {
    const html = details.get(p.slug)?.content ?? "";
    if (!html) continue;
    const line = `${JSON.stringify({ slug: p.slug, html: cleanHtml(html) })}\n`;
    const size = Buffer.byteLength(line, "utf-8");
    index[p.slug] = [offset, size];
    fh.write(line);
    offset += size;
    void 0;
  }
  fh.end();
  dumpJson(join(DIST, "content_index.json"), index, true);

  // 「题目来源」和「标注来源」是两件事，不能并成一张表：题目来源互斥、加起来等于总题量；
  // CodeTop 和各种题单只是**标注在力扣题上**的，混在一起列会让 4430 + 1128 + 2000
  // 看着像 7558 道题。
  const SOURCE_HOME: Record<string, [string, string]> = {
    leetcode: ["LeetCode 中国站", "https://leetcode.cn/problemset/"],
  };
  const sourceRows = [...new Set(items.map((p) => p.source))].map((src) => {
    const rows = items.filter((p) => p.source === src);
    const [name, home] = SOURCE_HOME[src] ?? [rows[0].sourceName, ""];
    return { id: src, name, count: rows.length, url: home || rows[0].sourceHome || "" };
  });
  const overlayRows = [
    {
      id: "codetop", name: "CodeTop 面试频次",
      count: items.filter((p) => p.freq).length,
      note: "标注在力扣题上，不是独立题源", url: "https://codetop.cc/home",
    },
    {
      id: "curated", name: `特殊题单 ${curated.length} 份`,
      count: listed.size,
      note: "力扣官方学习计划 / CodeTop 榜单 / LCR 等，全部是力扣题",
      url: "https://leetcode.cn/studyplan/",
    },
  ];

  const now = new Date();
  const pad2 = (v: number): string => String(v).padStart(2, "0");
  const builtAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} `
    + `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  const diffCounts = new Counter<string>();
  for (const p of items) diffCounts.add(p.difficultyCn);

  const meta: Meta = {
    builtAt,
    sources: sourceRows,
    overlays: overlayRows,
    stats: {
      total: items.length,
      free: items.filter((p) => !p.paid).length,
      withContent: Object.keys(index).length,
      avgTags: pyRoundTo(avgTags, 2),
      multiApproach: multi,
      withApproach: withFp + fromCode,
      withCode,
      approachFromCode: fromCode,
      approachFromStatement: fromStmt,
      approachCrossChecked: cross,
      avgApproaches: pyRoundTo(avgFp, 2),
      difficulty: diffCounts.toObject(),
      cats: catCounts.toObject(),
      subs: subCounts.toObject(),
    },
  };
  dumpJson(join(DIST, "meta.json"), meta);
}
