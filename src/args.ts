/**
 * 命令行解析。
 *
 * 只覆盖这个 CLI 真正用到的语法（子命令 + 长选项 + 位置参数），不引第三方库 ——
 * 一个刷题工具没有必要为了解析十来个 flag 背上依赖树。
 */

import { CliError } from "./errors.js";
import { pad, width } from "./util.js";

export interface OptSpec {
  /** 长选项名，含 `--` */
  flag: string;
  /** 解析结果里的键名，默认由 flag 推导 */
  dest?: string;
  type: "flag" | "string" | "int";
  /** 可重复出现，收集成数组 */
  append?: boolean;
  choices?: string[];
  default?: unknown;
  /** 额外的短选项，如 `-n` */
  short?: string;
  help: string;
  /** 占位符，写进帮助里 */
  metavar?: string;
}

export interface PosSpec {
  dest: string;
  nargs?: "1" | "?" | "*" | "+";
  help: string;
  metavar?: string;
}

export interface CommandSpec {
  name: string;
  help: string;
  pos?: PosSpec[];
  opts?: OptSpec[];
}

export type Args = Record<string, unknown>;

function destOf(spec: OptSpec): string {
  return spec.dest ?? spec.flag.replace(/^--/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function defaultFor(spec: OptSpec): unknown {
  if (spec.default !== undefined) return spec.default;
  if (spec.append) return [];
  if (spec.type === "flag") return false;
  return undefined;
}

export function parse(
  argv: readonly string[],
  commands: readonly CommandSpec[],
  common: readonly OptSpec[],
  defaultCommand: string,
): { command: string; args: Args; help: string | null } {
  const byName = new Map(commands.map((c) => [c.name, c]));

  // 先扫一遍找子命令：全局选项写在子命令前后都认
  let command = "";
  const rest: string[] = [];
  let seenSeparator = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") { seenSeparator = true; rest.push(...argv.slice(i + 1)); break; }
    if (!command && !token.startsWith("-") && byName.has(token)) { command = token; continue; }
    rest.push(token);
  }
  void seenSeparator;

  const wantsHelp = rest.includes("--help") || rest.includes("-h");
  if (!command && wantsHelp) return { command: "", args: {}, help: "" };
  if (!command) command = defaultCommand;
  const spec = byName.get(command)!;
  if (wantsHelp) return { command, args: {}, help: command };

  const opts = [...common, ...(spec.opts ?? [])];
  const byFlag = new Map<string, OptSpec>();
  for (const o of opts) {
    byFlag.set(o.flag, o);
    if (o.short) byFlag.set(o.short, o);
  }

  const args: Args = {};
  for (const o of opts) args[destOf(o)] = defaultFor(o);

  const positional: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    let token = rest[i];
    if (!token.startsWith("-") || token === "-") { positional.push(token); continue; }

    let inline: string | null = null;
    const eq = token.indexOf("=");
    if (token.startsWith("--") && eq !== -1) {
      inline = token.slice(eq + 1);
      token = token.slice(0, eq);
    }
    const o = byFlag.get(token);
    if (!o) throw new CliError(`未知选项：${token}\n看看 {PROG} ${command} --help`);
    const dest = destOf(o);
    if (o.type === "flag") {
      if (inline !== null) throw new CliError(`${token} 是开关，不接受取值`);
      args[dest] = true;
      continue;
    }
    let raw = inline;
    if (raw === null) {
      raw = rest[i + 1] ?? null;
      if (raw === null) throw new CliError(`选项 ${token} 后面缺少取值`);
      i += 1;
    }
    if (o.choices && !o.choices.includes(raw)) {
      throw new CliError(`${token} 只能是 ${o.choices.join(" / ")}，收到 ${raw}`);
    }
    let value: unknown = raw;
    if (o.type === "int") {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new CliError(`${token} 需要一个数字，收到 ${raw}`);
      value = Math.trunc(n);
    }
    if (o.append) {
      const bucket = (args[dest] as unknown[] | undefined) ?? [];
      bucket.push(value);
      args[dest] = bucket;
    } else {
      args[dest] = value;
    }
  }

  // 位置参数
  const posSpecs = spec.pos ?? [];
  let cursor = 0;
  for (let k = 0; k < posSpecs.length; k += 1) {
    const ps = posSpecs[k];
    const nargs = ps.nargs ?? "1";
    if (nargs === "*" || nargs === "+") {
      const taken = positional.slice(cursor);
      cursor = positional.length;
      if (nargs === "+" && !taken.length) {
        throw new CliError(`{PROG} ${command} 需要至少一个 ${ps.metavar ?? ps.dest}`);
      }
      args[ps.dest] = taken;
    } else {
      const taken = positional[cursor];
      cursor += taken === undefined ? 0 : 1;
      if (taken === undefined && nargs === "1") {
        throw new CliError(`{PROG} ${command} 需要一个 ${ps.metavar ?? ps.dest}`);
      }
      args[ps.dest] = taken;
    }
  }
  if (cursor < positional.length) {
    throw new CliError(`多余的参数：${positional.slice(cursor).join(" ")}`);
  }
  return { command, args, help: null };
}

function optLabel(o: OptSpec): string {
  const head = o.short ? `${o.short}, ${o.flag}` : o.flag;
  if (o.type === "flag") return head;
  return `${head} ${o.metavar ?? (o.choices ? `{${o.choices.join(",")}}` : "值")}`;
}

function block(items: { label: string; help: string }[], indent = "  "): string[] {
  const size = Math.max(...items.map((it) => width(it.label))) + 2;
  return items.map((it) => `${indent}${pad(it.label, size)}${it.help}`);
}

export function renderHelp(
  prog: string,
  commands: readonly CommandSpec[],
  common: readonly OptSpec[],
  command: string | null,
  description: string,
): string {
  const lines: string[] = [];
  if (!command) {
    const usage = commands.map((c) => c.name).join(" | ");
    lines.push(`用法: ${prog} [${usage}] ...`, "", description, "", "子命令:");
    lines.push(...block(commands.map((c) => ({ label: c.name, help: c.help }))));
    lines.push("", "通用选项:");
    lines.push(...block(common.map((o) => ({ label: optLabel(o), help: o.help }))));
    lines.push("", `每个子命令的细节：${prog} <子命令> --help`);
    return lines.join("\n");
  }
  const spec = commands.find((c) => c.name === command)!;
  const posPart = (spec.pos ?? [])
    .map((p) => {
      const label = p.metavar ?? p.dest;
      const n = p.nargs ?? "1";
      if (n === "?") return `[${label}]`;
      if (n === "*") return `[${label} ...]`;
      if (n === "+") return `${label} [${label} ...]`;
      return `<${label}>`;
    })
    .join(" ");
  lines.push(`用法: ${prog} ${command} ${posPart}`.trimEnd(), "", spec.help);
  if (spec.pos?.length) {
    lines.push("", "位置参数:");
    lines.push(...block(spec.pos.map((p) => ({ label: p.metavar ?? p.dest, help: p.help }))));
  }
  const all = [...(spec.opts ?? []), ...common];
  lines.push("", "选项:");
  lines.push(...block(all.map((o) => ({ label: optLabel(o), help: o.help }))));
  return lines.join("\n");
}
