/** 抓取 CodeTop 的大厂面试高频榜（约 1155 题，按被面到的次数排序）。 */

import { join } from "node:path";

import { asText, dumpJson, rawDir } from "../io.js";
import { httpJson, sleep } from "../http.js";

const API = "https://codetop.cc/api/questions/";
const REFERER = "https://codetop.cc/home";

interface Row { slug: string; id: string; title: string; freq: number; level?: unknown; rank?: number }

export async function run(): Promise<void> {
  const rows: Row[] = [];
  const seen = new Set<string>();
  let page = 1;
  let total: number | null = null;

  while (total === null || rows.length < total) {
    const data = await httpJson<{
      count: number;
      list?: { value?: number; leetcode?: { slug_title?: string; frontend_question_id?: unknown; title?: string; level?: unknown } }[];
    }>(`${API}?page=${page}&pageSize=100`, { headers: { Referer: REFERER } });
    total = data.count;
    const batch = data.list ?? [];
    if (!batch.length) break;
    for (const item of batch) {
      const lc = item.leetcode ?? {};
      const slug = lc.slug_title;
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      rows.push({
        slug,
        id: asText(lc.frontend_question_id),
        title: lc.title ?? "",
        freq: item.value ?? 0,
        level: lc.level,
      });
    }
    process.stdout.write(`[codetop] ${rows.length}/${total}\n`);
    page += 1;
    await sleep(150);
  }

  rows.sort((a, b) => b.freq - a.freq);
  rows.forEach((row, i) => { row.rank = i + 1; });
  const now = new Date();
  const pad = (v: number): string => String(v).padStart(2, "0");
  dumpJson(join(rawDir(), "codetop.json"), {
    total,
    fetched_at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    items: rows,
  });
}
