import { describe, expect, it } from "vitest";

import {
  normalizeCopilotModel,
  resolveCopilotChatCompletionModel,
  resolveCopilotModel,
} from "../copilot-models";

describe("normalizeCopilotModel", () => {
  it("accepts a valid model", () => {
    expect(normalizeCopilotModel("gpt-5.5")).toBe("gpt-5.5");
  });

  it("rejects an invalid model", () => {
    expect(normalizeCopilotModel("not-a-model")).toBeUndefined();
  });
});

describe("resolveCopilotModel", () => {
  it("uses request model when valid", () => {
    expect(resolveCopilotModel("gpt-5-mini", "claude-sonnet-4.6")).toBe("gpt-5-mini");
  });

  it("falls back to env model when request model is invalid", () => {
    expect(resolveCopilotModel("bad-model", "claude-sonnet-4.6")).toBe("claude-sonnet-4.6");
  });

  it("falls back to auto when both request and env models are invalid", () => {
    expect(resolveCopilotModel("bad-model", "also-bad")).toBe("auto");
  });
});

describe("resolveCopilotChatCompletionModel", () => {
  it("maps auto to a supported chat completion model", () => {
    expect(resolveCopilotChatCompletionModel("auto", "gpt-5-mini")).toBe("gpt-5-mini");
  });

  it("uses supported request models", () => {
    expect(resolveCopilotChatCompletionModel("claude-sonnet-4.6", "gpt-5-mini")).toBe(
      "claude-sonnet-4.6",
    );
  });

  it("falls back when request model is unsupported by chat completions", () => {
    expect(resolveCopilotChatCompletionModel("gpt-5.5", "claude-sonnet-4.6")).toBe(
      "claude-sonnet-4.6",
    );
  });

  it("falls back to default when both models are unsupported", () => {
    expect(resolveCopilotChatCompletionModel("gpt-5.5", "auto")).toBe("gpt-5-mini");
  });
});
