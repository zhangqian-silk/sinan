"""抓题解正文里的**代码**。

用法：python3 cli/fetch_solution_code.py [--workers 6] [--per 5]
产物：cli/data/raw/solution_code.jsonl（可中断续跑）

和 fetch_solutions.py 的区别：那个只拿标题和标签（"题解怎么说"），
这个拿代码块（"题解怎么写"）。判断一道树题是前序还是后序，只有代码说得准。
"""

from __future__ import annotations

import argparse
import re

from common import RAW_DIR, fetch_many, graphql, load_json

ENDPOINT = "https://leetcode.cn/graphql/"
OUT = RAW_DIR / "solution_code.jsonl"
LIST_PATH = RAW_DIR / "leetcode_list.json"

QUERY = """
query questionTopicsList($questionSlug: String!, $skip: Int, $first: Int,
                         $orderBy: SolutionArticleOrderBy, $userInput: String,
                         $tagSlugs: [String!], $searchScope: SolutionSearchScopeEnum) {
  questionSolutionArticles(questionSlug: $questionSlug, skip: $skip, first: $first,
                           orderBy: $orderBy, userInput: $userInput,
                           tagSlugs: $tagSlugs, searchScope: $searchScope) {
    edges { node { title upvoteCount content } }
  }
}
"""

# 围栏形如 ```Python3 [sol1-Python3] 或 ```C++ [] 或 ```python
FENCE = re.compile(r"```([A-Za-z0-9+#]*)[^\n]*\n(.*?)```", re.S)

LANG_CANON = {
    "python": "python", "python3": "python", "py": "python", "py3": "python",
    "java": "java", "c++": "cpp", "cpp": "cpp", "cxx": "cpp", "c": "c",
    "go": "go", "golang": "go", "javascript": "js", "js": "js", "typescript": "ts",
    "rust": "rust", "kotlin": "kotlin", "csharp": "csharp", "c#": "csharp",
}
# 按可分析程度排优先级：Python 能走 AST，最准
LANG_RANK = {"python": 0, "java": 1, "cpp": 2, "go": 3, "c": 4, "js": 5, "ts": 6}

MAX_CODE = 3600          # 单块代码截断长度，足够看清结构
MAX_BLOCKS = 8           # 每题最多留几块
PER_LANG = 4             # 同一语言最多留几块：一篇好题解常有「记忆化 / 二维 / 压成一维」多个版本
MIN_CODE = 60            # 太短的（伪代码、片段）不要
PER_PAGE = 5


def extract_blocks(content: str) -> list[dict]:
    out: list[dict] = []
    for raw_lang, code in FENCE.findall(content or ""):
        lang = LANG_CANON.get(raw_lang.strip().lower(), "")
        code = code.strip()
        if not lang or len(code) < MIN_CODE:
            continue
        # 伪代码（中文标识符占比高）直接丢
        cjk = sum(1 for ch in code if "\u4e00" <= ch <= "\u9fff")
        if cjk > len(code) * 0.12:
            continue
        out.append({"lang": lang, "code": code[:MAX_CODE]})
    return out


def fetch_one(slug: str) -> dict:
    data = graphql(ENDPOINT, QUERY, {
        "questionSlug": slug, "skip": 0, "first": PER_PAGE, "orderBy": "DEFAULT",
        "userInput": "", "tagSlugs": [], "searchScope": "CONTENT",
    }, operation="questionTopicsList",
        referer=f"https://leetcode.cn/problems/{slug}/solutions/")["questionSolutionArticles"]

    picked: list[dict] = []
    for edge in data.get("edges") or []:
        node = edge.get("node") or {}
        for block in extract_blocks(node.get("content") or ""):
            picked.append({**block, "v": node.get("upvoteCount") or 0,
                           "t": (node.get("title") or "")[:60]})

    # 点赞高的、语言好分析的优先；同一语言留够块数，才能看到「二维推完再压成一维」这类变体
    picked.sort(key=lambda b: (LANG_RANK.get(b["lang"], 9), -b["v"]))
    seen: dict[str, int] = {}
    out: list[dict] = []
    for b in picked:
        if seen.get(b["lang"], 0) >= PER_LANG:
            continue
        seen[b["lang"]] = seen.get(b["lang"], 0) + 1
        out.append(b)
        if len(out) >= MAX_BLOCKS:
            break
    return {"_key": slug, "blocks": out}


def main() -> None:
    global PER_PAGE
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--per", type=int, default=PER_PAGE)
    args = ap.parse_args()
    PER_PAGE = args.per

    slugs = [p["titleSlug"] for p in load_json(LIST_PATH)]
    records = fetch_many(slugs, fetch_one, OUT, workers=args.workers, label="code")
    failed = [r["_key"] for r in records if r.get("_error")]
    empty = sum(1 for r in records if not r.get("_error") and not r.get("blocks"))
    langs: dict[str, int] = {}
    for r in records:
        for b in r.get("blocks") or []:
            langs[b["lang"]] = langs.get(b["lang"], 0) + 1
    print(f"[code] 完成 {len(records)} 题，失败 {len(failed)}，没抓到代码 {empty}", flush=True)
    print(f"[code] 代码块语言分布：{dict(sorted(langs.items(), key=lambda kv: -kv[1]))}", flush=True)


if __name__ == "__main__":
    main()
