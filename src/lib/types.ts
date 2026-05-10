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

export interface MonthlyGoalFunding {
  month: string; // "YYYY-MM"
  funding: Record<GoalName, number>;
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

export interface PortfolioDataPoint {
  year: number;
  projected: number;
  required: number;
}

export interface CoupleAlignment {
  partner: string;
  topPrioritySavingsRate: number;
  discretionarySpendingRate: number;
}

export interface GoalConfig {
  name: GoalName;
  weight: number;
  keywords: string[];
}

export interface PhaseConfig {
  name: LifePhaseName;
  years: number;
  multiplier: number;
}

export interface FireConfig {
  goals: GoalConfig[];
  phases: PhaseConfig[];
}

