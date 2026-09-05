import assert from "node:assert/strict";
import { test } from "node:test";

import { overlap } from "../approach.js";
import type { ApproachRef } from "../types.js";

const a = (id: string, w: number): ApproachRef =>
  ({ id, name: id, domain: "ds", conf: 1, w, hits: 1, from: "code" });

test("没有共同思路时重合度为 0", () => {
  assert.equal(overlap([a("kmp", 3)], [a("trie", 3)]), 0);
  assert.equal(overlap([], [a("trie", 3)]), 0);
});

test("区分度折扣：都只是「递归」不算能互相替代", () => {
  const vague = overlap([a("tree-recursion", 1.0)], [a("tree-recursion", 1.0)]);
  const sharp = overlap([a("math-sieve", 3.0)], [a("math-sieve", 3.0)]);
  assert.ok(vague < 0.2, `泛化思路的重合度应该被压到很低，实际 ${vague}`);
  assert.equal(sharp, 1);
  assert.ok(sharp > vague);
});

test("重合度对称，且部分重合落在 0 到 1 之间", () => {
  const x = [a("monotonic-stack", 3), a("prefix-sum", 2.5)];
  const y = [a("monotonic-stack", 3), a("heap", 2)];
  const s = overlap(x, y);
  assert.equal(s, overlap(y, x));
  assert.ok(s > 0 && s < 1, `部分重合应落在 (0,1)，实际 ${s}`);
});
