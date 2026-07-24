import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("target-language catalog offers broad learner choice", async () => {
  const languages = JSON.parse(await readFile(new URL("../data/languages.json", import.meta.url), "utf8"));
  assert.ok(languages.length >= 12, "offer at least twelve target languages");
  for (const language of ["English", "Spanish", "French", "German", "Japanese", "Korean", "Mandarin Chinese", "Arabic"]) {
    assert.ok(languages.some((entry) => entry.name === language), `missing ${language}`);
  }
});

test("Notion export is a real API route, not a preview-only state change", async () => {
  const routeUrl = new URL("../app/api/notion/route.ts", import.meta.url);
  await access(routeUrl);
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /api\.notion\.com\/v1\/pages/);
  assert.match(route, /NOTION_TOKEN/);
  assert.match(route, /NOTION_PARENT_PAGE_ID/);
  assert.match(route, /NOTION_TARGET_PAGE_ID/);
  assert.match(route, /method: "PATCH"/);
  assert.match(route, /2026-03-11/);
});

test("calendar export produces a timezone-aware four-week schedule", async () => {
  const { makeCalendarIcs } = await import("../lib/calendar.mjs");
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

test("the homepage exposes project, account, and community access at the top", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /https:\/\/github\.com\/Dec444\/sologurus-demo/);
  assert.match(page, /https:\/\/www\.notion\.so\//);
  assert.match(page, /https:\/\/calendar\.google\.com\/calendar\/u\/0\/r/);
  assert.match(page, /id="community-finder"/);
  assert.match(page, /Within 5 miles/);
  assert.match(page, /Within 100 miles/);
  assert.match(page, /fetch\(`\/api\/community\?/);
});
