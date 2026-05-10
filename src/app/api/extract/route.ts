import { NextRequest, NextResponse } from "next/server";

const GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions";
const MODEL = "openai/gpt-4o";

const ACCOUNTS_PROMPT = `You are extracting financial account data from a screenshot of the Copilot Money app.

Return a JSON array of accounts. Each account should have:
- "name": the account name (string)
- "balance": current balance as a number (positive for assets, negative for debts/liabilities)
- "type": one of "cash", "retirement", "brokerage", "espp", "debt"

Classify accounts as:
- "retirement" for 401k, IRA, Roth IRA, pension
- "brokerage" for taxable investment/brokerage accounts
- "espp" for employee stock purchase plans
- "cash" for checking, savings, money market
- "debt" for mortgages, loans, credit cards (make balance negative)

Return ONLY valid JSON. No markdown, no explanation. Example:
[{"name":"401k","balance":318000,"type":"retirement"}]`;

const CATEGORIES_PROMPT = `You are extracting monthly budget category data from a screenshot of the Copilot Money app.

Return a JSON array of budget categories. Each category should have:
- "name": the category name (string)
- "monthlyBudget": the monthly budget amount as a number

Only include categories that have a budget amount set. Ignore categories with no budget.

Return ONLY valid JSON. No markdown, no explanation. Example:
[{"name":"Housing","monthlyBudget":6500}]`;

const CLASSIFY_PROMPT = `Look at this screenshot and determine if it shows:
- "accounts" — a list of financial accounts with balances (bank accounts, investments, credit cards, loans)
- "categories" — a list of spending/budget categories with amounts

Respond with ONLY a JSON object: {"classification": "accounts"} or {"classification": "categories"}
If the image doesn't clearly show either, respond: {"classification": "unknown"}`;

interface ExtractRequest {
  type: "accounts" | "categories" | "classify";
  image: string; // base64 data URL
}

export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN environment variable is not set. Required for GitHub Models API." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ExtractRequest;
  const { type, image } = body;

  if (!type || !image) {
    return NextResponse.json({ error: "Missing 'type' or 'image' in request body." }, { status: 400 });
  }

  const isClassify = type === "classify";
  const systemPrompt = isClassify
    ? CLASSIFY_PROMPT
    : type === "accounts"
      ? ACCOUNTS_PROMPT
      : CATEGORIES_PROMPT;

  try {
    const response = await fetch(GITHUB_MODELS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: image },
              },
              {
                type: "text",
                text: isClassify
                  ? "What type of financial data does this screenshot show?"
                  : `Extract the ${type} data from this screenshot.`,
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: isClassify ? 100 : 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `GitHub Models API error (${response.status}): ${errorText}` },
        { status: 502 },
      );
    }

    const result = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const content = result.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    if (isClassify) {
      return NextResponse.json({ classification: parsed.classification ?? "unknown" });
    }

    return NextResponse.json({ type, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Extraction failed: ${message}` }, { status: 500 });
  }
}
