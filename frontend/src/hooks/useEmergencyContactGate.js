import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { apiFetch, getAccessToken } from "../lib/api";

/**
 * Profile-completion gate: on mount, fetches GET /profile/me once and
 * redirects to /complete-profile (carrying the current path as ?next=) when
 * the signed-in user has no emergency contact name+phone on file.
 *
 * Pass `skip: true` to disable the check entirely — used by Chat.jsx's
 * emergency mode, which must never be hard-blocked.
 *
 * Fails silent on a load error: a transient network hiccup shouldn't lock
 * the user out of the page the gate is protecting.
 */
function useEmergencyContactGate({ skip = false } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const ranRef = useRef(false);

  useEffect(() => {
    if (skip || ranRef.current || !getAccessToken()) {
      return undefined;
    }

    // ranRef (not a `cancelled` closure flag) is what guarantees this check
    // runs once: under StrictMode's mount→cleanup→mount, the request kicked
    // off by the first pass is already "cancelled" by the time it resolves,
    // while the second pass's effect re-run is skipped by the ranRef guard
    // above — so applying the result unconditionally here is required, not
    // a bug. Same pattern/rationale as Chat.jsx's startEmergencySession().
    ranRef.current = true;

    async function checkContact() {
      try {
        const data = await apiFetch("/profile/me");
        const contact = data?.emergency_contact;
        const hasContact = Boolean(
          contact?.name?.trim() && contact?.phone?.trim()
        );

        if (!hasContact) {
          const next = `${location.pathname}${location.search}`;
          navigate(`/complete-profile?next=${encodeURIComponent(next)}`, {
            replace: true,
          });
        }
      } catch (err) {
        console.error(
          "useEmergencyContactGate: failed to load profile:",
          err
        );
      }
    }

    checkContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);
}

export default useEmergencyContactGate;
