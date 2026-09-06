/**
 * 体检教学卡片里的 OI-Wiki 延伸阅读链接。
 *
 * 要联网，所以不放进 `npm test` —— 离线环境不该因为 oi-wiki 改版而测试挂掉。
 * 跑法：npm run check:links
 */

import { allRefs } from "../notes/index.js";

const CONCURRENCY = 8;

async function probe(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "sinan-notes-linkcheck" },
      signal: AbortSignal.timeout(20_000),
    });
    return String(resp.status);
  } catch (err) {
    return err instanceof Error ? err.name : "Error";
  }
}

async function main(): Promise<void> {
  const refs = allRefs();
  const urls = [...new Set(refs.map((r) => r[2]))].sort();
  const owner = new Map<string, string>();
  for (const [tid, , url] of refs) if (!owner.has(url)) owner.set(url, tid);
  process.stdout.write(`延伸阅读 ${refs.length} 条，去重后 ${urls.length} 个页面，逐个体检：\n`);

  const results: [string, string][] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= urls.length) return;
      results.push([urls[i]!, await probe(urls[i]!)]);
    }
  }));

  const bad = results.filter(([, s]) => s !== "200");
  process.stdout.write(`  200 OK: ${results.length - bad.length}/${results.length}\n`);
  for (const [url, status] of bad.sort()) {
    process.stdout.write(`  ! ${status}  ${url}   （出现在 ${owner.get(url)}）\n`);
  }
  if (bad.length) process.exitCode = 1;
}

void main();
