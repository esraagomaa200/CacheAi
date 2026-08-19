const API_ERROR_KEYS = Object.freeze({
  "Incorrect email or password": "errors.invalidCredentials",
  "Email already registered": "errors.duplicateEmail",
  "Email already exists": "errors.duplicateEmail",
  "Email or patient ID already exists": "errors.registrationConflict",
  "An account with this email already exists. Please use password login.":
    "errors.duplicateEmail",
});

export function getApiErrorKey(message) {
  return typeof message === "string" && Object.hasOwn(API_ERROR_KEYS, message)
    ? API_ERROR_KEYS[message]
    : "errors.generic";
}
