/** 概览、标签体系、题单、思路词表、题库统计。 */

import type { Args } from "../args.js";
import { CliError } from "../errors.js";
import { out, pct, PROG } from "../out.js";
import * as planner from "../planner.js";
import * as r from "../render.js";
import type { Store } from "../store.js";
import { pyFloat, sortBy } from "../util.js";
import { baselineFooter, MISSING, needSync } from "./hint.js";

export function cmdHome(store: Store, _args: Args): void {
  const free = store.problems.filter((p) => !p.paid);
  const [done, total] = store.progressOf(free);
  const hot = store.problems.filter((p) => p.freq);
  const [hotDone, hotTotal] = store.progressOf(hot);
  const touched = new Set<string>();
  for (const p of store.problems) {
    if (store.isDone(p)) for (const t of p.tagIds) touched.add(t);
  }
  const tagsTouched = touched.size;

  out("", r.heading("刷题训练台", `数据 ${store.meta.builtAt} · `
    + `${store.meta.sources.map((s) => s.name).join(" + ")}`), "");
  out(`  已刷      ${r.bar(done, total)} ${done}/${total} 免费题 (${pct(done, total)})`);
  if (!store.baseline) {
    out(`  高频命中  ${r.bar(hotDone, hotTotal, 18, "orange")} ${hotDone}/${hotTotal} CodeTop (${pct(hotDone, hotTotal)})`);
  }
  out(`  覆盖标签  ${r.bar(tagsTouched, store.subById.size, 18, "teal")} `
    + `${tagsTouched}/${store.subById.size} 个子标签`);
  out("");

  out(r.rule("知识刻度  多标签口径，一题多解会计入多个大类"));
  const rows: string[][] = [];
  for (const cat of store.cats) {
    const members = store.problems.filter((p) => p.cats.includes(cat.id));
    const [cdone, ctotal] = store.progressOf(members);
    rows.push([
      r.paint(cat.name, r.CAT_COLOR[cat.id] ?? "steel"),
      `${cdone}/${ctotal}`,
      r.bar(cdone, ctotal, 14, r.CAT_COLOR[cat.id] ?? "amber"),
      r.paint(`${cat.subs.length} 个标签`, "gray"),
    ]);
  }
  out(r.table(["大类", "进度", "", "子标签"], rows, ["left", "right", "left", "left"]));
  out("");

  const picks = planner.nextSteps(store, 3);
  if (picks.length) {
    out(r.rule("下一步  取自最薄弱专题的代表题"));
    picks.forEach(([topicName, step], i) => {
      out(`  ${i + 1}. ${r.paint(topicName, "amber")}  `
        + `${r.paint(`#${step.p.id}`, "gray")} ${step.p.title}  `
        + `${r.diffTag(step.p)}  ${r.paint(step.reasons.slice(0, 2).join(" · "), "gray")}`);
    });
    out("");
  }

  if (store.baseline) {
    out(...baselineFooter());
    out("");
    out(r.paint("  {PROG} topics | {PROG} learn <专题> | {PROG} plan <专题> | {PROG} list --tag <标签>", "gray"), "");
    return;
  }
  out(r.rule("特殊题单  {PROG} lists 看全部"));
  for (const lst of store.curated.slice(0, 6)) {
    const topic = store.topics().get(lst.id)!;
    const members = store.members(topic);
    const [ldone, ltotal] = store.progressOf(members);
    out(`  ${r.pad(r.trunc(lst.name, 24), 26)} ${r.bar(ldone, ltotal, 12)} `
      + `${r.pad(`${ldone}/${ltotal}`, 8, "right")}  ${r.paint(lst.id, "gray")}`);
  }
  out("");
  out(r.paint("  {PROG} topics | {PROG} lists | {PROG} plan <专题> | {PROG} next | {PROG} list --hot", "gray"), "");
}

export function cmdTopics(store: Store, args: Args): void {
  const wanted = args["cat"] as string | undefined;
  let cats = store.cats;
  if (wanted) {
    cats = cats.filter((c) => c.id === wanted || c.name === wanted);
    if (!cats.length) throw new CliError(`没有这个大类：${wanted}`);
  }

  out("", r.heading("标签体系", `${store.cats.length} 个大类 / ${store.subById.size} 个子标签 · `
    + "一题多解会打多个标签，各标签题量之和大于题库总数"));
  out(r.paint("  每个大类和子标签都有讲解：{PROG} learn <id>（核心思想 / 模板 / 常见坑 / OI-Wiki）", "gray"));
  for (const cat of cats) {
    const members = store.problems.filter((p) => p.cats.includes(cat.id));
    const [cdone, ctotal] = store.progressOf(members);
    const color = r.CAT_COLOR[cat.id] ?? "steel";
    out("");
    out(`${r.paint("▌", color)}${r.paint(cat.name, "bold")}  `
      + `${r.paint(`${cdone}/${ctotal}`, "gray")}  ${r.paint(cat.id, "gray")}`);
    out(`  ${r.paint(cat.desc, "gray")}`);
    const rows: string[][] = [];
    for (const sub of cat.subs) {
      const subMembers = store.problems.filter((p) => p.tagIds.includes(sub.id));
      const [sdone, stotal] = store.progressOf(subMembers);
      rows.push([
        `  ${r.paint(sub.name, color)}`,
        r.paint(sub.id, "gray"),
        `${sdone}/${stotal}`,
        r.bar(sdone, stotal, 10, color),
        r.paint(r.trunc(sub.desc, Math.max(20, r.termWidth() - 76)), "gray"),
      ]);
    }
    out(r.table(["  子标签", `${PROG} learn`, "进度", "", "说明"], rows,
      ["left", "left", "right", "left", "left"]));
  }
  out("");
}

const KIND_CN: Record<string, string> = {
  official: "力扣官方", hot: "高频榜", company: "公司榜",
  series: "系列题库", special: "精选",
};

export function cmdLists(store: Store, _args: Args): void {
  if (store.baseline) {
    out("", r.heading("特殊题单", "力扣官方学习计划 / CodeTop 公司榜"), "");
    out(needSync(MISSING.lists));
    out(r.paint("  题单是平台自己挑选与编排的内容，不随包分发；抓下来之后这里会列出全部。", "gray"), "");
    return;
  }
  out("", r.heading("特殊题单", `${store.curated.length} 份 · `
    + `${PROG} plan <题单id> 生成按知识点递进的计划`));
  const groups = new Map<string, typeof store.curated>();
  for (const lst of store.curated) {
    const bucket = groups.get(lst.kind) ?? [];
    bucket.push(lst);
    groups.set(lst.kind, bucket);
  }

  for (const kind of ["official", "hot", "company", "series", "special"]) {
    const bucket = groups.get(kind);
    if (!bucket) continue;
    out("");
    out(r.rule(KIND_CN[kind] ?? kind));
    const rows: string[][] = [];
    for (const lst of bucket) {
      const members = store.members(store.topics().get(lst.id)!);
      const [ldone, ltotal] = store.progressOf(members);
      const d = lst.stats.difficulty;
      rows.push([
        r.paint(lst.id, "gray"),
        r.trunc(lst.name, 26),
        `${lst.stats.resolved}`,
        r.bar(ldone, ltotal, 10),
        `${ldone}/${ltotal}`,
        `${r.paint(String(d["简单"] ?? 0), "green")}/${r.paint(String(d["中等"] ?? 0), "amber")}/${r.paint(String(d["困难"] ?? 0), "red")}`,
        r.paint(`热${lst.stats.hot}`, "orange"),
      ]);
    }
    out(r.table(["题单 id", "名称", "题数", "进度", "", "易/中/难", "高频"], rows,
      ["left", "left", "right", "left", "right", "left", "right"]));
  }
  out("");
}

export const DOMAIN_CN: Record<string, string> = {
  tree: "树", graph: "图论", dp: "动态规划", math: "数学",
  ds: "数据结构与技巧", string: "字符串", search: "搜索",
  greedy: "贪心", list: "链表", other: "其它",
};

export function cmdApproaches(store: Store, args: Args): void {
  let stats = store.approachStats();
  const domain = args["domain"] as string | undefined;
  if (domain) {
    stats = stats.filter((s) => s.domain === domain || DOMAIN_CN[s.domain] === domain);
  }
  const meta = store.meta.stats;
  out("", r.heading("题解思路词表",
    `${stats.length} 种思路 · ${meta.withApproach ?? 0} 道题的思路直接来自社区题解，`
    + `平均 ${meta.avgApproaches ?? 0} 种/题`));

  const byDomain = new Map<string, typeof stats>();
  for (const s of stats) {
    const bucket = byDomain.get(s.domain) ?? [];
    bucket.push(s);
    byDomain.set(s.domain, bucket);
  }
  for (const [dom, rowsIn] of byDomain) {
    out("");
    out(r.rule(DOMAIN_CN[dom] ?? dom));
    const rows = rowsIn.map((s) => [
      r.paint(s.name, r.DOMAIN_COLOR[dom] ?? "steel"),
      String(s.total),
      r.paint(String(s.real), "gray"),
      `${s.done}/${s.total}`,
      r.bar(s.done, s.total, 10),
      s.hot ? r.paint(`热${s.hot}`, "orange") : r.paint("—", "gray"),
      r.paint(`区分度 ${pyFloat(s.w)}`, "gray"),
    ]);
    out(r.table(["思路", "题数", "题解实证", "进度", "", "高频", ""], rows,
      ["left", "right", "right", "right", "left", "right", "left"]));
  }
  out("");
  out(r.paint("  {PROG} list --approach 中序遍历 看具体题目；{PROG} plan <专题> 会按思路递进排序", "gray"), "");
}

export function cmdStats(store: Store, _args: Args): void {
  const stats = store.meta.stats;
  out("", r.heading("题库统计", `构建于 ${store.meta.builtAt}`), "");
  if (store.baseline) {
    out(`  题目总数 ${stats.total}    随包的精简题库（无题面 / 无高频 / 无题单）`);
  } else {
    out(`  题目总数 ${stats.total}    免费 ${stats.free}    有题面 ${stats.withContent}`);
  }
  out(`  平均解法标签 ${stats.avgTags} 个/题    一题多解（跨 3 大类）${stats.multiApproach} 题`);
  out(`  平均 ${stats.avgApproaches ?? 0} 种解法思路/题（{PROG} approaches 看词表）`);
  out(`  证据来源  ${stats.approachFromCode ?? 0} 题读题解代码判定，`
    + `${stats.approachFromStatement ?? 0} 题读题面与数据范围推断，`
    + `其中 ${stats.approachCrossChecked ?? 0} 题两者互相印证`);
  if (!store.baseline) {
    out(`            抓到题解代码的题 ${stats.withCode ?? 0} 道，`
      + `只能靠题解文字的 ${(stats.withApproach ?? 0) - (stats.approachFromCode ?? 0)} 道`);
  }
  out("");
  out(r.rule("题目来源  互斥，加起来等于总题量"));
  for (const s of store.meta.sources) {
    out(`  ${r.pad(s.name, 22)}${r.pad(String(s.count), 8, "right")}  ${r.paint(s.url ?? "", "gray")}`);
  }
  const overlays = store.meta.overlays ?? [];
  if (overlays.length) {
    out("");
    out(r.rule("标注来源  叠加在题目上的信息，不是独立题源"));
    for (const s of overlays) {
      out(`  ${r.pad(s.name, 22)}${r.pad(`${s.count} 题`, 8, "right")}  `
        + `${r.paint(s.note ?? "", "gray")}`);
    }
  }
  out("");
  out(r.rule("难度"));
  for (const [name, n] of Object.entries(stats.difficulty)) {
    out(`  ${r.pad(name, 8)}${r.pad(String(n), 6, "right")}  ${r.bar(n, stats.total, 30)}`);
  }
  out("");
  out(r.rule("子标签题量 Top 15  多标签口径"));
  const rows: string[][] = [];
  const top = sortBy(Object.entries(stats.subs), ([, n]) => [-n]).slice(0, 15);
  for (const [tag, n] of top) {
    const sub = store.subById.get(tag);
    if (!sub) continue;
    const members = store.problems.filter((p) => p.tagIds.includes(tag));
    const [sdone, stotal] = store.progressOf(members);
    rows.push([
      r.paint(sub.name, r.CAT_COLOR[sub.cat] ?? "steel"),
      r.paint(sub.catName, "gray"),
      String(n),
      `${sdone}/${stotal}`,
      r.bar(sdone, stotal, 12),
    ]);
  }
  out(r.table(["子标签", "大类", "题量", "进度", ""], rows,
    ["left", "left", "right", "right", "left"]));
  if (store.baseline) {
    out("");
    out(...baselineFooter());
  }
  out("");
}
