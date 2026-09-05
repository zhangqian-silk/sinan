/** 作为库使用时的入口：把数据层和规划器暴露出去，方便二次开发。 */

export { Store, DIFF_CN, DIFF_RANK, sortProblems, approachMatches } from "./store.js";
export type { Topic, TopicKind, QueryOptions, MemberOptions, ApproachStat } from "./store.js";
export { overlap } from "./approach.js";
export * as planner from "./planner.js";
export * as notes from "./notes/index.js";
export * as render from "./render.js";
export { serve } from "./serve.js";
export { resolveDataDir, resolveSolutionDirs, SINAN_HOME, WEB_DIR, SCRIPTS_DIR } from "./paths.js";
export { CliError } from "./errors.js";
export type * from "./types.js";
