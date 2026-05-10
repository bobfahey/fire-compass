import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";

import { NextRequest, NextResponse } from "next/server";

const UPLOAD_DIR = path.join(os.tmpdir(), "fire-compass-data");
const ALLOWED_FILES = new Set(["transactions.csv", "accounts.csv", "categories.csv"]);

export async function POST(request: NextRequest) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const formData = await request.formData();
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const [, value] of formData.entries()) {
    if (!(value instanceof File)) {
      continue;
    }

    const fileName = value.name;
    if (!ALLOWED_FILES.has(fileName)) {
      errors.push(`Ignored unknown file: ${fileName}`);
      continue;
    }

    const content = await value.text();
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), content, "utf8");
    uploaded.push(fileName);
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { error: errors.length > 0 ? errors.join(", ") : "No valid CSV files found in upload." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ uploaded, dataDir: UPLOAD_DIR });
  response.cookies.set("fire_data_dir", UPLOAD_DIR, { path: "/", httpOnly: true, sameSite: "strict" });
  return response;
}
