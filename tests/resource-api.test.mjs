import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("resource-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("the live resource endpoint switches TV shows and mock exams with every language", async () => {
  const languages = JSON.parse(await readFile(new URL("../data/languages.json", import.meta.url), "utf8"));
  const firstShows = new Set();
  const firstMocks = new Set();

  for (const { name } of languages) {
    const query = new URLSearchParams({ language: name, city: "Madrid", country: "Spain" });
    const response = await worker.fetch(new Request(`http://localhost/api/resources?${query}`), env, ctx);
    assert.equal(response.status, 200, `${name} resource request should succeed`);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/, `${name} resources must not be cached`);
    const data = await response.json();
    assert.equal(data.language, name);
    assert.equal(data.tvShows.length, 10, `${name} must return ten TV shows`);
    assert.equal(data.mockExams.length, 3, `${name} must return three mock-exam platforms`);
    assert.ok(data.tvShows.every((show) => /^https:\/\//.test(show.url)), `${name} TV shows need live guide links`);
    assert.ok(data.mockExams.every((mock) => /^https:\/\//.test(mock.url)), `${name} mock exams need live links`);
    firstShows.add(data.tvShows[0].name);
    firstMocks.add(data.mockExams[0].name);
  }

  assert.equal(firstShows.size, languages.length, "each language should lead with a different TV recommendation");
  assert.equal(firstMocks.size, languages.length, "each language should lead with a different mock-exam recommendation");
});
