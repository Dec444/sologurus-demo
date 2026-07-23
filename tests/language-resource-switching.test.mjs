import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const languagesUrl = new URL("../data/languages.json", import.meta.url);
const catalogUrl = new URL("../data/language-resources.json", import.meta.url);
const communitiesUrl = new URL("../data/language-communities.json", import.meta.url);
const mediaAndExamsUrl = new URL("../data/language-media-exams.json", import.meta.url);
const locationsUrl = new URL("../data/locations.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const notionRouteUrl = new URL("../app/api/notion/route.ts", import.meta.url);

test("every selectable language has verified, actionable resources", async () => {
  const languages = JSON.parse(await readFile(languagesUrl, "utf8"));
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  const communities = JSON.parse(await readFile(communitiesUrl, "utf8"));
  const mediaAndExams = JSON.parse(await readFile(mediaAndExamsUrl, "utf8"));

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

test("Notion receives the selected research instead of opening a static fallback", async () => {
  const page = await readFile(pageUrl, "utf8");
  const notionRoute = await readFile(notionRouteUrl, "utf8");

  assert.doesNotMatch(page, /window\.open\(notionDatabaseUrl/, "a static Notion link cannot represent the selected plan");
  assert.match(page, /JSON\.stringify\(\{ profile, plan: selectedPlan, resources: resourceData \}\)/, "send the selected research to Notion");
  assert.match(notionRoute, /resources\?/, "accept the selected research payload");
  assert.match(notionRoute, /Recommended educators/, "write educators to the Notion page");
  assert.match(notionRoute, /Study forums/, "write forums to the Notion page");
  assert.match(notionRoute, /TV immersion watchlist/, "write TV recommendations to the Notion page");
  assert.match(notionRoute, /Mock exam platforms/, "write mock-exam platforms to the Notion page");
  assert.match(notionRoute, /Recognized tests and centre sources/, "write tests and centre sources to the Notion page");
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
  assert.match(resourceRoute, /language-media-exams\.json/, "server must load language-specific TV and mock-exam data");
});

test("all research is visible in four separate sections without a shared tab panel", async () => {
  const page = await readFile(pageUrl, "utf8");
  const sectionTitles = [
    "Tests &amp; centres",
    "YouTube, forums &amp; TV shows",
    "Reading, speaking, listening &amp; writing",
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
  assert.equal((page.match(/className="research-section"/g) ?? []).length, 4, "render exactly four top-level research sections");
});
