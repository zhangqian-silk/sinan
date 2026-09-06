/** 题库查询与题目详情。 */

import { existsSync } from "node:fs";

import type { Args } from "../args.js";
import { CliError } from "../errors.js";
import { out } from "../out.js";
import * as r from "../render.js";
import { DIFF_CN, type Store } from "../store.js";
import type { Problem } from "../types.js";
import { fixed, pyFloat, pyRound, splitLines } from "../util.js";
import { MISSING, needSync } from "./hint.js";

interface RowsSpec {
  showLists?: boolean;
  showApproach?: boolean;
  showUrl?: boolean;
}

export function problemRows(
  store: Store,
  items: readonly Problem[],
  spec: RowsSpec = {},
): { headers: string[]; rows: string[][]; aligns: ("left" | "right")[] } {
  const { showLists = false, showApproach = false, showUrl = false } = spec;
  const col = showApproach ? "题解思路" : "解法标签";
  // 基线数据里没有高频和通过率，整列都是「—」「0%」，不如不显示
  const rich = !store.baseline;
  const headers = ["", "题号", "标题", "难度", col];
  const aligns: ("left" | "right")[] = ["left", "right", "left", "left", "left"];
  if (rich) { headers.push("高频", "通过率"); aligns.push("right", "right"); }
  if (showLists) { headers.push("题单"); aligns.push("left"); }
  if (showUrl) { headers.push("平台链接"); aligns.push("left"); }

  const limit = Math.max(18, r.termWidth() - 62);
  const rows: string[][] = [];
  for (const p of items) {
    const row = [
      r.mark(store, p),
      r.paint(String(p.id), "gray"),
      r.hyperlink(r.trunc(p.title, limit), p.url ?? ""),
      r.diffTag(p),
      showApproach ? r.approachChips(p) : r.tagChips(p),
    ];
    if (rich) {
      row.push(r.hotCell(p), `${fixed(p.acRate * 100, 0)}%`);
    }
    if (showLists) {
      const names = store.listNamesOf(p);
      row.push(r.paint(names.length ? r.trunc(names.join("、"), 26) : "—", "gray"));
    }
    if (showUrl) row.push(r.paint(p.url ?? "", "gray"));
    rows.push(row);
  }
  return { headers, rows, aligns };
}

export function resolveProblem(store: Store, key: string): Problem | null {
  const low = key.trim().toLowerCase();
  const byId = store.byId.get(low);
  if (byId) return byId;
  const bySlug = store.bySlug.get(low);
  if (bySlug) return bySlug;
  for (const p of store.problems) {
    if (p.title.toLowerCase().includes(low) || p.slug.includes(low)) return p;
  }
  return null;
}

export function cmdList(store: Store, args: Args): void {
  const diffs = new Set<string>();
  for (const token of (args["diff"] as string[] | undefined) ?? []) {
    for (const [key, cn] of Object.entries(DIFF_CN)) {
      if ([key.toLowerCase(), cn, key[0].toLowerCase()].includes(token)) diffs.add(key);
    }
  }
  const query = ((args["query"] as string[] | undefined) ?? []).join(" ");
  const items = store.query({
    text: query,
    cat: (args["cat"] as string) || "",
    tag: (args["tag"] as string) || "",
    diffs: diffs.size ? diffs : null,
    hot: Boolean(args["hot"]),
    todo: Boolean(args["todo"]),
    mine: Boolean(args["mine"]),
    multi: Boolean(args["multi"]),
    source: (args["source"] as string) || "",
    includePaid: Boolean(args["paid"]),
    inList: (args["inList"] as string) || "",
    approach: (args["approach"] as string) || "",
    sort: (args["sort"] as string) || "id",
  });
  const limit = args["limit"] as number;
  const shown = items.slice(0, limit);
  // 标签用中文名显示，深到第几层都认；`--tag math-sieve` 要写成「质数与筛法」
  const named = (id: string): string => store.nodeById.get(id)?.name
    ?? store.catById.get(id)?.name ?? store.topics().get(id)?.name ?? id;
  const tagArg = args["tag"] as string;
  const catArg = args["cat"] as string;
  const label = (args["approach"] as string) || (tagArg && named(tagArg))
    || (catArg && named(catArg)) || (args["inList"] as string) || query || "全部题目";
  out("", r.heading(`题库 · ${label}`, `命中 ${items.length} 题，显示 ${shown.length}`), "");
  const { headers, rows, aligns } = problemRows(store, shown, {
    showLists: Boolean(args["withLists"]),
    showApproach: Boolean(args["approach"]) || Boolean(args["byApproach"]),
    showUrl: Boolean(args["links"]),
  });
  out(r.table(headers, rows, aligns));
  if (items.length > shown.length) {
    out("", r.paint(`  还有 ${items.length - shown.length} 题，用 --limit 调整`, "gray"));
  } else {
    out("", r.paint("  标题在支持的终端里可以直接点开；加 --links 显示完整链接", "gray"));
  }
  out("");
}

const CHANNEL_SHORT: Record<string, string> = {
  code: "代码", statement: "题面", solutions: "题解", tags: "标签",
};

export function cmdShow(store: Store, args: Args): void {
  const key = args["key"] as string;
  const p = resolveProblem(store, key);
  if (!p) throw new CliError(`没找到题目：${key}`);

  const head = store.baseline
    ? `${DIFF_CN[p.difficulty]} · ${p.sourceName}`
    : `${DIFF_CN[p.difficulty]} · 通过率 ${fixed(p.acRate * 100, 0)}% · ${p.sourceName}`;
  out("", r.heading(`#${p.id}  ${r.hyperlink(p.title, p.url ?? "")}`, head));
  const meta: string[] = [];
  if (p.freq) meta.push(r.paint(`CodeTop 第 ${p.freqRank} 名 · 被面 ${p.freq} 次`, "orange"));
  if (p.paid) meta.push(r.paint("会员题", "gray"));
  const files = store.filesOf(p);
  if (files.length) {
    meta.push(r.paint(`已有本地题解 ${files.map((f) => f.path).join("、")}`, "green"));
  } else if (store.isChecked(p)) {
    meta.push(r.paint("已打卡", "green"));
  }
  const lists = store.listNamesOf(p);
  if (lists.length) {
    const head = lists.slice(0, 4).join("、");
    const tail = lists.length > 4 ? ` 等 ${lists.length} 个题单` : "";
    meta.push(r.paint(`收录于 ${head}${tail}`, "amber"));
  }
  if (meta.length) out(`  ${meta.join("\n  ")}`);
  out(`  ${r.paint("平台链接", "gray")} ${r.hyperlink(p.url, p.url)}`);

  out("", r.rule(`解法标签  ${p.tags.length} 个，跨 ${p.catSpan} 个大类`));
  for (const t of p.tags) {
    const catName = store.catById.get(t.cat)?.name ?? t.cat;
    out(`  ${r.pad(r.paint(t.name, r.CAT_COLOR[t.cat] ?? "steel"), 22)}`
      + `${r.pad(r.paint(catName, "gray"), 16)}`
      + `${r.paint(`可信度 ${t.w}`, "gray")}  `
      + `${r.paint(`来源：${t.src.join("、")}`, "gray")}`);
  }
  if (p.tagNames.length) {
    out(`  ${r.paint(`原始标签：${p.tagNames.join("、")}`, "gray")}`);
  }

  const fp = p.approach ?? [];
  if (fp.length) {
    const blocks = p.codeBlocks ?? 0;
    const bits: string[] = [];
    if (blocks) bits.push(`读了 ${blocks} 段题解代码`);
    if (p.approachWhy && Object.keys(p.approachWhy).length) bits.push("自己读了题面和数据范围");
    if (p.solutionSampled) bits.push(`参考 ${p.solutionSampled} 篇题解的说法`);
    const note = bits.length ? bits.join("，") : "没抓到题解也没有题面，只能由官方标签推断（可信度低）";
    out("", r.rule(`题解思路  ${note}`));
    for (const a of fp) {
      const aSrc = a.from ?? "tags";
      const chans = aSrc.split("+");
      const barColor = aSrc.includes("code") ? "lime" : (aSrc === "solutions" ? "steel" : "gray");
      const bar = r.bar(pyRound(a.conf * 20), 20, 12, barColor);
      let hits = chans.map((c) => CHANNEL_SHORT[c] ?? c).join("+");
      if (chans.length > 1) hits += " 印证";
      const share = `${fixed(a.conf * 100, 0)}%`;
      out(`  ${r.pad(r.paint(a.name, a === fp[0] ? "amber" : "steel"), 22)}`
        + `${bar} ${r.pad(share, 5, "right")}  `
        + `${r.pad(r.paint(hits, "gray"), 23)}`
        + `${r.paint(`区分度 ${pyFloat(a.w)}`, "gray")}`);
    }
    // 题面读出来的结论，把「凭什么」也摊开 —— 打标不能是黑箱
    const why = p.approachWhy ?? {};
    const whyEntries = Object.entries(why);
    if (whyEntries.length) {
      out("", r.rule("我为什么这么判（读题面 + 数据范围）"));
      const names = new Map(fp.map((a) => [a.id, a.name]));
      for (const [aid, reasons] of whyEntries.slice(0, 5)) {
        out(`  ${r.paint(names.get(aid) ?? aid, "amber")}`);
        for (const line of reasons) out(`    ${r.paint(`· ${line}`, "gray")}`);
      }
    }
  }

  const sims = (store.similar()[p.slug] ?? []).slice(0, args["similar"] as number);
  if (sims.length) {
    out("", r.rule("相似题  以题解思路为主，官方相似题为锚"));
    const rows: string[][] = [];
    for (const s of sims) {
      const q = store.bySlug.get(s.slug);
      if (!q) continue;
      rows.push([
        r.mark(store, q), r.paint(String(q.id), "gray"),
        r.trunc(q.title, 32), r.diffTag(q),
        fixed(s.score * 100, 0), r.paint(s.why.join("、"), "gray"),
      ]);
    }
    out(r.table(["", "题号", "标题", "难度", "相似", "命中信号"], rows,
      ["left", "right", "left", "left", "right", "left"]));
  }

  if (!args["noContent"]) {
    const html = store.content(p.slug);
    if (html) {
      const text = r.htmlToText(html, Math.min(96, r.termWidth() - 4));
      const lines = splitLines(text);
      const keep = args["full"] ? lines : lines.slice(0, 26);
      out("", r.rule("题面"));
      out(keep.map((ln) => `  ${ln}`).join("\n"));
      if (lines.length > keep.length) {
        out(r.paint(`  …（还有 ${lines.length - keep.length} 行，加 --full 看全部）`, "gray"));
      }
    }
  }

  if (files.length && args["code"]) {
    for (const f of files) {
      if (!existsSync(f.abs)) continue;
      const source = store.readSolution(f);
      out("", r.rule(`我的题解  ${f.path}`));
      out(splitLines(source).map((ln) => `  ${ln}`).join("\n"));
    }
  } else if (files.length) {
    out("", r.paint(`  本地题解：${files.map((f) => f.path).join("、")}（加 --code 打印源码）`, "gray"));
  }
  if (store.baseline) {
    out("");
    out(needSync(`${MISSING.content}与${MISSING.freq}`));
  }
  out("");
}
