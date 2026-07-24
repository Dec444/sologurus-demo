import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("community-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function search(params) {
  const query = new URLSearchParams(params);
  return worker.fetch(new Request(`http://localhost/api/community?${query}`), env, ctx);
}

test("community finder filters opt-in profiles by language, location, and miles", async () => {
  const fiveMileResponse = await search({ language: "English", location: "Ho Chi Minh City, Vietnam", radius: "5" });
  assert.equal(fiveMileResponse.status, 200);
  assert.match(fiveMileResponse.headers.get("cache-control") ?? "", /no-store/);
  const fiveMile = await fiveMileResponse.json();
  assert.equal(fiveMile.directoryMode, "privacy-safe-demo-directory");
  assert.equal(fiveMile.matches.length, 2);
  assert.ok(fiveMile.matches.every((learner) => learner.language === "English" && learner.distanceMiles <= 5));
  assert.ok(fiveMile.matches.every((learner) => !("address" in learner)), "never expose exact addresses");

  const widerResponse = await search({ language: "English", location: "Ho Chi Minh City, Vietnam", radius: "25" });
  const wider = await widerResponse.json();
  assert.equal(wider.matches.length, 4);
  assert.ok(wider.discoveryLinks.every((link) => /^https:\/\//.test(link.url)));
});

test("community finder requires a language and location", async () => {
  const response = await search({ language: "English" });
  assert.equal(response.status, 400);
});
