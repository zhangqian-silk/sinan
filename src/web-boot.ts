/**
 * 静态站的启动脚本：在浏览器里把 baseline.json 装成一个 Store，
 * 再把 api.ts 的处理函数包装成「客户端路由」交给 app.js。
 *
 * app.js 原本每次都 fetch `/api/xxx`，静态站没有后端，于是这里挂一个同形的
 * `call(path, params)` 到 globalThis 上顶替掉网络请求 —— 前端代码不用分叉。
 */

import { API } from "./api.js";
import { expand, type Packed } from "./baseline.js";
import { createMemoryHost } from "./host-memory.js";
import { Store } from "./store.js";

export interface StaticBackend {
  /** 顶替 fetch('/api/xxx?...')，同步算完直接给结果 */
  call(path: string, params?: Record<string, unknown>): unknown;
  /** 顶替 POST /api/checkin */
  checkin(slug: string, note?: string): unknown;
}

function toQuery(params: Record<string, unknown> | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === "" || v === null || v === undefined || v === false) continue;
    const push = (x: unknown): void => { (out[k] ??= []).push(x === true ? "1" : String(x)); };
    if (Array.isArray(v)) v.forEach(push);
    else push(v);
  }
  return out;
}

export function makeBackend(store: Store): StaticBackend {
  return {
    call(path, params) {
      const handler = API[path];
      if (!handler) return { error: `静态站不支持 ${path}` };
      return handler(store, toQuery(params));
    },
    checkin(slug, note) {
      const p = store.bySlug.get(slug);
      if (!p) return { error: "题目不存在" };
      const added = store.toggleCheckin(p, note ?? "");
      return { slug: p.slug, checked: added, done: store.isDone(p) };
    },
  };
}

export async function boot(baselineUrl: string): Promise<StaticBackend> {
  const res = await fetch(baselineUrl);
  if (!res.ok) throw new Error(`拉不到题库数据（${String(res.status)}）`);
  const store = new Store(createMemoryHost(expand(await res.json() as Packed)));
  return makeBackend(store);
}
