import { DEFAULT_GOALS } from "@/lib/fire";
import { FireConfig, GoalConfig } from "@/lib/types";

const normalizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const GOAL_ALIAS_SEEDS: ReadonlyArray<{ canonical: string; aliases: string[] }> = [
  { canonical: "401k", aliases: ["401", "traditional 401k", "trad 401k"] },
  { canonical: "Mega Backdoor Roth", aliases: ["mega backdoor roth ira", "mbdr", "after tax roth conversion"] },
  { canonical: "Roth IRA", aliases: ["roth", "backdoor roth"] },
  { canonical: "529s", aliases: ["529", "529 plan", "college savings", "college fund"] },
  { canonical: "Emergency Fund", aliases: ["rainy day fund", "safety net"] },
  { canonical: "Studio Fund", aliases: ["studio savings"] },
  { canonical: "Debt Paydown", aliases: ["debt payoff", "pay down debt", "debt reduction"] },
];

const GOAL_ALIAS_TO_CANONICAL = (() => {
  const aliasMap = new Map<string, string>();

  for (const goal of DEFAULT_GOALS) {
    aliasMap.set(normalizeKey(goal.name), goal.name);
    for (const keyword of goal.keywords) {
      aliasMap.set(normalizeKey(keyword), goal.name);
    }
  }

  for (const seed of GOAL_ALIAS_SEEDS) {
    for (const alias of seed.aliases) {
      aliasMap.set(normalizeKey(alias), seed.canonical);
    }
  }

  return aliasMap;
})();

const ACCOUNT_TYPE_ALIAS_TO_CANONICAL = (() => {
  const aliasMap = new Map<string, string>();
  const addAliases = (canonical: string, aliases: string[]) => {
    for (const alias of aliases) {
      aliasMap.set(normalizeKey(alias), canonical);
    }
  };

  addAliases("cash", ["cash", "checking", "savings", "bank", "money market", "money-market"]);
  addAliases("retirement", ["retirement", "401k", "401(k)", "403b", "457", "ira", "roth ira", "pension"]);
  addAliases("brokerage", ["brokerage", "investment", "taxable brokerage", "taxable investment"]);
  addAliases("espp", ["espp", "employee stock purchase", "employee stock purchase plan"]);
  addAliases("debt", ["debt", "loan", "mortgage", "credit card", "liability"]);

  return aliasMap;
})();

export function normalizeGoalLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return GOAL_ALIAS_TO_CANONICAL.get(normalizeKey(trimmed)) ?? trimmed;
}

export function normalizeGoalConfig(goal: GoalConfig): GoalConfig {
  const normalizedName = normalizeGoalLabel(goal.name);
  const normalizedKeywords = [...new Set(goal.keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  return { ...goal, name: normalizedName, keywords: normalizedKeywords };
}

export function normalizeGoals(goals: GoalConfig[]): GoalConfig[] {
  return goals.map(normalizeGoalConfig);
}

export function normalizeFireConfig(config: FireConfig): FireConfig {
  return { ...config, goals: normalizeGoals(config.goals) };
}

export function normalizeAccountTypeLabel(type: string): string {
  const trimmed = type.trim();
  if (!trimmed) return trimmed;
  return ACCOUNT_TYPE_ALIAS_TO_CANONICAL.get(normalizeKey(trimmed)) ?? trimmed.toLowerCase();
}

export function normalizeUploadStatusLabel(raw: string): string {
  const lowered = raw.trim().toLowerCase();
  if (lowered.includes("transaction")) return "Transactions CSV";
  if (lowered.includes("accounts.csv") && lowered.includes("extracted")) return "Accounts CSV (extracted from screenshot)";
  if (lowered.includes("categories.csv") && lowered.includes("extracted")) return "Categories CSV (extracted from screenshot)";
  if (lowered.includes("accounts")) return "Accounts CSV";
  if (lowered.includes("categories")) return "Categories CSV";
  return raw;
}
