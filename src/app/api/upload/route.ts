import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";

import { NextRequest, NextResponse } from "next/server";

const UPLOAD_DIR = path.join(os.tmpdir(), "fire-compass-data");
const ALLOWED_CSV_FILES = new Set(["transactions.csv", "accounts.csv", "categories.csv"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const extractDataFromImage = async (
  type: "accounts" | "categories",
  imageBase64: string,
  request: NextRequest,
): Promise<Record<string, string | number>[]> => {
  const origin = request.nextUrl.origin;
  const response = await fetch(`${origin}/api/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, image: imageBase64 }),
  });

  if (!response.ok) {
    const err = (await response.json()) as { error?: string };
    throw new Error(err.error ?? `Extract API returned ${response.status}`);
  }

  const result = (await response.json()) as { data: Record<string, string | number>[] };
  return result.data;
};

const escapeCsvField = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const toCsv = (rows: Record<string, string | number>[]): string => {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(String(row[h] ?? ""))).join(","));
  }
  return lines.join("\n");
};

const classifyScreenshot = async (
  imageBase64: string,
  request: NextRequest,
): Promise<"accounts" | "categories" | null> => {
  try {
    const origin = request.nextUrl.origin;
    const response = await fetch(`${origin}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "classify", image: imageBase64 }),
    });

    if (!response.ok) return null;
    const result = (await response.json()) as { classification?: string };
    if (result.classification === "accounts" || result.classification === "categories") {
      return result.classification;
    }
    return null;
  } catch {
    return null;
  }
};

const inferImageType = (fileName: string): "accounts" | "categories" | null => {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("account")
    || lower.includes("balance")
    || lower.includes("net-worth")
    || lower.includes("credit-card")
    || lower.includes("depository")
    || lower.includes("investment")
    || lower.includes("loan")
  ) {
    return "accounts";
  }
  if (lower.includes("categor") || lower.includes("budget")) {
    return "categories";
  }
  return null;
};

export async function POST(request: NextRequest) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const formData = await request.formData();
  const uploaded: string[] = [];
  const errors: string[] = [];
  const imagesToProcess: { type: "accounts" | "categories"; base64: string; fileName: string }[] = [];
  const unknownImages: { base64: string; fileName: string }[] = [];
  const csvTypeProvided = new Set<"accounts" | "categories">();

  for (const [, value] of formData.entries()) {
    if (!(value instanceof File)) {
      continue;
    }

    const fileName = value.name;
    const ext = path.extname(fileName).toLowerCase();

    // Handle CSV files
    if (ext === ".csv") {
      if (!ALLOWED_CSV_FILES.has(fileName)) {
        // Accept any CSV named transactions — Copilot Money might export differently
        if (fileName.toLowerCase().includes("transaction")) {
          const content = await value.text();
          await fs.writeFile(path.join(UPLOAD_DIR, "transactions.csv"), content, "utf8");
          uploaded.push("transactions.csv");
        } else {
          errors.push(`Ignored unknown CSV: ${fileName}`);
        }
        continue;
      }
      const content = await value.text();
      await fs.writeFile(path.join(UPLOAD_DIR, fileName), content, "utf8");
      uploaded.push(fileName);
      if (fileName === "accounts.csv") {
        csvTypeProvided.add("accounts");
      }
      if (fileName === "categories.csv") {
        csvTypeProvided.add("categories");
      }
      continue;
    }

    // Handle image files
    if (IMAGE_EXTENSIONS.has(ext)) {
      const buffer = Buffer.from(await value.arrayBuffer());
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;

      const type = inferImageType(fileName);
      if (type) {
        imagesToProcess.push({ type, base64, fileName });
      } else {
        unknownImages.push({ base64, fileName });
      }
      continue;
    }

    errors.push(`Ignored unsupported file: ${fileName}`);
  }

  // Auto-classify unknown screenshots via GPT-4o vision
  for (const { base64, fileName } of unknownImages) {
    const classifyType = await classifyScreenshot(base64, request);
    if (!classifyType) {
      errors.push(`Could not determine what "${fileName}" shows. Try renaming with "account" or "category".`);
      continue;
    }
    imagesToProcess.push({ type: classifyType, base64, fileName });
  }

  const extractedRows: Record<"accounts" | "categories", Record<string, string | number>[]> = {
    accounts: [],
    categories: [],
  };

  // Process screenshots through GPT-4o vision
  for (const { type, base64 } of imagesToProcess) {
    if (csvTypeProvided.has(type)) {
      errors.push(`Skipped ${type} screenshot extraction because ${type}.csv was uploaded (CSV takes priority).`);
      continue;
    }
    try {
      const data = await extractDataFromImage(type, base64, request);
      if (!Array.isArray(data) || data.length === 0) {
        errors.push(`Could not extract ${type} data from screenshot — no items found.`);
        continue;
      }
      extractedRows[type].push(...data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to extract ${type} from screenshot: ${msg}`);
    }
  }

  for (const type of ["accounts", "categories"] as const) {
    if (csvTypeProvided.has(type) || extractedRows[type].length === 0) {
      continue;
    }
    const csv = toCsv(extractedRows[type]);
    const csvFileName = type === "accounts" ? "accounts.csv" : "categories.csv";
    await fs.writeFile(path.join(UPLOAD_DIR, csvFileName), csv, "utf8");
    uploaded.push(`${csvFileName} (extracted from screenshot)`);
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { error: errors.length > 0 ? errors.join("; ") : "No valid files found in upload." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ uploaded, errors: errors.length > 0 ? errors : undefined, dataDir: UPLOAD_DIR });
  response.cookies.set("fire_data_dir", UPLOAD_DIR, { path: "/", httpOnly: true, sameSite: "strict" });
  return response;
}
