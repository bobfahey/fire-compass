import type { FireConfig } from "@/lib/types";

interface GoalLike {
  name: string;
  weight: number;
  keywords?: string[];
  action?: "keep" | "add" | "remove";
}

type ExtractedRow = Record<string, string | number>;

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeLabel = (value: string): string => normalizeWhitespace(value);

export const normalizeKeyword = (value: string): string => normalizeWhitespace(value).toLowerCase();

export const normalizeKeywords = (keywords: string[]): string[] => {
  const deduped = new Map<string, string>();
  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (normalized.length === 0 || deduped.has(normalized)) {
      continue;
    }
    deduped.set(normalized, normalized);
  }
  return [...deduped.values()];
};

export const normalizeGoal = <T extends GoalLike>(goal: T): T => ({
  ...goal,
  name: normalizeLabel(goal.name),
  keywords: normalizeKeywords(goal.keywords ?? []),
});

export const normalizeFireConfig = (config: FireConfig): FireConfig => ({
  ...config,
  goals: config.goals.map(normalizeGoal),
});

export const normalizeSuggestedGoals = <T extends GoalLike>(goals: T[]): T[] => goals.map(normalizeGoal);

export const normalizeExtractedRows = (
  type: "accounts" | "categories",
  rows: ExtractedRow[],
): ExtractedRow[] =>
  rows.map((row) => {
    if (type === "accounts") {
      const name = row.name;
      return typeof name === "string" ? { ...row, name: normalizeLabel(name) } : row;
    }
    const categoryName = row.name;
    return typeof categoryName === "string" ? { ...row, name: normalizeLabel(categoryName) } : row;
  });
