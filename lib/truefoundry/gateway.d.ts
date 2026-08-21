export type GatewayConfig = {
  apiKey: string;
  baseUrl: string;
  inferencePath: string;
  modelChain: string[];
  inputGuardrails: string[];
  outputGuardrails: string[];
  tenant: string;
  costCenter: string;
  environment: string;
  timeoutMs: number;
  ttftTimeoutMs: number;
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
  consoleUrl: string;
  consoleModelsPath: string;
  consoleMcpPath: string;
};

export type ConsoleLinks = { root: string; models: string; mcpServers: string };

export type ModelListing = { ok: boolean; models: string[]; latencyMs: number; error: string };

export type GatewayDescription = {
  configured: boolean;
  host: string;
  endpoint: string;
  primaryModel: string;
  fallbackModels: string[];
  inputGuardrails: string[];
  outputGuardrails: string[];
  tenant: string;
  costCenter: string;
  environment: string;
  timeoutMs: number;
  console: ConsoleLinks;
};

export type GatewayUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

export type GatewayAttempt = { model: string; status: number; latencyMs: number; error: string };

export type GatewayTelemetry = {
  feature: string;
  configured: boolean;
  gatewayHost: string;
  model: string;
  modelChain: string[];
  attempts: GatewayAttempt[];
  latencyMs: number;
  usage: GatewayUsage;
  estimatedCostUsd: number;
  guardrails: { input: string[]; output: string[] };
  promptLogging: boolean;
  degraded: boolean;
};

export type GatewayResult = { ok: boolean; content: string; reason: string; telemetry: GatewayTelemetry };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function readGatewayConfig(env?: Record<string, string | undefined>): GatewayConfig;
export function isGatewayConfigured(config: GatewayConfig): boolean;
export function describeGateway(config: GatewayConfig): GatewayDescription;
export function estimateCostUsd(model: string, usage: Partial<GatewayUsage>, config?: Partial<GatewayConfig>): number;
export function encodeMetadata(metadata: Record<string, unknown>): Record<string, string>;
export function parseJsonContent(content: string): Record<string, unknown> | null;
export function consoleLinks(config: GatewayConfig): ConsoleLinks;
export function listGatewayModels(options: {
  config: GatewayConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ModelListing>;

export function gatewayChat(options: {
  config: GatewayConfig;
  feature: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  jsonOnly?: boolean;
  logPrompts?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<GatewayResult>;
