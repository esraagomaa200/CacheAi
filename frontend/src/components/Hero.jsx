import { Sparkles, ArrowRight } from "lucide-react";
import robot from "../assets/images/robot.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
} from "../lib/api";

function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [checkingAuth, setCheckingAuth] = useState(false);

  const handleStartChatting = async () => {
    const token = getAccessToken();

    // A new visitor should create an account first.
    if (!token) {
      navigate("/signup");
      return;
    }

    setCheckingAuth(true);

    try {
      // Validate that the saved JWT still belongs to a valid backend user.
      await apiFetch("/auth/me");
      navigate("/chat");
    } catch {
      // Expired or invalid tokens must not grant access to the chat.
      clearAccessToken();
      navigate("/login");
    } finally {
      setCheckingAuth(false);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-white">
      <div className="absolute right-[12%] top-10 h-[420px] w-[420px] rounded-full bg-emerald-50/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center px-8 lg:px-12">
        <div className="z-10 w-full lg:w-1/2">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-4 py-2">
            <Sparkles size={16} strokeWidth={2} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600">
              {t("home.badge")}
            </span>
          </div>

          <h1 className="max-w-[600px] text-5xl font-bold leading-[1.08] tracking-[-1.5px] text-[#0B2028] md:text-6xl">
            {t("home.title")}
          </h1>

          <p className="mt-6 max-w-[520px] text-[17px] leading-7 text-[#40545C]">
            {t("home.description")}
          </p>

          <div className="mt-8 flex items-center gap-5">
            <button
              onClick={handleStartChatting}
              disabled={checkingAuth}
              className="group flex items-center gap-4 rounded-xl bg-[#19A878] px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#15966B] hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
            >
              {checkingAuth ? t("common.checking") : t("home.startChatting")}
              <ArrowRight
                size={19}
                className="rtl-flip transition-transform duration-300 group-hover:translate-x-1"
              />
            </button>

            <button
              onClick={() => navigate("/emergency-auth")}
              className="flex items-center gap-3 rounded-xl border border-[#D8E1E1] bg-[#fd5d5d] px-6 py-3.5 text-[15px] font-semibold text-[#18323A] transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-50"
            >
              {t("home.emergency")}
            </button>
          </div>
        </div>

        <div className="relative hidden h-[520px] w-1/2 items-center justify-center lg:flex">
          <div className="absolute h-[440px] w-[440px] rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 blur-sm" />
          <img
            src={robot}
            alt={t("home.imageAlt")}
            className="relative z-10 w-[440px] object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.08)]"
          />
          <span className="absolute right-8 top-16 h-2 w-2 rounded-full bg-emerald-400" />
          <span className="absolute right-0 top-48 h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <span className="absolute left-16 top-28 h-2 w-2 rounded-full bg-emerald-300" />
        </div>
      </div>
    </section>
  );
}

export default Hero;

