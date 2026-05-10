import path from "node:path";
import { promises as fs } from "node:fs";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { FireConfig } from "@/lib/types";

const CONFIG_PATH = path.join(process.cwd(), "fire-config.json");

export async function loadConfig(): Promise<FireConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as FireConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}
