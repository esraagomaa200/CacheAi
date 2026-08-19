# Task 3: Public authentication and signup translation

## Scope

- Added matching `auth`, `signup`, and `errors` translation resources in English and Arabic.
- Localized Login, SignUp, the signup sidebar/form, and EmergencyAuth; each standalone public page now uses `AppearanceControls`.
- Frontend validation and API outcomes now store localized message keys. Original API errors are retained in console diagnostics only; unrecognized backend details never reach the UI.
- Preserved the signup form's submitted chronic-disease values while rendering their labels from locale keys.

## RED evidence

Command:

```powershell
npm.cmd run test:e2e -- tests-e2e/language.spec.js --grep "public forms"
```

Result: failed as expected at `getByRole('heading', { name: 'مرحبًا بعودتك' })` because the login page still rendered hard-coded English text.

## GREEN evidence

```text
npm.cmd run test:i18n                                      6 passed, 0 failed
npm.cmd run test:e2e -- tests-e2e/language.spec.js         3 passed
npm.cmd run lint                                           exit 0
npm.cmd run build                                          exit 0
```

## Self-review

- Resource parity covers every added key and rejects empty leaves.
- Arabic login text, manual switch to English, persisted choice, and LTR signup are covered by browser E2E.
- No authenticated chat, profile, or emergency-mode pages were changed.
