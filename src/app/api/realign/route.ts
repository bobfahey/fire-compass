import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { prompt, context } = (await request.json()) as { prompt?: string; context?: string };

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const token = process.env.GITHUB_COPILOT_API_KEY;
  if (!token) {
    return NextResponse.json({
      response:
        "Copilot key is not configured. Suggested re-alignment: revisit the top 3 priorities first, then cap lower-priority goals until 401k/ESPP/529 contributions are back on target.",
    });
  }

  const model = process.env.GITHUB_COPILOT_MODEL ?? "gpt-4o-mini";

  const upstream = await fetch("https://api.githubcopilot.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a FIRE planning facilitator for a couple. Keep responses concrete and focused on realigning savings goals and spending behavior.",
        },
        { role: "user", content: `Context:\n${context ?? ""}\n\nQuestion:\n${prompt}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    return NextResponse.json(
      { error: `Copilot API request failed: ${upstream.status} ${errorBody}` },
      { status: 502 },
    );
  }

  const payload = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return NextResponse.json({ response: payload.choices?.[0]?.message?.content ?? "No response returned." });
}
