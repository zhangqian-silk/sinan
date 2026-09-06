/**
 * 基线模式的提示语。
 *
 * 随包的基线数据只有题目元数据和我们自己的分析，没有题面、面试频次和官方题单 ——
 * 那些是平台的内容与编排，得用户自己抓。凡是因此不可用的功能，都要说清楚
 * 「差什么、怎么补」，而不是显示一个 0 让人以为坏了。
 */

import { paint } from "../render.js";
import type { Store } from "../store.js";

/** 基线里没有的东西，按功能分组，方便各处只提相关的那条。 */
export const MISSING = {
  freq: "面试高频（CodeTop 频次与排名）",
  lists: "28 份官方 / 公司题单",
  content: "题面原文",
  acRate: "通过率",
} as const;

export function isBaseline(store: Store): boolean {
  return store.baseline;
}

/** 一行灰色提示：这个功能需要先同步。 */
export function needSync(what: string): string {
  return paint(`  ${what}需要本地抓取后才有：{PROG} sync`, "gray");
}

/** 概览页脚的总提示。 */
export function baselineFooter(): string[] {
  return [
    paint("  当前用的是随包的精简题库：分类体系、解题思路、题目与链接都在，", "gray"),
    paint(`  但${MISSING.content}、${MISSING.freq}、${MISSING.lists}要跑 {PROG} sync 自己抓。`, "gray"),
  ];
}
