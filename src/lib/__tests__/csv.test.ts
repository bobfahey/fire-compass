import { describe, expect, it } from "vitest";

import {
  canonicalizeHeader,
  normalizeDate,
  parseAccounts,
  parseCategories,
  parseCsv,
  parseCsvNormalized,
  parseTransactions,
  toNumber,
} from "@/lib/csv";

// --- Unit tests for utility functions ---

describe("canonicalizeHeader", () => {
  it("maps known header aliases to canonical names", () => {
    expect(canonicalizeHeader("Date")).toBe("date");
    expect(canonicalizeHeader("Transaction Date")).toBe("date");
    expect(canonicalizeHeader("transaction_date")).toBe("date");
    expect(canonicalizeHeader("  Amount  ")).toBe("amount");
    expect(canonicalizeHeader("Name")).toBe("name");
    expect(canonicalizeHeader("Memo")).toBe("description");
    expect(canonicalizeHeader("Account Name")).toBe("account");
    expect(canonicalizeHeader("account_name")).toBe("account");
    expect(canonicalizeHeader("Transaction Type")).toBe("transactionType");
    expect(canonicalizeHeader("Monthly Budget")).toBe("monthlyBudget");
    expect(canonicalizeHeader("monthly_budget")).toBe("monthlyBudget");
    expect(canonicalizeHeader("Account Type")).toBe("type");
  });

  it("passes through unrecognized headers trimmed", () => {
    expect(canonicalizeHeader("  customField  ")).toBe("customField");
    expect(canonicalizeHeader("foo_bar")).toBe("foo_bar");
  });
});

describe("toNumber", () => {
  it("parses plain numbers", () => {
    expect(toNumber("100")).toBe(100);
    expect(toNumber("-42.5")).toBe(-42.5);
  });

  it("strips currency symbols and commas", () => {
    expect(toNumber("$1,234.56")).toBe(1234.56);
    expect(toNumber("$-420,000")).toBe(-420000);
  });

  it("handles whitespace", () => {
    expect(toNumber("  12000  ")).toBe(12000);
  });

  it("returns 0 for non-numeric values", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber("n/a")).toBe(0);
    expect(toNumber("NaN")).toBe(0);
  });
});

describe("normalizeDate", () => {
  it("passes through ISO dates unchanged", () => {
    expect(normalizeDate("2026-01-15")).toBe("2026-01-15");
  });

  it("normalizes MM/DD/YYYY to ISO format", () => {
    expect(normalizeDate("1/5/2026")).toBe("2026-01-05");
    expect(normalizeDate("12/31/2025")).toBe("2025-12-31");
  });

  it("normalizes DD-MM-YYYY to ISO format", () => {
    expect(normalizeDate("15-01-2026")).toBe("2026-01-15");
  });

  it("trims whitespace", () => {
    expect(normalizeDate("  2026-01-15  ")).toBe("2026-01-15");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("   ")).toBe("");
  });
});

// --- parseCsv (raw, backward compatible) ---

describe("parseCsv", () => {
  it("parses basic CSV with headers as-is", () => {
    const input = "Name,Amount\nAlice,100\nBob,200";
    const rows = parseCsv(input);
    expect(rows).toEqual([
      { Name: "Alice", Amount: "100" },
      { Name: "Bob", Amount: "200" },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const input = 'a,b\n"hello, world",42';
    const rows = parseCsv(input);
    expect(rows).toEqual([{ a: "hello, world", b: "42" }]);
  });

  it("handles escaped quotes", () => {
    const input = 'col\n"she said ""hi"""\n';
    const rows = parseCsv(input);
    expect(rows).toEqual([{ col: 'she said "hi"' }]);
  });

  it("returns empty array for header-only input", () => {
    expect(parseCsv("a,b,c")).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const input = "x,y\r\n1,2\r\n3,4";
    expect(parseCsv(input)).toEqual([
      { x: "1", y: "2" },
      { x: "3", y: "4" },
    ]);
  });
});

// --- parseCsvNormalized (headers canonicalized) ---

describe("parseCsvNormalized", () => {
  it("canonicalizes headers from variant formats", () => {
    const input = "Transaction Date,Amount,Name,Account Name\n2026-01-01,100,Paycheck,Checking";
    const rows = parseCsvNormalized(input);
    expect(rows).toEqual([
      { date: "2026-01-01", amount: "100", name: "Paycheck", account: "Checking" },
    ]);
  });

  it("handles mixed-case and underscored headers", () => {
    const input = "account_type,Balance\ncash,5000";
    const rows = parseCsvNormalized(input);
    expect(rows).toEqual([{ type: "cash", balance: "5000" }]);
  });
});

// --- parseTransactions (full normalization) ---

describe("parseTransactions", () => {
  it("parses and normalizes a standard transactions CSV", () => {
    const input = [
      "date,amount,description,category,account,owner",
      "2026-01-01,12000,Salary,Income,Checking,Alex",
      "2026-01-03,-1400,401k contribution,401(k),401k Plan,Alex",
    ].join("\n");

    const result = parseTransactions(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-01-01",
      amount: 12000,
      description: "Salary",
      category: "Income",
      account: "Checking",
      owner: "Alex",
      transactionType: "regular",
    });
    // Category "401(k)" is normalized to canonical "401k"
    expect(result[1].category).toBe("401k");
  });

  it("normalizes category aliases via normalizeGoalName", () => {
    const input = [
      "date,amount,description,category,account,owner",
      "2026-01-05,-800,ESPP deduction,employee stock purchase plan,Brokerage,Alex",
      "2026-01-07,-500,MBR conversion,mega backdoor,401k Plan,Alex",
      "2026-01-08,-300,Roth,roth ira,Roth IRA,Jamie",
      "2026-01-05,-400,College savings,college savings,Checking,Jamie",
    ].join("\n");

    const result = parseTransactions(input);
    expect(result[0].category).toBe("ESPP");
    expect(result[1].category).toBe("Mega Backdoor Roth");
    expect(result[2].category).toBe("Roth IRA");
    expect(result[3].category).toBe("529s");
  });

  it("normalizes dates from various formats", () => {
    const input = [
      "date,amount,description,category,account,owner",
      "1/15/2026,100,Test,Income,Checking,Alex",
      "2026-03-01,200,Test2,Income,Checking,Jamie",
    ].join("\n");

    const result = parseTransactions(input);
    expect(result[0].date).toBe("2026-01-15");
    expect(result[1].date).toBe("2026-03-01");
  });

  it("normalizes amounts with currency symbols", () => {
    const input = 'date,amount,description,category,account,owner\n2026-01-01,"$1,234.56",Salary,Income,Checking,Alex';
    const result = parseTransactions(input);
    expect(result[0].amount).toBe(1234.56);
  });

  it("defaults owner to Unassigned when missing", () => {
    const input = "date,amount,description,category,account,owner\n2026-01-01,100,Test,Income,Checking,";
    const result = parseTransactions(input);
    expect(result[0].owner).toBe("Unassigned");
  });

  it("defaults transactionType to regular when missing", () => {
    const input = "date,amount,description,category,account,owner\n2026-01-01,100,Test,Income,Checking,Alex";
    const result = parseTransactions(input);
    expect(result[0].transactionType).toBe("regular");
  });

  it("excludes rows marked excluded=true", () => {
    const input = [
      "date,amount,description,category,account,owner,excluded",
      "2026-01-01,100,Keep,Income,Checking,Alex,",
      "2026-01-02,200,Skip,Income,Checking,Alex,true",
      "2026-01-03,300,Also keep,Income,Checking,Alex,false",
    ].join("\n");

    const result = parseTransactions(input);
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Keep");
    expect(result[1].description).toBe("Also keep");
  });

  it("handles variant column headers (Name, Transaction Date)", () => {
    const input = [
      "Transaction Date,Amount,Name,Category,Account Name,Owner",
      "2026-02-01,500,Paycheck,Income,Checking,Alex",
    ].join("\n");

    const result = parseTransactions(input);
    expect(result[0]).toEqual({
      date: "2026-02-01",
      amount: 500,
      description: "Paycheck",
      category: "Income",
      account: "Checking",
      owner: "Alex",
      transactionType: "regular",
    });
  });
});

// --- parseAccounts (full normalization) ---

describe("parseAccounts", () => {
  it("parses and normalizes account types", () => {
    const input = [
      "name,balance,type",
      "Checking,28000,cash",
      "Brokerage,146000,taxable brokerage",
      "401k Plan,318000,Roth IRA",
      "Mortgage,-420000,debt",
    ].join("\n");

    const result = parseAccounts(input);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ name: "Checking", balance: 28000, type: "cash" });
    expect(result[1].type).toBe("brokerage"); // "taxable brokerage" → "brokerage"
    expect(result[2].type).toBe("retirement"); // "Roth IRA" → "retirement"
    expect(result[3]).toEqual({ name: "Mortgage", balance: -420000, type: "debt" });
  });

  it("handles currency-formatted balances", () => {
    const input = 'name,balance,type\nSavings,"$42,000",cash';
    const result = parseAccounts(input);
    expect(result[0].balance).toBe(42000);
  });

  it("handles variant headers (Account Type)", () => {
    const input = "name,balance,Account Type\nChecking,5000,cash";
    const result = parseAccounts(input);
    expect(result[0].type).toBe("cash");
  });
});

// --- parseCategories (full normalization) ---

describe("parseCategories", () => {
  it("parses categories with budget amounts", () => {
    const input = [
      "name,monthlyBudget",
      "Housing,6500",
      "Food,1800",
      "Kid Costs,2200",
    ].join("\n");

    const result = parseCategories(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "Housing", monthlyBudget: 6500 });
    expect(result[2]).toEqual({ name: "Kid Costs", monthlyBudget: 2200 });
  });

  it("handles variant headers (Monthly Budget, budget)", () => {
    const input = "name,Monthly Budget\nHousing,6500";
    const result = parseCategories(input);
    expect(result[0]).toEqual({ name: "Housing", monthlyBudget: 6500 });
  });

  it("handles empty budgets as 0", () => {
    const input = "name,monthlyBudget\nMisc,";
    const result = parseCategories(input);
    expect(result[0].monthlyBudget).toBe(0);
  });
});
