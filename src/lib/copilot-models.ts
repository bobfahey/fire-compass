export const COPILOT_MODELS = [
  "auto",
  "gpt-5.5",
  "gpt-5-mini",
  "claude-sonnet-4.6",
  "gpt-4.1",
] as const;

export type CopilotModel = (typeof COPILOT_MODELS)[number];

export const COPILOT_MODEL_OPTIONS: ReadonlyArray<{
  value: CopilotModel;
  label: string;
}> = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5-mini", label: "GPT-5 mini" },
  { value: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "gpt-4.1", label: "GPT-4.1" },
];

export function normalizeCopilotModel(candidate?: string): CopilotModel | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  return COPILOT_MODELS.find((model) => model === trimmed);
}

export function resolveCopilotModel(requestModel?: string, envModel?: string): CopilotModel {
  return normalizeCopilotModel(requestModel) ?? normalizeCopilotModel(envModel) ?? "auto";
}

export const COPILOT_CHAT_COMPLETION_MODELS = [
  "gpt-5-mini",
  "claude-sonnet-4.6",
  "gpt-4.1",
] as const;

export type CopilotChatCompletionModel = (typeof COPILOT_CHAT_COMPLETION_MODELS)[number];

const DEFAULT_COPILOT_CHAT_COMPLETION_MODEL: CopilotChatCompletionModel = "gpt-5-mini";

export function resolveCopilotChatCompletionModel(
  requestModel?: string,
  envModel?: string,
): CopilotChatCompletionModel {
  const request = normalizeCopilotModel(requestModel);
  const env = normalizeCopilotModel(envModel);

  const requestSupported = request
    ? COPILOT_CHAT_COMPLETION_MODELS.find((model) => model === request)
    : undefined;
  if (requestSupported) return requestSupported;

  const envSupported = env ? COPILOT_CHAT_COMPLETION_MODELS.find((model) => model === env) : undefined;
  if (envSupported) return envSupported;

  return DEFAULT_COPILOT_CHAT_COMPLETION_MODEL;
}
