/**
 * 打标质量的护栏：读代码判解法 37 条、读题面判解法 45 条。
 *
 * 规则驱动的抽取必须能量化，否则调一处就坏一处。这两组用例里近一半是**反面用例**
 * （「绝对不能判成这个」），因为规则最容易犯的错是宁滥勿缺。
 *
 * 用例要跑在真实抓取数据上，所以没有数据时跳过 —— CI 上没题库不该红。
 * 本地有数据时用 `SINAN_DATA_ROOT=... npm test` 跑全套。
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { validate as validateCode } from "../build/codeprint.js";
import { loadCodeRecords, loadJson, rawDir, readJsonl } from "../build/io.js";
import { validate as validateStatement } from "../build/statement.js";

const RAW = rawDir();
const codePath = join(RAW, "solution_code.jsonl");
const detailPath = join(RAW, "leetcode_detail.jsonl");
const listPath = join(RAW, "leetcode_list.json");

test("读题解代码判解法：召回全中且零误判", { skip: !existsSync(codePath) && "没有抓取数据" }, () => {
  const records = loadCodeRecords(codePath);
  const report = validateCode(records);
  assert.deepEqual(report.violations, [], "出现误判");
  const [hit, total] = report.recall.split("/").map(Number);
  assert.equal(hit, total, `召回 ${report.recall}：\n${report.misses.join("\n")}`);
  assert.ok(total >= 30, `用例太少：${report.recall}`);
});

test("读题面判解法：召回全中且零误判",
  { skip: !(existsSync(detailPath) && existsSync(listPath)) && "没有抓取数据" }, () => {
    const details = new Map<string, { content?: string }>();
    for (const r of readJsonl<{ _key?: string; _error?: unknown; content?: string }>(detailPath)) {
      if (r._key && !r._error) details.set(r._key, r);
    }
    const titles = new Map<string, string>();
    for (const p of loadJson<{ titleSlug: string; titleCn?: string; title?: string }[]>(listPath)) {
      titles.set(p.titleSlug, p.titleCn || p.title || "");
    }
    const report = validateStatement(details, titles);
    assert.deepEqual(report.violations, [], "出现误判");
    const [hit, total] = report.recall.split("/").map(Number);
    assert.equal(hit, total, `召回 ${report.recall}：\n`
      + report.misses.filter((m) => !m.includes("没有题面")).join("\n"));
    assert.ok(total >= 40, `用例太少：${report.recall}`);
  });
