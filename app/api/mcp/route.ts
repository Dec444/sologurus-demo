import {
  callServerTool,
  contentToText,
  describeMcp,
  findServer,
  isMcpConfigured,
  listServerTools,
  readMcpConfig,
} from "../../../lib/truefoundry/mcp-gateway.mjs";
import { consoleLinks, readGatewayConfig } from "../../../lib/truefoundry/gateway.mjs";
import type { McpToolListing } from "../../../lib/truefoundry/mcp-gateway";
import { describeActions, extractNotionPageRef, findAction, parseCompletedDays } from "../../../lib/truefoundry/mcp-actions.mjs";
import { evaluateBudget, findFeature, pseudonymousLearnerId, recordUsage } from "../../../lib/truefoundry/governance.mjs";

const FEATURE_ID = "governed-actions";

/**
 * Discover every tool the registered MCP servers expose, annotated with whether
 * this application's skills allowlist permits it. Publishing the blocked tools
 * as well as the permitted ones is the point: an administrator can see exactly
 * what Sologurus can and cannot reach.
 */
export async function GET() {
  const config = readMcpConfig();
  const broker = describeMcp(config);

  const listings: McpToolListing[] = isMcpConfigured(config)
    ? await Promise.all(config.servers.map((server) => listServerTools(config, server)))
    : [];

  const permittedCount = listings.reduce((total, listing) => total + listing.tools.filter((tool) => tool.permitted).length, 0);
  const discoveredCount = listings.reduce((total, listing) => total + listing.tools.length, 0);

  // An action is runnable only when its server answered, its tool exists on that
  // server, and the allowlist grants it. Reporting the reason keeps a
  // misconfiguration visible instead of surfacing as a silent failure later.
  const actions = describeActions().map((action) => {
    const listing = listings.find((entry) => entry.server === action.server);
    const tool = listing?.tools.find((entry) => entry.name === action.tool);
    return {
      ...action,
      available: Boolean(tool?.permitted),
      reason: !broker.configured ? "No MCP servers are registered."
        : !listing ? `No server is registered under "${action.server}".`
          : !listing.ok ? listing.error
            : !tool ? `This server does not expose ${action.tool}.`
              : tool.permitted ? "" : `The skills allowlist does not grant ${action.server}/${action.tool}.`,
      serverArguments: tool?.arguments ?? [],
    };
  });

  return Response.json(
    {
      broker,
      // Where an administrator goes to register a server or grant a tool.
      console: consoleLinks(readGatewayConfig()),
      listings,
      actions,
      permittedCount,
      discoveredCount,
      transport: "streamable-http",
      note: broker.configured
        ? "The Notion credential stays in the TrueFoundry platform. Sologurus holds none of its own."
        : "No MCP server is registered for this deployment, so Sologurus cannot reach Notion at all. It holds no Notion credential to fall back to.",
      calendarNote: "Calendar export is not brokered because it needs no integration: the .ics file is generated in the browser and imports into Google, Apple, or Outlook with no account at all.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

/**
 * Run one declared action. The browser names an intent, never a tool and never
 * a payload — the binding and the arguments are built here — and the allowlist
 * is then enforced on top of that.
 */
export async function POST(request: Request) {
  let body: {
    action?: string;
    profile?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    feasibility?: Record<string, unknown>;
    studyPlan?: Array<Record<string, unknown>>;
    pageRef?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Send a JSON body naming an action." }, { status: 400 });
  }

  const action = findAction(String(body.action ?? ""));
  if (!action) {
    return Response.json(
      { ok: false, message: `"${body.action}" is not a declared Sologurus action.`, actions: describeActions().map((entry) => entry.id) },
      { status: 400 },
    );
  }

  const config = readMcpConfig();
  if (!isMcpConfigured(config)) {
    return Response.json(
      { ok: false, message: "No MCP server is registered for this deployment, so Sologurus cannot reach Notion. Register it in TrueFoundry and grant the tools." },
      { status: 503 },
    );
  }

  if (action.needsPageRef && !String(body.pageRef ?? "").trim()) {
    return Response.json(
      { ok: false, message: "Create the study-plan page first, or paste its Notion link, so there is a page to read." },
      { status: 400 },
    );
  }

  const server = findServer(config, action.server);
  if (!server) {
    return Response.json({ ok: false, message: `No MCP server is registered under "${action.server}".` }, { status: 404 });
  }

  const feature = findFeature(FEATURE_ID);
  const learnerId = pseudonymousLearnerId(body.profile ?? {});
  const budget = feature ? evaluateBudget(learnerId, feature) : null;
  if (budget && !budget.allowed) {
    return Response.json({ ok: false, message: budget.reason }, { status: 429 });
  }

  const args = action.build(
    {
      profile: body.profile,
      plan: body.plan,
      feasibility: body.feasibility,
      studyPlan: body.studyPlan,
      pageRef: body.pageRef,
    },
    { notionParent: config.notionParent },
  );
  const result = await callServerTool(config, server, action.tool, args);
  // Every dispatch counts against the action ceiling, refused or not: a rejected
  // tool call is still an attempt worth rate-limiting.
  if (feature) recordUsage(learnerId, feature.id, null);

  if (!result.ok && result.reason === "tool-not-permitted") {
    return Response.json(
      {
        ok: false,
        blocked: true,
        message: `The skills registry does not grant Sologurus "${action.server}/${action.tool}".`,
        telemetry: result.telemetry,
      },
      { status: 403 },
    );
  }

  // Each action declares what its output means, so the browser receives a typed
  // result rather than raw tool prose it would have to parse itself.
  const output = contentToText(result.content);
  const pageRef = result.ok && action.returns === "page-ref" ? extractNotionPageRef(output) : "";
  const completedDays = result.ok && action.returns === "completed-days" ? parseCompletedDays(output) : null;

  return Response.json(
    {
      ok: result.ok,
      learnerId,
      action: action.id,
      message: result.ok ? `${action.label} completed through the MCP Gateway.` : result.reason,
      output,
      pageRef,
      completedDays,
      telemetry: result.telemetry,
      budget: feature ? evaluateBudget(learnerId, feature) : null,
    },
    { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
