// @ts-check
/**
 * Lint 只管 tsc 管不到的那些：漏掉的 await、误吞的错误、写了没用的变量。
 * 风格问题交给 .editorconfig 和 code review，不在这里堆规则。
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "web/**", "site/**", "src/test/fixtures/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // 规则表里全是数据字面量，长度限制没有意义
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // 抓取和构建大量用 unknown 收外部 JSON，逐个断言反而更危险
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      // 这两条是真会咬人的
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      "no-console": "error",
    },
  },
  {
    files: ["src/test/**/*.ts", "src/tools/**/*.ts"],
    rules: {
      "no-console": "off",
      // node:test 的 test() 返回 Promise，但它自己管调度，逐个 void 只是噪音
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    // 入口脚本和本配置文件是纯 JS，不进 tsconfig，关掉需要类型信息的规则
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
    },
  },
);
