/**
 * 人工判定的取数工具：把一批题的题面压成纯文本打出来，连同脚本现在给的标签，
 * 方便逐题读完再写 `reviews/problems.jsonl`。
 *
 * 跑法：
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js 1 42 200
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --route starter
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --topic monotonic --limit 10
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --next 12 --brief
 *
 * --next 直接按 review-todo 的影响面顺序取下一批没评的，省掉手抄一遍 slug。
 * --brief 把中间的示例块折叠掉，只留题面描述和数据范围 —— 判定要的是「什么算法能过」，
 * 绝大多数题不需要逐个样例读。读完觉得题意含糊时，去掉 --brief 再看一遍完整的。
 *
 * 只在本地读，不产出任何题面到仓库里 —— 写进仓库的只有我们自己写的判定。
 */

import { join } from "node:path";

import { distDir, rawDir, readJsonl } from "../build/io.js";
import * as planner from "../planner.js";
import { htmlToText } from "../render.js";
import { openStore } from "../host-node.js";
import { loadReviews } from "../build/reviews.js";
import { buildTodo } from "./review-order.js";

interface Detail { _key: string; content?: string }

/** 示例块的起头，和其后「数据范围」段落的起头 —— 折叠掉中间那截。 */
const EXAMPLE_HEAD = /^\s*(\*{0,2}示例|示例\s*\d|Example)/;
const LIMIT_HEAD = /^\s*[*>·\-\s]*(提示|限制|约束|说明|注意|数据范围|进阶|Constraints)\s*[:：]?\s*\*{0,2}\s*$/;

/**
 * 折叠示例：保留第一个示例之前的题意，和数据范围往后的全部内容。
 * 找不到数据范围段落时原样返回 —— 宁可多读，也不要把约束条件弄丢。
 */
function brief(text: string): string {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => EXAMPLE_HEAD.test(l));
  if (from < 0) return text;
  let to = -1;
  for (let i = lines.length - 1; i > from; i -= 1) {
    if (LIMIT_HEAD.test(lines[i] ?? "")) { to = i; break; }
  }
  if (to < 0) return text;
  const cut = to - from;
  if (cut < 8) return text;
  return [...lines.slice(0, from), `（略去 ${String(cut)} 行示例）`, ...lines.slice(to)].join("\n");
}

function main(): void {
  const argv = process.argv.slice(2);
  // 跟着 SINAN_DATA_ROOT 走，否则会悄悄读到随包基线（没有频次，主线排不出来）
  const store = openStore({ dataDir: distDir(), progressFile: "/dev/null" });
  const done = loadReviews();
  const keys: string[] = [];

  const flag = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? "") : "";
  };
  const limit = parseInt(flag("--limit") || "0", 10) || 0;
  const next = parseInt(flag("--next") || "0", 10) || 0;
  const isBrief = argv.includes("--brief");
  const route = flag("--route");
  const topic = flag("--topic");

  if (next) {
    for (const p of buildTodo(store, done).todo.slice(0, next)) keys.push(p.slug);
  } else if (route) {
    const r = planner.ROUTE_BY_ID.get(route);
    if (!r) throw new Error(`没有这条主线：${route}`);
    for (const s of planner.planRoute(store, r).steps) keys.push(s.p.slug);
  } else if (topic) {
    const t = store.findTopic(topic);
    if (!t) throw new Error(`没有这个专题：${topic}`);
    for (const s of planner.planTopic(store, t, { mode: "minimal" }).steps) keys.push(s.p.slug);
  } else {
    for (const a of argv) if (!a.startsWith("--")) keys.push(a);
  }

  const details = new Map<string, string>();
  for (const row of readJsonl<Detail>(join(rawDir(), "leetcode_detail.jsonl"))) {
    details.set(row._key, row.content ?? "");
  }

  let shown = 0;
  const skipped: string[] = [];
  for (const key of keys) {
    const p = store.bySlug.get(key) ?? store.byId.get(key.toLowerCase());
    if (!p) { process.stdout.write(`?? 找不到 ${key}\n`); continue; }
    if (done.has(p.slug)) { skipped.push(`#${p.id}`); continue; }
    if (limit && shown >= limit) break;
    shown += 1;

    const full = htmlToText(details.get(p.slug) ?? "", 96);
    const text = isBrief ? brief(full) : full;
    process.stdout.write(`\n===== #${p.id} ${p.title}  [${p.difficultyCn}] ${p.slug}\n`);
    process.stdout.write(`脚本标签 ${p.tags.map((t) => `${t.name}(${t.w})`).join(" ")}\n`);
    process.stdout.write(`脚本思路 ${(p.approach ?? []).map((a) => a.name).join("、") || "—"}\n`);
    process.stdout.write(`${text || "（没有题面）"}\n`);
  }
  if (skipped.length) {
    process.stdout.write(`\n（已评过，跳过 ${skipped.length} 题：${skipped.join(" ")}）\n`);
  }
}

main();
