export const CANONICAL_GOAL_NAMES = [
  "401k",
  "Mega Backdoor Roth",
  "ESPP",
  "Roth IRA",
  "529s",
  "Emergency Fund",
  "Studio Fund",
  "Debt Paydown",
] as const;

export const CANONICAL_ACCOUNT_TYPES = [
  "brokerage",
  "retirement",
  "cash",
  "espp",
] as const;

type CanonicalGoalName = (typeof CANONICAL_GOAL_NAMES)[number];
type CanonicalAccountType = (typeof CANONICAL_ACCOUNT_TYPES)[number];

type AliasMap<TCanonical extends string> = Readonly<Record<TCanonical, readonly string[]>>;

export const GOAL_NAME_ALIASES: AliasMap<CanonicalGoalName> = {
  "401k": ["401(k)", "401 k", "traditional 401k", "pretax 401k", "pre-tax 401k"],
  "Mega Backdoor Roth": ["mega backdoor", "mbdr", "after-tax 401k", "after tax 401k", "in-plan conversion", "in plan conversion"],
  ESPP: ["employee stock purchase plan", "stock purchase"],
  "Roth IRA": ["backdoor roth ira", "ira contribution", "roth individual retirement account"],
  "529s": ["529", "529 plan", "college savings", "college fund"],
  "Emergency Fund": ["emergency", "cash reserve", "rainy day fund"],
  "Studio Fund": ["studio"],
  "Debt Paydown": ["debt", "loan", "mortgage", "pay down debt"],
};

export const ACCOUNT_TYPE_ALIASES: AliasMap<CanonicalAccountType> = {
  brokerage: ["taxable", "taxable brokerage", "individual brokerage account"],
  retirement: [
    "401k",
    "401(k)",
    "ira",
    "traditional ira",
    "roth ira",
    "retirement account",
  ],
  cash: ["checking", "savings", "money market", "hysa", "high yield savings"],
  espp: ["employee stock purchase plan", "stock purchase"],
};

const normalizeLookupKey = (input: string): string =>
  input.trim().toLowerCase().replace(/\s+/g, " ");

const addAlias = <TCanonical extends string>(
  lookup: Map<string, TCanonical>,
  alias: string,
  canonical: TCanonical,
  mapName: string,
): void => {
  const aliasKey = normalizeLookupKey(alias);

  if (!aliasKey) {
    throw new Error(`${mapName}: empty alias is not allowed for canonical value "${canonical}"`);
  }

  const existing = lookup.get(aliasKey);
  if (existing && existing !== canonical) {
    throw new Error(
      `${mapName}: alias collision for "${alias}" between "${existing}" and "${canonical}"`,
    );
  }

  lookup.set(aliasKey, canonical);
};

export const buildAliasLookup = <TCanonical extends string>(
  canonicalValues: readonly TCanonical[],
  aliasesByCanonical: AliasMap<TCanonical>,
  mapName: string,
): ReadonlyMap<string, TCanonical> => {
  const canonicalByKey = new Map<string, TCanonical>();

  for (const canonical of canonicalValues) {
    const canonicalKey = normalizeLookupKey(canonical);
    if (!canonicalKey) {
      throw new Error(`${mapName}: canonical values cannot contain empty strings`);
    }

    const existing = canonicalByKey.get(canonicalKey);
    if (existing && existing !== canonical) {
      throw new Error(`${mapName}: duplicate canonical value "${canonical}"`);
    }

    canonicalByKey.set(canonicalKey, canonical);
  }

  const lookup = new Map<string, TCanonical>();

  for (const canonical of canonicalValues) {
    addAlias(lookup, canonical, canonical, mapName);
  }

  for (const [canonical, aliases] of Object.entries(aliasesByCanonical) as [TCanonical, readonly string[]][]) {
    if (!canonicalByKey.has(normalizeLookupKey(canonical))) {
      throw new Error(`${mapName}: alias map references unknown canonical value "${canonical}"`);
    }

    for (const alias of aliases) {
      addAlias(lookup, alias, canonical, mapName);
    }
  }

  return lookup;
};

const GOAL_NAME_LOOKUP = buildAliasLookup(
  CANONICAL_GOAL_NAMES,
  GOAL_NAME_ALIASES,
  "GOAL_NAME_ALIASES",
);

const ACCOUNT_TYPE_LOOKUP = buildAliasLookup(
  CANONICAL_ACCOUNT_TYPES,
  ACCOUNT_TYPE_ALIASES,
  "ACCOUNT_TYPE_ALIASES",
);

export const normalizeGoalName = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  return GOAL_NAME_LOOKUP.get(normalizeLookupKey(trimmed)) ?? trimmed;
};

export const normalizeAccountType = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }

  return ACCOUNT_TYPE_LOOKUP.get(normalizeLookupKey(trimmed)) ?? trimmed;
};

// ─── Primitive normalization utilities ───────────────────────────────────────

/**
 * Normalize a string value: trim, collapse internal whitespace.
 * Returns "" for null/undefined/empty.
 */
export const normalizeString = (input: string | null | undefined): string => {
  if (input == null) return "";
  return input.trim().replace(/\s+/g, " ");
};

/**
 * Normalize a numeric value from user/CSV input.
 * Strips $, commas, whitespace; returns 0 for null/undefined/NaN.
 */
export const normalizeNumeric = (input: string | null | undefined): number => {
  if (input == null) return 0;
  const cleaned = input.replaceAll(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Normalize a boolean value from string input.
 * Returns true only for case-insensitive "true"; everything else is false.
 */
export const normalizeBoolean = (input: string | null | undefined): boolean => {
  if (input == null) return false;
  return input.trim().toLowerCase() === "true";
};

/**
 * Build a lowercased search haystack from nullable fields.
 * Joins non-empty trimmed values with a space and lowercases the result.
 */
export const buildSearchHaystack = (...fields: (string | null | undefined)[]): string => {
  return fields
    .map((f) => (f ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};
