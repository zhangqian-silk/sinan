/**
 * Store 的 Node 实现：所有文件系统动作都在这里。
 *
 * 从 store.ts 拆出来是为了让那边变成纯逻辑 —— 浏览器里的静态站加载 store.js
 * 时不能碰到任何 `node:` 导入。命令行与本地 web 用 `openStore()` 即可，
 * 行为和拆分之前完全一致。
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { expand, type Packed } from "./baseline.js";
import { CliError } from "./errors.js";
import { ensureHome, PROGRESS_FILE, resolveDataDir, resolveSolutionDirs } from "./paths.js";
import { Store, type StoreCore, type StoreHost, type StoreOptions } from "./store.js";
import type { Category, CuratedList, LocalFile, Meta, Problem, Progress } from "./types.js";

/** 题解文件名以题号开头就能被识别。 */
const ID_PREFIX = /^(\d{1,4})[.\s_-]/;
const LANG_BY_SUFFIX: Record<string, string> = {
  ".py": "Python", ".go": "Go", ".java": "Java", ".cpp": "C++", ".c": "C",
  ".js": "JS", ".ts": "TS", ".rs": "Rust", ".kt": "Kotlin",
};

/** 改过名的旧打卡文件都还认：读的时候合并进来，写只写新文件。 */
const PROGRESS_LEGACY_NAMES = [".sinan-progress.json", ".lc-progress.json", ".hone-progress.json"];

export function createNodeHost(options: StoreOptions = {}): StoreHost {
  const dataDir = resolveDataDir(options.dataDir);
  const solutionDirs = resolveSolutionDirs(options.solutions ?? []);
  const progressFile = options.progressFile ?? PROGRESS_FILE;

  const readJson = <T>(name: string): T | null => {
    const path = join(dataDir, name);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  };

  return {
    dataDir,
    solutionDirs,
    progressFile,

    loadCore(): StoreCore {
      const full = existsSync(join(dataDir, "problems.json"));
      const packed = !full && existsSync(join(dataDir, "baseline.json"));
      if (!full && !packed) {
        throw new CliError(
          `还没有题库数据（找过 ${dataDir}）。\n` +
            "先跑：{PROG} sync   或用 --data-dir / SINAN_DATA 指到已有的构建产物");
      }
      if (packed) {
        const data = expand(JSON.parse(readFileSync(join(dataDir, "baseline.json"), "utf-8")) as Packed);
        return {
          baseline: true,
          meta: data.meta,
          cats: data.cats,
          problems: data.problems,
          curated: [],
          similar: data.similar,
        };
      }
      const need = <T>(name: string): T => {
        const got = readJson<T>(name);
        if (got === null) throw new CliError(`缺少 ${join(dataDir, name)}，先跑：{PROG} sync`);
        return got;
      };
      return {
        baseline: false,
        meta: need<Meta>("meta.json"),
        cats: need<Category[]>("taxonomy.json"),
        problems: need<Problem[]>("problems.json"),
        curated: readJson<CuratedList[]>("curated.json") ?? [],
        similar: null,
      };
    },

    readJson,

    readContent(offset: number, length: number): string | null {
      const fd = openSync(join(dataDir, "content.jsonl"), "r");
      try {
        const buf = Buffer.allocUnsafe(length);
        readSync(fd, buf, 0, length, offset);
        return (JSON.parse(buf.toString("utf-8")) as { html: string }).html;
      } finally {
        closeSync(fd);
      }
    },

    loadProgress(): Progress {
      const data: Progress = { checkins: {}, notes: {} };
      // 旧文件先读、新文件后读，同一道题以新文件为准
      const candidates: string[] = [];
      for (const dir of solutionDirs) {
        for (const name of PROGRESS_LEGACY_NAMES) candidates.push(join(dirname(dir), name));
      }
      candidates.push(progressFile);
      for (const path of candidates) {
        if (!existsSync(path)) continue;
        try {
          const old = JSON.parse(readFileSync(path, "utf-8")) as Partial<Progress>;
          Object.assign(data.checkins, old.checkins ?? {});
          Object.assign(data.notes, old.notes ?? {});
        } catch {
          // 坏掉的记录文件跳过，不要连带整个命令挂掉
        }
      }
      return data;
    },

    saveProgress(progress: Progress): void {
      if (progressFile === PROGRESS_FILE) ensureHome();
      mkdirSync(dirname(progressFile), { recursive: true });
      writeFileSync(progressFile, `${JSON.stringify(progress, null, 2)}\n`, "utf-8");
    },

    scanSolutions(): Map<string, LocalFile[]> {
      const found = new Map<string, LocalFile[]>();
      for (const folder of solutionDirs) {
        let names: string[];
        try {
          names = readdirSync(folder).sort();
        } catch {
          continue;
        }
        const label = basename(folder);
        for (const name of names) {
          const abs = join(folder, name);
          try {
            if (!statSync(abs).isFile()) continue;
          } catch {
            continue;
          }
          const match = ID_PREFIX.exec(name);
          if (!match) continue;
          const qid = String(parseInt(match[1], 10));
          const suffix = extname(name).toLowerCase();
          const lang = LANG_BY_SUFFIX[suffix] ?? suffix.replace(/^\./, "").toUpperCase();
          const bucket = found.get(qid) ?? [];
          bucket.push({ path: `${label}/${name}`, lang, abs });
          found.set(qid, bucket);
        }
      }
      return found;
    },

    /**
     * 换行统一成 `\n`：题解目录里混着 CRLF 结尾的文件，不归一化的话终端里每行都会
     * 拖一个 `\r`，网页端也会多出空行。
     */
    readSolutionFile(file: LocalFile): string {
      try {
        return readFileSync(file.abs, "utf-8").replace(/\r\n?/g, "\n");
      } catch {
        return "";
      }
    },
  };
}

/** 命令行与本地 web 的入口：按选项组好 Node host 再建 Store。 */
export function openStore(options: StoreOptions = {}): Store {
  return new Store(createNodeHost(options));
}
