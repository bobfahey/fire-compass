import { NextRequest, NextResponse } from "next/server";

import { resolveCopilotChatCompletionModel } from "@/lib/copilot-models";
import { validateGoalPatch, type GoalPatch, type PatchValidationResult } from "@/lib/realign-patch";

export interface RealignResponse {
  advice: string;
  suggestedGoals?: GoalPatch[];
  patchRejection?: {
    reason: string;
    details: string[];
  };
}

export async function POST(request: NextRequest) {
  const { prompt, context, model } = (await request.json()) as {
    prompt?: string;
    context?: string;
    model?: string;
  };

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const token =
    process.env.GITHUB_COPILOT_API_KEY ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Copilot auth token is not configured. Set GITHUB_COPILOT_API_KEY, GITHUB_TOKEN, or GH_TOKEN.",
      },
      { status: 503 },
    );
  }

  const selectedModel = resolveCopilotChatCompletionModel(model, process.env.GITHUB_COPILOT_MODEL);

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
      model: selectedModel,
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

  // Parse AI response — reject explicitly on failure, no silent fallback
  const cleaned = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: { advice?: string; suggestedGoals?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { advice?: string; suggestedGoals?: unknown };
  } catch {
    return NextResponse.json(
      {
        error: "AI response was not valid JSON. Please retry.",
        rawFragment: cleaned.slice(0, 200),
      },
      { status: 422 },
    );
  }

  if (!parsed.advice || typeof parsed.advice !== "string") {
    return NextResponse.json(
      {
        error: "AI response missing required 'advice' field. Please retry.",
        rawFragment: cleaned.slice(0, 200),
      },
      { status: 422 },
    );
  }

  const result: RealignResponse = { advice: parsed.advice };

  // Deterministic patch validation: apply or explicitly reject
  if (Array.isArray(parsed.suggestedGoals) && parsed.suggestedGoals.length > 0) {
    const validation: PatchValidationResult = validateGoalPatch(
      parsed.suggestedGoals as GoalPatch[],
    );

    if (validation.valid) {
      result.suggestedGoals = validation.normalizedGoals;
    } else {
      result.patchRejection = {
        reason: "Goal patch from AI failed validation. Review and retry.",
        details: validation.errors,
      };
    }
  }

  return NextResponse.json(result);
}
