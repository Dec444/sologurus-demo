import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("../data/demo-resources.json", import.meta.url);

test("the learner can inspect complete test, guidance, and four-skill results", async () => {
  const data = JSON.parse(await readFile(fixtureUrl, "utf8"));

  assert.ok(data.tests.length >= 3, "show recognized English tests");
  assert.ok(data.testCenters.length >= 2, "show local test centers");
  for (const center of data.testCenters) {
    assert.ok(center.address, `${center.name} needs an address`);
    assert.match(center.registrationUrl, /^https:\/\//, `${center.name} needs a registration URL`);
  }

  assert.ok(data.youtube.length >= 10, "show ten recommended YouTube channels");
  for (const channel of data.youtube) {
    assert.match(channel.url, /^https:\/\//, `${channel.name} needs a URL`);
    assert.ok(channel.bestFor, `${channel.name} needs a learner-fit rationale`);
  }

  for (const skill of ["listening", "speaking", "reading", "writing"]) {
    assert.ok(data.materials[skill].length >= 5, `show five ${skill} materials`);
    for (const resource of data.materials[skill]) {
      assert.match(resource.url, /^https:\/\//, `${resource.name} needs a URL`);
      assert.ok(resource.cost, `${resource.name} needs cost information`);
    }
  }
});
