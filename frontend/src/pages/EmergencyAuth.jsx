import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

// Set this to your Google Cloud Console OAuth 2.0 Web Client ID.
// (Google Cloud Console -> APIs & Services -> Credentials)
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

export default function EmergencyAuth() {
  const navigate = useNavigate();
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

      const res = await fetch("http://127.0.0.1:8000/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: response.credential }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.detail || "Google sign-in failed");
      }

      // Same token our normal /auth/login flow produces — everything
      // else in the app (get_current_user, /auth/me, etc.) works
      // exactly the same regardless of how the user signed in.
      localStorage.setItem("accessToken", result.access_token);

      navigate("/emergency");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(err.message || "Unable to sign in with Google.");
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
      if (!window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
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
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFB] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#E2EAE7] bg-white p-8 shadow-sm">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0F0]">
            <ShieldAlert size={30} className="text-[#D94B4B]" />
          </div>

          {/* Title */}
          <h1 className="text-center text-2xl font-bold text-[#18323A]">
            Emergency Mode
          </h1>

          <p className="mt-2 text-center text-sm leading-6 text-[#64748B]">
            Sign in with your Google account to continue to Emergency Mode.
          </p>

          {/* Google renders its own button here */}
          <div className="mt-7 flex justify-center">
            <div ref={buttonRef} />
          </div>

          {loading && (
            <p className="mt-3 text-center text-sm text-[#64748B]">
              Signing in...
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-sm text-red-500">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-[#8A989D]">
            Your Google account is only used to verify your identity.
          </p>
        </div>
      </div>
    </div>
  );
}