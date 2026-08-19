import test from "node:test";
import assert from "node:assert/strict";
import en from "../../src/i18n/locales/en.js";
import ar from "../../src/i18n/locales/ar.js";

function flatten(value, prefix = "", result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, path, result);
    } else {
      result.set(path, child);
    }
  }
  return result;
}

test("English and Arabic resources have identical non-empty string leaves", () => {
  const english = flatten(en);
  const arabic = flatten(ar);
  assert.deepEqual([...arabic.keys()].sort(), [...english.keys()].sort());
  for (const [key, value] of [...english, ...arabic]) {
    assert.equal(typeof value, "string", key);
    assert.notEqual(value.trim(), "", key);
  }
});
