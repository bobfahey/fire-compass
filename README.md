# Fire Compass

Personal FIRE planning app for couples built with Next.js + TypeScript + Tailwind.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Data files

- Private real data goes in `/data` (gitignored)
- Expected files:
  - `transactions.csv`
  - `accounts.csv`
  - `categories.csv`
- Synthetic fixtures for demos/tests live in `/sample-data`

You can override the data folder with `FIRE_DATA_DIR=/absolute/path/to/data`.

## Optional Copilot integration

Set `GITHUB_COPILOT_API_KEY` to enable conversational goal re-alignment.
