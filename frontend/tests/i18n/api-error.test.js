import test from "node:test";
import assert from "node:assert/strict";
import { getApiErrorKey } from "../../src/i18n/api-error.js";

test("maps every known API error and hides unknown server detail", () => {
  const knownMappings = [
    ["Incorrect email or password", "errors.invalidCredentials"],
    ["Email already registered", "errors.duplicateEmail"],
    ["Email already exists", "errors.duplicateEmail"],
    [
      "Email or patient ID already exists",
      "errors.registrationConflict",
    ],
    [
      "An account with this email already exists. Please use password login.",
      "errors.duplicateEmail",
    ],
  ];

  for (const [message, expectedKey] of knownMappings) {
    assert.equal(getApiErrorKey(message), expectedKey, message);
  }
  assert.equal(getApiErrorKey("database host leaked"), "errors.generic");
  assert.equal(getApiErrorKey("constructor"), "errors.generic");
});
