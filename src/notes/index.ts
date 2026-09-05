/**
 * 专题的教学卡片对外入口。
 *
 * 卡片内容在 cards.ts（手写），识别信号在 signals.ts（由打标规则生成）。
 * 两者合起来构成 `sinan learn` 和计划页顶部「开练前先看」的全部内容。
 */

import { CAT_NOTES, SUB_NOTES, type Note } from "./cards.js";
import { SIGNALS } from "./signals.js";

export type { Note };
export { CAT_NOTES, SUB_NOTES };

/** 「什么时候想到它」：这几条也是打标时实际用的判断依据。 */
export function signals(subId: string): string[] {
  return SIGNALS[subId] ?? [];
}

/** 专题 id -> 教学卡片。大类和子标签都能查。 */
export function noteFor(topicId: string): Note | null {
  return SUB_NOTES[topicId] ?? CAT_NOTES[topicId] ?? null;
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
