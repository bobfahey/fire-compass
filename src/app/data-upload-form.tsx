"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizeUploadStatusLabel } from "@/lib/label-normalization";

type UploadSlot = "transactions" | "accountsCsv" | "categoriesCsv" | "accountsScreenshot" | "categoriesScreenshot";
type UploadSelections = Partial<Record<UploadSlot, File>>;
const CSV_SLOTS: UploadSlot[] = ["transactions", "accountsCsv", "categoriesCsv"];

const getFileExtension = (file: File): string => {
  const lastDot = file.name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === file.name.length - 1) return "";
  return file.name.slice(lastDot + 1).toLowerCase();
};

const isImage = (file: File): boolean => {
  const ext = getFileExtension(file);
  return ["png", "jpg", "jpeg", "webp"].includes(ext);
};

const isValidForSlot = (slot: UploadSlot, file: File): boolean => {
  if (CSV_SLOTS.includes(slot)) {
    return getFileExtension(file) === "csv";
  }
  return isImage(file);
};

export function DataUploadForm() {
  const router = useRouter();
  const [selections, setSelections] = useState<UploadSelections>({});
  const [result, setResult] = useState<{ uploaded?: string[]; errors?: string[]; error?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const requiredReady = Boolean(selections.transactions);
  const selectedCount = useMemo(() => Object.values(selections).filter(Boolean).length, [selections]);
  const hasInvalidSelections = useMemo(
    () => Object.entries(selections).some(([slot, file]) => Boolean(file && !isValidForSlot(slot as UploadSlot, file))),
    [selections],
  );

  const setSlot = (slot: UploadSlot, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setSelections((prev) => ({ ...prev, [slot]: file }));
    setResult(null);
  };

  const clearSlot = (slot: UploadSlot) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const uploadAll = async () => {
    if (!requiredReady) return;
    if (hasInvalidSelections) {
      setResult({ error: "Fix invalid file types before uploading." });
      return;
    }

    setUploading(true);
    setResult(null);

    const form = new FormData();
    if (selections.transactions) {
      form.append("transactions.csv", selections.transactions, "transactions.csv");
    }
    if (selections.accountsCsv) {
      form.append("accounts.csv", selections.accountsCsv, "accounts.csv");
    }
    if (selections.categoriesCsv) {
      form.append("categories.csv", selections.categoriesCsv, "categories.csv");
    }
    if (selections.accountsScreenshot) {
      const fileName = `accounts-screenshot.${getFileExtension(selections.accountsScreenshot)}`;
      form.append(
        fileName,
        selections.accountsScreenshot,
        fileName,
      );
    }
    if (selections.categoriesScreenshot) {
      const fileName = `categories-screenshot.${getFileExtension(selections.categoriesScreenshot)}`;
      form.append(
        fileName,
        selections.categoriesScreenshot,
        fileName,
      );
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = (await res.json()) as { uploaded?: string[]; errors?: string[]; error?: string };
      setResult(body);
      if (body.uploaded) {
        setSelections({});
        router.refresh();
      }
    } catch {
      setResult({ error: "Network error - upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-semibold">Upload your data</h2>
      <p className="mb-3 text-sm text-zinc-600">
        Add your latest exports and screenshots. <strong>transactions.csv</strong> is required; everything else is optional.
      </p>

      <div className="space-y-2">
        {[
          {
            slot: "transactions" as const,
            title: "Transactions CSV (required)",
            help: "Copilot Money transaction export.",
            accept: ".csv",
            required: true,
          },
          {
            slot: "accountsCsv" as const,
            title: "Accounts CSV (optional)",
            help: "Use this if you export account balances as CSV.",
            accept: ".csv",
            required: false,
          },
          {
            slot: "categoriesCsv" as const,
            title: "Categories CSV (optional)",
            help: "Use this if you export category budgets/spend as CSV.",
            accept: ".csv",
            required: false,
          },
          {
            slot: "accountsScreenshot" as const,
            title: "Accounts screenshot (optional)",
            help: "PNG/JPG/WEBP of balances/net worth screen. Ignored if Accounts CSV is also uploaded.",
            accept: ".png,.jpg,.jpeg,.webp",
            required: false,
          },
          {
            slot: "categoriesScreenshot" as const,
            title: "Categories screenshot (optional)",
            help: "PNG/JPG/WEBP of category budget screen. Ignored if Categories CSV is also uploaded.",
            accept: ".png,.jpg,.jpeg,.webp",
            required: false,
          },
        ].map((field) => {
          const selected = selections[field.slot];
          const invalid = selected ? !isValidForSlot(field.slot, selected) : false;
          return (
            <div key={field.slot} className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-zinc-800">{field.title}</p>
                <p className="text-xs text-zinc-500">{field.help}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                  {selected ? "Replace file" : "Choose file"}
                  <input
                    type="file"
                    accept={field.accept}
                    onChange={(e) => {
                      setSlot(field.slot, e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
                {selected ? (
                  <>
                    <span className="text-xs text-zinc-700">{selected.name}</span>
                    <button
                      type="button"
                      onClick={() => clearSlot(field.slot)}
                      className="text-xs text-zinc-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400">{field.required ? "Not selected" : "Skip if not needed"}</span>
                )}
              </div>
              {invalid ? (
                <p className="mt-1 text-xs text-red-600">
                  {field.accept.includes(".csv") ? "Please choose a .csv file." : "Please choose a PNG, JPG, JPEG, or WEBP image."}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        onClick={uploadAll}
        disabled={uploading || !requiredReady || hasInvalidSelections}
        className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {uploading ? "Processing..." : `Upload selected files (${selectedCount})`}
      </button>
      {!requiredReady ? (
        <p className="mt-1 text-xs text-amber-700">Add Transactions CSV to enable upload.</p>
      ) : null}
      {requiredReady && hasInvalidSelections ? (
        <p className="mt-1 text-xs text-red-700">Fix invalid file types to enable upload.</p>
      ) : null}

      {result?.uploaded && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">Processed successfully</p>
          <ul className="mt-1 text-sm text-emerald-700">
            {result.uploaded.map((f, i) => (
              <li key={i}>- {normalizeUploadStatusLabel(f)}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-emerald-700">Dashboard data refreshed automatically.</p>
        </div>
      )}
      {result?.errors && result.errors.length > 0 && (
        <ul className="mt-2 text-sm text-amber-700">
          {result.errors.map((e, i) => (
            <li key={i}>Warning: {e}</li>
          ))}
        </ul>
      )}
      {result?.error && <p className="mt-2 text-sm text-red-600">Error: {result.error}</p>}
    </section>
  );
}
