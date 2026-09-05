/** 学习计划：主线一览、展开计划、专题讲解、下一步、打卡。 */

import type { Args } from "../args.js";
import { CliError } from "../errors.js";
import * as notes from "../notes/index.js";
import { out, PROG } from "../out.js";
import * as planner from "../planner.js";
import * as r from "../render.js";
import type { Store, Topic } from "../store.js";
import { fixed, splitLines } from "../util.js";
import { resolveProblem } from "./query.js";

export function cmdRoutes(store: Store, _args: Args): void {
  out("", r.heading("学习计划", "少数几条跨专题的成体系路线 · {PROG} plan <id> 展开"), "");
  const rows: string[][] = [];
  for (const route of planner.ROUTES) {
    const plan = planner.planRoute(store, route);
    const steps = plan.steps;
    const done = steps.filter((s) => store.isDone(s.p)).length;
    const mix = plan.mix;
    rows.push([
      r.paint(route.id, "gray"),
      r.paint(route.name, "amber"),
      `${steps.length} 题`,
      `${plan.sections.filter((s) => s.steps.length).length} 个专题`,
      `${mix.get("简单")}/${mix.get("中等")}/${mix.get("困难")}`,
      `${fixed(plan.minutes / 60, 0)}h`,
      r.bar(done, steps.length, 10),
      `${done}/${steps.length}`,
      r.paint(r.trunc(route.tagline, 24), "gray"),
    ]);
  }
  out(r.table(["id", "名称", "题量", "跨专题", "易/中/难", "时长", "进度", "", "一句话"], rows,
    ["left", "left", "right", "right", "left", "right", "left", "right", "left"]));
  out("");
  out(r.paint("  这四条是「学习计划」。想练单个知识点或题单用 {PROG} plan <专题>，", "gray"));
  out(r.paint("  可选的专题有 13 个大类 / 65 个子标签 / 28 份题单，用 {PROG} topics、{PROG} lists 查。", "gray"), "");
}

const KIND_LABEL: Record<string, string> = { cat: "大类", tag: "子标签", list: "题单" };

export function cmdPlan(store: Store, args: Args): void {
  const key = args["topic"] as string;
  const route = planner.ROUTE_BY_ID.get(key);
  if (route) {
    const plan = planner.planRoute(store, route, Boolean(args["paid"]));
    renderPlan(store, plan, args, { kindCn: "主线路线", tagline: route.tagline, isRoute: true });
    return;
  }

  const topic = store.findTopic(key);
  if (!topic) {
    throw new CliError(`没有这个专题：${key}\n`
      + `主线用 ${PROG} routes 看；专题用 ${PROG} topics / ${PROG} lists 看`);
  }

  let mode = "auto";
  if (args["full"]) mode = "full";
  else if (args["minimal"]) mode = "minimal";
  const plan = planner.planTopic(store, topic, {
    mode,
    includePaid: Boolean(args["paid"]),
    source: (args["source"] as string) || "",
    maxSteps: (args["steps"] as number | undefined) ?? 0,
    quality: !args["all"],
    pace: args["pace"] as string,
  });
  if (!plan.steps.length) throw new CliError("这个专题下没有可练的题（试试 --paid 放开会员题）");
  renderPlan(store, plan, args, { kindCn: KIND_LABEL[topic.kind] ?? topic.kind });
}

/** 计划顶部的「开练前先看」：核心思想 + 识别信号 + 一条链接。全文用 {PROG} learn。 */
function renderNoteBrief(topicId: string): void {
  const note = notes.noteFor(topicId);
  const sigs = notes.signals(topicId);
  if (!note && !sigs.length) return;
  const width = Math.max(r.termWidth() - 6, 50);
  out("", r.rule(`开练前先看  完整讲解与模板：{PROG} learn ${topicId}`));
  if (note?.idea) {
    for (const line of r.wrap(r.stripEmph(note.idea), width)) out(`  ${line}`);
  }
  if (sigs.length) {
    out(`  ${r.paint("什么时候想到它：", "amber")}`);
    for (const s of sigs.slice(0, 3)) {
      r.wrap(s, width - 4).forEach((line, i) => {
        out(`    ${r.paint((i === 0 ? "· " : "  ") + line, "gray")}`);
      });
    }
  }
  if (note?.refs?.length) {
    const [title, url] = note.refs[0]!;
    out(`  ${r.paint("OI-Wiki：", "gray")}${r.hyperlink(title, url)}`
      + `${r.paint(`（共 ${note.refs.length} 篇，${PROG} learn 里全给）`, "gray")}`);
  }
}

interface RenderPlanOptions {
  kindCn: string;
  tagline?: string;
  isRoute?: boolean;
}

export function renderPlan(
  store: Store,
  plan: planner.Plan,
  args: Args,
  options: RenderPlanOptions,
): void {
  const { kindCn, tagline = "", isRoute = false } = options;
  const topic = plan.topic;
  const done = plan.steps.filter((s) => store.isDone(s.p)).length;
  const hours = plan.minutes / 60;
  const coreTotal = plan.steps.filter((s) => s.core).length;
  const liveMode = plan.steps.length < plan.poolSize ? "minimal" : "full";
  const liveSections = plan.sections.filter((s) => s.steps.length).length;

  out("", r.heading(`${topic.name} · 学习计划`,
    `${kindCn} · ${liveMode === "minimal" ? "最小覆盖" : "完整汇总"}`));
  if (tagline) out(`  ${r.paint(tagline, "amber")}`);
  if (topic.desc) out(`  ${r.paint(topic.desc, "gray")}`);

  let summary: string;
  if (liveMode === "minimal") {
    summary = `${plan.poolSize} 题池 → 挑 ${plan.steps.length} 道代表题`
      + `（覆盖 ${fixed(plan.coveragePct, 0)}%）· 预计 ${fixed(hours, 1)} 小时 · 已完成 ${done}/${plan.steps.length}`;
  } else {
    summary = `${plan.steps.length} 题，按 ${liveSections} 个知识点分组`
      + `（其中 ${coreTotal} 道 ★ 代表题）· 预计 ${fixed(hours, 1)} 小时 · 已完成 ${done}/${plan.steps.length}`;
  }
  if (isRoute) {
    // 主线不谈覆盖率 —— 它的目标是走完一条成体系的路，不是替代掉多少题
    summary = `${plan.steps.length} 题 · 跨 ${liveSections} 个专题`
      + ` · 预计 ${fixed(hours, 1)} 小时 · 已完成 ${done}/${plan.steps.length}`;
  }
  out(`  ${summary}`);

  const mix = plan.mix;
  const paceCn: Record<string, string> = { depth: "重攻坚", balanced: "均衡", coverage: "重覆盖" };
  out(`  ${r.paint("难度结构", "gray")} `
    + `${r.paint(`简单 ${mix.get("简单")}`, "green")} · `
    + `${r.paint(`中等 ${mix.get("中等")}`, "amber")} · `
    + `${r.paint(`困难 ${mix.get("困难")}`, "red")}`
    + `    ${r.paint("硬技巧", "gray")} ${plan.sharp.size} 个`
    + `    ${r.paint("节奏", "gray")} ${paceCn[plan.pace] ?? plan.pace}`);
  if (!isRoute && plan.totalPool > plan.poolSize) {
    out(`  ${r.paint(`题池取自 ${plan.totalPool} 道同标签题里有面试频次或题单背书的 ${plan.poolSize} 道`
      + "（--all 用全部）", "gray")}`);
  }
  const path = plan.sections.filter((sec) => sec.steps.length).map((sec) => sec.name).join(" → ");
  if (plan.sections.length > 1) {
    out(`  ${r.paint("知识点路径：", "gray")}${r.trunc(path, r.termWidth() - 16)}`);
  }

  if (!args["noNotes"]) renderNoteBrief(topic.id);

  const daySize = (args["day"] as number | undefined) ?? 0;
  let counter = 0;
  for (const sec of plan.sections) {
    if (!sec.steps.length) continue;
    const core = sec.steps.filter((s) => s.core).length;
    out("");
    const head = `${r.paint("▌", "amber")}${r.paint(sec.name, "bold")}`;
    let detail = `${sec.pool} 题池 → ${sec.steps.length} 步`;
    if (liveMode === "full" && core !== sec.steps.length) detail += `（其中 ${core} 道代表题）`;
    out(`${head}  ${r.paint(detail, "gray")}`);
    if (sec.desc) out(`  ${r.paint(r.trunc(sec.desc, r.termWidth() - 6), "gray")}`);
    // 跨专题的计划里，每节各有各的知识点，就地给一条讲解入口
    if (plan.sections.length > 1 && notes.hasNote(sec.key) && !args["noNotes"]) {
      out(`  ${r.paint(`讲解与模板：${PROG} learn ${sec.key}`, "steel")}`);
    }

    for (const step of sec.steps) {
      counter += 1;
      if (daySize && (counter - 1) % daySize === 0) {
        out(`  ${r.paint(`—— DAY ${Math.floor((counter - 1) / daySize) + 1} ${"─".repeat(30)}`, "gray")}`);
      }
      const p = step.p;
      const flag = r.mark(store, p);
      const coreMark = step.core && liveMode === "full" ? r.paint("★", "amber") : " ";
      out(`  ${r.pad(String(counter), 3, "right")}. ${flag}${coreMark} `
        + `${r.pad(r.paint(`#${p.id}`, "gray"), 11)}`
        + `${r.pad(r.hyperlink(r.trunc(p.title, 30), p.url ?? ""), 32)}`
        + `${r.pad(r.diffTag(p), 6)}`
        + `${r.paint(step.stage, "gray")}`);
      if (step.approaches.length) {
        const guessed = (p.approach ?? [])[0]?.from === "tags";
        const label = guessed ? "思路(推断)" : "思路";
        out(`        ${r.paint(label, "gray")} ${step.approaches.join("、")}`
          + (step.newApproaches.length
            ? `   ${r.paint("新增", "gray")} ${r.paint(step.newApproaches.join("、"), "lime")}`
            : ""));
      }
      out(`        ${r.paint("知识点", "gray")} ${step.focus.join("、")}`);
      out(`        ${r.paint("为什么", "gray")} ${step.reasons.join(" · ")}`);
      if (step.covers.length && !args["brief"]) {
        const names = step.covers.slice(0, 3).map((q) => `#${q.id} ${q.title}`).join("、");
        const tail = step.coversTotal > 3 ? r.paint(` 等 ${step.coversTotal} 道`, "gray") : "";
        out(`        ${r.paint("代表", "gray")} `
          + `${r.trunc(names, Math.max(30, r.termWidth() - 28))}${tail}`);
      }
    }
  }
  out("");
  if (isRoute) {
    out(r.paint("  这是一条主线；想单练某个知识点或题单：{PROG} plan <专题>"
      + "（专题 id 用 {PROG} topics / {PROG} lists 查）", "gray"));
  } else if (liveMode === "minimal") {
    out(r.paint(`  只列了代表题；看这个专题的全部 ${plan.poolSize} 题：${PROG} plan ${topic.id} --full`, "gray"));
  } else {
    out(r.paint(`  ★ 是最小覆盖集；只练代表题：${PROG} plan ${topic.id} --minimal`, "gray"));
  }
  out("");
}

/** 一个专题的完整讲解：核心思想、识别信号、模板、坑、复杂度、延伸阅读。 */
export function cmdLearn(store: Store, args: Args): void {
  const key = args["topic"] as string;
  const topic: Topic | null = store.findTopic(key);
  const note = notes.noteFor(key) ?? (topic ? notes.noteFor(topic.id) : null);
  const tid = topic ? topic.id : key;
  if (!note && !notes.signals(tid).length) {
    throw new CliError(`没有这个专题的讲解：${key}\n`
      + `用 ${PROG} topics 看可选的专题（13 个大类 / 65 个子标签都有）`);
  }
  const name = topic ? topic.name : tid;
  const width = Math.max(r.termWidth() - 6, 50);

  out("", r.heading(`${name} · 讲解`, "核心思想 / 识别信号 / 模板 / 坑 / 延伸阅读"));
  if (topic?.desc) out(`  ${r.paint(topic.desc, "gray")}`);
  if (topic && topic.kind !== "route") {
    const pool = store.members(topic);
    if (pool.length) {
      out(`  ${r.paint(`题池 ${pool.length} 道 · 练起来：${PROG} plan ${tid}`, "gray")}`);
    }
  }

  if (note?.idea) {
    out("", r.rule("核心思想"));
    for (const line of r.wrap(r.stripEmph(note.idea), width)) out(`  ${line}`);
  }

  const sigs = notes.signals(tid);
  if (sigs.length) {
    out("", r.rule("什么时候想到它  这几条也是打标时实际用的判断依据"));
    for (const s of sigs) {
      r.wrap(s, width - 4).forEach((line, i) => {
        out(`  ${r.paint((i === 0 ? "· " : "  ") + line, i === 0 ? "steel" : "gray")}`);
      });
    }
  }

  if (note?.template) {
    out("", r.rule("模板骨架"));
    for (const line of splitLines(note.template)) {
      out(`  ${line.trimStart().startsWith("#") ? r.paint(line, "lime") : line}`);
    }
  }

  if (note?.pitfalls?.length) {
    out("", r.rule("常见坑"));
    for (const pit of note.pitfalls) {
      r.wrap(r.stripEmph(pit), width - 4).forEach((line, i) => {
        out(`  ${r.paint((i === 0 ? "! " : "  ") + line, i === 0 ? "red" : "gray")}`);
      });
    }
  }

  if (note?.complexity) {
    out("", r.rule("复杂度"));
    out(`  ${note.complexity}`);
  }

  if (note?.refs?.length) {
    out("", r.rule("延伸阅读  OI-Wiki"));
    for (const [title, url] of note.refs) {
      out(`  ${r.pad(r.hyperlink(title, url), 26)}${r.paint(url, "gray")}`);
    }
  }
  out("");
}

export function cmdNext(store: Store, args: Args): void {
  const picks = planner.nextSteps(store, args["n"] as number);
  if (!picks.length) {
    throw new CliError(`没有可推荐的题，先跑 ${PROG} sync 看看数据是否完整`);
  }
  out("", r.heading("下一步", "按「高频题里还没刷的数量」找最该补的专题，各取一道代表题"), "");
  picks.forEach(([topicName, step], i) => {
    const p = step.p;
    out(`  ${i + 1}. ${r.paint(topicName, "amber")}   `
      + `${r.paint(`#${p.id}`, "gray")} `
      + `${r.hyperlink(p.title, p.url ?? "")}  ${r.diffTag(p)}`);
    if (step.approaches.length) {
      out(`     ${r.paint("思路", "gray")} ${step.approaches.join("、")}`);
    }
    out(`     ${r.paint("知识点", "gray")} ${step.focus.join("、")}`);
    out(`     ${r.paint("为什么", "gray")} ${step.reasons.join(" · ")}`);
    out(`     ${r.paint(p.url, "gray")}`);
    out("");
  });
}

export function cmdDone(store: Store, args: Args): void {
  for (const key of (args["keys"] as string[]) ?? []) {
    const p = resolveProblem(store, key);
    if (!p) {
      out(r.paint(`  没找到：${key}`, "red"));
      continue;
    }
    if (store.filesOf(p).length && !args["force"]) {
      out(r.paint(`  #${p.id} ${p.title} 已有本地题解，不需要打卡`, "gray"));
      continue;
    }
    const added = store.toggleCheckin(p, (args["note"] as string) || "");
    const state = added ? r.paint("已打卡", "green") : r.paint("取消打卡", "gray");
    out(`  ${state}  #${p.id} ${p.title}`);
  }
}
