/**
 * 一条命令跑完整个数据管线：抓 LeetCode → 题解 → CodeTop → 特殊题单 → 打标构建。
 *
 * 抓取有断点续传，中断了直接重跑即可。
 */

import { build } from "./build.js";
import { distDir } from "./io.js";
import * as codetop from "./fetch/codetop.js";
import * as curated from "./fetch/curated.js";
import * as leetcode from "./fetch/leetcode.js";
import * as solutionCode from "./fetch/solutionCode.js";
import * as solutions from "./fetch/solutions.js";

interface Step {
  label: string;
  run: () => Promise<void> | void;
}

const STEPS: Step[] = [
  { label: "抓取 LeetCode 题库与题面", run: () => leetcode.run() },
  { label: "抓取社区题解（题解怎么说）", run: () => solutions.run() },
  { label: "抓取题解代码（题解怎么写）", run: () => solutionCode.run() },
  { label: "抓取 CodeTop 面试高频", run: () => codetop.run() },
  { label: "抓取特殊题单（官方学习计划 + CodeTop 公司榜）", run: () => curated.run() },
  { label: "打标 + 思路指纹 + 相似度", run: () => build() },
];

export async function sync(options: { skipFetch?: boolean } = {}): Promise<void> {
  const steps = options.skipFetch ? STEPS.slice(-1) : STEPS;
  for (const [i, step] of steps.entries()) {
    process.stdout.write(`\n=== [${i + 1}/${steps.length}] ${step.label}\n`);
    await step.run();
  }
  process.stdout.write(`\n完成。产出在 ${distDir()}，看概览：sinan\n`);
}
