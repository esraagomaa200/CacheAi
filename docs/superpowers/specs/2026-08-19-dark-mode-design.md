# Dark Mode Design

## Goal

Add a complete light/dark appearance to NajdaAI. A first-time visit follows the operating-system color preference. Once the user switches the theme manually, that choice persists across reloads and routes.

## Approved UX

- Support exactly two rendered themes: `light` and `dark`.
- If `localStorage` has no saved preference, derive the initial theme from `prefers-color-scheme` and keep following system changes.
- The first manual switch stores the explicit theme and stops following later system changes.
- Put the control inside the home header, chat sidebar, and profile sidebar.
- Put a compact control on standalone authentication, signup, and emergency pages that do not render one of those navigation components.
- Use a moon icon when the action is “switch to dark” and a sun icon when the action is “switch to light”. The button must expose the same action through an accessible English label.

## Architecture

`ThemeProvider` owns the current theme and the persisted-preference boundary. It applies `data-theme="light|dark"` to `document.documentElement`, synchronizes the browser `color-scheme`, and exposes `theme` plus `toggleTheme()` through `useTheme()`.

`ThemeToggle` is a reusable presentation component. Navigation components render the labeled variant; standalone pages render its compact variant. It contains no storage or media-query logic.

`App.css` defines the semantic light and dark tokens for page backgrounds, surfaces, text, borders, form controls, accent states, danger states, and shadows. A centralized compatibility layer maps the application's existing Tailwind palette utilities to those tokens in dark mode, avoiding scattered runtime style logic while allowing the existing light design to remain unchanged.

## Persistence and System Preference

- Storage key: `najda-theme`.
- Accepted stored values: `light` or `dark`; any other value is ignored.
- No stored value: read `window.matchMedia("(prefers-color-scheme: dark)")`.
- While there is no stored value, listen for media-query `change` events and update the rendered theme.
- A toggle writes the next theme to storage and updates the document synchronously through React state/effect.

## Accessibility and Visual Behavior

- The control is a native `button` with a dynamic `aria-label` and `title`.
- Focus rings remain visible in both themes.
- Dark mode uses dark surfaces rather than a color inversion, preserving brand green, emergency red, and readable contrast.
- Theme changes use a short color transition, disabled under `prefers-reduced-motion: reduce`.

## E2E Contract

Playwright must prove user-visible behavior rather than only checking a CSS class:

1. With dark system emulation and empty storage, the document resolves to dark and the page background is a genuinely dark computed color.
2. Activating “Switch to light mode” changes the rendered background to a genuinely light computed color and stores `light` under `najda-theme`.
3. Reloading and navigating keeps the explicit choice even if the emulated system preference is dark.
4. The theme control is available in the home header, chat/profile sidebars, and standalone authentication/signup/emergency layouts.

The final acceptance run uses headed Chromium with the existing `E2E_HEADED=1` configuration so the user can watch the interaction.

