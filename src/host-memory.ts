/**
 * Store 的浏览器实现：数据全在内存里，进度存 localStorage。
 *
 * GitHub Pages 上没有后端，静态站把随包基线（baseline.json）拉下来展开成
 * 同一套结构，再交给同一个 Store。于是查询、分面、专题、学习计划这些逻辑
 * 一行都不用重写，静态站算出来的和 `sinan plan` 完全一致。
 *
 * 基线里天然没有题面、面试频次和题单，所以 readContent 直接返回空 —— 这不是
 * 缺陷而是合规上的有意取舍，前端靠 meta.baseline 决定相关栏目怎么显示。
 */

import type { Expanded } from "./baseline.js";
import type { StoreCore, StoreHost } from "./store.js";
import type { LocalFile, Progress } from "./types.js";

const PROGRESS_KEY = "sinan.progress";

interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 拿不到 localStorage（隐私模式、iframe 限制）时退化成一份内存副本，功能不受影响。 */
function pickStorage(): KeyValue {
  try {
    const ls = globalThis.localStorage as KeyValue | undefined;
    if (ls) {
      ls.getItem(PROGRESS_KEY);
      return ls;
    }
  } catch {
    // 读一次就抛说明被禁用了，走内存副本
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => { mem.set(k, v); },
  };
}

export function createMemoryHost(data: Expanded): StoreHost {
  const storage = pickStorage();
  return {
    dataDir: "(随包基线)",
    solutionDirs: [],
    progressFile: "(浏览器 localStorage)",

    loadCore(): StoreCore {
      return {
        baseline: true,
        meta: data.meta,
        cats: data.cats,
        problems: data.problems,
        curated: [],
        similar: data.similar,
      };
    },

    // 相似度已经随基线内联进来了，别的附加文件静态站一概没有
    readJson: () => null,
    readContent: () => null,

    loadProgress(): Progress {
      const empty: Progress = { checkins: {}, notes: {} };
      try {
        const raw = storage.getItem(PROGRESS_KEY);
        if (!raw) return empty;
        const saved = JSON.parse(raw) as Partial<Progress>;
        return { checkins: saved.checkins ?? {}, notes: saved.notes ?? {} };
      } catch {
        return empty;
      }
    },

    saveProgress(progress: Progress): void {
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        // 存不下就算了，本次会话内的打卡仍然有效
      }
    },

    scanSolutions: () => new Map<string, LocalFile[]>(),
    readSolutionFile: () => "",
  };
}
