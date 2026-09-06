/**
 * 抓取层的共用工具：带重试的 HTTP、GraphQL、并发池、JSONL 断点续传。
 *
 * 抓一遍全量题库要发一万多个请求，中途一定会有超时和限流，所以三件事是必须的：
 * 指数退避重试、单题失败不拖垮整轮、结果按行落盘可以断点续跑。
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { readJsonl } from "./io.js";

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
  + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class FetchError extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

export interface HttpOptions {
  payload?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

/** 发一次 HTTP 请求并解析 JSON，失败按指数退避重试。 */
export async function httpJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const { payload, headers = {}, timeoutMs = 30_000, retries = 4 } = options;
  const head: Record<string, string> = { "User-Agent": UA, Accept: "application/json", ...headers };
  if (payload !== undefined) head["Content-Type"] = "application/json";

  let last: unknown = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const resp = await fetch(url, {
        method: payload === undefined ? "GET" : "POST",
        headers: head,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (resp.status === 400 || resp.status === 404) {
        // 明确的客户端错误，重试没意义
        throw new FetchError(`${url} -> HTTP ${resp.status}`);
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as T;
    } catch (err) {
      if (err instanceof FetchError) throw err;
      last = err;
      await sleep(Math.min(8000, 600 * 2 ** attempt) + Math.random() * 300);
    }
  }
  throw new FetchError(`${url} 连续 ${retries} 次失败: ${String(last)}`);
}

export async function graphql<T>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  options: { operation?: string; referer?: string } = {},
): Promise<T> {
  const payload: Record<string, unknown> = { query, variables };
  if (options.operation) payload["operationName"] = options.operation;
  const headers: Record<string, string> = {};
  if (options.referer) headers["Referer"] = options.referer;
  const body = await httpJson<{ data?: T; errors?: unknown }>(endpoint, { payload, headers });
  if (body.errors) {
    throw new FetchError(`GraphQL 报错: ${JSON.stringify(body.errors).slice(0, 300)}`);
  }
  return body.data as T;
}

export interface Cached {
  _key?: string;
  _error?: string;
}

/**
 * 并发抓取一批 key，结果按行追加到 cache，重跑时自动跳过已完成的。
 *
 * 单题抛错不会中断整轮，而是写一条 `{_key, _error}` 占位 —— 下次重跑会重试它，
 * 同时已经成功的部分不用再抓一遍。
 */
export async function fetchMany<T extends Cached>(
  keys: readonly string[],
  worker: (key: string) => Promise<T | null>,
  cache: string,
  options: { workers?: number; label?: string } = {},
): Promise<T[]> {
  const { workers = 5, label = "fetch" } = options;
  mkdirSync(dirname(cache), { recursive: true });
  const done = new Set<string>();
  for (const rec of readJsonl<Cached>(cache)) {
    if (rec._key && !rec._error) done.add(rec._key);
  }
  const todo = keys.filter((k) => !done.has(k));
  const log = (line: string): void => { process.stdout.write(`${line}\n`); };
  log(`[${label}] 共 ${done.size + todo.length} 项，已缓存 ${done.size}，待抓 ${todo.length}`);

  if (todo.length) {
    const started = Date.now();
    let cursor = 0;
    let finished = 0;
    const run = async (): Promise<void> => {
      for (;;) {
        const i = cursor;
        cursor += 1;
        if (i >= todo.length) return;
        const key = todo[i];
        let rec: T | null;
        try {
          rec = await worker(key);
        } catch (err) {
          // 单题失败不该拖垮整轮抓取
          rec = { _key: key, _error: String(err).slice(0, 200) } as T;
        }
        if (rec !== null) {
          if (!rec._key) rec._key = key;
          appendFileSync(cache, `${JSON.stringify(rec)}\n`, "utf-8");
        }
        finished += 1;
        if (finished % 200 === 0 || finished === todo.length) {
          const rate = finished / Math.max((Date.now() - started) / 1000, 1e-6);
          const left = (todo.length - finished) / Math.max(rate, 1e-6);
          log(`[${label}] ${finished}/${todo.length}  ${rate.toFixed(1)} 项/秒  `
            + `剩余约 ${(left / 60).toFixed(1)} 分钟`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, workers) }, run));
  }
  return readJsonl<T>(cache);
}

export { existsSync, sleep };
