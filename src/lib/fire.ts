import {
  Account,
  CoupleAlignment,
  FireConfig,
  FireProjection,
  GoalConfig,
  GoalFunding,
  GoalName,
  LifePhase,
  MonthlyGoalFunding,
  PhaseConfig,
  PortfolioDataPoint,
  SpendingCategory,
  Transaction,
} from "@/lib/types";

export const REAL_RETURN_RATE = 0.07;
export const SAFE_WITHDRAWAL_RATE = 0.04;

export const DEFAULT_PHASES: PhaseConfig[] = [
  { name: "Young Kids", years: 4, multiplier: 1.1 },
  { name: "Growing Kids", years: 6, multiplier: 1.2 },
  { name: "Peak Kid Costs", years: 5, multiplier: 1.35 },
  { name: "Launching Kids", years: 5, multiplier: 1.1 },
  { name: "Empty Nest", years: 20, multiplier: 0.8 },
];

export const DEFAULT_GOALS: GoalConfig[] = [
  { name: "Mega Backdoor Roth", weight: 0.10, keywords: ["mega backdoor", "after-tax 401k", "after tax 401k", "in-plan conversion"] },
  { name: "401k", weight: 0.16, keywords: ["401k", "401(k)"] },
  { name: "ESPP", weight: 0.18, keywords: ["espp", "stock purchase"] },
  { name: "Roth IRA", weight: 0.08, keywords: ["roth ira", "backdoor roth ira", "ira contribution"] },
  { name: "529s", weight: 0.16, keywords: ["529", "college"] },
  { name: "Emergency Fund", weight: 0.14, keywords: ["emergency", "cash reserve", "ally"] },
  { name: "Studio Fund", weight: 0.08, keywords: ["studio"] },
  { name: "Debt Paydown", weight: 0.10, keywords: ["debt", "loan", "mortgage"] },
];

const annualize = (transactions: Transaction[]): { annualIncome: number; annualExpense: number } => {
  if (transactions.length === 0) {
    return { annualIncome: 0, annualExpense: 0 };
  }

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const first = new Date(sorted[0].date);
  const last = new Date(sorted[sorted.length - 1].date);
  const months = Math.max(
    1,
    (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1,
  );

  const { income, expense } = sorted.reduce(
    (totals, t) => {
      if (t.amount > 0) {
        totals.income += t.amount;
      } else {
        totals.expense += Math.abs(t.amount);
      }
      return totals;
    },
    { income: 0, expense: 0 },
  );

  return {
    annualIncome: (income / months) * 12,
    annualExpense: (expense / months) * 12,
  };
};

export const buildLifePhases = (
  transactions: Transaction[],
  categories: SpendingCategory[],
  phases: PhaseConfig[] = DEFAULT_PHASES,
): LifePhase[] => {
  const { annualExpense } = annualize(transactions);
  const categoryBudget = categories.reduce((sum, c) => sum + c.monthlyBudget, 0) * 12;
  const baseline = Math.max(annualExpense, categoryBudget);

  return phases.map((phase) => ({
    name: phase.name,
    years: phase.years,
    annualSpending: Math.round(baseline * phase.multiplier),
  }));
};

/**
 * Present-value drawdown simulation: sums each phase-year's spending
 * discounted back to the FIRE date, giving a tighter nest-egg target
 * than the old "max-phase / SWR" rule.
 */
export const simulateRequiredNestEgg = (
  phases: LifePhase[],
  realReturnRate: number = REAL_RETURN_RATE,
): number => {
  let presentValue = 0;
  let yearIndex = 0;

  for (const phase of phases) {
    for (let y = 0; y < phase.years; y++) {
      presentValue += phase.annualSpending / Math.pow(1 + realReturnRate, yearIndex);
      yearIndex++;
    }
  }

  return Math.round(presentValue);
};

export const buildFireProjection = (
  targetDate: string,
  accounts: Account[],
  transactions: Transaction[],
  phases: LifePhase[],
): FireProjection => {
  const now = new Date();
  const target = new Date(targetDate);
  const yearsToFire = Math.max(0, target.getFullYear() - now.getFullYear());

  const currentInvestableAssets = accounts
    .filter((a) => ["brokerage", "retirement", "cash", "espp"].includes(a.type.toLowerCase()))
    .reduce((sum, a) => sum + a.balance, 0);

  const { annualIncome, annualExpense } = annualize(transactions);
  const annualSavings = Math.max(0, annualIncome - annualExpense);

  const projectedPortfolioAtFire = Math.round(
    currentInvestableAssets * Math.pow(1 + REAL_RETURN_RATE, yearsToFire) +
      annualSavings * ((Math.pow(1 + REAL_RETURN_RATE, yearsToFire) - 1) / REAL_RETURN_RATE),
  );

  const requiredNestEggAtFire = simulateRequiredNestEgg(phases);

  return {
    targetDate,
    yearsToFire,
    currentInvestableAssets: Math.round(currentInvestableAssets),
    annualSavings: Math.round(annualSavings),
    projectedPortfolioAtFire,
    requiredNestEggAtFire,
    fireReady: projectedPortfolioAtFire >= requiredNestEggAtFire,
  };
};

export const buildPortfolioSeries = (projection: FireProjection): PortfolioDataPoint[] => {
  const currentYear = new Date().getFullYear();
  const points: PortfolioDataPoint[] = [];

  for (let i = 0; i <= projection.yearsToFire; i += 1) {
    const projected = Math.round(
      projection.currentInvestableAssets * Math.pow(1 + REAL_RETURN_RATE, i) +
        projection.annualSavings * ((Math.pow(1 + REAL_RETURN_RATE, i) - 1) / REAL_RETURN_RATE),
    );
    points.push({ year: currentYear + i, projected, required: projection.requiredNestEggAtFire });
  }

  return points;
};

export const rankGoals = (
  transactions: Transaction[],
  annualSavings: number,
  goalConfig: GoalConfig[] = DEFAULT_GOALS,
  accounts: Account[] = [],
): GoalFunding[] => {
  // Track annual contribution rate from transactions (expenses/outflows only)
  const spendingByGoal = new Map<GoalName, number>(
    goalConfig.map((goal) => [goal.name, 0]),
  );

  // Track account balances matched to goals
  const balanceByGoal = new Map<GoalName, number>();

  // Match accounts to goals by keywords
  for (const account of accounts) {
    const haystack = `${account.name} ${account.type}`.toLowerCase();
    const match = goalConfig.find((goal) => goal.keywords.some((k) => haystack.includes(k)));
    if (match && account.balance > 0) {
      balanceByGoal.set(match.name, (balanceByGoal.get(match.name) ?? 0) + account.balance);
    }
  }

  for (const transaction of transactions) {
    if (transaction.amount >= 0) {
      continue;
    }

    const haystack =
      `${transaction.category} ${transaction.description} ${transaction.account}`.toLowerCase();
    const match = goalConfig.find((goal) => goal.keywords.some((k) => haystack.includes(k)));
    if (!match) {
      continue;
    }

    spendingByGoal.set(match.name, (spendingByGoal.get(match.name) ?? 0) + Math.abs(transaction.amount));
  }

  const monthsCovered = Math.max(
    1,
    new Set(transactions.map((t) => t.date.slice(0, 7))).size,
  );

  return goalConfig.map((goal, index) => {
    const annualTarget = annualSavings * goal.weight;
    const accountBalance = balanceByGoal.get(goal.name);
    // If we have an account balance for this goal, use it as the "actual" value
    // Otherwise fall back to annualized transaction-based estimate
    const annualActual = accountBalance != null
      ? accountBalance
      : ((spendingByGoal.get(goal.name) ?? 0) / monthsCovered) * 12;
    const ratio = annualTarget > 0 ? annualActual / annualTarget : 1;

    return {
      goal: goal.name,
      agreedPriority: index + 1,
      annualTarget: Math.round(annualTarget),
      annualActual: Math.round(annualActual),
      status: ratio < 0.85 ? "underfunded" : ratio > 1.15 ? "overfunded" : "on-track",
      fundingSource: accountBalance != null ? "account-balance" as const : "transactions" as const,
    };
  });
};

export const buildMonthlyGoalFunding = (
  transactions: Transaction[],
  goalConfig: GoalConfig[] = DEFAULT_GOALS,
): MonthlyGoalFunding[] => {
  const byMonth = new Map<string, Map<GoalName, number>>();

  for (const tx of transactions) {
    if (tx.amount >= 0) {
      continue;
    }

    const month = tx.date.slice(0, 7);
    if (!byMonth.has(month)) {
      byMonth.set(month, new Map(goalConfig.map((g) => [g.name, 0])));
    }

    const haystack = `${tx.category} ${tx.description}`.toLowerCase();
    const match = goalConfig.find((g) => g.keywords.some((k) => haystack.includes(k)));
    if (!match) {
      continue;
    }

    const monthMap = byMonth.get(month)!;
    monthMap.set(match.name, (monthMap.get(match.name) ?? 0) + Math.abs(tx.amount));
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, goalMap]) => ({
      month,
      funding: Object.fromEntries(goalMap.entries()) as Record<GoalName, number>,
    }));
};

export const detectPriorityDrift = (funding: GoalFunding[]): string[] => {
  const drift: string[] = [];

  for (let i = 0; i < funding.length - 1; i += 1) {
    const higher = funding[i];
    for (let j = i + 1; j < funding.length; j += 1) {
      const lower = funding[j];
      if (lower.annualActual > higher.annualActual * 1.2 && higher.status === "underfunded") {
        drift.push(
          `${lower.goal} is being funded ahead of ${higher.goal}. Actual ${lower.goal} funding is $${lower.annualActual.toLocaleString()} vs $${higher.annualActual.toLocaleString()} for ${higher.goal}.`,
        );
      }
    }
  }

  return drift;
};

export const buildCoupleAlignment = (transactions: Transaction[]): CoupleAlignment[] => {
  const byPartner = new Map<string, { income: number; topPriority: number; discretionary: number }>();
  const topPriorities = new Set(["401k", "mega backdoor", "after-tax 401k", "in-plan conversion", "espp", "roth ira", "ira contribution", "backdoor roth ira", "529", "college", "emergency"]);

  for (const tx of transactions) {
    const current = byPartner.get(tx.owner) ?? { income: 0, topPriority: 0, discretionary: 0 };

    if (tx.amount > 0) {
      current.income += tx.amount;
    } else {
      const haystack = `${tx.category} ${tx.description}`.toLowerCase();
      if ([...topPriorities].some((keyword) => haystack.includes(keyword))) {
        current.topPriority += Math.abs(tx.amount);
      } else {
        current.discretionary += Math.abs(tx.amount);
      }
    }

    byPartner.set(tx.owner, current);
  }

  return [...byPartner.entries()].map(([partner, values]) => {
    const denominator = values.income || 1;
    return {
      partner,
      topPrioritySavingsRate: Number(((values.topPriority / denominator) * 100).toFixed(1)),
      discretionarySpendingRate: Number(((values.discretionary / denominator) * 100).toFixed(1)),
    };
  });
};

export const coupleAlignmentSummary = (alignment: CoupleAlignment[]): string => {
  if (alignment.length < 2) {
    return "Need data for both partners to compute alignment.";
  }

  const [first, second] = alignment;
  const topGap = Math.abs(first.topPrioritySavingsRate - second.topPrioritySavingsRate);
  const spendGap = Math.abs(first.discretionarySpendingRate - second.discretionarySpendingRate);

  if (topGap <= 5 && spendGap <= 5) {
    return "Couple is closely aligned with agreed priorities this period.";
  }

  return `Alignment drift detected: ${first.partner} vs ${second.partner} differs by ${topGap.toFixed(1)} pts on top-priority savings and ${spendGap.toFixed(1)} pts on discretionary spending.`;
};

export const DEFAULT_CONFIG: FireConfig = {
  goals: DEFAULT_GOALS,
  phases: DEFAULT_PHASES,
};

