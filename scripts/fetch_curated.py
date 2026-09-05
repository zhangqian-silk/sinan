"""抓取「特殊题单」：力扣官方学习计划 + CodeTop 分公司高频榜。

用法：python3 cli/fetch_curated.py
产物：cli/data/raw/curated.json

官方学习计划自带知识点分组（热题 100 分成 哈希/双指针/滑动窗口…），
这个分组会被保留下来，学习计划生成时可以和我们自己的标签互相印证。
"""

from __future__ import annotations

import time

from common import RAW_DIR, dump_json, graphql, http_json

LC_ENDPOINT = "https://leetcode.cn/graphql/"
OUT = RAW_DIR / "curated.json"

# 已验证存在的官方学习计划；写不存在的 slug 也没关系，会被跳过。
STUDY_PLANS: tuple[str, ...] = (
    "top-100-liked",          # LeetCode 热题 100
    "top-interview-150",      # 面试经典 150 题
    "leetcode-75",            # LeetCode 75
    "programming-skills",     # 编程基础 0 到 1
    "dynamic-programming",    # 动态规划（基础版）
    "dynamic-programming-grandmaster",  # 动态规划（进阶版）
    "graph-theory",           # 图论 · 从入门到精通
    "binary-search",          # 二分查找 · 系统掌握
    "premium-algo-100",       # 尊享面试 100 题
    "sql-free-50",            # 高频 SQL 50 题
    "top-sql-50",
    "30-days-of-javascript",
    "introduction-to-pandas",
)

PLAN_QUERY = """
query studyPlanV2Detail($planSlug: String!) {
  studyPlanV2Detail(planSlug: $planSlug) {
    slug
    name
    description
    questionNum
    planSubGroups {
      slug
      name
      questionNum
      questions { titleSlug questionFrontendId }
    }
  }
}
"""

CODETOP_API = "https://codetop.cc/api"
CODETOP_REFERER = "https://codetop.cc/home"
COMPANY_LIMIT = 12      # 只取最主要的几家，避免请求量失控
COMPANY_PAGES = 5       # 每家取前 100 题（每页 20）


def fetch_study_plan(slug: str) -> dict | None:
    data = graphql(LC_ENDPOINT, PLAN_QUERY, {"planSlug": slug},
                   operation="studyPlanV2Detail", referer=f"https://leetcode.cn/studyplan/{slug}/")
    plan = data.get("studyPlanV2Detail")
    if not plan:
        return None
    # 会员专享计划（动态规划进阶版、尊享面试 100）拿不到题目明细，直接跳过
    if not plan.get("planSubGroups"):
        return None

    groups = []
    slugs: list[str] = []
    for group in plan.get("planSubGroups") or []:
        members = [q["titleSlug"] for q in (group.get("questions") or [])]
        slugs.extend(members)
        if members:
            groups.append({"name": group["name"], "slugs": members})
    return {
        "id": f"lc:{plan['slug']}",
        "name": plan["name"],
        "desc": (plan.get("description") or "").replace("\r\n", " ").strip()[:160],
        "source": "leetcode",
        "kind": "official",
        "url": f"https://leetcode.cn/studyplan/{plan['slug']}/",
        "declaredNum": plan.get("questionNum") or 0,
        "groups": groups,
        "slugs": list(dict.fromkeys(slugs)),
    }


def fetch_company_lists() -> list[dict]:
    companies = http_json(f"{CODETOP_API}/companies/", headers={"Referer": CODETOP_REFERER})
    out: list[dict] = []
    for company in companies[:COMPANY_LIMIT]:
        cid, name = company["id"], company["name"]
        rows: list[tuple[str, int]] = []
        total = None
        for page in range(1, COMPANY_PAGES + 1):
            data = http_json(f"{CODETOP_API}/questions/?page={page}&company={cid}",
                             headers={"Referer": CODETOP_REFERER})
            total = data.get("count")
            batch = data.get("list") or []
            if not batch:
                break
            for item in batch:
                slug = (item.get("leetcode") or {}).get("slug_title")
                if slug:
                    rows.append((slug, item.get("value") or 0))
            time.sleep(0.12)
        if not rows:
            continue
        seen: dict[str, int] = {}
        for slug, freq in rows:
            seen[slug] = max(seen.get(slug, 0), freq)
        out.append({
            "id": f"codetop:{cid}",
            "name": f"CodeTop · {name}",
            "desc": f"{name}面试出现频率最高的 {len(seen)} 题（该公司题库共 {total} 题）",
            "source": "codetop",
            "kind": "company",
            "url": "https://codetop.cc/home",
            "declaredNum": total or len(seen),
            "groups": [],
            "slugs": list(seen),
            "freq": seen,
        })
        print(f"[codetop] {name}: 取前 {len(seen)} 题（共 {total}）", flush=True)
    return out


def main() -> None:
    lists: list[dict] = []

    for slug in STUDY_PLANS:
        try:
            plan = fetch_study_plan(slug)
        except Exception as err:
            print(f"[plan] {slug} 抓取失败：{str(err)[:80]}", flush=True)
            continue
        if not plan:
            print(f"[plan] {slug} 不存在，跳过", flush=True)
            continue
        lists.append(plan)
        print(f"[plan] {plan['name']}：{len(plan['slugs'])} 题 / {len(plan['groups'])} 个知识点分组", flush=True)
        time.sleep(0.2)

    try:
        lists.extend(fetch_company_lists())
    except Exception as err:
        print(f"[codetop] 公司榜抓取失败：{str(err)[:120]}", flush=True)

    dump_json(OUT, {"fetchedAt": time.strftime("%Y-%m-%d"), "lists": lists})


if __name__ == "__main__":
    main()
