/**
 * 人工判定层。
 *
 * 脚本打标的上限很明显：它只能顺着题解里出现过的词和题面里的问法去猜，猜不出
 * 「这题其实有个更简单的做法」。所以在脚本之上留一层人工判定 —— 逐题分析，
 * 把每种解法的核心思想落到这道题上写清楚，标签就是这些解法的集合。
 *
 * 一条记录里每个解法配一个标签：常见解法都要列，不是只留最简的那个。
 * 格式是一行一条的 JSONL，方便一批一批地补，也方便 code review 逐条看 diff。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProblemReview } from "../types.js";

/**
 * 随仓库走，不在数据目录里 —— 这是我们自己写的内容，属于代码的一部分。
 * 目录下每个 .jsonl 是一批，按批分文件，补新的一批就是加一个文件，diff 干净。
 */
export const REVIEW_DIR = join(
  dirname(fileURLToPath(import.meta.url)), "..", "..", "reviews");

export interface Review extends ProblemReview {
  slug: string;
  id: string;
}

/** 标签就是解法列表里的那些，顺序即推荐顺序。 */
export function tagsOf(review: Review): string[] {
  const out: string[] = [];
  for (const s of review.solutions) for (const t of s.tags) if (!out.includes(t)) out.push(t);
  return out;
}

/** 读全部人工判定，按 slug 索引。同一道题在任何一批里出现两次都要报错。 */
export function loadReviews(dir = REVIEW_DIR): Map<string, Review> {
  const out = new Map<string, Review>();
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  for (const file of files) {
    const lines = readFileSync(join(dir, file), "utf-8").split("\n");
    lines.forEach((line, i) => {
      const where = `reviews/${file} 第 ${i + 1} 行`;
      const text = line.trim();
      if (!text || text.startsWith("//")) return;
      let row: Review;
      try {
        row = JSON.parse(text) as Review;
      } catch {
        throw new Error(`${where}不是合法 JSON`);
      }
      if (!row.slug || !row.solutions?.length) {
        throw new Error(`${where}缺 slug 或 solutions`);
      }
      for (const sol of row.solutions) {
        if (!sol.tags?.length || !sol.name || !sol.idea) {
          throw new Error(`${where}有解法缺 tags / name / idea`);
        }
      }
      if (out.has(row.slug)) throw new Error(`人工判定重复：${row.slug}（${where}）`);
      out.set(row.slug, row);
    });
  }
  return out;
}
