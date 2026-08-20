import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiFetch, getAccessToken } from "../lib/api";

// Local fast-path marker so returning users don't refetch the flag on every
// chat mount. The backend flag (users.has_seen_tour) stays the source of
// truth across devices.
const TOUR_DONE_KEY = "najda-tour-done";

// Tour stops, in order. Each targets a [data-tour="…"] element; stops whose
// element isn't on screen are skipped so the tour never breaks on layout
// variants. The i18n keys live under tour.steps.<key>.
const STEP_KEYS = ["newChat", "composer", "mic", "history", "profile", "emergencyCard"];

const STEP_TARGETS = {
  newChat: '[data-tour="new-chat"]',
  composer: '[data-tour="composer"]',
  mic: '[data-tour="mic"]',
  history: '[data-tour="history"]',
  profile: '[data-tour="profile"]',
  emergencyCard: '[data-tour="emergency-card"]',
};

// Module-level handle: driver.js owns DOM outside React, so a route change
// must be able to tear down whichever instance is live.
let activeTour = null;

/**
 * First-visit onboarding tour: spotlights the core controls one by one.
 * Runs once per ACCOUNT (backend flag), only when the profile gate has
 * already passed, and never in an emergency session.
 *
 * Suppressed under browser automation (navigator.webdriver) so the popover
 * can't intercept clicks in unrelated E2E specs; `?tour=1` overrides the
 * suppression, which is how the tour's own spec drives it.
 */
function useOnboardingTour({ enabled = true } = {}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const ranRef = useRef(false);

  const forceTour = searchParams.get("tour") === "1";

  useEffect(() => {
    // Registered on EVERY effect run — including guarded ones — because under
    // StrictMode the run that actually starts the tour is the one whose
    // cleanup already fired; only a later run's teardown can reach the
    // module-level instance on a real unmount (route change, emergency).
    const teardown = () => {
      // onDestroyed still fires, deliberately counting a half-watched tour
      // as seen instead of nagging on the next visit.
      try {
        activeTour?.destroy();
      } catch {
        /* already gone */
      }
    };

    if (
      !enabled ||
      ranRef.current ||
      !getAccessToken() ||
      (navigator.webdriver && !forceTour)
    ) {
      return teardown;
    }

    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }

    if (!forceTour && storage?.getItem(TOUR_DONE_KEY)) {
      return teardown;
    }

    // ranRef + no cancellation flag: same StrictMode rationale as
    // useEmergencyContactGate — the first pass's async work must be allowed
    // to finish because the second effect run is skipped by this guard.
    ranRef.current = true;

    async function maybeStartTour() {
      let profile;
      try {
        profile = await apiFetch("/profile/me");
      } catch {
        // A transient profile failure must never block the chat itself.
        return;
      }

      // ?tour=1 bypasses the automation suppression and the localStorage
      // fast-path only — the backend flag stays authoritative, which is what
      // lets the E2E spec prove the tour really runs once per account.
      if (profile?.user?.has_seen_tour) {
        storage?.setItem(TOUR_DONE_KEY, "1");
        return;
      }

      // The completion gate is about to redirect this user — starting a
      // tour on a page that's disappearing would orphan the overlay.
      const contact = profile?.emergency_contact;
      const gatePassed = Boolean(contact?.name?.trim() && contact?.phone?.trim());
      if (!gatePassed) {
        return;
      }

      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
      ]);

      const steps = STEP_KEYS.filter(
        (key) => document.querySelector(STEP_TARGETS[key])
      ).map((key) => ({
        element: STEP_TARGETS[key],
        popover: {
          title: t(`tour.steps.${key}.title`),
          description: t(`tour.steps.${key}.desc`),
        },
      }));

      if (!steps.length) {
        return;
      }

      let seenOnce = false;
      const markSeen = () => {
        if (seenOnce) {
          return;
        }
        seenOnce = true;
        activeTour = null;
        storage?.setItem(TOUR_DONE_KEY, "1");
        // Fire-and-forget: a network blip just means the tour may show once
        // more on another device, which is harmless.
        apiFetch("/profile/tour-seen", { method: "POST" }).catch(() => {});
      };

      const instance = driver({
        showProgress: true,
        overlayOpacity: 0.72,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "najda-tour",
        nextBtnText: t("tour.next"),
        prevBtnText: t("tour.prev"),
        doneBtnText: t("tour.done"),
        // Language-neutral on purpose: i18next would eat driver.js's
        // {{current}}/{{total}} placeholders as its own interpolation.
        progressText: "{{current}} / {{total}}",
        // Marking seen ONLY in onDestroyed misses the "Done" click: driver.js
        // skips that hook when no step is active at teardown time. Every
        // user-initiated exit (done, ×, ESC, overlay) goes through
        // onDestroyStarted instead, where we mark and then perform the real
        // destroy ourselves (the documented pattern). onDestroyed stays as a
        // safety net for direct destroy() paths; markSeen is idempotent.
        onDestroyStarted: () => {
          markSeen();
          instance.destroy();
        },
        onDestroyed: markSeen,
        steps,
      });

      activeTour = instance;
      instance.drive();
    }

    maybeStartTour();

    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, forceTour]);
}

export default useOnboardingTour;
