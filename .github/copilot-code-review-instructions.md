# Copilot Code Review Instructions — FIRE Compass

## Privacy (critical)
- Flag any hardcoded dollar amounts, account balances, income figures, or employer-specific details (e.g. company names, benefit plan names). These belong in `fire-config.json` (gitignored), not in source code.
- Real financial data must never appear in code, comments, tests, or sample data.

## Goal matching
- Keywords in `DEFAULT_GOALS` are matched via substring with `Array.find()`, so order matters. More specific goals must appear before broader ones to avoid misclassification.
- Any new goal type should include keyword-matching tests to prevent collisions.

## Testing
- Changes to `src/lib/fire.ts` must have corresponding test coverage in `src/lib/__tests__/fire.test.ts`.
- Goal weight arrays must sum to 1.0.

## Config
- `fire-config.json` is gitignored and loaded at runtime. Never commit it.
- The `FIRE_CONFIG_PATH` env var can override the config file location.
