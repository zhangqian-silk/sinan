/**
 * 人工判定的体检。
 *
 * 这批记录是手写的，最容易出的问题是标签打错字（打上一个树上没有的 id，构建会炸）、
 * 同一道题评了两遍、以及只写了标签没写解法。这三条不需要题库数据就能查。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadReviews } from "../build/reviews.js";
import { NODE_BY_ID } from "../build/taxonomy.js";

const reviews = [...loadReviews().values()];

test("每条判定的标签都在树上", () => {
  for (const r of reviews) {
    for (const id of r.tags) {
      assert.ok(NODE_BY_ID.has(id), `${r.slug} 用了树上没有的标签：${id}`);
    }
  }
});

test("每条判定都至少落到一个二级节点", () => {
  for (const r of reviews) {
    const hasLevel2 = r.tags.some((id) => {
      let cur: string | undefined = id;
      while (cur && NODE_BY_ID.has(cur)) {
        if (NODE_BY_ID.get(cur)!.depth === 2) return true;
        cur = NODE_BY_ID.get(cur)!.parent;
      }
      return false;
    });
    assert.ok(hasLevel2, `${r.slug} 的标签挂不到二级节点上`);
  }
});

test("解法思路写清楚了，别只丢一句话占位", () => {
  for (const r of reviews) {
    assert.ok(r.idea.length >= 20, `${r.slug} 的解法思路太短：${r.idea}`);
    assert.ok(r.id, `${r.slug} 缺题号`);
    if (r.alt) for (const a of r.alt) assert.ok(a.length >= 8, `${r.slug} 的替代解法太短`);
  }
});

test("标签不重复，也别把同一个节点写两遍", () => {
  for (const r of reviews) {
    assert.equal(new Set(r.tags).size, r.tags.length, `${r.slug} 的标签有重复`);
  }
});
