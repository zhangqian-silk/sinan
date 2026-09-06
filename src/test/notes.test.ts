/**
 * 教学卡片的体检。
 *
 * 卡片是手写内容，最容易出的问题是「加了子标签忘了加卡片」和「卡片 id 拼错，
 * 挂在一个不存在的标签下，永远显示不出来」。这两条都不需要题库数据就能查。
 *
 * 延伸阅读的链接是否还活着要联网，放在 `npm run check:links`，不进这里 ——
 * 离线环境不该因为 oi-wiki 改版而测试挂掉。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CATEGORIES } from "../build/rules/taxonomy.data.js";
import { allRefs, CAT_NOTES, hasNote, signals, SUB_NOTES } from "../notes/index.js";

const CAT_IDS = CATEGORIES.map((c) => c.id);
const SUB_IDS = CATEGORIES.flatMap((c) => c.subs.map((s) => s.id));

test("13 个大类和 65 个子标签都有卡片", () => {
  assert.deepEqual(CAT_IDS.filter((i) => !CAT_NOTES[i]), [], "缺卡片的大类");
  assert.deepEqual(SUB_IDS.filter((i) => !SUB_NOTES[i]), [], "缺卡片的子标签");
  assert.equal(CAT_IDS.length, 13);
  assert.equal(SUB_IDS.length, 65);
});

test("没有对不上任何标签的孤儿卡片（id 拼错会让卡片永远显示不出来）", () => {
  assert.deepEqual(Object.keys(SUB_NOTES).filter((i) => !SUB_IDS.includes(i)), []);
  assert.deepEqual(Object.keys(CAT_NOTES).filter((i) => !CAT_IDS.includes(i)), []);
});

test("每张卡片至少要有核心思想，延伸阅读必须指向 oi-wiki", () => {
  for (const [tid, note] of [...Object.entries(CAT_NOTES), ...Object.entries(SUB_NOTES)]) {
    assert.ok(note.idea && note.idea.length > 20, `${tid} 的核心思想太短或缺失`);
  }
  for (const [tid, title, url] of allRefs()) {
    assert.ok(url.startsWith("https://oi-wiki.org/"), `${tid} 的「${title}」链接不对：${url}`);
  }
});

test("识别信号来自打标规则，且能查到", () => {
  const withSignals = SUB_IDS.filter((i) => signals(i).length);
  assert.ok(withSignals.length >= 30, `有识别信号的子标签只有 ${withSignals.length} 个`);
  assert.ok(signals("monotonic").some((s) => s.includes("单调栈")));
  assert.equal(hasNote("monotonic"), true);
  assert.equal(hasNote("__nope__"), false);
});

test("模板骨架覆盖大部分子标签", () => {
  const withTpl = SUB_IDS.filter((i) => SUB_NOTES[i]?.template);
  assert.ok(withTpl.length >= 55, `带模板的子标签只有 ${withTpl.length} 个`);
});
