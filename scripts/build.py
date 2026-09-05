"""把抓来的原始数据加工成站点直接消费的 JSON：打标、算相似度、生成学习计划。

用法：./sinan sync --skip-fetch
输入：cli/data/raw/*     输出：cli/data/dist/*
"""

from __future__ import annotations

import json
import math
import re
import time
from collections import Counter, defaultdict

import taxonomy as tx
import approach as ap
import codeprint as cp
import statement as stm
from curated import build_curated
from common import DIST_DIR, RAW_DIR, dump_json, load_json, read_jsonl
from extra_sources import load_extra_sources

DIFF_ORDER = {"EASY": 0, "MEDIUM": 1, "HARD": 2}
DIFF_CN = {"EASY": "简单", "MEDIUM": "中等", "HARD": "困难"}

# LeetCode 题面里有大量 <p>&nbsp;</p> 占位，直接渲染会撑出很多空行
BLANK_P = re.compile(r"<p>(?:&nbsp;|\s|<br\s*/?>)*</p>")


def clean_html(html: str) -> str:
    return BLANK_P.sub("", html).strip()


# --- 载入原始数据 --------------------------------------------------------------

def load_sources() -> tuple[list[dict], dict[str, dict], dict[str, dict], dict[str, dict], dict[str, dict]]:
    problems = load_json(RAW_DIR / "leetcode_list.json")
    details = {r["_key"]: r for r in read_jsonl(RAW_DIR / "leetcode_detail.jsonl") if not r.get("_error")}
    codetop_path = RAW_DIR / "codetop.json"
    codetop = {}
    if codetop_path.exists():
        codetop = {r["slug"]: r for r in load_json(codetop_path)["items"]}
    sol_path = RAW_DIR / "solutions.jsonl"
    solutions = {r["_key"]: r for r in read_jsonl(sol_path) if not r.get("_error")} if sol_path.exists() else {}
    code_path = RAW_DIR / "solution_code.jsonl"
    codes = {r["_key"]: r for r in read_jsonl(code_path) if not r.get("_error")} if code_path.exists() else {}
    return problems, details, codetop, solutions, codes


# --- 题目系列（打家劫舍 I/II/III 这种） -----------------------------------------

SERIES_TAIL = re.compile(r"[\sⅠⅡⅢⅣⅤⅥⅦ]*\s(I{1,3}|IV|V|VI{0,2}|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ)$")
SERIES_DASH = re.compile(r"\s*[-—–]\s*.*$")
SERIES_PREFIX = re.compile(r"^\s*[\[【][^\]】]*[\]】]\s*")  # 洛谷的「[NOIP 2002 普及组]」前缀


def series_key(title: str, source: str = "") -> str:
    """题目系列（打家劫舍 I/II/III 这种）。

    必须按来源分域：力扣的「两数之和」和洛谷的「两数之和」标题一样，但完全是两道题
    （洛谷 P1286 是给出所有两两和反推原数）。不分域会让它们被当成同一系列，
    白送一份 +0.12 的相似度加成。
    """
    base = SERIES_PREFIX.sub("", title)
    base = SERIES_DASH.sub("", base)
    base = SERIES_TAIL.sub("", base)
    base = base.strip()
    return f"{source}:{base}" if source else base


# --- 相似度 --------------------------------------------------------------------

def char_bigrams(title: str) -> set[str]:
    clean = re.sub(r"[\s，。、（）()【】\[\]]", "", title)
    return {clean[i:i + 2] for i in range(len(clean) - 1)} or {clean}


def build_similarity(items: list[dict], details: dict[str, dict]) -> dict[str, list[dict]]:
    """相似度 = 题解思路为主，标签只作辅助。

    权重分配的道理：标签说不出「前序还是层序」「用哪个定理」，所以真正决定
    两道题能不能互相替代的是从题解里提取的思路指纹。标签保留一点权重是因为它
    能兜住题解噪音，但绝不允许仅凭标签相同就把两道题判成相似——
    思路完全不重合且不是官方相似题的一对，分数会被封顶到代表阈值以下。
    """
    n = len(items)
    by_slug = {p["slug"]: p for p in items}

    # 标签词表（辅助信号）
    def tokens(p: dict) -> list[str]:
        return p["rawTags"] + [f"sub:{t}" for t in p["tagIds"]]

    df = Counter(tag for p in items for tag in tokens(p))
    idf = {t: math.log(n / (1 + c)) + 1.0 for t, c in df.items()}

    vec: dict[str, dict[str, float]] = {}
    for p in items:
        raw = {t: idf[t] for t in tokens(p)}
        norm = math.sqrt(sum(v * v for v in raw.values())) or 1.0
        vec[p["slug"]] = {t: v / norm for t, v in raw.items()}

    # 思路指纹词表（主信号）
    ap_df = Counter(a for p in items for a in p["approachIds"])
    ap_idf = {a: math.log(n / (1 + c)) + 1.0 for a, c in ap_df.items()}
    ap_vec = {p["slug"]: ap.vector(p["approach"], ap_idf) for p in items}
    fp_by_slug = {p["slug"]: p["approach"] for p in items}

    grams: dict[str, set[str]] = {p["slug"]: char_bigrams(p["title"]) for p in items}

    # 倒排索引产候选：跳过覆盖面过大的标签，避免 O(n²)
    tag_index: dict[str, list[str]] = defaultdict(list)
    for p in items:
        for t in tokens(p):
            if df[t] <= 320:
                tag_index[t].append(p["slug"])
    ap_index: dict[str, list[str]] = defaultdict(list)
    for p in items:
        for a in p["approachIds"]:
            if ap_df[a] <= 900:          # 思路标签比题目标签集中，阈值放宽一些
                ap_index[a].append(p["slug"])
    gram_index: dict[str, list[str]] = defaultdict(list)
    gram_df = Counter(g for gs in grams.values() for g in gs)
    for slug, gs in grams.items():
        for g in gs:
            if gram_df[g] <= 60:
                gram_index[g].append(slug)

    official: dict[str, set[str]] = defaultdict(set)
    for slug, det in details.items():
        for sim in det.get("similar") or []:
            other = sim.get("titleSlug")
            if other and other in by_slug and slug in by_slug:
                official[slug].add(other)
                official[other].add(slug)

    series: dict[str, list[str]] = defaultdict(list)
    for p in items:
        series[p["seriesKey"]].append(p["slug"])

    out: dict[str, list[dict]] = {}
    for p in items:
        slug = p["slug"]
        cands: set[str] = set(official[slug])
        cands.update(series.get(p["seriesKey"], ()))
        for a in p["approachIds"]:
            cands.update(ap_index.get(a, ()))
        for t in p["rawTags"]:
            cands.update(tag_index.get(t, ()))
        for g in grams[slug]:
            cands.update(gram_index.get(g, ()))
        cands.discard(slug)

        pv, pg, pav = vec[slug], grams[slug], ap_vec[slug]
        pfp = fp_by_slug[slug]
        p_main_ap = pfp[0]["id"] if pfp else ""
        p_guessed = bool(pfp) and pfp[0].get("from") == "tags"
        scored: list[tuple[float, str, list[str]]] = []
        for other in cands:
            q = by_slug[other]
            qv = vec[other]
            if len(qv) < len(pv):
                tag_cos = sum(w * pv.get(t, 0.0) for t, w in qv.items())
            else:
                tag_cos = sum(w * qv.get(t, 0.0) for t, w in pv.items())
            qav = ap_vec[other]
            if len(qav) < len(pav):
                ap_cos = sum(w * pav.get(a, 0.0) for a, w in qav.items())
            else:
                ap_cos = sum(w * qav.get(a, 0.0) for a, w in pav.items())
            qfp = fp_by_slug[other]
            ap_ov = ap.overlap(pfp, qfp)
            og = grams[other]
            title_sim = len(pg & og) / max(len(pg | og), 1)
            is_official = 1.0 if other in official[slug] else 0.0
            q_main_ap = qfp[0]["id"] if qfp else ""
            # 主思路相同才加分，且泛化思路（递归、模拟、公式推导）几乎不给分
            same_main = 0.0
            if p_main_ap and p_main_ap == q_main_ap:
                same_main = min(1.0, max(0.0, (ap.BY_ID[p_main_ap].weight - 0.8) / 1.7))

            score = (0.30 * is_official + 0.34 * ap_cos + 0.14 * ap_ov + 0.10 * same_main
                     + 0.08 * tag_cos + 0.04 * title_sim)

            # 思路毫无重合、又没有官方背书 → 封顶到代表阈值以下，禁止互相替代
            if ap_ov <= 0.0 and not is_official:
                score = min(score, 0.20)
            # 指纹是从标签猜的（没抓到题解）→ 打折，别把猜测当事实
            if p_guessed or (qfp and qfp[0].get("from") == "tags"):
                score *= 0.85

            if score < 0.18:
                continue
            why = []
            if is_official:
                why.append("官方相似题")
            if q["seriesKey"] == p["seriesKey"]:
                why.append("同一系列")
                score += 0.12
            shared = [a["name"] for a in pfp
                      if any(b["id"] == a["id"] for b in qfp)][:2]
            if shared:
                why.append("同为 " + "、".join(shared))
            if ap_ov >= 0.55:
                why.append(f"思路重合 {ap_ov*100:.0f}%")
            if not shared and tag_cos > 0.6:
                why.append("仅标签接近")
            scored.append((round(min(score, 1.0), 4), other, why))

        scored.sort(key=lambda x: -x[0])
        out[slug] = [{"slug": s, "score": sc, "why": why} for sc, s, why in scored[:12]]
    return out


# --- 学习价值打分 --------------------------------------------------------------

def value_score(p: dict, max_freq: int) -> float:
    """练习价值。

    刻意不用「题解数量」——题解多只说明题目老、看的人多，不代表值得刷；
    真正的信号是面试频次、是否经典题号、以及通过率是否落在有区分度的区间。
    """
    freq = math.log1p(p["freq"]) / math.log1p(max_freq) if max_freq else 0.0
    classic = 1.0 / (1.0 + int(p["id"]) / 600.0) if p["id"].isdigit() else 0.3
    ac = p["acRate"]
    sweet = 1.0 - abs(ac - 0.5) * 1.4  # 通过率太高太低的题教学价值都一般
    return round(0.54 * freq + 0.28 * classic + 0.18 * max(sweet, 0.0), 4)


# --- 主流程 --------------------------------------------------------------------

def main() -> None:
    raw, details, codetop, solutions, codes = load_sources()
    max_freq = max((r["freq"] for r in codetop.values()), default=0)
    # 先把每题的题解代码读成「思路 -> 证据强度」，打标和指纹都用它
    spec_of = {a.id: a.weight for a in ap.APPROACHES}
    code_ev: dict[str, dict[str, float]] = {}
    for slug, rec in codes.items():
        ev = cp.analyze_blocks(rec.get("blocks") or [])
        if ev:
            code_ev[slug] = ev
    # 再自己读一遍题面：问法 + 数据范围 + 输入结构，推出该用什么解法（带理由）
    stmt_ev: dict[str, dict[str, dict]] = {}
    for p in raw:
        det = details.get(p["titleSlug"])
        if not det or not det.get("content"):
            continue
        got = stm.analyze(p.get("titleCn") or p.get("title") or "", det["content"])
        if got:
            stmt_ev[p["titleSlug"]] = got

    unmapped: Counter[str] = Counter()
    items: list[dict] = []
    for p in raw:
        slug = p["titleSlug"]
        det = details.get(slug, {})
        title = p.get("titleCn") or p.get("title") or ""
        tags = [t["slug"] for t in p["topicTags"]]
        tag_names = {t["slug"]: (t.get("nameTranslated") or t["name"]) for t in p["topicTags"]}
        for t in tags:
            if t not in tx.TAG_MAP:
                unmapped[t] += 1
        ev = code_ev.get(slug, {})
        sev = stmt_ev.get(slug, {})
        sev_flat = {aid: v["s"] for aid, v in sev.items()}
        main, tag_list = tx.tag_problem(tags, title, p["frontendQuestionId"], tag_names,
                                        seeds=cp.tag_seeds(ev, spec_of)
                                        + cp.tag_seeds(sev_flat, spec_of, src="题面推理", scale=0.85))
        tag_ids = [t["id"] for t in tag_list]
        cats = list(dict.fromkeys(tx.SUB_TO_CAT[t] for t in tag_ids))
        ct = codetop.get(slug)
        item = {
            "id": p["frontendQuestionId"],
            "slug": slug,
            "title": title,
            "titleEn": p.get("title") or "",
            "difficulty": p["difficulty"],
            "difficultyCn": DIFF_CN.get(p["difficulty"], p["difficulty"]),
            "acRate": round(p.get("acRate") or 0.0, 4),
            "paid": bool(p.get("paidOnly")),
            "solutionCount": p.get("solutionNum") or 0,   # 只做展示，不参与任何打分
            "rawTags": tags,
            "tagNames": [t.get("nameTranslated") or t["name"] for t in p["topicTags"]],
            # 多标签：一题多解就会有多个标签，w 是可信度，src 说明这个标签怎么来的
            "tags": [{"id": t["id"], "name": tx.SUB_BY_ID[t["id"]].name, "cat": tx.SUB_TO_CAT[t["id"]],
                      "w": t["w"], "src": t["src"]} for t in tag_list],
            "tagIds": tag_ids,
            "mainTag": main,
            "mainTagName": tx.SUB_BY_ID[main].name,
            "mainCat": tx.SUB_TO_CAT[main],
            "cats": cats,
            "catSpan": len(cats),
            "freq": ct["freq"] if ct else 0,
            "freqRank": ct["rank"] if ct else 0,
            "hasContent": bool(det.get("content")),
            "category": det.get("category") or "Algorithms",
            "seriesKey": series_key(title, "leetcode"),
            "source": "leetcode",
            "sourceName": "LeetCode",
            "url": f"https://leetcode.cn/problems/{slug}/",
        }
        articles = (solutions.get(slug) or {}).get("articles") or []
        fp = ap.fingerprint(articles, tag_ids, ev, sev_flat)
        item["approach"] = fp
        item["approachIds"] = [a["id"] for a in fp]
        item["mainApproach"] = fp[0]["name"] if fp else ""
        item["approachFrom"] = fp[0]["from"] if fp else "none"
        item["solutionSampled"] = len(articles)
        item["codeBlocks"] = len((codes.get(slug) or {}).get("blocks") or [])
        # 「凭什么这么判」要能当场翻出来，否则打标就是黑箱
        item["approachWhy"] = {aid: v["why"][:3] for aid, v in sev.items()
                               if aid in set(item["approachIds"])}
        item["value"] = value_score(item, max_freq)
        items.append(item)

    # 并入其它题源（洛谷 / 牛客 / 自建题单），走同一套打标规则
    for extra in load_extra_sources(RAW_DIR):
        main, tag_list = tx.tag_problem(extra["rawTags"], extra["title"],
                                        seeds=extra.pop("subHits", []))
        tag_ids = [t["id"] for t in tag_list]
        cats = list(dict.fromkeys(tx.SUB_TO_CAT[t] for t in tag_ids))
        item = {
            **extra,
            "difficultyCn": DIFF_CN.get(extra["difficulty"], extra["difficulty"]),
            "paid": False,
            "solutionCount": 0,
            "tags": [{"id": t["id"], "name": tx.SUB_BY_ID[t["id"]].name, "cat": tx.SUB_TO_CAT[t["id"]],
                      "w": t["w"], "src": t["src"]} for t in tag_list],
            "tagIds": tag_ids,
            "mainTag": main,
            "mainTagName": tx.SUB_BY_ID[main].name,
            "mainCat": tx.SUB_TO_CAT[main],
            "cats": cats,
            "catSpan": len(cats),
            "freq": 0,
            "freqRank": 0,
            "hasContent": False,
            "category": "Algorithms",
            "seriesKey": series_key(extra["title"], extra.get("source", "extra")),
        }
        fp = ap.fingerprint([], tag_ids)
        item["approach"] = fp
        item["approachIds"] = [a["id"] for a in fp]
        item["mainApproach"] = fp[0]["name"] if fp else ""
        item["approachFrom"] = fp[0]["from"] if fp else "none"
        item["solutionSampled"] = 0
        item["codeBlocks"] = 0
        item["value"] = value_score(item, max_freq)
        items.append(item)

    # 多标签口径：一道题打了几个标签就在几个标签下各记一次
    sub_counts = Counter(t for p in items for t in p["tagIds"])
    cat_counts = Counter(c for p in items for c in p["cats"])
    sub_main = Counter(p["mainTag"] for p in items)
    cat_main = Counter(p["mainCat"] for p in items)
    multi = sum(1 for p in items if p["catSpan"] >= 3)
    from_code = sum(1 for p in items if "code" in p["approachFrom"])
    from_stmt = sum(1 for p in items if "statement" in p["approachFrom"])
    cross = sum(1 for p in items if "code" in p["approachFrom"] and "statement" in p["approachFrom"])
    with_fp = sum(1 for p in items if p["approachFrom"] == "solutions")
    with_code = sum(1 for p in items if p.get("codeBlocks"))
    avg_fp = sum(len(p["approachIds"]) for p in items) / len(items)

    avg_tags = sum(len(p["tagIds"]) for p in items) / len(items)
    print(f"[build] 题目 {len(items)}，CodeTop 高频 {sum(1 for p in items if p['freq'])} 题，"
          f"平均 {avg_tags:.2f} 个解法标签，跨 3 个以上大类的一题多解 {multi} 题")
    print(f"[build] 证据来源：{from_code} 题主要思路由题解代码判定，{from_stmt} 题由题面推理判定，"
          f"其中 {cross} 题两者互相印证；仅靠题解文字 {with_fp} 题")
    if unmapped:
        print(f"[build] 未映射标签 {len(unmapped)}: {unmapped.most_common(8)}")
    print("[build] 大类打标量:", ", ".join(f"{tx.CAT_BY_ID[c].name}={n}" for c, n in cat_counts.most_common()))
    thin = [s for s in tx.SUB_BY_ID if sub_counts[s] < 12]
    if thin:
        print("[build] 题量偏少的子类:", ", ".join(f"{tx.SUB_BY_ID[s].name}={sub_counts[s]}" for s in thin))

    similar = build_similarity(items, details)
    print(f"[build] 相似度：平均每题 {sum(len(v) for v in similar.values()) / len(items):.1f} 个邻居")

    raw_curated = []
    curated_path = RAW_DIR / "curated.json"
    if curated_path.exists():
        raw_curated = load_json(curated_path).get("lists", [])
    curated = build_curated(items, raw_curated)
    print(f"[build] 特殊题单 {len(curated)} 份，"
          f"共收录 {len({s for l in curated for s in l['slugs']})} 道题")

    tree = tx.export()
    for cat in tree:
        cat["count"] = cat_counts.get(cat["id"], 0)
        cat["main"] = cat_main.get(cat["id"], 0)
        for sub in cat["subs"]:
            sub["count"] = sub_counts.get(sub["id"], 0)
            sub["main"] = sub_main.get(sub["id"], 0)

    dump_json(DIST_DIR / "taxonomy.json", tree, compact=True)
    dump_json(DIST_DIR / "problems.json", items, compact=True)
    dump_json(DIST_DIR / "similar.json", similar, compact=True)
    dump_json(DIST_DIR / "curated.json", curated, compact=True)

    # 题面单独存成可随机读取的一行一题，前端按需取
    index: dict[str, list[int]] = {}
    content_path = DIST_DIR / "content.jsonl"
    with content_path.open("w", encoding="utf-8") as fh:
        offset = 0
        for p in items:
            html = (details.get(p["slug"], {}) or {}).get("content") or ""
            if not html:
                continue
            line = json.dumps({"slug": p["slug"], "html": clean_html(html)}, ensure_ascii=False) + "\n"
            data = line.encode("utf-8")
            index[p["slug"]] = [offset, len(data)]
            fh.write(line)
            offset += len(data)
    dump_json(DIST_DIR / "content_index.json", index, compact=True)

    # 「题目来源」和「标注来源」是两件事，不能并成一张表：
    # 题目来源互斥、加起来等于总题量；CodeTop 和各种题单只是**标注在力扣题上**的，
    # 混在一起列会让 4430 + 1128 + 2000 看着像 7558 道题。
    SOURCE_HOME = {"leetcode": ("LeetCode 中国站", "https://leetcode.cn/problemset/")}
    source_rows = []
    for src in dict.fromkeys(p["source"] for p in items):
        rows = [p for p in items if p["source"] == src]
        name, home = SOURCE_HOME.get(src, (rows[0]["sourceName"], ""))
        source_rows.append({"id": src, "name": name, "count": len(rows),
                            "url": home or rows[0].get("sourceHome") or ""})
    listed = {s for lst in curated for s in lst.get("slugs", ())}
    overlay_rows = [
        {"id": "codetop", "name": "CodeTop 面试频次",
         "count": sum(1 for p in items if p["freq"]),
         "note": "标注在力扣题上，不是独立题源", "url": "https://codetop.cc/home"},
        {"id": "curated", "name": f"特殊题单 {len(curated)} 份",
         "count": len(listed), "note": "力扣官方学习计划 / CodeTop 榜单 / LCR 等，全部是力扣题",
         "url": "https://leetcode.cn/studyplan/"},
    ]

    dump_json(DIST_DIR / "meta.json", {
        "builtAt": time.strftime("%Y-%m-%d %H:%M"),
        "sources": source_rows,
        "overlays": overlay_rows,
        "stats": {
            "total": len(items),
            "free": sum(1 for p in items if not p["paid"]),
            "withContent": len(index),
            "avgTags": round(avg_tags, 2),
            "multiApproach": multi,
            "withApproach": with_fp + from_code,
            "withCode": with_code,
            "approachFromCode": from_code,
            "approachFromStatement": from_stmt,
            "approachCrossChecked": cross,
            "avgApproaches": round(avg_fp, 2),
            "difficulty": dict(Counter(p["difficultyCn"] for p in items)),
            "cats": {c: n for c, n in cat_counts.items()},
            "subs": dict(sub_counts),
        },
    })


if __name__ == "__main__":
    main()
