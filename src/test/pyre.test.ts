/**
 * 正则适配层的用例。
 *
 * 最要紧的一条：Python 的 `\w` 认中文、JS 的不认。`\bdfs\b` 这种规则如果直接
 * 搬过来，「用dfs解」在 Python 里不匹配、在 JS 里会匹配，凭空多抓一批题。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { py, translate } from "../build/pyre.js";
import { APPROACHES } from "../build/rules/approach.data.js";
import { NEAR_PROBES, RAW as CODE_RAW, TOKEN_PROBES } from "../build/rules/codeprint.data.js";
import { RULES } from "../build/rules/taxonomy.data.js";
import {
  GUARDS, PHRASE_PROBES, RAW as STMT_RAW, STRUCT_PROBES,
} from "../build/rules/statement.data.js";

test("\\b 按 Unicode 口径算词边界：中文旁边的 ASCII 词不算独立单词", () => {
  const rx = py("\\bdfs\\b");
  assert.equal(rx.test("dfs 深搜"), true);
  assert.equal(rx.test("用 dfs 解"), true);
  assert.equal(rx.test("用dfs解"), false);   // Python 里 `用` 是词字符，所以不匹配
  assert.equal(rx.test("bdfs"), false);
  assert.equal(rx.test("dfs(x)"), true);
});

test("\\w \\W 也按 Unicode 口径", () => {
  assert.equal(py("^\\w+$").test("变量名"), true);
  assert.equal(py("^\\w+$").test("a_1"), true);
  assert.equal(py("^\\w+$").test("a-1"), false);
  assert.equal(py("a\\Wb").test("a-b"), true);
  assert.equal(py("a\\Wb").test("a中b"), false);
});

test("字符类里的写法不动，多余转义就地拆掉", () => {
  assert.equal(py("[\\w-]+").test("a-b_1"), true);
  assert.doesNotThrow(() => py("a\\-b"));      // u 模式本来会拒绝 \\-
  assert.equal(py("a\\-b").test("a-b"), true);
});

test("Python 的标志位照常工作", () => {
  assert.equal(py("abc", "i").test("ABC"), true);
  assert.equal(py("^b$", "m").test("a\nb\nc"), true);
  assert.equal(py("a.b", "s").test("a\nb"), true);
});

test("环视原样保留（JS 支持，而且不限定长）", () => {
  assert.equal(translate("(?<!元)素数(?!目)").includes("(?<!元)"), true);
  assert.equal(py("(?<!元)素数(?!目)").test("素数筛"), true);
  assert.equal(py("(?<!元)素数(?!目)").test("元素数目"), false);
});

test("全部规则表里的正则都能编译", () => {
  const all: [string, string][] = [
    ...APPROACHES.map((a) => [`approach:${a.id}`, a.pattern] as [string, string]),
    ...TOKEN_PROBES.map(([id, rx]) => [`token:${id}`, rx] as [string, string]),
    ...NEAR_PROBES.flatMap(([id, a, b]) =>
      [[`near:${id}:a`, a], [`near:${id}:b`, b]] as [string, string][]),
    ...PHRASE_PROBES.map(([id, rx]) => [`phrase:${id}`, rx] as [string, string]),
    ...STRUCT_PROBES.map(([id, rx]) => [`struct:${id}`, rx] as [string, string]),
    ...Object.entries(GUARDS).map(([id, rx]) => [`guard:${id}`, rx] as [string, string]),
    ...RULES.filter((r) => r.title).map((r) => [`rule:${r.sub}`, r.title!] as [string, string]),
    ...Object.entries(CODE_RAW).map(([k, v]) => [`code:${k}`, v] as [string, string]),
    ...Object.entries(STMT_RAW).map(([k, v]) => [`stmt:${k}`, v] as [string, string]),
  ];
  const bad: string[] = [];
  for (const [label, pattern] of all) {
    try {
      py(pattern.includes("%s") ? pattern.replaceAll("%s", "x") : pattern);
    } catch (err) {
      bad.push(`${label}: ${(err as Error).message}`);
    }
  }
  assert.deepEqual(bad, [], `编译失败的规则：\n${bad.join("\n")}`);
  assert.ok(all.length > 250, `规则总数 ${all.length}`);
});
