/**
 * Web 接口的契约检查。
 *
 * 网页和终端共用 store/planner，所以「算得对不对」由 planner 那批测试保证；
 * 这里只盯接口这一层容易悄悄坏掉的东西：字段名改了、某个视图依赖的字段没给、
 * 以及「装完什么都不做也要能看到分类、思路、题目和链接」这条承诺在网页上是否成立。
 *
 * 真起一个服务并发 HTTP 请求，顺带覆盖路由与静态资源。
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

import * as planner from "../planner.js";
import { serve } from "../serve.js";
import { miniStore } from "./helpers.js";

const store = miniStore();
let server: Server;
let base = "";

before(async () => {
  server = serve(store, { host: "127.0.0.1", port: 0, silent: true });
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

/** 接口返回的形状：只声明用到的字段，别的不管。 */
interface Brief {
  id: string; slug: string; title: string; url: string;
  difficulty: string; done: boolean; mine: string[];
}
interface StepRes {
  problem: Brief; stage: string; approaches: string[]; reasons: string[]; section?: string;
}
interface SubRes {
  id: string; name: string; gist: string; total: number; hasNote: boolean; kids?: SubRes[];
}
interface CatRes extends SubRes { subs: SubRes[] }
interface NoteRes {
  topic: string; name?: string; idea: string; signals: string[];
  refs: { title: string; url: string }[];
  poolSize?: number; planSteps?: number; picks?: StepRes[]; error?: string;
}
interface RouteRes { id: string; steps: number; needsSync: boolean }
interface PlanRes { sections: { steps: StepRes[] }[]; error?: string }
interface MetaRes {
  cats: CatRes[];
  meta: { baseline: boolean; stats: { total: number } };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  assert.equal(res.status, 200, `${path} 返回 ${res.status}`);
  return (await res.json()) as T;
}

test("首页与静态资源发得出去", async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("app.js"), "首页没有引到前端脚本");
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
});

// 标签树只有这一个来源：目录和讲解合成了一页，卡片上的一句话就取自这里的 gist
test("/api/meta 给出完整的标签体系，每个节点都带一句话核心思路", async () => {
  const meta = await get<MetaRes>("/api/meta");
  assert.equal(meta.cats.length, 13);
  assert.equal(meta.cats.reduce((a, c) => a + c.subs.length, 0), 65);
  assert.ok(meta.meta.stats.total > 0);
  assert.equal(typeof meta.meta.baseline, "boolean", "前端要靠它判断是不是随包题库");
  for (const cat of meta.cats) {
    assert.ok(cat.gist.length >= 12, `${cat.id} 的核心思路太短：${cat.gist}`);
    assert.ok(cat.total > 0, `${cat.id} 没有题`);
    for (const sub of cat.subs) {
      assert.ok(sub.gist.length >= 12, `${sub.id} 的核心思路太短：${sub.gist}`);
      assert.ok(sub.hasNote, `${sub.id} 没有讲解`);
      for (const kid of sub.kids ?? []) {
        // 三级标签不一定有自己的讲解卡（模板与坑跟父节点共用），这时回落到 desc
        assert.ok(kid.gist.length > 0, `${kid.id} 目录里没有一句话可显示`);
      }
    }
  }
});

test("/api/note 给核心思想、代表题和平台链接", async () => {
  const note = await get<NoteRes>("/api/note?topic=monotonic");
  assert.ok(note.idea.length > 20, "没有核心思想");
  assert.ok(note.signals.length > 0, "没有识别信号");
  assert.ok(note.refs.length > 0, "没有 OI-Wiki 延伸阅读");
  assert.ok((note.poolSize ?? 0) > 0 && (note.planSteps ?? 0) > 0);

  const picks = note.picks ?? [];
  assert.ok(picks.length >= 3, `代表题只有 ${picks.length} 道`);
  for (const step of picks) {
    assert.match(step.problem.url, /^https:\/\//, `${step.problem.slug} 没有平台链接`);
    assert.ok(step.problem.title && step.problem.id);
    assert.ok(step.stage, "缺少阶段标记");
  }
  // 讲解页的代表题要横跨难度，不能全是入门题
  assert.ok(new Set(picks.map((s) => s.problem.difficulty)).size >= 2,
    "代表题难度没有梯度");
});

test("大类的代表题会让每个子标签轮流露面", async () => {
  const note = await get<NoteRes>("/api/note?topic=tree");
  const sections = new Set((note.picks ?? []).map((s) => s.section));
  assert.ok(sections.size >= 2, `代表题全挤在 ${[...sections].join("/")} 一个知识点上`);
});

test("/api/lang 是语言基础速查:小节里每段代码都非空", async () => {
  const data = await get<{
    guides: { id: string; name: string }[];
    guide: {
      id: string; name: string; tagline: string;
      sections: { id: string; name: string; blurb: string;
        snippets: { title: string; code: string }[] }[];
    };
  }>("/api/lang");
  assert.ok(data.guides.length >= 1, "一门语言都没有");
  assert.equal(data.guide.id, "python", "默认应给 Python");
  assert.ok(data.guide.tagline.length > 10);
  assert.ok(data.guide.sections.length >= 6, "小节太少");
  // 用户点名要的四类都在
  const ids = new Set(data.guide.sections.map((s) => s.id));
  for (const need of ["arithmetic", "variables", "control", "containers"]) {
    assert.ok(ids.has(need), `缺少小节 ${need}`);
  }
  for (const sec of data.guide.sections) {
    assert.ok(sec.name && sec.blurb, `${sec.id} 缺标题或说明`);
    assert.ok(sec.snippets.length > 0, `${sec.id} 一段代码都没有`);
    for (const sn of sec.snippets) {
      assert.ok(sn.title, `${sec.id} 有段代码没标题`);
      assert.ok(sn.code.trim().length > 0, `${sec.id}/${sn.title} 代码是空的`);
    }
  }
});

test("/api/lang?id=python 指名取到那门语言", async () => {
  const data = await get<{ guide: { id: string } | null }>("/api/lang?id=python");
  assert.equal(data.guide?.id, "python");
  const miss = await get<{ guide: { id: string } | null }>("/api/lang?id=nope");
  assert.equal(miss.guide, null, "不存在的语言应返回 null 而不是兜底");
});

test("网页和终端的代表题是同一批", async () => {
  for (const id of ["monotonic", "tree", "dp-knapsack"]) {
    const note = await get<NoteRes>(`/api/note?topic=${id}`);
    const topic = store.topics().get(id)!;
    const plan = planner.planTopic(store, topic, { mode: "minimal" });
    const expected = planner.representativeSample(plan, planner.SAMPLE_SIZE)
      .map(([step]) => step.p.slug);
    assert.deepEqual((note.picks ?? []).map((s) => s.problem.slug), expected,
      `${id} 的代表题两边对不上`);
  }
});

test("主线标出哪些要先同步；点进去也给可读的说明", async () => {
  const { routes } = await get<{ routes: RouteRes[] }>("/api/routes");
  assert.equal(routes.length, planner.ROUTES.length);
  const hasFreq = planner.hasFreqSignal(store);
  for (const rt of routes) {
    assert.equal(rt.needsSync, planner.needsFreq(planner.ROUTE_BY_ID.get(rt.id)!) && !hasFreq,
      `${rt.id} 的 needsSync 标错了`);
    if (!rt.needsSync) assert.ok(rt.steps > 0, `${rt.id} 一步都没排出来`);
  }
});

test("/api/plan 每一步都带链接与理由", async () => {
  const plan = await get<PlanRes>("/api/plan?topic=monotonic&mode=minimal");
  assert.ok(plan.sections.length > 0);
  for (const sec of plan.sections) {
    for (const step of sec.steps) {
      assert.match(step.problem.url, /^https:\/\//);
      assert.ok(step.reasons.length > 0, `${step.problem.slug} 没有「为什么选它」`);
    }
  }
});

test("找不到的专题给可读报错，而不是 500", async () => {
  for (const path of ["/api/note?topic=__nope__", "/api/plan?topic=__nope__"]) {
    const data = await get<{ error?: string }>(path);
    assert.ok(typeof data.error === "string" && data.error.includes("没有这个"),
      `${path} 的报错不可读：${JSON.stringify(data).slice(0, 120)}`);
  }
});
