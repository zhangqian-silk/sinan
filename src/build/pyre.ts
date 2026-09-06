/**
 * Python 正则 → JS 正则。
 *
 * 打标规则全部是从 Python 逐字搬过来的，不能只是「看着差不多」。两处真实差异：
 *
 * 1. **`\w` 的口径**。Python 的 `\w` 认 Unicode 词字符（中日韩都算），JS 的只认
 *    ASCII。规则里有 42 条带 `\b` 且同时含中文分支，比如 `\bdfs\b|深搜`——
 *    文本「用dfs解」在 Python 里因为 `用` 算词字符所以**不匹配**，直接搬到 JS
 *    会**匹配**，凭空多抓一批。
 * 2. **`u` 标志的严格性**。开了 `u` 才能用 `\p{...}`，但 `u` 会拒绝 `\-` 这类
 *    多余转义，而 Python 是容忍的。
 *
 * 所以这里做一次源码级翻译：`\b` `\B` `\w` `\W` 换成 Unicode 口径的等价写法，
 * 多余转义就地拆掉，字符类内部原样保留（类里的 `\b` 在两边都是退格符）。
 */

/** Python 的 `\w`：字母 + 数字 + 下划线，按 Unicode 算。 */
const WORD = "\\p{L}\\p{N}_";
const IN_WORD = `[${WORD}]`;
const NOT_WORD = `[^${WORD}]`;

/** `\b`：一侧是词字符、另一侧不是。 */
const BOUNDARY = `(?:(?<=${IN_WORD})(?!${IN_WORD})|(?<!${IN_WORD})(?=${IN_WORD}))`;
/** `\B`：两侧同类。 */
const NOT_BOUNDARY = `(?:(?<=${IN_WORD})(?=${IN_WORD})|(?<!${IN_WORD})(?!${IN_WORD}))`;

/** `u` 模式下允许跟在反斜杠后面的字符；其余的多余转义要拆掉。 */
const KEEP_ESCAPE = new Set([
  ..."^$\\.*+?()[]{}|/",
  ..."dDsSwWbBnrtvf0xucpPkq",
  ..."123456789",
]);

/**
 * 翻译一条 Python 正则源码。
 *
 * 字符类内部不动 `\w` 之外的东西：`[\w-]` 要变成 `[\p{L}\p{N}_-]`，
 * 但 `[\b]` 是退格符，两边一致，保持原样。
 */
export function translate(pattern: string): string {
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch !== "\\") {
      if (ch === "[") inClass = true;
      else if (ch === "]") inClass = false;
      out += ch;
      continue;
    }
    const next = pattern[i + 1];
    if (next === undefined) { out += "\\"; continue; }
    i += 1;
    if (inClass) {
      if (next === "w") { out += WORD; continue; }
      if (next === "W") {
        // 类里没法直接表达「非词字符」，只能退回 JS 原生语义并记一笔
        out += "\\W";
        continue;
      }
      out += KEEP_ESCAPE.has(next) ? `\\${next}` : next;
      continue;
    }
    switch (next) {
      case "w": out += IN_WORD; break;
      case "W": out += NOT_WORD; break;
      case "b": out += BOUNDARY; break;
      case "B": out += NOT_BOUNDARY; break;
      default: out += KEEP_ESCAPE.has(next) ? `\\${next}` : next;
    }
  }
  return out;
}

const cache = new Map<string, RegExp>();

/**
 * 编译一条 Python 正则。`flags` 用 Python 的写法：`i` 忽略大小写、`m` 多行、`s` 点匹配换行。
 * 结果带缓存 —— 打标要在几万段代码上反复跑同一批规则。
 */
export function py(pattern: string, flags = ""): RegExp {
  const key = `${flags}\u0000${pattern}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rx = new RegExp(translate(pattern), `${flags}u`);
  cache.set(key, rx);
  return rx;
}

/** 带 `g` 的版本，给需要 `finditer` 的地方用（每次调用返回新对象，免得 lastIndex 串味）。 */
export function pyGlobal(pattern: string, flags = ""): RegExp {
  return new RegExp(translate(pattern), `${flags}gu`);
}

/** 相当于 Python 的 `re.search(...)` 是否命中。 */
export function search(pattern: string, text: string, flags = ""): boolean {
  return py(pattern, flags).test(text);
}
