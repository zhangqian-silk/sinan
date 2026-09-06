/**
 * 人工判定的待办清单：把还没评的力扣题按「影响面」排好序打出来，方便一批批往下推。
 * 排序规则见 review-order.ts，和 review-dump 共用同一套，两边取到的批次才对得上。
 *
 * 跑法：
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js            # 看统计
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js --limit 40 # 取下一批
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-todo.js --tag dp-tree
 */

import { distDir } from "../build/io.js";
import { loadReviews } from "../build/reviews.js";
import { openStore } from "../host-node.js";
import { buildTodo } from "./review-order.js";
import type { Problem } from "../types.js";

function main(): void {
  const argv = process.argv.slice(2);
  const flag = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? "") : "";
  };
  const limit = parseInt(flag("--limit") || "0", 10) || 0;
  const tag = flag("--tag");

  const store = openStore({ dataDir: distDir(), progressFile: "/dev/null" });
  const done = loadReviews();

  const { pool, todo, total, inPlan } = buildTodo(store, done, tag);
  const listCount = (p: Problem): number => store.listNamesOf(p).length;
  const reviewed = pool.filter((p) => done.has(p.slug)).length;
  process.stdout.write(
    `力扣 ${String(total)} 题 · 有题面 ${String(pool.length)} · 已评 ${String(reviewed)} · 待评 ${String(todo.length)}\n`,
  );
  if (!limit) {
    const planLeft = todo.filter((p) => inPlan.has(p.slug)).length;
    process.stdout.write(`其中在学习计划里的还有 ${String(planLeft)} 道\n`);
    return;
  }
  for (const p of todo.slice(0, limit)) {
    const marks = [
      inPlan.has(p.slug) ? `计划×${String(inPlan.get(p.slug))}` : "",
      p.freq ? `频次${String(p.freq)}` : "",
      listCount(p) ? `题单${String(listCount(p))}` : "",
    ].filter(Boolean).join(" ");
    process.stdout.write(`${p.slug}\t#${p.id}\t${p.title}\t${p.difficultyCn}\t${marks}\n`);
  }
}

main();
