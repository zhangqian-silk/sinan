/**
 * 打一份能直接丢到 GitHub Pages 的静态站。
 *
 * 静态站没有后端：把随包基线（baseline.json）和编译好的 store / planner / api
 * 一起发出去，在浏览器里装成同一个 Store，前端照常调 api()。所以标签、题解、
 * 学习计划的算法只有一份，网页与命令行的结果必然一致。
 *
 * 只发基线，题面原文不在里面 —— 这既是合规要求，也让整站压到几 MB。
 *
 * 跑法：node dist/tools/build-site.js [输出目录]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

import { BASELINE_DIR, PKG_ROOT, WEB_DIR } from "../paths.js";

const DIST = join(PKG_ROOT, "dist");
/** 浏览器侧的入口，从它出发把依赖爬全 */
const ENTRY = "web-boot.js";

/** 顺着相对 import 把浏览器真正会加载的模块收集齐。 */
export function collectModules(entry: string = ENTRY): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const rel = queue.shift()!;
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = join(DIST, rel);
    if (!existsSync(abs)) throw new Error(`缺少 ${abs}，先跑 npm run build`);
    const code = readFileSync(abs, "utf-8");
    // tsc 产出的是 `from "./x.js"` / `from"./x.js"`，两种都认
    for (const m of code.matchAll(/from\s*["']([^"']+)["']/g)) {
      const spec = m[1] ?? "";
      if (spec.startsWith("node:")) {
        throw new Error(
          `${rel} 依赖了 ${spec} —— 静态站在浏览器里跑，不能有 node 依赖。\n` +
          "把涉及文件系统的部分挪到 host-node.ts 那一侧。");
      }
      if (!spec.startsWith(".")) throw new Error(`${rel} 依赖了外部包 ${spec}，静态站不支持`);
      queue.push(posix.normalize(posix.join(posix.dirname(rel), spec)));
    }
  }
  return [...seen].sort();
}

const BOOT = `/**
 * 由 build-site 生成：在浏览器里把题库装起来，顶替掉本地服务的 /api 后端。
 * app.js 会 await 这个 promise，拿到之后所有请求都走客户端路由。
 */
import { boot } from "./sinan/web-boot.js";

globalThis.__SINAN_BOOT__ = boot(new URL("./baseline.json", import.meta.url).href);
`;

function main(): void {
  const out = resolve(process.argv[2] ?? join(PKG_ROOT, "site"));
  const baseline = join(BASELINE_DIR, "baseline.json");
  if (!existsSync(baseline)) throw new Error(`缺少 ${baseline}，先跑 npm run baseline`);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // 1. 前端静态资源
  cpSync(WEB_DIR, out, { recursive: true });

  // 2. 浏览器要加载的模块
  const mods = collectModules(ENTRY);
  for (const rel of mods) {
    const dest = join(out, "sinan", rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(DIST, rel), dest);
  }

  // 3. 题库数据与启动脚本
  cpSync(baseline, join(out, "baseline.json"));
  writeFileSync(join(out, "static-boot.js"), BOOT, "utf-8");

  // 4. 把启动脚本插到 app.js 前面（模块脚本按文档顺序执行）
  const page = join(out, "index.html");
  const html = readFileSync(page, "utf-8");
  const anchor = '<script type="module" src="./app.js"></script>';
  if (!html.includes(anchor)) throw new Error("index.html 里找不到 app.js 的引用，构建脚本要跟着改");
  writeFileSync(page,
    html.replace(anchor, `<script type="module" src="./static-boot.js"></script>\n${anchor}`), "utf-8");

  // 5. GitHub Pages 默认走 Jekyll，会吞掉下划线开头的路径
  writeFileSync(join(out, ".nojekyll"), "", "utf-8");

  const size = (p: string): number => statSync(p).size;
  const total = mods.reduce((s, m) => s + size(join(out, "sinan", m)), 0) + size(baseline);
  process.stdout.write(
    `静态站：${relative(PKG_ROOT, out)}/ · ${String(mods.length)} 个模块 + 基线数据 · `
    + `${(total / 1024 / 1024).toFixed(1)} MB\n`);
}

// 被测试 import 时不要真的去打包
if (process.argv[1]?.endsWith("build-site.js")) main();
