# Bilingual Arabic/English UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete English/Arabic NajdaAI interface that follows the browser on first visit, persists manual selection, and renders Arabic as true RTL without changing assistant-response behavior.

**Architecture:** `i18next` and `react-i18next` load two bundled resource trees. Pure language helpers handle detection, persistence, direction, and formatting; reusable appearance controls combine language and theme switches; document-level language synchronization and a focused RTL CSS layer adapt the existing components.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, i18next, react-i18next, Node built-in test runner, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-08-19-bilingual-ui-design.md`

## Global Constraints

- Supported interface languages are exactly `en` and `ar`.
- A browser language beginning with `ar` selects Arabic on first visit; every other browser language selects English.
- Persist only manual selection under `najda-language`; invalid stored values are ignored.
- Arabic copy uses clear, simplified Modern Standard Arabic.
- Arabic sets `<html lang="ar" dir="rtl">`; English sets `<html lang="en" dir="ltr">`.
- Translate frontend-owned interface copy only; never translate user, assistant, source-title, email, name, or medical-value content.
- Do not change backend APIs, prompts, response-language behavior, or database schemas.
- Language and light/dark settings must remain independent in all four combinations.

---

### Task 1: Pure language selection contract

**Files:**
- Create: `frontend/tests/i18n/language.test.js`
- Create: `frontend/src/i18n/language.js`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Produces: `normalizeLanguage(value): "en" | "ar" | null`.
- Produces: `detectLanguage({ storedLanguage, browserLanguages }): "en" | "ar"`.
- Produces: `getDirection(language): "ltr" | "rtl"`.
- Produces: `getFormattingLocale(language): "en" | "ar-EG"`.
- Produces: `readStoredLanguage(storage): "en" | "ar" | null` and `persistLanguage(storage, language): boolean`.

- [ ] **Step 1: Add the Node test script and failing pure-behavior tests**

Add `"test:i18n": "node --test tests/i18n/*.test.js"` to `scripts`, then create:

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd run test:i18n`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/i18n/language.js`.

- [ ] **Step 3: Implement the pure helper module**

```js
export const LANGUAGE_STORAGE_KEY = "najda-language";

export function normalizeLanguage(value) {
  if (typeof value !== "string") return null;
  const primary = value.trim().toLowerCase().split("-")[0];
  return primary === "en" || primary === "ar" ? primary : null;
}

export function detectLanguage({ storedLanguage, browserLanguages = [] }) {
  const stored = normalizeLanguage(storedLanguage);
  if (stored) return stored;
  for (const candidate of browserLanguages) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return "en";
}

export const getDirection = (language) =>
  normalizeLanguage(language) === "ar" ? "rtl" : "ltr";

export const getFormattingLocale = (language) =>
  normalizeLanguage(language) === "ar" ? "ar-EG" : "en";

export function readStoredLanguage(storage) {
  try { return normalizeLanguage(storage.getItem(LANGUAGE_STORAGE_KEY)); }
  catch { return null; }
}

export function persistLanguage(storage, language) {
  const normalized = normalizeLanguage(language);
  if (!normalized) return false;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Install localization dependencies and verify GREEN**

Run: `npm.cmd install i18next react-i18next`

Run: `npm.cmd run test:i18n`

Expected: 4 tests PASS and `package-lock.json` pins the installed dependency graph.

- [ ] **Step 5: Commit the language core**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/i18n/language.js frontend/tests/i18n/language.test.js
git commit -m "test: define interface language selection"
```

### Task 2: Resources, initialization, and home language switch

**Files:**
- Create: `frontend/tests/i18n/resources.test.js`
- Create: `frontend/tests-e2e/language.spec.js`
- Create: `frontend/src/i18n/locales/en.js`
- Create: `frontend/src/i18n/locales/ar.js`
- Create: `frontend/src/i18n/index.js`
- Create: `frontend/src/components/LanguageSync.jsx`
- Create: `frontend/src/components/LanguageToggle.jsx`
- Create: `frontend/src/components/AppearanceControls.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/components/Header.jsx`
- Modify: `frontend/src/components/Hero.jsx`
- Modify: `frontend/src/components/Boxes.jsx`

**Interfaces:**
- Consumes: all helpers from Task 1 and the existing `ThemeToggle`.
- Produces: configured default export `i18n` with bundled `translation` resources.
- Produces: `LanguageToggle({ compact?: boolean })` and `AppearanceControls({ compact?: boolean, className?: string })`.
- Produces: initial browser-locale and manual-persistence E2E contracts.

- [ ] **Step 1: Write failing resource-parity and Arabic-browser E2E tests**

Resource test:

```js
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
```

Initial E2E contract:

```js
import { test, expect } from "@playwright/test";

test.describe("Arabic browser language", () => {
  test.use({ locale: "ar-EG" });

  test("starts in Arabic without persisting automatic detection", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "رعاية صحية ذكية، في أي وقت وأي مكان" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("najda-language"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `npm.cmd run test:i18n`

Expected: FAIL because `locales/en.js` and `locales/ar.js` do not exist.

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js`

Expected: FAIL because `<html>` remains `lang="en"`, has no RTL direction, and the heading is English.

- [ ] **Step 3: Add matching base resources and initialize i18next before React**

Create matching `common`, `navigation`, `home`, and `appearance` objects. The required visible values include:

```js
// en.js
home: {
  badge: "Your AI Health Assistant",
  title: "Smart Healthcare, Anytime, Anywhere",
  startChatting: "Start Chatting",
  emergency: "Emergency",
},
appearance: {
  switchToArabic: "Switch to Arabic",
  switchToEnglish: "Switch to English",
  arabic: "عربي",
  english: "EN",
},
```

```js
// ar.js
home: {
  badge: "مساعدك الصحي بالذكاء الاصطناعي",
  title: "رعاية صحية ذكية، في أي وقت وأي مكان",
  startChatting: "ابدأ المحادثة",
  emergency: "الطوارئ",
},
appearance: {
  switchToArabic: "التبديل إلى العربية",
  switchToEnglish: "التبديل إلى الإنجليزية",
  arabic: "عربي",
  english: "EN",
},
```

Both files define all four appearance leaves—`switchToArabic`, `switchToEnglish`, `arabic`, and `english`—so the resource trees remain identical. Initialize with `fallbackLng: "en"`, `supportedLngs: ["en", "ar"]`, `load: "languageOnly"`, `interpolation.escapeValue: false`, and the language returned by `detectLanguage()`.

- [ ] **Step 4: Add document synchronization and combined appearance controls**

`LanguageSync` sets document `lang` and `dir` synchronously for the initial language and listens to `i18n.on("languageChanged", handler)` with cleanup. `LanguageToggle` persists the alternate language and calls `i18n.changeLanguage(next)`. `AppearanceControls` renders both language and theme controls with one regular/compact layout.

In `main.jsx`, import `./i18n/index.js` before rendering and mount `<LanguageSync />` inside `ThemeProvider`. Replace the header's direct `ThemeToggle` with `AppearanceControls`.

- [ ] **Step 5: Migrate home copy and verify GREEN**

Use `useTranslation()` in `Header`, `Hero`, and `Boxes`. Store feature entries as translation-key suffixes (`answers`, `voice`, `privacy`) and resolve their titles/descriptions with `t()` during render.

Run: `npm.cmd run test:i18n`

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js`

Expected: resource parity PASS and the Arabic browser test PASS.

- [ ] **Step 6: Commit the localization foundation**

```powershell
git add frontend/src/i18n frontend/src/components frontend/src/main.jsx frontend/tests/i18n frontend/tests-e2e/language.spec.js
git commit -m "feat: add Arabic English localization foundation"
```

### Task 3: Public authentication and signup translation

**Files:**
- Modify: `frontend/tests-e2e/language.spec.js`
- Modify: `frontend/src/i18n/locales/en.js`
- Modify: `frontend/src/i18n/locales/ar.js`
- Modify: `frontend/src/components/SidebarSignup.jsx`
- Modify: `frontend/src/components/SignupFormFields.jsx`
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/pages/SignUp.jsx`
- Modify: `frontend/src/pages/EmergencyAuth.jsx`

**Interfaces:**
- Consumes: `AppearanceControls`, `useTranslation()`, and matching locale resources.
- Produces: translated login, signup, Google authentication, frontend validation, and public-page controls.

- [ ] **Step 1: Add failing Arabic public-flow assertions**

Extend the Arabic-locale describe:

```js
test("translates public forms and persists a manual English choice", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "مرحبًا بعودتك" })).toBeVisible();
  await expect(page.getByPlaceholder("أدخل بريدك الإلكتروني")).toBeVisible();

  await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("najda-language"))).toBe("en");

  await page.reload();
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create Your Account" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js --grep "public forms"`

Expected: FAIL because login/signup text is still hard-coded English and standalone pages still render only `ThemeToggle`.

- [ ] **Step 3: Add exact public/auth resource domains**

Add matching keys for:

- `auth`: welcome, instructions, email/password labels and placeholders, show/hide password, sign-in states, Google divider, signup link, privacy note, emergency-auth title/instructions/loading/identity note.
- `signup`: page title/instructions; personal, medical, and emergency sections; all field labels/placeholders/options; six chronic-disease labels; terms text; submit states; validation errors; sidebar headline, description, and three benefit cards.
- `errors`: required email/password/name/terms, invalid credentials, duplicate email, Google failure, registration failure, and generic failure.

Preserve every current English string as its English value. Use clear Arabic values including `مرحبًا بعودتك`, `أدخل بريدك الإلكتروني`, `إنشاء حسابك`, `المعلومات الشخصية`, `المعلومات الطبية`, and `جهة اتصال الطوارئ`.

- [ ] **Step 4: Replace public-page literals and control placement**

Use `useTranslation()` in all listed components. Replace `ThemeToggle` with compact `AppearanceControls` in `Login`, `SignUp`, and `EmergencyAuth`. Lists such as chronic diseases and blood types keep stable IDs/values while labels come from keys. Frontend validation stores error keys, not translated strings, so changing language re-renders existing errors immediately.

- [ ] **Step 5: Verify resource parity and public E2E GREEN**

Run: `npm.cmd run test:i18n`

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js`

Expected: parity and public language/persistence cases PASS.

- [ ] **Step 6: Commit public translation**

```powershell
git add frontend/src frontend/tests-e2e/language.spec.js
git commit -m "feat: translate public and authentication flows"
```

### Task 4: Authenticated chat, profile, and emergency translation

**Files:**
- Create: `frontend/src/i18n/api-error.js`
- Create: `frontend/tests/i18n/api-error.test.js`
- Modify: `frontend/tests-e2e/language.spec.js`
- Modify: `frontend/src/i18n/locales/en.js`
- Modify: `frontend/src/i18n/locales/ar.js`
- Modify: `frontend/src/components/SideBar.jsx`
- Modify: `frontend/src/components/SidebarProfile.jsx`
- Modify: `frontend/src/pages/Chat.jsx`
- Modify: `frontend/src/pages/Profile.jsx`
- Modify: `frontend/src/pages/EditProfile.jsx`
- Modify: `frontend/src/pages/EmergencyMode.jsx`
- Modify: `frontend/src/pages/EmergencyHistory.jsx`
- Modify: `frontend/src/pages/About.jsx`

**Interfaces:**
- Consumes: `AppearanceControls`, language resources, `getFormattingLocale()`, and existing API helpers.
- Produces: `getApiErrorKey(message): string` returning a known `errors.*` key or `errors.generic`.
- Produces: translated authenticated layout while dynamic content remains unchanged and `dir="auto"`.

- [ ] **Step 1: Add failing error-map and authenticated Arabic E2E tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getApiErrorKey } from "../../src/i18n/api-error.js";

test("maps known API errors and hides unknown server detail", () => {
  assert.equal(getApiErrorKey("Incorrect email or password"), "errors.invalidCredentials");
  assert.equal(getApiErrorKey("Email already registered"), "errors.duplicateEmail");
  assert.equal(getApiErrorKey("database host leaked"), "errors.generic");
});
```

Add an authenticated E2E test using existing `registerUser()` and `seedAuth()`:

```js
test("translates authenticated page families while preserving dynamic content", async ({ page, request }) => {
  const user = await registerUser(request, { name: "Mixed Demo User" });
  await seedAuth(page, user.token);
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "ملفي الشخصي" })).toBeVisible();
  await expect(page.getByText("Mixed Demo User")).toBeVisible();

  await page.goto("/chat");
  await expect(page.getByPlaceholder("اكتب رسالتك...")).toBeVisible();

  await page.goto("/emergency");
  await expect(page.getByRole("heading", { name: "مساعدة الطوارئ" })).toBeVisible();
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npm.cmd run test:i18n`

Expected: FAIL because `api-error.js` is missing.

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js --grep "authenticated page families"`

Expected: FAIL on the first English profile heading.

- [ ] **Step 3: Add authenticated resource domains**

Add matching keys for:

- `navigation`: home, chat, profile, history, new chat, chat history, loading, empty history, logout, emergency mode, immediate assistance.
- `chat`: normal/emergency headers, new session, empty prompt, message placeholder, send/voice/source labels, initialization and send errors, safety-check/countdown controls.
- `profile`: page headings, edit/back/save/cancel states, personal/medical/emergency field labels, empty values, cards, and update feedback.
- `emergency`: authentication, landing instructions, warning, three numbered steps, chat action, history headings, empty/loading/error states, and every backend status label.
- `about`: every heading, paragraph, feature title, and accessibility label in the currently unrouted page.

Use `Intl.DateTimeFormat(getFormattingLocale(i18n.language), options)` for frontend-owned date rendering. Do not format opaque backend IDs, patient IDs, blood types, phone numbers, or message bodies.

- [ ] **Step 4: Implement the error-key boundary and migrate authenticated components**

Implement `getApiErrorKey` with an explicit immutable message-to-key map for known authentication outcomes and `errors.generic` fallback. Catch blocks log the original error and render `t(getApiErrorKey(error.message))`.

Replace direct `ThemeToggle` placements in `SideBar`, `SidebarProfile`, and `EmergencyMode` with `AppearanceControls`. Convert static item arrays to stable IDs plus translation keys. Keep all dynamic messages/source titles/history snippets at `dir="auto"`.

- [ ] **Step 5: Verify authenticated translations and the complete resource contract**

Run: `npm.cmd run test:i18n`

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js`

Expected: API-error, resource-parity, public, and authenticated language cases PASS.

- [ ] **Step 6: Commit authenticated translation**

```powershell
git add frontend/src frontend/tests
git commit -m "feat: translate chat profile and emergency flows"
```

### Task 5: True RTL layout behavior

**Files:**
- Modify: `frontend/tests-e2e/language.spec.js`
- Modify: `frontend/src/App.css`
- Modify: directional icon usages under `frontend/src/components/*.jsx` and `frontend/src/pages/*.jsx`

**Interfaces:**
- Consumes: root `dir` from `LanguageSync` and existing Tailwind utility classes.
- Produces: `.rtl-flip` for semantic directional icons and RTL overrides for physical sidebar/form/dropdown utilities.

- [ ] **Step 1: Add a failing sidebar-geometry E2E test**

```js
test("moves navigation and keeps its border on the content edge", async ({ page, request }) => {
  const user = await registerUser(request, { name: "RTL Geometry User" });
  await seedAuth(page, user.token);
  await page.addInitScript(() => localStorage.setItem("najda-language", "ar"));
  await page.goto("/profile");

  const viewport = page.viewportSize();
  const arabicBox = await page.locator("aside").boundingBox();
  expect(arabicBox.x).toBeGreaterThan(viewport.width / 2);
  const arabicBorders = await page.locator("aside").evaluate((aside) => {
    const style = getComputedStyle(aside);
    return { left: style.borderLeftWidth, right: style.borderRightWidth };
  });
  expect(arabicBorders.left).not.toBe("0px");
  expect(arabicBorders.right).toBe("0px");

  await page.getByRole("button", { name: "التبديل إلى الإنجليزية" }).click();
  const englishBox = await page.locator("aside").boundingBox();
  expect(englishBox.x).toBeLessThan(viewport.width / 4);
  const englishBorders = await page.locator("aside").evaluate((aside) => {
    const style = getComputedStyle(aside);
    return { left: style.borderLeftWidth, right: style.borderRightWidth };
  });
  expect(englishBorders.left).toBe("0px");
  expect(englishBorders.right).not.toBe("0px");
});
```

- [ ] **Step 2: Run the geometry test and verify RED**

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js --grep "border on the content edge"`

Expected: FAIL because `border-r` leaves the Arabic sidebar border on the viewport edge instead of the content edge.

- [ ] **Step 3: Add focused RTL CSS mappings**

Add rules under `:root[dir="rtl"]` that:

```css
:root[dir="rtl"] .border-r { border-right-width: 0; border-left-width: 1px; }
:root[dir="rtl"] .left-3 { left: auto; right: 0.75rem; }
:root[dir="rtl"] .right-3 { right: auto; left: 0.75rem; }
:root[dir="rtl"] .right-0 { right: auto; left: 0; }
:root[dir="rtl"] .pl-10 { padding-left: 1rem; padding-right: 2.5rem; }
:root[dir="rtl"] .pr-10 { padding-right: 1rem; padding-left: 2.5rem; }
:root[dir="rtl"] .text-left { text-align: right; }
:root[dir="rtl"] .rtl-flip { transform: scaleX(-1); }
```

Mark only semantic arrows/chevrons with `rtl-flip`; do not mirror medical, microphone, user, logo, sun, moon, or alert icons. Keep email, password, phone, patient ID, and URL values LTR while their labels and surrounding layout remain RTL.

- [ ] **Step 4: Verify RTL GREEN in both themes**

Run the geometry test, then add a dark-mode assertion inside the Arabic context: switch the theme, verify `data-theme="dark"` while `dir="rtl"` remains, reload, and verify both saved settings remain independent.

Run: `npm.cmd run test:e2e -- tests-e2e/language.spec.js`

Expected: all language, persistence, translated-copy, RTL geometry, and theme-independence cases PASS.

- [ ] **Step 5: Commit RTL behavior**

```powershell
git add frontend/src frontend/tests-e2e/language.spec.js
git commit -m "feat: add complete RTL layout behavior"
```

### Task 6: Full regression and visible Chromium acceptance

**Files:**
- Verify only; change production files only when a failing check identifies a concrete regression.

**Interfaces:**
- Consumes: completed localization and RTL feature.
- Produces: fresh static, unit-contract, build, headless E2E, and headed Chromium evidence.

- [ ] **Step 1: Run static and resource verification**

Run: `npm.cmd run lint`

Expected: exit code 0 with no ESLint errors.

Run: `npm.cmd run test:i18n`

Expected: all language helper, API-error, and resource-parity tests PASS.

Run: `npm.cmd run build`

Expected: exit code 0 with the Vite production bundle created.

- [ ] **Step 2: Run the complete Playwright suite headless**

Run: `npm.cmd run test:e2e`

Expected: every existing API/auth/chat/emergency/profile/theme test plus every language test PASS in Chromium.

- [ ] **Step 3: Run bilingual acceptance in visible Chromium**

Run:

```powershell
$env:E2E_HEADED='1'
npm.cmd run test:e2e -- tests-e2e/language.spec.js
Remove-Item Env:E2E_HEADED -ErrorAction SilentlyContinue
```

Expected: visible Chromium demonstrates Arabic browser startup, English/Arabic switching, persistence, authenticated Arabic pages, RTL sidebar movement, and dark/RTL independence before all language tests PASS.

- [ ] **Step 4: Verify repository state**

Run: `git diff --check`

Run: `git status --short --branch`

Expected: no whitespace errors, no generated Playwright artifacts tracked, and only intentional bilingual-UI commits ahead of the base.
