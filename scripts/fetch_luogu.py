"""抓取洛谷题库（尽力而为）。

洛谷对无 Cookie 的请求会 302 挡掉。拿到浏览器里的 Cookie 后：

    LUOGU_COOKIE='__client_id=...; _uid=...' python3 cli/fetch_luogu.py

成功后写出 cli/data/raw/extra_luogu.json，下次 build.py 会自动并进题库。
抓不到时不会写脏数据，只提示原因。
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request

from common import RAW_DIR, UA, dump_json

LIST_URL = "https://www.luogu.com.cn/problem/list?_contentOnly=1&page={page}"
DIFF_MAP = {0: "MEDIUM", 1: "EASY", 2: "EASY", 3: "MEDIUM", 4: "MEDIUM",
            5: "HARD", 6: "HARD", 7: "HARD"}


def fetch_page(page: int, cookie: str) -> dict:
    req = urllib.request.Request(LIST_URL.format(page=page), headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "x-luogu-type": "content-only",
        "Cookie": cookie,
    })
    with urllib.request.urlopen(req, timeout=25) as resp:
        body = resp.read().decode("utf-8", "replace")
    if body.lstrip().startswith("<"):
        raise RuntimeError("返回的是 HTML，说明 Cookie 无效或被反爬拦截")
    return json.loads(body)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=40, help="每页 50 题")
    args = ap.parse_args()

    cookie = os.environ.get("LUOGU_COOKIE", "")
    items: list[dict] = []
    try:
        for page in range(1, args.pages + 1):
            data = fetch_page(page, cookie)
            batch = (data.get("currentData") or {}).get("problems", {}).get("result", [])
            if not batch:
                break
            for q in batch:
                items.append({
                    "id": q.get("pid"),
                    "title": q.get("title"),
                    "url": f"https://www.luogu.com.cn/problem/{q.get('pid')}",
                    "difficulty": DIFF_MAP.get(q.get("difficulty", 3), "MEDIUM"),
                    "tags": [str(t) for t in (q.get("tags") or [])],
                    "acRate": round((q.get("totalAccepted") or 0) / max(q.get("totalSubmit") or 1, 1), 4),
                })
            print(f"[luogu] {len(items)} 题", flush=True)
            time.sleep(0.4)
    except (urllib.error.URLError, RuntimeError, json.JSONDecodeError, TimeoutError) as err:
        print(f"[luogu] 抓取中断：{err}")
        if not items:
            print("[luogu] 没拿到数据，未写文件。设置 LUOGU_COOKIE 后重试，"
                  "或手动整理成 cli/data/raw/extra_luogu.json（格式见 extra_sources.py）")
            return

    dump_json(RAW_DIR / "extra_luogu.json", {
        "source": "luogu", "name": "洛谷",
        "home": "https://www.luogu.com.cn/problem/list",
        "items": items,
    })


if __name__ == "__main__":
    main()
