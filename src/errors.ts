/** 用户可读的错误：CLI 顶层捕获后只打印 message，不吐堆栈。 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}
