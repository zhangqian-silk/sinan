"""抓每道题的社区题解（标题 + 题解自带的算法标签 + 点赞数）。

用法：python3 cli/fetch_solutions.py [--workers 6] [--per 15]
产物：cli/data/raw/solutions.jsonl（可中断续跑）

为什么要抓这个：题目标签只能说明「这题和树有关」，说不出「这题是中序遍历还是层序遍历」。
而题解标题里写得很清楚——「迭代法」「Morris 遍历」「埃氏筛」「贪心 + dfs」「记忆化搜索」，
题解自己还带算法标签。这些才是判断两道题是否真的相似的依据。
"""

from __future__ import annotations

import argparse

from common import RAW_DIR, fetch_many, graphql, load_json

ENDPOINT = "https://leetcode.cn/graphql/"
OUT = RAW_DIR / "solutions.jsonl"
LIST_PATH = RAW_DIR / "leetcode_list.json"

QUERY = """
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
"""

PER_PAGE = 15


def fetch_one(slug: str) -> dict:
    data = graphql(ENDPOINT, QUERY, {
        "questionSlug": slug, "skip": 0, "first": PER_PAGE, "orderBy": "DEFAULT",
        "userInput": "", "tagSlugs": [], "searchScope": "CONTENT",
    }, operation="questionTopicsList",
        referer=f"https://leetcode.cn/problems/{slug}/solutions/")["questionSolutionArticles"]

    articles = []
    for edge in data.get("edges") or []:
        node = edge.get("node") or {}
        topics = [t.get("nameTranslated") or t.get("name") or ""
                  for t in (node.get("tags") or []) if t.get("tagType") != "LANGUAGE"]
        articles.append({
            "t": (node.get("title") or "").strip(),
            "v": node.get("upvoteCount") or 0,
            "g": [x for x in topics if x],
        })
    return {"_key": slug, "total": data.get("totalNum") or 0, "articles": articles}


def main() -> None:
    global PER_PAGE
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--per", type=int, default=PER_PAGE)
    args = ap.parse_args()
    PER_PAGE = args.per

    problems = load_json(LIST_PATH)
    slugs = [p["titleSlug"] for p in problems]
    records = fetch_many(slugs, fetch_one, OUT, workers=args.workers, label="solutions")
    failed = [r["_key"] for r in records if r.get("_error")]
    empty = sum(1 for r in records if not r.get("_error") and not r.get("articles"))
    print(f"[solutions] 完成 {len(records)} 题，失败 {len(failed)}，没有题解 {empty}", flush=True)
    if failed:
        print("[solutions] 失败样例:", failed[:8], flush=True)


if __name__ == "__main__":
    main()
