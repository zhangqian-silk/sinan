/**
 * 这些用例守的是「和 Python 版逐字一致」这条线。
 *
 * 每一条都对应一个真实踩过的坑：JS 的 `Math.round(12.5)` 给 13、Python 给 12；
 * JSON 里的 `2.0` 进了 JS 就变成 `2`；CRLF 结尾的题解文件用 `split("\n")`
 * 会每行拖一个 `\r`；中文按字符数补空格会让整张表错位。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  Counter, fixed, pad, pyFloat, pyRound, pyRoundTo, sortBy, splitLines, trunc, width, wrap,
} from "../util.js";
import { bar, setColor } from "../render.js";

setColor(false);

test("进度条把比例夹在 0 到 1 之间，数据不自洽也不能崩", () => {
  assert.equal(bar(0, 10, 4), "░░░░");
  assert.equal(bar(10, 10, 4), "████");
  assert.equal(bar(5, 10, 4), "██░░");
  assert.equal(bar(0, 0, 4), "░░░░");
  // done 大于 total：JS 的 repeat(负数) 会抛异常，必须夹住
  assert.equal(bar(999, 10, 4), "████");
  assert.equal(bar(-5, 10, 4), "░░░░");
});

test("pyRound 四舍六入五成双，和 Python 的 round() 一致", () => {
  assert.equal(pyRound(12.5), 12);      // JS 的 Math.round 会给 13
  assert.equal(pyRound(13.5), 14);
  assert.equal(pyRound(0.5), 0);
  assert.equal(pyRound(1.5), 2);
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(-0.5), 0);
  assert.equal(pyRound(-1.5), -2);
  assert.equal(pyRound(-2.5), -2);
  assert.equal(pyRound(2.4999999), 2);
  assert.equal(pyRound(7.7), 8);
});

test("fixed 等价于 Python 的 f-string 定点格式", () => {
  assert.equal(fixed(12.5, 0), "12");
  assert.equal(fixed(13.5, 0), "14");
  assert.equal(fixed(9.25, 1), "9.2");   // toFixed 会给 9.3
  assert.equal(fixed(9.35, 1), "9.3");   // 二进制里 9.35 其实略小于 9.35
  assert.equal(fixed(0.5522 * 100, 0), "55");
  assert.equal(fixed(100, 1), "100.0");
  assert.equal(fixed(0, 0), "0");
  assert.equal(fixed(-2.5, 0), "-2");
  assert.equal(fixed(1 / 3, 4), "0.3333");
  assert.equal(pyRoundTo(52.4999, 1), 52.5);
});

test("pyFloat 保留浮点面貌：区分度 2 要显示成 2.0", () => {
  assert.equal(pyFloat(2), "2.0");
  assert.equal(pyFloat(2.5), "2.5");
  assert.equal(pyFloat(0.8), "0.8");
  assert.equal(pyFloat(1), "1.0");
});

test("splitLines 处理 CRLF 与结尾换行，和 Python 的 splitlines() 一致", () => {
  assert.deepEqual(splitLines("a\r\nb\r\n"), ["a", "b"]);
  assert.deepEqual(splitLines("a\nb"), ["a", "b"]);
  assert.deepEqual(splitLines("a\n"), ["a"]);
  assert.deepEqual(splitLines(""), []);
  assert.deepEqual(splitLines("\n"), [""]);
});

test("width 中文占两列，且跳过颜色与超链接的控制序列", () => {
  assert.equal(width("abc"), 3);
  assert.equal(width("单调栈"), 6);
  assert.equal(width("单调栈 stack"), 12);
  assert.equal(width("\u001b[31m红\u001b[0m"), 2);
  assert.equal(width("\u001b]8;;https://x\u001b\\标题\u001b]8;;\u001b\\"), 4);
  assert.equal(width("★▌─·…"), 5);        // 这些是 Ambiguous，按一列算
});

test("pad / trunc / wrap 按显示宽度算，不按字符数", () => {
  assert.equal(pad("单调栈", 8), "单调栈  ");
  assert.equal(pad("单调栈", 8, "right"), "  单调栈");
  assert.equal(trunc("单调栈与单调队列", 8), "单调栈…");
  assert.equal(trunc("abc", 8), "abc");
  assert.deepEqual(wrap("一二三四", 4), ["一二", "三四"]);
  assert.deepEqual(wrap("abcd", 3), ["abc", "d"]);
});

test("sortBy 多元组按位比较且稳定", () => {
  const rows = [
    { id: "a", k: 1, n: 2 }, { id: "b", k: 1, n: 1 },
    { id: "c", k: 0, n: 9 }, { id: "d", k: 1, n: 1 },
  ];
  assert.deepEqual(sortBy(rows, (r) => [r.k, r.n]).map((r) => r.id), ["c", "b", "d", "a"]);
  // 键完全相同时保持原顺序（b 在 d 前）
  assert.deepEqual(sortBy(rows, () => [0]).map((r) => r.id), ["a", "b", "c", "d"]);
});

test("Counter.top 并列时取先出现的，和 Counter.most_common(1) 一致", () => {
  const c = new Counter<string>();
  c.update(["x", "y", "x", "y", "z"]);
  assert.equal(c.top(), "x");
  assert.equal(c.get("z"), 1);
  assert.deepEqual(c.toObject(), { x: 2, y: 2, z: 1 });
});
