import { cookies } from "next/headers";

import {
  buildCoupleAlignment,
  buildFireProjection,
  buildLifePhases,
  buildMonthlyGoalFunding,
  buildPortfolioSeries,
  coupleAlignmentSummary,
  detectPriorityDrift,
  REAL_RETURN_RATE,
  rankGoals,
  SAFE_WITHDRAWAL_RATE,
} from "@/lib/fire";
import { loadDataset } from "@/lib/data-loader";
import { loadConfig } from "@/lib/config-loader";
import { ReAlignForm } from "./re-align-form";
import { PortfolioChart } from "./portfolio-chart";
import { MonthlyTrend } from "./monthly-trend";
import { DataUploadForm } from "./data-upload-form";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const DEFAULT_TARGET_DATE = "2038-01-01";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const targetDate = params.targetDate ?? DEFAULT_TARGET_DATE;

  // Respect the data dir cookie set by the upload endpoint
  const cookieStore = await cookies();
  const cookieDataDir = cookieStore.get("fire_data_dir")?.value;

  const [dataset, config] = await Promise.all([
    loadDataset(cookieDataDir ?? process.env.FIRE_DATA_DIR),
    loadConfig(),
  ]);

  const phases = buildLifePhases(dataset.transactions, dataset.categories, config.phases);
  const projection = buildFireProjection(targetDate, dataset.accounts, dataset.transactions, phases);
  const portfolioSeries = buildPortfolioSeries(projection);
  const goalFunding = rankGoals(dataset.transactions, projection.annualSavings, config.goals);
  const monthlyFunding = buildMonthlyGoalFunding(dataset.transactions, config.goals);
  const priorityDrift = detectPriorityDrift(goalFunding);
  const alignment = buildCoupleAlignment(dataset.transactions);
  const alignmentNote = coupleAlignmentSummary(alignment);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 text-sm md:text-base">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Fire Compass</h1>
          <a href="/settings" className="rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
            ⚙️ Settings
          </a>
        </div>
        <p className="text-zinc-600">
          Personal FIRE planner for couples using local Copilot Money CSV exports from
          <code className="ml-1 rounded bg-zinc-100 px-1 py-0.5">/data</code> (fallback:
          <code className="ml-1 rounded bg-zinc-100 px-1 py-0.5">/sample-data</code>).
        </p>
        <p className="text-xs text-zinc-500">Loaded data source: {dataset.sourceDir}</p>
      </header>

      <TargetDateForm current={targetDate} />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-zinc-200 p-4">
          <h2 className="mb-2 text-lg font-semibold">FIRE Projection</h2>
          <ul className="space-y-1">
            <li>Target date: {projection.targetDate}</li>
            <li>Years to FIRE: {projection.yearsToFire}</li>
            <li>Current investable assets: {money.format(projection.currentInvestableAssets)}</li>
            <li>Annual savings: {money.format(projection.annualSavings)}</li>
            <li>
              Projected portfolio ({(REAL_RETURN_RATE * 100).toFixed(0)}% real):{" "}
              {money.format(projection.projectedPortfolioAtFire)}
            </li>
            <li>
              Required nest egg ({(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% SWR):{" "}
              {money.format(projection.requiredNestEggAtFire)}
            </li>
          </ul>
          <p className={`mt-3 font-semibold ${projection.fireReady ? "text-emerald-700" : "text-amber-700"}`}>
            {projection.fireReady ? "On track for FIRE" : "Off track: increase savings or move target date"}
          </p>
        </article>

        <article className="rounded-lg border border-zinc-200 p-4">
          <h2 className="mb-2 text-lg font-semibold">Couple Alignment</h2>
          <ul className="space-y-1">
            {alignment.map((row) => (
              <li key={row.partner}>
                {row.partner}: top-priority savings {row.topPrioritySavingsRate}% · discretionary spending{" "}
                {row.discretionarySpendingRate}%
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">{alignmentNote}</p>
        </article>
      </section>

      <PortfolioChart data={portfolioSeries} />

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 text-lg font-semibold">Phased spending model</h2>
        <div className="grid gap-2 md:grid-cols-5">
          {phases.map((phase) => (
            <div key={phase.name} className="rounded border border-zinc-200 p-3">
              <h3 className="font-medium">{phase.name}</h3>
              <p>{phase.years} years</p>
              <p>{money.format(phase.annualSpending)}/yr</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-3 text-lg font-semibold">Goal priority adherence</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Goal</th>
                <th className="py-2 pr-3">Annual target</th>
                <th className="py-2 pr-3">Annual actual</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {goalFunding.map((row) => (
                <tr key={row.goal} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{row.agreedPriority}</td>
                  <td className="py-2 pr-3">{row.goal}</td>
                  <td className="py-2 pr-3">{money.format(row.annualTarget)}</td>
                  <td className="py-2 pr-3">{money.format(row.annualActual)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        row.status === "on-track"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.status === "underfunded"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {priorityDrift.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-amber-800">
            {priorityDrift.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-emerald-700">No priority drift detected.</p>
        )}
      </section>

      <MonthlyTrend data={monthlyFunding} goalConfig={config.goals} annualSavings={projection.annualSavings} />

      <DataUploadForm />

      <ReAlignForm
        context={`Target FIRE date: ${projection.targetDate}\nAnnual savings: ${projection.annualSavings}\nDrift notes: ${priorityDrift.join(" | ") || "none"}\nAlignment: ${alignmentNote}`}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline client component for the target-date picker
// ---------------------------------------------------------------------------
function TargetDateForm({ current }: { current: string }) {
  return (
    <form method="GET" className="flex items-center gap-3">
      <label htmlFor="targetDate" className="text-sm font-medium text-zinc-700">
        FIRE target date:
      </label>
      <input
        id="targetDate"
        type="date"
        name="targetDate"
        defaultValue={current}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
        Recalculate
      </button>
    </form>
  );
}

