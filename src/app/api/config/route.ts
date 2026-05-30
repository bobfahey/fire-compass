import path from "node:path";
import { promises as fs } from "node:fs";

import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { normalizeFireConfig } from "@/lib/api-normalization";
import { FireConfig } from "@/lib/types";

const CONFIG_PATH = path.join(process.cwd(), "fire-config.json");

export async function GET() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as FireConfig;
    return NextResponse.json(normalizeFireConfig(parsed));
  } catch {
    return NextResponse.json(normalizeFireConfig(DEFAULT_CONFIG));
  }
}

export async function POST(request: NextRequest) {
  const body = normalizeFireConfig((await request.json()) as FireConfig);

  if (!Array.isArray(body.goals) || !Array.isArray(body.phases)) {
    return NextResponse.json({ error: "Invalid config shape." }, { status: 400 });
  }

  const normalizedConfig = normalizeFireConfig(body);
  const totalWeight = normalizedConfig.goals.reduce((sum, g) => sum + g.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    return NextResponse.json(
      { error: `Goal weights must sum to 1.0 (currently ${totalWeight.toFixed(2)}).` },
      { status: 400 },
    );
  }

  await fs.writeFile(CONFIG_PATH, JSON.stringify(normalizedConfig, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}
