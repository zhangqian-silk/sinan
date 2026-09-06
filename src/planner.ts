/**
 * 学习计划生成：按题目真实的题解思路排布，用最少的题覆盖一个专题。
 *
 * 核心思路
 * --------
 * 一个专题里几十上百道题，真正需要动手的只有一小部分 —— 剩下的多半是同一个知识点
 * 组合的变体。所以先算「谁能代表谁」，再用贪心最小覆盖挑代表题：
 *
 * 1. **重要度** w(题)：面试频次 + 是否被官方/公司题单收录。
 *    刻意不看题解数量 —— 题解多只说明题老、看的人多，不代表值得刷。
 * 2. **覆盖关系** cover(题)：它自己 + 思路指纹真正重合且相似度达标的题目。
 *    判据是题解思路（前序/中序/层序、DFS/BFS、状态转移形状、具体定理），
 *    不是标签：两道题都标着「数学」但一道用埃氏筛一道用快速幂，互不代表。
 * 3. **贪心挑选**：每轮选边际覆盖权重最大的题，难度越低略微加权，
 *    保证开局是一道好上手的经典题，而不是一上来就是困难题。
 * 4. **典型场景补齐**：专题内按思路组合划分场景（中序遍历 × 迭代、滑动窗口 × 哈希…），
 *    权重够大却没被覆盖的场景补一道代表题。
 * 5. **递进排序**：难度 → 思路数量（单一思路先练，需要组合几种思路的后练）→ 重要度。
 *    每一步都标出「相对前面新增的思路」，所以顺序本身就是解题思路的推进路径。
 */

import { overlap } from "./approach.js";
import { DIFF_RANK, type Store, type Topic } from "./store.js";
import type { ApproachRef, Difficulty, Problem } from "./types.js";
import { Counter, pyRound, sortBy, type SortKey } from "./util.js";

export const SIM_THRESHOLD = 0.3;      // 相似度达到多少算「能被代表」
export const APPROACH_OVERLAP = 0.34;  // 思路指纹至少重合多少才算同类
export const COVER_TARGET = 0.85;      // 覆盖率目标
const SCENARIO_FLOOR = 0.06;           // 场景权重占比超过这个就必须有代表题
const MIN_GAIN = 0.8;                  // 边际覆盖低于这个就不值得再加一步
const CANON_FLOOR = 1.25;              // 当代表题的最低「经典度」，避免用冷门题代表经典题
const MINUTES: Record<Difficulty, number> = { EASY: 15, MEDIUM: 30, HARD: 50 };
const STAGE: Record<Difficulty, string> = { EASY: "入门", MEDIUM: "熟悉", HARD: "攻坚" };

const SHARP_W = 2.5;                   // 区分度到这个档才算「硬技巧」（只用于展示统计）

interface Pace {
  phases: [Difficulty, number, number][];
  mult: number;
}

/**
 * 选题的难度配比。默认 depth：易/中照旧把覆盖打足，困难题在此之上再加一层深度。
 *
 * 数据依据：困难题平均带 1.22 个硬技巧（简单题 0.35），但「能替代掉的题数」三档
 * 几乎一样（4.91 / 4.98 / 5.05）。所以困难题不能挤掉中等题的覆盖预算 ——
 * 挤掉只会让覆盖率崩，正确做法是总预算放大，困难题作为增量的深度层。
 */
export const PACE: Record<string, Pace> = {
  depth: {
    phases: [["EASY", 0.2, 3], ["MEDIUM", 0.42, 99], ["HARD", 0.6, 99]],
    mult: 1.35,
  },
  balanced: {
    phases: [["EASY", 0.22, 3], ["MEDIUM", 0.45, 99], ["HARD", 0.38, 8]],
    mult: 1.12,
  },
  coverage: {
    phases: [["EASY", 0.3, 3], ["MEDIUM", 0.6, 99], ["HARD", 0.2, 2]],
    mult: 1.0,
  },
};
export const DEFAULT_PACE = "depth";

/** 把一组 id 变成可比的集合键，等价于 Python 的 frozenset 当字典 key。 */
function setKey(ids: Iterable<string>): string {
  return [...new Set(ids)].sort().join("\u0001");
}

function keyMembers(key: string): string[] {
  return key ? key.split("\u0001") : [];
}

/** 本题带来的「硬技巧」：区分度够高、认得出的具体解法。 */
export function sharpIds(p: Problem): Set<string> {
  const out = new Set<string>();
  for (const a of p.approach ?? []) if (a.w >= SHARP_W) out.add(a.id);
  return out;
}

/**
 * 这道题能带来多少「新东西」，按思路的区分度加权。
 *
 * 不用硬阈值：前序/中序/后序/层序的区分度是 2.0，够不上「硬技巧」的 2.5，
 * 但对树专题来说它们正是要练的东西，所以按 (w - 0.8) 平滑计分，
 * 「递归」「模拟」这种泛化说法只贡献一点点。
 */
function novelty(p: Problem, seen: Set<string>): number {
  let total = 0;
  for (const a of p.approach ?? []) {
    if (!seen.has(a.id)) total += Math.max(a.w - 0.8, 0);
  }
  return total;
}

/**
 * 这道题有多能代表「这个知识点」。
 *
 * 环形链表确实带哈希标签（哈希表是它的一种解法），但拿它当「哈希与计数」的
 * 代表题就跑偏了。所以按 topicTag 在这道题标签里的位次打折：
 * 主标签就是它 → 不打折；排第二 → 轻微打折；更靠后 → 明显打折。
 */
function relevance(p: Problem, topicTag: string): number {
  if (!topicTag) return 1.0;
  const ids = p.tagIds ?? [];
  const idx = ids.indexOf(topicTag);
  if (!ids.length || idx === -1) return 0.6;
  if (idx === 0) return 1.0;
  if (idx === 1) return 0.85;
  return 0.6;
}

export interface Step {
  p: Problem;
  stage: string;
  /** 本题的真实题解思路 */
  approaches: string[];
  /** 相对前面步骤新增的思路 */
  newApproaches: string[];
  /** 知识点标签（辅助信息） */
  focus: string[];
  /** 新增的知识点标签 */
  newPoints: string[];
  /** 这一步代表掉的同类题 */
  covers: Problem[];
  /** 一共代表了多少道 */
  coversTotal: number;
  /** 为什么选它 */
  reasons: string[];
  /** 是否属于最小覆盖集 */
  core: boolean;
}

export interface Section {
  key: string;
  name: string;
  desc: string;
  steps: Step[];
  pool: number;
  covered: number;
}

export class Plan {
  constructor(
    readonly topic: Topic,
    readonly sections: Section[],
    readonly poolSize: number,
    readonly mode: string,
    readonly covered: number = 0,
    /** 未做「值得练」筛选前的题量 */
    readonly totalPool: number = 0,
    readonly pace: string = DEFAULT_PACE,
  ) {}

  get steps(): Step[] {
    return this.sections.flatMap((sec) => sec.steps);
  }

  get coveragePct(): number {
    return this.poolSize ? (100 * this.covered) / this.poolSize : 0;
  }

  get minutes(): number {
    return this.steps.reduce((sum, s) => sum + MINUTES[s.p.difficulty], 0);
  }

  /** 难度结构，用来一眼看出这份计划的重心在哪。 */
  get mix(): Counter<string> {
    const acc = new Counter<string>();
    for (const s of this.steps) acc.add(s.p.difficultyCn);
    return acc;
  }

  /** 这份计划一共覆盖到多少硬技巧。 */
  get sharp(): Set<string> {
    const out = new Set<string>();
    for (const s of this.steps) for (const id of sharpIds(s.p)) out.add(id);
    return out;
  }
}

// --- 打分 ---------------------------------------------------------------------

/** 这道题有多值得练。只看面试频次和题单背书，不看题解数量。 */
export function importance(p: Problem, inLists: boolean): number {
  let w = 1.0;
  w += (1.6 * Math.log1p(p.freq)) / Math.log1p(1200);
  if (inLists) w += 0.8;
  return w;
}

/**
 * 谁能代表谁：思路指纹真正重合，才算能互相替代。
 *
 * 两条路径都要求思路重合：
 * - 相似度达标（相似度本身已经以思路为主）且思路重合度 ≥ APPROACH_OVERLAP；
 * - 思路指纹完全相同，且指纹是从真实题解提取的（不是标签猜的）。
 *   桶太大时还要求难度同档，避免一道简单题号称代表几十道困难题。
 *
 * 两条硬门槛，都是为了不让「做了 A 就不用做 B」这个断言建立在猜测上：
 *
 * 1. **两边都必须有真实证据**（题解代码 / 题面推理 / 题解文字），纯官方标签猜出来的
 *    指纹不能参与。否则会出现「整数反转代表线性方程组」这种事 —— 它们的指纹都是
 *    从力扣宽泛的 `math` 标签猜成「GCD」的，109 道题共享同一个假指纹、互相 100% 重合。
 * 2. **不跨平台**。洛谷题只有官方标签、力扣题有题解代码，证据量级不对等；
 *    而且「做了洛谷那道就不用做力扣这道」对在力扣刷题的人没有意义。
 */
export function coverageMap(pool: readonly Problem[], sim: Record<string, { slug: string; score: number }[]>): Map<string, Set<string>> {
  const inside = new Set(pool.map((p) => p.slug));
  const fp = new Map<string, ApproachRef[]>();
  const tierOf = new Map<string, Difficulty>();
  const srcOf = new Map<string, string>();
  const solid = new Map<string, boolean>();
  for (const p of pool) {
    const list = p.approach ?? [];
    fp.set(p.slug, list);
    tierOf.set(p.slug, p.difficulty);
    srcOf.set(p.slug, p.source ?? "");
    // 指纹有真实证据（不是纯靠官方标签猜的）才算数。
    // 注意这里不能写 === "solutions"：证据来源现在是 code / code+statement 这种组合，
    // 写死单个值会把最硬的代码证据反而排除掉。
    solid.set(p.slug, list.length > 0 && list[0].from !== "tags");
  }

  const buckets = new Map<string, string[]>();
  for (const p of pool) {
    const ids = p.approachIds ?? [];
    const sig = setKey(ids);
    if (new Set(ids).size >= 2 && solid.get(p.slug)) {
      const bucket = buckets.get(sig) ?? [];
      bucket.push(p.slug);
      buckets.set(sig, bucket);
    }
  }

  const cover = new Map<string, Set<string>>();
  for (const p of pool) {
    const slug = p.slug;
    const own = new Set<string>([slug]);
    if (!solid.get(slug)) {
      cover.set(slug, own);      // 自己的指纹都是猜的，没资格代表别人
      continue;
    }
    for (const n of sim[slug] ?? []) {
      const other = n.slug;
      if (!inside.has(other) || n.score < SIM_THRESHOLD) continue;
      if (!solid.get(other) || srcOf.get(other) !== srcOf.get(slug)) continue;
      // 对方指纹是猜的，或者跨平台 → 不能算被代表
      if (overlap(fp.get(slug) ?? [], fp.get(other) ?? []) < APPROACH_OVERLAP) continue;
      // 分数够但思路不同（比如两数之和 vs 三数之和）→ 不算代表
      own.add(other);
    }
    let same = buckets.get(setKey(p.approachIds ?? [])) ?? [];
    if (same.length > 1) {
      same = same.filter((s) => srcOf.get(s) === srcOf.get(slug));
      if (same.length <= 12) {
        for (const s of same) own.add(s);
      } else {
        for (const s of same) if (tierOf.get(s) === p.difficulty) own.add(s);
      }
    }
    cover.set(slug, own);
  }

  // 相似度是对称关系，但两边取的 Top-12 不一定互相包含，补齐一下
  for (const [slug, members] of [...cover.entries()]) {
    for (const other of members) {
      if (other === slug) continue;
      let bucket = cover.get(other);
      if (!bucket) {
        bucket = new Set([other]);
        cover.set(other, bucket);
      }
      bucket.add(slug);
    }
  }
  return cover;
}

/**
 * 本题属于哪种典型场景 = 它的主要思路组合。
 *
 * 比如同为「二叉树遍历」专题，中序+迭代 和 层序+队列 是两种场景，
 * 各自都需要一道代表题。
 */
function scenarioOf(p: Problem, topicTag: string): string {
  const ids = (p.approach ?? []).slice(0, 3).map((a) => a.id);
  if (ids.length) return setKey(ids);
  return setKey(p.tagIds.filter((t) => t !== topicTag));
}

// --- 选代表题 ------------------------------------------------------------------

export interface SelectOptions {
  target?: number;
  maxSteps?: number;
  pace?: string;
  canonPow?: number;
  seedCanon?: boolean;
}

export interface Selection {
  chosen: Problem[];
  cover: Map<string, Set<string>>;
  reasons: Map<string, string[]>;
}

/**
 * 返回 (代表题列表, 覆盖表, 每题被选中的理由)。
 *
 * 选题分三档推进：入门（简单）→ 熟悉（中等）→ 攻坚（困难），配比由 pace 决定。
 *
 * 两档的目标函数不一样，这是刻意的：
 * - 简单/中等档求**覆盖**：用最少的题把这个专题的常见形态过一遍，建立手感；
 * - 困难档求**新硬技巧**：困难题能替代掉的题并不比简单题多（实测 5.05 vs 4.91），
 *   它的价值在于平均带 1.22 个硬技巧（简单题只有 0.35），而且线段树、状压 DP、
 *   Tarjan 这类技巧只存在于困难题里。所以困难档按「还没见过的硬技巧」来挑，
 *   也不再被覆盖率提前卡住。
 *
 * canonPow 放大经典度的话语权。专题计划求覆盖（默认 1.0），主线路线求经典
 * （传 2.0）—— 入门筑基的哈希一节就该是两数之和，而不是恰好相似题多的周赛题。
 *
 * seedCanon=true 会先把「这个知识点的必做经典题」钉在第一位。因为两数之和这类
 * 经典题的思路很泛化（哈希表 + 暴力枚举），按覆盖量算分反而吃亏，光靠贪心排不上来。
 */
export function selectRepresentatives(
  store: Store,
  pool: readonly Problem[],
  topicTag: string,
  options: SelectOptions = {},
): Selection {
  const { target = COVER_TARGET, pace = DEFAULT_PACE, canonPow = 1.0, seedCanon = false } = options;
  let maxSteps = options.maxSteps ?? 20;
  if (!pool.length) return { chosen: [], cover: new Map(), reasons: new Map() };

  const cover = coverageMap(pool, store.similar());
  const bySlug = new Map(pool.map((p) => [p.slug, p]));
  const membership = store.listMembership();
  const weight = new Map<string, number>();
  for (const p of pool) weight.set(p.slug, importance(p, Boolean(membership.get(p.slug)?.length)));
  let totalWeight = 0;
  for (const w of weight.values()) totalWeight += w;

  // 覆盖集的求和顺序必须固定。两道题覆盖的是同一批题时，边际收益就该分毫不差 ——
  // 否则浮点加法的顺序会让它们差出一个 ULP，把本该由「谁在题池里排前面」决定的
  // 并列，变成由集合构造顺序决定的，选出来的代表题就成了实现细节的副产品。
  const coverSorted = new Map<string, string[]>();
  for (const [slug, members] of cover) coverSorted.set(slug, [...members].sort());

  const scenarios = new Map<string, string[]>();
  for (const p of pool) {
    const key = scenarioOf(p, topicTag);
    const bucket = scenarios.get(key) ?? [];
    bucket.push(p.slug);
    scenarios.set(key, bucket);
  }
  const scenarioWeight = new Map<string, number>();
  for (const [key, slugs] of scenarios) {
    scenarioWeight.set(key, slugs.reduce((sum, s) => sum + (weight.get(s) ?? 0), 0));
  }

  const covered = new Set<string>();
  const chosen: Problem[] = [];
  const chosenSlugs = new Set<string>();
  const reasons = new Map<string, string[]>();
  const seenAp = new Set<string>();

  const coveredRatio = (): number => {
    if (!totalWeight) return 1.0;
    let sum = 0;
    for (const q of [...covered].sort()) sum += weight.get(q) ?? 0;
    return sum / totalWeight;
  };

  const take = (p: Problem, why: string): void => {
    const bucket = cover.get(p.slug) ?? new Set([p.slug]);
    let newly = 0;
    for (const q of bucket) if (!covered.has(q)) newly += 1;
    chosen.push(p);
    chosenSlugs.add(p.slug);
    for (const q of bucket) covered.add(q);
    for (const a of p.approach ?? []) seenAp.add(a.id);
    reasons.set(p.slug, [why.replace("{n}", String(newly))]);
  };

  const gainOf = (slug: string): number => {
    let gain = 0;
    for (const q of coverSorted.get(slug) ?? []) {
      if (covered.has(q)) continue;
      const w = weight.get(q);
      if (w !== undefined) gain += w;
    }
    return gain;
  };

  const profile = PACE[pace] ?? PACE[DEFAULT_PACE];
  // depth 档把总预算放大，让困难题是「加上去的深度层」，而不是挤掉中等题的覆盖
  maxSteps = Math.min(pool.length, Math.max(maxSteps, pyRound(maxSteps * profile.mult)));

  if (seedCanon) {
    const entry = pool.filter((p) => p.difficulty === "EASY" || p.difficulty === "MEDIUM");
    const candidates = entry.length ? entry : pool;
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const p of candidates) {
      const score = (weight.get(p.slug) ?? 0) * relevance(p, topicTag);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if ((weight.get(best.slug) ?? 0) * relevance(best, topicTag) >= CANON_FLOOR) {
      take(best, "本知识点的必做经典题");
    }
  }

  // 某一档没题时，把预算让给下一档，别浪费步数
  let spare = 0;
  for (const [tier, share, tierCap] of profile.phases) {
    const cands = pool.filter((p) => p.difficulty === tier);
    if (!cands.length) {
      spare += Math.max(1, pyRound(maxSteps * share));
      continue;
    }
    const budget = Math.min(
      tierCap,
      Math.max(1, pyRound(maxSteps * share)) + spare,
      maxSteps - chosen.length,
    );
    spare = 0;
    if (budget <= 0) break;

    for (let step = 0; step < budget; step += 1) {
      let best: Problem | null = null;
      let bestScore = 0;
      for (const p of cands) {
        const slug = p.slug;
        if (chosenSlugs.has(slug)) continue;
        const gain = gainOf(slug);
        const canon = weight.get(slug) ?? 0;
        const fresh = novelty(p, seenAp);
        const rel = relevance(p, topicTag);

        let score: number;
        if (tier === "HARD") {
          // 攻坚档：新硬技巧是主目标，覆盖只当次要加成
          if (canon < CANON_FLOOR && fresh < 1.0) continue;
          score = (fresh * 2.2 + 1.0 + 0.25 * gain) * (0.4 + canon) ** canonPow * rel;
        } else {
          // 冷门题只有在能覆盖一大片时才配当代表
          if (canon < CANON_FLOOR && gain < 0.08 * totalWeight) continue;
          if (gain < MIN_GAIN) continue;
          // 经典度是主要因素：宁可用经典题代表冷门题，不能反过来
          score = (gain + 1.0 + 0.5 * fresh) * (0.4 + canon) ** canonPow * rel;
        }
        if (score > bestScore) { best = p; bestScore = score; }
      }
      if (best === null) break;
      if (tier === "HARD") {
        const newIds = (best.approach ?? [])
          .filter((a) => !seenAp.has(a.id) && a.w >= 2.0)
          .map((a) => a.id);
        if (newIds.length) {
          const names = newIds
            .filter((i) => store.approachById.has(i))
            .map((i) => store.approachById.get(i)!.name)
            .join("、");
          take(best, `攻坚：带来新思路 ${names}`);
        } else {
          take(best, "攻坚：本专题的困难代表题");
        }
      } else {
        take(best, "代表 {n} 道同类题");
        // 易/中两档负责覆盖，覆盖够了就把剩下的步数让给攻坚档
        if (tier === "MEDIUM" && coveredRatio() >= target) break;
      }
    }
  }

  // 典型场景补齐：权重够大却还没有代表题的场景，补一道最容易上手的
  // 池子太小的时候没有冗余可言，补齐等于把整池抄一遍，跳过
  if (pool.length >= 8) {
    const ordered = sortBy([...scenarioWeight.entries()], ([, w]) => [-w]);
    for (const [scene] of ordered) {
      if ((scenarioWeight.get(scene) ?? 0) / totalWeight < SCENARIO_FLOOR) continue;
      let taken = false;
      for (const s of chosenSlugs) {
        const q = bySlug.get(s);
        if (q && scenarioOf(q, topicTag) === scene) { taken = true; break; }
      }
      if (taken) continue;
      const ranked = sortBy(
        (scenarios.get(scene) ?? []).map((s) => bySlug.get(s)!),
        (q) => [-(weight.get(q.slug) ?? 0), DIFF_RANK[q.difficulty]],
      );
      const pick = ranked[0];
      if (!pick || chosenSlugs.has(pick.slug)) continue;
      const members = keyMembers(scene).sort();
      let names = members
        .filter((t) => store.approachById.has(t))
        .map((t) => store.approachById.get(t)!.name)
        .join("、");
      if (!names) {
        names = members
          .filter((t) => store.subById.has(t))
          .map((t) => store.subById.get(t)!.name)
          .join("、");
      }
      take(pick, names ? `补齐典型场景：${names}` : "补齐典型场景：只考单一知识点的基础形态");
    }
  }

  // 题量少的专题（多线程、后缀结构这种）不能只给一道，按池子大小兜个下限
  const minSteps = Math.min(4, Math.max(1, pyRound(pool.length * 0.35)));
  if (chosen.length < minSteps) {
    const rest = sortBy(
      pool.filter((p) => !chosenSlugs.has(p.slug)),
      (q) => [-(weight.get(q.slug) ?? 0), DIFF_RANK[q.difficulty]],
    );
    for (const p of rest.slice(0, minSteps - chosen.length)) take(p, "这组题量少，一并练掉");
  }

  // 困难题不够多时（很多专题就没几道困难题），剩下的步数回填给覆盖率
  if (chosen.length < maxSteps && coveredRatio() < target) {
    while (chosen.length < maxSteps) {
      let best: Problem | null = null;
      let bestGain = 0;
      for (const p of pool) {
        if (chosenSlugs.has(p.slug)) continue;
        const gain = gainOf(p.slug);
        if (gain > bestGain) { best = p; bestGain = gain; }
      }
      if (best === null || bestGain < MIN_GAIN) break;
      take(best, "回填覆盖：代表 {n} 道同类题");
    }
  }

  return { chosen, cover, reasons };
}

// --- 排布成计划 ----------------------------------------------------------------

/** 递进顺序：难度 → 思路数量（单一思路先练，要组合几种思路的后练）→ 重要度。 */
function progressionKey(store: Store, p: Problem): SortKey {
  const complexity = (p.approachIds ?? []).length || p.tagIds.length;
  return [
    DIFF_RANK[p.difficulty],
    complexity,
    -importance(p, Boolean(store.listMembership().get(p.slug))),
  ];
}

function makeSteps(
  store: Store,
  ordered: readonly Problem[],
  cover: Map<string, Set<string>>,
  reasons: Map<string, string[]>,
  core: Set<string>,
  seenPoints: Set<string>,
  seenApproaches: Set<string>,
): Step[] {
  const steps: Step[] = [];
  for (const p of ordered) {
    const fp = p.approach ?? [];
    const approaches = fp.map((a) => a.name);
    const newAppr = fp.filter((a) => !seenApproaches.has(a.id)).map((a) => a.name);
    for (const a of fp) seenApproaches.add(a.id);

    const focus = p.tags.map((t) => t.name);
    const newPoints = p.tags.filter((t) => !seenPoints.has(t.id)).map((t) => t.name);
    for (const t of p.tags) seenPoints.add(t.id);

    const coversRaw: Problem[] = [];
    for (const s of cover.get(p.slug) ?? []) {
      if (s === p.slug) continue;
      const q = store.bySlug.get(s);
      if (q) coversRaw.push(q);
    }
    // 频次相同时按题号兜底，保证同一份数据每次跑出来的「代表」列表一致
    const covers = sortBy(coversRaw, (q) => [-(q.freq || 0), q.slug]);
    const coversTotal = covers.length;

    const why = [...(reasons.get(p.slug) ?? [])];
    if (p.freqRank && p.freqRank <= 100) why.push(`CodeTop 第 ${p.freqRank} 名`);
    const lists = store.listNamesOf(p);
    if (lists.length) why.push(lists.slice(0, 2).join("、"));
    if (fp.length >= 3) why.push(`题解里有 ${fp.length} 种思路`);
    if (fp.length && fp[0].from === "tags") why.push("思路由标签推断");
    if (!why.length) why.push("补充练习");

    steps.push({
      p,
      stage: STAGE[p.difficulty],
      approaches,
      newApproaches: newAppr,
      focus,
      newPoints,
      covers: covers.slice(0, 6),
      coversTotal,
      reasons: why,
      core: core.has(p.slug),
    });
  }
  return steps;
}

interface SectionOptions {
  pace?: string;
  canonPow?: number;
  seedCanon?: boolean;
}

function sectionForPool(
  store: Store,
  key: string,
  name: string,
  desc: string,
  pool: readonly Problem[],
  topicTag: string,
  mode: string,
  maxSteps: number,
  seenPoints: Set<string>,
  seenApproaches: Set<string>,
  options: SectionOptions = {},
): Section {
  const { pace = DEFAULT_PACE, canonPow = 1.0, seedCanon = false } = options;
  const { chosen, cover, reasons } = selectRepresentatives(store, pool, topicTag, {
    maxSteps, pace, canonPow, seedCanon,
  });
  const core = new Set(chosen.map((c) => c.slug));
  const listed = mode === "minimal" ? chosen : pool;
  const ordered = sortBy(listed, (p) => progressionKey(store, p));
  const coveredSet = new Set<string>();
  for (const c of chosen) for (const s of cover.get(c.slug) ?? []) coveredSet.add(s);
  const steps = makeSteps(store, ordered, cover, reasons, core, seenPoints, seenApproaches);
  return { key, name, desc, steps, pool: pool.length, covered: coveredSet.size };
}

export interface PlanTopicOptions {
  mode?: string;
  includePaid?: boolean;
  source?: string;
  maxSteps?: number;
  quality?: boolean;
  pace?: string;
}

export function planTopic(store: Store, topic: Topic, options: PlanTopicOptions = {}): Plan {
  const {
    includePaid = false, source = "", maxSteps = 0, quality = true, pace = DEFAULT_PACE,
  } = options;
  let mode = options.mode ?? "minimal";
  const fullPool = store.members(topic, { includePaid, source });
  const pool = store.members(topic, { includePaid, source, quality });
  if (mode === "auto") {
    // 题单本身就是精选，默认完整列出（代表题标 ★）；标签/大类默认只给代表题
    mode = topic.kind === "list" ? "full" : "minimal";
  }
  const seenPoints = new Set<string>();
  const seenApproaches = new Set<string>();
  let sections: Section[] = [];

  if (topic.kind === "tag") {
    const budget = maxSteps || budgetFor(pool.length);
    sections.push(sectionForPool(
      store, topic.id, topic.name, topic.desc, pool, topic.id, mode, budget,
      seenPoints, seenApproaches, { pace }));
  } else {
    // 大类 / 题单都按子标签（知识点）分节，节内再做递进
    for (const [tagId, members] of groupByTag(store, pool, topic)) {
      let name: string;
      let desc: string;
      let topicTag: string;
      if (tagId.startsWith("official:")) {
        name = tagId.slice("official:".length);
        desc = "力扣官方在这份题单里划分的知识点";
        topicTag = dominantTag(members);
      } else {
        const sub = store.subById.get(tagId);
        name = sub ? sub.name : tagId;
        desc = sub ? sub.desc : "";
        topicTag = tagId;
      }
      const budget = maxSteps || budgetFor(members.length, true);
      sections.push(sectionForPool(
        store, tagId, name, desc, members, topicTag, mode, budget,
        seenPoints, seenApproaches, { pace }));
    }
  }

  const covered = sections.reduce((sum, sec) => sum + sec.covered, 0);
  if (mode === "minimal" && sections.length > 1) {
    sections = dedupeAcrossSections(store, sections, pool);
  }
  return new Plan(topic, sections, pool.length, mode,
    Math.min(covered, pool.length), fullPool.length, pace);
}

/** 官方分组内出现最多的主标签，用来算这一组的「典型场景」。 */
function dominantTag(members: readonly Problem[]): string {
  const counts = new Counter<string>();
  for (const p of members) counts.add(p.mainTag);
  return counts.top() ?? "";
}

// --- 主线路线 ------------------------------------------------------------------
//
// 「专题」有 106 个（13 大类 + 65 子标签 + 28 题单），那是练习素材的索引，
// 不是学习计划 —— 把它们当计划列出来，等于让人从 106 个等价选项里挑一个。
// 真正的学习计划应该是少数几条**跨专题的成体系路线**，下面 4 条就是。

export interface Route {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  /** 按先修顺序推进的专题 */
  topics: string[];
  pace: string;
  perTopic: number;
  /** 限定难度 */
  diffs: Difficulty[];
  /** 只取 CodeTop 榜内题 */
  hotOnly: boolean;
  /** 非空表示专题列表按当前进度动态生成 */
  dynamic: string;
  /** 主线偏经典题；调回 1.0 就变成覆盖优先 */
  canonPow: number;
  /** 每节先钉一道必做经典题 */
  seedCanon: boolean;
}

function route(init: Partial<Route> & Pick<Route, "id" | "name" | "tagline" | "desc">): Route {
  return {
    topics: [], pace: "coverage", perTopic: 3, diffs: [], hotOnly: false,
    dynamic: "", canonPow: 2.0, seedCanon: true,
    ...init,
  };
}

export const ROUTES: Route[] = [
  route({
    id: "starter", name: "入门筑基", tagline: "把最常用的套路打通，建立手感",
    desc: "十个最常用的子标签，每个取 3 道代表题。只用简单和中等题，"
      + "先把模板写顺，不追求覆盖率。",
    topics: ["hash-count", "two-pointers", "sliding-window", "linked-list",
      "stack-queue", "tree-traversal", "bs-array", "prefix-sum",
      "backtracking", "dp-linear"],
    pace: "coverage", perTopic: 3, diffs: ["EASY", "MEDIUM"],
  }),
  route({
    id: "interview", name: "面试冲刺", tagline: "只练大厂真的会问的那批题",
    desc: "十二个面试高频子标签，每个取 4 道，且只从 CodeTop 榜内题里挑。"
      + "按先修顺序推进，保证每个知识点都被覆盖，而不是按频次乱刷。",
    topics: ["hash-count", "sliding-window", "two-pointers", "linked-list",
      "monotonic", "heap", "tree-traversal", "tree-path",
      "bs-answer", "graph-basic", "dp-linear", "ds-design"],
    pace: "balanced", perTopic: 4, hotOnly: true,
  }),
  route({
    id: "advanced", name: "进阶通关", tagline: "拉开区分度的三块硬骨头",
    desc: "动态规划、图论、高级数据结构。用重攻坚节奏，困难题为主，"
      + "目标是把这些领域独有的硬技巧拿到手。",
    topics: ["dp", "graph", "advanced-ds"],
    pace: "depth", perTopic: 0, diffs: ["MEDIUM", "HARD"],
  }),
  route({
    id: "weakness", name: "补弱项", tagline: "按你当前进度实时生成",
    desc: "挑出「高频题里还没刷的最多」的八个子标签，每个给 3 道代表题。"
      + "刷完一批再看，列表会跟着变。",
    dynamic: "weak", pace: "balanced", perTopic: 3,
  }),
];

export const ROUTE_BY_ID = new Map(ROUTES.map((r) => [r.id, r]));

export function routeTopics(store: Store, r: Route): Topic[] {
  const ids = r.dynamic === "weak"
    ? weakTopics(store, 8).map(([tag]) => tag)
    : [...r.topics];
  const topics = store.topics();
  return ids.map((i) => topics.get(i)).filter((t): t is Topic => Boolean(t));
}

/** 把一条主线摊成计划：每个专题贡献几道代表题，跨专题去重、思路连续累积。 */
export function planRoute(store: Store, r: Route, includePaid = false): Plan {
  const seenPoints = new Set<string>();
  const seenApproaches = new Set<string>();
  const used = new Set<string>();
  const sections: Section[] = [];
  let poolTotal = 0;

  for (const topic of routeTopics(store, r)) {
    let pool = store.members(topic, { includePaid, quality: true });
    if (r.diffs.length) pool = pool.filter((p) => r.diffs.includes(p.difficulty));
    if (r.hotOnly) pool = pool.filter((p) => p.freq);
    pool = pool.filter((p) => !used.has(p.slug));
    if (pool.length < 2) continue;
    poolTotal += pool.length;

    const budget = r.perTopic || budgetFor(pool.length, true);
    const sec = sectionForPool(
      store, topic.id, topic.name, topic.desc, pool,
      topic.kind === "tag" ? topic.id : dominantTag(pool),
      "minimal", budget, seenPoints, seenApproaches,
      { pace: r.pace, canonPow: r.canonPow, seedCanon: r.seedCanon });
    if (!sec.steps.length) continue;
    // 主线的题量要可预期：场景补齐/回填可能超出预算，这里按递进顺序硬截断
    if (r.perTopic && sec.steps.length > r.perTopic) sec.steps = sec.steps.slice(0, r.perTopic);
    for (const s of sec.steps) used.add(s.p.slug);
    sections.push(sec);
  }

  const topic: Topic = {
    id: r.id, name: r.name, kind: "route", desc: r.desc,
    cat: "", slugs: [], groups: [], url: "", source: "",
  };
  const covered = sections.reduce((sum, sec) => sum + sec.covered, 0);
  return new Plan(topic, sections, poolTotal, "minimal",
    Math.min(covered, poolTotal), poolTotal, r.pace);
}

/**
 * 跨知识点去重。
 *
 * 题单被切成很多小知识点组时，组内已经压不动了，冗余其实发生在组之间：
 * A 组挑的题往相似度上已经代表了 B 组的某题。所以按顺序走一遍，
 * 既不带来新知识点、又已经被前面代表掉、也不是必做经典的题就去掉。
 */
function dedupeAcrossSections(store: Store, sections: Section[], pool: readonly Problem[]): Section[] {
  const cover = coverageMap(pool, store.similar());
  const covered = new Set<string>();
  const seenPoints = new Set<string>();
  const seenAppr = new Set<string>();

  for (const sec of sections) {
    const kept: Step[] = [];
    for (const step of sec.steps) {
      const slug = step.p.slug;
      const fp = step.p.approach ?? [];
      const freshAp = fp.filter((a) => !seenAppr.has(a.id)).map((a) => a.id);
      const fresh = step.p.tags.filter((t) => !seenPoints.has(t.id)).map((t) => t.id);
      const mustDo = Boolean(step.p.freqRank && step.p.freqRank <= 50);
      if (covered.has(slug) && !freshAp.length && !fresh.length && !mustDo && kept.length) continue;
      const freshApSet = new Set(freshAp);
      const freshSet = new Set(fresh);
      step.newApproaches = fp.filter((a) => freshApSet.has(a.id)).map((a) => a.name);
      step.newPoints = step.p.tags.filter((t) => freshSet.has(t.id)).map((t) => t.name);
      for (const a of fp) seenAppr.add(a.id);
      for (const t of step.p.tags) seenPoints.add(t.id);
      for (const s of cover.get(slug) ?? [slug]) covered.add(s);
      kept.push(step);
    }
    sec.steps = kept;
  }
  return sections.filter((sec) => sec.steps.length);
}

function budgetFor(poolSize: number, section = false): number {
  if (poolSize <= 4) return section ? Math.max(1, pyRound(poolSize * 0.7)) : poolSize;
  const raw = pyRound(Math.sqrt(poolSize) * (section ? 1.1 : 1.6));
  return Math.max(section ? 2 : 5, Math.min(raw, section ? 8 : 20));
}

/**
 * 把题归到知识点分组。
 *
 * 题单如果自带官方知识点分组（热题 100 的 哈希/双指针/滑动窗口…，SQL 50 的
 * 基础查询/连接/聚合…），就直接用官方分组 —— 那本身就是权威的知识点划分；
 * 没有分组的题单和标签大类，则按我们自己的主标签分组，按先修顺序排。
 */
function groupByTag(store: Store, pool: readonly Problem[], topic: Topic): [string, Problem[]][] {
  if (topic.kind === "list" && topic.groups.length) {
    const inside = new Map(pool.map((p) => [p.slug, p]));
    const used = new Set<string>();
    const out: [string, Problem[]][] = [];
    for (const g of topic.groups) {
      const members: Problem[] = [];
      for (const s of g.slugs) {
        const p = inside.get(s);
        if (p && !used.has(s)) members.push(p);
      }
      for (const p of members) used.add(p.slug);
      if (members.length) out.push([`official:${g.name}`, members]);
    }
    const leftover: Problem[] = [];
    for (const [slug, p] of inside) if (!used.has(slug)) leftover.push(p);
    if (leftover.length) out.push(...groupByMainTag(store, leftover));
    return out;
  }
  return groupByMainTag(store, pool, topic);
}

function groupByMainTag(store: Store, pool: readonly Problem[], topic?: Topic): [string, Problem[]][] {
  const order = new Map<string, number>();
  store.cats.forEach((cat, ci) => {
    cat.subs.forEach((sub, si) => order.set(sub.id, ci * 100 + si));
  });

  const groups = new Map<string, Problem[]>();
  for (const p of pool) {
    let tag = p.mainTag;
    if (topic && topic.kind === "cat") {
      // 大类计划里，用属于该大类的标签分组
      const own = p.tags.filter((t) => t.cat === topic.id).map((t) => t.id);
      if (own.length) tag = own[0]!;
    }
    const bucket = groups.get(tag) ?? [];
    bucket.push(p);
    groups.set(tag, bucket);
  }
  return sortBy([...groups.entries()], ([tag]) => [order.get(tag) ?? 9999]);
}

// --- 跨专题推荐 ----------------------------------------------------------------

/** 按「高频题里还没刷的数量」找最该补的子标签。 */
export function weakTopics(store: Store, limit = 8): [string, number, number][] {
  const rows = new Map<string, [number, number]>();
  for (const p of store.problems) {
    if (!p.freq || p.paid) continue;
    const done = store.isDone(p);
    for (const tag of p.tagIds) {
      const cur = rows.get(tag) ?? [0, 0];
      cur[0] += 1;
      if (done) cur[1] += 1;
      rows.set(tag, cur);
    }
  }
  const out: [string, number, number][] = [];
  for (const [tag, [hot, done]] of rows) if (hot >= 5) out.push([tag, hot, done]);
  return sortBy(out, ([, hot, done]) => [-(hot - done)]).slice(0, limit);
}

/** 下一步该做什么：从最薄弱的几个专题里各取一道未刷的代表题。 */
export function nextSteps(store: Store, count = 3): [string, Step][] {
  const picked: [string, Step][] = [];
  for (const [tag] of weakTopics(store, count * 3)) {
    const topic = store.topics().get(tag);
    if (!topic) continue;
    const plan = planTopic(store, topic, { mode: "minimal" });
    const todo = plan.steps.filter((s) => !store.isDone(s.p));
    if (todo.length) picked.push([store.subById.get(tag)!.name, todo[0]]);
    if (picked.length >= count) break;
  }
  return picked;
}
