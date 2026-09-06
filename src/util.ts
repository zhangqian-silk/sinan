/**
 * 通用工具：显示宽度、Python 语义的取整与格式化、排序比较器。
 *
 * 这个文件存在的唯一理由是「和 Python 版逐字一致」：
 * - 中文占两列，宽度表直接从 CPython 的 `unicodedata`（Unicode 15.0）导出，不靠猜；
 * - Python 的 `round()` 和 `f"{x:.0f}"` 都是**四舍六入五成双**，JS 的 `Math.round`
 *   / `toFixed` 是五入，`12.5` 一个会给 12 一个会给 13。展示层到处在算百分比，
 *   这种差异会直接漏到终端输出里，所以按精确十进制展开重新实现一遍。
 */

// --- 显示宽度 -----------------------------------------------------------------

/** East Asian Width 为 W / F 的码点区间（Unicode 15.0.0，与 CPython 一致）。 */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec],
  [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615],
  [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5],
  [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x2e99],
  [0x2e9b, 0x2ef3], [0x2f00, 0x2fd5], [0x2ff0, 0x2ffb], [0x3000, 0x303e],
  [0x3041, 0x3096], [0x3099, 0x30ff], [0x3105, 0x312f], [0x3131, 0x318e],
  [0x3190, 0x31e3], [0x31f0, 0x321e], [0x3220, 0x3247], [0x3250, 0x4dbf],
  [0x4e00, 0xa48c], [0xa490, 0xa4c6], [0xa960, 0xa97c], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe52], [0xfe54, 0xfe66],
  [0xfe68, 0xfe6b], [0xff01, 0xff60], [0xffe0, 0xffe6], [0x16fe0, 0x16fe4],
  [0x16ff0, 0x16ff1], [0x17000, 0x187f7], [0x18800, 0x18cd5], [0x18d00, 0x18d08],
  [0x1aff0, 0x1aff3], [0x1aff5, 0x1affb], [0x1affd, 0x1affe], [0x1b000, 0x1b122],
  [0x1b132, 0x1b132], [0x1b150, 0x1b152], [0x1b155, 0x1b155], [0x1b164, 0x1b167],
  [0x1b170, 0x1b2fb], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a], [0x1f200, 0x1f202], [0x1f210, 0x1f23b], [0x1f240, 0x1f248],
  [0x1f250, 0x1f251], [0x1f260, 0x1f265], [0x1f300, 0x1f320], [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca], [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc], [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a], [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc], [0x1f6d0, 0x1f6d2], [0x1f6d5, 0x1f6d7],
  [0x1f6dc, 0x1f6df], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc], [0x1f7e0, 0x1f7eb],
  [0x1f7f0, 0x1f7f0], [0x1f90c, 0x1f93a], [0x1f93c, 0x1f945], [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1fa7c], [0x1fa80, 0x1fa88], [0x1fa90, 0x1fabd], [0x1fabf, 0x1fac5],
  [0x1face, 0x1fadb], [0x1fae0, 0x1fae8], [0x1faf0, 0x1faf8], [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

/** 这个码点在终端里占两列吗。 */
export function isWide(cp: number): boolean {
  let lo = 0;
  let hi = WIDE_RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = WIDE_RANGES[mid]!;
    if (cp < range[0]) hi = mid - 1;
    else if (cp > range[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** 单个字符的显示宽度（按码点，和 Python 的字符串迭代口径一致）。 */
export function charWidth(ch: string): number {
  const cp = ch.codePointAt(0);
  return cp !== undefined && isWide(cp) ? 2 : 1;
}

/** 显示宽度：跳过颜色和超链接的控制序列，中文按两列算。 */
export function width(text: string): number {
  const chars = [...text];
  let total = 0;
  let i = 0;
  const n = chars.length;
  while (i < n) {
    if (chars[i] === "\u001b") {
      if (i + 1 < n && chars[i + 1] === "]") {
        // OSC（超链接）以 ESC \ 结束
        let end = -1;
        for (let j = i; j + 1 < n; j += 1) {
          if (chars[j] === "\u001b" && chars[j + 1] === "\\") { end = j; break; }
        }
        i = end !== -1 ? end + 2 : n;
      } else {
        // CSI（颜色）以 m 结束
        let j = i;
        while (j < n && chars[j] !== "m") j += 1;
        i = j + 1;
      }
      continue;
    }
    total += charWidth(chars[i]!);
    i += 1;
  }
  return total;
}

export type Align = "left" | "right" | "center";

export function pad(text: string, size: number, align: Align = "left"): string {
  const gap = Math.max(0, size - width(text));
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") {
    const half = Math.floor(gap / 2);
    return " ".repeat(half) + text + " ".repeat(gap - half);
  }
  return text + " ".repeat(gap);
}

export function trunc(text: string, limit: number): string {
  if (width(text) <= limit) return text;
  const out: string[] = [];
  let used = 0;
  for (const ch of text) {
    const step = charWidth(ch);
    if (used + step > limit - 1) break;
    out.push(ch);
    used += step;
  }
  return `${out.join("")}…`;
}

/** 按显示宽度折行，中英混排都按实际占位算。 */
export function wrap(text: string, limit: number): string[] {
  const lines: string[] = [];
  let cur: string[] = [];
  let used = 0;
  for (const ch of text) {
    const step = charWidth(ch);
    if (used + step > limit) {
      lines.push(cur.join(""));
      cur = [];
      used = 0;
    }
    cur.push(ch);
    used += step;
  }
  if (cur.length) lines.push(cur.join(""));
  return lines;
}

// --- Python 语义的取整与格式化 ---------------------------------------------------

/**
 * Python 的 `round(x)`：四舍六入五成双。
 *
 * `x - floor(x) === 0.5` 这个判断在 |x| < 2^52 时是精确的 —— 只有当 x 恰好是
 * 某个整数加二分之一时，双精度才会给出正好 0.5 的差值。
 */
export function pyRound(x: number): number {
  if (!Number.isFinite(x)) return x;
  const fl = Math.floor(x);
  const diff = x - fl;
  if (diff > 0.5) return fl + 1;
  if (diff < 0.5) return fl;
  return fl % 2 === 0 ? fl : fl + 1;
}

/** 把 double 拆成精确的十进制：x = digits / 10^scale，一位不差。 */
function exactDecimal(x: number): { digits: bigint; scale: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const rawExp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exp: number;
  if (rawExp === 0) {
    exp = -1074;
  } else {
    mant |= 1n << 52n;
    exp = rawExp - 1075;
  }
  if (exp >= 0) return { digits: mant << BigInt(exp), scale: 0 };
  const k = -exp;
  return { digits: mant * 5n ** BigInt(k), scale: k };
}

/** Python 的 `f"{x:.<nd>f}"`：按精确值做「五成双」舍入。 */
export function fixed(x: number, nd: number): string {
  if (!Number.isFinite(x)) return String(x);
  const neg = x < 0;
  const { digits, scale } = exactDecimal(Math.abs(x));
  let scaled: bigint;
  if (scale <= nd) {
    scaled = digits * 10n ** BigInt(nd - scale);
  } else {
    const shift = BigInt(scale - nd);
    const pow = 10n ** shift;
    const q = digits / pow;
    const r = digits % pow;
    const half = pow / 2n;
    if (r > half) scaled = q + 1n;
    else if (r < half) scaled = q;
    else scaled = q % 2n === 0n ? q : q + 1n;
  }
  let body = scaled.toString();
  if (nd > 0) {
    body = body.padStart(nd + 1, "0");
    body = `${body.slice(0, body.length - nd)}.${body.slice(body.length - nd)}`;
  }
  return neg && /[1-9]/.test(body) ? `-${body}` : body;
}

/** Python 的 `round(x, nd)`，返回数值。 */
export function pyRoundTo(x: number, nd: number): number {
  return Number(fixed(x, nd));
}

/**
 * Python 的 `str(float)`。
 *
 * JSON 里 `2.0` 解析进 JS 就变成整数 2，直接拼进字符串会显示成「区分度 2」，
 * 而 Python 显示的是「区分度 2.0」。区分度、可信度这些字段在产物里全是浮点，
 * 所以按浮点口径渲染：整数值补上 `.0`，其余交给 JS 的最短往返表示 ——
 * 它和 CPython 的 repr 用的是同一套算法。
 */
export function pyFloat(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return Number.isInteger(x) ? `${x}.0` : String(x);
}

/**
 * Python 的 `str.splitlines()`。
 *
 * 和 `split("\n")` 有两处关键差别，本地题解里真的会踩到：CRLF 结尾的文件会留下
 * 一串 `\r`，而以换行结尾的文本不该多出一个空行。
 */
export function splitLines(text: string): string[] {
  if (!text) return [];
  const parts = text.split(/\r\n|[\n\r\v\f\u001c\u001d\u001e\u0085\u2028\u2029]/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

// --- 排序 ---------------------------------------------------------------------

export type SortKey = ReadonlyArray<number | string | boolean>;

// --- HTML 实体 -----------------------------------------------------------------

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

/** 相当于 Python 的 `html.unescape`：认得出的实体还原，认不出的原样留着。 */
export function unescapeHtml(text: string): string {
  return text.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (whole, body: string) => {
      if (body.startsWith("#")) {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[body] ?? whole;
    },
  );
}

function cmpKey(a: SortKey, b: SortKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (x === y) continue;
    if (typeof x === "string" || typeof y === "string") {
      return String(x) < String(y) ? -1 : 1;
    }
    return Number(x) < Number(y) ? -1 : 1;
  }
  return a.length - b.length;
}

/**
 * 对应 Python 的 `sorted(items, key=...)`：多元组按位比较，且保持稳定。
 * JS 的 `Array.prototype.sort` 从 ES2019 起就是稳定排序，和 Python 一致。
 */
export function sortBy<T>(items: readonly T[], key: (item: T) => SortKey): T[] {
  return [...items].sort((a, b) => cmpKey(key(a), key(b)));
}

/** 计数器：保持首次出现的顺序，等价于 Python 的 `Counter`。 */
export class Counter<K> {
  private readonly map = new Map<K, number>();

  add(key: K, n = 1): void {
    this.map.set(key, (this.map.get(key) ?? 0) + n);
  }

  update(keys: Iterable<K>): void {
    for (const key of keys) this.add(key);
  }

  get(key: K): number {
    return this.map.get(key) ?? 0;
  }

  entries(): [K, number][] {
    return [...this.map.entries()];
  }

  /** 计数最高的一个，并列时取先出现的（和 Python 的 `most_common(1)` 一致）。 */
  top(): K | undefined {
    let best: K | undefined;
    let bestN = -Infinity;
    for (const [key, n] of this.map) {
      if (n > bestN) {
        best = key;
        bestN = n;
      }
    }
    return best;
  }

  toObject(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, n] of this.map) out[String(key)] = n;
    return out;
  }
}
