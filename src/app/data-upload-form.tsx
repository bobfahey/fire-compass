"use client";

import { ChangeEvent, FormEvent, useState } from "react";

export function DataUploadForm() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<{ uploaded?: string[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
    setStatus(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files || files.length === 0) return;

    setLoading(true);
    setStatus(null);

    const form = new FormData();
    for (const file of Array.from(files)) {
      form.append(file.name, file);
    }

    try {
      const result = await fetch("/api/upload", { method: "POST", body: form });
      const body = (await result.json()) as { uploaded?: string[]; error?: string };
      setStatus(body);
      if (body.uploaded) {
        // Reload so the server re-reads the uploaded data directory from the cookie
        window.location.reload();
      }
    } catch {
      setStatus({ error: "Network error — upload failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-semibold">Upload CSV data</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Upload your Copilot Money exports (<code className="rounded bg-zinc-100 px-1">transactions.csv</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">accounts.csv</code>,{" "}
        <code className="rounded bg-zinc-100 px-1">categories.csv</code>). Files are stored in a server temp
        directory for this session only.
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          multiple
          accept=".csv"
          onChange={onChange}
          className="text-sm text-zinc-700 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={loading || !files || files.length === 0}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload & reload"}
        </button>
      </form>
      {status?.uploaded && (
        <p className="mt-2 text-sm text-emerald-700">Uploaded: {status.uploaded.join(", ")}</p>
      )}
      {status?.error && <p className="mt-2 text-sm text-red-600">{status.error}</p>}
    </section>
  );
}
