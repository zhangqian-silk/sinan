/**
 * 思路指纹的读取侧：只保留「两道题的思路有多少是真正共通的」这一个计算。
 *
 * 提取指纹（读题解代码、读题面、读题解措辞）是构建期的事，留在 scripts/approach.py。
 * 这里只用产物里已经带上的 `{id, name, domain, conf, w}`。
 */

import type { ApproachRef } from "./types.js";

/**
 * 加权 Jaccard × 共有思路的区分度。
 *
 * 区分度折扣是关键：两道题「都用了递归」「都是公式推导」并不说明它们可以互相替代，
 * 而「都用埃氏筛」「都是区间 DP」就说明。所以只有共有的思路本身足够具体，
 * 重合度才算得高 —— 这也是不同定理的数学题相似度天然很低的原因。
 */
export function overlap(fpA: readonly ApproachRef[], fpB: readonly ApproachRef[]): number {
  if (!fpA.length || !fpB.length) return 0;
  const wa = new Map<string, number>();
  const wb = new Map<string, number>();
  for (const a of fpA) wa.set(a.id, a.w);
  for (const b of fpB) wb.set(b.id, b.w);

  const shared: string[] = [];
  for (const id of wa.keys()) if (wb.has(id)) shared.push(id);
  if (!shared.length) return 0;

  const keys = new Set([...wa.keys(), ...wb.keys()]);
  let inter = 0;
  let union = 0;
  for (const k of keys) {
    const x = wa.get(k) ?? 0;
    const y = wb.get(k) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  }
  if (!union) return 0;

  let sum = 0;
  for (const k of shared) sum += Math.max(wa.get(k)!, wb.get(k)!);
  const meanW = sum / shared.length;
  const spec = Math.min(1, Math.max(0.15, (meanW - 0.8) / 1.7));
  return (inter / union) * spec;
}
