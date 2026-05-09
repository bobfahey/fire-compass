"use client";

import { FormEvent, useState } from "react";

export function ReAlignForm({ context }: { context: string }) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    setLoading(true);
    setResponse("");

    const result = await fetch("/api/realign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context }),
    });

    const body = (await result.json()) as { response?: string; error?: string };
    setResponse(body.response ?? body.error ?? "No response.");
    setLoading(false);
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-semibold">Copilot goal re-alignment</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Ask for mediation help when partners disagree on savings priorities.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          className="h-24 w-full rounded border border-zinc-300 p-2"
          placeholder="How should we adjust this month after overspending on travel?"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Thinking..." : "Get Copilot guidance"}
        </button>
      </form>
      {response ? <pre className="mt-3 whitespace-pre-wrap rounded bg-zinc-50 p-3">{response}</pre> : null}
    </section>
  );
}
