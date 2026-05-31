import { normalizeAccountType, normalizeGoalName } from "@/lib/normalization";
import type { Account, SpendingCategory, Transaction } from "@/lib/types";

// --- Low-level CSV splitting ---

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
};

// --- Header canonicalization ---

const HEADER_ALIASES: Readonly<Record<string, string>> = {
  // Transaction headers
  date: "date",
  transaction_date: "date",
  "transaction date": "date",
  amount: "amount",
  description: "description",
  memo: "description",
  category: "category",
  account: "account",
  "account name": "account",
  account_name: "account",
  owner: "owner",
  transaction_type: "transactionType",
  "transaction type": "transactionType",
  transactiontype: "transactionType",
  excluded: "excluded",

  // Account/Category headers
  name: "name",
  balance: "balance",
  "account type": "type",
  account_type: "type",
  accounttype: "type",

  // Category headers
  monthlybudget: "monthlyBudget",
  monthly_budget: "monthlyBudget",
  "monthly budget": "monthlyBudget",
  budget: "monthlyBudget",
};

export const canonicalizeHeader = (raw: string): string => {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, " ");
  return HEADER_ALIASES[key] ?? raw.trim();
};

// --- Numeric parsing ---

export const toNumber = (value: string): number => {
  const normalized = value.replaceAll(/[$,\s]/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

// --- Date normalization (YYYY-MM-DD) ---

export const normalizeDate = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // DD-MM-YYYY (less common, but handle)
  const dashDMY = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDMY) {
    const [, day, month, year] = dashDMY;
    return `${year}-${month}-${day}`;
  }

  return trimmed;
};

// --- Generic CSV parser (raw, no normalization) ---

export const parseCsv = (input: string): Record<string, string>[] => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, key, idx) => {
      acc[key] = values[idx] ?? "";
      return acc;
    }, {});
  });
};

// --- Normalized CSV parser (canonicalizes headers) ---

export const parseCsvNormalized = (input: string): Record<string, string>[] => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const rawHeaders = splitCsvLine(lines[0]);
  const headers = rawHeaders.map(canonicalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, key, idx) => {
      acc[key] = values[idx] ?? "";
      return acc;
    }, {});
  });
};

// --- Typed parsers with full normalization ---

export const parseTransactions = (input: string): Transaction[] => {
  const rows = parseCsvNormalized(input);
  return rows
    .filter((row) => (row.excluded ?? "").toLowerCase() !== "true")
    .map((row) => ({
      date: normalizeDate(row.date ?? ""),
      amount: toNumber(row.amount ?? ""),
      description: (row.description ?? row.name ?? "").trim(),
      category: normalizeGoalName(row.category ?? ""),
      account: (row.account ?? "").trim(),
      owner: (row.owner ?? "").trim() || "Unassigned",
      transactionType: (row.transactionType ?? row.type ?? "").trim() || "regular",
    }));
};

export const parseAccounts = (input: string): Account[] => {
  const rows = parseCsvNormalized(input);
  return rows.map((row) => ({
    name: (row.name ?? "").trim(),
    balance: toNumber(row.balance ?? ""),
    type: normalizeAccountType(row.type ?? ""),
  }));
};

export const parseCategories = (input: string): SpendingCategory[] => {
  const rows = parseCsvNormalized(input);
  return rows.map((row) => ({
    name: (row.name ?? "").trim(),
    monthlyBudget: toNumber(row.monthlyBudget ?? ""),
  }));
};
