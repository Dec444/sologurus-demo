import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Sologurus demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Sologurus — Your self-directed study agent<\/title>/i);
  assert.match(html, /Better direction\./);
  assert.match(html, /Smarter study\./);
  assert.match(html, /Build my study system/);
  assert.match(html, /github\.com\/Dec444\/sologurus-demo/);
  assert.match(html, /TrueFoundry/, "the platform the app connects to is named up front");
  assert.match(html, /Community/);
  assert.doesNotMatch(html, /notion\.so|calendar\.google\.com/, "no vendor account links in the shell — connections live in the TrueFoundry console");
  assert.match(html, /A learning plan designed around/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
