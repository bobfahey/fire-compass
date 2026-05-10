"use client";

import { DEFAULT_GOALS } from "@/lib/fire";
import { GoalConfig, GoalName, MonthlyGoalFunding } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_COLORS: Record<string, string> = {
  "on-track": "bg-emerald-100 text-emerald-700",
  underfunded: "bg-amber-100 text-amber-700",
  overfunded: "bg-sky-100 text-sky-700",
};

function badge(actual: number, target: number) {
  if (target <= 0) return null;
  const ratio = actual / target;
  const status = ratio < 0.85 ? "underfunded" : ratio > 1.15 ? "overfunded" : "on-track";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>{status}</span>
  );
}

export function MonthlyTrend({
  data,
  goalConfig = DEFAULT_GOALS,
  annualSavings,
}: {
  data: MonthlyGoalFunding[];
  goalConfig?: GoalConfig[];
  annualSavings: number;
}) {
  if (data.length === 0) {
    return null;
  }

  const goals = goalConfig.map((g) => g.name) as GoalName[];

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-3 text-lg font-semibold">Month-over-month goal funding</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="py-2 pr-4 font-medium">Month</th>
              {goals.map((g) => (
                <th key={g} className="py-2 pr-4 font-medium">
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month} className="border-b border-zinc-100">
                <td className="py-2 pr-4 tabular-nums">{row.month}</td>
                {goals.map((g) => {
                  const goalDef = goalConfig.find((gc) => gc.name === g);
                  const monthlyTarget = (annualSavings / 12) * (goalDef?.weight ?? 0);
                  const actual = row.funding[g] ?? 0;
                  return (
                    <td key={g} className="py-2 pr-4 tabular-nums">
                      <span className="mr-1">{money.format(actual)}</span>
                      {badge(actual, monthlyTarget)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

