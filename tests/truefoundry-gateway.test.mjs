import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  consoleLinks,
  describeGateway,
  encodeMetadata,
  estimateCostUsd,
  gatewayChat,
  isGatewayConfigured,
  listGatewayModels,
  parseJsonContent,
  readGatewayConfig,
} from "../lib/truefoundry.mjs";
import {
  AI_FEATURES,
  buildRequestMetadata,
  evaluateBudget,
  findFeature,
  keepGroundedCitations,
  pseudonymousLearnerId,
  recordUsage,
  redactPersonalData,
  resetLedger,
} from "../lib/governance.mjs";

const liveEnv = {
  TFY_API_KEY: "tfy-test-key",
  TFY_GATEWAY_BASE_URL: "https://gateway.truefoundry.ai/",
  TFY_MODEL_CHAIN: "openai-main/gpt-4o-mini, anthropic-main/claude-haiku-4-5",
  TFY_INPUT_GUARDRAILS: "sologurus/pii-redaction",
  TFY_OUTPUT_GUARDRAILS: "sologurus/content-safety",
  TFY_TENANT: "sologurus-demo",
  TFY_COST_CENTER: "learner-success",
  TFY_ENVIRONMENT: "hackathon",
  TFY_REQUEST_TIMEOUT_MS: "12000",
};

const completion = (content, usage = { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 }) => ({
  model: "openai-main/gpt-4o-mini",
  usage,
  choices: [{ message: { content } }],
});

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("configuration is read from the environment without leaking the key", () => {
  const config = readGatewayConfig(liveEnv);
  assert.equal(isGatewayConfigured(config), true);
  assert.equal(config.baseUrl, "https://gateway.truefoundry.ai", "the trailing slash is normalised away");
  assert.deepEqual(config.modelChain, ["openai-main/gpt-4o-mini", "anthropic-main/claude-haiku-4-5"]);

  const described = describeGateway(config);
  assert.equal(described.host, "gateway.truefoundry.ai");
  assert.equal(described.primaryModel, "openai-main/gpt-4o-mini");
  assert.deepEqual(described.fallbackModels, ["anthropic-main/claude-haiku-4-5"]);
  assert.ok(!JSON.stringify(described).includes("tfy-test-key"), "the API key must never reach the browser payload");
});

test("an unconfigured gateway degrades instead of throwing", async () => {
  const config = readGatewayConfig({});
  assert.equal(isGatewayConfigured(config), false);
  const result = await gatewayChat({
    config,
    feature: "research-synthesis",
    messages: [{ role: "user", content: "hello" }],
    fetchImpl: () => assert.fail("no request should be attempted without credentials"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "gateway-not-configured");
  assert.equal(result.telemetry.degraded, true);
});

test("a successful call sends the governance headers and reports a receipt", async () => {
  const config = readGatewayConfig(liveEnv);
  const feature = findFeature("writing-feedback");
  const seen = { url: "", headers: {}, body: {} };

  const result = await gatewayChat({
    config,
    feature: feature.id,
    messages: [{ role: "user", content: "mark this" }],
    metadata: buildRequestMetadata({ config, feature, learnerId: "lnr_test", language: "English" }),
    logPrompts: feature.promptLogging,
    jsonOnly: true,
    fetchImpl: async (url, init) => {
      seen.url = url;
      seen.headers = init.headers;
      seen.body = JSON.parse(init.body);
      return jsonResponse(completion('{"summary":"ok"}'));
    },
  });

  assert.equal(result.ok, true);
  assert.equal(seen.url, "https://gateway.truefoundry.ai/api/inference/openai/chat/completions");
  assert.equal(seen.headers.Authorization, "Bearer tfy-test-key");
  assert.equal(seen.headers["x-tfy-request-timeout"], "12000");
  assert.deepEqual(JSON.parse(seen.headers["x-tfy-guardrails"]), {
    llm_input_guardrails: ["sologurus/pii-redaction"],
    llm_output_guardrails: ["sologurus/content-safety"],
  });
  assert.deepEqual(JSON.parse(seen.headers["x-tfy-logging-config"]), { enabled: false }, "learner prose is never logged");

  const metadata = JSON.parse(seen.headers["x-tfy-metadata"]);
  assert.equal(metadata.application, "sologurus");
  assert.equal(metadata.tenant, "sologurus-demo");
  assert.equal(metadata.cost_center, "learner-success");
  assert.equal(metadata.feature, "writing-feedback");
  assert.equal(metadata.learner_id, "lnr_test");
  assert.equal(metadata.contains_learner_prose, "true");

  assert.equal(seen.body.model, "openai-main/gpt-4o-mini");
  assert.deepEqual(seen.body.response_format, { type: "json_object" });

  assert.equal(result.telemetry.degraded, false);
  assert.equal(result.telemetry.usage.totalTokens, 1000);
  assert.ok(result.telemetry.estimatedCostUsd > 0, "a spend estimate is reported to the learner");
});

test("the inference path is configurable for self-hosted control planes", () => {
  const config = readGatewayConfig({ ...liveEnv, TFY_INFERENCE_PATH: "/v1/chat/completions" });
  assert.equal(describeGateway(config).endpoint, "/v1/chat/completions");
});

test("metadata values stay inside the gateway's 128-character limit", () => {
  const encoded = encodeMetadata({ goal: "x".repeat(400), empty: "", missing: undefined });
  assert.equal(encoded.goal.length, 128);
  assert.equal("empty" in encoded, false);
  assert.equal("missing" in encoded, false);
});

test("the model chain fails over on a rate limit and stops on a credential error", async () => {
  const config = readGatewayConfig(liveEnv);
  const tried = [];

  const failover = await gatewayChat({
    config,
    feature: "research-synthesis",
    messages: [{ role: "user", content: "plan" }],
    fetchImpl: async (_url, init) => {
      const { model } = JSON.parse(init.body);
      tried.push(model);
      if (model === "openai-main/gpt-4o-mini") return jsonResponse({ error: "rate limited" }, 429);
      return jsonResponse(completion('{"briefing":"ok"}'));
    },
  });
  assert.equal(failover.ok, true);
  assert.deepEqual(tried, ["openai-main/gpt-4o-mini", "anthropic-main/claude-haiku-4-5"]);
  assert.equal(failover.telemetry.attempts.length, 2);
  assert.equal(failover.telemetry.attempts[0].status, 429);

  const attempts = [];
  const rejected = await gatewayChat({
    config,
    feature: "research-synthesis",
    messages: [{ role: "user", content: "plan" }],
    fetchImpl: async (_url, init) => {
      attempts.push(JSON.parse(init.body).model);
      return jsonResponse({ error: "invalid token" }, 401);
    },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "gateway-http-401");
  assert.equal(attempts.length, 1, "a credential error is a configuration fault, not something to retry");
});

test("JSON replies survive fences and surrounding prose", () => {
  assert.deepEqual(parseJsonContent('```json\n{"briefing":"hi"}\n```'), { briefing: "hi" });
  assert.deepEqual(parseJsonContent('Here you go: {"briefing":"hi"} — hope that helps'), { briefing: "hi" });
  assert.equal(parseJsonContent("no json at all"), null);
  assert.equal(parseJsonContent(""), null);
});

test("cost estimates scale with the model tier", () => {
  const usage = { promptTokens: 1_000_000, completionTokens: 0 };
  const mini = estimateCostUsd("openai-main/gpt-4o-mini", usage);
  const full = estimateCostUsd("openai-main/gpt-4o", usage);
  assert.ok(full > mini, "the larger model must not be reported as cheaper");
  assert.equal(estimateCostUsd("openai-main/gpt-4o-mini", { promptTokens: 0, completionTokens: 0 }), 0);
});

test("learner identity never leaves the server", () => {
  const profile = { language: "English", level: "B1", country: "Vietnam", goal: "IELTS 7.0", date: "2026-12-05" };
  const id = pseudonymousLearnerId(profile);
  assert.match(id, /^lnr_[a-z0-9]+$/);
  assert.equal(id, pseudonymousLearnerId({ ...profile }), "the id is stable for the same profile");
  assert.notEqual(id, pseudonymousLearnerId({ ...profile, goal: "IELTS 8.0" }));

  const { text, redactions } = redactPersonalData(
    "Contact me at mai.nguyen@example.com or +84 90 123 4567. My id is AB1234567 and my blog is https://example.com/me.",
  );
  assert.doesNotMatch(text, /mai\.nguyen@example\.com/);
  assert.doesNotMatch(text, /example\.com\/me/);
  assert.doesNotMatch(text, /\d{6,}/);
  assert.ok(redactions.some((item) => item.type === "email"));
  assert.ok(redactions.length >= 3, "email, phone-or-id and link are all removed");
});

test("per-learner budgets are enforced for every AI feature", () => {
  resetLedger();
  const feature = findFeature("writing-feedback");
  const learnerId = "lnr_budget";

  assert.equal(evaluateBudget(learnerId, feature).allowed, true);
  for (let call = 0; call < feature.dailyCallCeiling; call += 1) {
    recordUsage(learnerId, feature.id, { usage: { totalTokens: 10 }, estimatedCostUsd: 0.0001 });
  }
  const spent = evaluateBudget(learnerId, feature);
  assert.equal(spent.allowed, false);
  assert.equal(spent.remainingCalls, 0);
  assert.match(spent.reason, /limit/i);
  assert.equal(evaluateBudget("lnr_other", feature).allowed, true, "budgets are scoped per learner");
  resetLedger();
});

test("every AI feature declares a ceiling and a logging stance", () => {
  assert.ok(AI_FEATURES.length >= 2);
  for (const feature of AI_FEATURES) {
    assert.ok(feature.dailyCallCeiling > 0, `${feature.id} needs a call ceiling`);
    assert.ok(feature.dailyTokenCeiling >= 0, `${feature.id} needs a token ceiling`);
    assert.equal(feature.dailyTokenCeiling > 0, feature.maxOutputTokens > 0, `${feature.id} must be token-metered exactly when it calls a model`);
    assert.equal(typeof feature.sendsLearnerProse, "boolean");
    if (feature.sendsLearnerProse) {
      assert.equal(feature.promptLogging, false, `${feature.id} carries learner prose and must not log prompts`);
    }
  }
});

test("citations outside the verified catalog are dropped, not displayed", () => {
  const allowed = ["Cambridge IELTS 18", "BBC 6 Minute English"];
  const { kept, dropped } = keepGroundedCitations(
    ["cambridge ielts 18", "Invented Prep Centre", "BBC 6 Minute English", "Cambridge IELTS 18"],
    allowed,
  );
  assert.deepEqual(kept, ["Cambridge IELTS 18", "BBC 6 Minute English"], "matching is case-insensitive and de-duplicated");
  assert.deepEqual(dropped, ["Invented Prep Centre"]);
  assert.deepEqual(keepGroundedCitations(undefined, allowed), { kept: [], dropped: [] });
});

test("the gateway is the only place the app calls a model", async () => {
  for (const file of ["app/api/agent/route.ts", "app/api/feedback/route.ts", "app/api/gateway/route.ts"]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /lib\/truefoundry\.mjs|\.\.\/\.\.\/\.\.\/lib\/truefoundry\.mjs/, `${file} must route through the gateway client`);
    assert.doesNotMatch(source, /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/, `${file} must not bypass the gateway`);
  }

  const client = await readFile(new URL("../lib/truefoundry.mjs", import.meta.url), "utf8");
  assert.match(client, /x-tfy-metadata/);
  assert.match(client, /x-tfy-guardrails/);
  assert.match(client, /x-tfy-logging-config/);
  assert.match(client, /x-tfy-request-timeout/);
});

test("the console URL is derived from the control plane, and overridable", () => {
  const derived = readGatewayConfig({ ...liveEnv, TFY_GATEWAY_BASE_URL: "https://solo.truefoundry.cloud/api/llm" });
  assert.deepEqual(consoleLinks(derived), {
    root: "https://solo.truefoundry.cloud",
    models: "https://solo.truefoundry.cloud/llm-gateway",
    mcpServers: "https://solo.truefoundry.cloud/llm-gateway/mcp-servers",
  }, "the console is the origin of the gateway URL, not the /api/llm prefix");

  const overridden = readGatewayConfig({
    ...liveEnv,
    TFY_CONSOLE_URL: "https://console.example.com/",
    TFY_CONSOLE_MCP_PATH: "/integrations/mcp",
  });
  assert.equal(consoleLinks(overridden).mcpServers, "https://console.example.com/integrations/mcp");
  assert.equal(consoleLinks(readGatewayConfig({})).root, "", "the shared SaaS gateway host is not a console, so no dead link is offered");
});

test("the model list comes from the account, never from a list we ship", async () => {
  const config = readGatewayConfig(liveEnv);
  let seen = null;
  const listing = await listGatewayModels({
    config,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return jsonResponse({ object: "list", data: [{ id: "openai-main/gpt-4o-mini" }, { id: "bedrock/llama-3-3-70b" }, {}] });
    },
  });

  assert.equal(listing.ok, true);
  assert.deepEqual(listing.models, ["openai-main/gpt-4o-mini", "bedrock/llama-3-3-70b"], "entries without an id are dropped");
  assert.equal(seen.url, "https://gateway.truefoundry.ai/api/inference/openai/models", "the listing sits beside the completions route");
  assert.equal(seen.init.headers.Authorization, "Bearer tfy-test-key");

  const unreachable = await listGatewayModels({ config, fetchImpl: async () => jsonResponse({ error: "nope" }, 503) });
  assert.equal(unreachable.ok, false);
  assert.deepEqual(unreachable.models, [], "an unreachable gateway reports nothing rather than guessing");
  assert.match(unreachable.error, /503/);

  const unconfigured = await listGatewayModels({
    config: readGatewayConfig({}),
    fetchImpl: () => assert.fail("no request without credentials"),
  });
  assert.equal(unconfigured.error, "gateway-not-configured");
});

test("Sologurus ships no hard-coded provider or vendor account list", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  // The models shown to a user must come from their account, not from us.
  assert.match(page, /gatewayInfo\.models/, "the UI renders the discovered model list");
  assert.doesNotMatch(page, /gpt-4o|claude-|gemini-/i, "no specific model names are baked into the interface");
});
