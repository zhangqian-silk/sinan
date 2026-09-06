/**
 * 人工判定层。
 *
 * 脚本打标的上限很明显：它只能顺着题解里出现过的词和题面里的问法去猜，猜不出
 * 「这题其实有个更简单的做法」。所以在脚本之上留一层人工判定 —— 逐题读题面，
 * 自己想一遍最简可行解，再决定标签。有人工记录的题以人工为准，没有的仍走脚本。
 *
 * 记录里的解法思路是我们自己写的，不是抄来的题解，所以可以随包分发。
 * 格式是一行一条的 JSONL，方便一批一批地补，也方便 code review 逐条看 diff。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProblemReview } from "../types.js";

/** 随仓库走，不在数据目录里 —— 这是我们自己写的内容，属于代码的一部分。 */
export const REVIEW_FILE = join(
  dirname(fileURLToPath(import.meta.url)), "..", "..", "reviews", "problems.jsonl");

export interface Review extends ProblemReview {
  slug: string;
  id: string;
  /** 我判定的标签，树上任意一层的节点 id */
  tags: string[];
}

/** 读全部人工判定，按 slug 索引。文件不在或某行坏了都不该让构建挂掉。 */
export function loadReviews(file = REVIEW_FILE): Map<string, Review> {
  const out = new Map<string, Review>();
  if (!existsSync(file)) return out;
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    const text = line.trim();
    if (!text || text.startsWith("//")) return;
    let row: Review;
    try {
      row = JSON.parse(text) as Review;
    } catch {
      throw new Error(`reviews/problems.jsonl 第 ${i + 1} 行不是合法 JSON`);
    }
    if (!row.slug || !row.tags?.length || !row.idea) {
      throw new Error(`reviews/problems.jsonl 第 ${i + 1} 行缺 slug / tags / idea`);
    }
    if (out.has(row.slug)) throw new Error(`人工判定重复：${row.slug}`);
    out.set(row.slug, row);
  });
  return out;
}
