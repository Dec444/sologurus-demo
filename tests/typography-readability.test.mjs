import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function fontSizeFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  return Number(block.match(/font-size:\s*(\d+)px/)?.[1] ?? 0);
}

test("body copy stays readable in the dense interface", () => {
  const minimums = new Map([
    ["body", 16],
    [".hero>p", 18],
    [".step b", 14],
    [".step small", 12],
    [".plan-card p", 13],
    [".schedule p", 13],
    [".resource-heading>p", 13],
    [".center-card address", 12],
    [".center-card p", 12],
    [".resource-list p,.material-grid p", 12],
    [".success p,.integration-error p", 12],
    [".schema-card", 13],
  ]);

  for (const [selector, minimum] of minimums) {
    assert.ok(fontSizeFor(selector) >= minimum, `${selector} should be at least ${minimum}px`);
  }
});
