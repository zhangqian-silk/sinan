/**
 * 抓取洛谷题库（尽力而为）。
 *
 * 洛谷对无 Cookie 的请求会 302 挡掉。拿到浏览器里的 Cookie 后：
 *
 *     LUOGU_COOKIE='__client_id=...; _uid=...' sinan sync
 *
 * 成功后写出 `<数据根>/raw/extra_luogu.json`，下次构建会自动并进题库。
 * 抓不到时不会写脏数据，只提示原因。
 */

import { join } from "node:path";

import { dumpJson, rawDir } from "../io.js";
import { sleep, UA } from "../http.js";
import { pyRoundTo } from "../../util.js";

const LIST_URL = "https://www.luogu.com.cn/problem/list?_contentOnly=1&page=";
const DIFF_MAP: Record<number, string> = {
  0: "MEDIUM", 1: "EASY", 2: "EASY", 3: "MEDIUM", 4: "MEDIUM", 5: "HARD", 6: "HARD", 7: "HARD",
};

interface LuoguProblem {
  pid?: string;
  title?: string;
  difficulty?: number;
  tags?: unknown[];
  totalAccepted?: number;
  totalSubmit?: number;
}

async function fetchPage(page: number, cookie: string): Promise<unknown> {
  const resp = await fetch(`${LIST_URL}${page}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "x-luogu-type": "content-only",
      Cookie: cookie,
    },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await resp.text();
  if (body.trimStart().startsWith("<")) {
    throw new Error("返回的是 HTML，说明 Cookie 无效或被反爬拦截");
  }
  return JSON.parse(body);
}

export async function run(options: { pages?: number } = {}): Promise<void> {
  const pages = options.pages ?? 40;   // 每页 50 题
  const cookie = process.env["LUOGU_COOKIE"] ?? "";
  const items: Record<string, unknown>[] = [];
  try {
    for (let page = 1; page <= pages; page += 1) {
      const data = await fetchPage(page, cookie) as {
        currentData?: { problems?: { result?: LuoguProblem[] } };
      };
      const batch = data.currentData?.problems?.result ?? [];
      if (!batch.length) break;
      for (const q of batch) {
        items.push({
          id: q.pid,
          title: q.title,
          url: `https://www.luogu.com.cn/problem/${q.pid}`,
          difficulty: DIFF_MAP[q.difficulty ?? 3] ?? "MEDIUM",
          tags: (q.tags ?? []).map((t) => String(t)),
          acRate: pyRoundTo((q.totalAccepted ?? 0) / Math.max(q.totalSubmit ?? 1, 1), 4),
        });
      }
      process.stdout.write(`[luogu] ${items.length} 题\n`);
      await sleep(400);
    }
  } catch (err) {
    process.stdout.write(`[luogu] 抓取中断：${String(err)}\n`);
    if (!items.length) {
      process.stdout.write("[luogu] 没拿到数据，未写文件。设置 LUOGU_COOKIE 后重试，"
        + "或手动整理成 <数据根>/raw/extra_luogu.json（格式见 src/build/extra.ts）\n");
      return;
    }
  }

  dumpJson(join(rawDir(), "extra_luogu.json"), {
    source: "luogu",
    name: "洛谷",
    home: "https://www.luogu.com.cn/problem/list",
    items,
  });
}
