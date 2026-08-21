import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("target-language catalog offers broad learner choice", async () => {
  const languages = JSON.parse(await readFile(new URL("../data/languages.json", import.meta.url), "utf8"));
  assert.ok(languages.length >= 12, "offer at least twelve target languages");
  for (const language of ["English", "Spanish", "French", "German", "Japanese", "Korean", "Mandarin Chinese", "Arabic"]) {
    assert.ok(languages.some((entry) => entry.name === language), `missing ${language}`);
  }
});

test("Notion is reachable only through the MCP Gateway, never with a token of our own", async () => {
  // The whole claim of this integration is that a leak of this application's
  // environment cannot reach a learner's Notion workspace. That only holds if
  // no code path anywhere talks to Notion directly.
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const offenders = [];
  for (const root of ["app", "lib", "worker"]) {
    for (const relative of await readdir(join(projectRoot, root), { recursive: true })) {
      if (!/\.(ts|tsx|mjs)$/.test(relative)) continue;
      const absolute = join(projectRoot, root, relative);
      if (!(await stat(absolute)).isFile()) continue;
      const source = await readFile(absolute, "utf8");
      if (/api\.notion\.com/.test(source)) offenders.push(`${root}/${relative} calls the Notion API directly`);
      if (/NOTION_TOKEN|NOTION_PARENT_PAGE_ID|NOTION_TARGET_PAGE_ID/.test(source)) offenders.push(`${root}/${relative} reads a Notion credential`);
    }
  }
  assert.deepEqual(offenders, [], "Notion must be reached only through the MCP Gateway");

  await assert.rejects(access(new URL("../app/api/notion/route.ts", import.meta.url)), "the direct Notion route must be gone");

  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.doesNotMatch(env, /^NOTION_TOKEN=/m, "no Notion token is configurable");
  assert.match(env, /TFY_MCP_ALLOWED_TOOLS/, "the skills allowlist is the way in");

  const actions = await readFile(new URL("../lib/truefoundry/mcp-actions.mjs", import.meta.url), "utf8");
  assert.match(actions, /notion-create-pages/, "writing the plan is a real Notion MCP tool");
  assert.match(actions, /notion-fetch/, "reading progress back is a real Notion MCP tool");
});

test("calendar export produces a timezone-aware four-week schedule", async () => {
  const { makeCalendarIcs } = await import("../lib/study/calendar.mjs");
  const ics = makeCalendarIcs(
    { goal: "IELTS 7.0", date: "2026-12-05", hours: 8, timezone: "Asia/Ho_Chi_Minh" },
    { id: "balanced", name: "Balanced", sample: ["25 min · Listening", "20 min · Speaking", "15 min · Writing"] },
  );
  assert.match(ics, /X-WR-TIMEZONE:Asia\/Ho_Chi_Minh/);
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 15, "twelve study sessions plus three daily reminders");
  const calendarRoute = await readFile(new URL("../app/api/calendar/route.ts", import.meta.url), "utf8");
  assert.match(calendarRoute, /GOOGLE_CALENDAR_EVENT_URL/);
});

test("the homepage exposes the project, the platform connection, and community at the top", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /https:\/\/github\.com\/Dec444\/sologurus-demo/);

  // One connection, not a row of vendor logins: models and MCP servers are
  // added in the operator's own TrueFoundry console, not wired in here.
  assert.match(page, /id="connection-panel"/, "the TrueFoundry connection has its own panel");
  assert.match(page, /connection-toggle/, "a single chip opens it");
  assert.match(page, /console\.models/, "the panel links out to add models");
  assert.match(page, /console\.mcpServers/, "the panel links out to add MCP servers");
  assert.doesNotMatch(page, /https:\/\/www\.notion\.so\//, "no Notion sign-in link belongs in the shell");
  assert.doesNotMatch(page, /https:\/\/calendar\.google\.com/, "no Google sign-in link belongs in the shell");

  assert.match(page, /id="community-finder"/);
  assert.match(page, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(page, /\/api\/community\/location/);
  assert.match(page, /Within 5 miles/);
  assert.match(page, /Within 100 miles/);
  assert.match(page, /fetch\(`\/api\/community\?/);
});
