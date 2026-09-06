/** 刷题训练台 CLI：命令名取自 argv[1]，见 bin/sinan.js。 */

import { existsSync } from "node:fs";
import { dirname } from "node:path";

import { parse, renderHelp, type Args, type CommandSpec, type OptSpec } from "./args.js";
import { cmdDone, cmdLearn, cmdNext, cmdPlan, cmdRoutes } from "./commands/plan.js";
import {
  cmdApproaches, cmdHome, cmdLists, cmdStats, cmdTopics,
} from "./commands/overview.js";
import { cmdList, cmdShow } from "./commands/query.js";
import { CliError } from "./errors.js";
import { out, PROG } from "./out.js";
import { DEFAULT_PACE } from "./planner.js";
import { resolveDataDir, SINAN_HOME } from "./paths.js";
import * as r from "./render.js";
import { Store } from "./store.js";

const COMMON: OptSpec[] = [
  { flag: "--no-color", type: "flag", help: "关掉颜色" },
  { flag: "--data-dir", type: "string", metavar: "目录", help: "构建产物目录（默认 ~/.sinan/data/dist，也可用 SINAN_DATA）" },
  { flag: "--solutions", type: "string", append: true, metavar: "目录", help: "本地题解目录，可重复；文件名以题号开头就算刷过（也可用 SINAN_SOLUTIONS）" },
];

type Runner = (store: Store, args: Args) => void;

interface Entry extends CommandSpec {
  run?: Runner;
  /** 不需要题库数据就能跑 */
  standalone?: (args: Args) => void;
}

const COMMANDS: Entry[] = [
  { name: "home", help: "概览（默认）", run: cmdHome },

  {
    name: "topics",
    help: "标签体系：13 个大类 / 65 个子标签",
    pos: [{ dest: "cat", nargs: "?", help: "只看某个大类" }],
    run: cmdTopics,
  },

  { name: "lists", help: "特殊题单：热题 100、面试经典 150、CodeTop 公司榜…", run: cmdLists },

  { name: "routes", help: "学习计划：4 条跨专题的主线路线", run: cmdRoutes },

  {
    name: "approaches",
    help: "题解思路词表：从真实题解里提取的解法维度",
    pos: [{ dest: "domain", nargs: "?", help: "只看某个领域：树 / 图论 / 动态规划 / 数学 / …" }],
    run: cmdApproaches,
  },

  {
    name: "list",
    help: "题库查询",
    pos: [{ dest: "query", nargs: "*", metavar: "关键词", help: "题号 / 标题 / 标签" }],
    opts: [
      { flag: "--cat", type: "string", help: "按大类筛" },
      { flag: "--tag", type: "string", help: "按子标签筛" },
      { flag: "--diff", type: "string", append: true, help: "难度：easy/medium/hard 或 简单/中等/困难" },
      { flag: "--in", dest: "inList", type: "string", help: "限定在某个题单里，如 lc:top-100-liked" },
      { flag: "--hot", type: "flag", help: "只看 CodeTop 高频" },
      { flag: "--todo", type: "flag", help: "只看还没刷的" },
      { flag: "--mine", type: "flag", help: "只看本地已有题解的" },
      { flag: "--multi", type: "flag", help: "只看一题多解（跨 3 个以上大类）" },
      { flag: "--approach", type: "string", help: "按题解思路筛，如 中序遍历 / 单调栈 / 埃氏筛" },
      { flag: "--by-approach", type: "flag", help: "标签列换成题解思路" },
      { flag: "--source", type: "string", help: "题源：leetcode / luogu" },
      { flag: "--paid", type: "flag", help: "包含会员题" },
      { flag: "--with-lists", type: "flag", help: "显示题目收录于哪些题单" },
      { flag: "--links", type: "flag", help: "额外显示平台链接一列" },
      {
        flag: "--sort", type: "string", default: "id",
        choices: ["id", "hot", "value", "diff", "ac", "acdesc"], help: "排序方式",
      },
      { flag: "--limit", type: "int", default: 40, help: "最多显示多少题" },
    ],
    run: cmdList,
  },

  {
    name: "show",
    help: "题目详情：标签来源、相似题、题面、我的题解",
    pos: [{ dest: "key", nargs: "1", help: "题号 / slug / 标题关键词" }],
    opts: [
      { flag: "--full", type: "flag", help: "题面不截断" },
      { flag: "--no-content", type: "flag", help: "不显示题面" },
      { flag: "--code", type: "flag", help: "打印本地题解源码" },
      { flag: "--similar", type: "int", default: 8, help: "相似题条数" },
    ],
    run: cmdShow,
  },

  {
    name: "plan",
    help: "展开一条主线，或按单个专题即时生成计划",
    pos: [{
      dest: "topic", nargs: "1",
      help: "主线 id（starter/interview/advanced/weakness）或专题 id（sliding-window、dp、hot100…）",
    }],
    opts: [
      { flag: "--full", type: "flag", help: "列出专题全部题目（代表题标 ★）" },
      { flag: "--minimal", type: "flag", help: "只给最小覆盖的代表题（题单默认完整）" },
      { flag: "--all", type: "flag", help: "题池用全部同标签题，不筛「值得练」的" },
      {
        flag: "--pace", type: "string", default: DEFAULT_PACE,
        choices: ["depth", "balanced", "coverage"],
        help: "难度配比：depth=易中打底+困难为主（默认）｜balanced=均衡｜coverage=覆盖优先",
      },
      { flag: "--steps", type: "int", help: "限制步数" },
      { flag: "--day", type: "int", help: "每天几题，插入 DAY 分隔" },
      { flag: "--paid", type: "flag", help: "包含会员题" },
      { flag: "--source", type: "string", help: "只用某个题源" },
      { flag: "--brief", type: "flag", help: "不显示「代表」明细" },
      { flag: "--no-notes", type: "flag", help: "不显示顶部的「开练前先看」" },
    ],
    run: cmdPlan,
  },

  {
    name: "learn",
    help: "专题讲解：核心思想 / 识别信号 / 模板 / 坑 / OI-Wiki 延伸阅读",
    pos: [{ dest: "topic", nargs: "1", help: "大类或子标签 id，如 sliding-window、dp、monotonic" }],
    run: cmdLearn,
  },

  {
    name: "next",
    help: "下一步该做什么",
    opts: [{ flag: "--n", short: "-n", dest: "n", type: "int", default: 3, help: "给几条建议" }],
    run: cmdNext,
  },

  {
    name: "done",
    help: "打卡 / 取消打卡",
    pos: [{ dest: "keys", nargs: "+", metavar: "题目", help: "题号 / slug / 标题关键词" }],
    opts: [
      { flag: "--note", type: "string", help: "备注" },
      { flag: "--force", type: "flag", help: "即使已有本地题解也打卡" },
    ],
    run: cmdDone,
  },

  { name: "stats", help: "题库统计", run: cmdStats },

  {
    name: "serve",
    help: "启动 web 端（浏览器里看同一份数据和计划）",
    opts: [
      { flag: "--port", type: "int", default: 8848, help: "端口" },
      { flag: "--host", type: "string", default: "127.0.0.1", help: "监听地址，内网访问用 0.0.0.0" },
    ],
    run: (store, args) => {
      // 动态载入，让不开 web 的命令不必付出加载成本
      void import("./serve.js").then(({ serve }) => {
        serve(store, { host: args["host"] as string, port: args["port"] as number });
      });
    },
  },

  {
    name: "sync",
    help: "抓数据 + 重新构建",
    opts: [
      { flag: "--skip-fetch", type: "flag", help: "只重新构建，不抓取" },
    ],
    standalone: runSync,
  },

  {
    name: "where",
    help: "打印数据、题解、打卡记录分别在哪（排查配置用）",
    standalone: (args) => {
      const dataDir = resolveDataDir(args["dataDir"] as string | undefined);
      out("", r.heading("当前配置", "命令行参数 > 环境变量 > ~/.sinan/config.json > 约定位置"), "");
      out(`  ${r.pad("题库数据", 12)}${dataDir}${existsSync(dataDir) ? "" : r.paint("  （还没有，跑 {PROG} sync）", "gray")}`);
      out(`  ${r.pad("打卡记录", 12)}${SINAN_HOME}/progress.json`);
      out(`  ${r.pad("配置文件", 12)}${SINAN_HOME}/config.json`);
      let store: Store | null = null;
      try {
        store = new Store({
          dataDir: args["dataDir"] as string | undefined,
          solutions: (args["solutions"] as string[]) ?? [],
        });
      } catch {
        store = null;
      }
      const dirs = store?.solutionDirs ?? [];
      out(`  ${r.pad("本地题解", 12)}${dirs.length ? dirs.join("\n              ") : r.paint("（未配置，用 --solutions 或 SINAN_SOLUTIONS 指定）", "gray")}`);
      if (store && dirs.length) {
        out(`  ${r.pad("", 12)}${r.paint(`已识别 ${store.localSolutions().size} 道题的本地题解`, "gray")}`);
      }
      out("");
    },
  },
];

function runSync(args: Args): void {
  // 抓取和读取共用同一个数据根，免得「抓完了却读不到」
  const dataDir = resolveDataDir(args["dataDir"] as string | undefined);
  process.env["SINAN_DATA_ROOT"] = dirname(dataDir);
  void import("./build/pipeline.js").then(({ sync }) => sync({
    skipFetch: Boolean(args["skipFetch"]),
  })).catch((err: unknown) => {
    process.stderr.write(`\n抓取或构建失败：${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

const DESCRIPTION = "本地刷题训练台：题库打标 + 按知识点递进的学习计划";

export function main(argv: readonly string[]): void {
  // 输出管道给 head / less 时对方提前关掉，属正常情况，别吐堆栈
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });

  try {
    const { command, args, help } = parse(argv, COMMANDS, COMMON, "home");
    if (help !== null) {
      out(renderHelp(PROG, COMMANDS, COMMON, help || null, DESCRIPTION));
      return;
    }
    if (args["noColor"]) r.setColor(false);

    const entry = COMMANDS.find((c) => c.name === command)!;
    if (entry.standalone) {
      entry.standalone(args);
      return;
    }
    const store = new Store({
      dataDir: args["dataDir"] as string | undefined,
      solutions: (args["solutions"] as string[]) ?? [],
    });
    entry.run!(store, args);
  } catch (err) {
    if (err instanceof CliError) {
      process.stderr.write(`${err.message.replaceAll("{PROG}", PROG)}\n`);
      process.exit(1);
    }
    throw err;
  }
}
