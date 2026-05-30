import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPE_ALIASES,
  CANONICAL_ACCOUNT_TYPES,
  CANONICAL_GOAL_NAMES,
  GOAL_NAME_ALIASES,
  buildAliasLookup,
  normalizeAccountType,
  normalizeGoalName,
} from "@/lib/normalization";

describe("normalizeGoalName", () => {
  it("passes through canonical goal names unchanged", () => {
    for (const canonicalName of CANONICAL_GOAL_NAMES) {
      expect(normalizeGoalName(canonicalName)).toBe(canonicalName);
    }
  });

  it("normalizes known goal aliases", () => {
    expect(normalizeGoalName("401(k)")).toBe("401k");
    expect(normalizeGoalName("  mega backdoor ")).toBe("Mega Backdoor Roth");
    expect(normalizeGoalName("employee stock purchase plan")).toBe("ESPP");
    expect(normalizeGoalName("college savings")).toBe("529s");
  });

  it("is idempotent", () => {
    const inputs = [
      "401(k)",
      "  Mega Backdoor Roth  ",
      "emergency",
      "custom future goal",
      "  custom future goal  ",
    ];

    for (const input of inputs) {
      const once = normalizeGoalName(input);
      const twice = normalizeGoalName(once);
      expect(twice).toBe(once);
    }
  });

  it("returns unknown values as trimmed input", () => {
    expect(normalizeGoalName("  Family Travel  ")).toBe("Family Travel");
  });
});

describe("normalizeAccountType", () => {
  it("passes through canonical account types unchanged", () => {
    for (const canonicalType of CANONICAL_ACCOUNT_TYPES) {
      expect(normalizeAccountType(canonicalType)).toBe(canonicalType);
    }
  });

  it("normalizes known account type aliases", () => {
    expect(normalizeAccountType("taxable brokerage")).toBe("brokerage");
    expect(normalizeAccountType("  Roth IRA ")).toBe("retirement");
    expect(normalizeAccountType("high yield savings")).toBe("cash");
    expect(normalizeAccountType("employee stock purchase plan")).toBe("espp");
  });

  it("returns unknown values as trimmed input", () => {
    expect(normalizeAccountType("  crypto  ")).toBe("crypto");
  });
});

describe("alias map invariants", () => {
  it("builds goal and account lookups without collisions", () => {
    expect(() =>
      buildAliasLookup(CANONICAL_GOAL_NAMES, GOAL_NAME_ALIASES, "GOAL_NAME_ALIASES"),
    ).not.toThrow();
    expect(() =>
      buildAliasLookup(
        CANONICAL_ACCOUNT_TYPES,
        ACCOUNT_TYPE_ALIASES,
        "ACCOUNT_TYPE_ALIASES",
      ),
    ).not.toThrow();
  });

  it("throws on duplicate alias collisions across canonical values", () => {
    expect(() =>
      buildAliasLookup(
        ["first", "second"] as const,
        {
          first: ["shared-alias"],
          second: ["shared-alias"],
        },
        "TEST_ALIASES",
      ),
    ).toThrow(/alias collision/i);
  });

  it("throws when an alias map references a non-canonical value", () => {
    const invalidAliases = {
      one: ["first"],
      two: ["second"],
    } as unknown as Readonly<Record<"one", readonly string[]>>;

    expect(() =>
      buildAliasLookup(["one"] as const, invalidAliases, "TEST_ALIASES"),
    ).toThrow(/unknown canonical/i);
  });
});
