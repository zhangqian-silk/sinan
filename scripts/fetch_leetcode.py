"""抓取 leetcode.cn 全量题库：题目列表 + 每题详情（官方相似题、题面）。

用法：python3 cli/fetch_leetcode.py [--workers 6] [--no-detail]
抓取结果写入 cli/data/raw/，可中断续跑。
"""

from __future__ import annotations

import argparse
import json
import time

from common import RAW_DIR, dump_json, fetch_many, graphql, read_jsonl

ENDPOINT = "https://leetcode.cn/graphql/"
REFERER = "https://leetcode.cn/problemset/"

LIST_QUERY = """
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
"""

DETAIL_QUERY = """
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
"""

LIST_PATH = RAW_DIR / "leetcode_list.json"
DETAIL_PATH = RAW_DIR / "leetcode_detail.jsonl"


def fetch_list(page_size: int = 100) -> list[dict]:
    """按页拉全量题目列表。"""
    out: list[dict] = []
    skip = 0
    total = None
    while total is None or skip < total:
        data = graphql(
            ENDPOINT,
            LIST_QUERY,
            {"categorySlug": "all-code-essentials", "limit": page_size, "skip": skip, "filters": {}},
            operation="problemsetQuestionList",
            referer=REFERER,
        )["problemsetQuestionList"]
        total = data["total"]
        batch = data["questions"]
        if not batch:
            break
        out.extend(batch)
        skip += len(batch)
        print(f"[list] {len(out)}/{total}", flush=True)
        time.sleep(0.15)
    return out


def fetch_detail(slug: str) -> dict:
    q = graphql(ENDPOINT, DETAIL_QUERY, {"titleSlug": slug}, operation="questionDetail",
                referer=f"https://leetcode.cn/problems/{slug}/")["question"]
    if q is None:
        return {"_key": slug, "_error": "question not found"}
    similar = q.get("similarQuestions")
    stats = q.get("stats")
    return {
        "_key": slug,
        "id": q.get("questionFrontendId"),
        "category": q.get("categoryTitle"),
        "paid": bool(q.get("isPaidOnly")),
        "hints": len(q.get("hints") or []),
        "similar": json.loads(similar) if similar else [],
        "stats": json.loads(stats) if stats else {},
        "content": q.get("translatedContent") or "",
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--no-detail", action="store_true")
    args = ap.parse_args()

    if not LIST_PATH.exists():
        dump_json(LIST_PATH, fetch_list())
    problems = json.loads(LIST_PATH.read_text(encoding="utf-8"))
    print(f"[list] 题目总数 {len(problems)}", flush=True)

    if args.no_detail:
        return

    slugs = [p["titleSlug"] for p in problems]
    records = fetch_many(slugs, fetch_detail, DETAIL_PATH, workers=args.workers, label="detail")
    failed = [r["_key"] for r in records if r.get("_error")]
    print(f"[detail] 完成 {len(records)} 条，失败 {len(failed)}", flush=True)
    if failed:
        print("[detail] 失败样例:", failed[:10], flush=True)


if __name__ == "__main__":
    main()
