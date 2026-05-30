import { describe, expect, it } from "vitest";

import {
  normalizeExtractedRows,
  normalizeFireConfig,
  normalizeKeywords,
  normalizeSuggestedGoals,
} from "@/lib/api-normalization";
import type { FireConfig } from "@/lib/types";

describe("API normalization helpers", () => {
  it("normalizes and deduplicates goal keywords case-insensitively", () => {
    expect(normalizeKeywords(["  Roth IRA ", "roth   ira", "  401(k) ", ""])).toEqual([
      "roth ira",
      "401(k)",
    ]);
  });

  it("normalizes goal names and keywords in fire config while preserving phases", () => {
    const config: FireConfig = {
      goals: [{ name: "  Mega   Backdoor Roth ", weight: 0.25, keywords: [" Mega Backdoor ", "MEGA BACKDOOR"] }],
      phases: [{ name: "Young Kids", years: 3, multiplier: 1.2 }],
    };

    expect(normalizeFireConfig(config)).toEqual({
      goals: [{ name: "Mega Backdoor Roth", weight: 0.25, keywords: ["mega backdoor"] }],
      phases: [{ name: "Young Kids", years: 3, multiplier: 1.2 }],
    });
  });

  it("normalizes suggested goals for realign responses", () => {
    const suggested = normalizeSuggestedGoals([
      { name: "  Studio   Fund ", weight: 0.1, keywords: [" Studio ", "studio"], action: "add" as const },
    ]);

    expect(suggested).toEqual([
      { name: "Studio Fund", weight: 0.1, keywords: ["studio"], action: "add" },
    ]);
  });

  it("normalizes extracted account and category names before upload/extract output", () => {
    expect(
      normalizeExtractedRows("accounts", [{ name: "  Fidelity   401k ", balance: 318000, type: "retirement" }]),
    ).toEqual([{ name: "Fidelity 401k", balance: 318000, type: "retirement" }]);

    expect(normalizeExtractedRows("categories", [{ name: "  Dining   Out ", monthlyBudget: 600 }])).toEqual([
      { name: "Dining Out", monthlyBudget: 600 },
    ]);
  });
});
