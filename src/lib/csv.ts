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

const normalizeAliasKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[\(\)]/g, "")
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/[^\p{L}\p{N}\s]/gu, "")
    .replaceAll(/\s+/g, " ");

const GOAL_ALIAS_TO_CANONICAL: Record<string, string> = {
  "401k": "401k",
  "401k contribution": "401k",
  "401k contributions": "401k",
  "mega backdoor roth": "Mega Backdoor Roth",
  "mega backdoor roth ira": "Mega Backdoor Roth",
  "after tax 401k": "Mega Backdoor Roth",
  "aftertax 401k": "Mega Backdoor Roth",
  "in plan conversion": "Mega Backdoor Roth",
  "espp": "ESPP",
  "employee stock purchase plan": "ESPP",
  "roth ira": "Roth IRA",
  "backdoor roth ira": "Roth IRA",
  "ira contribution": "Roth IRA",
  "529": "529s",
  "529s": "529s",
  "529 contribution": "529s",
  "529 contributions": "529s",
  "529 plan": "529s",
  "college savings": "529s",
  "college fund": "529s",
  "emergency fund": "Emergency Fund",
  "emergency savings": "Emergency Fund",
  "cash reserve": "Emergency Fund",
  "studio": "Studio Fund",
  "studio fund": "Studio Fund",
  "studio savings": "Studio Fund",
  "debt": "Debt Paydown",
  "debt paydown": "Debt Paydown",
  "debt payoff": "Debt Paydown",
  "debt reduction": "Debt Paydown",
};

const ACCOUNT_TYPE_ALIAS_TO_CANONICAL: Record<string, string> = {
  "checking": "checking",
  "checking account": "checking",
  "checkings": "checking",
  "savings": "savings",
  "savings account": "savings",
  "high yield savings": "savings",
  "high yield savings account": "savings",
  "brokerage": "brokerage",
  "taxable brokerage": "brokerage",
  "investment": "brokerage",
  "investment account": "brokerage",
  "401k": "401k",
  "traditional 401k": "401k",
  "ira": "ira",
  "traditional ira": "ira",
  "rollover ira": "ira",
  "roth ira": "roth_ira",
  "roth": "roth_ira",
  "roth ira account": "roth_ira",
  "hsa": "hsa",
  "health savings account": "hsa",
};

export const normalizeGoalLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return GOAL_ALIAS_TO_CANONICAL[normalizeAliasKey(trimmed)] ?? trimmed;
};

export const normalizeAccountType = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return ACCOUNT_TYPE_ALIAS_TO_CANONICAL[normalizeAliasKey(trimmed)] ?? trimmed;
};

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
