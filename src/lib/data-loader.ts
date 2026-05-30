import path from "node:path";
import { promises as fs } from "node:fs";

import { normalizeAccountType, normalizeGoalLabel, parseCsv } from "@/lib/csv";
import { Account, SpendingCategory, Transaction } from "@/lib/types";

interface Dataset {
  transactions: Transaction[];
  accounts: Account[];
  categories: SpendingCategory[];
  sourceDir: string;
}

const toNumber = (value: string): number => {
  const normalized = value.replaceAll(/[$,]/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readCsv = async (baseDir: string, fileName: string): Promise<Record<string, string>[]> => {
  const fullPath = path.join(baseDir, fileName);
  try {
    const content = await fs.readFile(fullPath, "utf8");
    return parseCsv(content);
  } catch {
    return [];
  }
};

export const loadDataset = async (preferredDir?: string): Promise<Dataset> => {
  const root = process.cwd();
  const fallbackDir = path.join(root, "sample-data");
  const requested = preferredDir ? path.resolve(preferredDir) : path.join(root, "data");

  const sourceDir = await fs
    .access(path.join(requested, "transactions.csv"))
    .then(() => requested)
    .catch(() => fallbackDir);

  const [transactionsRows, accountsRows, categoriesRows] = await Promise.all([
    readCsv(sourceDir, "transactions.csv"),
    readCsv(sourceDir, "accounts.csv"),
    readCsv(sourceDir, "categories.csv"),
  ]);

  return {
    sourceDir,
    transactions: transactionsRows
      .filter((row) => (row.excluded ?? "").toLowerCase() !== "true")
      .map((row) => ({
        date: row.date,
        amount: toNumber(row.amount),
        description: row.description || row.name || "",
        category: normalizeGoalLabel(row.category ?? "") || "other",
        account: row.account,
        owner: row.owner || "Unassigned",
        transactionType: row.type || "regular",
      })),
    accounts: accountsRows.map((row) => ({
      name: row.name,
      balance: toNumber(row.balance),
      type: normalizeAccountType(row.type ?? "") || "checking",
    })),
    categories: categoriesRows.map((row) => ({
      name: normalizeGoalLabel(row.name ?? "") || "Uncategorized",
      monthlyBudget: toNumber(row.monthlyBudget),
    })),
  };
};
