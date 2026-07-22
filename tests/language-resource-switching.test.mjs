import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const languagesUrl = new URL("../data/languages.json", import.meta.url);
const catalogUrl = new URL("../data/language-resources.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("every selectable language has verified, actionable resources", async () => {
  const languages = JSON.parse(await readFile(languagesUrl, "utf8"));
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));

  for (const { name } of languages) {
    const entry = catalog[name];
    assert.ok(entry, `${name} needs its own resource catalog`);
    assert.ok(entry.tests.length >= 1, `${name} needs a recognized test`);
    assert.match(entry.centerFinder.url, /^https:\/\//, `${name} needs an official test-center finder`);
    assert.ok(entry.youtube.length >= 3, `${name} needs recommended educators`);

    for (const skill of ["listening", "speaking", "reading", "writing"]) {
      assert.ok(entry.materials[skill].length >= 2, `${name} needs ${skill} materials`);
      for (const resource of entry.materials[skill]) {
        assert.match(resource.url, /^https:\/\//, `${resource.name} needs a live URL`);
      }
    }
  }
});

test("the client reloads research when language or location changes", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.doesNotMatch(page, /demo-resources\.json/, "must not pin every learner to English resources");
  assert.match(page, /fetch\(`\/api\/resources\?/, "must request the selected catalog from the server");
  assert.match(page, /profile\.language/, "language must be part of the request");
  assert.match(page, /profile\.city/, "city must be part of the request");
  assert.match(page, /profile\.country/, "country must be part of the request");
});
