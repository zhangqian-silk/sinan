/**
 * 标签树的体检。
 *
 * 树是可选层级的：绝大多数枝停在二级，少数往下长一层。容易出问题的正是这种不齐
 * 的结构 —— 深层节点挂在不存在的思路上（永远打不上标签）、树不自洽（有孩子没爹）、
 * 路径寻址把不相干的节点认成祖孙。这几条都在这里守着。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { APPROACHES } from "../build/rules/approach.data.js";
import { CATEGORIES, LEAF_TAG_MAP, type Sub } from "../build/rules/taxonomy.data.js";
import { NODE_BY_ID } from "../build/taxonomy.js";
import * as planner from "../planner.js";
import { miniStore } from "./helpers.js";

const store = miniStore();

function walk(nodes: readonly Sub[], depth: number, out: [Sub, number][] = []): [Sub, number][] {
  for (const n of nodes) {
    out.push([n, depth]);
    if (n.kids?.length) walk(n.kids, depth + 1, out);
  }
  return out;
}
const ALL = CATEGORIES.flatMap((c) => walk(c.subs, 2));
const DEEP = ALL.filter(([, d]) => d >= 3);

test("层级按实际情况长，不强求整齐", () => {
  assert.equal(ALL.filter(([, d]) => d === 2).length, 65);
  assert.ok(DEEP.length > 0, "一个深层节点都没有");
  // 有的枝往下长，有的就地收尾 —— 两种都必须存在，否则就是被强行拉齐了
  const subs = CATEGORIES.flatMap((c) => c.subs);
  assert.ok(subs.some((s) => s.kids?.length), "没有任何一枝往下长");
  assert.ok(subs.some((s) => !s.kids?.length), "所有枝都被强行拉到三级");
  // 孩子数量本来就不该一样多
  const widths = new Set(subs.filter((s) => s.kids?.length).map((s) => s.kids!.length));
  assert.ok(widths.size > 1, "每个分叉的孩子数都一样，像是凑出来的");
});

test("深层节点的 id 必须是真实存在的思路，否则永远打不上标签", () => {
  const known = new Set(APPROACHES.map((a) => a.id));
  const bad = DEEP.map(([n]) => n.id).filter((id) => !known.has(id));
  assert.deepEqual(bad, [], "这些深层节点没有对应的思路");
});

test("全树 id 唯一，且每个节点都能查到自己的位置", () => {
  const ids = ALL.map(([n]) => n.id);
  assert.equal(new Set(ids).size, ids.length, "有重复 id");
  for (const [n, depth] of ALL) {
    const info = NODE_BY_ID.get(n.id);
    assert.ok(info, `${n.id} 不在索引里`);
    assert.equal(info.depth, depth, `${n.id} 的深度对不上`);
  }
});

test("原始标签直连深层节点的映射，目标必须存在", () => {
  for (const [raw, leaf] of Object.entries(LEAF_TAG_MAP)) {
    const info = NODE_BY_ID.get(leaf);
    assert.ok(info, `原始标签「${raw}」指向了不存在的节点 ${leaf}`);
    assert.ok(info.depth >= 3, `原始标签「${raw}」指向的 ${leaf} 不是深层节点`);
  }
});

test("树自洽：题目挂了深层标签，父节点一定也在", () => {
  let checked = 0;
  for (const p of store.problems) {
    for (const id of p.deepTagIds ?? []) {
      const info = NODE_BY_ID.get(id);
      assert.ok(info, `${p.slug} 挂了未知的深层标签 ${id}`);
      assert.ok(p.tagIds.includes(info.parent) || (p.deepTagIds ?? []).includes(info.parent),
        `${p.slug} 有 ${id} 却没有它的父节点 ${info.parent}`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, "夹具里一个深层标签都没有，测不出东西");
});

test("深层标签也带在 tags 上，且标了层级和父节点", () => {
  const p = store.problems.find((x) => (x.deepTagIds ?? []).length)!;
  for (const id of p.deepTagIds ?? []) {
    const ref = p.tags.find((t) => t.id === id);
    assert.ok(ref, `${id} 只进了 deepTagIds，没进 tags`);
    assert.ok((ref.level ?? 2) >= 3, `${id} 没标层级`);
    assert.equal(ref.parent, NODE_BY_ID.get(id)!.parent);
    assert.ok(ref.src.length > 0, `${id} 没说清楚凭什么打上`);
  }
});

test("路径寻址：祖先对得上才认", () => {
  const deep = DEEP.find(([n]) => store.topics().has(n.id));
  if (!deep) return;
  const [node] = deep;
  const info = NODE_BY_ID.get(node.id)!;
  const full = `${info.cat}/${info.parent}/${node.id}`;
  assert.equal(store.findTopic(full)?.id, node.id, "完整路径没认出来");
  assert.equal(store.findTopic(`${info.parent}/${node.id}`)?.id, node.id, "后缀路径没认出来");
  assert.equal(store.findTopic(`dp/${node.id}`), null, "祖先写错了也认，会指到不相干的专题");
});

test("深层节点当专题用：题池、计划、筛选三处口径一致", () => {
  for (const [node] of DEEP) {
    const topic = store.topics().get(node.id);
    if (!topic) continue;
    const members = store.members(topic, { includePaid: true });
    const queried = store.query({ tag: node.id, includePaid: true });
    assert.deepEqual(members.map((p) => p.slug).sort(), queried.map((p) => p.slug).sort(),
      `${node.id} 的 members 和 --tag 查询对不上`);
    if (members.length < 3) continue;
    const plan = planner.planTopic(store, topic, { mode: "minimal" });
    assert.ok(plan.steps.length > 0, `${node.id} 排不出计划`);
    for (const s of plan.steps) {
      assert.ok((s.p.deepTagIds ?? []).includes(node.id), `${node.id} 的计划混进了别的题`);
    }
  }
});
