"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { FireConfig, GoalConfig, PhaseConfig } from "@/lib/types";

export default function SettingsPage() {
  const [config, setConfig] = useState<FireConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<FireConfig>)
      .then(setConfig)
      .catch(() => setMessage({ text: "Failed to load config.", ok: false }));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = (await result.json()) as { ok?: boolean; error?: string };
      setMessage(body.ok ? { text: "Settings saved.", ok: true } : { text: body.error ?? "Error.", ok: false });
    } catch {
      setMessage({ text: "Network error.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const updateGoal = (index: number, field: keyof GoalConfig, value: string) => {
    if (!config) return;
    const goals = config.goals.map((g, i): GoalConfig => {
      if (i !== index) return g;
      if (field === "weight") return { ...g, weight: Number(value) };
      if (field === "keywords") return { ...g, keywords: value.split(",").map((k) => k.trim()) };
      return g; // name is not editable via the form; only weight/keywords change
    });
    setConfig({ ...config, goals });
  };

  const updatePhase = (index: number, field: keyof PhaseConfig, value: string) => {
    if (!config) return;
    const phases = config.phases.map((p, i): PhaseConfig => {
      if (i !== index) return p;
      if (field === "years") return { ...p, years: Number(value) };
      if (field === "multiplier") return { ...p, multiplier: Number(value) };
      return p; // name is not editable via the form
    });
    setConfig({ ...config, phases });
  };

  if (!config) {
    return <p className="p-8 text-zinc-500">Loading settings…</p>;
  }

  const weightTotal = config.goals.reduce((s, g) => s + g.weight, 0);
  const weightOk = Math.abs(weightTotal - 1) <= 0.01;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8 text-sm md:text-base">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-600">
          Customise goal weights and life-phase multipliers. Changes are saved to{" "}
          <code className="rounded bg-zinc-100 px-1">fire-config.json</code> in the project root.
        </p>
        <Link href="/" className="text-sm text-zinc-500 underline">
          ← Back to dashboard
        </Link>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Savings goals</h2>
        <p className="mb-2 text-sm text-zinc-500">
          Weights must sum to 1.0 (currently{" "}
          <span className={weightOk ? "text-emerald-700" : "text-red-600"}>{weightTotal.toFixed(2)}</span>).
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 text-left font-medium">Goal</th>
                <th className="py-2 pr-4 text-left font-medium">Weight</th>
                <th className="py-2 text-left font-medium">Keywords (comma-separated)</th>
              </tr>
            </thead>
            <tbody>
              {config.goals.map((goal, i) => (
                <tr key={goal.name} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-medium">{goal.name}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={goal.weight}
                      onChange={(e) => updateGoal(i, "weight", e.target.value)}
                      className="w-20 rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={goal.keywords.join(", ")}
                      onChange={(e) => updateGoal(i, "keywords", e.target.value)}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Life-phase multipliers</h2>
        <p className="mb-2 text-sm text-zinc-500">
          Each multiplier is applied to your baseline annual spending to model spending changes across life phases.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 text-left font-medium">Phase</th>
                <th className="py-2 pr-4 text-left font-medium">Years</th>
                <th className="py-2 text-left font-medium">Spending multiplier</th>
              </tr>
            </thead>
            <tbody>
              {config.phases.map((phase, i) => (
                <tr key={phase.name} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-medium">{phase.name}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="1"
                      value={phase.years}
                      onChange={(e) => updatePhase(i, "years", e.target.value)}
                      className="w-20 rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={phase.multiplier}
                      onChange={(e) => updatePhase(i, "multiplier", e.target.value)}
                      className="w-24 rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving || !weightOk}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message && (
          <p className={message.ok ? "text-emerald-700" : "text-red-600"}>{message.text}</p>
        )}
      </div>
    </main>
  );
}
