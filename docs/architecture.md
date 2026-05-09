# Fire Compass Architecture

## Data flow

1. Users export `transactions.csv`, `accounts.csv`, and `categories.csv` from Copilot Money.
2. Files are placed in local `/data` (gitignored). If no private data exists, app falls back to `/sample-data` synthetic fixtures.
3. `src/lib/data-loader.ts` reads CSV files from disk and parses into typed records.
4. `src/lib/fire.ts` computes phased spending, FIRE projection (4% SWR, 7% real return), goal ranking, priority drift, and couple alignment.
5. `src/app/page.tsx` renders summary cards/tables and provides conversational re-alignment UI.

## Copilot re-alignment

`POST /api/realign` sends contextual goal drift/alignment details to GitHub Copilot Chat Completions when `GITHUB_COPILOT_API_KEY` is configured.
