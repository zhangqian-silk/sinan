/**
 * 构建期的文件读写与目录约定。
 *
 * 抓取产物落在 `<数据根>/raw`，打标产物落在 `<数据根>/dist`。数据根默认
 * `~/.sinan/data`，可以用 `SINAN_DATA_ROOT` 覆盖 —— CLI 的 `--data-dir` 会换算成它。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

export function dataRoot(): string {
  const env = process.env["SINAN_DATA_ROOT"];
  return env ? resolve(env) : join(homedir(), ".sinan", "data");
}

export const rawDir = (): string => join(dataRoot(), "raw");
export const distDir = (): string => join(dataRoot(), "dist");

export function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/** 逐行 JSON。上次抓取中断留下的半行直接跳过。 */
export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const raw of readFileSync(path, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * 写 JSON。
 *
 * 大文件（题库、相似度图）用 compact 模式：几 MB 的产物没人会去读，缩进只会让
 * 体积多出三成。meta.json 这种要人看的才排版。
 */
export function dumpJson(path: string, obj: unknown, compact = false): void {
  mkdirSync(dirname(path), { recursive: true });
  const text = compact ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
  writeFileSync(path, `${text}\n`, "utf-8");
  let shown = path;
  try {
    const rel = relative(dataRoot(), path);
    if (!rel.startsWith("..")) shown = rel;
  } catch {
    /* 不在数据根下就打全路径 */
  }
  process.stdout.write(`[write] ${shown}  ${Math.round(text.length / 1024)} KB\n`);
}

export interface CodeRecord {
  blocks?: { code?: string; lang?: string; t?: string }[];
}

/** 读抓下来的题解代码：slug -> { blocks }。 */
export function loadCodeRecords(path?: string): Map<string, CodeRecord> {
  const file = path ?? join(rawDir(), "solution_code.jsonl");
  const out = new Map<string, CodeRecord>();
  for (const rec of readJsonl<CodeRecord & { _key?: string }>(file)) {
    if (rec._key) out.set(rec._key, rec);
  }
  return out;
}
