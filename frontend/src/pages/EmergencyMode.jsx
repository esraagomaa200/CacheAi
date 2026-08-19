import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  LuTriangleAlert,
  LuArrowRight,
  LuShieldCheck,
  LuPhone,
  LuUser,
} from "react-icons/lu";

import logo2 from "../assets/icons/Logo2.png";
import AppearanceControls from "../components/AppearanceControls";
import {
  apiFetch,
  getAccessToken,
  updateEmergencyContact,
} from "../lib/api";
import { getApiErrorKey } from "../i18n/api-error";

const quickInputBase =
  "h-11 w-full rounded-lg border border-[#E5D0D0] bg-white pl-10 pr-3 text-[14px] text-[#4A2E2E] placeholder-[#B79A9A] outline-none transition focus:border-[#D94B4B] focus:ring-2 focus:ring-red-100";

function EmergencyMode() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // "checking" | "missing" | "present" | "unknown" (no token / load failed)
  const [contactStatus, setContactStatus] = useState(() =>
    getAccessToken() ? "checking" : "unknown"
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      return undefined;
    }

    let cancelled = false;

    apiFetch("/profile/me")
      .then((data) => {
        if (cancelled) return;
        const contact = data?.emergency_contact;
        const hasContact = Boolean(contact?.name?.trim() && contact?.phone?.trim());
        setContactStatus(hasContact ? "present" : "missing");
      })
      .catch((err) => {
        console.error("EmergencyMode: failed to load profile:", err);
        if (!cancelled) {
          setContactStatus("unknown");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function goToEmergencyChat() {
    navigate("/chat?mode=emergency");
  }

  async function handleSaveContact(e) {
    e.preventDefault();

    if (!phone.trim() || saving) {
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      await updateEmergencyContact({
        name: name.trim() || null,
        phone: phone.trim(),
        email: null,
      });
      setContactStatus("present");
    } catch (err) {
      console.error("Failed to save emergency contact:", err);
      setSaveError(getApiErrorKey(err instanceof Error ? err.message : ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FCFA]">

      {/* Header */}
      <header className="flex h-[72px] items-center justify-between border-b border-[#E5EEEB] bg-white px-8">

        {/* Logo */}
        <div className="flex items-center gap-2">

          <img
            src={logo2}
            alt={t("auth.logoAlt")}
            className="h-10 w-10 object-contain"
          />

          <span className="text-xl font-bold text-[#18323A]">
            Najda<span className="text-[#19A878]">AI</span>
          </span>

        </div>

        <div className="flex items-center gap-3">
          <AppearanceControls compact />

          {/* Emergency Badge */}
          <div className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">

            <LuTriangleAlert size={17} />

            <span>{t("emergency.mode")}</span>

          </div>
        </div>

      </header>


      {/* Content */}
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-12">

        <div className="w-full max-w-[620px] text-center">

          {/* Emergency Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">

              <LuTriangleAlert
                size={32}
                strokeWidth={2}
                className="text-red-500"
              />

            </div>

          </div>


          {/* Heading */}
          <h1 className="mt-7 text-4xl font-bold tracking-tight text-[#18323A]">
            {t("emergency.title")}
          </h1>


          {/* Description */}
          <p className="mx-auto mt-4 max-w-[520px] text-base leading-7 text-[#66787E]">
            {t("emergency.description")}
          </p>


          {/* Warning Card */}
          <div className="mt-8 flex gap-4 rounded-2xl border border-red-100 bg-red-50/70 p-5 text-left">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">

              <LuTriangleAlert
                size={20}
                className="text-red-500"
              />

            </div>

            <div>

              <h2 className="text-sm font-bold text-[#8F3030]">
                {t("emergency.warningTitle")}
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#7B5555]">
                {t("emergency.warning")}
              </p>

            </div>

          </div>


          {/* What Happens Next */}
          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">

            <NextStep
              number="1"
              text={t("emergency.steps.describe")}
            />

            <NextStep
              number="2"
              text={t("emergency.steps.safetyCheck")}
            />

            <NextStep
              number="3"
              text={t("emergency.steps.notify")}
            />

          </div>


          {/* Quick emergency contact prompt — non-blocking */}
          {contactStatus === "missing" && (
            <div className="mt-6 rounded-2xl border border-[#F0D6D6] bg-white p-5 text-left">

              <h3 className="text-sm font-bold text-[#8F3030]">
                {t("emergency.quickContact.title")}
              </h3>

              <p className="mt-1 text-[13px] leading-5 text-[#7B5555]">
                {t("emergency.quickContact.description")}
              </p>

              <form onSubmit={handleSaveContact} className="mt-4 flex flex-col gap-3 sm:flex-row">

                <div className="relative flex-1">
                  <LuUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B79A9A]" size={16} />
                  <input
                    type="text"
                    dir="auto"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("profile.placeholders.contactName")}
                    className={quickInputBase}
                  />
                </div>

                <div className="relative flex-1">
                  <LuPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B79A9A]" size={16} />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("profile.placeholders.phoneNumber")}
                    className={quickInputBase}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!phone.trim() || saving}
                  className="h-11 shrink-0 rounded-lg bg-[#D94B4B] px-5 text-[13px] font-semibold text-white transition hover:bg-[#C83F3F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? t("completeProfile.saving") : t("emergency.quickContact.saveButton")}
                </button>

              </form>

              {saveError && (
                <p className="mt-3 text-[12px] text-red-600">{t(saveError)}</p>
              )}

              <button
                type="button"
                onClick={goToEmergencyChat}
                className="mt-4 text-[13px] font-semibold text-[#8F3030] underline hover:text-[#6E2323]"
              >
                {t("emergency.quickContact.bypassLink")}
              </button>

            </div>
          )}


          {/* Start Emergency Chat */}
          <button
            onClick={goToEmergencyChat}
            className="
              group
              mt-8
              inline-flex
              items-center
              justify-center
              gap-3
              rounded-xl
              bg-[#D94B4B]
              px-8
              py-4
              text-[15px]
              font-semibold
              text-white
              shadow-sm
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:bg-[#C83F3F]
              hover:shadow-lg
            "
          >

            {t("emergency.startChat")}

            <LuArrowRight
              size={19}
              className="rtl-flip transition-transform duration-300 group-hover:translate-x-1"
            />

          </button>


          {/* No Account Required */}
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#7A898E]">

            <LuShieldCheck
              size={15}
              className="text-[#19A878]"
            />

            <span>{t("emergency.authentication")}</span>

          </div>

        </div>

      </main>

    </div>
  );
}

/* Next Step */
function NextStep({ number, text }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#E5EEEB] bg-white px-3.5 py-3">

      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAF8F4] text-[10px] font-bold text-[#19A878]">
        {number}
      </span>

      <p className="text-[12px] leading-5 text-[#5B6B71]">
        {text}
      </p>

    </div>
  );
}

export default EmergencyMode;
