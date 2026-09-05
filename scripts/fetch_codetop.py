"""抓取 CodeTop 的大厂面试高频榜（约 1155 题，按被面到的次数排序）。

用法：python3 cli/fetch_codetop.py
"""

from __future__ import annotations

import time

from common import RAW_DIR, dump_json, http_json

API = "https://codetop.cc/api/questions/"
OUT = RAW_DIR / "codetop.json"


def main() -> None:
    rows: list[dict] = []
    seen: set[str] = set()
    page = 1
    total = None
    while total is None or len(rows) < total:
        data = http_json(f"{API}?page={page}&pageSize=100", headers={"Referer": "https://codetop.cc/home"})
        total = data["count"]
        batch = data.get("list") or []
        if not batch:
            break
        for item in batch:
            lc = item.get("leetcode") or {}
            slug = lc.get("slug_title")
            if not slug or slug in seen:
                continue
            seen.add(slug)
            rows.append({
                "slug": slug,
                "id": str(lc.get("frontend_question_id") or ""),
                "title": lc.get("title") or "",
                "freq": item.get("value") or 0,
                "level": lc.get("level"),
            })
        print(f"[codetop] {len(rows)}/{total}", flush=True)
        page += 1
        time.sleep(0.15)

    rows.sort(key=lambda r: -r["freq"])
    for rank, row in enumerate(rows, 1):
        row["rank"] = rank
    dump_json(OUT, {"total": total, "fetched_at": time.strftime("%Y-%m-%d"), "items": rows})


if __name__ == "__main__":
    main()
