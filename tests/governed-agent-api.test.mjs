import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("agent-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

const call = (path, init) => worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);
const post = (path, body) => call(path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const profile = {
  language: "English",
  level: "B1 · Intermediate",
  city: "Ho Chi Minh City",
  country: "Vietnam",
  goal: "IELTS 7.0 for Canadian PR",
  date: "2026-12-05",
  dailyHours: 1.5,
  studyDays: 6,
  consistency: "steady",
  examExperience: "similar",
};
const feasibility = { status: "tight", advice: "Keep a buffer day.", availableHours: 300, neededHours: 320, weeklyHours: 9 };

test("the gateway status endpoint describes the policy without exposing a secret", async () => {
  const response = await call("/api/gateway");
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(typeof body.gateway.configured, "boolean");
  assert.ok(body.gateway.host.length > 0, "the browser is told which gateway host is in use");
  assert.ok(body.features.length >= 2, "every AI feature is declared with its ceiling");
  for (const feature of body.features) {
    assert.ok(feature.dailyCallCeiling > 0, `${feature.id} needs a visible call ceiling`);
    assert.ok(feature.purpose.length > 0, `${feature.id} needs a stated purpose`);
  }
  assert.ok(body.privacy.length >= 3, "the privacy stance is published, not implied");
  assert.ok(body.degradedMode.length > 0);
  assert.doesNotMatch(JSON.stringify(body), /Bearer|apiKey|TFY_API_KEY/, "no credential material in the response");
});

test("the planning layer answers with a grounded synthesis even with no gateway configured", async () => {
  const response = await post("/api/agent", { profile, feasibility });
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.source, "deterministic", "no credentials in CI, so the deterministic planner must answer");
  assert.match(body.learnerId, /^lnr_[a-z0-9]{1,12}$/, "the learner is an opaque token, not a readable profile");

  const phases = body.synthesis.focusByPhase.map((item) => item.phase);
  assert.deepEqual(phases, ["Foundation", "Skill building", "Exam technique", "Mock & taper"]);
  for (const item of body.synthesis.focusByPhase) {
    assert.ok(item.emphasis.length > 0 && item.why.length > 0, `${item.phase} needs an emphasis and a reason`);
  }
  assert.ok(body.synthesis.briefing.length > 0);
  assert.ok(body.synthesis.riskFlags.length <= 3, "at most three risks, so the warning stays meaningful");
  assert.ok(body.synthesis.citations.length > 0, "the synthesis cites verified catalog records");
  assert.deepEqual(body.grounding.dropped, [], "the deterministic planner cannot invent a source");
  assert.ok(body.budget.remainingCalls > 0);
  assert.match(body.note, /not configured/i);
});

test("the planning layer cites only names the verified catalog contains", async () => {
  const catalogResponse = await call("/api/resources?language=Japanese&city=Tokyo&country=Japan");
  const catalog = await catalogResponse.json();
  const allowed = new Set([
    ...catalog.tests.map((item) => item.name),
    ...catalog.testCenters.map((item) => item.name),
    ...catalog.youtube.map((item) => item.name),
    ...catalog.forums.map((item) => item.name),
    ...catalog.tvShows.map((item) => item.name),
    ...catalog.mockExams.map((item) => item.name),
    ...catalog.textbooks.map((item) => item.name),
    ...Object.values(catalog.materials).flat().map((item) => item.name),
  ]);

  const response = await post("/api/agent", {
    profile: { ...profile, language: "Japanese", city: "Tokyo", country: "Japan", goal: "JLPT N2" },
    feasibility,
  });
  const body = await response.json();
  for (const citation of body.synthesis.citations) {
    assert.ok(allowed.has(citation), `${citation} is not in the verified Japanese catalog`);
  }
});

test("writing feedback refuses a sample too short to mark", async () => {
  const response = await post("/api/feedback", { profile, sample: "Too short to assess fairly." });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.message, /at least 40 words/);
});

test("writing feedback redacts identifiers and never fabricates a band score offline", async () => {
  const sample = [
    "I am writing about whether examinations are the best way to measure what a student has learned.",
    "In my opinion they measure preparation more than understanding, because a student can rehearse a format.",
    "Contact me at mai.nguyen@example.com or on +84 90 123 4567 if you want to read my other essays.",
    "My student number is AB1234567 and my writing blog is https://example.com/mai for more samples.",
    "For these reasons I believe continuous assessment gives a fairer picture of a learner over a whole year.",
  ].join(" ");

  const response = await post("/api/feedback", { profile, sample, prompt: "Are exams the best assessment?" });
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.source, "offline", "with no gateway configured this is a structural check, not marking");
  assert.equal(body.feedback.scored, false);
  assert.equal(body.feedback.bandEstimate, "", "an unmarked sample must not carry an invented score");
  assert.match(body.feedback.summary, /not a marked/i, "the learner is told no model was called");
  assert.ok(body.feedback.fixes.length > 0);

  const identifiers = body.redactions.map((item) => item.type);
  assert.ok(identifiers.includes("email"), "the email address is stripped");
  assert.ok(identifiers.includes("url"), "the personal link is stripped");
  assert.ok(identifiers.includes("phone") || identifiers.includes("id-number"), "the number is stripped");
  assert.doesNotMatch(JSON.stringify(body), /mai\.nguyen@example\.com/, "no identifier survives into the response");
  assert.equal(body.telemetry.degraded, true);
  assert.equal(body.telemetry.usage.totalTokens, 0, "no tokens are billed when no model runs");
});

test("the MCP broker publishes its registry state without exposing a credential", async () => {
  const response = await call("/api/mcp");
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(typeof body.broker.configured, "boolean");
  assert.equal(body.broker.configured, false, "no MCP servers are registered in CI");
  assert.deepEqual(body.listings, [], "nothing is discovered without a registry");
  assert.equal(body.permittedCount, 0);
  assert.equal(body.transport, "streamable-http");
  assert.match(body.note, /cannot reach Notion/i, "the consequence of no registry is stated plainly");
  assert.doesNotMatch(JSON.stringify(body), /Bearer|apiKey|TFY_API_KEY/, "no credential material in the response");
});

test("dispatching a declared action without a registry is refused, not faked", async () => {
  const response = await post("/api/mcp", { action: "notion-study-plan", profile });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.message, /No MCP server is registered/);
  assert.match(body.message, /cannot reach Notion/i, "the learner is told the product simply has no other way in");
});

test("an undeclared action is rejected before any registry lookup", async () => {
  const response = await post("/api/mcp", { action: "notion-duplicate-page", profile });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.match(body.message, /not a declared Sologurus action/);
  assert.ok(Array.isArray(body.actions) && body.actions.length > 0, "the declared set is published");
  assert.ok(!body.actions.includes("notion-duplicate-page"));
});

test("every declared action reports why it is unavailable", async () => {
  const response = await call("/api/mcp");
  const body = await response.json();
  assert.ok(body.actions.length > 0, "actions are published even with no registry");
  for (const action of body.actions) {
    assert.equal(action.server, "notion", "Notion is the only brokered server");
    assert.match(action.tool, /^notion-/);
    assert.equal(action.available, false, "nothing is runnable without a registry");
    assert.ok(action.reason.length > 0, `${action.id} must say why it cannot run`);
  }
  assert.match(body.calendarNote, /no integration/i, "calendar is explained as unbrokered, not missing");
});

test("the governed-actions feature is declared alongside the model features", async () => {
  const response = await call("/api/gateway");
  const body = await response.json();
  const actions = body.features.find((feature) => feature.id === "governed-actions");
  assert.ok(actions, "governed actions must appear in the published policy");
  assert.ok(actions.dailyCallCeiling > 0, "actions are rate-limited per learner");
  assert.equal(actions.sendsLearnerProse, false, "a plan dispatch carries records, not learner writing");
});
