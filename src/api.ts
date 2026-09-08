/**
 * Web 接口层：把 store / planner 的结果序列化成前端要的 JSON。
 *
 * 这里**不含任何 node 依赖** —— 本地 `sinan serve` 把它挂到 HTTP 上，
 * GitHub Pages 上的静态站把它当客户端路由直接调用。两边共用同一份逻辑，
 * 所以网页看到的和 `sinan plan` 算出来的完全一致。
 */

import * as notes from "./notes/index.js";
import * as planner from "./planner.js";
import { DIFF_CN, type Store } from "./store.js";
import type { Problem } from "./types.js";
import { pyRoundTo } from "./util.js";

export type Query = Record<string, string[]>;

// --- 序列化 -------------------------------------------------------------------

const LIST_FIELDS = [
  "id", "slug", "title", "difficulty", "difficultyCn", "acRate", "paid",
  "freq", "freqRank", "url", "source", "sourceName", "catSpan",
  "mainTag", "mainTagName", "mainCat", "value",
] as const;

function brief(st: Store, p: Problem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of LIST_FIELDS) out[k] = (p as unknown as Record<string, unknown>)[k] ?? null;
  out["tags"] = p.tags.map((t) => ({ id: t.id, name: t.name, cat: t.cat }));
  out["approach"] = (p.approach ?? []).map((a) => ({
    id: a.id, name: a.name, domain: a.domain, conf: a.conf, w: a.w, from: a.from,
  }));
  out["done"] = st.isDone(p);
  out["mine"] = st.filesOf(p).map((f) => f.path);
  out["lists"] = st.listNamesOf(p);
  return out;
}

function stepJson(st: Store, step: planner.Step): Record<string, unknown> {
  return {
    problem: brief(st, step.p),
    stage: step.stage,
    approaches: step.approaches,
    newApproaches: step.newApproaches,
    focus: step.focus,
    newPoints: step.newPoints,
    reasons: step.reasons,
    core: step.core,
    coversTotal: step.coversTotal,
    covers: step.covers.map((q) => ({ id: q.id, title: q.title, url: q.url })),
  };
}

/** 专题的教学卡片。`**强调**` 原样送到前端，由前端渲染成粗体。 */
function noteJson(topicId: string): Record<string, unknown> | null {
  const note = notes.noteFor(topicId);
  const sigs = notes.signals(topicId);
  if (!note && !sigs.length) return null;
  return {
    topic: topicId,
    idea: note?.idea ?? "",
    signals: sigs,
    template: note?.template ?? "",
    pitfalls: [...(note?.pitfalls ?? [])],
    complexity: note?.complexity ?? "",
    refs: (note?.refs ?? []).map(([title, url]) => ({ title, url })),
  };
}

function planJson(st: Store, plan: planner.Plan): Record<string, unknown> {
  return {
    topic: {
      id: plan.topic.id, name: plan.topic.name, kind: plan.topic.kind,
      desc: plan.topic.desc, url: plan.topic.url,
    },
    mode: plan.mode,
    pace: plan.pace,
    poolSize: plan.poolSize,
    totalPool: plan.totalPool,
    covered: plan.covered,
    coveragePct: pyRoundTo(plan.coveragePct, 1),
    minutes: plan.minutes,
    mix: plan.mix.toObject(),
    sharp: plan.sharp.size,
    sections: plan.sections.filter((s) => s.steps.length).map((s) => ({
      key: s.key, name: s.name, desc: s.desc, pool: s.pool, covered: s.covered,
      // 每一节的 key 就是子标签 id，所以每节都能就地给它自己的讲解
      note: noteJson(s.key),
      steps: s.steps.map((x) => stepJson(st, x)),
    })),
  };
}

// --- 接口 ---------------------------------------------------------------------

const one = (q: Query, key: string, fallback = ""): string => q[key]?.[0] ?? fallback;
const flag = (q: Query, key: string): boolean => ["1", "true", "yes"].includes(one(q, key));

function apiMeta(st: Store): unknown {
  const cats = st.cats.map((c) => {
    const members = st.problems.filter((p) => p.cats.includes(c.id));
    const [done, total] = st.progressOf(members);
    // 标签树只渲染一处，所以每个节点顺带把讲解的一句话核心思路带上 —— 卡片上写「怎么想」，
    // 定义式的 desc 留给讲解详情页当副标题，不必在目录里再说一遍。
    const withGist = <T extends { id: string; desc: string; kids?: T[] }>(s: T): T => ({
      ...s,
      gist: notes.gist(s.id, s.desc),
      hasNote: notes.hasNote(s.id),
      ...(s.kids?.length ? { kids: s.kids.map(withGist) } : {}),
    });
    const subs = c.subs.map((s) => {
      const sm = st.problems.filter((p) => p.tagIds.includes(s.id));
      const [sdone, stotal] = st.progressOf(sm);
      return { ...withGist(s), done: sdone, total: stotal };
    });
    return {
      id: c.id, name: c.name, desc: c.desc, gist: notes.gist(c.id, c.desc),
      hasNote: notes.hasNote(c.id), order: c.order, done, total, subs,
    };
  });

  const free = st.problems.filter((p) => !p.paid);
  const hot = st.problems.filter((p) => p.freq);
  const [fdone, ftotal] = st.progressOf(free);
  const [hdone, htotal] = st.progressOf(hot);
  const touched = new Set<string>();
  for (const p of st.problems) if (st.isDone(p)) for (const t of p.tagIds) touched.add(t);
  return {
    meta: st.meta,
    cats,
    paces: Object.keys(planner.PACE),
    defaultPace: planner.DEFAULT_PACE,
    progress: {
      done: fdone, total: ftotal, hotDone: hdone, hotTotal: htotal,
      tagsTouched: touched.size, tagCount: st.subById.size,
    },
  };
}

function apiProblems(st: Store, q: Query): unknown {
  const diffs = new Set((q["diff"] ?? []).filter((d) => d in DIFF_CN));
  const conds = {
    text: one(q, "q"), cat: one(q, "cat"), tag: one(q, "tag"), approach: one(q, "approach"),
    diffs: diffs.size ? diffs : null, hot: flag(q, "hot"), todo: flag(q, "todo"),
    mine: flag(q, "mine"), multi: flag(q, "multi"), source: one(q, "source"),
    series: one(q, "series"),
    includePaid: flag(q, "paid"), inList: one(q, "in"), sort: one(q, "sort", "id"),
  };
  const items = st.query(conds);
  const offset = parseInt(one(q, "offset", "0") || "0", 10);
  const limit = Math.min(parseInt(one(q, "limit", "60") || "60", 10), 300);
  return {
    total: items.length,
    // 每个维度在「其余条件」下还剩多少题，前端用来自适应地更新各选项的数字
    facets: st.facets(conds),
    items: items.slice(offset, offset + limit).map((p) => brief(st, p)),
  };
}

function apiProblem(st: Store, q: Query): unknown {
  const slug = one(q, "slug");
  const p = st.bySlug.get(slug) ?? st.byId.get(slug.toLowerCase());
  if (!p) return { error: "题目不存在" };
  const sims: unknown[] = [];
  for (const s of (st.similar()[p.slug] ?? []).slice(0, 12)) {
    const other = st.bySlug.get(s.slug);
    if (other) sims.push({ score: s.score, why: s.why, problem: brief(st, other) });
  }
  const files = st.filesOf(p).map((f) => ({ path: f.path, lang: f.lang, code: st.readSolution(f) }));
  return {
    ...brief(st, p),
    titleEn: p.titleEn ?? "",
    tagNames: p.tagNames ?? [],
    approachFull: p.approach ?? [],
    approachFrom: p.approachFrom ?? null,
    solutionSampled: p.solutionSampled ?? 0,
    codeBlocks: p.codeBlocks ?? 0,
    approachWhy: p.approachWhy ?? {},
    review: p.review
      ? {
        ...p.review,
        solutions: p.review.solutions.map((sol) => ({
          ...sol,
          // 标签给全路径，前端不用自己爬树
          tagPaths: sol.tags.map((t) => st.pathNames(t).join(" › ")),
        })),
      }
      : null,
    content: st.content(p.slug) ?? "",
    similar: sims,
    files,
  };
}

function apiTopics(st: Store): unknown {
  return {
    topics: [...st.topics().values()].map((t) => ({
      id: t.id, name: t.name, kind: t.kind, desc: t.desc,
      cat: t.cat, url: t.url, hasNote: notes.hasNote(t.id),
    })),
  };
}

function apiNote(st: Store, q: Query): unknown {
  const key = one(q, "topic");
  const topic = st.findTopic(key);
  const tid = topic ? topic.id : key;
  // 深层节点没有自己的卡片，继承父节点的：模板和坑本来就是同一族共用
  const parent = topic?.parent ? st.topics().get(topic.parent) : null;
  const data = noteJson(tid) ?? (parent ? noteJson(parent.id) : null);
  if (!data) return { error: `没有这个专题的讲解：${key}` };
  if (topic) {
    data["name"] = topic.name;
    data["desc"] = topic.desc;
    data["kind"] = topic.kind;
    data["depth"] = topic.depth ?? (topic.kind === "cat" ? 1 : 2);
    data["path"] = topic.path ?? topic.id;
    data["pathNames"] = st.pathNamesOf(topic);
    if (!noteJson(tid) && parent) {
      data["topic"] = tid;
      data["signals"] = notes.signals(tid);
      data["inheritedFrom"] = { id: parent.id, name: parent.name };
    }
    // 代表题：和 `sinan learn <专题>` 给的是同一批，取自同一套最小覆盖
    if (topic.kind !== "route") {
      const plan = planner.planTopic(st, topic, { mode: "minimal" });
      const limit = parseInt(one(q, "n", String(planner.SAMPLE_SIZE)) || "0", 10)
        || planner.SAMPLE_SIZE;
      data["poolSize"] = plan.poolSize;
      data["planSteps"] = plan.steps.length;
      data["picks"] = planner.representativeSample(plan, limit).map(([step, section]) => ({
        ...stepJson(st, step), section,
      }));
    }
  }
  return data;
}

function apiLists(st: Store): unknown {
  const out = st.curated.map((lst) => {
    const members = st.members(st.topics().get(lst.id)!);
    const [done, total] = st.progressOf(members);
    return {
      id: lst.id, name: lst.name, desc: lst.desc, kind: lst.kind,
      source: lst.source, url: lst.url, stats: lst.stats,
      done, total, groups: (lst.groups ?? []).length,
    };
  });
  return { lists: out };
}

function apiApproaches(st: Store): unknown {
  return { approaches: st.approachStats() };
}

function apiPlan(st: Store, q: Query): unknown {
  const route = planner.ROUTE_BY_ID.get(one(q, "route"));
  if (route) {
    if (planner.needsFreq(route) && !planner.hasFreqSignal(st)) {
      return {
        error: `「${route.name}」要按面试高频（CodeTop 频次与排名）排题，随包的精简题库里没有。`
          + "跑一次 sinan sync 抓下来，或者换一条不依赖频次的主线：入门筑基 / 进阶通关",
        needsSync: true,
      };
    }
    const plan = planner.planRoute(st, route, one(q, "paid") === "1");
    const data = planJson(st, plan);
    data["route"] = { id: route.id, name: route.name, tagline: route.tagline, desc: route.desc };
    return data;
  }
  const topic = st.findTopic(one(q, "topic"));
  if (!topic) return { error: `没有这个专题：${one(q, "topic")}` };
  const mode = one(q, "mode", "auto");
  const plan = planner.planTopic(st, topic, {
    mode: ["minimal", "full"].includes(mode) ? mode : "auto",
    includePaid: one(q, "paid") === "1",
    quality: one(q, "all") !== "1",
    pace: one(q, "pace", planner.DEFAULT_PACE),
    maxSteps: parseInt(one(q, "steps", "0") || "0", 10),
  });
  const data = planJson(st, plan);
  data["note"] = noteJson(topic.id);          // 计划页顶部的「开练前先看」
  return data;
}

function apiNext(st: Store, q: Query): unknown {
  const n = parseInt(one(q, "n", "3") || "3", 10);
  return {
    items: planner.nextSteps(st, n).map(([name, step]) => ({ topic: name, ...stepJson(st, step) })),
  };
}

/** 学习计划 = 少数几条主线。专题（106 个）只是练习素材，不是计划。 */
function apiRoutes(st: Store): unknown {
  const hasFreq = planner.hasFreqSignal(st);
  const out = planner.ROUTES.map((route) => {
    // 「面试冲刺」「补弱项」要按面试频次排题，随包基线里没有 —— 与其排出一份
    // 空计划让人以为坏了，不如明说要先同步
    const needsSync = planner.needsFreq(route) && !hasFreq;
    if (needsSync) {
      return {
        id: route.id, name: route.name, tagline: route.tagline, desc: route.desc,
        steps: 0, sections: 0, done: 0, minutes: 0, mix: {}, sharp: 0,
        pace: route.pace, dynamic: Boolean(route.dynamic), needsSync: true,
      };
    }
    const plan = planner.planRoute(st, route);
    const steps = plan.steps;
    return {
      id: route.id, name: route.name, tagline: route.tagline, desc: route.desc,
      steps: steps.length,
      sections: plan.sections.filter((s) => s.steps.length).length,
      done: steps.filter((s) => st.isDone(s.p)).length,
      minutes: plan.minutes, mix: plan.mix.toObject(), sharp: plan.sharp.size,
      pace: route.pace, dynamic: Boolean(route.dynamic), needsSync: false,
    };
  });
  return { routes: out };
}

export const API: Record<string, (st: Store, q: Query) => unknown> = {
  "/api/meta": (st) => apiMeta(st),
  "/api/problems": apiProblems,
  "/api/problem": apiProblem,
  "/api/topics": (st) => apiTopics(st),
  "/api/lists": (st) => apiLists(st),
  "/api/approaches": (st) => apiApproaches(st),
  "/api/plan": apiPlan,
  "/api/note": apiNote,
  "/api/next": apiNext,
  "/api/routes": (st) => apiRoutes(st),
};
