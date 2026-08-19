import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import AppearanceControls from "../components/AppearanceControls";
import useTheme from "../theme/useTheme";
import {
  API_BASE_URL,
  formatApiError,
  setAccessToken,
} from "../lib/api";

// Set this to your Google Cloud Console OAuth 2.0 Web Client ID.
// (Google Cloud Console -> APIs & Services -> Credentials)
const GOOGLE_CLIENT_ID = "832987608983-d0g7flf8phslosqpjhmvpddgsc6t1vdi.apps.googleusercontent.com";

export default function EmergencyAuth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const buttonRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Send the Google ID token to OUR backend. The backend verifies it
  // against Google, then creates/finds the user in our own database
  // and returns our own app JWT (same shape as /auth/login).
  const handleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: response.credential }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          formatApiError(result, res.status)
        );
      }

      // Same token our normal /auth/login flow produces — everything
      // else in the app (get_current_user, /auth/me, etc.) works
      // exactly the same regardless of how the user signed in.
      setAccessToken(result.access_token);

      navigate("/emergency");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("errors.googleFailure");
    } finally {
      setLoading(false);
    }
  };

  // Load Google's Identity Services script once, then render their
  // official button into buttonRef. No Firebase SDK involved.
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

        script.onload = () => {
      if (!GOOGLE_CLIENT_ID) {
        setError("auth.googleClientMissing");
        return;
      }

      if (!window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({

        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      renderGoogleButton();
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GSI draws its own button — it must follow the app theme and fill the
  // card's actual width, and get redrawn whenever the theme toggles.
  function renderGoogleButton() {
    if (!window.google || !buttonRef.current) return;

    const width = Math.min(
      Math.max(buttonRef.current.offsetWidth || 320, 200),
      400
    );

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: theme === "dark" ? "filled_black" : "outline",
      size: "large",
      width,
      text: "continue_with",
    });
  }

  useEffect(() => {
    renderGoogleButton();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F8FAFB] px-4">
      <AppearanceControls compact className="absolute right-5 top-5 z-20" />

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#E2EAE7] bg-white p-8 shadow-sm">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0F0]">
            <ShieldAlert size={30} className="text-[#D94B4B]" />
          </div>

          {/* Title */}
          <h1 className="text-center text-2xl font-bold text-[#18323A]">
            {t("auth.emergencyTitle")}
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-[#64748B]">
            {t("auth.emergencyInstructions")}
          </p>

          {/* Google renders its own button here */}
          <div className="mt-7 flex justify-center">
            {/* colorScheme light: keeps the cross-origin GSI iframe transparent
                under data-theme=dark (Chromium paints it opaque white on a
                color-scheme mismatch). */}
            <div
              ref={buttonRef}
              className="flex justify-center"
              style={{ colorScheme: "light" }}
            />
          </div>

          {loading && (
            <p className="mt-3 text-center text-sm text-[#64748B]">
              {t("auth.signingIn")}
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-sm text-red-500">
              {t(error)}
            </p>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-[#8A989D]">
            {t("auth.emergencyIdentityNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
