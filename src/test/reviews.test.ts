/**
 * 人工判定的体检。
 *
 * 这批记录是手写的，最容易出的问题是标签打错字（打上一个树上没有的 id，构建会炸）、
 * 同一道题评了两遍、以及只写了标签没写解法。这三条不需要题库数据就能查。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadReviews, tagsOf } from "../build/reviews.js";
import { NODE_BY_ID } from "../build/taxonomy.js";

const reviews = [...loadReviews().values()];

test("每条判定的标签都在树上", () => {
  for (const r of reviews) {
    for (const id of tagsOf(r)) {
      assert.ok(NODE_BY_ID.has(id), `${r.slug} 用了树上没有的标签：${id}`);
    }
  }
});

test("每条判定都至少落到一个二级节点", () => {
  for (const r of reviews) {
    const hasLevel2 = tagsOf(r).some((id) => {
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

test("每种解法都讲清楚了它在这道题上是什么样子", () => {
  for (const r of reviews) {
    assert.ok(r.id, `${r.slug} 缺题号`);
    for (const sol of r.solutions) {
      assert.ok(sol.name.length >= 2, `${r.slug} 的解法没名字`);
      assert.ok(sol.idea.length >= 25, `${r.slug} 的「${sol.name}」讲得太短：${sol.idea}`);
    }
  }
});

test("一条解法里的标签不重复", () => {
  for (const r of reviews) {
    for (const sol of r.solutions) {
      assert.equal(new Set(sol.tags).size, sol.tags.length, `${r.slug}「${sol.name}」标签重复`);
    }
  }
});

test("解法不提出处，也不写日期 —— 这些都是噪音", () => {
  for (const r of reviews) {
    for (const sol of r.solutions) {
      assert.ok(!/官方|题解区|我们自己|读题后/.test(sol.idea),
        `${r.slug} 的「${sol.name}」提到了出处：${sol.idea}`);
      assert.ok(!/20\d\d-\d\d-\d\d/.test(sol.idea), `${r.slug} 的「${sol.name}」里混进了日期`);
    }
  }
});
