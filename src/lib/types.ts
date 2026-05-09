export type GoalName =
  | "401k"
  | "ESPP"
  | "529s"
  | "Emergency Fund"
  | "Studio Fund"
  | "Debt Paydown";

export type LifePhaseName =
  | "Young Kids"
  | "Growing Kids"
  | "Peak Kid Costs"
  | "Launching Kids"
  | "Empty Nest";

export interface Transaction {
  date: string;
  amount: number;
  description: string;
  category: string;
  account: string;
  owner: string;
}

export interface Account {
  name: string;
  balance: number;
  type: string;
}

export interface SpendingCategory {
  name: string;
  monthlyBudget: number;
}

export interface GoalFunding {
  goal: GoalName;
  agreedPriority: number;
  annualTarget: number;
  annualActual: number;
  status: "on-track" | "underfunded" | "overfunded";
}

export interface LifePhase {
  name: LifePhaseName;
  years: number;
  annualSpending: number;
}

export interface FireProjection {
  targetDate: string;
  yearsToFire: number;
  currentInvestableAssets: number;
  annualSavings: number;
  projectedPortfolioAtFire: number;
  requiredNestEggAtFire: number;
  fireReady: boolean;
}

export interface CoupleAlignment {
  partner: string;
  topPrioritySavingsRate: number;
  discretionarySpendingRate: number;
}
