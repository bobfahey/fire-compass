import { describe, expect, it } from "vitest";

import { GoalPatch, validateGoalPatch } from "@/lib/realign-patch";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validPatch: GoalPatch[] = [
  { name: "401k", weight: 0.30, keywords: ["employer", "401"], action: "keep" },
  { name: "Mega Backdoor Roth", weight: 0.20, keywords: ["mega", "roth"], action: "keep" },
  { name: "ESPP", weight: 0.15, keywords: ["espp", "stock"], action: "keep" },
  { name: "Roth IRA", weight: 0.15, keywords: ["roth", "ira"], action: "keep" },
  { name: "529", weight: 0.10, keywords: ["529", "college"], action: "keep" },
  { name: "Emergency Fund", weight: 0.10, keywords: ["savings", "emergency"], action: "keep" },
];

const multiGoalMultiFieldPatch: GoalPatch[] = [
  { name: "401k", weight: 0.25, keywords: ["employer", "401k"], action: "keep" },
  { name: "Mega Backdoor Roth", weight: 0.20, keywords: ["mega", "backdoor"], action: "keep" },
  { name: "ESPP", weight: 0.15, keywords: ["espp"], action: "keep" },
  { name: "Roth IRA", weight: 0.10, keywords: ["roth", "ira"], action: "keep" },
  { name: "Travel Fund", weight: 0.15, keywords: ["vacation", "airfare", "hotel"], action: "add" },
  { name: "529", weight: 0.15, keywords: ["529", "college"], action: "keep" },
  { name: "Studio Fund", weight: 0, keywords: [], action: "remove" },
];

// ---------------------------------------------------------------------------
// Deterministic apply path
// ---------------------------------------------------------------------------

describe("validateGoalPatch — deterministic apply", () => {
  it("accepts a valid multi-goal patch with weights summing to 1.0", () => {
    const result = validateGoalPatch(validPatch);
    expect(result.valid).toBe(true);
    expect(result.normalizedGoals).toHaveLength(6);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts multi-goal/multi-field patch with adds and removes", () => {
    const result = validateGoalPatch(multiGoalMultiFieldPatch);
    expect(result.valid).toBe(true);
    expect(result.normalizedGoals).toHaveLength(7);

    const addedGoal = result.normalizedGoals!.find((g) => g.name === "Travel Fund");
    expect(addedGoal).toBeDefined();
    expect(addedGoal!.action).toBe("add");
    expect(addedGoal!.keywords).toEqual(["vacation", "airfare", "hotel"]);

    const removedGoal = result.normalizedGoals!.find((g) => g.name === "Studio Fund");
    expect(removedGoal).toBeDefined();
    expect(removedGoal!.action).toBe("remove");
    expect(removedGoal!.weight).toBe(0);
  });

  it("accepts weights within ±0.02 tolerance", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0.51, action: "keep" },
      { name: "Roth", weight: 0.50, action: "keep" },
    ];
    // Sum = 1.01, within tolerance
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(true);
  });

  it("normalizes missing keywords to empty array", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0.6 },
      { name: "Roth", weight: 0.4 },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(true);
    expect(result.normalizedGoals![0].keywords).toEqual([]);
    expect(result.normalizedGoals![1].keywords).toEqual([]);
  });

  it("normalizes missing action to 'keep'", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0.6 },
      { name: "Roth", weight: 0.4 },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(true);
    expect(result.normalizedGoals![0].action).toBe("keep");
    expect(result.normalizedGoals![1].action).toBe("keep");
  });

  it("trims whitespace from goal names", () => {
    const goals: GoalPatch[] = [
      { name: "  401k  ", weight: 1.0, action: "keep" },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(true);
    expect(result.normalizedGoals![0].name).toBe("401k");
  });
});

// ---------------------------------------------------------------------------
// Explicit rejection path
// ---------------------------------------------------------------------------

describe("validateGoalPatch — explicit rejection", () => {
  it("rejects when weights exceed tolerance (sum too high)", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0.6, action: "keep" },
      { name: "Roth", weight: 0.5, action: "keep" },
    ];
    // Sum = 1.10, exceeds tolerance
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("sum to 1.1000");
    expect(result.errors[0]).toContain("expected 1.0");
  });

  it("rejects when weights are too low", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0.3, action: "keep" },
      { name: "Roth", weight: 0.3, action: "keep" },
    ];
    // Sum = 0.60
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("sum to 0.6000");
  });

  it("rejects when a goal has missing name", () => {
    const goals = [
      { name: "", weight: 0.5, action: "keep" },
      { name: "Roth", weight: 0.5, action: "keep" },
    ] as GoalPatch[];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("missing or empty 'name'");
  });

  it("rejects when weight is not a number", () => {
    const goals = [
      { name: "401k", weight: "half" as unknown as number, action: "keep" },
      { name: "Roth", weight: 0.5, action: "keep" },
    ] as GoalPatch[];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must be a number");
  });

  it("rejects negative weights", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: -0.1, action: "keep" },
      { name: "Roth", weight: 1.1, action: "keep" },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("cannot be negative");
  });

  it("rejects invalid action values", () => {
    const goals = [
      { name: "401k", weight: 1.0, action: "merge" },
    ] as unknown as GoalPatch[];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid action");
  });

  it("rejects when all goals are removed", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 0, action: "remove" },
      { name: "Roth", weight: 0, action: "remove" },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("At least one active goal required");
  });

  it("rejects removed goal with non-zero weight", () => {
    const goals: GoalPatch[] = [
      { name: "401k", weight: 1.0, action: "keep" },
      { name: "Old Goal", weight: 0.1, action: "remove" },
    ];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must have weight 0");
  });

  it("rejects empty array", () => {
    const result = validateGoalPatch([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("No goals provided");
  });

  it("collects multiple errors in a single validation pass", () => {
    const goals = [
      { name: "", weight: "bad" as unknown as number, action: "keep" },
      { name: "Roth", weight: -0.5, action: "keep" },
    ] as GoalPatch[];
    const result = validateGoalPatch(goals);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
