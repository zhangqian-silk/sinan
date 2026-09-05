#!/usr/bin/env node
// 入口：命令名取自 argv[1] 的文件名，所以建软链改名后，帮助文本会自动跟着变。
import { main } from "../dist/cli.js";

main(process.argv.slice(2));
