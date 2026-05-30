import path from "node:path";
import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { FireConfig } from "@/lib/types";

const CONFIG_PATH = process.env.FIRE_CONFIG_PATH || path.join(process.cwd(), "fire-config.json");

const GOAL_LABEL_ALIASES: Record<string, string> = {
  "401k": "401k",
  "401(k)": "401k",
  "mega backdoor": "Mega Backdoor Roth",
  "mega backdoor roth": "Mega Backdoor Roth",
  "after-tax 401k": "Mega Backdoor Roth",
  "after tax 401k": "Mega Backdoor Roth",
  "in-plan conversion": "Mega Backdoor Roth",
  "in plan conversion": "Mega Backdoor Roth",
  espp: "ESPP",
  "stock purchase": "ESPP",
  "roth ira": "Roth IRA",
  "backdoor roth ira": "Roth IRA",
  "ira contribution": "Roth IRA",
  "529": "529s",
  "529s": "529s",
  "529 plan": "529s",
  "emergency fund": "Emergency Fund",
  emergency: "Emergency Fund",
  "cash reserve": "Emergency Fund",
  "studio fund": "Studio Fund",
  studio: "Studio Fund",
  "debt paydown": "Debt Paydown",
  debt: "Debt Paydown",
  "loan payoff": "Debt Paydown",
  "mortgage paydown": "Debt Paydown",
};

const ACCOUNT_LABEL_ALIASES: Record<string, string> = {
  brokerage: "Brokerage",
  checking: "Checking",
  savings: "Savings",
  retirement: "Retirement",
  "roth ira": "Roth IRA",
  "401k": "401k",
  "401(k)": "401k",
  espp: "ESPP",
  "529": "529s",
  "529s": "529s",
  hsa: "HSA",
};

function normalizeKnownLabel(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return aliases[trimmed.toLowerCase()] ?? trimmed;
}

function normalizeGoalKeywords(keywords: unknown): unknown {
  if (!Array.isArray(keywords)) {
    return keywords;
  }

  return keywords.map((keyword) => {
    const normalizedGoalLabel = normalizeKnownLabel(keyword, GOAL_LABEL_ALIASES);
    return normalizeKnownLabel(normalizedGoalLabel, ACCOUNT_LABEL_ALIASES);
  });
}

function normalizeConfig(config: FireConfig): FireConfig {
  if (!Array.isArray(config.goals)) {
    return config;
  }

  return {
    ...config,
    goals: config.goals.map((goal) => ({
      ...goal,
      name: normalizeKnownLabel(goal.name, GOAL_LABEL_ALIASES) as string,
      keywords: normalizeGoalKeywords(goal.keywords) as string[],
    })),
  };
}

export async function loadConfig(): Promise<FireConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as FireConfig;
    return normalizeConfig(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}
