/** 构建产物（data/dist/*.json）的形状。由 src/build/build.ts 产出。 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface TagRef {
  id: string;
  name: string;
  cat: string;
  w: number;
  src: string[];
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
  value: number;
}

export interface SubCategory {
  id: string;
  name: string;
  desc: string;
  count: number;
  main: number;
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
  sources: SourceMeta[];
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
