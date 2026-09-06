/**
 * 自己读题面判解法。
 *
 * 这是三条证据通道里唯一不依赖别人题解的一条 —— 它只看题目本身：问的是什么、
 * 输入长什么样、数据范围给到多少。所以它能覆盖没人写题解的题，也能发现
 * 「可行但没人贴」的解法。
 *
 * 三层判断：
 * 1. **问法**：「最大值最小」→ 二分答案，「返回所有…组合」→ 回溯。
 * 2. **守卫**：问法像不算数，题面里得真有这个东西 —— 「最小路径和」有「路径和」
 *    但没有树，不能判成二叉树后序。
 * 3. **数据范围**：n ≤ 22 就是让你指数级枚举，n 到 1e5 就把二维 DP、状压、Floyd
 *    全部否掉。范围解析错一处就全线错，所以宁缺勿错。
 */

import { py, pyGlobal } from "./pyre.js";
import {
  BUDGET_RULES, CASES, GUARDS, PHRASE_PROBES, RAW, STRUCT_PROBES,
} from "./rules/statement.data.js";
import { pyRoundTo, unescapeHtml } from "../util.js";

export { CASES };

const SUP = pyGlobal(RAW.SUP);
const SUB = pyGlobal(RAW.SUB);
const TAG = pyGlobal(RAW.TAG);
const SIZE_VAR = py(RAW.SIZE_VAR, "i");
const VALUE_VAR = py(RAW.VALUE_VAR, "i");
const SET_DECISION = py(RAW.SET_DECISION);
const RETURN_ALL = py(RAW.RETURN_ALL);

const PHRASE_COMPILED = PHRASE_PROBES.map(([aid, rx, s, why]) => [aid, py(rx), s, why] as const);
const STRUCT_COMPILED = STRUCT_PROBES.map(([aid, rx, s, why]) => [aid, py(rx), s, why] as const);
const GUARD_COMPILED = new Map(Object.entries(GUARDS).map(([aid, rx]) => [aid, py(rx)]));

/** 题面 HTML -> 纯文本。指数要保住：10<sup>5</sup> 得变成 10^5，不能变成 "10 5"。 */
export function toText(content: string): string {
  let s = content || "";
  s = s.replace(new RegExp(SUP.source, SUP.flags), "^$1");
  s = s.replace(new RegExp(SUB.source, SUB.flags), "_$1");
  s = s.replace(new RegExp(TAG.source, TAG.flags), " ");
  s = unescapeHtml(s);
  return s.replace(/[ \t\u00a0]+/g, " ");
}

/** 切成「题干（含示例）」和「提示（数据范围）」两段，两段的读法不一样。 */
export function splitSections(text: string): [string, string] {
  for (const marker of ["提示：", "提示:", "Constraints:"]) {
    const i = text.indexOf(marker);
    if (i > 0) return [text.slice(0, i), text.slice(i)];
  }
  return [text, ""];
}

/** 把 '10^5'、'2^31 - 1'、'1000' 换成整数；换不了返回 null。 */
export function toNumber(tok: string): number | null {
  const t = (tok || "").trim().replace(/ /g, "");
  if (!t) return null;
  let m = /^(\d+)\*(\d+)\^(\d+)$/.exec(t);              // 5 * 10^4
  if (m) return Number(m[1]) * Number(m[2]) ** Number(m[3]);
  m = /^(\d+)\^(\d+)(?:([-+])(\d+))?$/.exec(t);
  if (m) {
    let v = Number(m[1]) ** Number(m[2]);
    if (m[3] === "-") v -= Number(m[4]);
    else if (m[3] === "+") v += Number(m[4]);
    return v;
  }
  return /^\d+$/.test(t) ? Number(t) : null;
}

export interface Limits {
  /** 输入规模上界 */
  size: number | null;
  /** 元素值上界 */
  value: number | null;
  raw: string[];
}

/** 规模换算成「能跑什么复杂度」。 */
export function budgetOf(size: number | null): string {
  if (size === null) return "unknown";
  if (size <= 22) return "exp";        // 2^n 可以，随便指数级
  if (size <= 45) return "half";       // 2^(n/2)，折半搜索
  if (size <= 120) return "cubic";     // O(n^3)：区间 DP、Floyd
  if (size <= 1200) return "quad";     // O(n^2)：二维 DP
  if (size <= 20000) return "quad-ish";
  return "linear";                     // 只剩 O(n) / O(n log n)
}

/**
 * 把提示区切成一条条比较链：['1', '<=', 'nums.length', '<=', '10^4']。
 *
 * 两个非运算符 token 挨在一起（"10^4" 后面又跟 "1"）就说明上一条链结束了。
 */
function chains(text: string): string[][] {
  const token = pyGlobal(RAW.TOKEN);
  const out: string[][] = [];
  let cur: string[] = [];
  let prevWasOp = true;
  let m: RegExpExecArray | null;
  while ((m = token.exec(text)) !== null) {
    const op = m[1];
    const word = m[2];
    if (op) {
      if (!cur.length) continue;       // 链不能以运算符开头
      cur.push(op);
      prevWasOp = true;
      continue;
    }
    if (!prevWasOp && cur.length) {    // 连着两个变量/数字 => 换链
      out.push(cur);
      cur = [];
    }
    cur.push((word ?? "").trim());
    prevWasOp = false;
  }
  if (cur.length) out.push(cur);
  return out.filter((c) => c.length >= 3);
}

/** 从提示区抽数据范围。只认「变量 <= 数」这种直接约束，读不出来就留空 —— 宁缺勿错。 */
export function parseLimits(hintText: string): Limits {
  const lim: Limits = { size: null, value: null, raw: [] };
  const sizes: number[] = [];
  const values: number[] = [];
  for (const chain of chains(hintText)) {
    // 只处理递增方向的链（a <= b <= c），> 号的链跳过，免得把下界当上界
    let descending = false;
    for (let k = 1; k < chain.length; k += 2) {
      if (chain[k] === ">" || chain[k] === ">=") { descending = true; break; }
    }
    if (descending) continue;
    const operands: string[] = [];
    for (let k = 0; k < chain.length; k += 2) operands.push(chain[k]!);
    operands.forEach((tok, i) => {
      if (toNumber(tok) !== null) return;
      let upper: number | null = null;
      for (let k = 2 * i + 2; k < chain.length; k += 2) {
        const v = toNumber(chain[k]!);
        if (v !== null) { upper = v; break; }
      }
      if (upper === null) return;
      if (SIZE_VAR.test(tok)) {
        sizes.push(upper);
        lim.raw.push(`${tok} <= ${upper}`);
      } else if (VALUE_VAR.test(tok)) {
        values.push(upper);
      }
    });
  }
  if (sizes.length) lim.size = Math.max(...sizes);
  if (values.length) lim.value = Math.max(...values);
  return lim;
}

export interface Reading {
  /** 强度 */
  s: number;
  /** 为什么这么判 */
  why: string[];
}

/** 读题面，返回 {思路 id: {s, why}}。 */
export function analyze(title: string, content: string): Record<string, Reading> {
  const text = toText(content);
  if (text.trim().length < 40) return {};
  const [body, hints] = splitSections(text);
  const lim = parseLimits(hints);
  const hay = `${title} ${body}`;

  const out: Record<string, Reading> = {};
  const add = (aid: string, s: number, why: string): void => {
    const guard = GUARD_COMPILED.get(aid);
    if (guard && !guard.test(hay)) return;   // 问法像，但题面里根本没有这个东西
    const cur = out[aid] ?? { s: 0, why: [] };
    cur.s = Math.max(cur.s, s);
    if (!cur.why.includes(why)) cur.why.push(why);
    out[aid] = cur;
  };

  for (const [aid, rx, s, why] of PHRASE_COMPILED) if (rx.test(hay)) add(aid, s, why);
  for (const [aid, rx, s, why] of STRUCT_COMPILED) if (rx.test(hay)) add(aid, s, why);

  // 数据范围：够得着的放大，跑不动的否掉
  const rule = BUDGET_RULES[budgetOf(lim.size)];
  if (rule) {
    const [boost, veto, tpl] = rule;
    const reason = tpl.replaceAll("{n}", String(lim.size));
    for (const aid of boost) {
      if (out[aid]) {
        out[aid]!.s = Math.min(out[aid]!.s + 0.2, 1.0);
        out[aid]!.why.push(reason);
      }
    }
    for (const aid of veto) {
      if (out[aid]) {
        out[aid]!.s *= 0.35;
        out[aid]!.why.push(`但 ${reason}`);
      }
    }
  }

  // 光看范围就足以立论的情况。门槛必须收紧：n 小不等于状压 ——
  // 一堆简单题的 n 也只有 10，那是因为题本身简单，不是让你压状态。
  // 真正的信号是「小 n + 要在一个集合上做划分 / 排列 / 全覆盖的决策」。
  const budget = budgetOf(lim.size);
  if ((budget === "exp" || budget === "half") && SET_DECISION.test(hay)) {
    if (!RETURN_ALL.test(hay)) {
      add("dp-bitmask", 0.55,
        `n <= ${lim.size}，而且要在一个集合上做划分 / 全覆盖的决策 —— 把集合压进状态最省事`);
    }
    add("backtracking", 0.5, `n <= ${lim.size}，爆搜加剪枝就够，不必想复杂`);
  }
  // 值域大、规模小，只作为「已经怀疑二分答案」时的加成，单独不足以立论
  if (lim.value !== null && lim.size !== null && lim.value >= 10 ** 6
    && lim.size <= 10 ** 5 && out["binary-search-answer"]) {
    const cur = out["binary-search-answer"]!;
    cur.s = Math.min(cur.s + 0.15, 1.0);
    cur.why.push(`值域到 ${lim.value} 但规模只有 ${lim.size} —— 在答案上二分比在数据上枚举便宜`);
  }

  const kept: Record<string, Reading> = {};
  for (const [aid, v] of Object.entries(out)) if (v.s >= 0.3) kept[aid] = v;
  return kept;
}

/** 只要强度，喂给指纹用。 */
export function evidence(title: string, content: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [aid, v] of Object.entries(analyze(title, content))) out[aid] = pyRoundTo(v.s, 3);
  return out;
}

/** 跑一遍验证用例。 */
export function validate(
  details: Map<string, { content?: string }>,
  titles: Map<string, string>,
): { recall: string; violations: string[]; misses: string[] } {
  let total = 0;
  let hit = 0;
  const violations: string[] = [];
  const misses: string[] = [];
  for (const [slug, [want, forbid]] of Object.entries(CASES)) {
    const det = details.get(slug);
    if (!det?.content) { misses.push(`${slug}: 没有题面`); continue; }
    const got = analyze(titles.get(slug) ?? "", det.content);
    total += want.length;
    for (const aid of forbid) if (got[aid]) violations.push(`${slug}: 误判 ${aid}`);
    for (const aid of want) {
      if (got[aid]) hit += 1;
      else misses.push(`${slug}: 漏判 ${aid}（读出 ${Object.keys(got).sort().slice(0, 7).join(", ")}）`);
    }
  }
  return { recall: `${hit}/${total}`, violations, misses };
}
