/**
 * Deterministic goal-patch validation and normalization for the realign API.
 *
 * The AI may return suggested goals that are structurally or numerically invalid.
 * This module applies strict validation and either produces a normalized set of
 * goals ready for persistence, or returns actionable rejection reasons.
 */

export interface GoalPatch {
  name: string;
  weight: number;
  keywords?: string[];
  action?: "keep" | "add" | "remove";
}

export interface PatchValidationResult {
  valid: boolean;
  normalizedGoals?: GoalPatch[];
  errors: string[];
}

const WEIGHT_SUM_TOLERANCE = 0.02;

/**
 * Validate a goal patch array. Returns `valid: true` with normalized goals if
 * the patch is deterministically safe to apply, or `valid: false` with actionable
 * error details explaining why it was rejected.
 */
export function validateGoalPatch(goals: GoalPatch[]): PatchValidationResult {
  const errors: string[] = [];

  // Structural validation
  if (!Array.isArray(goals) || goals.length === 0) {
    return { valid: false, errors: ["No goals provided in patch."] };
  }

  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    if (!g || typeof g.name !== "string" || g.name.trim() === "") {
      errors.push(`Goal at index ${i}: missing or empty 'name' field.`);
    }
    if (typeof g.weight !== "number" || isNaN(g.weight)) {
      errors.push(`Goal '${g.name ?? `index ${i}`}': 'weight' must be a number.`);
    } else if (g.weight < 0) {
      errors.push(`Goal '${g.name}': weight cannot be negative (got ${g.weight}).`);
    }
    if (g.action && !["keep", "add", "remove"].includes(g.action)) {
      errors.push(
        `Goal '${g.name}': invalid action '${g.action}'. Must be 'keep', 'add', or 'remove'.`,
      );
    }
    if (g.keywords !== undefined && !Array.isArray(g.keywords)) {
      errors.push(`Goal '${g.name}': 'keywords' must be an array if provided.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Weight sum validation (active goals only)
  const activeGoals = goals.filter((g) => g.action !== "remove");
  const removedGoals = goals.filter((g) => g.action === "remove");

  if (activeGoals.length === 0) {
    return { valid: false, errors: ["Patch removes all goals. At least one active goal required."] };
  }

  const weightSum = activeGoals.reduce((sum, g) => sum + g.weight, 0);

  if (Math.abs(weightSum - 1.0) > WEIGHT_SUM_TOLERANCE) {
    errors.push(
      `Active goal weights sum to ${weightSum.toFixed(4)}, expected 1.0 (tolerance ±${WEIGHT_SUM_TOLERANCE}). ` +
        `Adjust weights so active goals sum to 1.0.`,
    );
    return { valid: false, errors };
  }

  // Removed goals must have weight 0
  for (const g of removedGoals) {
    if (g.weight !== 0) {
      errors.push(`Removed goal '${g.name}' must have weight 0 (got ${g.weight}).`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Normalize: ensure keywords default to empty array, action defaults to "keep"
  const normalizedGoals: GoalPatch[] = goals.map((g) => ({
    name: g.name.trim(),
    weight: g.weight,
    keywords: Array.isArray(g.keywords) ? g.keywords : [],
    action: g.action ?? "keep",
  }));

  return { valid: true, normalizedGoals, errors: [] };
}
