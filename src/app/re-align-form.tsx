"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { COPILOT_MODEL_OPTIONS } from "@/lib/copilot-models";
import { GoalConfig } from "@/lib/types";

interface SuggestedGoal {
  name: string;
  weight: number;
  keywords?: string[];
  action?: "keep" | "add" | "remove";
}

export function ReAlignForm({
  context,
  currentGoals,
}: {
  context: string;
  currentGoals: GoalConfig[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [advice, setAdvice] = useState("");
  const [suggestedGoals, setSuggestedGoals] = useState<SuggestedGoal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [model, setModel] = useState("auto");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setAdvice("");
    setSuggestedGoals(null);
    setApplied(false);

    try {
      const result = await fetch("/api/realign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context, model }),
      });

      const body = (await result.json()) as {
        advice?: string;
        suggestedGoals?: SuggestedGoal[];
        error?: string;
        response?: string;
      };
      setAdvice(body.advice ?? body.response ?? body.error ?? "No response.");
      if (body.suggestedGoals) {
        setSuggestedGoals(body.suggestedGoals);
      }
    } catch {
      setAdvice("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyChanges = async () => {
    if (!suggestedGoals) return;
    setApplying(true);

    try {
      const configRes = await fetch("/api/config");
      const config = await configRes.json();

      // Build the new goals array from suggestions
      const updatedGoals: GoalConfig[] = [];
      for (const sg of suggestedGoals) {
        if (sg.action === "remove") continue;

        const existing = config.goals.find((g: GoalConfig) => g.name === sg.name);
        if (existing) {
          // Keep or reweight existing goal
          updatedGoals.push({ ...existing, weight: sg.weight });
        } else if (sg.action === "add") {
          // Brand new goal
          updatedGoals.push({
            name: sg.name,
            weight: sg.weight,
            keywords: sg.keywords ?? [sg.name.toLowerCase()],
          });
        }
      }

      const saveRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, goals: updatedGoals }),
      });

      const saveBody = (await saveRes.json()) as { ok?: boolean; error?: string };
      if (saveBody.ok) {
        setApplied(true);
        setSuggestedGoals(null);
        router.refresh();
      } else {
        setAdvice((prev) => prev + `\n\n⚠ Failed to apply: ${saveBody.error}`);
      }
    } catch {
      setAdvice((prev) => prev + "\n\n⚠ Network error applying changes.");
    } finally {
      setApplying(false);
    }
  };

  const actionLabel = (sg: SuggestedGoal) => {
    if (sg.action === "add") return "new";
    if (sg.action === "remove") return "removing";
    return null;
  };

  const actionColor = (sg: SuggestedGoal) => {
    if (sg.action === "add") return "bg-emerald-100 text-emerald-700";
    if (sg.action === "remove") return "bg-red-100 text-red-700";
    return "";
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-semibold">💬 Talk it through</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Ask about your goals, suggest changes, or add new ones.
        Copilot will propose updates you can apply with one click.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          className="h-24 w-full rounded border border-zinc-300 p-2"
          placeholder="e.g. &quot;We want to save for a family vacation&quot; or &quot;We paid off the car — remove Debt Paydown&quot;"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <label className="block text-sm text-zinc-700">
          Model
          <select
            className="mt-1 block w-full rounded border border-zinc-300 p-2 text-sm"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {COPILOT_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Thinking..." : "Get guidance"}
        </button>
      </form>

      {advice && (
        <pre className="mt-3 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm">{advice}</pre>
      )}

      {applied && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          ✓ Changes applied — dashboard updated.
        </div>
      )}

      {suggestedGoals && !applied && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-blue-900">Suggested changes</h3>
          <div className="space-y-2">
            {suggestedGoals.map((sg) => {
              const current = currentGoals.find((g) => g.name === sg.name);
              const currentWeight = current?.weight ?? 0;
              const isNew = sg.action === "add";
              const isRemoved = sg.action === "remove";
              const diff = isNew ? sg.weight : isRemoved ? -currentWeight : sg.weight - currentWeight;
              const label = actionLabel(sg);

              return (
                <div
                  key={sg.name}
                  className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                    isRemoved ? "bg-red-50 line-through opacity-60" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sg.name}</span>
                    {label && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${actionColor(sg)}`}>
                        {label}
                      </span>
                    )}
                    {isNew && sg.keywords && (
                      <span className="text-xs text-zinc-400">keywords: {sg.keywords.join(", ")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isNew && <span className="text-zinc-500">{(currentWeight * 100).toFixed(0)}%</span>}
                    {!isRemoved && (
                      <>
                        {!isNew && <span className="text-zinc-400">→</span>}
                        <span className="font-semibold">{(sg.weight * 100).toFixed(0)}%</span>
                      </>
                    )}
                    {diff !== 0 && (
                      <span
                        className={`text-xs font-medium ${
                          diff > 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}{(diff * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={applyChanges}
              disabled={applying}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {applying ? "Applying..." : "Apply these changes"}
            </button>
            <button
              onClick={() => setSuggestedGoals(null)}
              className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
