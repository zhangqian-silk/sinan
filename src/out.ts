/**
 * 终端输出的唯一出口。
 *
 * 命令自称的名字取自实际被调用的文件名，所以建软链改名之后，帮助文本和各处
 * 「下一步试试 xxx」的提示会自动跟着变，不用回来改字符串。
 */

import { basename } from "node:path";

import { fixed } from "./util.js";

function detectProg(): string {
  const fromEnv = process.env["SINAN_PROG"];
  if (fromEnv) return fromEnv;
  const argv1 = process.argv[1];
  if (!argv1) return "sinan";
  return basename(argv1).replace(/\.[cm]?js$/, "") || "sinan";
}

export const PROG = detectProg();

/** 打印一批行，顺手把 {PROG} 占位符换成真实命令名。 */
export function out(...lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(`${line.includes("{PROG}") ? line.replaceAll("{PROG}", PROG) : line}\n`);
  }
}

export function pct(done: number, total: number): string {
  return total ? `${fixed((100 * done) / total, 0)}%` : "—";
}
