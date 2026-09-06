/**
 * 人工判定的取数工具：把一批题的题面压成纯文本打出来，连同脚本现在给的标签，
 * 方便逐题读完再写 `reviews/problems.jsonl`。
 *
 * 跑法：
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js 1 42 200
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --route starter
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-dump.js --topic monotonic --limit 10
 *
 * 只在本地读，不产出任何题面到仓库里 —— 写进仓库的只有我们自己写的判定。
 */

import { join } from "node:path";

import { distDir, rawDir, readJsonl } from "../build/io.js";
import * as planner from "../planner.js";
import { htmlToText } from "../render.js";
import { Store } from "../store.js";
import { loadReviews } from "../build/reviews.js";

interface Detail { _key: string; content?: string }

function main(): void {
  const argv = process.argv.slice(2);
  // 跟着 SINAN_DATA_ROOT 走，否则会悄悄读到随包基线（没有频次，主线排不出来）
  const store = new Store({ dataDir: distDir(), progressFile: "/dev/null" });
  const done = loadReviews();
  const keys: string[] = [];

  const flag = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? "") : "";
  };
  const limit = parseInt(flag("--limit") || "0", 10) || 0;
  const route = flag("--route");
  const topic = flag("--topic");

  if (route) {
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

    const text = htmlToText(details.get(p.slug) ?? "", 96);
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
