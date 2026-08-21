import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  callServerTool,
  contentToText,
  describeMcp,
  findServer,
  isMcpConfigured,
  isToolPermitted,
  listServerTools,
  readMcpConfig,
  serverUrl,
} from "../lib/mcp-gateway.mjs";

const liveEnv = {
  TFY_API_KEY: "tfy-test-key",
  TFY_GATEWAY_BASE_URL: "https://solo.truefoundry.cloud/api/llm",
  TFY_MCP_SERVERS: "notion:notion-study-plans, drive:drive-readonly",
  TFY_MCP_ALLOWED_TOOLS: "notion/notion-create-pages, notion/notion-search, drive/*",
};

const jsonRpc = (result, extraHeaders = {}) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
  status: 200,
  headers: { "Content-Type": "application/json", ...extraHeaders },
});

/**
 * A fake streamable-HTTP MCP server: answers initialize with a session id,
 * accepts the initialized notification, then serves whatever the test supplies.
 */
function fakeServer({ tools = [], onCall = () => ({ content: [{ type: "text", text: "done" }] }), sessionId = "sess-123" } = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ url, headers: init.headers, body });
    if (body.method === "initialize") {
      return jsonRpc({ protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake", version: "1" } }, { "mcp-session-id": sessionId });
    }
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (body.method === "tools/list") return jsonRpc({ tools });
    if (body.method === "tools/call") return jsonRpc(onCall(body.params));
    return jsonRpc({});
  };
  return { fetchImpl, seen };
}

test("servers and skills are parsed from the environment", () => {
  const config = readMcpConfig(liveEnv);
  assert.equal(isMcpConfigured(config), true);
  assert.deepEqual(config.servers, [
    { label: "notion", integrationId: "notion-study-plans" },
    { label: "drive", integrationId: "drive-readonly" },
  ]);
  assert.equal(serverUrl(config, config.servers[0]), "https://solo.truefoundry.cloud/api/llm/mcp/notion-study-plans/server");
  assert.deepEqual(findServer(config, "drive"), { label: "drive", integrationId: "drive-readonly" });
  assert.equal(findServer(config, "slack"), null);

  const described = describeMcp(config);
  assert.equal(described.configured, true);
  assert.ok(!JSON.stringify(described).includes("tfy-test-key"), "the token must never reach the browser payload");
});

test("the skills allowlist is closed by default", () => {
  const config = readMcpConfig(liveEnv);
  assert.equal(isToolPermitted(config, "notion", "notion-create-pages"), true);
  assert.equal(isToolPermitted(config, "notion", "notion-duplicate-page"), false, "a tool not named in the registry is refused");
  assert.equal(isToolPermitted(config, "drive", "anything"), true, "drive/* grants the whole server");
  assert.equal(isToolPermitted(config, "slack", "post-message"), false);

  const empty = readMcpConfig({ ...liveEnv, TFY_MCP_ALLOWED_TOOLS: "" });
  assert.equal(isToolPermitted(empty, "notion", "notion-create-pages"), false, "an empty allowlist permits nothing");
});

test("an unconfigured broker degrades instead of throwing", async () => {
  const config = readMcpConfig({});
  assert.equal(isMcpConfigured(config), false);
  const listing = await listServerTools(config, { label: "notion", integrationId: "x" }, {
    fetchImpl: () => assert.fail("no request should be attempted without registration"),
  });
  assert.equal(listing.ok, false);
  assert.equal(listing.error, "mcp-not-configured");
});

test("tool discovery performs the MCP handshake and flags what is permitted", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  const { fetchImpl, seen } = fakeServer({
    tools: [
      { name: "notion-create-pages", description: "Create Notion pages", inputSchema: { properties: { pages: {}, parent: {} }, required: ["pages"] } },
      { name: "notion-duplicate-page", description: "Duplicate a page" },
    ],
  });

  const listing = await listServerTools(config, server, { fetchImpl });
  assert.equal(listing.ok, true);
  assert.deepEqual(listing.tools.map((tool) => [tool.name, tool.permitted]), [
    ["notion-create-pages", true],
    ["notion-duplicate-page", false],
  ]);
  assert.deepEqual(listing.tools[0].arguments, ["pages", "parent"], "argument names surface so a schema mismatch is visible");
  assert.deepEqual(listing.tools[0].required, ["pages"]);

  assert.deepEqual(seen.map((entry) => entry.body.method), ["initialize", "notifications/initialized", "tools/list"]);
  assert.equal(seen[0].url, "https://solo.truefoundry.cloud/api/llm/mcp/notion-study-plans/server");
  assert.equal(seen[0].headers.Authorization, "Bearer tfy-test-key");
  assert.match(seen[0].headers.Accept, /text\/event-stream/, "streamable HTTP must advertise the event-stream accept type");
  assert.equal(seen[0].headers["Mcp-Session-Id"], undefined, "no session exists before initialize");
  assert.equal(seen[2].headers["Mcp-Session-Id"], "sess-123", "the session id from initialize is echoed back");
});

test("a permitted tool call reaches the server and returns its content", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  let received = null;
  const { fetchImpl } = fakeServer({
    onCall: (params) => {
      received = params;
      return { content: [{ type: "text", text: "Created page abc123" }] };
    },
  });

  const result = await callServerTool(config, server, "notion-create-pages", { pages: [{ properties: { title: "IELTS plan" } }] }, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(contentToText(result.content), "Created page abc123");
  assert.deepEqual(received, { name: "notion-create-pages", arguments: { pages: [{ properties: { title: "IELTS plan" } }] } });
  assert.equal(result.telemetry.permitted, true);
  assert.equal(result.telemetry.transport, "streamable-http");
});

test("a tool outside the skills registry is refused before any request is sent", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  const result = await callServerTool(config, server, "notion-duplicate-page", { id: "1" }, {
    fetchImpl: () => assert.fail("a refused tool must never reach the network"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool-not-permitted");
  assert.equal(result.telemetry.permitted, false);
});

test("a tool that reports an error is surfaced, not swallowed", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  const { fetchImpl } = fakeServer({
    onCall: () => ({ isError: true, content: [{ type: "text", text: "Notion rate limit exceeded" }] }),
  });
  const result = await callServerTool(config, server, "notion-create-pages", {}, { fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool-reported-error");
  assert.equal(contentToText(result.content), "Notion rate limit exceeded");
});

test("server-sent-event responses decode the same as plain JSON", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  const sse = (payload) => new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "mcp-session-id": "sess-sse" },
  });
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (body.method === "tools/call") {
      return sse({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "Page created" }] } });
    }
    return sse({ jsonrpc: "2.0", id: body.id, result: {} });
  };

  const result = await callServerTool(config, server, "notion-create-pages", {}, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(contentToText(result.content), "Page created");
});

test("a JSON-RPC error from the gateway becomes a reported failure, not a crash", async () => {
  const config = readMcpConfig(liveEnv);
  const server = findServer(config, "notion");
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (body.method === "tools/call") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: "Unknown tool" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return jsonRpc({});
  };
  const result = await callServerTool(config, server, "notion-create-pages", {}, { fetchImpl });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown tool/);
});

test("integration credentials are never held by this application", async () => {
  const client = await readFile(new URL("../lib/mcp-gateway.mjs", import.meta.url), "utf8");
  assert.match(client, /\/mcp\/\$\{server\.integrationId\}\/server/, "actions go through the gateway proxy path");
  assert.doesNotMatch(client, /api\.notion\.com/, "the broker must not talk to Notion directly");

  const route = await readFile(new URL("../app/api/mcp/route.ts", import.meta.url), "utf8");
  assert.match(route, /isToolPermitted|tool-not-permitted/, "the route enforces the allowlist as well as the client");
  assert.match(route, /recordUsage/, "dispatches count against the action ceiling");
});

test("the MCP proxy can be pointed independently of the inference endpoint", () => {
  const split = readMcpConfig({ ...liveEnv, TFY_MCP_BASE_URL: "https://solo.truefoundry.cloud" });
  assert.equal(serverUrl(split, split.servers[0]), "https://solo.truefoundry.cloud/mcp/notion-study-plans/server");
  const shared = readMcpConfig(liveEnv);
  assert.match(serverUrl(shared, shared.servers[0]), /\/api\/llm\/mcp\//, "it falls back to the inference base URL");
});

test("declared actions bind a product intent to one real Notion MCP tool", async () => {
  const { GOVERNED_ACTIONS, describeActions, findAction, studyPlanMarkdown } = await import("../lib/mcp-actions.mjs");

  assert.ok(GOVERNED_ACTIONS.length > 0);
  for (const action of GOVERNED_ACTIONS) {
    assert.equal(action.server, "notion", "Notion is the only registered MCP server for this workspace");
    assert.match(action.tool, /^notion-/, `${action.id} must name a real Notion MCP tool`);
  }
  assert.equal(findAction("does-not-exist"), null, "an undeclared action cannot be invoked");
  assert.ok(describeActions().every((entry) => !("build" in entry)), "the browser never receives the payload builder");

  const markdown = studyPlanMarkdown({
    profile: { language: "English", level: "B1", goal: "IELTS 7.0", date: "2026-12-05", dailyHours: 1.5, studyDays: 6 },
    plan: { name: "Balanced Four-Skill", tagline: "Progress evenly." },
    feasibility: { title: "Tight.", advice: "Keep a buffer day.", weeklyHours: 9 },
    studyPlan: [
      { day: 1, dateLabel: "13 Nov 2026", phase: "Foundation", focus: "Listening foundations", textbook: "Book", practice: "BBC", durationMinutes: 90 },
    ],
  });
  assert.match(markdown, /## Strategy: Balanced Four-Skill/);
  assert.match(markdown, /- \[ \] Day 1 · 13 Nov 2026 · Foundation/, "sessions are checkboxes so progress can sync back");
  assert.match(markdown, /Sessions \(1\)/);

  const args = findAction("notion-study-plan").build(
    { profile: { language: "English" }, plan: { name: "Balanced" }, studyPlan: [] },
    { notionParent: "abc123" },
  );
  assert.ok(Array.isArray(args.pages) && args.pages.length === 1, "notion-create-pages takes a pages array");
  assert.match(args.pages[0].properties.title, /English study plan · Balanced/);
  assert.deepEqual(args.parent, { type: "page_id", page_id: "abc123" });
});

test("a created page reference is recovered from whatever prose the server returns", async () => {
  const { extractNotionPageRef } = await import("../lib/mcp-actions.mjs");

  assert.equal(
    extractNotionPageRef('Created "English study plan" at https://www.notion.so/English-plan-24f1a2b3c4d5.'),
    "https://www.notion.so/English-plan-24f1a2b3c4d5",
    "trailing punctuation is not part of the link",
  );
  assert.equal(extractNotionPageRef("Page 195de922-1179-449f-ab80-75a27c979105 created."), "195de922-1179-449f-ab80-75a27c979105");
  assert.equal(extractNotionPageRef("page id 195de9221179449fab8075a27c979105"), "195de9221179449fab8075a27c979105");
  assert.equal(extractNotionPageRef("Something went wrong."), "", "no reference is invented");
  assert.equal(extractNotionPageRef(undefined), "");
});

test("only ticked sessions come back from the plan page", async () => {
  const { parseCompletedDays } = await import("../lib/mcp-actions.mjs");

  const markdown = [
    "- [x] Day 1 · Foundation [Sologurus day 1]",
    "- [ ] Day 2 · Foundation [Sologurus day 2]",
    "* [X] Day 3 · Skill building [Sologurus day 3]",
    "- [x] A checked box with no marker at all",
    "Some prose mentioning [Sologurus day 9] that is not a checkbox",
  ].join("\n");

  assert.deepEqual(parseCompletedDays(markdown), [1, 3], "unmarked boxes and prose are ignored");
  assert.deepEqual(parseCompletedDays(""), []);
  assert.deepEqual(parseCompletedDays(undefined), []);
});

test("reading progress needs a page to read", async () => {
  const { findAction } = await import("../lib/mcp-actions.mjs");
  const progress = findAction("notion-plan-progress");
  assert.equal(progress.tool, "notion-fetch");
  assert.equal(progress.needsPageRef, true, "the route must refuse before calling with an empty id");
  assert.deepEqual(progress.build({ pageRef: "https://notion.so/abc" }), { id: "https://notion.so/abc" });
});

test("the created page carries a parent only when one is configured", async () => {
  const { findAction } = await import("../lib/mcp-actions.mjs");
  const create = findAction("notion-study-plan");
  const withParent = create.build({ profile: { language: "English" }, plan: { name: "Balanced" }, studyPlan: [] }, { notionParent: "abc123" });
  assert.deepEqual(withParent.parent, { type: "page_id", page_id: "abc123" }, "the parent variant is discriminated");
  assert.equal(withParent.pages[0].icon, "\u{1F4D8}");
  assert.equal("parent" in create.build({ profile: {}, plan: {} }, {}), false);
});
