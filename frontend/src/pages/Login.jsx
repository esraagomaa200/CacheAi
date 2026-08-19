import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Lock, Eye, EyeOff, HeartPulse } from "lucide-react";

import logo2 from "../assets/icons/Logo2.png";
import AppearanceControls from "../components/AppearanceControls";
import { getApiErrorKey } from "../i18n/api-error";
import {
  API_BASE_URL,
  apiFetch,
  formatApiError,
  setAccessToken,
} from "../lib/api";

// Same Google Cloud Console OAuth 2.0 Web Client ID used by EmergencyAuth.jsx,
// overridable via env so different environments can swap it without a code change.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "832987608983-d0g7flf8phslosqpjhmvpddgsc6t1vdi.apps.googleusercontent.com";

const inputBase =
  "w-full h-11 pl-10 pr-4 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder-gray-400 bg-white outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("errors.requiredCredentials");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.set("username", email.trim());
      form.set("password", password);

      const data = await apiFetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });

      setAccessToken(data.access_token);
      navigate("/profile");
    } catch (err) {
      console.error("Login error:", err);
      setError(getApiErrorKey(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  // Send the Google ID token to our backend, same pattern as EmergencyAuth.jsx.
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
        throw new Error(formatApiError(result, res.status));
      }

      setAccessToken(result.access_token);
      navigate("/profile");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("errors.googleFailure");
    } finally {
      setLoading(false);
    }
  };

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

      if (!window.google || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F8FAFB] px-4">
      <AppearanceControls compact className="absolute right-5 top-5 z-20" />

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <img
              src={logo2}
              alt={t("auth.logoAlt")}
              className="h-11 w-11 object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-[#18323A]">
              Najda<span className="text-emerald-600">AI</span>
            </span>
          </div>

          <h1 className="text-center text-xl font-bold text-[#18323A]">
            {t("auth.welcome")}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-gray-500">
            {t("auth.instructions")}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                {t("auth.emailLabel")}
              </label>

              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  className={inputBase}
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                {t("auth.passwordLabel")}
              </label>

              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  className={`${inputBase} pr-10`}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                  aria-label={
                    showPassword
                      ? t("auth.hidePassword")
                      : t("auth.showPassword")
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {t(error)}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-lg bg-emerald-600 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">{t("auth.divider")}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Google renders its own button here */}
          <div className="flex justify-center">
            <div ref={googleButtonRef} />
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t("auth.noAccount")} {" "}
            <Link
              to="/signup"
              className="font-medium text-emerald-600 hover:underline"
            >
              {t("auth.signUp")}
            </Link>
          </p>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
            <HeartPulse className="h-3.5 w-3.5" />
            {t("auth.privacyNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
