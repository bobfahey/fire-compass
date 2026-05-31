import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPE_ALIASES,
  CANONICAL_ACCOUNT_TYPES,
  CANONICAL_GOAL_NAMES,
  GOAL_NAME_ALIASES,
  buildAliasLookup,
  buildSearchHaystack,
  normalizeAccountType,
  normalizeBoolean,
  normalizeGoalName,
  normalizeNumeric,
  normalizeString,
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

// ─── Primitive normalization utility tests ──────────────────────────────────

describe("normalizeString", () => {
  it("returns empty string for null and undefined", () => {
    expect(normalizeString(null)).toBe("");
    expect(normalizeString(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeString("  hello  ")).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeString("hello   world")).toBe("hello world");
    expect(normalizeString("  a   b   c  ")).toBe("a b c");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeString("")).toBe("");
    expect(normalizeString("   ")).toBe("");
  });
});

describe("normalizeNumeric", () => {
  it("returns 0 for null and undefined", () => {
    expect(normalizeNumeric(null)).toBe(0);
    expect(normalizeNumeric(undefined)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(normalizeNumeric("")).toBe(0);
    expect(normalizeNumeric("   ")).toBe(0);
  });

  it("parses plain numbers", () => {
    expect(normalizeNumeric("42")).toBe(42);
    expect(normalizeNumeric("3.14")).toBe(3.14);
  });

  it("strips dollar signs and commas", () => {
    expect(normalizeNumeric("$1,234.56")).toBe(1234.56);
    expect(normalizeNumeric("$100")).toBe(100);
  });

  it("handles negative values", () => {
    expect(normalizeNumeric("-$1,000.50")).toBe(-1000.5);
    expect(normalizeNumeric("-42")).toBe(-42);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(normalizeNumeric("abc")).toBe(0);
    expect(normalizeNumeric("NaN")).toBe(0);
  });
});

describe("normalizeBoolean", () => {
  it("returns false for null and undefined", () => {
    expect(normalizeBoolean(null)).toBe(false);
    expect(normalizeBoolean(undefined)).toBe(false);
  });

  it("returns true only for case-insensitive 'true'", () => {
    expect(normalizeBoolean("true")).toBe(true);
    expect(normalizeBoolean("TRUE")).toBe(true);
    expect(normalizeBoolean("  True  ")).toBe(true);
  });

  it("returns false for anything else", () => {
    expect(normalizeBoolean("false")).toBe(false);
    expect(normalizeBoolean("1")).toBe(false);
    expect(normalizeBoolean("yes")).toBe(false);
    expect(normalizeBoolean("")).toBe(false);
  });
});

describe("buildSearchHaystack", () => {
  it("joins fields with space and lowercases", () => {
    expect(buildSearchHaystack("Hello", "World")).toBe("hello world");
  });

  it("skips null and undefined fields", () => {
    expect(buildSearchHaystack("hello", null, "world", undefined)).toBe("hello world");
  });

  it("trims fields before joining", () => {
    expect(buildSearchHaystack("  foo  ", "  bar  ")).toBe("foo bar");
  });

  it("returns empty string when all fields are empty/null", () => {
    expect(buildSearchHaystack(null, undefined, "", "  ")).toBe("");
  });

  it("handles single field", () => {
    expect(buildSearchHaystack("RETIREMENT")).toBe("retirement");
  });
});
