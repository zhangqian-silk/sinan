/**
 * 随包基线数据的体检。
 *
 * 两件事必须守住：
 * 1. **合规**——里面绝不能混进题面原文、题解代码这类平台内容。这不是靠自觉，
 *    是靠一条长度上限：基线里所有字符串都是标识符、标题或我们自己写的短句，
 *    题面动辄上千字，一旦漏进来立刻显形。
 * 2. **可用**——装完什么都不做，分类体系、解题思路、题目和链接都要能看到。
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { expand, type Packed } from "../baseline.js";
import { BASELINE_DIR } from "../paths.js";
import { nextSteps, signatureProblems } from "../planner.js";
import { Store } from "../store.js";
import { noteFor } from "../notes/index.js";

const FILE = join(BASELINE_DIR, "baseline.json");
const skip = !existsSync(FILE) && "仓库里还没有基线数据，跑 npm run baseline 生成";

/** 我们自己写的判定理由最长也就一两句；题面随便一道都上千字。 */
const MAX_STRING = 300;

test("基线里没有题面原文或题解代码", { skip }, () => {
  const raw = readFileSync(FILE, "utf-8");
  const data = JSON.parse(raw) as Packed;
  const offenders: string[] = [];
  const walk = (x: unknown, path: string): void => {
    if (typeof x === "string") {
      if (x.length > MAX_STRING) offenders.push(`${path}: ${x.length} 字 — ${x.slice(0, 60)}…`);
      return;
    }
    if (Array.isArray(x)) { x.forEach((v, i) => { walk(v, `${path}[${i}]`); }); return; }
    if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
    }
  };
  walk(data, "$");
  assert.deepEqual(offenders, [], `基线里出现了超长文本，疑似题面/题解漏了进来：\n${offenders.slice(0, 5).join("\n")}`);
  // HTML 标签是题面的招牌特征
  assert.ok(!/<p>|<pre>|<strong>|&nbsp;/.test(raw), "基线里出现了 HTML 片段");
});

test("基线体积在可以进 git 的范围内", { skip }, () => {
  const mb = statSync(FILE).size / 1024 / 1024;
  assert.ok(mb < 6, `基线 ${mb.toFixed(1)} MB，太大了，该再裁一轮`);
});

test("装完什么都不做：分类、解题思路、题目和链接都能拿到", { skip }, () => {
  const store = new Store({
    dataDir: BASELINE_DIR,
    solutions: [],
    progressFile: join(BASELINE_DIR, "__no_progress__.json"),
  });
  assert.equal(store.baseline, true, "没识别成基线模式");

  // 分类体系
  assert.equal(store.cats.length, 13);
  assert.equal(store.subById.size, 65);

  // 每一类的解题思路（教学卡片随代码走，不依赖数据）
  for (const c of store.cats) {
    assert.ok(noteFor(c.id)?.idea, `${c.id} 没有核心思想`);
    for (const s of c.subs) assert.ok(noteFor(s.id)?.idea, `${s.id} 没有核心思想`);
  }

  // 每一类都有题目，且都带平台链接
  for (const c of store.cats) {
    const rows = store.query({ cat: c.id });
    assert.ok(rows.length > 20, `${c.id} 只有 ${rows.length} 题`);
    for (const p of rows.slice(0, 5)) {
      assert.ok(/^https:\/\//.test(p.url), `${p.slug} 的链接不对：${p.url}`);
      assert.ok(p.title && p.id, `${p.slug} 缺题号或标题`);
      assert.ok(p.tagIds.length, `${p.slug} 没有标签`);
    }
  }

  // 不依赖频次的主线要能排出来
  assert.ok(store.similar()["two-sum"]?.length, "相似度图没读进来");
});

test("装完什么都不做：每个子标签都给得出代表题，下一步也不空", { skip }, () => {
  const store = new Store({
    dataDir: BASELINE_DIR,
    solutions: [],
    progressFile: join(BASELINE_DIR, "__no_progress__.json"),
  });

  // 目录页要给的「代表题」：65 个子标签一个都不能空，且都带链接
  for (const cat of store.cats) {
    for (const sub of cat.subs) {
      const topic = store.topics().get(sub.id)!;
      const picks = signatureProblems(store, topic, 3);
      assert.ok(picks.length > 0, `${sub.id} 没有代表题`);
      for (const p of picks) {
        assert.ok(/^https:\/\//.test(p.url), `${p.slug} 的链接不对：${p.url}`);
        assert.ok(p.tagIds.includes(sub.id), `${p.slug} 并不属于 ${sub.id}`);
      }
    }
  }

  // 「下一步」原本按面试频次找最薄弱的专题，基线里没有频次，要退回入门主线
  const picks = nextSteps(store, 3);
  assert.equal(picks.length, 3, "零进度零频次时给不出下一步");
  for (const [name, step] of picks) {
    assert.ok(name, "下一步缺少专题名");
    assert.ok(/^https:\/\//.test(step.p.url), `${step.p.slug} 没有链接`);
    assert.ok(step.reasons.length > 0, `${step.p.slug} 没有「为什么选它」`);
  }
});

test("基线展开出来的统计口径自洽", { skip }, () => {
  const data = expand(JSON.parse(readFileSync(FILE, "utf-8")) as Packed);
  const s = data.meta.stats;
  assert.equal(s.total, data.problems.length);
  assert.equal(s.withContent, 0, "基线不该声称有题面");
  assert.equal(s.free, s.total);
  for (const [cat, n] of Object.entries(s.cats)) {
    assert.ok(n <= s.total, `大类 ${cat} 的计数 ${n} 超过总题量`);
  }
  // 平台运营数据一律清零，不随包分发
  for (const p of data.problems) {
    assert.equal(p.freq, 0);
    assert.equal(p.acRate, 0);
    assert.deepEqual(p.rawTags, []);
  }
});
