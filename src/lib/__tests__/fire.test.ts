import { describe, expect, it } from "vitest";

import {
  buildCoupleAlignment,
  buildFireProjection,
  buildLifePhases,
  buildMonthlyGoalFunding,
  buildPortfolioSeries,
  coupleAlignmentSummary,
  DEFAULT_GOALS,
  DEFAULT_PHASES,
  detectPriorityDrift,
  rankGoals,
  REAL_RETURN_RATE,
  SAFE_WITHDRAWAL_RATE,
  simulateRequiredNestEgg,
} from "@/lib/fire";
import { Account, GoalFunding, SpendingCategory, Transaction } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  date: "2026-01-01",
  amount: 100,
  description: "salary",
  category: "Income",
  account: "Checking",
  owner: "Alex",
  ...overrides,
});

const baseAccounts: Account[] = [
  { name: "Checking", balance: 28_000, type: "cash" },
  { name: "401k", balance: 318_000, type: "retirement" },
  { name: "Brokerage", balance: 146_000, type: "brokerage" },
  { name: "Mortgage", balance: -420_000, type: "debt" }, // should be excluded
];

const baseCategories: SpendingCategory[] = [
  { name: "Housing", monthlyBudget: 6_500 },
  { name: "Food", monthlyBudget: 1_800 },
];

const twoMonthTransactions: Transaction[] = [
  makeTransaction({ date: "2026-01-01", amount: 12_000, owner: "Alex" }),
  makeTransaction({ date: "2026-01-01", amount: 9_800, owner: "Jamie" }),
  makeTransaction({ date: "2026-01-03", amount: -1_400, description: "401k contribution", category: "401k", owner: "Alex" }),
  makeTransaction({ date: "2026-01-03", amount: -1_200, description: "401k contribution", category: "401k", owner: "Jamie" }),
  makeTransaction({ date: "2026-01-05", amount: -800, description: "ESPP deduction", category: "ESPP", owner: "Alex" }),
  makeTransaction({ date: "2026-01-09", amount: -6_200, description: "Mortgage payment", category: "Debt Paydown", owner: "Alex" }),
  makeTransaction({ date: "2026-02-01", amount: 12_000, owner: "Alex" }),
  makeTransaction({ date: "2026-02-01", amount: 9_800, owner: "Jamie" }),
  makeTransaction({ date: "2026-02-03", amount: -1_400, description: "401k contribution", category: "401k", owner: "Alex" }),
  makeTransaction({ date: "2026-02-03", amount: -1_200, description: "401k contribution", category: "401k", owner: "Jamie" }),
  makeTransaction({ date: "2026-02-05", amount: -800, description: "ESPP deduction", category: "ESPP", owner: "Alex" }),
  makeTransaction({ date: "2026-02-09", amount: -6_200, description: "Mortgage payment", category: "Debt Paydown", owner: "Alex" }),
];

// ---------------------------------------------------------------------------
// buildLifePhases
// ---------------------------------------------------------------------------

describe("buildLifePhases", () => {
  it("returns one phase per config entry", () => {
    const phases = buildLifePhases(twoMonthTransactions, baseCategories);
    expect(phases).toHaveLength(DEFAULT_PHASES.length);
  });

  it("uses the category budget as baseline when it exceeds transaction expenses", () => {
    const highBudgetCategories: SpendingCategory[] = [{ name: "Housing", monthlyBudget: 100_000 }];
    const phases = buildLifePhases([], highBudgetCategories);
    expect(phases[0].annualSpending).toBe(Math.round(100_000 * 12 * DEFAULT_PHASES[0].multiplier));
  });

  it("uses custom phase config when provided", () => {
    const customPhases = [{ name: "Empty Nest" as const, years: 30, multiplier: 0.5 }];
    const result = buildLifePhases(twoMonthTransactions, baseCategories, customPhases);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Empty Nest");
    expect(result[0].years).toBe(30);
  });

  it("returns zero spending when there are no transactions or categories", () => {
    const phases = buildLifePhases([], []);
    for (const phase of phases) {
      expect(phase.annualSpending).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// simulateRequiredNestEgg
// ---------------------------------------------------------------------------

describe("simulateRequiredNestEgg", () => {
  it("returns 0 when all phases have zero spending", () => {
    const zeroPhases = DEFAULT_PHASES.map((p) => ({ ...p, name: p.name, years: p.years, annualSpending: 0 }));
    expect(simulateRequiredNestEgg(zeroPhases)).toBe(0);
  });

  it("returns 0 for an empty phase list", () => {
    expect(simulateRequiredNestEgg([])).toBe(0);
  });

  it("is less conservative than max-phase / SWR for mixed-spending phases", () => {
    const phases = buildLifePhases(twoMonthTransactions, baseCategories);
    const maxSpending = Math.max(...phases.map((p) => p.annualSpending));
    const oldNaive = Math.round(maxSpending / SAFE_WITHDRAWAL_RATE);
    expect(simulateRequiredNestEgg(phases)).toBeLessThan(oldNaive);
  });

  it("equals a single annuity PV for a single phase", () => {
    const spending = 50_000;
    const years = 10;
    const phases = [{ name: "Only" as const, years, annualSpending: spending }];
    const result = simulateRequiredNestEgg(phases, REAL_RETURN_RATE);

    // Manual PV calculation
    let expected = 0;
    for (let i = 1; i <= years; i++) {
      expected += spending / Math.pow(1 + REAL_RETURN_RATE, i);
    }
    expect(result).toBe(Math.round(expected));
  });

  it("accounts for phase ordering (front-loaded spending needs more)", () => {
    const highThenLow = [
      { name: "High" as const, years: 5, annualSpending: 100_000 },
      { name: "Low" as const, years: 5, annualSpending: 50_000 },
    ];
    const lowThenHigh = [
      { name: "Low" as const, years: 5, annualSpending: 50_000 },
      { name: "High" as const, years: 5, annualSpending: 100_000 },
    ];
    // Front-loaded high spending is discounted less, so requires more
    expect(simulateRequiredNestEgg(highThenLow)).toBeGreaterThan(simulateRequiredNestEgg(lowThenHigh));
  });
});

// ---------------------------------------------------------------------------
// buildFireProjection
// ---------------------------------------------------------------------------

describe("buildFireProjection", () => {
  const phases = buildLifePhases(twoMonthTransactions, baseCategories);

  it("excludes non-investable accounts (debt) from current assets", () => {
    const projection = buildFireProjection("2038-01-01", baseAccounts, twoMonthTransactions, phases);
    expect(projection.currentInvestableAssets).toBe(28_000 + 318_000 + 146_000);
  });

  it("projects to zero when yearsToFire is 0", () => {
    const pastDate = "2020-01-01";
    const projection = buildFireProjection(pastDate, baseAccounts, twoMonthTransactions, phases);
    expect(projection.yearsToFire).toBe(0);
    expect(projection.projectedPortfolioAtFire).toBe(projection.currentInvestableAssets);
  });

  it("returns annualSavings of 0 when expenses exceed income", () => {
    const heavyExpense: Transaction[] = [
      makeTransaction({ amount: 1_000, date: "2026-01-01" }),
      makeTransaction({ amount: -5_000, date: "2026-01-02" }),
    ];
    const projection = buildFireProjection("2038-01-01", baseAccounts, heavyExpense, phases);
    expect(projection.annualSavings).toBe(0);
  });

  it("sets fireReady = true when projected portfolio >= required nest egg", () => {
    const richAccounts: Account[] = [{ name: "401k", balance: 100_000_000, type: "retirement" }];
    const projection = buildFireProjection("2038-01-01", richAccounts, twoMonthTransactions, phases);
    expect(projection.fireReady).toBe(true);
  });

  it("sets fireReady = false when portfolio is insufficient", () => {
    const smallAccounts: Account[] = [{ name: "401k", balance: 1_000, type: "retirement" }];
    const projection = buildFireProjection("2038-01-01", smallAccounts, [], phases);
    expect(projection.fireReady).toBe(false);
  });

  it("sizes nest egg via present-value drawdown simulation, not max-phase / SWR", () => {
    const projection = buildFireProjection("2038-01-01", baseAccounts, twoMonthTransactions, phases);
    const maxSpending = Math.max(...phases.map((p) => p.annualSpending));
    const oldNaive = Math.round(maxSpending / SAFE_WITHDRAWAL_RATE);
    // New simulation should produce a smaller (less conservative) number
    expect(projection.requiredNestEggAtFire).toBeLessThan(oldNaive);
    expect(projection.requiredNestEggAtFire).toBe(simulateRequiredNestEgg(phases));
  });

  it("compounds at REAL_RETURN_RATE", () => {
    const singleYearTarget = new Date();
    singleYearTarget.setFullYear(singleYearTarget.getFullYear() + 1);
    const projection = buildFireProjection(
      singleYearTarget.toISOString().slice(0, 10),
      [{ name: "401k", balance: 100_000, type: "retirement" }],
      [],
      phases,
    );
    expect(projection.projectedPortfolioAtFire).toBe(Math.round(100_000 * (1 + REAL_RETURN_RATE)));
  });
});

// ---------------------------------------------------------------------------
// buildPortfolioSeries
// ---------------------------------------------------------------------------

describe("buildPortfolioSeries", () => {
  it("returns yearsToFire+1 data points", () => {
    const phases = buildLifePhases(twoMonthTransactions, baseCategories);
    const projection = buildFireProjection("2038-01-01", baseAccounts, twoMonthTransactions, phases);
    const series = buildPortfolioSeries(projection);
    expect(series).toHaveLength(projection.yearsToFire + 1);
  });

  it("first point equals current investable assets when annualSavings is 0", () => {
    const phases = buildLifePhases([], []);
    const projection = buildFireProjection("2038-01-01", baseAccounts, [], phases);
    const series = buildPortfolioSeries(projection);
    expect(series[0].projected).toBe(projection.currentInvestableAssets);
  });

  it("required is constant across all points", () => {
    const phases = buildLifePhases(twoMonthTransactions, baseCategories);
    const projection = buildFireProjection("2038-01-01", baseAccounts, twoMonthTransactions, phases);
    const series = buildPortfolioSeries(projection);
    for (const point of series) {
      expect(point.required).toBe(projection.requiredNestEggAtFire);
    }
  });

  it("last point projected equals projectedPortfolioAtFire", () => {
    const phases = buildLifePhases(twoMonthTransactions, baseCategories);
    const projection = buildFireProjection("2038-01-01", baseAccounts, twoMonthTransactions, phases);
    const series = buildPortfolioSeries(projection);
    expect(series.at(-1)!.projected).toBe(projection.projectedPortfolioAtFire);
  });
});

// ---------------------------------------------------------------------------
// rankGoals
// ---------------------------------------------------------------------------

describe("rankGoals", () => {
  it("returns a funding row for every goal", () => {
    const result = rankGoals(twoMonthTransactions, 50_000);
    expect(result).toHaveLength(DEFAULT_GOALS.length);
  });

  it("marks a goal as underfunded when actual is < 85% of target", () => {
    const result = rankGoals([], 100_000);
    for (const row of result) {
      expect(row.status).toBe("underfunded");
      expect(row.annualActual).toBe(0);
    }
  });

  it("marks a goal as on-track when actual is within 85–115% of target", () => {
    const annualSavings = 50_000;
    const goal401kWeight = DEFAULT_GOALS.find((g) => g.name === "401k")!.weight;
    const target = annualSavings * goal401kWeight;
    const monthlyTarget = target / 12;

    // produce exactly the monthly target for 401k in Jan + Feb
    const txns: Transaction[] = [
      makeTransaction({ date: "2026-01-01", amount: 10_000 }),
      makeTransaction({ date: "2026-02-01", amount: 10_000 }),
      makeTransaction({ date: "2026-01-03", amount: -monthlyTarget, description: "401k contribution", category: "401k" }),
      makeTransaction({ date: "2026-02-03", amount: -monthlyTarget, description: "401k contribution", category: "401k" }),
    ];

    const result = rankGoals(txns, annualSavings);
    const row = result.find((r) => r.goal === "401k")!;
    expect(row.status).toBe("on-track");
  });

  it("uses custom goal config when provided", () => {
    const customGoals = [{ name: "401k" as const, weight: 1.0, keywords: ["401k"] }];
    const result = rankGoals(twoMonthTransactions, 50_000, customGoals);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildMonthlyGoalFunding
// ---------------------------------------------------------------------------

describe("buildMonthlyGoalFunding", () => {
  it("returns one entry per distinct month with expenses", () => {
    const result = buildMonthlyGoalFunding(twoMonthTransactions);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("2026-01");
    expect(result[1].month).toBe("2026-02");
  });

  it("returns empty array when there are no transactions", () => {
    expect(buildMonthlyGoalFunding([])).toEqual([]);
  });

  it("ignores income transactions", () => {
    const onlyIncome: Transaction[] = [makeTransaction({ amount: 10_000 })];
    expect(buildMonthlyGoalFunding(onlyIncome)).toEqual([]);
  });

  it("accumulates goal amounts correctly within a month", () => {
    const txns: Transaction[] = [
      makeTransaction({ date: "2026-01-01", amount: -500, description: "401k", category: "401k" }),
      makeTransaction({ date: "2026-01-15", amount: -300, description: "401k", category: "401k" }),
    ];
    const result = buildMonthlyGoalFunding(txns);
    expect(result[0].funding["401k"]).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// detectPriorityDrift
// ---------------------------------------------------------------------------

describe("detectPriorityDrift", () => {
  it("returns empty array when no drift", () => {
    const funding: GoalFunding[] = DEFAULT_GOALS.map((g, i) => ({
      goal: g.name,
      agreedPriority: i + 1,
      annualTarget: 10_000,
      annualActual: 10_000,
      status: "on-track",
    }));
    expect(detectPriorityDrift(funding)).toHaveLength(0);
  });

  it("reports drift when lower-priority goal is overfunded vs underfunded higher goal", () => {
    const funding: GoalFunding[] = [
      { goal: "401k", agreedPriority: 1, annualTarget: 10_000, annualActual: 1_000, status: "underfunded" },
      { goal: "ESPP", agreedPriority: 2, annualTarget: 5_000, annualActual: 8_000, status: "overfunded" },
    ];
    const drift = detectPriorityDrift(funding);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0]).toMatch(/ESPP.*401k/);
  });

  it("does not report drift when higher goal is on-track", () => {
    const funding: GoalFunding[] = [
      { goal: "401k", agreedPriority: 1, annualTarget: 5_000, annualActual: 5_000, status: "on-track" },
      { goal: "ESPP", agreedPriority: 2, annualTarget: 3_000, annualActual: 8_000, status: "overfunded" },
    ];
    expect(detectPriorityDrift(funding)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildCoupleAlignment
// ---------------------------------------------------------------------------

describe("buildCoupleAlignment", () => {
  it("returns one entry per distinct owner", () => {
    const result = buildCoupleAlignment(twoMonthTransactions);
    const partners = result.map((r) => r.partner).sort();
    expect(partners).toEqual(["Alex", "Jamie"]);
  });

  it("returns empty array when there are no transactions", () => {
    expect(buildCoupleAlignment([])).toHaveLength(0);
  });

  it("handles a single partner", () => {
    const solo: Transaction[] = [
      makeTransaction({ amount: 10_000, owner: "Alex" }),
      makeTransaction({ amount: -2_000, description: "401k", category: "401k", owner: "Alex" }),
    ];
    const result = buildCoupleAlignment(solo);
    expect(result).toHaveLength(1);
    expect(result[0].topPrioritySavingsRate).toBeGreaterThan(0);
  });

  it("computes savings rate as percentage of income", () => {
    const txns: Transaction[] = [
      makeTransaction({ amount: 10_000, owner: "Alex" }),
      makeTransaction({ amount: -2_000, description: "401k contribution", category: "401k", owner: "Alex" }),
    ];
    const result = buildCoupleAlignment(txns);
    const alex = result.find((r) => r.partner === "Alex")!;
    expect(alex.topPrioritySavingsRate).toBe(20.0);
  });
});

// ---------------------------------------------------------------------------
// coupleAlignmentSummary
// ---------------------------------------------------------------------------

describe("coupleAlignmentSummary", () => {
  it("returns a needs-data message with fewer than 2 partners", () => {
    const msg = coupleAlignmentSummary([{ partner: "Alex", topPrioritySavingsRate: 20, discretionarySpendingRate: 10 }]);
    expect(msg).toMatch(/need data/i);
  });

  it("reports aligned when gaps are <= 5 pts", () => {
    const msg = coupleAlignmentSummary([
      { partner: "Alex", topPrioritySavingsRate: 20, discretionarySpendingRate: 30 },
      { partner: "Jamie", topPrioritySavingsRate: 22, discretionarySpendingRate: 33 },
    ]);
    expect(msg).toMatch(/aligned/i);
  });

  it("reports drift when top-priority gap > 5 pts", () => {
    const msg = coupleAlignmentSummary([
      { partner: "Alex", topPrioritySavingsRate: 20, discretionarySpendingRate: 30 },
      { partner: "Jamie", topPrioritySavingsRate: 5, discretionarySpendingRate: 30 },
    ]);
    expect(msg).toMatch(/drift/i);
  });
});
