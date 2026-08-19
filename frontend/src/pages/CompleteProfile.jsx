import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Smartphone,
  Mail,
  CalendarDays,
  Droplet,
  HeartPulse,
  CreditCard,
  Heart,
  Wind,
  Activity,
  ShieldAlert,
  Check,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logo2 from "../assets/icons/Logo2.png";
import AppearanceControls from "../components/AppearanceControls";
import {
  apiFetch,
  getAccessToken,
  mapBackendProfileToForm,
  updateEmergencyContact,
} from "../lib/api";
import { getApiErrorKey } from "../i18n/api-error";


/* ========================================================= */
/* CHRONIC DISEASES */
/* ========================================================= */

const CHRONIC_DISEASES = [
  { id: "Diabetes", translationKey: "profile.diseases.diabetes", icon: Activity },
  { id: "Hypertension", translationKey: "profile.diseases.hypertension", icon: Heart },
  { id: "Asthma", translationKey: "profile.diseases.asthma", icon: Wind },
  { id: "Heart Disease", translationKey: "profile.diseases.heartDisease", icon: HeartPulse },
  { id: "Kidney Disease", translationKey: "profile.diseases.kidneyDisease", icon: Activity },
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];


/* ========================================================= */
/* INPUT STYLE */
/* ========================================================= */

const inputBase = `
  w-full
  h-12
  rounded-lg
  border
  border-[#DCE5E3]
  bg-white
  pl-10
  pr-4
  text-[14px]
  text-[#263746]
  placeholder-[#9AA7AC]
  outline-none
  transition
  focus:border-[#19A878]
  focus:ring-2
  focus:ring-[#E5F6F0]
`;


/* ========================================================= */
/* SECTION HEADER */
/* ========================================================= */

function SectionHeader({ icon: Icon, title, badge, badgeTone = "required" }) {
  return (
    <div
      className="
        flex
        flex-wrap
        items-center
        justify-between
        gap-2
        border-b
        border-[#EDF1F0]
        px-6
        py-4
      "
    >
      <div className="flex items-center gap-2">
        <div
          className="
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-full
            bg-[#E5F6F0]
          "
        >
          <Icon size={17} className="text-[#19A878]" />
        </div>

        <h2 className="text-[15px] font-semibold text-[#263746]">{title}</h2>
      </div>

      {badge && (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            badgeTone === "required"
              ? "bg-red-50 text-red-600"
              : "bg-[#EAF8F4] text-[#15966B]"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}


/* ========================================================= */
/* FIELD */
/* ========================================================= */

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium text-[#526572]">{label}</label>
      {children}
    </div>
  );
}


/* ========================================================= */
/* INPUT SHELL */
/* ========================================================= */

function InputShell({ icon: Icon, children }) {
  return (
    <div className="relative flex items-center">
      <Icon size={17} className="pointer-events-none absolute left-3 text-[#9AA7AC]" />
      {children}
    </div>
  );
}


/* ========================================================= */
/* COMPLETE PROFILE */
/* ========================================================= */

function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/profile";

  const [formData, setFormData] = useState({
    patientId: "",
    dateOfBirth: "",
    gender: "",
    bloodType: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyEmail: "",
  });
  const [chronicDiseases, setChronicDiseases] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [error, setError] = useState("");
  // null | "continue" | "skip"
  const [savingAction, setSavingAction] = useState(null);

  /* ======================================================= */
  /* AUTH GUARD + LOAD PROFILE */
  /* ======================================================= */

  useEffect(() => {
    const loadProfile = async () => {
      if (!getAccessToken()) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const data = await apiFetch("/profile/me");
        const profile = mapBackendProfileToForm(data);

        setFormData({
          patientId: profile.patientId,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          bloodType: profile.bloodType,
          emergencyName: profile.emergencyName,
          emergencyPhone: profile.emergencyPhone,
          emergencyEmail: profile.emergencyEmail,
        });
        setChronicDiseases(profile.chronicDiseases);
        setLoadStatus("loaded");
      } catch (loadError) {
        console.error("Failed to load profile:", loadError);
        setLoadStatus("error");
        setError(
          getApiErrorKey(loadError instanceof Error ? loadError.message : "")
        );
      }
    };

    loadProfile();
  }, [navigate]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDisease = (disease) => {
    setChronicDiseases((prev) =>
      prev.includes(disease)
        ? prev.filter((item) => item !== disease)
        : [...prev, disease]
    );
  };

  const contactValid =
    formData.emergencyName.trim() !== "" &&
    formData.emergencyPhone.trim() !== "";

  const canSubmit = loadStatus === "loaded" && contactValid && !savingAction;

  /* ======================================================= */
  /* SAVE */
  /* ======================================================= */

  async function saveContact() {
    await updateEmergencyContact({
      name: formData.emergencyName.trim(),
      phone: formData.emergencyPhone.trim(),
      email: formData.emergencyEmail.trim() || null,
    });
  }

  async function saveOptionalFields() {
    await apiFetch("/profile/me", {
      method: "PUT",
      body: JSON.stringify({
        patient_id: formData.patientId.trim() || null,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        blood_type: formData.bloodType || null,
        chronic_conditions: chronicDiseases,
      }),
    });
  }

  async function handleSaveAndContinue(e) {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSavingAction("continue");
    setError("");

    try {
      await saveContact();

      // Section 2 is optional — a failure here shouldn't block the user
      // from continuing once the required contact is safely saved.
      try {
        await saveOptionalFields();
      } catch (optionalError) {
        console.error(
          "Failed to save optional profile fields:",
          optionalError
        );
      }

      navigate(nextPath, { replace: true });
    } catch (submitError) {
      console.error("Failed to save emergency contact:", submitError);
      setError(
        getApiErrorKey(submitError instanceof Error ? submitError.message : "")
      );
      setSavingAction(null);
    }
  }

  async function handleSkip() {
    if (!canSubmit) {
      return;
    }

    setSavingAction("skip");
    setError("");

    try {
      await saveContact();
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      console.error("Failed to save emergency contact:", submitError);
      setError(
        getApiErrorKey(submitError instanceof Error ? submitError.message : "")
      );
      setSavingAction(null);
    }
  }

  if (!getAccessToken()) {
    return null;
  }

  /* ======================================================= */
  /* PAGE */
  /* ======================================================= */

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Header */}
      <header className="flex h-[72px] items-center justify-between border-b border-[#E5EEEB] bg-white px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <img src={logo2} alt={t("auth.logoAlt")} className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-[#18323A]">
            Najda<span className="text-[#19A878]">AI</span>
          </span>
        </div>

        <AppearanceControls compact />
      </header>

      <main className="px-6 py-10 lg:px-10">
        <div className="mx-auto w-full max-w-3xl">

          {/* Intro */}
          <div className="mb-7 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F0]">
              <ShieldAlert size={22} className="text-[#D94B4B]" />
            </div>

            <div>
              <h1 className="text-[24px] font-bold text-[#182B3A]">
                {t("completeProfile.title")}
              </h1>
              <p className="mt-1 text-[15px] leading-6 text-[#64748B]">
                {t("completeProfile.description")}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {t(error)}
            </div>
          )}

          {loadStatus === "loading" && (
            <p className="mb-4 text-[13px] text-[#8A989D]">{t("profile.loading")}</p>
          )}

          <form onSubmit={handleSaveAndContinue}>

            {/* Section 1: required emergency contact */}
            <section className="mb-5 overflow-hidden rounded-xl border border-[#E2E8E7] bg-white">
              <SectionHeader
                icon={Phone}
                title={t("profile.sections.emergency")}
                badge={t("completeProfile.requiredBadge")}
                badgeTone="required"
              />

              <div className="p-6">
                <p className="mb-5 text-[13px] leading-5 text-[#526572]">
                  {t("completeProfile.requiredNote")}
                </p>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label={t("profile.fields.contactName")}>
                    <InputShell icon={User}>
                      <input
                        type="text"
                        dir="auto"
                        className={inputBase}
                        placeholder={t("profile.placeholders.contactName")}
                        value={formData.emergencyName}
                        onChange={(e) => updateField("emergencyName", e.target.value)}
                      />
                    </InputShell>
                  </Field>

                  <Field label={t("profile.fields.phoneNumber")}>
                    <InputShell icon={Smartphone}>
                      <input
                        type="tel"
                        dir="ltr"
                        className={inputBase}
                        placeholder={t("profile.placeholders.phoneNumber")}
                        value={formData.emergencyPhone}
                        onChange={(e) => updateField("emergencyPhone", e.target.value)}
                      />
                    </InputShell>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label={t("completeProfile.emailOptionalLabel")}>
                      <InputShell icon={Mail}>
                        <input
                          type="email"
                          dir="ltr"
                          className={inputBase}
                          placeholder={t("profile.placeholders.emergencyEmail")}
                          value={formData.emergencyEmail}
                          onChange={(e) => updateField("emergencyEmail", e.target.value)}
                        />
                      </InputShell>
                    </Field>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: optional medical info */}
            <section className="mb-6 overflow-hidden rounded-xl border border-[#E2E8E7] bg-white">
              <SectionHeader
                icon={HeartPulse}
                title={t("completeProfile.optionalTitle")}
                badge={t("completeProfile.optionalBadge")}
                badgeTone="optional"
              />

              <div className="p-6">
                <p className="mb-5 text-[13px] leading-5 text-[#526572]">
                  {t("completeProfile.optionalNote")}
                </p>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label={t("profile.fields.patientId")}>
                    <InputShell icon={CreditCard}>
                      <input
                        type="text"
                        dir="ltr"
                        className={inputBase}
                        placeholder={t("profile.placeholders.patientId")}
                        value={formData.patientId}
                        onChange={(e) => updateField("patientId", e.target.value)}
                      />
                    </InputShell>
                  </Field>

                  <Field label={t("profile.fields.dateOfBirth")}>
                    <InputShell icon={CalendarDays}>
                      <input
                        type="date"
                        className={inputBase}
                        value={formData.dateOfBirth}
                        onChange={(e) => updateField("dateOfBirth", e.target.value)}
                      />
                    </InputShell>
                  </Field>

                  <Field label={t("profile.fields.gender")}>
                    <InputShell icon={User}>
                      <select
                        className={`${inputBase} cursor-pointer appearance-none`}
                        value={formData.gender}
                        onChange={(e) => updateField("gender", e.target.value)}
                      >
                        <option value="">{t("profile.placeholders.gender")}</option>
                        <option value="Male">{t("profile.gender.male")}</option>
                        <option value="Female">{t("profile.gender.female")}</option>
                        <option value="Prefer not to say">
                          {t("profile.gender.preferNotToSay")}
                        </option>
                      </select>
                    </InputShell>
                  </Field>

                  <Field label={t("profile.fields.bloodType")}>
                    <InputShell icon={Droplet}>
                      <select
                        className={`${inputBase} cursor-pointer appearance-none`}
                        value={formData.bloodType}
                        onChange={(e) => updateField("bloodType", e.target.value)}
                      >
                        <option value="">{t("profile.placeholders.bloodType")}</option>
                        {BLOOD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </InputShell>
                  </Field>
                </div>

                <div className="mt-6">
                  <label className="text-[13px] font-medium text-[#526572]">
                    {t("profile.fields.chronicDiseases")}
                  </label>
                  <p className="mt-1 text-[12px] text-[#8A989D]">{t("profile.selectAll")}</p>

                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {CHRONIC_DISEASES.map(({ id, translationKey, icon: Icon }) => {
                      const active = chronicDiseases.includes(id);

                      return (
                        <button
                          type="button"
                          key={id}
                          onClick={() => toggleDisease(id)}
                          className={`
                            flex
                            h-12
                            items-center
                            gap-2
                            rounded-lg
                            border
                            px-3
                            text-[13px]
                            font-medium
                            transition
                            ${
                              active
                                ? "border-[#19A878] bg-[#EAF8F4] text-[#168267]"
                                : "border-[#DCE5E3] bg-white text-[#64748B] hover:border-[#B8DED4] hover:bg-[#F7FCFA]"
                            }
                          `}
                        >
                          <Icon size={17} className={active ? "text-[#19A878]" : "text-[#8A989D]"} />
                          <span className="truncate">{t(translationKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              {contactValid && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={!canSubmit}
                  className="
                    rounded-lg
                    border
                    border-[#D8E5E2]
                    bg-white
                    px-6
                    py-3
                    text-[14px]
                    font-medium
                    text-[#526572]
                    transition
                    hover:bg-[#F5FBF9]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {savingAction === "skip" ? t("completeProfile.saving") : t("completeProfile.skipRest")}
                </button>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="
                  flex
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  bg-[#19A878]
                  px-6
                  py-3
                  text-[14px]
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#15966B]
                  hover:shadow-md
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <Check size={17} />
                {savingAction === "continue" ? t("completeProfile.saving") : t("completeProfile.saveAndContinue")}
              </button>
            </div>

          </form>

        </div>
      </main>

    </div>
  );
}

export default CompleteProfile;
