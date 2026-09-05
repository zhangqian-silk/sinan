/**
 * 终端渲染：中英混排对齐、颜色、表格、进度条。
 *
 * 中文占两列，直接数字符个数会错位，所以所有对齐都走 width()。
 * 管道输出或设置 NO_COLOR 时自动去掉颜色。
 */

import type { Store } from "./store.js";
import { DIFF_CN } from "./store.js";
import type { Problem } from "./types.js";
import { type Align, pad, pyRound, splitLines, trunc, width, wrap } from "./util.js";

// 纯文本排版（宽度、对齐、折行）放在 util，帮助文本那边也要用；这里转出去，
// 调用侧照旧写 r.pad / r.trunc / r.wrap。
export { pad, trunc, width, wrap };
export type { Align };

const SMART_TERM = Boolean(process.stdout.isTTY)
  && !["", "dumb"].includes(process.env["TERM"] ?? "");
const FORCE_PLAIN = Boolean(process.env["NO_COLOR"]);

// 超链接和颜色是两件事：NO_COLOR 只关颜色，哑终端两个都关
let COLOR = SMART_TERM && !FORCE_PLAIN;
let LINKS = SMART_TERM;

export const C: Record<string, string> = {
  reset: "\u001b[0m", dim: "\u001b[2m", bold: "\u001b[1m",
  red: "\u001b[31m", green: "\u001b[32m", yellow: "\u001b[33m",
  blue: "\u001b[34m", magenta: "\u001b[35m", cyan: "\u001b[36m", gray: "\u001b[90m",
  amber: "\u001b[38;5;214m", orange: "\u001b[38;5;209m", teal: "\u001b[38;5;73m",
  violet: "\u001b[38;5;141m", lime: "\u001b[38;5;149m", pink: "\u001b[38;5;211m",
  steel: "\u001b[38;5;110m", sand: "\u001b[38;5;180m",
};

export const CAT_COLOR: Record<string, string> = {
  basics: "gray", array: "steel", "ds-basic": "teal", string: "lime",
  "binary-search": "sand", tree: "amber", search: "orange", dp: "red",
  graph: "violet", greedy: "magenta", math: "blue", "advanced-ds": "pink",
  design: "cyan",
};

export const DIFF_COLOR: Record<string, string> = { EASY: "green", MEDIUM: "amber", HARD: "red" };

/** 思路按领域上色：树/图/DP/数学各自一个色系。 */
export const DOMAIN_COLOR: Record<string, string> = {
  tree: "amber", graph: "violet", dp: "red", math: "blue", ds: "teal",
  string: "lime", search: "orange", greedy: "magenta", list: "steel", other: "gray",
};

export function setColor(enabled: boolean | null): void {
  if (enabled === null) return;
  COLOR = enabled && !FORCE_PLAIN;
  if (!enabled) LINKS = false;
}

export function paint(text: string, ...styles: string[]): string {
  if (!COLOR || !styles.length) return text;
  const prefix = styles.filter((s) => s in C).map((s) => C[s]).join("");
  return prefix ? `${prefix}${text}${C["reset"]}` : text;
}

/** 终端超链接（OSC 8）。支持的终端里可以直接点，不支持的只会看到纯文本。 */
export function hyperlink(label: string, url: string): string {
  if (!url || !LINKS) return label;
  return `\u001b]8;;${url}\u001b\\${label}\u001b]8;;\u001b\\`;
}

export function termWidth(): number {
  const fromEnv = process.env["COLUMNS"] ? parseInt(process.env["COLUMNS"]!, 10) : NaN;
  const cols = Number.isFinite(fromEnv) ? fromEnv : (process.stdout.columns ?? 80);
  return Math.max(60, Math.min(cols, 200));
}

export function table(
  headers: string[],
  rows: string[][],
  aligns?: Align[],
  gap = "  ",
): string {
  if (!rows.length) return paint("  （没有内容）", "gray");
  const cols = headers.length;
  const al: Align[] = aligns ?? Array<Align>(cols).fill("left");
  const sizes = headers.map((h) => width(h));
  for (const row of rows) {
    for (let i = 0; i < cols; i += 1) sizes[i] = Math.max(sizes[i]!, width(row[i] ?? ""));
  }
  const head = headers
    .map((h, i) => paint(pad(h, sizes[i]!, al[i] ?? "left"), "gray"))
    .join(gap);
  const lines = [head];
  for (const row of rows) {
    lines.push(row.slice(0, cols).map((cell, i) => pad(cell, sizes[i]!, al[i] ?? "left")).join(gap));
  }
  return lines.join("\n");
}

export function bar(done: number, total: number, size = 18, color = "amber"): string {
  const ratio = total ? done / total : 0;
  const filled = pyRound(ratio * size);
  return paint("█".repeat(filled), color) + paint("░".repeat(size - filled), "gray");
}

export function rule(title = "", char = "─", color = "gray"): string {
  const total = termWidth();
  if (!title) return paint(char.repeat(total), color);
  const left = paint(char.repeat(2), color);
  const right = paint(char.repeat(Math.max(0, total - width(title) - 4)), color);
  return `${left} ${title} ${right}`;
}

export function heading(text: string, sub = ""): string {
  let line = paint(text, "bold");
  if (sub) line += `  ${paint(sub, "gray")}`;
  return line;
}

export function diffTag(p: Problem): string {
  return paint(DIFF_CN[p.difficulty], DIFF_COLOR[p.difficulty]!);
}

export function tagChips(p: Problem, limit = 3): string {
  const chips = p.tags.slice(0, limit).map((t) => paint(t.name, CAT_COLOR[t.cat] ?? "steel"));
  const rest = p.tags.length - limit;
  if (rest > 0) chips.push(paint(`+${rest}`, "gray"));
  return chips.join(" ");
}

export function approachChips(p: Problem, limit = 3): string {
  const fp = p.approach ?? [];
  if (!fp.length) return paint("—", "gray");
  const guessed = fp[0]!.from === "tags";
  const chips = fp.slice(0, limit)
    .map((a) => paint(a.name, guessed ? "gray" : (DOMAIN_COLOR[a.domain] ?? "steel")));
  const rest = fp.length - limit;
  if (rest > 0) chips.push(paint(`+${rest}`, "gray"));
  if (guessed) chips.push(paint("(推断)", "gray"));
  return chips.join(" ");
}

export function mark(store: Store, p: Problem): string {
  if (store.filesOf(p).length) return paint("✔", "green");
  if (store.isChecked(p)) return paint("✓", "green");
  return " ";
}

export function hotCell(p: Problem): string {
  if (!p.freq) return paint("—", "gray");
  return paint(String(p.freq), "orange");
}

// --- 题面 HTML -> 终端纯文本 -------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  hellip: "…", mdash: "—", ndash: "–", minus: "−", times: "×", divide: "÷",
  le: "≤", ge: "≥", ne: "≠", plusmn: "±", deg: "°", infin: "∞", empty: "∅",
  rarr: "→", larr: "←", uarr: "↑", darr: "↓", harr: "↔",
  Sigma: "Σ", sigma: "σ", alpha: "α", beta: "β", pi: "π", mu: "μ",
  sum: "∑", radic: "√", isin: "∈", notin: "∉", sube: "⊆", cap: "∩", cup: "∪",
  middot: "·", bull: "•", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£",
  frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³",
};

function unescapeHtml(text: string): string {
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

/** 把题面 HTML 压成终端能看的纯文本。 */
export function htmlToText(html: string, limitCols = 92): string {
  let text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|li|ul|ol|pre|h[1-6])>/gi, "\n");
  text = text.replace(/<li>/gi, "· ");
  text = text.replace(/<[^>]+>/g, "");
  text = unescapeHtml(text).replaceAll("\u00a0", " ");

  const out: string[] = [];
  for (const raw of splitLines(text)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(...wrap(line.trim(), limitCols));
  }
  return out.join("\n").trim();
}

/** 去掉 **强调** 标记，只留文字（折行要按去掉标记后的宽度算）。 */
export function stripEmph(text: string): string {
  return (text || "").replace(/\*\*([\s\S]+?)\*\*/g, "$1");
}
