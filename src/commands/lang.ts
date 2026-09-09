/**
 * `sinan lang` —— 语言基础速查。
 *
 * 不带参数列出所有小节；给一个小节 id 就展开那一节的最小代码示例。
 * 内容跟题库无关，所以是 standalone 命令,不需要 store。
 */

import type { Args } from "../args.js";
import { CliError } from "../errors.js";
import { GUIDES, langGuide, langSection, type LangGuide } from "../notes/lang.js";
import { out, PROG } from "../out.js";
import * as r from "../render.js";
import { splitLines } from "../util.js";

/** 一段代码:注释行标绿,其余原样,统一缩进两格。 */
function printCode(code: string): void {
  for (const line of splitLines(code)) {
    const isComment = line.trimStart().startsWith("#");
    out(`  ${isComment ? r.paint(line, "lime") : line}`);
  }
}

function printSection(guide: LangGuide, sectionId: string): void {
  const sec = langSection(guide, sectionId);
  if (!sec) {
    throw new CliError(`${guide.name} 没有这一节：${sectionId}\n`
      + `用 ${PROG} lang（不带参数）看全部小节`);
  }
  out("", r.heading(`${guide.name} · ${sec.name}`, sec.blurb));
  for (const snip of sec.snippets) {
    out("", r.rule(snip.title));
    printCode(snip.code);
  }
  out("");
}

function printIndex(guide: LangGuide): void {
  out("", r.heading(`语言基础 · ${guide.name}`,
    `${guide.sections.length} 节 · 写算法题够用的最小代码示例`));
  out(`  ${r.paint(guide.tagline, "gray")}`);
  out(r.paint(`  展开一节：${PROG} lang <小节 id>`, "gray"));
  if (GUIDES.length > 1) {
    const others = GUIDES.map((g) => g.id).join(" / ");
    out(r.paint(`  换语言：${PROG} lang --guide <${others}>`, "gray"));
  }
  const rows = guide.sections.map((s) => [
    `  ${r.paint(s.name, "amber")}`,
    r.paint(s.id, "gray"),
    r.paint(`${s.snippets.length} 段`, "gray"),
    r.trunc(s.blurb, Math.max(20, r.termWidth() - 40)),
  ]);
  out(r.table(["  小节", `${PROG} lang`, "", "覆盖"], rows,
    ["left", "left", "right", "left"]));
  out("");
}

export function cmdLang(args: Args): void {
  const guide = langGuide(args["guide"] as string | undefined);
  if (!guide) {
    const ids = GUIDES.map((g) => g.id).join(" / ");
    throw new CliError(`没有这门语言。目前支持：${ids}`);
  }
  const section = args["section"] as string | undefined;
  if (section) printSection(guide, section);
  else printIndex(guide);
}
