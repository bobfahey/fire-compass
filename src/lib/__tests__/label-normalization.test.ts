import { describe, expect, it } from "vitest";

import {
  normalizeAccountTypeLabel,
  normalizeFireConfig,
  normalizeGoalConfig,
  normalizeGoalLabel,
  normalizeUploadStatusLabel,
} from "@/lib/label-normalization";
import { FireConfig } from "@/lib/types";

describe("normalizeGoalLabel", () => {
  it("maps known aliases to canonical goal labels", () => {
    expect(normalizeGoalLabel("mbdr")).toBe("Mega Backdoor Roth");
    expect(normalizeGoalLabel("backdoor roth")).toBe("Roth IRA");
    expect(normalizeGoalLabel("debt payoff")).toBe("Debt Paydown");
  });

  it("preserves unknown goal labels", () => {
    expect(normalizeGoalLabel("Vacation Fund")).toBe("Vacation Fund");
  });
});

describe("normalizeGoalConfig", () => {
  it("normalizes goal names and de-duplicates keywords", () => {
    expect(
      normalizeGoalConfig({
        name: "529 plan",
        weight: 0.2,
        keywords: ["college", "college", " tuition ", ""],
      })
    ).toEqual({
      name: "529s",
      weight: 0.2,
      keywords: ["college", "tuition"],
    });
  });
});

describe("normalizeFireConfig", () => {
  it("normalizes every goal in config", () => {
    const config: FireConfig = {
      goals: [
        { name: "mbdr", weight: 0.2, keywords: ["after tax roth conversion"] },
        { name: "Roth IRA", weight: 0.3, keywords: ["roth"] },
      ],
      phases: [],
    };

    expect(normalizeFireConfig(config).goals.map((goal) => goal.name)).toEqual([
      "Mega Backdoor Roth",
      "Roth IRA",
    ]);
  });
});

describe("normalizeAccountTypeLabel", () => {
  it("maps account type aliases to canonical account labels", () => {
    expect(normalizeAccountTypeLabel("Checking")).toBe("cash");
    expect(normalizeAccountTypeLabel("Roth IRA")).toBe("retirement");
    expect(normalizeAccountTypeLabel("Mortgage")).toBe("debt");
  });
});

describe("normalizeUploadStatusLabel", () => {
  it("maps upload status text to canonical UI labels", () => {
    expect(normalizeUploadStatusLabel("accounts.csv (extracted from screenshot)")).toBe(
      "Accounts CSV (extracted from screenshot)"
    );
    expect(normalizeUploadStatusLabel("categories.csv")).toBe("Categories CSV");
    expect(normalizeUploadStatusLabel("transactions.csv")).toBe("Transactions CSV");
  });
});
