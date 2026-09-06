/**
 * 数据层：加载构建产物、汇总专题、解析刷题进度。
 *
 * CLI 和 web 端的所有命令都从这里取数据，不直接读文件。
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

import { CliError } from "./errors.js";
import { expand, type Packed } from "./baseline.js";
import { ensureHome, PROGRESS_FILE, resolveDataDir, resolveSolutionDirs } from "./paths.js";
import type {
  ApproachRef,
  Category,
  CuratedGroup,
  CuratedList,
  Difficulty,
  LocalFile,
  Meta,
  Problem,
  Progress,
  SimilarEntry,
  SubWithCat,
} from "./types.js";
import { Counter, sortBy, type SortKey } from "./util.js";

/** 题解文件名以题号开头就能被识别。 */
const ID_PREFIX = /^(\d{1,4})[.\s_-]/;
const LANG_BY_SUFFIX: Record<string, string> = {
  ".py": "Python", ".go": "Go", ".java": "Java", ".cpp": "C++", ".c": "C",
  ".js": "JS", ".ts": "TS", ".rs": "Rust", ".kt": "Kotlin",
};

/** 改过名的旧打卡文件都还认：读的时候合并进来，写只写新文件。 */
const PROGRESS_LEGACY_NAMES = [".sinan-progress.json", ".lc-progress.json", ".hone-progress.json"];

export const DIFF_RANK: Record<Difficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };
export const DIFF_CN: Record<Difficulty, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };

export type TopicKind = "cat" | "tag" | "list" | "route";

/** 一个可以练的专题：标签大类、子标签，或者一份特殊题单。 */
export interface Topic {
  id: string;
  name: string;
  kind: TopicKind;
  desc: string;
  /** kind=tag 时所属大类 */
  cat: string;
  /** kind=list 时的题目集合 */
  slugs: string[];
  /** kind=list 时官方的知识点分组 */
  groups: CuratedGroup[];
  url: string;
  source: string;
}

function makeTopic(init: Partial<Topic> & Pick<Topic, "id" | "name" | "kind">): Topic {
  return {
    desc: "", cat: "", slugs: [], groups: [], url: "", source: "",
    ...init,
  };
}

/**
 * 思路名匹配。
 *
 * 思路名里常带括号和斜杠（「质数筛（埃氏/线性）」「堆 / 优先队列」），
 * 所以按分段做双向子串匹配：查「埃氏筛」能命中「埃氏」这一段，查「堆」也能命中。
 */
export function approachMatches(query: string, a: ApproachRef): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) return true;
  for (const raw of a.name.toLowerCase().split(/[（）()/、·\s]+/)) {
    const seg = raw.trim();
    if (seg && (seg.includes(q) || q.includes(seg))) return true;
  }
  return false;
}

export interface QueryOptions {
  text?: string;
  cat?: string;
  tag?: string;
  diffs?: Set<string> | null;
  hot?: boolean;
  todo?: boolean;
  mine?: boolean;
  multi?: boolean;
  source?: string;
  includePaid?: boolean;
  inList?: string;
  approach?: string;
  sort?: string;
}

export interface MemberOptions {
  includePaid?: boolean;
  source?: string;
  quality?: boolean;
  minPool?: number;
}

export interface StoreOptions {
  dataDir?: string;
  solutions?: string[];
  /** 打卡记录的位置。测试要能指到一个空文件，否则会读到跑测试那个人的真实进度。 */
  progressFile?: string;
}

export interface ApproachStat {
  id: string;
  name: string;
  domain: string;
  w: number;
  total: number;
  done: number;
  real: number;
  hot: number;
}

function lazy<T>(make: () => T): () => T {
  let cached: { value: T } | null = null;
  return () => {
    if (!cached) cached = { value: make() };
    return cached.value;
  };
}

export class Store {
  readonly dist: string;
  readonly solutionDirs: string[];
  readonly progressFile: string;
  /** 用的是随包的精简基线（没有题面 / 高频 / 题单），而不是用户自己抓的完整产物 */
  readonly baseline: boolean;
  readonly meta: Meta;
  readonly cats: Category[];
  readonly problems: Problem[];
  readonly curated: CuratedList[];

  readonly bySlug = new Map<string, Problem>();
  readonly byId = new Map<string, Problem>();
  readonly catById = new Map<string, Category>();
  readonly subById = new Map<string, SubWithCat>();
  /** 思路 id -> 名称 / 领域 / 区分度，从题目产物里就地汇总，不再另存一份词表。 */
  readonly approachById = new Map<string, { id: string; name: string; domain: string; w: number }>();

  private progress: Progress;
  /** 基线模式下相似度随主文件一起读进来了，不再单独有文件 */
  private packedSimilar: Record<string, SimilarEntry[]> | null = null;

  constructor(options: StoreOptions = {}) {
    this.dist = resolveDataDir(options.dataDir);
    this.solutionDirs = resolveSolutionDirs(options.solutions ?? []);
    this.progressFile = options.progressFile ?? PROGRESS_FILE;
    const full = existsSync(join(this.dist, "problems.json"));
    const packed = !full && existsSync(join(this.dist, "baseline.json"));
    if (!full && !packed) {
      throw new CliError(
        `还没有题库数据（找过 ${this.dist}）。\n` +
          "先跑：{PROG} sync   或用 --data-dir / SINAN_DATA 指到已有的构建产物");
    }
    this.baseline = packed;
    if (packed) {
      const raw = readFileSync(join(this.dist, "baseline.json"), "utf-8");
      const data = expand(JSON.parse(raw) as Packed);
      this.meta = data.meta;
      this.cats = sortBy(data.cats, (c) => [c.order]);
      this.problems = data.problems;
      this.curated = [];
      this.packedSimilar = data.similar;
    } else {
      this.meta = this.load<Meta>("meta.json");
      this.cats = sortBy(this.load<Category[]>("taxonomy.json"), (c) => [c.order]);
      this.problems = this.load<Problem[]>("problems.json");
      this.curated = this.load<CuratedList[]>("curated.json", []);
    }

    for (const p of this.problems) {
      this.bySlug.set(p.slug, p);
      const key = String(p.id).toLowerCase();
      if (!this.byId.has(key)) this.byId.set(key, p);
      for (const a of p.approach ?? []) {
        if (!this.approachById.has(a.id)) {
          this.approachById.set(a.id, { id: a.id, name: a.name, domain: a.domain, w: a.w });
        }
      }
    }
    for (const c of this.cats) {
      this.catById.set(c.id, c);
      for (const s of c.subs) this.subById.set(s.id, { ...s, cat: c.id, catName: c.name });
    }

    this.progress = this.readProgress();
  }

  // --- 载入 -----------------------------------------------------------------

  private load<T>(name: string, fallback?: T): T {
    const path = join(this.dist, name);
    if (!existsSync(path)) {
      if (fallback === undefined) throw new CliError(`缺少 ${path}，先跑：{PROG} sync`);
      return fallback;
    }
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  }

  /** 相似度图，只有需要时才加载（文件不小）。 */
  readonly similar: () => Record<string, SimilarEntry[]> = lazy(() =>
    this.packedSimilar ?? this.load<Record<string, SimilarEntry[]>>("similar.json", {}));

  private readonly contentIndex: () => Record<string, [number, number]> = lazy(() =>
    this.load<Record<string, [number, number]>>("content_index.json", {}));

  /** 按 (偏移, 长度) 直接 seek 出题面，不把 8MB 的 jsonl 全读进内存。 */
  content(slug: string): string | null {
    const span = this.contentIndex()[slug];
    if (!span) return null;
    const [offset, length] = span;
    const fd = openSync(join(this.dist, "content.jsonl"), "r");
    try {
      const buf = Buffer.allocUnsafe(length);
      readSync(fd, buf, 0, length, offset);
      return (JSON.parse(buf.toString("utf-8")) as { html: string }).html;
    } finally {
      closeSync(fd);
    }
  }

  // --- 进度 -----------------------------------------------------------------

  private readProgress(): Progress {
    const data: Progress = { checkins: {}, notes: {} };
    // 旧文件先读、新文件后读，同一道题以新文件为准
    const candidates: string[] = [];
    for (const dir of this.solutionDirs) {
      for (const name of PROGRESS_LEGACY_NAMES) candidates.push(join(dirname(dir), name));
    }
    candidates.push(this.progressFile);
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
  }

  saveProgress(): void {
    if (this.progressFile === PROGRESS_FILE) ensureHome();
    mkdirSync(dirname(this.progressFile), { recursive: true });
    writeFileSync(this.progressFile, `${JSON.stringify(this.progress, null, 2)}\n`, "utf-8");
  }

  /** 扫描本地题解目录，按题号归档。 */
  readonly localSolutions: () => Map<string, LocalFile[]> = lazy(() => {
    const found = new Map<string, LocalFile[]>();
    for (const folder of this.solutionDirs) {
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
  });

  filesOf(p: Problem): LocalFile[] {
    return this.localSolutions().get(String(p.id)) ?? [];
  }

  /**
   * 读一份本地题解的源码。
   *
   * 换行统一成 `\n`：题解目录里混着 CRLF 结尾的文件，不归一化的话终端里每行都会
   * 拖一个 `\r`，网页端也会多出空行。
   */
  readSolution(file: LocalFile): string {
    try {
      return readFileSync(file.abs, "utf-8").replace(/\r\n?/g, "\n");
    } catch {
      return "";
    }
  }

  isChecked(p: Problem): boolean {
    return p.slug in this.progress.checkins;
  }

  isDone(p: Problem): boolean {
    return this.filesOf(p).length > 0 || this.isChecked(p);
  }

  toggleCheckin(p: Problem, note = ""): boolean {
    if (p.slug in this.progress.checkins) {
      delete this.progress.checkins[p.slug];
      this.saveProgress();
      return false;
    }
    const now = new Date();
    const at = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    this.progress.checkins[p.slug] = { at, note };
    this.saveProgress();
    return true;
  }

  progressOf(problems: readonly Problem[]): [number, number] {
    let done = 0;
    for (const p of problems) if (this.isDone(p)) done += 1;
    return [done, problems.length];
  }

  // --- 专题 -----------------------------------------------------------------

  readonly topics: () => Map<string, Topic> = lazy(() => {
    const out = new Map<string, Topic>();
    for (const c of this.cats) {
      out.set(c.id, makeTopic({ id: c.id, name: c.name, kind: "cat", desc: c.desc }));
    }
    for (const [sid, s] of this.subById) {
      out.set(sid, makeTopic({ id: sid, name: s.name, kind: "tag", desc: s.desc, cat: s.cat }));
    }
    for (const lst of this.curated) {
      out.set(lst.id, makeTopic({
        id: lst.id, name: lst.name, kind: "list", desc: lst.desc ?? "",
        slugs: lst.slugs ?? [], groups: lst.groups ?? [], url: lst.url ?? "",
        source: lst.source ?? "",
      }));
    }
    return out;
  });

  findTopic(key: string): Topic | null {
    const topics = this.topics();
    const direct = topics.get(key);
    if (direct) return direct;
    const low = key.toLowerCase();
    // 支持简写：hot100 / top100 / 150 …
    const aliases: Record<string, string> = {
      hot100: "lc:top-100-liked", "hot-100": "lc:top-100-liked",
      top100: "lc:top-100-liked", "150": "lc:top-interview-150",
      interview150: "lc:top-interview-150", lc75: "lc:leetcode-75",
      codetop: "codetop:global-100",
    };
    const alias = aliases[low];
    if (alias && topics.has(alias)) return topics.get(alias)!;

    const hits: Topic[] = [];
    for (const t of topics.values()) {
      if (t.id.toLowerCase().includes(low) || t.name.toLowerCase().includes(low)) hits.push(t);
    }
    if (hits.length === 1) return hits[0];
    for (const t of hits) if (t.name.toLowerCase() === low) return t;   // 完全同名优先
    return hits[0] ?? null;
  }

  /**
   * 「值得练」的题：被 CodeTop 面到过，或被官方/公司题单收录。
   * 长尾周赛题不进这个集合 —— 练它们对掌握专题技巧帮助有限。
   */
  readonly signalSlugs: () => Set<string> = lazy(() => {
    const out = new Set<string>();
    for (const p of this.problems) if (p.freq) out.add(p.slug);
    for (const slug of this.listMembership().keys()) out.add(slug);
    return out;
  });

  members(topic: Topic, options: MemberOptions = {}): Problem[] {
    const { includePaid = false, source = "", quality = false, minPool = 12 } = options;
    let pool: Problem[];
    if (topic.kind === "list") {
      pool = [];
      for (const s of topic.slugs) {
        const p = this.bySlug.get(s);
        if (p) pool.push(p);
      }
    } else if (topic.kind === "cat") {
      pool = this.problems.filter((p) => p.cats.includes(topic.id));
    } else {
      pool = this.problems.filter((p) => p.tagIds.includes(topic.id));
    }
    if (!includePaid) pool = pool.filter((p) => !p.paid);
    if (source) pool = pool.filter((p) => p.source === source);
    if (quality && topic.kind !== "list") {
      const signals = this.signalSlugs();
      const picked = pool.filter((p) => signals.has(p.slug));
      if (picked.length >= minPool) return picked;
    }
    return pool;
  }

  /** 题目 slug -> 它出现在哪些特殊题单里。 */
  readonly listMembership: () => Map<string, string[]> = lazy(() => {
    const out = new Map<string, string[]>();
    for (const lst of this.curated) {
      for (const slug of lst.slugs ?? []) {
        const bucket = out.get(slug) ?? [];
        bucket.push(lst.id);
        out.set(slug, bucket);
      }
    }
    return out;
  });

  listNamesOf(p: Problem): string[] {
    const names = new Map(this.curated.map((l) => [l.id, l.name]));
    const out: string[] = [];
    for (const id of this.listMembership().get(p.slug) ?? []) {
      const name = names.get(id);
      if (name) out.push(name);
    }
    return out;
  }

  // --- 查询 -----------------------------------------------------------------

  query(options: QueryOptions = {}): Problem[] {
    const {
      text = "", cat = "", tag = "", diffs = null, hot = false, todo = false,
      mine = false, multi = false, source = "", includePaid = false, inList = "",
      approach = "", sort = "id",
    } = options;
    const low = text.toLowerCase().trim();
    const apLow = approach.toLowerCase().trim();
    const listTopic = inList ? this.topics().get(inList) : undefined;
    const allowed = listTopic ? new Set(listTopic.slugs) : null;

    const out: Problem[] = [];
    for (const p of this.problems) {
      if (!includePaid && p.paid) continue;
      if (allowed && !allowed.has(p.slug)) continue;
      if (cat && !p.cats.includes(cat)) continue;
      if (tag && !p.tagIds.includes(tag)) continue;
      if (source && p.source !== source) continue;
      if (apLow && !(p.approach ?? []).some((a) => approachMatches(apLow, a))) continue;
      if (diffs && diffs.size && !diffs.has(p.difficulty)) continue;
      if (hot && !p.freq) continue;
      if (multi && p.catSpan < 3) continue;
      if (mine && !this.filesOf(p).length) continue;
      if (todo && this.isDone(p)) continue;
      if (low) {
        const hay = [
          p.id, p.title, p.titleEn ?? "",
          p.tags.map((t) => t.name).join(" "),
          p.tagNames.join(" "),
          (p.approach ?? []).map((a) => a.name).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(low)) continue;
      }
      out.push(p);
    }
    return sortProblems(out, sort);
  }

  /**
   * 当前筛选条件下，每个维度各选项还剩多少题（取交集）。
   *
   * 标准的分面语义：算某个维度的计数时，**排除该维度自身的条件** —— 否则选了
   * 「动态规划」之后，大类那一栏就只剩它自己有数字，没法比较着换。
   */
  facets(filters: QueryOptions = {}): Record<string, Record<string, number>> {
    const dims: [string, keyof QueryOptions][] = [
      ["cats", "cat"],
      ["subs", "tag"],
      ["approaches", "approach"],
      ["sources", "source"],
      ["diffs", "diffs"],
      ["lists", "inList"],
    ];
    const out: Record<string, Record<string, number>> = {};
    for (const [name, drop] of dims) {
      const rest: QueryOptions = { ...filters };
      delete rest[drop];
      const rows = this.query(rest);
      const acc = new Counter<string>();
      if (name === "cats") {
        for (const p of rows) acc.update(p.cats);
      } else if (name === "subs") {
        for (const p of rows) acc.update(p.tagIds);
      } else if (name === "approaches") {
        for (const p of rows) acc.update((p.approach ?? []).map((a) => a.name));
      } else if (name === "sources") {
        for (const p of rows) acc.add(p.source);
      } else if (name === "diffs") {
        for (const p of rows) acc.add(p.difficulty);
      } else {
        for (const p of rows) acc.update(this.listMembership().get(p.slug) ?? []);
      }
      out[name] = acc.toObject();
    }
    return out;
  }

  /** 思路词表：每个思路有多少题、其中多少已刷、有多少是从题解真实提取的。 */
  approachStats(): ApproachStat[] {
    const acc = new Map<string, ApproachStat>();
    for (const p of this.problems) {
      const done = this.isDone(p);
      for (const a of p.approach ?? []) {
        let cur = acc.get(a.id);
        if (!cur) {
          cur = { id: a.id, name: a.name, domain: a.domain, w: a.w, total: 0, done: 0, real: 0, hot: 0 };
          acc.set(a.id, cur);
        }
        cur.total += 1;
        if (done) cur.done += 1;
        if (a.from === "solutions") cur.real += 1;
        if (p.freq) cur.hot += 1;
      }
    }
    return sortBy([...acc.values()], (x) => [x.domain, -x.total]);
  }
}

function numericId(p: Problem): SortKey {
  const raw = String(p.id);
  const digits = raw.replace(/\D/g, "");
  return [p.source === "leetcode" ? 0 : 1, digits ? parseInt(digits, 10) : 10 ** 6, raw];
}

export function sortProblems(items: readonly Problem[], sort: string): Problem[] {
  const keys: Record<string, (p: Problem) => SortKey> = {
    id: numericId,
    hot: (p) => [-p.freq, ...numericId(p)],
    value: (p) => [-p.value],
    diff: (p) => [DIFF_RANK[p.difficulty], -p.value],
    ac: (p) => [p.acRate],
    acdesc: (p) => [-p.acRate],
  };
  return sortBy(items, keys[sort] ?? numericId);
}
