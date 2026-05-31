import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { loadConfig, parseAndNormalizeConfig } from "@/lib/config-loader";

describe("config-loader public-base normalization", () => {
  it("normalizes goal names and keyword aliases from config payload", () => {
    const parsed = parseAndNormalizeConfig({
      goals: [
        {
          name: "401K",
          weight: 30,
          keywords: ["401(k)", "brokerage", "espp"],
        },
      ],
      phases: DEFAULT_CONFIG.phases,
    });

    expect(parsed.goals).toEqual([
      {
        name: "401k",
        weight: 30,
        keywords: ["retirement", "brokerage", "espp"],
      },
    ]);
  });

  it("falls back to default goals when provided goals are invalid", () => {
    const parsed = parseAndNormalizeConfig({
      goals: [{ name: "401k", weight: "30", keywords: [] }],
      phases: DEFAULT_CONFIG.phases,
    });

    expect(parsed.goals).toEqual(DEFAULT_CONFIG.goals);
  });

  it("canonicalizes valid phase names and falls back when any phase name is unknown", () => {
    const canonicalized = parseAndNormalizeConfig({
      goals: DEFAULT_CONFIG.goals,
      phases: [{ name: "young kids", years: 4, multiplier: 1.1 }],
    });
    expect(canonicalized.phases).toEqual([{ name: "Young Kids", years: 4, multiplier: 1.1 }]);

    const rejected = parseAndNormalizeConfig({
      goals: DEFAULT_CONFIG.goals,
      phases: [{ name: "Unknown Phase", years: 4, multiplier: 1.1 }],
    });
    expect(rejected.phases).toEqual(DEFAULT_CONFIG.phases);
  });

  it("loads config from FIRE_CONFIG_PATH and applies normalization", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "fire-config-loader-"));
    const configPath = path.join(tempDir, "fire-config.json");
    const priorConfigPath = process.env.FIRE_CONFIG_PATH;

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          goals: [
            {
              name: "mega backdoor roth",
              weight: 15,
              keywords: ["mega roth", "taxable brokerage"],
            },
          ],
          phases: DEFAULT_CONFIG.phases,
        }),
        "utf8",
      );

      process.env.FIRE_CONFIG_PATH = configPath;
      const loaded = await loadConfig();

      expect(loaded.goals).toEqual([
        {
          name: "Mega Backdoor Roth",
          weight: 15,
          keywords: ["mega roth", "brokerage"],
        },
      ]);
    } finally {
      if (priorConfigPath === undefined) {
        delete process.env.FIRE_CONFIG_PATH;
      } else {
        process.env.FIRE_CONFIG_PATH = priorConfigPath;
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
