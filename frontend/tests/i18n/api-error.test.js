import test from "node:test";
import assert from "node:assert/strict";
import { getApiErrorKey } from "../../src/i18n/api-error.js";

test("maps known API errors and hides unknown server detail", () => {
  assert.equal(
    getApiErrorKey("Incorrect email or password"),
    "errors.invalidCredentials"
  );
  assert.equal(
    getApiErrorKey("Email already registered"),
    "errors.duplicateEmail"
  );
  assert.equal(getApiErrorKey("database host leaked"), "errors.generic");
  assert.equal(getApiErrorKey("constructor"), "errors.generic");
});
