"use client";

import { useState } from "react";

interface StagedFile {
  file: File;
  label: string;
}

const classifyFile = (file: File): string => {
  const name = file.name.toLowerCase();
  const ext = name.split(".").pop() ?? "";

  if (ext === "csv") {
    if (name.includes("transaction")) return "Transactions CSV";
    if (name.includes("account")) return "Accounts CSV";
    if (name.includes("categor")) return "Categories CSV";
    return "CSV file";
  }

  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    if (name.includes("account") || name.includes("balance") || name.includes("net-worth") || name.includes("networth")) {
      return "Accounts screenshot";
    }
    if (name.includes("categor") || name.includes("budget")) {
      return "Categories screenshot";
    }
    return "Screenshot (rename with 'account' or 'category')";
  }

  return "Unknown file type";
};

export function DataUploadForm() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [result, setResult] = useState<{ uploaded?: string[]; errors?: string[]; error?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map((file) => ({
      file,
      label: classifyFile(file),
    }));
    setStaged((prev) => [...prev, ...newFiles]);
    setResult(null);
  };

  const removeFile = (index: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async () => {
    if (staged.length === 0) return;

    setUploading(true);
    setResult(null);

    const form = new FormData();
    for (const { file } of staged) {
      form.append(file.name, file);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = (await res.json()) as { uploaded?: string[]; errors?: string[]; error?: string };
      setResult(body);
      if (body.uploaded) {
        setStaged([]);
      }
    } catch {
      setResult({ error: "Network error — upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-semibold">Upload your data</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Add your Copilot Money <code className="rounded bg-zinc-100 px-1">transactions.csv</code> export and
        optionally a screenshot of your accounts/net worth screen for FIRE projections.
      </p>

      <label className="inline-block cursor-pointer rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
        + Add files
        <input
          type="file"
          multiple
          accept=".csv,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

      {staged.length > 0 && (
        <div className="mt-3 space-y-2">
          {staged.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-zinc-800">{item.file.name}</span>
                <span className="ml-2 text-zinc-500">— {item.label}</span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-zinc-400 hover:text-red-500"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={uploadAll}
            disabled={uploading}
            className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? "Processing…" : `Upload all (${staged.length} file${staged.length === 1 ? "" : "s"})`}
          </button>
        </div>
      )}

      {result?.uploaded && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">✓ Processed successfully</p>
          <ul className="mt-1 text-sm text-emerald-700">
            {result.uploaded.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
          >
            View results →
          </button>
        </div>
      )}
      {result?.errors && result.errors.length > 0 && (
        <ul className="mt-2 text-sm text-amber-700">
          {result.errors.map((e, i) => (
            <li key={i}>⚠ {e}</li>
          ))}
        </ul>
      )}
      {result?.error && <p className="mt-2 text-sm text-red-600">✗ {result.error}</p>}
    </section>
  );
}
