/**
 * The governed actions Sologurus knows how to perform.
 *
 * This is the application half of an Agent Skills Registry: a closed list of
 * product intents, each bound to one MCP server and one tool, with the payload
 * built here on the server. The browser names an action, never a tool and never
 * a payload — so a crafted request cannot reach an arbitrary tool with an
 * arbitrary body even before the allowlist is consulted.
 *
 * Notion is reached ONLY this way. Sologurus holds no Notion credential of its
 * own: if an administrator has not registered the server and granted the tools,
 * the product simply cannot write to or read from Notion.
 *
 * Calendar export is deliberately not brokered. The `.ics` file is generated in
 * the browser and imports into Google, Apple, or Outlook with no account at
 * all, so there is no credential to govern.
 */

const NOTION_SERVER = "notion";

/** Machine-readable marker so a completed session survives Notion's reflow. */
const DAY_MARKER = (day) => `[Sologurus day ${day}]`;

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Notion-flavoured markdown. Sessions are checkboxes so progress can sync back. */
export function studyPlanMarkdown({ profile = {}, plan = {}, feasibility = {}, studyPlan = [] }) {
  const lines = [
    `**Language** ${text(profile.language, 40)} · **Level** ${text(profile.level, 40)}`,
    `**Goal** ${text(profile.goal, 120)}`,
    `**Target date** ${text(profile.date, 20)} · **Rhythm** ${profile.dailyHours ?? "?"}h × ${profile.studyDays ?? "?"} days/week · **Weekly** ${feasibility.weeklyHours ?? "?"}h`,
    "",
    `## Strategy: ${text(plan.name, 60)}`,
    text(plan.tagline, 160),
    "",
    "## Feasibility",
    `${text(feasibility.title, 120)} ${text(feasibility.advice, 400)}`,
    "",
    `## Sessions (${studyPlan.length})`,
    "",
    "Tick a session here and it syncs back into the Sologurus progress chart.",
    "",
  ];

  for (const row of studyPlan) {
    lines.push(
      `- [ ] Day ${row.day} · ${text(row.dateLabel, 30)} · ${text(row.phase, 30)} — ${text(row.focus, 160)}`
      + ` _(${text(row.textbook, 60)} · ${text(row.practice, 60)} · ${row.durationMinutes} min)_ ${DAY_MARKER(row.day)}`,
    );
  }

  lines.push("", "---", "Created by Sologurus through the TrueFoundry MCP Gateway. Recheck exam dates and venues at the official source before booking.");
  return lines.join("\n");
}

/**
 * Pull the created page's URL or id out of whatever prose the MCP server
 * returns, so progress can be read back later without asking the learner to
 * copy a link.
 */
export function extractNotionPageRef(output) {
  const body = String(output ?? "");
  const url = body.match(/https:\/\/(?:www\.)?notion\.(?:so|site)\/\S*[\w-]/)?.[0];
  if (url) return url.replace(/[).,]+$/, "");
  const uuid = body.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
  if (uuid) return uuid;
  return body.match(/\b[0-9a-f]{32}\b/i)?.[0] ?? "";
}

/** Read ticked sessions out of the markdown `notion-fetch` returns. */
export function parseCompletedDays(markdown) {
  const days = new Set();
  for (const line of String(markdown ?? "").split(/\r?\n/)) {
    if (!/^\s*[-*]\s*\[\s*[xX]\s*\]/.test(line)) continue;
    const day = Number(line.match(/\[Sologurus day (\d+)\]/)?.[1]);
    if (Number.isFinite(day) && day > 0) days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

export const GOVERNED_ACTIONS = [
  {
    id: "notion-study-plan",
    label: "Create the study-plan page",
    server: NOTION_SERVER,
    tool: "notion-create-pages",
    description: "Write the dated plan into Notion as a page of checkbox sessions.",
    returns: "page-ref",
    build: (input, options = {}) => ({
      pages: [{
        properties: { title: `${text(input.profile?.language, 30)} study plan · ${text(input.plan?.name, 40)}` },
        content: studyPlanMarkdown(input),
        icon: "📘",
      }],
      ...(options.notionParent ? { parent: { type: "page_id", page_id: options.notionParent } } : {}),
    }),
  },
  {
    id: "notion-plan-progress",
    label: "Read progress back from Notion",
    server: NOTION_SERVER,
    tool: "notion-fetch",
    description: "Fetch the plan page and sync its ticked sessions into the progress chart.",
    returns: "completed-days",
    needsPageRef: true,
    build: (input) => ({ id: text(input.pageRef, 400) }),
  },
  {
    id: "notion-find-workspace",
    label: "Find where the plan should live",
    server: NOTION_SERVER,
    tool: "notion-search",
    description: "Search the connected workspace for an existing study-plan parent page.",
    returns: "text",
    build: (input) => ({
      query: `${text(input.profile?.language, 30)} study plan`,
      query_type: "internal",
    }),
  },
];

export function findAction(actionId) {
  return GOVERNED_ACTIONS.find((action) => action.id === actionId) ?? null;
}

/** Actions declared for a server, so the UI can show intent rather than tool names. */
export function actionsForServer(serverLabel) {
  return GOVERNED_ACTIONS.filter((action) => action.server === serverLabel);
}

export function describeActions() {
  return GOVERNED_ACTIONS.map(({ id, label, server, tool, description, returns, needsPageRef }) => ({
    id, label, server, tool, description, returns, needsPageRef: Boolean(needsPageRef),
  }));
}
