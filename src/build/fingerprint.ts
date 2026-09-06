/**
 * 解法思路指纹：把三条证据通道合成「这题到底怎么做」。
 *
 * 四条**互相独立**的证据通道，可信度依次递减：
 *
 * 1. `code`      —— 题解代码里真的这么写了（正则 + 缩进结构判断）。看得见的最硬。
 * 2. `statement` —— 自己读题面推出来的：问法 + 数据范围 + 输入结构。
 *                   这条不依赖任何人的题解，所以能覆盖没人写题解的题，
 *                   也能发现「高赞题解只贴了最优解、但这题其实还能这么做」。
 * 3. `solutions` —— 题解标题/标签这么说。说得出不一定做得到，也可能只是顺口提一句。
 * 4. `tags`      —— 只剩官方标签的兜底。官方标签讲「涉及什么」，不讲「怎么解」。
 *
 * 独立通道的价值在**交叉印证**：一个思路被两条以上通道同时指出，可信度显著提高；
 * 只被一条指出就保持谨慎。另外，**有代码可看时，某思路在代码里没出现本身就是反证**，
 * 所以纯文字证据要打折 —— 但如果题面推理也支持它，就不打折，因为那说明这是
 * 「可行但没人贴」的解法，正是多标签想收进来的东西。
 */

import { py } from "./pyre.js";
import {
  APPROACHES, KEEP_CONF, MAX_LABELS, TAG_FALLBACK, type ApproachDef,
} from "./rules/approach.data.js";
import type { ApproachRef } from "../types.js";
import { pyRoundTo } from "../util.js";

export { APPROACHES, TAG_FALLBACK };
export type { ApproachDef };

export const BY_ID = new Map<string, ApproachDef>(APPROACHES.map((a) => [a.id, a]));
const COMPILED = APPROACHES.map((a) => [a, py(a.pattern, "i")] as const);

export interface Article {
  /** 标题 */
  t?: string;
  /** 题解自带的算法标签 */
  g?: string[];
  /** 点赞数 */
  v?: number;
}

/** 提取思路指纹。 */
export function fingerprint(
  articles: readonly Article[],
  tagIds: readonly string[],
  codeEvidence: Record<string, number> = {},
  stmtEvidence: Record<string, number> = {},
): ApproachRef[] {
  const scored = new Map<string, { score: number; hits: number }>();
  let total = 0;

  for (const art of articles) {
    const text = `${art.t ?? ""} ${(art.g ?? []).join(" ")}`;
    if (!text.trim()) continue;
    const w = Math.log1p(Math.max(art.v ?? 0, 0)) + 0.5;
    total += w;
    for (const [ap, rx] of COMPILED) {
      if (rx.test(text)) {
        const cur = scored.get(ap.id) ?? { score: 0, hits: 0 };
        cur.score += w;
        cur.hits += 1;
        scored.set(ap.id, cur);
      }
    }
  }

  const textConf = new Map<string, number>();
  if (total > 0) {
    for (const [aid, v] of scored) textConf.set(aid, Math.min(v.score / total, 1));
  }

  // 三条通道各自换算成可信度。代码是观察到的，题面是推理出来的，推理略低一档。
  const channels: [string, Map<string, number>][] = [
    ["code", new Map(Object.entries(codeEvidence)
      .filter(([aid]) => BY_ID.has(aid))
      .map(([aid, s]) => [aid, Math.min(0.35 + 0.65 * s, 1)]))],
    ["statement", new Map(Object.entries(stmtEvidence)
      .filter(([aid]) => BY_ID.has(aid))
      .map(([aid, s]) => [aid, Math.min(0.25 + 0.6 * s, 1)]))],
    ["solutions", textConf],
  ];

  const every = new Set<string>();
  for (const [, ch] of channels) for (const aid of ch.keys()) every.add(aid);

  const out: ApproachRef[] = [];
  for (const aid of every) {
    const ap = BY_ID.get(aid);
    if (!ap) continue;
    const backers = channels.filter(([, ch]) => ch.has(aid)).map(([name]) => name);
    let conf = Math.max(...backers.map((name) => channels.find(([n]) => n === name)![1].get(aid)!));
    // 多条独立通道同时指向它 => 加成
    conf = Math.min(conf + 0.12 * (backers.length - 1), 1);
    if (backers.length === 1 && backers[0] === "solutions") {
      const v = scored.get(aid)!;
      if (conf < KEEP_CONF && v.hits < 2) continue;
      if (Object.keys(codeEvidence).length) {
        // 代码摆在那儿却没这么写，而且只有一篇题解顺口提过 => 噪声，直接丢。
        // （典型例子：某篇题解标题里写「找分割点」，就被当成了图论的「割点」。）
        if (v.hits < 2) continue;
        conf *= 0.7;               // 有人这么说但代码里看不到，压一档
      }
    }
    out.push({
      id: aid, name: ap.name, domain: ap.domain,
      conf: pyRoundTo(conf, 3), w: ap.weight,
      hits: scored.get(aid)?.hits ?? 0,
      from: backers.join("+"),
    });
  }

  if (out.length) {
    // 同样的 conf×w，看得见的代码排在推理前面，推理排在道听途说前面
    const rank = (x: ApproachRef): number => {
      const bonus = 1 + 0.15 * (x.from.includes("code") ? 1 : 0)
        + 0.07 * (x.from.includes("statement") ? 1 : 0);
      return -x.conf * x.w * bonus;
    };
    out.sort((a, b) => (rank(a) - rank(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out.slice(0, MAX_LABELS);
  }

  // 没有题解可用，退回标签映射，标记来源以便区分可信度
  const seen = new Map<string, ApproachRef>();
  for (const tid of tagIds) {
    for (const aid of TAG_FALLBACK[tid] ?? []) {
      const ap = BY_ID.get(aid);
      if (ap && !seen.has(aid)) {
        seen.set(aid, {
          id: aid, name: ap.name, domain: ap.domain,
          conf: 0.3, w: ap.weight, hits: 0, from: "tags",
        });
      }
    }
  }
  return [...seen.values()].slice(0, MAX_LABELS);
}

/** 把指纹变成可以算余弦的向量。 */
export function vector(fp: readonly ApproachRef[], idf: Map<string, number>): Map<string, number> {
  const raw = new Map<string, number>();
  for (const a of fp) raw.set(a.id, a.conf * a.w * (idf.get(a.id) ?? 1));
  let sum = 0;
  for (const v of raw.values()) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  const out = new Map<string, number>();
  for (const [k, v] of raw) out.set(k, v / norm);
  return out;
}

/** 指纹整体有多「认得出」：全是递归/模拟这类泛化说法就接近 0。 */
export function specificity(fp: readonly ApproachRef[]): number {
  if (!fp.length) return 0;
  const top = Math.max(...fp.map((a) => a.w));
  return Math.min(1, Math.max(0, (top - 0.8) / 1.7));
}
