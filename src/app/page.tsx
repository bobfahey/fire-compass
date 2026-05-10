import { cookies } from "next/headers";

import {
  buildCoupleAlignment,
  buildFireProjection,
  buildLifePhases,
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

  const cookieStore = await cookies();
  const cookieDataDir = cookieStore.get("fire_data_dir")?.value;

  const [dataset, config] = await Promise.all([
    loadDataset(cookieDataDir ?? process.env.FIRE_DATA_DIR),
    loadConfig(),
  ]);

  const phases = buildLifePhases(dataset.transactions, dataset.categories, config.phases);
  const projection = buildFireProjection(targetDate, dataset.accounts, dataset.transactions, phases);
  const portfolioSeries = buildPortfolioSeries(projection);
  const goalFunding = rankGoals(dataset.transactions, projection.annualSavings, config.goals, dataset.accounts);
  const priorityDrift = detectPriorityDrift(goalFunding);
  const alignment = buildCoupleAlignment(dataset.transactions);
  const alignmentNote = coupleAlignmentSummary(alignment);

  const driftCount = priorityDrift.length;
  const underfundedCount = goalFunding.filter((g) => g.status === "underfunded").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 text-sm md:text-base">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fire Compass 🧭</h1>
            <p className="text-zinc-500">Where do we stand on our money goals — and are we on the same page?</p>
          </div>
          <a href="/settings" className="rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
            ⚙️ Settings
          </a>
        </div>
      </header>

      <DataUploadForm />

      {/* ── Goals & Priorities (primary view) ── */}
      <section className="rounded-lg border-2 border-zinc-300 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Goals &amp; Priorities</h2>
          <div className="flex gap-2">
            {underfundedCount > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {underfundedCount} underfunded
              </span>
            )}
            {driftCount > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                {driftCount} drift alert{driftCount > 1 ? "s" : ""}
              </span>
            )}
            {driftCount === 0 && underfundedCount === 0 && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                All on track
              </span>
            )}
          </div>
        </div>

        {driftCount > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1 text-sm font-semibold text-amber-900">⚠ Priority drift detected</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
              {priorityDrift.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {goalFunding.map((row) => (
            <div
              key={row.goal}
              className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600">
                  {row.agreedPriority}
                </span>
                <div>
                  <p className="font-medium">{row.goal}</p>
                  <p className="text-xs text-zinc-500">
                    Target: {money.format(row.annualTarget)}/yr
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {money.format(row.annualActual)}{row.fundingSource === "transactions" ? "/yr" : ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {row.fundingSource === "account-balance" ? "balance" : "actual"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    row.status === "on-track"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.status === "underfunded"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ReAlignForm
        context={`Target FIRE date: ${projection.targetDate}\nAnnual savings: ${money.format(projection.annualSavings)}\nCurrent goal weights:\n${config.goals.map((g) => `  ${g.name}: ${(g.weight * 100).toFixed(0)}% (keywords: ${g.keywords.join(", ")})`).join("\n")}\nGoal funding status:\n${goalFunding.map((g) => `  ${g.goal}: ${g.status} — target ${money.format(g.annualTarget)}, actual ${money.format(g.annualActual)}`).join("\n")}\nDrift notes: ${priorityDrift.join(" | ") || "none"}\nAlignment: ${alignmentNote}`}
        currentGoals={config.goals}
      />

      {/* ── FIRE Snapshot (secondary) ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">FIRE Snapshot</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 p-4 text-center">
            <p className="text-xs font-medium uppercase text-zinc-500">Years to FIRE</p>
            <p className="mt-1 text-2xl font-bold">{projection.yearsToFire}</p>
            <p className="text-xs text-zinc-500">Target: {projection.targetDate}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 text-center">
            <p className="text-xs font-medium uppercase text-zinc-500">Current assets</p>
            <p className="mt-1 text-2xl font-bold">{money.format(projection.currentInvestableAssets)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 text-center">
            <p className="text-xs font-medium uppercase text-zinc-500">Projected at FIRE</p>
            <p className="mt-1 text-2xl font-bold">{money.format(projection.projectedPortfolioAtFire)}</p>
            <p className="text-xs text-zinc-500">{(REAL_RETURN_RATE * 100).toFixed(0)}% real return</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-4 text-center">
            <p className="text-xs font-medium uppercase text-zinc-500">Required nest egg</p>
            <p className="mt-1 text-2xl font-bold">{money.format(projection.requiredNestEggAtFire)}</p>
            <p className="text-xs text-zinc-500">{(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% SWR</p>
          </div>
        </div>
        <div className={`rounded-lg p-3 text-center text-sm font-semibold ${projection.fireReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {projection.fireReady
            ? "✓ On track for FIRE — projected portfolio exceeds required nest egg"
            : "⚠ Off track — increase savings or move target date"}
        </div>
        <TargetDateForm current={targetDate} />
        <PortfolioChart data={portfolioSeries} />
      </section>

      {/* ── Couple Alignment ── */}
      {alignment.length >= 2 && (
        <section className="rounded-lg border border-zinc-200 p-4">
          <h2 className="mb-3 text-lg font-semibold">Couple Alignment</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {alignment.map((row) => (
              <div key={row.partner} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-2 font-semibold">{row.partner}</p>
                <p className="text-sm">Top-priority savings: <span className="font-medium">{row.topPrioritySavingsRate}%</span></p>
                <p className="text-sm">Discretionary spending: <span className="font-medium">{row.discretionarySpendingRate}%</span></p>
              </div>
            ))}
          </div>
          <p className={`mt-3 text-sm font-medium ${alignmentNote.includes("drift") ? "text-amber-700" : "text-emerald-700"}`}>
            {alignmentNote}
          </p>
        </section>
      )}
    </main>
  );
}

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
