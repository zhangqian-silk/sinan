/**
 * 把完整构建产物压成可以随包分发的「基线数据」。
 *
 * 两条线同时收：
 *
 * **合规**——只留事实标识（题号 / slug / 标题 / 难度 / 链接）、通用算法名，
 * 以及我们自己算出来的标签、思路、相似度、判定理由。明确剔除：
 * - 题面原文（文字作品）
 * - CodeTop 频次与排名（那是 CodeTop 的全部产品）
 * - 官方精选题单及其知识点分组（独创的选择与编排，最像汇编作品的一块）
 * - 通过率、题解数（变化太快，随包发出去只会是过期数据）
 *
 * **体积**——随包分发就得进 git，所以字段能推导的一律不存，数组降成定长元组，
 * 重复的理由文本抽成字典。加载侧由 store 的 expand 还原，上层代码看不见差别。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { dumpJson, loadJson } from "../build/io.js";
import { URL_TEMPLATE, type Packed, type PackedProblem } from "../baseline.js";
import type { Category, Problem, SimilarEntry } from "../types.js";

class Pool<T> {
  private readonly index = new Map<string, number>();
  readonly items: T[] = [];
  put(key: string, make: () => T): number {
    const hit = this.index.get(key);
    if (hit !== undefined) return hit;
    const at = this.items.length;
    this.index.set(key, at);
    this.items.push(make());
    return at;
  }
}

export function pack(distDir: string): Packed {
  const problems = loadJson<Problem[]>(join(distDir, "problems.json"));
  const cats = loadJson<Category[]>(join(distDir, "taxonomy.json"));
  const similarRaw = existsSync(join(distDir, "similar.json"))
    ? loadJson<Record<string, SimilarEntry[]>>(join(distDir, "similar.json"))
    : {};

  const diff = new Pool<string>();
  const source = new Pool<[string, string, string]>();
  const tag = new Pool<string>();
  const approach = new Pool<[string, string, string, number]>();
  const channel = new Pool<string>();
  const tagSrc = new Pool<string>();
  const why = new Pool<string>();
  const simWhy = new Pool<string>();

  const slugAt = new Map<string, number>();
  problems.forEach((p, i) => slugAt.set(p.slug, i));

  const packed: PackedProblem[] = problems.map((p) => {
    const tags = p.tags.map((t) => [
      tag.put(t.id, () => t.id),
      t.w,
      t.src.map((s) => tagSrc.put(s, () => s)),
    ] as [number, number, number[]]);
    const fp = (p.approach ?? []).map((a) => [
      approach.put(a.id, () => [a.id, a.name, a.domain, a.w] as [string, string, string, number]),
      Math.round(a.conf * 1000),
      channel.put(a.from, () => a.from),
    ] as [number, number, number]);

    const row: PackedProblem = {
      0: p.id,
      1: p.slug,
      2: p.title,
      3: diff.put(p.difficulty, () => p.difficulty),
      4: source.put(p.source, () => [p.source, p.sourceName, URL_TEMPLATE[p.source] ?? ""] as [string, string, string]),
      5: tags,
      6: fp,
    };
    const reasons = p.approachWhy ?? {};
    if (Object.keys(reasons).length) {
      const out: Record<string, number[]> = {};
      for (const [aid, lines] of Object.entries(reasons)) {
        const at = approach.put(aid, () => [aid, aid, "other", 1]);
        out[String(at)] = lines.map((l) => why.put(l, () => l));
      }
      row[7] = out;
    }
    return row;
  });

  const similar: Record<number, [number, number, number[]][]> = {};
  for (const [slug, rows] of Object.entries(similarRaw)) {
    const at = slugAt.get(slug);
    if (at === undefined) continue;
    const kept: [number, number, number[]][] = [];
    for (const n of rows) {
      const other = slugAt.get(n.slug);
      if (other === undefined) continue;
      kept.push([other, Math.round(n.score * 10000), n.why.map((w) => simWhy.put(w, () => w))]);
    }
    if (kept.length) similar[at] = kept;
  }

  return {
    v: 1,
    builtAt: loadJson<{ builtAt: string }>(join(distDir, "meta.json")).builtAt,
    pool: {
      diff: diff.items,
      source: source.items,
      tag: tag.items,
      approach: approach.items,
      channel: channel.items,
      tagSrc: tagSrc.items,
      why: why.items,
    },
    problems: packed,
    similar,
    simWhy: simWhy.items,
    cats,
  };
}

function main(): void {
  const dist = process.argv[2];
  const out = process.argv[3];
  if (!dist || !out) {
    process.stdout.write("用法: node dist/tools/pack.js <完整 dist 目录> <输出目录>\n");
    process.exitCode = 1;
    return;
  }
  const data = pack(dist);
  dumpJson(join(out, "baseline.json"), data, true);
  process.stdout.write(
    `\n基线数据：${data.problems.length} 题 · ${data.pool.tag.length} 个标签 · `
    + `${data.pool.approach.length} 种思路 · ${Object.keys(data.similar).length} 题有邻居\n`);
}

main();
