/** 测试共用：把迷你夹具装成一个 Store。 */

import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Store } from "../store.js";

export const FIXTURE_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)), "..", "..", "src", "test", "fixtures");

export const MINI_DIR = join(FIXTURE_DIR, "mini");

/**
 * 夹具 Store。
 *
 * 关键是 progressFile 指到一个不存在的路径 —— 否则会读到跑测试那个人
 * `~/.sinan/progress.json` 里的真实打卡，「补弱项」这条主线和所有进度相关的
 * 断言就会随人而变。
 */
export function miniStore(): Store {
  return new Store({
    dataDir: MINI_DIR,
    solutions: [],
    progressFile: join(MINI_DIR, "__no_such_progress__.json"),
  });
}
