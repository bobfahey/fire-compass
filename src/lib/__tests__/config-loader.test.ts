import { promises as fs } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/fire";
import { loadConfig } from "@/lib/config-loader";

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

const readFileMock = vi.mocked(fs.readFile);

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes known goal and account labels while trimming unknown custom labels", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        goals: [
          {
            name: " 401(k) ",
            weight: 0.5,
            keywords: [" roth ira ", " brokerage ", "  custom keyword  "],
          },
          {
            name: "  emergency  ",
            weight: 0.5,
            keywords: ["  savings ", " myCustomLabel "],
          },
          {
            name: "  Custom Goal  ",
            weight: 0.2,
            keywords: ["  another Custom  "],
          },
        ],
        phases: [],
      }),
    );

    const config = await loadConfig();

    expect(config.goals[0].name).toBe("401k");
    expect(config.goals[0].keywords).toEqual(["Roth IRA", "Brokerage", "custom keyword"]);

    expect(config.goals[1].name).toBe("Emergency Fund");
    expect(config.goals[1].keywords).toEqual(["Savings", "myCustomLabel"]);

    expect(config.goals[2].name).toBe("Custom Goal");
    expect(config.goals[2].keywords).toEqual(["another Custom"]);
  });

  it("falls back to default config when loading fails", async () => {
    readFileMock.mockRejectedValueOnce(new Error("missing config"));

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });
});
