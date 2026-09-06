/**
 * Web 端的 HTTP 壳：静态文件 + 把 `api.ts` 里的处理函数挂到路由上。
 *
 * 用法：sinan serve [--port 8848]
 *
 * 接口逻辑全在 api.ts，本地服务和静态站共用同一份，只用 Node 内置模块。
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from "node:http";
import { extname, join, normalize, resolve } from "node:path";

import { API, type Query } from "./api.js";
import { WEB_DIR } from "./paths.js";
import type { Store } from "./store.js";


const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function sendJson(res: ServerResponse, payload: unknown, status = 200): void {
  const body = Buffer.from(JSON.stringify(payload), "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendStatic(res: ServerResponse, urlPath: string): void {
  const rel = normalize(decodeURIComponent(urlPath === "/" ? "/index.html" : urlPath))
    .replace(/^(\.\.[/\\])+/, "");
  const file = resolve(join(WEB_DIR, rel));
  if (!file.startsWith(resolve(WEB_DIR)) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": String(statSync(file).size),
  });
  createReadStream(file).pipe(res);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => done(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", fail);
  });
}

export interface ServeOptions {
  host?: string;
  port?: number;
  /** 测试里起服务用：不打印、不接管 SIGINT */
  silent?: boolean;
}

export function serve(st: Store, options: ServeOptions = {}): Server {
  const { host = "127.0.0.1", port = 8848, silent = false } = options;
  if (!existsSync(WEB_DIR)) throw new Error(`缺少前端目录 ${WEB_DIR}`);

  // 相似度文件不小，起服务时先热一下，别让第一次打开学习计划卡住
  setTimeout(() => { st.similar(); }, 0);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const query: Query = {};
    for (const [k, v] of url.searchParams) (query[k] ??= []).push(v);

    if (req.method === "POST") {
      if (url.pathname !== "/api/checkin") {
        res.writeHead(404); res.end(); return;
      }
      void readBody(req).then((raw) => {
        let body: { slug?: string; note?: string };
        try {
          body = raw ? (JSON.parse(raw) as { slug?: string; note?: string }) : {};
        } catch {
          sendJson(res, { error: "请求体不是合法 JSON" }, 400);
          return;
        }
        const p = st.bySlug.get(body.slug ?? "");
        if (!p) { sendJson(res, { error: "题目不存在" }, 404); return; }
        const added = st.toggleCheckin(p, body.note ?? "");
        sendJson(res, { slug: p.slug, checked: added, done: st.isDone(p) });
      });
      return;
    }

    const handler = API[url.pathname];
    if (handler) {
      try {
        sendJson(res, handler(st, query));
      } catch (err) {
        // 接口出错也要给前端一个可读的响应
        const name = err instanceof Error ? err.name : "Error";
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, { error: `${name}: ${message}` }, 500);
      }
      return;
    }
    sendStatic(res, url.pathname);
  });

  server.listen(port, host, () => {
    if (silent) return;
    process.stdout.write(`刷题训练台 web 端 → http://${host}:${port}\n`);
    process.stdout.write(`题库 ${st.meta.stats.total} 道 · 本地题解已识别 ${st.localSolutions().size} 题\n`);
    process.stdout.write("按 Ctrl+C 停止\n");
  });

  if (!silent) {
    process.on("SIGINT", () => {
      process.stdout.write("\n已停止\n");
      server.close(() => process.exit(0));
    });
  }
  return server;
}
