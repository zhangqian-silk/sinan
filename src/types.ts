/** 构建产物（data/dist/*.json）的形状。由 src/build/build.ts 产出。 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface TagRef {
  id: string;
  name: string;
  cat: string;
  w: number;
  src: string[];
  /** 在标签树里的深度：1=分区，2=子标签，3 及以下=更细的技巧。省略按 2 处理 */
  level?: number;
  /** level ≥ 3 时的父节点 id */
  parent?: string;
}

export interface ApproachRef {
  id: string;
  name: string;
  domain: string;
  conf: number;
  w: number;
  hits: number;
  from: string;
}

/** 一道题的一种解法：这个技巧的核心思想，落到这道题上是什么样子。 */
export interface ReviewSolution {
  /** 这个解法用到的标签节点 id，一个解法常常同时用到几个技巧 */
  tags: string[];
  /** 这个解法在本题里的叫法 */
  name: string;
  /** 核心思想怎么映射到这道题 */
  idea: string;
  /** 时间复杂度 */
  time?: string;
  /** 空间复杂度 */
  space?: string;
}

/** 一道题的全部解法，按上手顺序排，第一条就是最简可行的那个。 */
export interface ProblemReview {
  solutions: ReviewSolution[];
  /** 这题最容易错的地方 */
  pitfall?: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  difficulty: Difficulty;
  difficultyCn: string;
  acRate: number;
  paid: boolean;
  solutionCount?: number;
  rawTags?: string[];
  tagNames: string[];
  tags: TagRef[];
  tagIds: string[];
  /** 更深一层的技巧标签（level ≥ 3）。父节点一定也在这道题的标签里 */
  deepTagIds?: string[];
  mainTag: string;
  mainTagName: string;
  mainCat: string;
  cats: string[];
  catSpan: number;
  freq: number;
  freqRank: number;
  hasContent?: boolean;
  category?: string;
  seriesKey?: string;
  source: string;
  sourceName: string;
  /** 非力扣题源的站点首页，meta 里的「题目来源」一栏要用 */
  sourceHome?: string;
  url: string;
  approach?: ApproachRef[];
  approachIds?: string[];
  mainApproach?: string;
  approachFrom?: string;
  solutionSampled?: number;
  codeBlocks?: number;
  approachWhy?: Record<string, string[]>;
  /** 有人工判定时带上，标签也以人工为准 */
  review?: ProblemReview;
  value: number;
}

export interface SubCategory {
  id: string;
  name: string;
  desc: string;
  count: number;
  main: number;
  /** 再往下一层的节点，递归；没有分化的节点就没有这个字段 */
  kids?: SubCategory[];
}

export interface Category {
  id: string;
  name: string;
  desc: string;
  order: number;
  subs: SubCategory[];
  count: number;
  main: number;
}

export interface SubWithCat extends SubCategory {
  cat: string;
  catName: string;
}

export interface CuratedGroup {
  name: string;
  slugs: string[];
}

export interface CuratedList {
  id: string;
  name: string;
  desc: string;
  kind: string;
  source: string;
  url: string;
  declaredNum: number;
  slugs: string[];
  groups?: CuratedGroup[];
  stats: {
    resolved: number;
    hot: number;
    paid: number;
    difficulty: Record<string, number>;
  };
}

export interface SimilarEntry {
  slug: string;
  score: number;
  why: string[];
}

export interface SourceMeta {
  id: string;
  name: string;
  count: number;
  url?: string;
  note?: string;
}

export interface Meta {
  builtAt: string;
  /** 是不是随包分发的精简基线（没有题面 / 高频 / 题单） */
  baseline?: boolean;
  sources: SourceMeta[];
  /** 题号系列：力扣主站 / LCP / LCR / LCS / 面试题、洛谷 P / B */
  series?: SourceMeta[];
  overlays?: SourceMeta[];
  stats: {
    total: number;
    free: number;
    withContent: number;
    avgTags: number;
    multiApproach: number;
    withApproach: number;
    withCode: number;
    approachFromCode: number;
    approachFromStatement: number;
    approachCrossChecked: number;
    avgApproaches: number;
    difficulty: Record<string, number>;
    cats: Record<string, number>;
    subs: Record<string, number>;
  };
}

export interface LocalFile {
  path: string;
  lang: string;
  abs: string;
}

export interface Progress {
  checkins: Record<string, { at: string; note: string }>;
  notes: Record<string, unknown>;
}
