import test from "node:test";
import assert from "node:assert/strict";

test("i18n startup survives a throwing localStorage getter", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.defineProperty({}, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage access blocked");
      },
    }),
  });

  try {
    const module = await import(`../../src/i18n/index.js?blocked=${Date.now()}`);
    assert.equal(module.default.resolvedLanguage, "en");
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete globalThis.window;
    }
  }
});
