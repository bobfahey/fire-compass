import { describe, expect, it } from "vitest";

import { normalizeAccountType, normalizeGoalLabel, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses comma-delimited rows and trims cell values", () => {
    const content = "name,type,balance\n  Main Checking  , checking account , 1000 ";
    const rows = parseCsv(content);

    expect(rows).toEqual([
      {
        name: "Main Checking",
        type: "checking account",
        balance: "1000",
      },
    ]);
  });
});

describe("normalizeGoalLabel", () => {
  it("normalizes known drifted goal label aliases", () => {
    expect(normalizeGoalLabel("  401(k) contributions ")).toBe("401k");
    expect(normalizeGoalLabel("after-tax 401k")).toBe("Mega Backdoor Roth");
    expect(normalizeGoalLabel("529 Contributions")).toBe("529s");
    expect(normalizeGoalLabel("Debt Payoff")).toBe("Debt Paydown");
  });

  it("preserves unknown labels as trimmed strings", () => {
    expect(normalizeGoalLabel("  Home Upgrade Fund  ")).toBe("Home Upgrade Fund");
  });
});

describe("normalizeAccountType", () => {
  it("normalizes known account type aliases", () => {
    expect(normalizeAccountType(" 401(k) ")).toBe("401k");
    expect(normalizeAccountType("Roth IRA")).toBe("roth_ira");
    expect(normalizeAccountType("investment account")).toBe("brokerage");
    expect(normalizeAccountType("Health Savings Account")).toBe("hsa");
  });

  it("preserves unknown account type labels as trimmed strings", () => {
    expect(normalizeAccountType("  Crypto Wallet  ")).toBe("Crypto Wallet");
  });
});
