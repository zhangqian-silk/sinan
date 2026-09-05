/**
 * 路径解析：数据在哪、题解在哪、打卡记录写哪。
 *
 * Python 版本把这三样都钉死在仓库目录下，因为它本来就长在题解仓库里。
 * 独立成一个 CLI 之后必须解耦 —— 题库数据（几十 MB）不进 git，题解目录是用户
 * 自己的仓库，打卡记录属于用户而不属于某次 checkout。优先级都是
 * 「命令行参数 > 环境变量 > 配置文件 > 约定位置」。
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 包根目录：dist/paths.js -> 上一级。 */
export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 前端静态资源随包分发，不跟着数据走。 */
export const WEB_DIR = join(PKG_ROOT, "web");

/** 抓取与构建脚本（Python）也随包分发，`sinan sync` 会调它们。 */
export const SCRIPTS_DIR = join(PKG_ROOT, "scripts");

export const SINAN_HOME = process.env["SINAN_HOME"]
  ? resolve(process.env["SINAN_HOME"])
  : join(homedir(), ".sinan");

export const CONFIG_FILE = join(SINAN_HOME, "config.json");
export const PROGRESS_FILE = join(SINAN_HOME, "progress.json");

export interface Config {
  dataDir?: string;
  solutions?: string[];
}

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
      if (parsed && typeof parsed === "object") cachedConfig = parsed as Config;
    } catch {
      // 配置文件写坏了不该让整个 CLI 起不来，忽略即可
    }
  }
  return cachedConfig;
}

function fromHere(base: string, p: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

/**
 * 构建产物目录。找不到就抛一段能照着做的提示，而不是一句 ENOENT。
 */
export function resolveDataDir(explicit?: string): string {
  const candidates: string[] = [];
  if (explicit) candidates.push(resolve(explicit));
  if (process.env["SINAN_DATA"]) candidates.push(resolve(process.env["SINAN_DATA"]!));
  const cfg = loadConfig();
  if (cfg.dataDir) candidates.push(fromHere(SINAN_HOME, cfg.dataDir));
  candidates.push(join(SINAN_HOME, "data", "dist"));
  candidates.push(join(PKG_ROOT, "data", "dist"));

  for (const dir of candidates) {
    if (existsSync(join(dir, "problems.json"))) return dir;
  }
  return candidates[0]!;
}

/** 本地题解目录：文件名以题号开头的就算这道题刷过了。 */
export function resolveSolutionDirs(explicit: string[] = []): string[] {
  const out: string[] = [];
  const push = (p: string): void => {
    const abs = resolve(p);
    if (!out.includes(abs) && existsSync(abs)) out.push(abs);
  };
  for (const p of explicit) push(p);
  if (!out.length && process.env["SINAN_SOLUTIONS"]) {
    for (const p of process.env["SINAN_SOLUTIONS"]!.split(delimiter)) {
      if (p.trim()) push(p.trim());
    }
  }
  if (!out.length) {
    for (const p of loadConfig().solutions ?? []) push(fromHere(SINAN_HOME, p));
  }
  return out;
}

export function ensureHome(): void {
  mkdirSync(SINAN_HOME, { recursive: true });
}
