/**
 * TrueFoundry AI Gateway client.
 *
 * Every model call in Sologurus goes through this module, so one place owns
 * authentication, tenant metadata, guardrails, timeouts, model fallback and
 * cost accounting. It is dependency-free `fetch`, so the same code runs on
 * Node 22 and on the Cloudflare Worker runtime.
 *
 * Gateway contract used here:
 *   POST {baseUrl}{inferencePath}                          (OpenAI-compatible)
 *   Authorization: Bearer <TFY_API_KEY>
 *   x-tfy-metadata:         JSON string map, used for cost attribution and for
 *                           `when` blocks in gateway rate-limit / budget rules
 *   x-tfy-guardrails:       JSON with llm_input_guardrails / llm_output_guardrails
 *   x-tfy-logging-config:   JSON, `{"enabled": false}` keeps learner prose out of logs
 *   x-tfy-request-timeout:  per-request ceiling in milliseconds
 */

const DEFAULT_BASE_URL = "https://gateway.truefoundry.ai";
const DEFAULT_MODEL_CHAIN = ["openai-main/gpt-4o-mini"];
const DEFAULT_TIMEOUT_MS = 45_000;
/**
 * SaaS control planes expose the OpenAI-compatible route below; some
 * self-hosted deployments front it at `/v1/chat/completions` instead. The
 * Playground's Code Snippet tab shows which one a given gateway uses — override
 * with TFY_INFERENCE_PATH when it differs.
 */
const DEFAULT_INFERENCE_PATH = "/api/inference/openai/chat/completions";

/**
 * Console deep links. Sologurus does not ship a provider list of its own — the
 * learner's institution adds models and MCP servers in their own TrueFoundry
 * control plane, and this app reflects whatever it finds there.
 */
const DEFAULT_CONSOLE_MODELS_PATH = "/llm-gateway";
const DEFAULT_CONSOLE_MCP_PATH = "/llm-gateway/mcp-servers";

/**
 * A dedicated control plane serves the gateway under /api/llm, so its console is
 * the same origin. The shared SaaS gateway host is not a console, so nothing is
 * derived there — better an honest blank than a dead link.
 */
function deriveConsoleUrl(baseUrl) {
  try {
    const { origin, host } = new URL(baseUrl);
    return host === "gateway.truefoundry.ai" ? "" : origin;
  } catch {
    return "";
  }
}

/**
 * List prices in USD per million tokens, used only to show a learner-visible
 * spend estimate. The gateway's own cost metrics remain authoritative; override
 * per deployment with TFY_PRICE_INPUT_PER_MTOK / TFY_PRICE_OUTPUT_PER_MTOK.
 */
const PRICE_TABLE = [
  { match: /gpt-4o-mini|gpt-4\.1-mini|o4-mini/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o|gpt-4\.1(?!-mini)/i, input: 2.5, output: 10 },
  { match: /haiku/i, input: 1, output: 5 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /gemini-[\d.]+-flash/i, input: 0.3, output: 2.5 },
  { match: /llama|mistral|qwen/i, input: 0.2, output: 0.6 },
];
const FALLBACK_PRICE = { input: 0.5, output: 1.5 };

const list = (value) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const positive = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

/** Read gateway configuration from the process environment. Never throws. */
export function readGatewayConfig(env = process.env) {
  const modelChain = list(env.TFY_MODEL_CHAIN);
  return {
    apiKey: String(env.TFY_API_KEY ?? "").trim(),
    baseUrl: String(env.TFY_GATEWAY_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, ""),
    inferencePath: String(env.TFY_INFERENCE_PATH || DEFAULT_INFERENCE_PATH).trim(),
    modelChain: modelChain.length > 0 ? modelChain : DEFAULT_MODEL_CHAIN,
    inputGuardrails: list(env.TFY_INPUT_GUARDRAILS),
    outputGuardrails: list(env.TFY_OUTPUT_GUARDRAILS),
    tenant: String(env.TFY_TENANT ?? "sologurus-demo").trim(),
    costCenter: String(env.TFY_COST_CENTER ?? "learner-success").trim(),
    environment: String(env.TFY_ENVIRONMENT ?? "hackathon").trim(),
    timeoutMs: positive(env.TFY_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    ttftTimeoutMs: positive(env.TFY_TTFT_TIMEOUT_MS, 0),
    priceInputPerMTok: positive(env.TFY_PRICE_INPUT_PER_MTOK, 0),
    priceOutputPerMTok: positive(env.TFY_PRICE_OUTPUT_PER_MTOK, 0),
    consoleUrl: String(env.TFY_CONSOLE_URL || deriveConsoleUrl(String(env.TFY_GATEWAY_BASE_URL ?? DEFAULT_BASE_URL))).trim().replace(/\/+$/, ""),
    consoleModelsPath: String(env.TFY_CONSOLE_MODELS_PATH || DEFAULT_CONSOLE_MODELS_PATH).trim(),
    consoleMcpPath: String(env.TFY_CONSOLE_MCP_PATH || DEFAULT_CONSOLE_MCP_PATH).trim(),
  };
}

/** Where to send someone who wants to add a model or an MCP server. */
export function consoleLinks(config) {
  const root = config.consoleUrl;
  if (!root) return { root: "", models: "", mcpServers: "" };
  return {
    root,
    models: `${root}${config.consoleModelsPath}`,
    mcpServers: `${root}${config.consoleMcpPath}`,
  };
}

export function isGatewayConfigured(config) {
  return Boolean(config.apiKey && config.baseUrl && config.modelChain.length > 0);
}

/** Secret-free description of the gateway, safe to send to the browser. */
export function describeGateway(config) {
  let host = "";
  try {
    host = new URL(config.baseUrl).host;
  } catch {
    host = config.baseUrl;
  }
  return {
    configured: isGatewayConfigured(config),
    host,
    endpoint: config.inferencePath,
    primaryModel: config.modelChain[0] ?? "",
    fallbackModels: config.modelChain.slice(1),
    inputGuardrails: config.inputGuardrails,
    outputGuardrails: config.outputGuardrails,
    tenant: config.tenant,
    costCenter: config.costCenter,
    environment: config.environment,
    timeoutMs: config.timeoutMs,
    console: consoleLinks(config),
  };
}

/**
 * Ask the gateway which models this account can actually reach. The app ships
 * no provider list: whatever an administrator has connected is what appears.
 * Never throws — an unreachable gateway simply reports nothing.
 */
export async function listGatewayModels({ config, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  const startedAt = now();
  if (!isGatewayConfigured(config)) {
    return { ok: false, models: [], latencyMs: 0, error: "gateway-not-configured" };
  }
  // The OpenAI-compatible listing sits beside the completions route.
  const url = `${config.baseUrl}${config.inferencePath.replace(/\/chat\/completions$/, "/models")}`;
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, models: [], latencyMs: now() - startedAt, error: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    const models = (Array.isArray(payload?.data) ? payload.data : [])
      .map((entry) => String(entry?.id ?? ""))
      .filter(Boolean);
    return { ok: true, models, latencyMs: now() - startedAt, error: "" };
  } catch (error) {
    return {
      ok: false,
      models: [],
      latencyMs: now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 200) : "model listing failed",
    };
  }
}

export function estimateCostUsd(model, usage, config = {}) {
  const price = PRICE_TABLE.find((entry) => entry.match.test(model ?? "")) ?? FALLBACK_PRICE;
  const input = config.priceInputPerMTok || price.input;
  const output = config.priceOutputPerMTok || price.output;
  const promptTokens = Number(usage?.promptTokens ?? 0);
  const completionTokens = Number(usage?.completionTokens ?? 0);
  return Math.round(((promptTokens * input + completionTokens * output) / 1_000_000) * 1e6) / 1e6;
}

function guardrailHeader(config) {
  const payload = {};
  if (config.inputGuardrails.length > 0) payload.llm_input_guardrails = config.inputGuardrails;
  if (config.outputGuardrails.length > 0) payload.llm_output_guardrails = config.outputGuardrails;
  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : "";
}

/**
 * Metadata values must be strings of at most 128 characters. Anything longer is
 * truncated rather than dropped, so a dashboard filter never silently loses a
 * request.
 */
export function encodeMetadata(metadata) {
  const encoded = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    encoded[String(key).slice(0, 64)] = String(value).slice(0, 128);
  }
  return encoded;
}

function buildHeaders(config, { metadata, logPrompts }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "x-tfy-metadata": JSON.stringify(encodeMetadata(metadata)),
    "x-tfy-logging-config": JSON.stringify({ enabled: Boolean(logPrompts) }),
    "x-tfy-request-timeout": String(config.timeoutMs),
  };
  const guardrails = guardrailHeader(config);
  if (guardrails) headers["x-tfy-guardrails"] = guardrails;
  if (config.ttftTimeoutMs > 0) headers["x-tfy-ttft-timeout-ms"] = String(config.ttftTimeoutMs);
  return headers;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Call the gateway, walking the model chain until one model answers.
 *
 * Resolves to `{ ok, content, telemetry }` and never throws: a study plan must
 * still render when the gateway is unreachable, so callers fall back to the
 * deterministic planner instead of showing an error page.
 */
export async function gatewayChat({
  config,
  feature,
  messages,
  metadata = {},
  temperature = 0.2,
  maxTokens = 900,
  jsonOnly = false,
  logPrompts = false,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
}) {
  const startedAt = now();
  const telemetry = {
    feature,
    configured: isGatewayConfigured(config),
    gatewayHost: describeGateway(config).host,
    model: "",
    modelChain: config.modelChain,
    attempts: [],
    latencyMs: 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    estimatedCostUsd: 0,
    guardrails: { input: config.inputGuardrails, output: config.outputGuardrails },
    promptLogging: Boolean(logPrompts),
    degraded: true,
  };

  if (!telemetry.configured) {
    telemetry.latencyMs = now() - startedAt;
    return { ok: false, content: "", reason: "gateway-not-configured", telemetry };
  }

  const url = `${config.baseUrl}${config.inferencePath}`;
  const headers = buildHeaders(config, { metadata, logPrompts });

  for (const model of config.modelChain) {
    const attemptStartedAt = now();
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonOnly ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        telemetry.attempts.push({ model, status: response.status, latencyMs: now() - attemptStartedAt, error: detail });
        if (RETRYABLE_STATUS.has(response.status)) continue;
        telemetry.latencyMs = now() - startedAt;
        return { ok: false, content: "", reason: `gateway-http-${response.status}`, telemetry };
      }

      const payload = await response.json();
      const usage = {
        promptTokens: Number(payload?.usage?.prompt_tokens ?? 0),
        completionTokens: Number(payload?.usage?.completion_tokens ?? 0),
        totalTokens: Number(payload?.usage?.total_tokens ?? 0),
      };
      telemetry.attempts.push({ model, status: 200, latencyMs: now() - attemptStartedAt, error: "" });
      telemetry.model = payload?.model ?? model;
      telemetry.usage = usage;
      telemetry.estimatedCostUsd = estimateCostUsd(telemetry.model, usage, config);
      telemetry.latencyMs = now() - startedAt;
      telemetry.degraded = false;
      return { ok: true, content: String(payload?.choices?.[0]?.message?.content ?? ""), reason: "", telemetry };
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : "request failed";
      telemetry.attempts.push({ model, status: 0, latencyMs: now() - attemptStartedAt, error: message.slice(0, 300) });
    }
  }

  telemetry.latencyMs = now() - startedAt;
  return { ok: false, content: "", reason: "all-models-failed", telemetry };
}

/** Tolerant JSON extraction: models occasionally wrap JSON in prose or fences. */
export function parseJsonContent(content) {
  const text = String(content ?? "").trim();
  if (!text) return null;
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  const braced = text.match(/\{[\s\S]*\}/);
  if (braced) candidates.push(braced[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
