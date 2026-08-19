import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLanguage,
  getDirection,
  getFormattingLocale,
  normalizeLanguage,
  persistLanguage,
  readStoredLanguage,
} from "../../src/i18n/language.js";

test("normalizes only supported language codes", () => {
  assert.equal(normalizeLanguage("ar-EG"), "ar");
  assert.equal(normalizeLanguage("EN-us"), "en");
  assert.equal(normalizeLanguage("fr"), null);
  assert.equal(normalizeLanguage(null), null);
});

test("stored language wins and Arabic browser preference is detected", () => {
  assert.equal(
    detectLanguage({ storedLanguage: "en", browserLanguages: ["ar-EG"] }),
    "en"
  );
  assert.equal(
    detectLanguage({ storedLanguage: null, browserLanguages: ["ar-EG", "en"] }),
    "ar"
  );
  assert.equal(
    detectLanguage({ storedLanguage: null, browserLanguages: ["fr-FR"] }),
    "en"
  );
});

test("uses only the primary browser language when no choice is stored", () => {
  assert.equal(
    detectLanguage({ storedLanguage: null, browserLanguages: ["fr-FR", "ar-EG"] }),
    "en"
  );
});

test("direction and formatting locale match the resolved language", () => {
  assert.equal(getDirection("ar"), "rtl");
  assert.equal(getDirection("en"), "ltr");
  assert.equal(getFormattingLocale("ar"), "ar-EG");
  assert.equal(getFormattingLocale("en"), "en");
});

test("storage failures do not break language selection", () => {
  const blockedStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  assert.equal(readStoredLanguage(blockedStorage), null);
  assert.equal(persistLanguage(blockedStorage, "ar"), false);
});
