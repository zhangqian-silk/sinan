/**
 * CLI 的冒烟扫描。
 *
 * 命令层是最没有类型保护的一层：渲染宽度、`{PROG}` 占位、参数解析、空结果分支，
 * 出错了 tsc 一个字都不会说。这里把每个子命令连同有代表性的参数组合都真跑一遍，
 * 断言退出码为 0、输出不为空、并且没有把占位符原样打出来。
 *
 * 跑的是编译后的 bin，所以顺带覆盖了入口脚本和 PROG 推导。
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { MINI_DIR } from "./helpers.js";

const BIN = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "bin", "sinan.js");

/** 每条都要能在夹具上跑出东西来。 */
const CASES: string[][] = [
  [],
  ["home"],
  ["topics"],
  ["topics", "tree"],
  ["lists"],
  ["routes"],
  ["approaches"],
  ["approaches", "树"],
  ["stats"],
  ["next", "-n", "5"],
  ["where"],
  ["list"],
  ["list", "--hot", "--limit", "10"],
  ["list", "--tag", "monotonic", "--with-lists"],
  ["list", "--cat", "tree", "--diff", "hard", "--sort", "hot"],
  ["list", "--approach", "单调栈", "--by-approach", "--links"],
  ["list", "--source", "luogu", "--limit", "5"],
  ["list", "--multi", "--sort", "value", "--limit", "5"],
  ["plan", "monotonic"],
  ["plan", "monotonic", "--full"],
  ["plan", "tree", "--pace", "coverage", "--brief"],
  ["plan", "dp-interval", "--day", "3"],
  ["plan", "starter"],
  ["plan", "interview"],
  ["plan", "advanced"],
  ["plan", "weakness"],
  ["plan", "monotonic", "--links"],
  ["learn"],
  ["learn", "monotonic"],
  ["learn", "tree"],
  ["learn", "tree", "-n", "4"],
  ["topics", "dp"],
  ["--help"],
  ["plan", "--help"],
];

function run(args: string[]): { code: number; out: string } {
  const res = spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      SINAN_DATA: MINI_DIR,
      SINAN_HOME: join(MINI_DIR, "__no_home__"),
      SINAN_SOLUTIONS: "",
      COLUMNS: "100",
      NO_COLOR: "1",
    },
  });
  return { code: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
}

for (const args of CASES) {
  const label = `sinan ${args.join(" ")}`.trim();
  test(`${label} 能跑通`, () => {
    const { code, out } = run(args);
    assert.equal(code, 0, `退出码 ${code}\n${out.slice(0, 600)}`);
    assert.ok(out.trim().length > 40, `输出太短：${JSON.stringify(out.slice(0, 200))}`);
    assert.ok(!out.includes("{PROG}"), "占位符没有被替换");
    assert.ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(out),
      `输出里漏了未定义值：${out.split("\n").find((l) => /undefined|NaN|\[object/.test(l))}`);
  });
}

test("找不到的题目 / 专题要给可读报错并以非零退出", () => {
  for (const args of [["show", "__nope__"], ["plan", "__nope__"], ["learn", "__nope__"]]) {
    const { code, out } = run(args);
    assert.equal(code, 1, `${args.join(" ")} 应该以 1 退出`);
    assert.ok(/没找到|没有这个/.test(out), `报错不可读：${out.slice(0, 200)}`);
    assert.ok(!out.includes("Error:"), `漏出了堆栈：${out.slice(0, 200)}`);
  }
});

test("未知选项要提示，而不是静默忽略", () => {
  const { code, out } = run(["list", "--nope"]);
  assert.equal(code, 1);
  assert.ok(out.includes("未知选项"), out.slice(0, 200));
});

test("装完什么都不做：learn 的目录覆盖整个体系", () => {
  const { code, out } = run(["learn"]);
  assert.equal(code, 0);
  // 13 个大类的 id 与名字都要在目录里
  for (const id of ["basics", "array", "ds-basic", "string", "binary-search", "tree",
    "search", "dp", "graph", "greedy", "math", "advanced-ds", "design"]) {
    assert.ok(out.includes(id), `目录里没有大类 ${id}`);
  }
  // 抽查几个子标签，确认目录钻到了第二层
  for (const id of ["monotonic", "sliding-window", "union-find", "dp-knapsack", "segment-tree"]) {
    assert.ok(out.includes(id), `目录里没有子标签 ${id}`);
  }
});

test("讲解页给核心思路，也给代表题和明文链接", () => {
  for (const topic of ["monotonic", "tree"]) {
    const { code, out } = run(["learn", topic]);
    assert.equal(code, 0);
    assert.ok(out.includes("核心思想"), `${topic} 没有核心思想`);
    assert.ok(out.includes("代表题"), `${topic} 没有代表题`);
    const links = out.match(/https:\/\/(leetcode\.cn|www\.luogu\.com\.cn)\/\S+/g) ?? [];
    assert.ok(links.length >= 3, `${topic} 的代表题没给够链接：${links.length} 条`);
    // 代表题要横跨难度，不能全是入门题
    assert.ok(/困难/.test(out), `${topic} 的代表题一道困难都没有`);
  }
});
