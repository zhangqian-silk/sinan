/**
 * 判定「偏薄」体检：找出可能漏了解法的人工判定。
 *
 * 起因是一次真实的失误 —— 清理脚本噪音标签时，把噪音「碰巧指对」的真解法一并删掉了：
 * #769 只留了「前缀最大值等于下标」一种，而它的第二版 #768 明明写了三种，
 * 其中单调栈和「与排序后比前缀和」两条在 #769 上照样成立。
 *
 * 单解法本身不是错 —— 很多题确实只有一种主流写法。所以这里只报「可疑」，不报错，
 * 用两个互相独立的信号交叉验证，人工复核后再决定要不要补：
 *
 * 1. 同族落差：slug 只差罗马数字/序号的一组题里，解法数相差过大。
 *    同族题往往共享解法体系，落差通常意味着少的那道漏了。
 * 2. 高频单解：中等/困难 + 面试频次高 + 只写了一种解法。
 *    这类题几乎不可能只有一种主流写法。
 *
 * 跑法：
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-thin.js
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-thin.js --freq 50   # 只看更高频的
 *   SINAN_DATA_ROOT=<数据根> node dist/tools/review-thin.js --limit 40
 */

import { distDir } from "../build/io.js";
import { loadReviews } from "../build/reviews.js";
import { openStore } from "../host-node.js";
import { sortBy } from "../util.js";

/** 去掉 slug 末尾的罗马数字或序号，用来把同族题归到一起。 */
function familyKey(slug: string): string {
  return slug.replace(/-(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/, "");
}

function main(): void {
  const argv = process.argv.slice(2);
  const flag = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? (argv[i + 1] ?? "") : "";
  };
  const minFreq = parseInt(flag("--freq") || "30", 10);
  const limit = parseInt(flag("--limit") || "25", 10);

  const store = openStore({ dataDir: distDir(), progressFile: "/dev/null" });
  const done = loadReviews();
  const bySlug = new Map(store.problems.map((p) => [p.slug, p]));

  const counts = new Map<string, number>();
  for (const [slug, r] of done) counts.set(slug, r.solutions.length);

  // --- 信号一：同族落差 -----------------------------------------------------
  const fams = new Map<string, string[]>();
  for (const slug of counts.keys()) {
    const key = familyKey(slug);
    fams.set(key, [...(fams.get(key) ?? []), slug]);
  }
  const gaps: { slugs: string[]; gap: number }[] = [];
  for (const slugs of fams.values()) {
    if (slugs.length < 2) continue;
    const nums = slugs.map((s) => counts.get(s) ?? 0);
    const gap = Math.max(...nums) - Math.min(...nums);
    if (gap >= 2) gaps.push({ slugs, gap });
  }

  process.stdout.write(`同族题解法数落差 ≥ 2（共 ${String(gaps.length)} 组）：\n`);
  for (const { slugs } of sortBy(gaps, (g) => [-g.gap])) {
    for (const s of sortBy(slugs, (x) => [-(counts.get(x) ?? 0)])) {
      const p = bySlug.get(s);
      const n = counts.get(s) ?? 0;
      const id = String(p?.id ?? "?").padEnd(6);
      const diff = (p?.difficulty ?? "").slice(0, 6).padEnd(7);
      process.stdout.write(`  ${String(n)} 种  #${id} ${diff} ${p?.title ?? s}\n`);
    }
    process.stdout.write("\n");
  }

  // --- 信号二：高频单解 -----------------------------------------------------
  const thin = store.problems.filter((p) => {
    if ((counts.get(p.slug) ?? 0) !== 1) return false;
    if (p.difficulty !== "MEDIUM" && p.difficulty !== "HARD") return false;
    return (p.freq || 0) >= minFreq;
  });
  const ranked = sortBy(thin, (p) => [-(p.freq || 0)]);
  const single = [...counts.values()].filter((n) => n === 1).length;

  process.stdout.write(
    `\n高频单解法（中等/困难，频次 ≥ ${String(minFreq)}）：共 ${String(ranked.length)} 道\n`,
  );
  for (const p of ranked.slice(0, limit)) {
    const diff = p.difficulty.slice(0, 6).padEnd(7);
    process.stdout.write(
      `  频次 ${String(p.freq).padStart(4)}  #${String(p.id).padEnd(6)} ${diff} ${p.title}\n`,
    );
  }
  process.stdout.write(
    `\n全库单解法判定 ${String(single)} / ${String(counts.size)} 条`
    + `（单解法不一定是问题，上面两个信号只是提示优先复核哪些）\n`,
  );
}

main();
