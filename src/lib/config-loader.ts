import path from "node:path";
import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { FireConfig, GoalConfig, LifePhaseName, PhaseConfig } from "@/lib/types";
import { normalizeAccountType, normalizeGoalName } from "@/lib/normalization";

function getConfigPath(): string {
  return process.env.FIRE_CONFIG_PATH || path.join(process.cwd(), "fire-config.json");
}

export interface ConfigLoadResult {
  config: FireConfig;
  warnings: string[];
  source: "file" | "default";
}

/**
 * Validates a single goal config entry.
 * Returns null if valid, or an error message if invalid.
 */
function validateGoalConfig(goal: unknown, index: number): string | null {
  if (typeof goal !== "object" || goal === null) {
    return `goals[${index}]: must be an object`;
  }
  const g = goal as Record<string, unknown>;
  if (typeof g.name !== "string" || !g.name.trim()) {
    return `goals[${index}]: missing or empty "name"`;
  }
  if (typeof g.weight !== "number" || !isFinite(g.weight) || g.weight < 0 || g.weight > 1) {
    return `goals[${index}]: "weight" must be a number between 0 and 1`;
  }
  if (!Array.isArray(g.keywords)) {
    return `goals[${index}]: "keywords" must be an array`;
  }
  return null;
}

/**
 * Validates a single phase config entry.
 * Returns null if valid, or an error message if invalid.
 */
function validatePhaseConfig(phase: unknown, index: number): string | null {
  if (typeof phase !== "object" || phase === null) {
    return `phases[${index}]: must be an object`;
  }
  const p = phase as Record<string, unknown>;
  if (typeof p.name !== "string" || !p.name.trim()) {
    return `phases[${index}]: missing or empty "name"`;
  }
  if (!normalizePhaseName(p.name)) {
    return `phases[${index}]: unrecognized phase name "${p.name}"`;
  }
  if (typeof p.years !== "number" || !isFinite(p.years) || p.years <= 0) {
    return `phases[${index}]: "years" must be a positive number`;
  }
  if (typeof p.multiplier !== "number" || !isFinite(p.multiplier) || p.multiplier <= 0) {
    return `phases[${index}]: "multiplier" must be a positive number`;
  }
  return null;
}

/**
 * Normalizes goal names in a config to their canonical forms.
 * Returns normalized goals and any warnings about unrecognized names.
 */
function normalizeGoals(goals: GoalConfig[]): { goals: GoalConfig[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Map<string, number>();

  const normalized = goals.map((goal, index) => {
    const canonicalName = normalizeGoalName(goal.name);
    if (canonicalName !== goal.name) {
      warnings.push(`goals[${index}]: normalized "${goal.name}" → "${canonicalName}"`);
    }
    return { ...goal, name: canonicalName };
  });

  // Detect duplicates after normalization
  for (let i = 0; i < normalized.length; i++) {
    const key = normalized[i].name.toLowerCase();
    const prevIndex = seen.get(key);
    if (prevIndex !== undefined) {
      warnings.push(
        `goals[${i}]: duplicate of goals[${prevIndex}] after normalization ("${normalized[i].name}")`,
      );
    } else {
      seen.set(key, i);
    }
  }

  return { goals: normalized, warnings };
}

function normalizeKeywords(keywords: string[]): string[] {
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      continue;
    }
    const canonical = normalizeAccountType(trimmed);
    if (deduped.has(canonical)) {
      continue;
    }
    deduped.add(canonical);
    normalized.push(canonical);
  }

  return normalized;
}

const LIFE_PHASE_LOOKUP = new Map<string, LifePhaseName>(
  DEFAULT_CONFIG.phases.map((phase) => [phase.name.toLowerCase(), phase.name]),
);

function normalizePhaseName(name: string): LifePhaseName | null {
  return LIFE_PHASE_LOOKUP.get(name.trim().toLowerCase()) ?? null;
}

export function parseAndNormalizeConfig(raw: unknown): FireConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return DEFAULT_CONFIG;
  }

  const obj = raw as Record<string, unknown>;

  let goals = DEFAULT_CONFIG.goals;
  if (Array.isArray(obj.goals) && obj.goals.length > 0) {
    const parsedGoals: GoalConfig[] = [];
    let goalsValid = true;

    for (const goal of obj.goals) {
      if (typeof goal !== "object" || goal === null) {
        goalsValid = false;
        break;
      }

      const g = goal as Record<string, unknown>;
      if (
        typeof g.name !== "string" ||
        !g.name.trim() ||
        typeof g.weight !== "number" ||
        !isFinite(g.weight) ||
        g.weight < 0 ||
        !Array.isArray(g.keywords)
      ) {
        goalsValid = false;
        break;
      }

      const keywordValues = g.keywords.filter((k): k is string => typeof k === "string");
      parsedGoals.push({
        name: normalizeGoalName(g.name),
        weight: g.weight,
        keywords: normalizeKeywords(keywordValues),
      });
    }

    if (goalsValid && parsedGoals.length > 0) {
      goals = parsedGoals;
    }
  }

  let phases = DEFAULT_CONFIG.phases;
  if (Array.isArray(obj.phases) && obj.phases.length > 0) {
    const parsedPhases: PhaseConfig[] = [];
    let phasesValid = true;

    for (const phase of obj.phases) {
      if (typeof phase !== "object" || phase === null) {
        phasesValid = false;
        break;
      }

      const p = phase as Record<string, unknown>;
      if (
        typeof p.name !== "string" ||
        !p.name.trim() ||
        typeof p.years !== "number" ||
        !isFinite(p.years) ||
        p.years <= 0 ||
        typeof p.multiplier !== "number" ||
        !isFinite(p.multiplier) ||
        p.multiplier <= 0
      ) {
        phasesValid = false;
        break;
      }

      const canonicalName = normalizePhaseName(p.name);
      if (!canonicalName) {
        phasesValid = false;
        break;
      }

      parsedPhases.push({
        name: canonicalName,
        years: p.years,
        multiplier: p.multiplier,
      });
    }

    if (phasesValid && parsedPhases.length > 0) {
      phases = parsedPhases;
    }
  }

  return { goals, phases };
}

/**
 * Parses and validates raw JSON into a FireConfig.
 * Returns validated config with warnings for any fixable issues.
 * Throws if the JSON structure is fundamentally unusable.
 */
export function parseAndValidateConfig(raw: unknown): { config: FireConfig; warnings: string[] } {
  const warnings: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Config must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  // Validate goals array
  let goals: GoalConfig[];
  if (!Array.isArray(obj.goals)) {
    warnings.push('Missing or invalid "goals" array; using defaults');
    goals = DEFAULT_CONFIG.goals;
  } else {
    const validGoals: GoalConfig[] = [];
    for (let i = 0; i < obj.goals.length; i++) {
      const err = validateGoalConfig(obj.goals[i], i);
      if (err) {
        warnings.push(`${err}; skipping entry`);
      } else {
        const g = obj.goals[i] as GoalConfig;
        validGoals.push({
          name: g.name,
          weight: g.weight,
          keywords: g.keywords.filter((k): k is string => typeof k === "string" && k.trim() !== ""),
        });
      }
    }
    goals = validGoals.length > 0 ? validGoals : DEFAULT_CONFIG.goals;
    if (validGoals.length === 0 && obj.goals.length > 0) {
      warnings.push("All goal entries were invalid; using defaults");
    }
  }

  // Normalize goal names
  const { goals: normalizedGoals, warnings: normWarnings } = normalizeGoals(goals);
  warnings.push(...normWarnings);

  // Validate phases array
  let phases: PhaseConfig[];
  if (!Array.isArray(obj.phases)) {
    warnings.push('Missing or invalid "phases" array; using defaults');
    phases = DEFAULT_CONFIG.phases;
  } else {
    const validPhases: PhaseConfig[] = [];
    for (let i = 0; i < obj.phases.length; i++) {
      const err = validatePhaseConfig(obj.phases[i], i);
      if (err) {
        warnings.push(`${err}; skipping entry`);
      } else {
        const p = obj.phases[i] as Record<string, unknown>;
        const canonicalName = normalizePhaseName(p.name as string);
        if (!canonicalName) {
          warnings.push(`phases[${i}]: unrecognized phase name "${String(p.name)}"; skipping entry`);
          continue;
        }
        validPhases.push({
          name: canonicalName,
          years: p.years as number,
          multiplier: p.multiplier as number,
        });
      }
    }
    phases = validPhases.length > 0 ? validPhases : DEFAULT_CONFIG.phases;
    if (validPhases.length === 0 && obj.phases.length > 0) {
      warnings.push("All phase entries were invalid; using defaults");
    }
  }

  return { config: { goals: normalizedGoals, phases }, warnings };
}

/**
 * Serializes a FireConfig to deterministic JSON (sorted keys, 2-space indent).
 * Normalizes goal names before writing to ensure persistence is canonical.
 */
export function serializeConfig(config: FireConfig): string {
  const { goals: normalizedGoals } = normalizeGoals(config.goals);

  const normalized: FireConfig = {
    goals: normalizedGoals.map((g) => ({
      name: g.name,
      weight: g.weight,
      keywords: [...g.keywords].sort(),
    })),
    phases: config.phases.map((p) => ({
      name: p.name,
      years: p.years,
      multiplier: p.multiplier,
    })),
  };

  // Deterministic key order: goals first, then phases (matching type declaration)
  return JSON.stringify(normalized, null, 2) + "\n";
}

/**
 * Loads config from disk, validates, and normalizes.
 * Returns default config with source="default" if file doesn't exist or is unparseable.
 */
export async function loadConfigResult(): Promise<ConfigLoadResult> {
  let raw: string;
  try {
    raw = await fs.readFile(getConfigPath(), "utf8");
  } catch {
    return { config: DEFAULT_CONFIG, warnings: [], source: "default" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      config: DEFAULT_CONFIG,
      warnings: [`Failed to parse config JSON: ${msg}; using defaults`],
      source: "default",
    };
  }

  try {
    return { config: parseAndNormalizeConfig(parsed), warnings: [], source: "file" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      config: DEFAULT_CONFIG,
      warnings: [`Config validation failed: ${msg}; using defaults`],
      source: "default",
    };
  }
}

export async function loadConfig(): Promise<FireConfig> {
  const result = await loadConfigResult();
  return result.config;
}

/**
 * Saves config to disk with normalization applied.
 * Ensures persisted config is always in canonical form.
 */
export async function saveConfig(config: FireConfig): Promise<{ warnings: string[] }> {
  const serialized = serializeConfig(config);
  await fs.writeFile(getConfigPath(), serialized, "utf8");

  // Report any normalization that happened
  const { warnings } = normalizeGoals(config.goals);
  return { warnings };
}
