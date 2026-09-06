/**
 * 读题解代码判「这题到底怎么做」。
 *
 * 题解标题会说谎（「一行搞定」「秒杀」），代码不会。所以解法判定的第一手证据是
 * 社区题解里贴的代码：词级探针认具体写法，组合探针要求触发词和配套写法在相邻
 * 几行内同时出现，再按缩进还原函数体来判遍历次序和递归结构。
 *
 * 原 Python 版用 `ast` 做过四件事，这里改成缩进分析，理由是那四件事本来就没在用
 * 结构信息 —— 其中两件是 `ast.dump()` 之后做子串搜索，另外两件（装饰器、自递归）
 * 用现成的 DEF_RE + 函数体范围就能等价判定。而且 AST 只对 python 代码块生效，
 * 26666 段代码里 java 才是最多的（10520 段）。
 */

import { py } from "./pyre.js";
import {
  CASES, CODE_TO_TAG, NEAR_PROBES, RAW, TOKEN_PROBES,
} from "./rules/codeprint.data.js";

export { CASES, CODE_TO_TAG };

const TREE_HINT = py(RAW.TREE_HINT);
const GRAPHY_HINT = py(RAW.GRAPHY_HINT);
const VISIT_RE = py(RAW.VISIT_RE);
const DEF_RE = py(RAW.DEF_RE);
const COMBINE_RE = py(RAW.COMBINE_RE);
const BITSTATE_RE = py(RAW.BITSTATE_RE);
const REVERSE_LOOP = py(RAW.REVERSE_LOOP);

const TOKEN_COMPILED = TOKEN_PROBES.map(([aid, rx]) => [aid, py(rx, "m")] as const);
const NEAR_COMPILED = NEAR_PROBES.map(
  ([aid, a, b, win]) => [aid, py(a, "m"), py(b, "m"), win] as const);

/** 相当于 Python 的 `re.escape`。 */
function reEscape(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|/\-]/g, "\\$&");
}

function indentOf(line: string): number {
  return line.length - line.replace(/^\s+/, "").length;
}

/**
 * 函数体从 def 的下一行开始，到缩进退回 def 层级为止。
 *
 * 这一步不能省：`def dfs(...)` 外面通常还有一句 `dfs(root)` driver 调用，
 * 如果把它也当成递归，「最后一次递归」的位置就会算错，后序就判不出来了。
 */
function bodyRange(lines: string[], start: number): { start: number; stop: number } {
  const base = indentOf(lines[start]!);
  for (let i = start + 1; i < lines.length; i += 1) {
    const ln = lines[i]!;
    if (ln.trim() && indentOf(ln) <= base) return { start: start + 1, stop: i };
  }
  return { start: start + 1, stop: lines.length };
}

function countMatches(rx: RegExp, text: string): number {
  const g = new RegExp(rx.source, `${rx.flags.replace("g", "")}g`);
  let n = 0;
  while (g.exec(text) !== null) n += 1;
  return n;
}

/** 找出所有函数定义：[函数名, 行号]。 */
function findDefs(lines: string[]): [string, number][] {
  const out: [string, number][] = [];
  lines.forEach((ln, i) => {
    const m = DEF_RE.exec(ln);
    if (m && (m[1] || m[2])) out.push([(m[1] || m[2])!, i]);
  });
  return out;
}

/**
 * 看「处理当前节点」发生在两次子树递归之前 / 之间 / 之后，判前序 / 中序 / 后序。
 *
 * 后序有两种长相，都要认：
 *   1. 显式访问：`dfs(l); dfs(r); res.append(node.val)`
 *   2. 自底向上：`l = dfs(node.left); r = dfs(node.right); return max(l, r) + 1`
 *      —— 这种没有 append，但「先拿到子树答案再合并」正是后序，树形 DP 全是这个形状。
 *
 * 一篇题解里可能同时贴了三种顺序（「三种遍历一次讲清」），所以每个递归函数都判一遍、
 * 全部返回，最后靠多篇题解投票定主次。
 */
export function traversalOrders(code: string): Set<string> {
  const out = new Set<string>();
  if (!TREE_HINT.test(code)) return out;       // 网格/图上的 dfs 不算树遍历
  const lines = code.split("\n");
  for (const [name, at] of findDefs(lines)) {
    const escaped = reEscape(name);
    const rx = py(RAW.SELF_CALL_TPL.replace("%s", escaped));
    const body = bodyRange(lines, at);
    const calls: number[] = [];
    for (let i = body.start; i < body.stop; i += 1) {
      if (rx.test(lines[i]!) && !DEF_RE.test(lines[i]!)) calls.push(i);
    }
    if (!calls.length) continue;
    // 一行里递归两次（`return max(dfs(l), dfs(r)) + 1`）本身就是合并子树答案
    for (const i of calls) {
      if (countMatches(rx, lines[i]!) >= 2 && COMBINE_RE.test(lines[i]!)) out.add("tree-postorder");
    }
    if (calls.length < 2) continue;
    const lo = Math.min(...calls);
    const hi = Math.max(...calls);
    const spanStart = Math.max(body.start, lo - 6);
    const spanStop = Math.min(body.stop, hi + 7);
    const visits: number[] = [];
    for (let i = spanStart; i < spanStop; i += 1) {
      if (VISIT_RE.test(lines[i]!)) visits.push(i);
    }
    if (visits.some((v) => v < lo)) out.add("tree-preorder");
    if (visits.some((v) => v > lo && v < hi)) out.add("tree-inorder");
    if (visits.some((v) => v > hi)) out.add("tree-postorder");
    // 自底向上：子树结果先存进变量，递归结束后再合并
    const assign = py(RAW.ASSIGN_FROM_CALL.replace("%s", escaped));
    const holders = new Set<string>();
    for (let i = lo; i <= hi; i += 1) {
      const m = assign.exec(lines[i] ?? "");
      if (m?.[1]) holders.add(m[1]);
    }
    if (holders.size) {
      for (let i = hi + 1; i < Math.min(body.stop, hi + 7); i += 1) {
        const ln = lines[i]!;
        const touched = [...holders].some((h) => py(`\\b${reEscape(h)}\\b`).test(ln));
        if (touched && COMBINE_RE.test(ln)) { out.add("tree-postorder"); break; }
      }
    }
  }
  return out;
}

/** 组合探针：触发词出现后，紧邻若干行内必须出现配套写法。 */
function nearHits(code: string): Set<string> {
  const lines = code.split("\n");
  const out = new Set<string>();
  for (const [aid, trigger, need, win] of NEAR_COMPILED) {
    for (let i = 0; i < lines.length; i += 1) {
      if (!trigger.test(lines[i]!)) continue;
      if (need.test(lines.slice(i, i + win + 1).join("\n"))) { out.add(aid); break; }
    }
  }
  return out;
}

/**
 * dp[i] 是一维、dp[i][j] 是二维。
 *
 * 一篇题解常常先写二维再压成滚动数组，两种形状会同时出现，所以两条都判、都返回，
 * 不做二选一 ——「先二维推状态、再压维」本身就是该题要考的东西。
 */
export function dpShape(code: string): string[] {
  const out: string[] = [];
  if (py("\\b(dp|f|g|memo)\\s*\\[[^\\]]+\\]\\s*\\[[^\\]]+\\]").test(code)) out.push("dp-2d");
  if (py("\\b(dp|f|g)\\s*\\[[^\\]]+\\]\\s*=[^=]").test(code)
    || (py("\\bdp\\s*=\\s*\\[?\\s*(0|1|inf|float)").test(code) && code.includes("for"))) {
    out.push("dp-1d");
  }
  return out;
}

// --- 原来交给 AST 的四条判断，改用缩进分析 ------------------------------------

const MEMO_DECORATOR = py("^\\s*@\\s*(?:functools\\s*\\.\\s*)?(?:cache|lru_cache)\\b", "m");
const POPLEFT = py("\\bpopleft\\s*\\(|\\bpoll\\s*\\(\\s*\\)|\\bdequeue\\s*\\(");
const POP = py("\\bpop\\s*\\(");
const WHILE_HEAD = py("^\\s*while\\b");

/**
 * Python 代码的结构信号。
 *
 * 原版用 `ast` 做这四件事，但其中两件（while 里有没有 popleft / pop）本来就是
 * `ast.dump()` 之后做子串搜索，压根没用到结构；剩下两件用函数体范围就能判。
 * 换成缩进分析之后，顺带对 java/cpp 之外的缩进型代码也能用。
 */
function pythonStructureSignals(code: string): Set<string> {
  const out = new Set<string>();
  const lines = code.split("\n");
  const treeish = TREE_HINT.test(code);
  const graphy = GRAPHY_HINT.test(code);

  if (MEMO_DECORATOR.test(code)) out.add("dp-memo");

  // 函数体里调用自己 => 递归。但只有在代码确实在处理树时才记成树递归
  if (treeish) {
    for (const [name, at] of findDefs(lines)) {
      const rx = py(RAW.SELF_CALL_TPL.replace("%s", reEscape(name)));
      const body = bodyRange(lines, at);
      for (let i = body.start; i < body.stop; i += 1) {
        if (rx.test(lines[i]!) && !DEF_RE.test(lines[i]!)) { out.add("tree-recursion"); break; }
      }
      if (out.has("tree-recursion")) break;
    }
  }

  // while 循环体里在弹队列 / 弹栈
  for (let i = 0; i < lines.length; i += 1) {
    if (!WHILE_HEAD.test(lines[i]!)) continue;
    const body = bodyRange(lines, i);
    const src = lines.slice(i, body.stop).join("\n");
    if (POPLEFT.test(src)) out.add(graphy ? "graph-bfs" : "tree-levelorder");
    else if (graphy && POP.test(src)) out.add("graph-dfs");
  }
  return out;
}

export interface CodeBlock {
  code?: string;
  lang?: string;
  t?: string;
}

/**
 * 返回 {思路 id: 证据强度}。强度 = 有多少**篇**题解的代码支持它（归一化）。
 *
 * 按篇而不是按代码块投票：一篇题解常把「记忆化 / 二维 / 压成一维」全贴出来，
 * 那是同一个人的同一套思路，算一票；两个不同作者都这么写才说明这是公认解法。
 */
export function analyzeBlocks(blocks: readonly CodeBlock[]): Record<string, number> {
  if (!blocks.length) return {};
  const perArticle = new Map<string, Set<string>>();

  blocks.forEach((b, idx) => {
    const code = b.code ?? "";
    if (!code) return;
    const seen = new Set<string>();
    for (const [aid, rx] of TOKEN_COMPILED) if (rx.test(code)) seen.add(aid);
    for (const aid of nearHits(code)) seen.add(aid);
    const orders = traversalOrders(code);
    for (const aid of orders) seen.add(aid);
    for (const aid of dpShape(code)) seen.add(aid);
    if (b.lang === "python") for (const aid of pythonStructureSignals(code)) seen.add(aid);

    const treeish = TREE_HINT.test(code);
    // 反转用的对撞循环：撤掉，别让工具代码冒充解法。
    // 这里不改标成「链表反转」—— 反的多半是数组的一段（下一个排列就是这样），
    // 硬标成链表反而错得更远。
    if (REVERSE_LOOP.test(code)) {
      seen.delete("sliding-window");
      seen.delete("two-pointers");
    }
    // 「先量一层再处理一层」出现在网格/图上，那是分层 BFS，不是二叉树层序
    if (seen.has("tree-levelorder") && !treeish) {
      seen.delete("tree-levelorder");
      seen.add("graph-bfs");
    }
    // 单调栈成立时，普通栈模拟这条就不必再报了
    if (seen.has("monotonic-stack")) seen.delete("stack-sim");
    // 树上用显式栈 = 迭代遍历，不是普通的栈模拟
    if (treeish && (seen.has("stack-sim") || seen.has("monotonic-stack"))) {
      seen.add("tree-iterative");
      seen.delete("stack-sim");
    }
    // 有遍历次序说明是树递归
    if (orders.size) seen.add("tree-recursion");
    // 树形 DP 的招牌：后序合并子树答案，而且一次返回多个状态（选 / 不选）
    if (seen.has("tree-postorder") && py("return\\s*[\\(\\[]?\\s*\\w+\\s*,\\s*\\w+").test(code)) {
      seen.add("dp-tree");
    }
    // 状压 DP = 状态是个二进制集合 + 真的在做 DP（记忆化或递推表），缺一不算
    const doingDp = seen.has("dp-memo") || seen.has("dp-1d") || seen.has("dp-2d");
    if (doingDp && BITSTATE_RE.test(code)) seen.add("dp-bitmask");

    const key = (b.t ?? "").trim() || `#${idx}`;
    const bucket = perArticle.get(key) ?? new Set<string>();
    for (const aid of seen) bucket.add(aid);
    perArticle.set(key, bucket);
  });

  if (!perArticle.size) return {};
  const hits = new Map<string, number>();
  for (const seen of perArticle.values()) {
    for (const aid of seen) hits.set(aid, (hits.get(aid) ?? 0) + 1);
  }
  const total = perArticle.size;
  const out: Record<string, number> = {};
  for (const [aid, n] of hits) out[aid] = Math.round(Math.min(n / total, 1) * 1000) / 1000;
  return out;
}

/**
 * 越具体的解法，作为标签越可信：KMP 出现在代码里几乎就等于这题考 KMP，
 * 「用了哈希表」则说明不了什么。
 */
function baseWeight(specificity: number): number {
  if (specificity >= 3.0) return 88;
  if (specificity >= 2.5) return 80;
  if (specificity >= 2.0) return 70;
  if (specificity >= 1.5) return 58;
  return 38;
}

export type Seed = [sub: string, weight: number, src: string];

/**
 * 把代码证据翻译成 tagProblem() 认识的 seeds。
 *
 * 权重 = 解法本身的具体程度 × 证据强度 × 通道折扣。
 * 题面推理走同一条路，只是折扣低一点（`scale`）—— 推出来的不如看见的硬。
 */
export function tagSeeds(
  evidence: Record<string, number>,
  weightOf: Record<string, number>,
  src = "题解代码",
  scale = 1.0,
): Seed[] {
  const seeds: Seed[] = [];
  for (const [aid, strength] of Object.entries(evidence)) {
    const sub = CODE_TO_TAG[aid];
    if (!sub) continue;
    const base = baseWeight(weightOf[aid] ?? 1.0);
    seeds.push([sub, pyRoundHalfEven(base * (0.6 + 0.4 * Math.min(strength, 1)) * scale), src]);
  }
  return seeds;
}

function pyRoundHalfEven(x: number): number {
  const fl = Math.floor(x);
  const diff = x - fl;
  if (diff > 0.5) return fl + 1;
  if (diff < 0.5) return fl;
  return fl % 2 === 0 ? fl : fl + 1;
}

/** 跑一遍验证用例，返回精度/召回统计。 */
export function validate(records: Map<string, { blocks?: CodeBlock[] }>): {
  recall: string; violations: string[]; misses: string[];
} {
  let total = 0;
  let hit = 0;
  const violations: string[] = [];
  const misses: string[] = [];
  for (const [slug, [want, forbid]] of Object.entries(CASES)) {
    const rec = records.get(slug);
    if (!rec?.blocks?.length) continue;
    const got = new Set(Object.keys(analyzeBlocks(rec.blocks)));
    for (const aid of forbid) if (got.has(aid)) violations.push(`${slug}: 误判 ${aid}`);
    total += want.length;
    for (const aid of want) {
      if (got.has(aid)) hit += 1;
      else misses.push(`${slug}: 漏判 ${aid}（认出 ${[...got].sort().slice(0, 6).join(", ")}）`);
    }
  }
  return { recall: `${hit}/${total}`, violations, misses };
}
