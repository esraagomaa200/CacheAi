import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Bot,
  Brain,
  Code2,
  HeartPulse,
  MessageCircleMore,
  PenTool,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";

import robot from "../assets/images/robot.png";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
} from "../lib/api";

const CONDITIONS = [
  { key: "stroke", icon: Brain },
  { key: "heart", icon: HeartPulse },
  { key: "breathing", icon: Wind },
];

const STEPS = [
  { key: "talk", icon: MessageCircleMore },
  { key: "assess", icon: Sparkles },
  { key: "escalate", icon: PhoneCall },
];

const TEAM = [
  { key: "uiux", icon: PenTool },
  { key: "fullstack", icon: Code2 },
  { key: "ai", icon: Bot },
];

function About() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [checkingAuth, setCheckingAuth] = useState(false);

  // Same gate as the home hero: visitors sign up first, stale tokens
  // never reach the chat.
  const handleTryNajda = async () => {
    const token = getAccessToken();

    if (!token) {
      navigate("/signup");
      return;
    }

    setCheckingAuth(true);

    try {
      await apiFetch("/auth/me");
      navigate("/chat");
    } catch {
      clearAccessToken();
      navigate("/login");
    } finally {
      setCheckingAuth(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute end-[10%] top-10 h-[320px] w-[320px] rounded-full bg-emerald-50/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-14 sm:px-8 lg:grid-cols-2 lg:px-12">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/70 px-4 py-2">
              <Sparkles size={16} strokeWidth={2} className="text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">
                {t("about.badge")}
              </span>
            </div>

            <h1 className="max-w-xl text-3xl font-bold leading-[1.15] tracking-[-1px] text-[#0B2028] sm:text-4xl md:text-5xl">
              {t("about.title")}
            </h1>

            <div className="mt-5 max-w-xl space-y-3 text-base leading-7 text-[#40545C]">
              <p>{t("about.mission")}</p>
              <p>{t("about.approach")}</p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {["accessible", "reliable", "aiPowered", "everyone"].map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-[#DDE5E5] bg-white px-4 py-2 text-xs font-semibold text-[#15966B] shadow-sm"
                >
                  {t(`about.features.${key}`)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative hidden items-center justify-center lg:flex">
            <div className="absolute h-[330px] w-[330px] rounded-full bg-emerald-50 blur-sm" />
            <img
              src={robot}
              alt={t("about.imageAlt")}
              className="relative z-10 w-[330px] object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.08)]"
            />
          </div>
        </div>
      </section>

      {/* Why نجدة — the three time-critical conditions */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        <h2 className="text-2xl font-bold text-[#0B2028] sm:text-3xl">
          {t("about.whyTitle")}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#40545C]">
          {t("about.whyIntro")}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {CONDITIONS.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-[#DDE5E5] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon size={24} strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-semibold text-[#0B2028]">
                {t(`about.conditions.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#40545C]">
                {t(`about.conditions.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-3xl rounded-xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-sm font-medium leading-6 text-[#0B2028]">
          {t("about.timeNote")}
        </p>
        <p className="mt-2 text-xs text-[#718087]">{t("about.sourceNote")}</p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        <h2 className="text-2xl font-bold text-[#0B2028] sm:text-3xl">
          {t("about.howTitle")}
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <div
              key={key}
              className="relative rounded-2xl border border-[#DDE5E5] bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19A878] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <Icon size={22} strokeWidth={1.8} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#0B2028]">
                {t(`about.steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#40545C]">
                {t(`about.steps.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety boundaries */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        <div className="rounded-2xl border border-[#DDE5E5] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0B2028] sm:text-2xl">
                {t("about.safetyTitle")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#40545C] sm:text-base">
                {t("about.safetyBody")}
              </p>
              <p className="mt-3 text-sm font-semibold text-[#C24141]">
                {t("about.safetyEmergency")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:px-12">
        <h2 className="text-2xl font-bold text-[#0B2028] sm:text-3xl">
          {t("about.teamTitle")}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#40545C]">
          {t("about.teamIntro")}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {TEAM.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-[#DDE5E5] bg-white p-6 text-center shadow-sm"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon size={26} strokeWidth={1.7} />
              </div>
              <h3 className="text-base font-semibold text-[#0B2028]">
                {t(`about.team.${key}.role`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#40545C]">
                {t(`about.team.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-8 lg:px-12">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 px-6 py-10 text-center sm:px-10">
          <h2 className="text-2xl font-bold text-[#0B2028] sm:text-3xl">
            {t("about.ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[#40545C]">
            {t("about.ctaBody")}
          </p>
          <button
            onClick={handleTryNajda}
            disabled={checkingAuth}
            className="group mx-auto mt-7 flex items-center justify-center gap-3 rounded-xl bg-[#19A878] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#15966B] hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
          >
            {checkingAuth ? t("common.checking") : t("about.ctaButton")}
            <ArrowRight
              size={19}
              className="rtl-flip transition-transform duration-300 group-hover:translate-x-1"
            />
          </button>
        </div>
      </section>
    </div>
  );
}

export default About;
