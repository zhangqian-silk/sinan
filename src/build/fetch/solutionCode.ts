/**
 * 抓题解正文里的**代码**。
 *
 * 和 solutions.ts 的区别：那个只拿标题和标签（「题解怎么说」），
 * 这个拿代码块（「题解怎么写」）。判断一道树题是前序还是后序，只有代码说得准。
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
    edges { node { title upvoteCount content } }
  }
}
`;

/** 围栏形如 ```Python3 [sol1-Python3] 或 ```C++ [] 或 ```python */
const FENCE = /```([A-Za-z0-9+#]*)[^\n]*\n([\s\S]*?)```/g;

const LANG_CANON: Record<string, string> = {
  python: "python", python3: "python", py: "python", py3: "python",
  java: "java", "c++": "cpp", cpp: "cpp", cxx: "cpp", c: "c",
  go: "go", golang: "go", javascript: "js", js: "js", typescript: "ts",
  rust: "rust", kotlin: "kotlin", csharp: "csharp", "c#": "csharp",
};
/** 按可分析程度排优先级：Python 的缩进结构最好还原 */
const LANG_RANK: Record<string, number> = {
  python: 0, java: 1, cpp: 2, go: 3, c: 4, js: 5, ts: 6,
};

const MAX_CODE = 3600;   // 单块代码截断长度，足够看清结构
const MAX_BLOCKS = 8;    // 每题最多留几块
const PER_LANG = 4;      // 同一语言最多留几块：一篇好题解常有「记忆化 / 二维 / 压成一维」多个版本
const MIN_CODE = 60;     // 太短的（伪代码、片段）不要

export function extractBlocks(content: string): { lang: string; code: string }[] {
  const out: { lang: string; code: string }[] = [];
  const rx = new RegExp(FENCE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(content || "")) !== null) {
    const lang = LANG_CANON[(m[1] ?? "").trim().toLowerCase()] ?? "";
    const code = (m[2] ?? "").trim();
    if (!lang || code.length < MIN_CODE) continue;
    // 伪代码（中文标识符占比高）直接丢
    let cjk = 0;
    for (const ch of code) if (ch >= "\u4e00" && ch <= "\u9fff") cjk += 1;
    if (cjk > code.length * 0.12) continue;
    out.push({ lang, code: code.slice(0, MAX_CODE) });
  }
  return out;
}

interface Block { lang: string; code: string; v: number; t: string }
interface Record_ { _key: string; _error?: string; blocks?: Block[] }

export async function run(options: { workers?: number; per?: number } = {}): Promise<void> {
  const { workers = 6, per = 5 } = options;

  const fetchOne = async (slug: string): Promise<Record_> => {
    const data = await graphql<{
      questionSolutionArticles: {
        edges?: { node?: { title?: string; upvoteCount?: number; content?: string } }[];
      };
    }>(ENDPOINT, QUERY, {
      questionSlug: slug, skip: 0, first: per, orderBy: "DEFAULT",
      userInput: "", tagSlugs: [], searchScope: "CONTENT",
    }, {
      operation: "questionTopicsList",
      referer: `https://leetcode.cn/problems/${slug}/solutions/`,
    });

    const picked: Block[] = [];
    for (const edge of data.questionSolutionArticles.edges ?? []) {
      const node = edge.node ?? {};
      for (const block of extractBlocks(node.content ?? "")) {
        picked.push({ ...block, v: node.upvoteCount ?? 0, t: (node.title ?? "").slice(0, 60) });
      }
    }
    // 点赞高的、语言好分析的优先；同一语言留够块数，才能看到「二维推完再压成一维」这类变体
    picked.sort((a, b) => ((LANG_RANK[a.lang] ?? 9) - (LANG_RANK[b.lang] ?? 9)) || (b.v - a.v));
    const seen = new Map<string, number>();
    const out: Block[] = [];
    for (const b of picked) {
      if ((seen.get(b.lang) ?? 0) >= PER_LANG) continue;
      seen.set(b.lang, (seen.get(b.lang) ?? 0) + 1);
      out.push(b);
      if (out.length >= MAX_BLOCKS) break;
    }
    return { _key: slug, blocks: out };
  };

  const problems = loadJson<ListItem[]>(join(rawDir(), "leetcode_list.json"));
  const out = join(rawDir(), "solution_code.jsonl");
  const records = await fetchMany(problems.map((p) => p.titleSlug), fetchOne, out,
    { workers, label: "code" });
  const failed = records.filter((r) => r._error).length;
  const empty = records.filter((r) => !r._error && !(r.blocks ?? []).length).length;
  const langs = new Map<string, number>();
  for (const r of records) {
    for (const b of r.blocks ?? []) langs.set(b.lang, (langs.get(b.lang) ?? 0) + 1);
  }
  const dist = [...langs.entries()].sort((a, b) => b[1] - a[1]);
  process.stdout.write(`[code] 完成 ${records.length} 题，失败 ${failed}，没抓到代码 ${empty}\n`);
  process.stdout.write(`[code] 代码块语言分布：${dist.map(([k, v]) => `${k}=${v}`).join(", ")}\n`);
}
