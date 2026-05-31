import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { parseAndValidateConfig, serializeConfig } from "@/lib/config-loader";

describe("parseAndValidateConfig", () => {
  it("accepts a valid full config", () => {
    const raw = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["401k"] }],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.goals).toHaveLength(1);
    expect(config.phases).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("normalizes goal names on load", () => {
    const raw = {
      goals: [
        { name: "401(k)", weight: 0.16, keywords: ["401k"] },
        { name: "  mega backdoor ", weight: 0.10, keywords: ["mega"] },
      ],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.goals[0].name).toBe("401k");
    expect(config.goals[1].name).toBe("Mega Backdoor Roth");
    expect(warnings.some((w) => w.includes("normalized"))).toBe(true);
  });

  it("detects duplicate goals after normalization", () => {
    const raw = {
      goals: [
        { name: "401k", weight: 0.16, keywords: ["401k"] },
        { name: "401(k)", weight: 0.10, keywords: ["401(k)"] },
      ],
      phases: [{ name: "Empty Nest", years: 20, multiplier: 0.8 }],
    };
    const { warnings } = parseAndValidateConfig(raw);
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });

  it("falls back to default goals when goals array is missing", () => {
    const raw = {
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.goals).toEqual(DEFAULT_CONFIG.goals);
    expect(warnings.some((w) => w.includes("Missing"))).toBe(true);
  });

  it("falls back to default phases when phases array is missing", () => {
    const raw = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["401k"] }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.phases).toEqual(DEFAULT_CONFIG.phases);
    expect(warnings.some((w) => w.includes("Missing"))).toBe(true);
  });

  it("skips invalid goal entries but keeps valid ones", () => {
    const raw = {
      goals: [
        { name: "401k", weight: 0.16, keywords: ["401k"] },
        { name: "", weight: 0.10, keywords: [] }, // invalid: empty name
        { name: "ESPP", weight: 2, keywords: ["espp"] }, // invalid: weight > 1
        { name: "Roth IRA", weight: 0.08, keywords: ["roth"] },
      ],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.goals).toHaveLength(2);
    expect(config.goals[0].name).toBe("401k");
    expect(config.goals[1].name).toBe("Roth IRA");
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("skips invalid phase entries but keeps valid ones", () => {
    const raw = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["401k"] }],
      phases: [
        { name: "Young Kids", years: 4, multiplier: 1.1 },
        { name: "", years: 4, multiplier: 1.0 }, // invalid: empty name
        { name: "Empty Nest", years: -1, multiplier: 0.8 }, // invalid: negative years
        { name: "Peak Kid Costs", years: 5, multiplier: 1.35 },
      ],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.phases).toHaveLength(2);
    expect(config.phases[0].name).toBe("Young Kids");
    expect(config.phases[1].name).toBe("Peak Kid Costs");
  });

  it("canonicalizes case-insensitive phase names and rejects unknown phase names", () => {
    const raw = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["401k"] }],
      phases: [
        { name: "young kids", years: 4, multiplier: 1.1 },
        { name: "Unknown Phase", years: 3, multiplier: 1.0 },
      ],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.phases).toEqual([{ name: "Young Kids", years: 4, multiplier: 1.1 }]);
    expect(warnings.some((w) => w.includes("unrecognized phase name"))).toBe(true);
  });

  it("uses defaults when all goals are invalid", () => {
    const raw = {
      goals: [
        { name: "", weight: 0.16, keywords: ["x"] },
        { weight: 0.10, keywords: ["y"] },
      ],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config, warnings } = parseAndValidateConfig(raw);
    expect(config.goals).toEqual(DEFAULT_CONFIG.goals);
    expect(warnings.some((w) => w.includes("All goal entries were invalid"))).toBe(true);
  });

  it("throws if raw input is not an object", () => {
    expect(() => parseAndValidateConfig("string")).toThrow("must be a JSON object");
    expect(() => parseAndValidateConfig(null)).toThrow("must be a JSON object");
    expect(() => parseAndValidateConfig([1, 2, 3])).toThrow("must be a JSON object");
  });

  it("filters out non-string and empty keywords", () => {
    const raw = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["401k", "", 123, "  ", "match"] }],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const { config } = parseAndValidateConfig(raw);
    expect(config.goals[0].keywords).toEqual(["401k", "match"]);
  });
});

describe("serializeConfig", () => {
  it("produces deterministic output regardless of input key order", () => {
    const config1 = {
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
      goals: [{ name: "401k", weight: 0.16, keywords: ["b", "a"] }],
    };
    const config2 = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["a", "b"] }],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    // Keywords are sorted in output
    expect(serializeConfig(config1)).toBe(serializeConfig(config2));
  });

  it("normalizes goal names in serialized output", () => {
    const config = {
      goals: [{ name: "401(k)", weight: 0.16, keywords: ["401k"] }],
      phases: [{ name: "Young Kids", years: 4, multiplier: 1.1 }],
    };
    const serialized = serializeConfig(config);
    const parsed = JSON.parse(serialized);
    expect(parsed.goals[0].name).toBe("401k");
  });

  it("sorts keywords alphabetically for determinism", () => {
    const config = {
      goals: [{ name: "401k", weight: 0.16, keywords: ["zebra", "alpha", "middle"] }],
      phases: [],
    };
    const serialized = serializeConfig(config);
    const parsed = JSON.parse(serialized);
    expect(parsed.goals[0].keywords).toEqual(["alpha", "middle", "zebra"]);
  });

  it("ends with a trailing newline", () => {
    const serialized = serializeConfig(DEFAULT_CONFIG);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("round-trips through parse without data loss", () => {
    const serialized = serializeConfig(DEFAULT_CONFIG);
    const reparsed = JSON.parse(serialized);
    const { config } = parseAndValidateConfig(reparsed);
    const reserialized = serializeConfig(config);
    expect(reserialized).toBe(serialized);
  });
});
