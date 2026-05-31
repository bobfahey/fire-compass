import path from "node:path";
import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { FireConfig, GoalConfig, PhaseConfig } from "@/lib/types";
import { normalizeGoalName } from "@/lib/normalization";

const CONFIG_PATH = process.env.FIRE_CONFIG_PATH || path.join(process.cwd(), "fire-config.json");

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
        const p = obj.phases[i] as PhaseConfig;
        validPhases.push({ name: p.name, years: p.years, multiplier: p.multiplier });
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
export async function loadConfig(): Promise<ConfigLoadResult> {
  let raw: string;
  try {
    raw = await fs.readFile(CONFIG_PATH, "utf8");
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
    const { config, warnings } = parseAndValidateConfig(parsed);
    return { config, warnings, source: "file" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      config: DEFAULT_CONFIG,
      warnings: [`Config validation failed: ${msg}; using defaults`],
      source: "default",
    };
  }
}

/**
 * Saves config to disk with normalization applied.
 * Ensures persisted config is always in canonical form.
 */
export async function saveConfig(config: FireConfig): Promise<{ warnings: string[] }> {
  const serialized = serializeConfig(config);
  await fs.writeFile(CONFIG_PATH, serialized, "utf8");

  // Report any normalization that happened
  const { warnings } = normalizeGoals(config.goals);
  return { warnings };
}
