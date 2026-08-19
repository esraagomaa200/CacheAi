import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TriangleAlert, X } from "lucide-react";

import { apiFetch, getAccessToken, mapBackendProfileToForm } from "../lib/api";

const DISMISS_KEY = "najda-profile-reminder-dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isProfileIncomplete(profile) {
  if (!profile) {
    return false;
  }

  return !profile.dateOfBirth || !profile.gender || !profile.bloodType;
}

/**
 * Thin dismissible reminder shown when the signed-in user's medical profile
 * is missing date of birth, gender, or blood type. Self-contained by
 * default (fetches GET /profile/me itself) — pass an already-loaded
 * `profile` (the shape returned by mapBackendProfileToForm) to skip that
 * extra request when the caller already has it, e.g. Profile.jsx.
 *
 * Dismissal is remembered for the browser session only (sessionStorage), so
 * it reappears on the next visit.
 */
function ProfileReminderBanner({ profile: profileProp }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [fetchedProfile, setFetchedProfile] = useState(null);

  useEffect(() => {
    if (profileProp !== undefined || dismissed || !getAccessToken()) {
      return undefined;
    }

    let cancelled = false;

    apiFetch("/profile/me")
      .then((data) => {
        if (!cancelled) {
          setFetchedProfile(mapBackendProfileToForm(data));
        }
      })
      .catch((err) => {
        console.error("ProfileReminderBanner: failed to load profile:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [profileProp, dismissed]);

  if (dismissed) {
    return null;
  }

  const profile = profileProp !== undefined ? profileProp : fetchedProfile;

  if (!isProfileIncomplete(profile)) {
    return null;
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessionStorage unavailable — dismissal just won't persist */
    }
    setDismissed(true);
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <TriangleAlert size={16} className="shrink-0 text-amber-600" />

      {/* A plain <div> rather than a <p dir="auto"> on purpose: chat.spec.js
          locates chat message bubbles via `main p[dir="auto"]`, and this
          banner can render inside Chat.jsx's <main> above the message list —
          a <p dir="auto"> here would be miscounted as a chat bubble. */}
      <div className="flex-1 text-[13px] leading-5 text-amber-800">
        {t("profileReminder.message")}{" "}
        <Link
          to="/edit-profile"
          className="font-semibold underline hover:text-amber-900"
        >
          {t("profileReminder.cta")}
        </Link>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("profileReminder.dismiss")}
        className="shrink-0 rounded-full p-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default ProfileReminderBanner;
