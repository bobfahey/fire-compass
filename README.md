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

Set one of these to enable conversational goal re-alignment:

- `GITHUB_COPILOT_API_KEY` (preferred)
- `GITHUB_TOKEN`
- `GH_TOKEN`
In the AI chat box, you can choose the model in the UI.

`GITHUB_COPILOT_MODEL` is optional and acts as a fallback only.

Model selection precedence:

`selected_model = valid_ui_model ?? env_GITHUB_COPILOT_MODEL ?? 'auto'`

Token precedence:

`auth_token = GITHUB_COPILOT_API_KEY ?? GITHUB_TOKEN ?? GH_TOKEN`
