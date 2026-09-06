/**
 * 抓取「特殊题单」：力扣官方学习计划 + CodeTop 分公司高频榜。
 *
 * 官方学习计划自带知识点分组（热题 100 分成 哈希/双指针/滑动窗口…），
 * 这个分组会被保留下来，学习计划生成时可以和我们自己的标签互相印证。
 */

import { join } from "node:path";

import { dumpJson, rawDir } from "../io.js";
import { graphql, httpJson, sleep } from "../http.js";
import type { RawList } from "../curated.js";

const LC_ENDPOINT = "https://leetcode.cn/graphql/";

/** 已验证存在的官方学习计划；写不存在的 slug 也没关系，会被跳过。 */
const STUDY_PLANS = [
  "top-100-liked",          // LeetCode 热题 100
  "top-interview-150",      // 面试经典 150 题
  "leetcode-75",            // LeetCode 75
  "programming-skills",     // 编程基础 0 到 1
  "dynamic-programming",    // 动态规划（基础版）
  "dynamic-programming-grandmaster",  // 动态规划（进阶版）
  "graph-theory",           // 图论 · 从入门到精通
  "binary-search",          // 二分查找 · 系统掌握
  "premium-algo-100",       // 尊享面试 100 题
  "sql-free-50",            // 高频 SQL 50 题
  "top-sql-50",
  "30-days-of-javascript",
  "introduction-to-pandas",
];

const PLAN_QUERY = `
query studyPlanV2Detail($planSlug: String!) {
  studyPlanV2Detail(planSlug: $planSlug) {
    slug
    name
    description
    questionNum
    planSubGroups {
      slug
      name
      questionNum
      questions { titleSlug questionFrontendId }
    }
  }
}
`;

const CODETOP_API = "https://codetop.cc/api";
const CODETOP_REFERER = "https://codetop.cc/home";
const COMPANY_LIMIT = 12;   // 只取最主要的几家，避免请求量失控
const COMPANY_PAGES = 5;    // 每家取前 100 题（每页 20）

async function fetchStudyPlan(slug: string): Promise<RawList | null> {
  const data = await graphql<{
    studyPlanV2Detail: {
      slug: string; name: string; description?: string; questionNum?: number;
      planSubGroups?: { name: string; questions?: { titleSlug: string }[] }[];
    } | null;
  }>(LC_ENDPOINT, PLAN_QUERY, { planSlug: slug },
    { operation: "studyPlanV2Detail", referer: `https://leetcode.cn/studyplan/${slug}/` });
  const plan = data.studyPlanV2Detail;
  if (!plan) return null;
  // 会员专享计划（动态规划进阶版、尊享面试 100）拿不到题目明细，直接跳过
  if (!plan.planSubGroups?.length) return null;

  const groups: { name: string; slugs: string[] }[] = [];
  const slugs: string[] = [];
  for (const group of plan.planSubGroups) {
    const members = (group.questions ?? []).map((q) => q.titleSlug);
    slugs.push(...members);
    if (members.length) groups.push({ name: group.name, slugs: members });
  }
  return {
    id: `lc:${plan.slug}`,
    name: plan.name,
    desc: (plan.description ?? "").replaceAll("\r\n", " ").trim().slice(0, 160),
    source: "leetcode",
    kind: "official",
    url: `https://leetcode.cn/studyplan/${plan.slug}/`,
    declaredNum: plan.questionNum ?? 0,
    groups,
    slugs: [...new Set(slugs)],
  };
}

async function fetchCompanyLists(): Promise<RawList[]> {
  const companies = await httpJson<{ id: number | string; name: string }[]>(
    `${CODETOP_API}/companies/`, { headers: { Referer: CODETOP_REFERER } });
  const out: RawList[] = [];
  for (const company of companies.slice(0, COMPANY_LIMIT)) {
    const rows: [string, number][] = [];
    let total: number | undefined;
    for (let page = 1; page <= COMPANY_PAGES; page += 1) {
      const data = await httpJson<{
        count?: number;
        list?: { value?: number; leetcode?: { slug_title?: string } }[];
      }>(`${CODETOP_API}/questions/?page=${page}&company=${company.id}`,
        { headers: { Referer: CODETOP_REFERER } });
      total = data.count;
      const batch = data.list ?? [];
      if (!batch.length) break;
      for (const item of batch) {
        const slug = item.leetcode?.slug_title;
        if (slug) rows.push([slug, item.value ?? 0]);
      }
      await sleep(120);
    }
    if (!rows.length) continue;
    const seen = new Map<string, number>();
    for (const [slug, freq] of rows) seen.set(slug, Math.max(seen.get(slug) ?? 0, freq));
    out.push({
      id: `codetop:${company.id}`,
      name: `CodeTop · ${company.name}`,
      desc: `${company.name}面试出现频率最高的 ${seen.size} 题（该公司题库共 ${total} 题）`,
      source: "codetop",
      kind: "company",
      url: "https://codetop.cc/home",
      declaredNum: total || seen.size,
      groups: [],
      slugs: [...seen.keys()],
      freq: Object.fromEntries(seen),
    });
    process.stdout.write(`[codetop] ${company.name}: 取前 ${seen.size} 题（共 ${total}）\n`);
  }
  return out;
}

export async function run(): Promise<void> {
  const lists: RawList[] = [];

  for (const slug of STUDY_PLANS) {
    let plan: RawList | null;
    try {
      plan = await fetchStudyPlan(slug);
    } catch (err) {
      process.stdout.write(`[plan] ${slug} 抓取失败：${String(err).slice(0, 80)}\n`);
      continue;
    }
    if (!plan) { process.stdout.write(`[plan] ${slug} 不存在，跳过\n`); continue; }
    lists.push(plan);
    process.stdout.write(
      `[plan] ${plan.name}：${plan.slugs!.length} 题 / ${plan.groups!.length} 个知识点分组\n`);
    await sleep(200);
  }

  try {
    lists.push(...await fetchCompanyLists());
  } catch (err) {
    process.stdout.write(`[codetop] 公司榜抓取失败：${String(err).slice(0, 120)}\n`);
  }

  const now = new Date();
  const pad = (v: number): string => String(v).padStart(2, "0");
  dumpJson(join(rawDir(), "curated.json"), {
    fetchedAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    lists,
  });
}
