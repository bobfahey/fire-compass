/**
 * Tests verifying FIRE engine behavior under normalized inputs.
 * PR4: fire-engine alignment — ensures snapshot/projection calculations
 * stay consistent after normalization changes from PR3.
 */
import { describe, expect, it } from "vitest";

import {
  buildCoupleAlignment,
  buildFireProjection,
  buildMonthlyGoalFunding,
  DEFAULT_GOALS,
  rankGoals,
} from "@/lib/fire";
import { Account, Transaction } from "@/lib/types";

// Helper: build a normalized transaction
const tx = (
  overrides: Partial<Transaction> & { category: string; amount: number },
): Transaction => ({
  date: "2024-03-15",
  description: "",
  account: "Main",
  owner: "Alice",
  transactionType: "regular",
  ...overrides,
});

// Helper: build a normalized account
const acct = (
  overrides: Partial<Account> & { type: string; balance: number },
): Account => ({
  name: "Account",
  ...overrides,
});

describe("fire-engine with normalized data", () => {
  describe("buildFireProjection — account type filtering", () => {
    const baseAccounts: Account[] = [
      acct({ name: "Brokerage", type: "brokerage", balance: 100_000 }),
      acct({ name: "401k", type: "retirement", balance: 200_000 }),
      acct({ name: "Savings", type: "cash", balance: 50_000 }),
      acct({ name: "ESPP", type: "espp", balance: 30_000 }),
    ];

    const baseTransactions: Transaction[] = [
      tx({ date: "2024-01-15", amount: 10_000, category: "Income" }),
      tx({ date: "2024-02-15", amount: 10_000, category: "Income" }),
      tx({ date: "2024-03-15", amount: -5_000, category: "Rent" }),
    ];

    it("includes all canonical investable account types in total", () => {
      const projection = buildFireProjection("2035-01-01", baseAccounts, baseTransactions, [
        { name: "Empty Nest", years: 20, annualSpending: 80_000 },
      ]);

      // 100k + 200k + 50k + 30k = 380k
      expect(projection.currentInvestableAssets).toBe(380_000);
    });

    it("excludes non-canonical account types (e.g. credit-card, loan)", () => {
      const accounts = [
        ...baseAccounts,
        acct({ name: "Visa", type: "credit-card", balance: -5_000 }),
        acct({ name: "Mortgage", type: "loan", balance: -300_000 }),
      ];

      const projection = buildFireProjection("2035-01-01", accounts, baseTransactions, [
        { name: "Empty Nest", years: 20, annualSpending: 80_000 },
      ]);

      expect(projection.currentInvestableAssets).toBe(380_000);
    });

    it("handles accounts already normalized from raw aliases", () => {
      // After normalization, "checking" → "cash", "401k" → "retirement"
      const accounts = [
        acct({ name: "Checking", type: "cash", balance: 10_000 }),
        acct({ name: "Roth IRA", type: "retirement", balance: 60_000 }),
      ];

      const projection = buildFireProjection("2035-01-01", accounts, baseTransactions, [
        { name: "Empty Nest", years: 20, annualSpending: 50_000 },
      ]);

      expect(projection.currentInvestableAssets).toBe(70_000);
    });
  });

  describe("rankGoals — normalized category matching", () => {
    it("matches canonical goal name in category directly", () => {
      const transactions = [
        tx({ category: "401k", amount: -1_000, date: "2024-03-15" }),
        tx({ category: "401k", amount: -1_000, date: "2024-04-15" }),
        tx({ category: "Mega Backdoor Roth", amount: -500, date: "2024-03-15" }),
        tx({ category: "ESPP", amount: -800, date: "2024-04-15" }),
        tx({ category: "Income", amount: 10_000, date: "2024-03-15" }),
      ];

      const result = rankGoals(transactions, 50_000);
      const goal401k = result.find((g) => g.goal === "401k");
      const goalMBDR = result.find((g) => g.goal === "Mega Backdoor Roth");
      const goalESPP = result.find((g) => g.goal === "ESPP");

      // 2 months of data → annualized: 401k = 2000/2*12 = 12000
      expect(goal401k!.annualActual).toBe(12_000);
      // MBDR = 500/2*12 = 3000
      expect(goalMBDR!.annualActual).toBe(3_000);
      // ESPP = 800/2*12 = 4800
      expect(goalESPP!.annualActual).toBe(4_800);
    });

    it("still matches via keyword fallback in description field", () => {
      // Category doesn't match a goal, but description contains a keyword
      const transactions = [
        tx({
          category: "Transfer",
          description: "contribution to 529 plan",
          amount: -200,
        }),
        tx({ category: "Income", amount: 5_000 }),
      ];

      const result = rankGoals(transactions, 50_000);
      const goal529 = result.find((g) => g.goal === "529s");

      expect(goal529!.annualActual).toBeGreaterThan(0);
    });

    it("prefers canonical category match over keyword substring", () => {
      // "401k" as category should match 401k goal, not get confused by other keywords
      const transactions = [
        tx({ category: "401k", description: "mega backdoor", amount: -500 }),
        tx({ category: "Income", amount: 5_000 }),
      ];

      const result = rankGoals(transactions, 50_000);
      const goal401k = result.find((g) => g.goal === "401k");

      // Category "401k" should win even though description says "mega backdoor"
      expect(goal401k!.annualActual).toBeGreaterThan(0);
    });
  });

  describe("buildMonthlyGoalFunding — normalized categories", () => {
    it("groups funding by month using canonical category names", () => {
      const transactions = [
        tx({ date: "2024-01-15", category: "401k", amount: -1_000 }),
        tx({ date: "2024-01-20", category: "Roth IRA", amount: -500 }),
        tx({ date: "2024-02-15", category: "401k", amount: -1_000 }),
        tx({ date: "2024-02-20", category: "Emergency Fund", amount: -300 }),
      ];

      const result = buildMonthlyGoalFunding(transactions);

      expect(result).toHaveLength(2);
      expect(result[0].month).toBe("2024-01");
      expect(result[0].funding["401k"]).toBe(1_000);
      expect(result[0].funding["Roth IRA"]).toBe(500);
      expect(result[1].month).toBe("2024-02");
      expect(result[1].funding["401k"]).toBe(1_000);
      expect(result[1].funding["Emergency Fund"]).toBe(300);
    });

    it("returns empty array when no goal-matched transactions", () => {
      const transactions = [
        tx({ date: "2024-01-15", category: "Groceries", amount: -200 }),
      ];

      const result = buildMonthlyGoalFunding(transactions);
      // Unmatched categories still produce month entries but with zero funding
      expect(result[0].funding["401k"]).toBe(0);
    });
  });

  describe("buildCoupleAlignment — normalized inputs", () => {
    it("classifies normalized goal categories as top-priority", () => {
      const transactions = [
        tx({ owner: "Alice", category: "401k", amount: -2_000 }),
        tx({ owner: "Alice", category: "ESPP", amount: -1_000 }),
        tx({ owner: "Alice", category: "Groceries", amount: -500 }),
        tx({ owner: "Alice", category: "Income", amount: 10_000 }),
        tx({ owner: "Bob", category: "Roth IRA", amount: -1_500 }),
        tx({ owner: "Bob", category: "Dining", amount: -300 }),
        tx({ owner: "Bob", category: "Income", amount: 8_000 }),
      ];

      const result = buildCoupleAlignment(transactions);
      const alice = result.find((r) => r.partner === "Alice")!;
      const bob = result.find((r) => r.partner === "Bob")!;

      // Alice: topPriority = 3000, income = 10000 → 30%
      expect(alice.topPrioritySavingsRate).toBe(30.0);
      // Alice: discretionary = 500, income = 10000 → 5%
      expect(alice.discretionarySpendingRate).toBe(5.0);

      // Bob: topPriority = 1500, income = 8000 → 18.75%  (18.8 rounded)
      expect(bob.topPrioritySavingsRate).toBe(18.8);
      // Bob: discretionary = 300, income = 8000 → 3.75%  (3.8 rounded)
      expect(bob.discretionarySpendingRate).toBe(3.8);
    });

    it("recognizes keywords in description when category is generic", () => {
      const transactions = [
        tx({
          owner: "Alice",
          category: "Transfer",
          description: "401k contribution",
          amount: -500,
        }),
        tx({ owner: "Alice", category: "Income", amount: 5_000 }),
      ];

      const result = buildCoupleAlignment(transactions);
      const alice = result.find((r) => r.partner === "Alice")!;

      // 500/5000 = 10%
      expect(alice.topPrioritySavingsRate).toBe(10.0);
      expect(alice.discretionarySpendingRate).toBe(0);
    });
  });
});
