/**
 * 基线数据：随包分发的那一份精简题库，装完不做任何事就能用。
 *
 * 它只包含两类东西 —— **事实标识**（题号、slug、标题、难度、链接、通用算法名）
 * 和**我们自己的产出**（解法标签、思路指纹、判定理由、相似度）。
 * 平台的题面、通过率、CodeTop 频次、官方精选题单都不在里面，那些要用户跑
 * `sinan sync` 自己抓 —— 抓来的落在 ~/.sinan，优先级高于这份基线。
 *
 * 格式为了进 git 压得很紧：字符串抽成池子用下标引用，能推导的字段一律不存。
 * 展开在这里做一次，还原成和完整产物一模一样的形状，上层代码看不出区别。
 */

import type {
  Category, Difficulty, Meta, Problem, ProblemReview, SimilarEntry, SubCategory,
} from "./types.js";
import { seriesMeta } from "./store.js";

/** 只有这两个题源，链接可以由 slug / 题号推出来，不必逐题存一遍。 */
export const URL_TEMPLATE: Record<string, string> = {
  leetcode: "https://leetcode.cn/problems/{slug}/",
  luogu: "https://www.luogu.com.cn/problem/{id}",
};

/** 紧凑格式的一条题目。字段顺序即语义，改这里要同步改 pack。 */
export interface PackedProblem {
  /** 题号 */ 0: string;
  /** slug */ 1: string;
  /** 标题 */ 2: string;
  /** 难度下标 */ 3: number;
  /** 题源下标 */ 4: number;
  /** 标签 [[标签下标, 权重, 来源下标[]], ...] */ 5: [number, number, number[]][];
  /** 思路 [[思路下标, 可信度×1000, 证据通道下标], ...] */ 6: [number, number, number][];
  /** 判定理由 {思路下标: 理由下标[]}，没有就省略 */ 7?: Record<string, number[]>;
  /** 人工判定（我们自己写的解法），没有就省略 */ 8?: ProblemReview;
}

export interface Packed {
  /** 格式版本，加载侧据此判断能不能读 */
  v: 1;
  builtAt: string;
  pool: {
    diff: string[];
    source: [id: string, name: string, urlTemplate: string][];
    tag: string[];
    approach: [id: string, name: string, domain: string, w: number][];
    channel: string[];
    tagSrc: string[];
    why: string[];
  };
  problems: PackedProblem[];
  /** 题目下标 -> [[邻居下标, 分数×10000, 命中信号下标[]], ...] */
  similar: Record<number, [number, number, number[]][]>;
  simWhy: string[];
  cats: Category[];
}

const DIFF_CN: Record<string, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };

export interface Expanded {
  problems: Problem[];
  similar: Record<string, SimilarEntry[]>;
  cats: Category[];
  meta: Meta;
}

/** 展开成和完整产物同构的形状。 */
export function expand(packed: Packed): Expanded {
  if (packed.v !== 1) {
    throw new Error(`基线数据格式版本 ${String(packed.v)} 不认识，升级一下 sinan`);
  }
  const { pool } = packed;
  // 层级不固定，所以按树走一遍：记下每个节点的名字、所属分区、深度和父节点
  const subToCat = new Map<string, string>();
  const subName = new Map<string, string>();
  const nodeDepth = new Map<string, number>();
  const nodeParent = new Map<string, string>();
  for (const c of packed.cats) {
    const walk = (nodes: readonly SubCategory[], parent: string, depth: number): void => {
      for (const s of nodes) {
        subToCat.set(s.id, c.id);
        subName.set(s.id, s.name);
        nodeDepth.set(s.id, depth);
        nodeParent.set(s.id, parent);
        if (s.kids?.length) walk(s.kids, s.id, depth + 1);
      }
    };
    walk(c.subs, c.id, 2);
  }

  const problems: Problem[] = packed.problems.map((row) => {
    const [sourceId, sourceName, template] = pool.source[row[4]];
    const difficulty = pool.diff[row[3]] as Difficulty;
    const tags = row[5].map(([at, w, src]) => {
      const id = pool.tag[at];
      const depth = nodeDepth.get(id) ?? 2;
      return {
        id,
        name: subName.get(id) ?? id,
        cat: subToCat.get(id) ?? "",
        w,
        src: src.map((i) => pool.tagSrc[i]),
        ...(depth >= 3 ? { level: depth, parent: nodeParent.get(id) } : {}),
      };
    });
    const approach = row[6].map(([at, conf, ch]) => {
      const [id, name, domain, w] = pool.approach[at];
      return { id, name, domain, conf: conf / 1000, w, hits: 0, from: pool.channel[ch] };
    });
    // 二级归 tagIds，更深的归 deepTagIds —— 和完整产物一个口径
    const tagIds = tags.filter((t) => (nodeDepth.get(t.id) ?? 2) === 2).map((t) => t.id);
    const deepTagIds = tags.filter((t) => (nodeDepth.get(t.id) ?? 2) >= 3).map((t) => t.id);
    const cats = [...new Set(tags.map((t) => t.cat))];
    const main = tagIds[0] ?? "";
    const approachWhy: Record<string, string[]> = {};
    for (const [at, lines] of Object.entries(row[7] ?? {})) {
      approachWhy[pool.approach[Number(at)][0]] = lines.map((i) => pool.why[i]);
    }
    // 「经典度」只用题号算，不依赖任何平台运营数据；没有频次时它就是排序的唯一依据
    const classic = /^[0-9]+$/.test(row[0]) ? 1 / (1 + Number(row[0]) / 600) : 0.3;

    return {
      id: row[0],
      slug: row[1],
      title: row[2],
      titleEn: "",
      difficulty,
      difficultyCn: DIFF_CN[difficulty] ?? difficulty,
      acRate: 0,
      paid: false,
      solutionCount: 0,
      rawTags: [],
      tagNames: [],
      tags,
      tagIds,
      deepTagIds,
      ...(row[8] ? { review: row[8] } : {}),
      mainTag: main,
      mainTagName: subName.get(main) ?? main,
      mainCat: subToCat.get(main) ?? "",
      cats,
      catSpan: cats.length,
      freq: 0,
      freqRank: 0,
      hasContent: false,
      category: "Algorithms",
      seriesKey: "",
      source: sourceId,
      sourceName,
      url: template.replace("{slug}", row[1]).replace("{id}", row[0]),
      approach,
      approachIds: approach.map((a) => a.id),
      mainApproach: approach.length ? approach[0].name : "",
      approachFrom: approach.length ? approach[0].from : "none",
      solutionSampled: 0,
      codeBlocks: 0,
      approachWhy,
      value: Math.round(0.28 * classic * 10000) / 10000,
    };
  });

  const similar: Record<string, SimilarEntry[]> = {};
  for (const [at, rows] of Object.entries(packed.similar)) {
    const self = problems[Number(at)];
    if (!self) continue;
    similar[self.slug] = rows
      .map(([other, score, why]) => ({
        slug: problems[other]?.slug ?? "",
        score: score / 10000,
        why: why.map((i) => packed.simWhy[i]),
      }))
      .filter((n) => n.slug);
  }

  // 统计当场算，不从产物里抄 —— 抄来的口径对不上，进度条就会算出大于 1 的比例
  const count = (key: (p: Problem) => string[]): Record<string, number> => {
    const acc: Record<string, number> = {};
    for (const p of problems) for (const k of key(p)) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  };
  const bySource = new Map<string, number>();
  for (const p of problems) bySource.set(p.source, (bySource.get(p.source) ?? 0) + 1);

  const meta: Meta = {
    builtAt: packed.builtAt,
    baseline: true,
    sources: [...bySource].map(([id, n]) => {
      const row = pool.source.find((s) => s[0] === id);
      return { id, name: row ? row[1] : id, count: n, url: "" };
    }),
    series: seriesMeta(problems),
    overlays: [],
    stats: {
      total: problems.length,
      free: problems.length,
      withContent: 0,
      avgTags: Math.round((problems.reduce((s, p) => s + p.tagIds.length, 0) / problems.length) * 100) / 100,
      multiApproach: problems.filter((p) => p.catSpan >= 3).length,
      withApproach: problems.filter((p) => (p.approachIds ?? []).length).length,
      withCode: 0,
      approachFromCode: problems.filter((p) => (p.approachFrom ?? "").includes("code")).length,
      approachFromStatement: problems.filter((p) => (p.approachFrom ?? "").includes("statement")).length,
      approachCrossChecked: problems.filter(
        (p) => (p.approachFrom ?? "").includes("code") && (p.approachFrom ?? "").includes("statement")).length,
      avgApproaches: Math.round((problems.reduce((s, p) => s + (p.approachIds ?? []).length, 0) / problems.length) * 100) / 100,
      difficulty: count((p) => [p.difficultyCn]),
      cats: count((p) => p.cats),
      subs: count((p) => p.tagIds),
    },
  };

  return { problems, similar, cats: packed.cats, meta };
}
