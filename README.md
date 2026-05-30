# Fire Compass

Personal FIRE planning app for couples built with Next.js + TypeScript + Tailwind.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Open from your phone (same Wi-Fi)

Run the dev server on your local network:

```bash
npm run dev:lan
```

Find your Mac's local IP address:

```bash
ipconfig getifaddr "$(route get default | awk '/interface:/{print $2; exit}')"
```

Then open `http://YOUR_LOCAL_IP:3000` from your phone while both devices are on the same Wi-Fi network.

If it does not load, check that macOS is not blocking Node/Next.js from accepting incoming connections and that your phone is not on cellular or guest Wi-Fi.

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
