import assert from "node:assert/strict";
import { test } from "node:test";

import { parse, type CommandSpec, type OptSpec } from "../args.js";

const COMMON: OptSpec[] = [{ flag: "--no-color", type: "flag", help: "" }];

const COMMANDS: CommandSpec[] = [
  { name: "home", help: "" },
  {
    name: "list",
    help: "",
    pos: [{ dest: "query", nargs: "*", help: "" }],
    opts: [
      { flag: "--tag", type: "string", help: "" },
      { flag: "--diff", type: "string", append: true, help: "" },
      { flag: "--in", dest: "inList", type: "string", help: "" },
      { flag: "--hot", type: "flag", help: "" },
      { flag: "--limit", type: "int", default: 40, help: "" },
      { flag: "--sort", type: "string", default: "id", choices: ["id", "hot"], help: "" },
    ],
  },
  { name: "done", help: "", pos: [{ dest: "keys", nargs: "+", help: "" }] },
];

const run = (argv: string[]) => parse(argv, COMMANDS, COMMON, "home");

test("没给子命令时走默认命令", () => {
  assert.equal(run([]).command, "home");
  assert.equal(run(["--no-color"]).args["noColor"], true);
});

test("全局选项写在子命令前后都认", () => {
  assert.equal(run(["--no-color", "list"]).args["noColor"], true);
  assert.equal(run(["list", "--no-color"]).args["noColor"], true);
});

test("长选项支持等号、可重复、类型转换与 dest 改名", () => {
  const { args } = run(["list", "--tag=monotonic", "--diff", "easy", "--diff", "hard",
    "--in", "lc:top-100-liked", "--hot", "--limit", "12"]);
  assert.equal(args["tag"], "monotonic");
  assert.deepEqual(args["diff"], ["easy", "hard"]);
  assert.equal(args["inList"], "lc:top-100-liked");
  assert.equal(args["hot"], true);
  assert.equal(args["limit"], 12);
  assert.equal(args["sort"], "id");            // 默认值
});

test("位置参数：* 收集剩余，+ 至少一个", () => {
  assert.deepEqual(run(["list", "二叉树", "遍历"]).args["query"], ["二叉树", "遍历"]);
  assert.deepEqual(run(["list"]).args["query"], []);
  assert.deepEqual(run(["done", "1", "875"]).args["keys"], ["1", "875"]);
  assert.throws(() => run(["done"]), /至少一个/);
});

test("非法取值与未知选项给出可读报错", () => {
  assert.throws(() => run(["list", "--sort", "nope"]), /只能是/);
  assert.throws(() => run(["list", "--nope"]), /未知选项/);
  assert.throws(() => run(["list", "--tag"]), /缺少取值/);
});

test("--help 只返回要显示的命令名，不做解析", () => {
  assert.equal(run(["--help"]).help, "");
  assert.equal(run(["list", "--help"]).help, "list");
});
