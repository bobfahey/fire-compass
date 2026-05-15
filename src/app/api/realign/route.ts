import { NextRequest, NextResponse } from "next/server";

interface SuggestedGoal {
  name: string;
  weight: number;
  keywords?: string[];
  action?: "keep" | "add" | "remove";
}

interface RealignResponse {
  advice: string;
  suggestedGoals?: SuggestedGoal[];
}

export async function POST(request: NextRequest) {
  const { prompt, context } = (await request.json()) as { prompt?: string; context?: string };

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const token = process.env.GITHUB_COPILOT_API_KEY;
  if (!token) {
    return NextResponse.json({
      advice:
        "Copilot key is not configured. Suggested re-alignment: revisit the top 3 priorities first, then cap lower-priority goals until 401k/Mega Backdoor Roth/ESPP/Roth IRA/529 contributions are back on target.",
    });
  }

  const model = process.env.GITHUB_COPILOT_MODEL ?? "gpt-4o-mini";

  const systemPrompt = `You are a FIRE planning facilitator for a couple. Keep responses concrete, warm, and focused on helping partners align on savings goals and spending behavior.

IMPORTANT: Always respond with valid JSON matching this schema:
{
  "advice": "Your human-readable advice here (use \\n for line breaks)",
  "suggestedGoals": [
    {"name": "GoalName", "weight": 0.25, "keywords": ["keyword1", "keyword2"], "action": "keep"},
    {"name": "New Goal", "weight": 0.10, "keywords": ["vacation", "travel"], "action": "add"},
    {"name": "Old Goal", "weight": 0, "keywords": [], "action": "remove"}
  ]
}

Rules for suggestedGoals:
- Include it ONLY when you are recommending changes to goals (reweight, add, or remove).
- Every goal in the final set must be listed. Goals being kept should have action "keep".
- New goals must have action "add" and include relevant keywords for transaction matching.
- Removed goals must have action "remove" with weight 0.
- All weights for non-removed goals must sum to exactly 1.0.
- Use the exact existing goal names from the context. New goal names should be short and clear.
- If the user is just asking a question and no changes are needed, omit suggestedGoals entirely.
- Keywords are used to match transaction descriptions to goals. Choose keywords that would appear in bank/credit card transaction descriptions.

Respond ONLY with the JSON object, no markdown fences or extra text.`;

  const upstream = await fetch("https://api.githubcopilot.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${context ?? ""}\n\nQuestion:\n${prompt}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    console.error("Copilot API error:", upstream.status, errorBody);
    return NextResponse.json(
      { error: "Re-alignment service is temporarily unavailable." },
      { status: 502 },
    );
  }

  const payload = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = payload.choices?.[0]?.message?.content ?? "";

  // Parse AI response — expect JSON but fall back gracefully
  let result: RealignResponse;
  try {
    const cleaned = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as RealignResponse;
    result = { advice: parsed.advice ?? raw };
    if (Array.isArray(parsed.suggestedGoals) && parsed.suggestedGoals.length > 0) {
      const activeGoals = parsed.suggestedGoals.filter((g) => g.action !== "remove");
      const weightSum = activeGoals.reduce((s, g) => s + (g.weight ?? 0), 0);
      if (Math.abs(weightSum - 1) <= 0.02) {
        result.suggestedGoals = parsed.suggestedGoals;
      }
    }
  } catch {
    result = { advice: raw || "No response returned." };
  }

  return NextResponse.json(result);
}
