# Copilot Instructions — FIRE Compass

## What This Project Is

FIRE Compass is a personal FIRE (Financial Independence, Retire Early) planning app. It ingests CSV exports from Copilot Money, runs projections through a 5-phase life spending model, and helps a couple align on financial goals and priorities.

This is a personal project, not a work project. The repo owner (Bob Fahey) is not a software engineer. He understands technology well but relies on Copilot to write, debug, and maintain the code. Explain technical concepts in plain language and provide exact commands to run.

## Architecture

- **Framework:** Next.js + TypeScript + Tailwind CSS
- **Charts:** Recharts
- **Testing:** Vitest
- **Data source:** CSV files exported from Copilot Money (transactions, accounts, categories)
- **No backend database.** All data is loaded from CSV at runtime.

### Key directories

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js pages and UI components |
| `src/lib/` | Core logic (FIRE calculations, CSV parsing, types, config) |
| `src/lib/__tests__/` | Vitest unit tests |
| `sample-data/` | Synthetic sample CSVs (committed, safe to share publicly) |
| `/data/` | Real CSV exports (gitignored, never committed) |

### Core logic (`src/lib/`)

| File | What it does |
|------|-------------|
| `fire.ts` | FIRE projection engine: 5-phase spending model, 7% real return, 4% SWR |
| `types.ts` | Shared TypeScript types (goals, life phases, transactions, accounts) |
| `csv.ts` | CSV parsing for Copilot Money exports |
| `data-loader.ts` | Loads from `/data/` with fallback to `/sample-data/` |
| `config-loader.ts` | Loads optional `fire-config.json` overrides |

## Privacy and Data Sensitivity

**This is critical.** This repo is PUBLIC. Real financial data must never be committed.

- **Real CSV files** go in `/data/` (gitignored). Never commit them.
- **Sample/synthetic data** goes in `/sample-data/` (committed). Use realistic but fake numbers.
- **Never put real account balances, income figures, or transaction details** in code, comments, issues, or PR descriptions.
- The companion repo `bobfahey/fire-vault` (PRIVATE) holds real financial snapshots, session logs, and planning docs.
- `.gitignore` blocks `*.csv`, `/data/`, `*private*`, and `*snapshot*` as safety nets.

## FIRE Model

The projection engine uses these assumptions (configurable via `fire-config.json`):

- **5 life phases:** Young Kids, Growing Kids, Peak Kid Costs, Launching Kids, Empty Nest
- **Real return rate:** 7%
- **Safe withdrawal rate:** 4%
- **Goal priority order:** 401k, ESPP, 529s, Emergency Fund, Studio Fund, Debt Paydown
- **Priority drift detection:** Flags when actual spending diverges from stated priorities
- **Couple alignment:** Compares partners' goal rankings and highlights divergence

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run test       # Run tests once
npm run test:watch # Run tests in watch mode
npm run lint       # ESLint
```

## Working Style

- Use PRs for all changes (the owner wants to build this habit).
- Open GitHub Issues for bugs and feature ideas rather than fixing everything in one pass.
- Keep commits focused: one logical change per commit.
- Write clear PR titles and descriptions the owner can scan in 30 seconds.
- Run `npm run build` before pushing to make sure nothing is broken.

## When Making Changes

- Run `npm run test` after modifying anything in `src/lib/`.
- Run `npm run build` before committing to catch type errors.
- If adding a new goal type or life phase, update `types.ts` first, then `fire.ts`, then the UI.
- If changing CSV parsing, verify against the sample data in `sample-data/`.
