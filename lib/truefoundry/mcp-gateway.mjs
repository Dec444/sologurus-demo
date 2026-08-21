/**
 * TrueFoundry MCP Gateway client.
 *
 * Sologurus does not hold credentials for the tools it acts on. Writing a plan
 * into Notion is an *agent action*, so it is brokered here: the platform holds
 * the integration credential, the registry decides which tools exist, and this
 * application may only invoke the ones its skills allowlist names.
 *
 * Transport: streamable HTTP, the only transport the gateway proxy supports.
 *   POST {baseUrl}/mcp/{integrationId}/server
 *   Authorization: Bearer <TFY_API_KEY>
 *   Accept: application/json, text/event-stream
 * A response may come back as plain JSON or as a one-shot SSE frame, so both
 * are parsed. The `Mcp-Session-Id` handed back by `initialize` is echoed on
 * every later call in the same session.
 */

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "sologurus", version: "1.0.0" };
const DEFAULT_TIMEOUT_MS = 20_000;

const list = (value) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

/**
 * Servers are declared as `label:integrationId` pairs so the product can talk
 * about "Notion" while the registry decides which integration that resolves to.
 */
function parseServers(value) {
  return list(value).map((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) return { label: entry, integrationId: entry };
    return { label: entry.slice(0, separator).trim(), integrationId: entry.slice(separator + 1).trim() };
  }).filter((server) => server.label && server.integrationId);
}

/**
 * The application-side mirror of the Agent Skills Registry. Entries are
 * `server/tool`, and `server/*` permits a whole server. An empty allowlist
 * permits nothing: a tool must be named before Sologurus may call it.
 */
function parseSkills(value) {
  return list(value).map((entry) => {
    const separator = entry.indexOf("/");
    if (separator < 1) return null;
    return { server: entry.slice(0, separator).trim(), tool: entry.slice(separator + 1).trim() };
  }).filter(Boolean);
}

export function readMcpConfig(env = process.env) {
  const inferenceBase = String(env.TFY_GATEWAY_BASE_URL ?? "https://gateway.truefoundry.ai").trim().replace(/\/+$/, "");
  return {
    apiKey: String(env.TFY_API_KEY ?? "").trim(),
    // The MCP proxy may sit on a different prefix from the inference endpoint on
    // a self-hosted control plane, so it can be pointed independently.
    baseUrl: String(env.TFY_MCP_BASE_URL || inferenceBase).trim().replace(/\/+$/, ""),
    servers: parseServers(env.TFY_MCP_SERVERS),
    skills: parseSkills(env.TFY_MCP_ALLOWED_TOOLS),
    notionParent: String(env.TFY_MCP_NOTION_PARENT ?? "").trim(),
    timeoutMs: Number(env.TFY_MCP_TIMEOUT_MS) > 0 ? Number(env.TFY_MCP_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
  };
}

export function isMcpConfigured(config) {
  return Boolean(config.apiKey && config.servers.length > 0);
}

export function findServer(config, label) {
  return config.servers.find((server) => server.label === label) ?? null;
}

export function serverUrl(config, server) {
  return `${config.baseUrl}/mcp/${server.integrationId}/server`;
}

/** Is this tool named by the skills allowlist? */
export function isToolPermitted(config, serverLabel, toolName) {
  return config.skills.some((skill) => skill.server === serverLabel && (skill.tool === "*" || skill.tool === toolName));
}

/** Secret-free description of the broker, safe to send to the browser. */
export function describeMcp(config) {
  return {
    configured: isMcpConfigured(config),
    baseUrl: config.baseUrl,
    servers: config.servers.map((server) => ({ label: server.label, integrationId: server.integrationId })),
    skills: config.skills.map((skill) => `${skill.server}/${skill.tool}`),
    notionParentConfigured: Boolean(config.notionParent),
    timeoutMs: config.timeoutMs,
  };
}

/**
 * A streamable-HTTP response is either `application/json` or a `text/event-stream`
 * frame carrying the same JSON-RPC envelope. Reading the body as text and
 * pulling the last `data:` line covers both without a streaming parser.
 */
function decodeEnvelope(contentType, body) {
  if (contentType.includes("text/event-stream")) {
    const frames = body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    if (frames.length === 0) return null;
    try {
      return JSON.parse(frames[frames.length - 1]);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function rpc(config, server, session, { method, params, notification = false, fetchImpl }) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${config.apiKey}`,
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  if (session.id) headers["Mcp-Session-Id"] = session.id;

  const body = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
  if (!notification) {
    session.nextId += 1;
    body.id = session.nextId;
  }

  const response = await fetchImpl(serverUrl(config, server), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const sessionId = response.headers.get("mcp-session-id");
  if (sessionId) session.id = sessionId;

  // A notification is accepted with 202 and an empty body.
  if (notification) {
    if (!response.ok) throw new Error(`${method} rejected with HTTP ${response.status}`);
    return null;
  }

  const text = await response.text();
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}: ${text.slice(0, 200)}`);

  const envelope = decodeEnvelope(response.headers.get("content-type") ?? "", text);
  if (!envelope) throw new Error(`${method} returned a body this client could not decode.`);
  if (envelope.error) throw new Error(`${method} error ${envelope.error.code}: ${envelope.error.message}`);
  return envelope.result ?? {};
}

async function openSession(config, server, fetchImpl) {
  const session = { id: "", nextId: 0 };
  await rpc(config, server, session, {
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    fetchImpl,
  });
  await rpc(config, server, session, { method: "notifications/initialized", notification: true, fetchImpl });
  return session;
}

/**
 * Discover the tools one registered server exposes, each annotated with whether
 * this application's skills allowlist permits it. Never throws.
 */
export async function listServerTools(config, server, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const startedAt = now();
  if (!isMcpConfigured(config)) {
    return { ok: false, server: server.label, tools: [], latencyMs: 0, error: "mcp-not-configured" };
  }
  try {
    const session = await openSession(config, server, fetchImpl);
    const result = await rpc(config, server, session, { method: "tools/list", params: {}, fetchImpl });
    const tools = (Array.isArray(result.tools) ? result.tools : []).map((tool) => ({
      name: String(tool?.name ?? ""),
      description: String(tool?.description ?? "").slice(0, 240),
      permitted: isToolPermitted(config, server.label, String(tool?.name ?? "")),
      // Argument names only. Enough for the UI to show a schema mismatch without
      // dumping a whole JSON Schema into the browser.
      arguments: Object.keys(tool?.inputSchema?.properties ?? {}).slice(0, 12),
      required: Array.isArray(tool?.inputSchema?.required) ? tool.inputSchema.required.slice(0, 12) : [],
    })).filter((tool) => tool.name);
    return { ok: true, server: server.label, tools, latencyMs: now() - startedAt, error: "" };
  } catch (error) {
    return {
      ok: false,
      server: server.label,
      tools: [],
      latencyMs: now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 240) : "tool discovery failed",
    };
  }
}

/**
 * Invoke one tool. The allowlist is checked here, before the request is built,
 * so a tool the registry exposes but this product was never granted is refused
 * locally as well as centrally.
 */
export async function callServerTool(config, server, toolName, args, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const startedAt = now();
  const telemetry = { server: server?.label ?? "", tool: toolName, latencyMs: 0, permitted: false, transport: "streamable-http" };

  if (!isMcpConfigured(config)) {
    return { ok: false, reason: "mcp-not-configured", content: [], telemetry };
  }
  if (!isToolPermitted(config, server.label, toolName)) {
    telemetry.latencyMs = now() - startedAt;
    return { ok: false, reason: "tool-not-permitted", content: [], telemetry };
  }
  telemetry.permitted = true;

  try {
    const session = await openSession(config, server, fetchImpl);
    const result = await rpc(config, server, session, {
      method: "tools/call",
      params: { name: toolName, arguments: args ?? {} },
      fetchImpl,
    });
    telemetry.latencyMs = now() - startedAt;
    const content = (Array.isArray(result.content) ? result.content : [])
      .map((item) => ({ type: String(item?.type ?? "text"), text: String(item?.text ?? "").slice(0, 4000) }));
    if (result.isError) return { ok: false, reason: "tool-reported-error", content, telemetry };
    return { ok: true, reason: "", content, telemetry };
  } catch (error) {
    telemetry.latencyMs = now() - startedAt;
    return {
      ok: false,
      reason: error instanceof Error ? error.message.slice(0, 240) : "tool call failed",
      content: [],
      telemetry,
    };
  }
}

/** Flatten MCP content blocks into the single string the UI shows. */
export function contentToText(content) {
  return (Array.isArray(content) ? content : [])
    .filter((item) => item?.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
}
