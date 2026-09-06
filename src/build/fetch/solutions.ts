/**
 * 抓每道题的社区题解（标题 + 题解自带的算法标签 + 点赞数）。
 *
 * 为什么要抓这个：题目标签只能说明「这题和树有关」，说不出「这题是中序遍历还是层序遍历」。
 * 而题解标题里写得很清楚 ——「迭代法」「Morris 遍历」「埃氏筛」「贪心 + dfs」「记忆化搜索」，
 * 题解自己还带算法标签。这些才是判断两道题是否真的相似的依据。
 */

import { join } from "node:path";

import { loadJson, rawDir } from "../io.js";
import { fetchMany, graphql } from "../http.js";
import type { ListItem } from "./leetcode.js";

const ENDPOINT = "https://leetcode.cn/graphql/";

const QUERY = `
query questionTopicsList($questionSlug: String!, $skip: Int, $first: Int,
                         $orderBy: SolutionArticleOrderBy, $userInput: String,
                         $tagSlugs: [String!], $searchScope: SolutionSearchScopeEnum) {
  questionSolutionArticles(questionSlug: $questionSlug, skip: $skip, first: $first,
                           orderBy: $orderBy, userInput: $userInput,
                           tagSlugs: $tagSlugs, searchScope: $searchScope) {
    totalNum
    edges {
      node {
        title
        upvoteCount
        tags { name nameTranslated tagType }
      }
    }
  }
}
`;

interface ArticleNode {
  title?: string;
  upvoteCount?: number;
  tags?: { name?: string; nameTranslated?: string; tagType?: string }[];
}

interface Record_ {
  _key: string;
  _error?: string;
  total?: number;
  articles?: { t: string; v: number; g: string[] }[];
}

export async function run(options: { workers?: number; per?: number } = {}): Promise<void> {
  const { workers = 6, per = 15 } = options;

  const fetchOne = async (slug: string): Promise<Record_> => {
    const data = await graphql<{
      questionSolutionArticles: { totalNum?: number; edges?: { node?: ArticleNode }[] };
    }>(ENDPOINT, QUERY, {
      questionSlug: slug, skip: 0, first: per, orderBy: "DEFAULT",
      userInput: "", tagSlugs: [], searchScope: "CONTENT",
    }, {
      operation: "questionTopicsList",
      referer: `https://leetcode.cn/problems/${slug}/solutions/`,
    });
    const box = data.questionSolutionArticles;
    const articles = (box.edges ?? []).map((edge) => {
      const node = edge.node ?? {};
      const topics = (node.tags ?? [])
        .filter((t) => t.tagType !== "LANGUAGE")
        .map((t) => t.nameTranslated || t.name || "")
        .filter(Boolean);
      return { t: (node.title ?? "").trim(), v: node.upvoteCount ?? 0, g: topics };
    });
    return { _key: slug, total: box.totalNum ?? 0, articles };
  };

  const problems = loadJson<ListItem[]>(join(rawDir(), "leetcode_list.json"));
  const out = join(rawDir(), "solutions.jsonl");
  const records = await fetchMany(problems.map((p) => p.titleSlug), fetchOne, out,
    { workers, label: "solutions" });
  const failed = records.filter((r) => r._error).map((r) => r._key);
  const empty = records.filter((r) => !r._error && !(r.articles ?? []).length).length;
  process.stdout.write(
    `[solutions] 完成 ${records.length} 题，失败 ${failed.length}，没有题解 ${empty}\n`);
  if (failed.length) process.stdout.write(`[solutions] 失败样例: ${failed.slice(0, 8).join(", ")}\n`);
}
