import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const languagesUrl = new URL("../data/languages.json", import.meta.url);
const catalogUrl = new URL("../data/language-resources.json", import.meta.url);
const communitiesUrl = new URL("../data/language-communities.json", import.meta.url);
const mediaAndExamsUrl = new URL("../data/language-media-exams.json", import.meta.url);
const textbooksUrl = new URL("../data/language-textbooks.json", import.meta.url);
const locationsUrl = new URL("../data/locations.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("every selectable language has verified, actionable resources", async () => {
  const languages = JSON.parse(await readFile(languagesUrl, "utf8"));
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  const communities = JSON.parse(await readFile(communitiesUrl, "utf8"));
  const mediaAndExams = JSON.parse(await readFile(mediaAndExamsUrl, "utf8"));
  const textbooks = JSON.parse(await readFile(textbooksUrl, "utf8"));

  for (const { name } of languages) {
    const entry = catalog[name];
    assert.ok(entry, `${name} needs its own resource catalog`);
    assert.ok(entry.tests.length >= 1, `${name} needs a recognized test`);
    assert.match(entry.centerFinder.url, /^https:\/\//, `${name} needs an official test-center finder`);
    const educators = [...entry.youtube, ...communities[name].youtube];
    assert.equal(educators.length, 10, `${name} needs exactly ten educators`);
    assert.equal(new Set(educators.map((item) => item.name)).size, 10, `${name} needs ten distinct educators`);
    assert.equal(communities[name].forums.length, 3, `${name} needs exactly three study forums`);
    for (const forum of communities[name].forums) {
      assert.match(forum.url, /^https:\/\//, `${forum.name} needs a live URL`);
    }

    for (const skill of ["listening", "speaking", "reading", "writing"]) {
      assert.ok(entry.materials[skill].length >= 2, `${name} needs ${skill} materials`);
      for (const resource of entry.materials[skill]) {
        assert.match(resource.url, /^https:\/\//, `${resource.name} needs a live URL`);
      }
    }

    assert.equal(mediaAndExams[name].tvShows.length, 10, `${name} needs exactly ten TV shows`);
    assert.equal(new Set(mediaAndExams[name].tvShows.map((show) => show.name)).size, 10, `${name} needs ten distinct TV shows`);
    assert.equal(mediaAndExams[name].mockExams.length, 3, `${name} needs exactly three mock-exam platforms`);
    for (const mock of mediaAndExams[name].mockExams) {
      assert.match(mock.url, /^https:\/\//, `${mock.name} needs a live URL`);
    }
    assert.equal(textbooks[name].length, 3, `${name} needs exactly three textbook recommendations`);
    assert.equal(new Set(textbooks[name].map((book) => book.name)).size, 3, `${name} needs three distinct textbooks`);
    for (const book of textbooks[name]) {
      assert.match(book.url, /^https:\/\//, `${book.name} needs a live source URL`);
      assert.ok(book.authorPublisher, `${book.name} needs author or publisher attribution`);
    }
  }
});

test("country and city are dependent menus in country-first order", async () => {
  const locations = JSON.parse(await readFile(locationsUrl, "utf8"));
  const page = await readFile(pageUrl, "utf8");

  assert.ok(Object.keys(locations).length >= 16, "offer broad country coverage");
  for (const [country, cities] of Object.entries(locations)) {
    assert.ok(cities.length >= 2, `${country} needs multiple city choices`);
  }
  assert.match(page, /<label>Country<select/, "country must be a select menu");
  assert.match(page, /<label>City<select/, "city must be a select menu");
  assert.ok(page.indexOf("<label>Country<select") < page.indexOf("<label>City<select"), "country must appear before city");
});

test("the plan reaches Notion as a governed action, not a static fallback", async () => {
  const page = await readFile(pageUrl, "utf8");
  const actions = await readFile(new URL("../lib/truefoundry/mcp-actions.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(page, /window\.open\(notionDatabaseUrl/, "a static Notion link cannot represent the selected plan");
  assert.match(page, /action: actionId, profile, plan: selectedPlan, feasibility, studyPlan/, "the selected research and dated plan reach the action");
  assert.match(page, /action: "notion-plan-progress"/, "progress is read back through the same broker");

  // The page body the learner ends up with, built server-side from the catalog.
  const { studyPlanMarkdown, parseCompletedDays } = await import("../lib/truefoundry/mcp-actions.mjs");
  const markdown = studyPlanMarkdown({
    profile: { language: "English", level: "B1", goal: "IELTS 7.0", date: "2026-12-05" },
    plan: { name: "Balanced Four-Skill", tagline: "Progress evenly." },
    feasibility: { title: "Tight.", advice: "Keep a buffer day.", weeklyHours: 9 },
    studyPlan: [
      { day: 1, dateLabel: "13 Nov 2026", phase: "Foundation", focus: "Listening", textbook: "Book", practice: "BBC", durationMinutes: 90 },
      { day: 2, dateLabel: "14 Nov 2026", phase: "Foundation", focus: "Speaking", textbook: "Book", practice: "BBC", durationMinutes: 90 },
    ],
  });
  assert.match(markdown, /## Strategy: Balanced Four-Skill/);
  assert.match(markdown, /## Feasibility/);
  assert.match(markdown, /## Sessions \(2\)/);
  assert.match(markdown, /- \[ \] Day 1 · 13 Nov 2026 · Foundation/, "sessions are checkboxes");
  assert.match(markdown, /\[Sologurus day 1\]/, "each session carries a machine-readable marker");

  // Tick one box in Notion and the marker is what survives the round trip.
  const returned = markdown.replace("- [ ] Day 2", "- [x] Day 2");
  assert.deepEqual(parseCompletedDays(returned), [2], "only ticked sessions come back");

  assert.match(actions, /notion-create-pages/, "the write is a declared action");
  assert.match(actions, /notion-fetch/, "the read is a declared action");
});

test("the client reloads research when language or location changes", async () => {
  const page = await readFile(pageUrl, "utf8");
  const resourceRoute = await readFile(new URL("../app/api/resources/route.ts", import.meta.url), "utf8");

  assert.doesNotMatch(page, /demo-resources\.json/, "must not pin every learner to English resources");
  assert.match(page, /fetch\(`\/api\/resources\?/, "must request the selected catalog from the server");
  assert.match(page, /profile\.language/, "language must be part of the request");
  assert.match(page, /profile\.city/, "city must be part of the request");
  assert.match(page, /profile\.country/, "country must be part of the request");
  assert.match(page, /cache: "no-store"/, "client must not reuse a prior resource schema");
  assert.match(resourceRoute, /Cache-Control": "no-store/, "server must not cache stale language schemas");

  // The catalog builder is shared with the governed agent route, so the browser
  // and the model always reason over the same records.
  assert.match(resourceRoute, /buildResourceCatalog/, "server must compose the shared language catalog");
  const catalogModule = await readFile(new URL("../lib/study/catalog.ts", import.meta.url), "utf8");
  assert.match(catalogModule, /language-media-exams\.json/, "server must load language-specific TV and mock-exam data");
  assert.match(catalogModule, /language-textbooks\.json/, "server must load language-specific textbooks");
  const agentRoute = await readFile(new URL("../app/api/agent/route.ts", import.meta.url), "utf8");
  assert.match(agentRoute, /buildResourceCatalog/, "the planning layer must read the same catalog the browser sees");
});

test("all research is visible in five separately headed sections without a shared tab panel", async () => {
  const page = await readFile(pageUrl, "utf8");
  const sectionTitles = [
    "Tests &amp; centres",
    "YouTube, forums &amp; TV shows",
    "Reading, speaking, listening &amp; writing",
    "Textbook recommendations",
    "Mock exams",
  ];

  let previousPosition = -1;
  for (const title of sectionTitles) {
    const position = page.indexOf(title);
    assert.ok(position > previousPosition, `${title} must appear in the requested section order`);
    previousPosition = position;
  }

  assert.doesNotMatch(page, /role="tablist"/, "research groups should not hide behind a tab list");
  assert.doesNotMatch(page, /resourceTab|setResourceTab/, "research groups should remain visible together");
  assert.equal((page.match(/className="research-group"/g) ?? []).length, 5, "render exactly five top-level research groups");
  assert.equal((page.match(/className="research-section-heading"/g) ?? []).length, 5, "place every research title outside its black content card");
  assert.equal((page.match(/className="research-section"/g) ?? []).length, 5, "render exactly five black content cards");
});

test("the learner journey uses five page-like views instead of a stretching side panel", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /<nav className="steps" aria-label="Study-system pages">/, "use a compact page navigator");
  assert.doesNotMatch(page, /<aside className="steps">/, "the progress control must not be a full-height sidebar");
  assert.match(page, /stage === "profile"/, "learning goal needs its own view");
  assert.match(page, /stage === "running" && resourceData/, "agent research needs its own view");
  assert.match(page, /stage === "plans" && resourceData/, "strategy selection needs its own view");
  assert.match(page, /stage === "exported" && resourceData/, "start studying needs its own view");
  assert.match(page, /stage === "progress" && resourceData/, "progress tracking needs its own view");
  assert.match(page, /"daily", "weekly", "monthly"/, "progress chart needs daily, weekly, and monthly views");
  assert.equal((page.match(/className="resource-explorer"/g) ?? []).length, 1, "research should live on one page only");
  assert.equal((page.match(/className="export-row"/g) ?? []).length, 1, "integrations should live on the start-study page only");
});
