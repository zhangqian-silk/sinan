/**
 * 接入 LeetCode 以外的题源（洛谷、牛客、自建题单…）。
 *
 * 约定：往 `<数据根>/raw/` 里放 `extra_<源名>.json`，构建时会自动并进题库：
 *
 * ```json
 * {
 *   "source": "luogu",
 *   "name": "洛谷",
 *   "home": "https://www.luogu.com.cn/problem/list",
 *   "items": [
 *     {"id": "P1216", "title": "数字三角形", "url": "...", "difficulty": "EASY",
 *      "tags": ["动态规划", "递推"], "acRate": 0.62}
 *   ]
 * }
 * ```
 *
 * `tags` 写中文算法名即可，别名表会翻成 LeetCode 的标签体系，
 * 于是同一套打标规则、相似度、学习计划对新题源直接生效。
 */

import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { asText, loadJson } from "./io.js";
import { py } from "./pyre.js";
import { CN_SUB_ALIAS, CN_TAG_ALIAS, DIFF_ALIAS, LATIN_TAIL } from "./rules/extra.data.js";
import type { Seed } from "./taxonomy.js";

const LATIN_TAIL_RE = py(LATIN_TAIL);

/** 「动态规划 DP」「深度优先搜索 DFS」这类后缀，去掉尾部的英文再匹配一次。 */
function lookup(table: Record<string, string>, name: string): string | null {
  if (name in table) return table[name];
  const trimmed = name.replace(new RegExp(LATIN_TAIL_RE.source, "u"), "").trim();
  return trimmed ? (table[trimmed] ?? null) : null;
}

export interface ExtraItem {
  source: string;
  sourceName: string;
  sourceHome: string;
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  url: string;
  difficulty: string;
  acRate: number;
  rawTags: string[];
  tagNames: string[];
  subHits: Seed[];
}

/** 读取所有 extra_*.json，规整成和 LeetCode 列表同构的记录。 */
export function loadExtraSources(rawDir: string): ExtraItem[] {
  const out: ExtraItem[] = [];
  let files: string[];
  try {
    files = readdirSync(rawDir).filter((f) => f.startsWith("extra_") && f.endsWith(".json")).sort();
  } catch {
    return out;
  }
  for (const file of files) {
    const path = join(rawDir, file);
    const blob = loadJson<{
      source?: string; name?: string; home?: string;
      items?: Record<string, unknown>[];
    }>(path);
    const source = blob.source || basename(file, ".json").replace(/^extra_/, "");
    const name = blob.name || source;
    for (const raw of blob.items ?? []) {
      const names = (raw["tags"] as string[] | undefined) ?? [];
      const tags: string[] = [];
      const subHits: Seed[] = [];
      for (const tagName of names) {
        const slug = lookup(CN_TAG_ALIAS, tagName);
        if (slug) tags.push(slug);
        const sub = lookup(CN_SUB_ALIAS, tagName);
        if (sub) subHits.push([sub, 70, `${tagName}（${name}标注）`]);
      }
      const id = asText(raw["id"]);
      const diffKey = (asText(raw["difficulty"]) || "MEDIUM").toUpperCase();
      out.push({
        source,
        sourceName: name,
        sourceHome: blob.home || "",
        id,
        slug: `${source}:${id}`,
        title: (raw["title"] as string) || id,
        titleEn: (raw["titleEn"] as string) || "",
        url: (raw["url"] as string) || blob.home || "",
        difficulty: DIFF_ALIAS[diffKey] ?? "MEDIUM",
        acRate: Number(raw["acRate"] ?? 0) || 0,
        rawTags: tags,
        tagNames: names,
        subHits,
      });
    }
    process.stdout.write(`[extra] ${name}: ${(blob.items ?? []).length} 题（${file}）\n`);
  }
  return out;
}
