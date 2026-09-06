/**
 * 专题的教学卡片对外入口。
 *
 * 卡片内容在 cards.ts（手写），识别信号在 signals.ts（由打标规则生成）。
 * 两者合起来构成 `sinan learn` 和计划页顶部「开练前先看」的全部内容。
 */

import { CODE_TO_TAG } from "../build/rules/codeprint.data.js";
import { PHRASE_PROBES } from "../build/rules/statement.data.js";
import { CAT_NOTES, SUB_NOTES, type Note } from "./cards.js";

export type { Note };
export { CAT_NOTES, SUB_NOTES };

/** 弱信号不写进教学，免得误导。 */
const MIN_STRENGTH = 0.55;

/**
 * 「什么时候想到它」直接从打标规则反查，不手写。
 *
 * `statement.data.ts` 的问法规则本来就是「看到这种问法 → 该用这个解法」，正是识别
 * 信号本身。手写一遍等于把同一件事说两遍，改了一处另一处就会过时。这里直接引用
 * 同一张表，所以教学卡片上写的判断依据，和系统实际打标的依据永远一致。
 */
const SIGNALS: Record<string, string[]> = (() => {
  const bySub: Record<string, string[]> = {};
  for (const [aid, , strength, why] of PHRASE_PROBES) {
    const sub = CODE_TO_TAG[aid];
    if (!sub || strength < MIN_STRENGTH) continue;
    const bucket = bySub[sub] ?? [];
    if (!bucket.includes(why)) bucket.push(why);
    bySub[sub] = bucket;
  }
  return bySub;
})();

/** 同一批规则按思路本身索引一份，给树上更深的那层节点用（它的 id 就是思路 id）。 */
const SIGNALS_BY_APPROACH: Record<string, string[]> = (() => {
  const byId: Record<string, string[]> = {};
  for (const [aid, , strength, why] of PHRASE_PROBES) {
    if (strength < MIN_STRENGTH) continue;
    const bucket = byId[aid] ?? [];
    if (!bucket.includes(why)) bucket.push(why);
    byId[aid] = bucket;
  }
  return byId;
})();

/**
 * 「什么时候想到它」：这几条也是打标时实际用的判断依据。
 *
 * 深层节点（`math-sieve` 这种）给它自己那条；二级节点给它底下所有技巧的合集。
 */
export function signals(topicId: string): string[] {
  return SIGNALS_BY_APPROACH[topicId] ?? SIGNALS[topicId] ?? [];
}

/** 专题 id -> 教学卡片。大类和子标签都能查。 */
export function noteFor(topicId: string): Note | null {
  return SUB_NOTES[topicId] ?? CAT_NOTES[topicId] ?? null;
}

/**
 * 核心思想的第一句，给目录这类一行一条的地方用。
 * 终端的讲解总目录和网页的讲解列表都走这里，两边措辞不会各写各的。
 *
 * 有几张卡片的开头是「网格连通块。」这种六个字的引子，单独拎出来什么都没说，
 * 所以不够长就继续取下一句，直到说清楚一件事为止。
 */
export function gist(topicId: string, fallback = ""): string {
  const text = noteFor(topicId)?.idea ?? fallback;
  const flat = (text || "").replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replaceAll("`", "").replace(/\s+/g, " ").trim();
  const MIN = 12;
  let end = 0;
  while (end < flat.length) {
    const next = flat.slice(end).search(/[。；]/);
    if (next < 0) return flat;
    end += next + 1;
    if (end >= MIN) break;
  }
  return end > 0 ? flat.slice(0, end) : flat;
}

export function hasNote(topicId: string): boolean {
  return topicId in SUB_NOTES || topicId in CAT_NOTES || signals(topicId).length > 0;
}

/** (专题 id, 标题, URL)，用来体检链接。 */
export function allRefs(): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const src of [CAT_NOTES, SUB_NOTES]) {
    for (const [tid, note] of Object.entries(src)) {
      for (const [title, url] of note.refs ?? []) out.push([tid, title, url]);
    }
  }
  return out;
}
