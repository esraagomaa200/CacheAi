# Bilingual Arabic/English UI Design

## Goal

Make the complete NajdaAI user interface available in English and simplified Modern Standard Arabic. A first-time visitor follows the browser language, a manual choice persists, and Arabic renders as a true right-to-left interface.

## Product Decisions

- Supported interface languages are exactly `en` and `ar`.
- On first visit, a browser language beginning with `ar` selects Arabic; every other browser language selects English.
- A manual choice is saved under `localStorage["najda-language"]` and wins over later browser-language changes.
- Arabic copy uses clear, simplified Modern Standard Arabic suitable for a medical support interface.
- The language control appears beside the light/dark control in the header, both sidebars, and standalone authentication, signup, and emergency pages.
- Arabic changes the complete interface to RTL, including sidebar position, form adornments, directional icons, spacing, and text alignment.
- The interface language does not force an AI response language. Assistant messages continue to follow the language of the user's message.

## Scope

The translation covers all frontend-owned user-visible content:

- Navigation, page titles, headings, descriptions, buttons, badges, and tooltips.
- Form labels, placeholders, select options, validation messages, loading states, empty states, and success/error feedback.
- Profile field labels, chat controls, source labels, emergency guidance, countdown content, history status labels, and accessibility labels.
- Frontend formatting of dates and numbers through `Intl` using `ar-EG` or `en` according to the selected language.

User names, email addresses, medical values, user-authored messages, assistant-authored messages, and source titles are content rather than interface copy and are not translated. Chat and source content retain `dir="auto"` so mixed Arabic and English remain readable.

Backend behavior, prompts, database schemas, and APIs are outside this feature. Unknown backend errors are logged with their original detail and shown to the user as a safe localized generic error.

## Localization Architecture

Use `i18next` with `react-i18next`. The translations are bundled with the frontend; no translation service or runtime network request is introduced.

### Files and Responsibilities

- `src/i18n/index.js` initializes i18next synchronously, selects the initial language, defines the English fallback, and exports the configured instance.
- `src/i18n/locales/en.js` contains the complete English resource tree.
- `src/i18n/locales/ar.js` contains the matching Arabic resource tree.
- `src/i18n/language.js` owns `najda-language`, validates stored values, detects the browser language, and maps `en`/`ar` to `ltr`/`rtl` and `en`/`ar-EG` formatting locales.
- `src/components/LanguageSync.jsx` synchronizes `document.documentElement.lang` and `.dir` at startup and after every language change.
- `src/components/LanguageToggle.jsx` exposes the alternate language as a native accessible button and persists only manual choices.
- `src/components/AppearanceControls.jsx` lays out `ThemeToggle` and `LanguageToggle` consistently in regular and compact contexts.

Translation keys are grouped by domain inside each resource:

```text
common.*
navigation.*
home.*
auth.*
signup.*
profile.*
chat.*
emergency.*
errors.*
```

The English resource preserves the current approved wording so existing English behavior remains stable. Arabic resources use equivalent meaning rather than literal word-for-word phrasing.

## Language Selection and Data Flow

Before React renders, `src/i18n/index.js` performs the following synchronous selection:

1. Read `najda-language`.
2. Accept it only when it is exactly `en` or `ar`.
3. If absent or invalid, inspect `navigator.languages` and then `navigator.language`.
4. Choose Arabic when the first supported preference starts with `ar`; otherwise choose English.
5. Set the initial `<html lang>` and `<html dir>` before mounting React to avoid a wrong-direction flash.

The automatically detected language is not written to storage. When the user activates `LanguageToggle`, it calls `i18n.changeLanguage(nextLanguage)`, writes the validated choice, and updates the root document attributes. Storage failures do not prevent the current page from switching language.

The language control shows `عربي` while the UI is English and `EN` while the UI is Arabic. Its accessible labels describe the action in the current interface language.

## RTL Layout

The root `dir="rtl"` supplies the default reading and flex direction. Components must replace physical assumptions only where the existing Tailwind classes override that default:

- Sidebar borders use inline-end instead of a fixed right border, putting navigation on the right in Arabic and on the left in English.
- Form-leading icons and input padding swap sides in RTL.
- Password visibility controls and dropdown alignment swap sides.
- Directional arrows and chevrons receive an `rtl-flip` class and mirror horizontally in Arabic.
- Explicit `text-left` behavior becomes logical start alignment where it describes reading order.
- Emergency colors, brand colors, and the selected light/dark theme remain unchanged by language selection.

CSS uses `[dir="rtl"]` selectors and logical properties (`margin-inline`, `padding-inline`, `border-inline-end`, `inset-inline-start`) where possible. It does not duplicate whole page layouts.

## Component Migration

Every user-facing component uses `useTranslation()` and replaces literals with resource keys. Repeated lists such as home features, chronic conditions, blood types, navigation items, and emergency steps store translation keys rather than translated strings.

Backend enum/status values are mapped to translation keys at the presentation boundary. User-provided values are never used as translation keys. Existing `dir="auto"` attributes on chat messages and dynamic source/history text stay in place.

The existing repeated `ThemeToggle` placements are replaced by `AppearanceControls` so the language and theme controls cannot drift apart across layouts.

## Error Handling and Fallbacks

- `fallbackLng` is `en`; a missing Arabic key displays the matching English resource during development rather than a blank label.
- Both locale trees must have identical key paths, enforced by an automated parity test.
- Frontend validation and known API outcomes use localized keys.
- Unknown backend details are sent to `console.error` and the UI displays `errors.generic` in the selected language.
- Invalid stored language values are ignored and do not break startup.
- Translation resources are static imports, so the language switch continues to work offline.

## Testing Strategy

### Resource Contract

A Node test compares the flattened key sets of `en.js` and `ar.js`. It fails for a missing, extra, empty, or non-string leaf and verifies both resources remain complete.

### Playwright E2E

Add `tests-e2e/language.spec.js` with browser-visible behavioral assertions:

1. An `ar-EG` browser with empty storage starts with `lang="ar"`, `dir="rtl"`, Arabic home copy, and no saved preference.
2. An English browser starts with `lang="en"`, `dir="ltr"`, and the existing English copy.
3. Switching from Arabic to English stores `en` and remains English after reload and route navigation.
4. Switching to Arabic changes real visible labels and input placeholders, not only root attributes.
5. In Arabic, an authenticated chat/profile sidebar occupies the right side of the viewport; in English it occupies the left.
6. The combined language/theme controls are present in the home header, chat sidebar, profile sidebar, login, signup, emergency authentication, and emergency mode.
7. User-authored mixed-language chat content keeps `dir="auto"`.

The existing E2E suite continues to run with its default English locale, preserving authentication, chat, emergency, profile, and theme regression coverage. Final acceptance runs the new language suite in headed Chromium so the user can watch English/Arabic switching, persistence, and RTL layout.

## Acceptance Criteria

- All frontend-owned visible strings are available in both resource files.
- First visit follows browser language without creating a saved preference.
- Manual selection persists across reloads and routes.
- Arabic sets `lang="ar"`, `dir="rtl"`, and correctly mirrors the complete application layout.
- English sets `lang="en"`, `dir="ltr"`, and preserves the current visual order.
- Light/dark selection and language selection work independently in all four combinations.
- Assistant response behavior and backend contracts are unchanged.
- Resource parity, lint, production build, the full Playwright suite, and headed Chromium language acceptance all pass.

