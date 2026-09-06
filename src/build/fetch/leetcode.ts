/**
 * 抓取 leetcode.cn 全量题库：题目列表 + 每题详情（官方相似题、题面）。
 *
 * 抓取结果写入 `<数据根>/raw/`，可中断续跑。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { dumpJson, loadJson, rawDir } from "../io.js";
import { fetchMany, graphql, sleep } from "../http.js";

const ENDPOINT = "https://leetcode.cn/graphql/";
const REFERER = "https://leetcode.cn/problemset/";

const LIST_QUERY = `
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total
    questions {
      frontendQuestionId
      titleSlug
      title
      titleCn
      difficulty
      acRate
      paidOnly
      solutionNum
      topicTags { slug name nameTranslated }
    }
  }
}
`;

const DETAIL_QUERY = `
query questionDetail($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    titleSlug
    categoryTitle
    difficulty
    isPaidOnly
    stats
    hints
    similarQuestions
    translatedContent
  }
}
`;

export interface ListItem {
  frontendQuestionId: string;
  titleSlug: string;
  title: string;
  titleCn: string;
  difficulty: string;
  acRate: number;
  paidOnly: boolean;
  solutionNum: number;
  topicTags: { slug: string; name: string; nameTranslated?: string }[];
}

const listPath = (): string => join(rawDir(), "leetcode_list.json");
const detailPath = (): string => join(rawDir(), "leetcode_detail.jsonl");

/** 按页拉全量题目列表。 */
export async function fetchList(pageSize = 100): Promise<ListItem[]> {
  const out: ListItem[] = [];
  let skip = 0;
  let total: number | null = null;
  while (total === null || skip < total) {
    const data = await graphql<{
      problemsetQuestionList: { total: number; questions: ListItem[] };
    }>(ENDPOINT, LIST_QUERY, {
      categorySlug: "all-code-essentials", limit: pageSize, skip, filters: {},
    }, { operation: "problemsetQuestionList", referer: REFERER });
    const page = data.problemsetQuestionList;
    total = page.total;
    if (!page.questions.length) break;
    out.push(...page.questions);
    skip += page.questions.length;
    process.stdout.write(`[list] ${out.length}/${total}\n`);
    await sleep(150);
  }
  return out;
}

interface DetailRecord {
  _key: string;
  _error?: string;
  id?: string;
  category?: string;
  paid?: boolean;
  hints?: number;
  similar?: unknown[];
  stats?: unknown;
  content?: string;
}

async function fetchDetail(slug: string): Promise<DetailRecord> {
  const data = await graphql<{
    question: {
      questionFrontendId?: string; categoryTitle?: string; isPaidOnly?: boolean;
      hints?: string[]; similarQuestions?: string; stats?: string; translatedContent?: string;
    } | null;
  }>(ENDPOINT, DETAIL_QUERY, { titleSlug: slug },
    { operation: "questionDetail", referer: `https://leetcode.cn/problems/${slug}/` });
  const q = data.question;
  if (q === null) return { _key: slug, _error: "question not found" };
  const parse = <T>(text: string | undefined, fallback: T): T => {
    if (!text) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  };
  return {
    _key: slug,
    id: q.questionFrontendId,
    category: q.categoryTitle,
    paid: Boolean(q.isPaidOnly),
    hints: (q.hints ?? []).length,
    similar: parse<unknown[]>(q.similarQuestions, []),
    stats: parse<unknown>(q.stats, {}),
    content: q.translatedContent ?? "",
  };
}

export async function run(options: { workers?: number; noDetail?: boolean } = {}): Promise<void> {
  const { workers = 6, noDetail = false } = options;
  if (!existsSync(listPath())) dumpJson(listPath(), await fetchList());
  const problems = loadJson<ListItem[]>(listPath());
  process.stdout.write(`[list] 题目总数 ${problems.length}\n`);
  if (noDetail) return;

  const slugs = problems.map((p) => p.titleSlug);
  const records = await fetchMany(slugs, fetchDetail, detailPath(), { workers, label: "detail" });
  const failed = records.filter((r) => r._error).map((r) => r._key);
  process.stdout.write(`[detail] 完成 ${records.length} 条，失败 ${failed.length}\n`);
  if (failed.length) process.stdout.write(`[detail] 失败样例: ${failed.slice(0, 10).join(", ")}\n`);
}
