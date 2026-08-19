import { useEffect, useState } from "react";
import {
  User,
  Mail,
  CreditCard,
  Droplet,
  HeartPulse,
  Phone,
  ShieldCheck,
  Pencil,
  ChevronRight,
  Activity,
  Heart,
  Wind,
} from "lucide-react";

import SidebarProfile from "../components/SidebarProfile";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, mapBackendProfileToForm } from "../lib/api";
import { getApiErrorKey } from "../i18n/api-error";
import { getFormattingLocale } from "../i18n/language";

function formatProfileDate(value, language) {
  if (!value) return "";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(getFormattingLocale(language), {
    dateStyle: "medium",
  }).format(date);
}

function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!localStorage.getItem("accessToken")) {
          setError("profile.unauthenticated");
          setLoading(false);
          return;
        }

        const data = await apiFetch("/profile/me");

        // ------------------------------------------------
        // Convert backend response to frontend structure
        // ------------------------------------------------

        const formattedProfile = mapBackendProfileToForm(data);

        setProfile(formattedProfile);

      } catch (err) {
        console.error("Failed to load profile:", err);

        setError(getApiErrorKey(err instanceof Error ? err.message : ""));

      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);


  /* ================================================= */
  /* LOADING */
  /* ================================================= */

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFB]">
        <SidebarProfile />

        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">

            <div
              className="
                mx-auto
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-[#EAF8F4]
              "
            >
              <User
                size={24}
                className="text-[#19A878]"
              />
            </div>

            <p className="text-[15px] font-medium text-[#526572]">
              {t("profile.loading")}
            </p>

          </div>
        </main>
      </div>
    );
  }


  /* ================================================= */
  /* ERROR */
  /* ================================================= */

  if (error || !profile) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFB]">
        <SidebarProfile />

        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">

            <div
              className="
                mx-auto
                mb-3
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-[#EAF8F4]
              "
            >
              <User
                size={24}
                className="text-[#19A878]"
              />
            </div>

            <p className="text-[15px] font-medium text-[#526572]">
              {error ? t(error) : t("profile.noData")}
            </p>

            <button
              onClick={() => navigate("/login")}
              className="
                mt-4
                rounded-lg
                bg-[#19A878]
                px-4
                py-2
                text-sm
                font-medium
                text-white
                hover:bg-[#168F68]
              "
            >
              {t("profile.goToLogin")}
            </button>

          </div>
        </main>
      </div>
    );
  }


  const chronicDiseases = Array.isArray(
    profile.chronicDiseases
  )
    ? profile.chronicDiseases
    : profile.chronicDiseases
      ? [profile.chronicDiseases]
      : [];

  const formattedDateOfBirth = formatProfileDate(
    profile.dateOfBirth,
    i18n.language
  );


  return (
    <div className="flex min-h-screen bg-[#F8FAFB]">

      {/* ================= SIDEBAR ================= */}

      <SidebarProfile />


      {/* ================= MAIN ================= */}

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-7 lg:px-8 xl:px-10">

        <div className="mx-auto w-full max-w-7xl">

          {/* ================= HEADER ================= */}

          <div className="mb-7 flex items-start justify-between gap-4">

            <div>

              <h1 className="text-[27px] font-bold text-[#182B3A]">
                {t("profile.title")}
              </h1>

              <p className="mt-1 text-[16px] text-[#64748B]">
                {t("profile.description")}
              </p>

            </div>


            <button
              type="button"
              onClick={() => navigate("/edit-profile")}
              className="
                flex
                shrink-0
                items-center
                gap-2
                rounded-lg
                border
                border-[#B8DED4]
                bg-white
                px-4
                py-2
                text-[14px]
                font-medium
                text-[#167D64]
                transition
                hover:bg-[#F0FAF7]
                hover:border-[#19A878]
              "
            >
              <Pencil size={15} />
              {t("profile.editProfile")}
            </button>

          </div>


          {/* ================= PROFILE SUMMARY ================= */}

          <div
            className="
              mb-5
              rounded-xl
              border
              border-[#DCEBE7]
              bg-[#F7FCFA]
              px-6
              py-5
              lg:px-7
            "
          >

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

              {/* USER INFO */}

              <div className="flex items-center gap-5">

                <div
                  className="
                    flex
                    h-[68px]
                    w-[68px]
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#BFE8DD]
                    bg-[#F0FAF7]
                  "
                >
                  <User
                    size={34}
                    strokeWidth={1.5}
                    className="text-[#19A878]"
                  />
                </div>


                <div className="min-w-0">

                  <div className="flex flex-wrap items-center gap-2">

                    <h2
                      className="text-[20px] font-bold text-[#182B3A]"
                      dir="auto"
                    >
                      {profile.fullName || t("profile.patient")}
                    </h2>

                    <span
                      className="
                        rounded-full
                        bg-[#E5F6F0]
                        px-2.5
                        py-1
                        text-[12px]
                        font-semibold
                        text-[#15966B]
                      "
                    >
                      {t("profile.patient")}
                    </span>

                  </div>


                  <div className="mt-2 space-y-1.5">

                    <div className="flex items-center gap-2 text-[14px] text-[#64748B]">

                      <Mail size={15} />

                      <span dir="auto">
                        {profile.email || t("profile.emptyValue")}
                      </span>

                    </div>


                    <div className="flex items-center gap-2 text-[14px] text-[#64748B]">

                      <CreditCard size={15} />

                      <span>
                        {t("profile.fields.patientId")}: {" "}
                        <span dir="auto">
                          {profile.patientId || t("profile.emptyValue")}
                        </span>
                      </span>

                    </div>

                  </div>

                </div>

              </div>


              {/* SUMMARY CARDS */}

              <div className="flex flex-wrap gap-3">

                {/* Blood Type */}

                <div
                  className="
                    flex
                    h-[78px]
                    min-w-[140px]
                    items-center
                    gap-3
                    rounded-lg
                    border
                    border-[#E3ECEA]
                    bg-white
                    px-4
                  "
                >

                  <Droplet
                    size={30}
                    strokeWidth={1.7}
                    className="text-[#19A878]"
                  />

                  <div>

                    <p className="text-[13px] text-[#64748B]">
                      {t("profile.fields.bloodType")}
                    </p>

                    <p
                      className="mt-0.5 text-[17px] font-semibold text-[#182B3A]"
                      dir="auto"
                    >
                      {profile.bloodType || t("profile.emptyValue")}
                    </p>

                  </div>

                </div>


                {/* Conditions */}

                <div
                  className="
                    flex
                    h-[78px]
                    min-w-[160px]
                    items-center
                    gap-3
                    rounded-lg
                    border
                    border-[#E3ECEA]
                    bg-white
                    px-4
                  "
                >

                  <HeartPulse
                    size={30}
                    strokeWidth={1.7}
                    className="text-[#19A878]"
                  />

                  <div>

                    <p className="text-[13px] text-[#64748B]">
                      {t("profile.conditions")}
                    </p>

                    <p className="mt-0.5 text-[17px] font-semibold text-[#182B3A]">
                      {chronicDiseases.length}
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* ================= PERSONAL + MEDICAL ================= */}

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">

            {/* PERSONAL */}

            <section
              className="
                overflow-hidden
                rounded-xl
                border
                border-[#E2E8E7]
                bg-white
              "
            >

              <SectionHeader
                icon={<User size={17} />}
                title={t("profile.sections.personal")}
              />

              <div className="px-5">

                <InfoRow
                  label={t("profile.fields.fullName")}
                  value={profile.fullName}
                />

                <InfoRow
                  label={t("profile.fields.patientId")}
                  value={profile.patientId}
                />

                <InfoRow
                  label={t("profile.fields.email")}
                  value={profile.email}
                />

                <InfoRow
                  label={t("profile.fields.dateOfBirth")}
                  value={formattedDateOfBirth}
                />

                <InfoRow
                  label={t("profile.fields.gender")}
                  value={profile.gender}
                  last
                />

              </div>

            </section>


            {/* MEDICAL */}

            <section
              className="
                overflow-hidden
                rounded-xl
                border
                border-[#E2E8E7]
                bg-white
              "
            >

              <SectionHeader
                icon={<HeartPulse size={17} />}
                title={t("profile.sections.medical")}
              />

              <div className="px-5">

                <InfoRow
                  label={t("profile.fields.bloodType")}
                  value={profile.bloodType}
                />


                <div className="flex min-h-[78px] items-start border-b border-[#EDF1F0] py-4">

                  <span className="w-[155px] shrink-0 text-[13px] text-[#64748B]">
                    {t("profile.fields.chronicConditions")}
                  </span>

                  <div className="flex flex-wrap gap-2">

                    {chronicDiseases.length > 0 ? (

                      chronicDiseases.map(
                        (disease, index) => (
                          <DiseaseTag
                            key={`${disease}-${index}`}
                            disease={disease}
                          />
                        )
                      )

                    ) : (

                      <span className="text-[13px] text-gray-400">
                        {t("profile.none")}
                      </span>

                    )}

                  </div>

                </div>

                <InfoRow
                  label={t("profile.fields.dateOfBirth")}
                  value={formattedDateOfBirth}
                  last
                />

              </div>

            </section>

          </div>


          {/* ================= EMERGENCY ================= */}

          <section
            className="
              mb-5
              overflow-hidden
              rounded-xl
              border
              border-[#E2E8E7]
              bg-white
            "
          >

            <SectionHeader
              icon={<Phone size={17} />}
              title={t("profile.sections.emergency")}
            />

            <div className="flex flex-col px-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="w-full lg:w-[55%]">

                <InfoRow
                  label={t("profile.fields.contactName")}
                  value={profile.emergencyName}
                />

                <InfoRow
                  label={t("profile.fields.phoneNumber")}
                  value={profile.emergencyPhone}
                />

                <InfoRow
                  label={t("profile.fields.email")}
                  value={profile.emergencyEmail}
                  last
                />

              </div>


              <div
                className="
                  my-5
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-lg
                  border
                  border-[#E1EFEB]
                  bg-[#F5FBF9]
                  px-4
                  py-4
                  lg:my-0
                  lg:w-[40%]
                "
              >

                <ShieldCheck
                  size={29}
                  strokeWidth={1.7}
                  className="shrink-0 text-[#19A878]"
                />

                <p className="text-[13px] leading-5 text-[#526572]">
                  {t("profile.emergencyNote")}
                </p>

              </div>

            </div>

          </section>


          {/* ================= SECURITY ================= */}

          <div
            className="
              flex
              items-center
              justify-between
              rounded-xl
              border
              border-[#E1EFEB]
              bg-[#F5FBF9]
              px-5
              py-4
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  bg-[#DDF4EC]
                "
              >

                <ShieldCheck
                  size={19}
                  className="text-[#19A878]"
                />

              </div>

              <div>

                <p className="text-[13px] font-semibold text-[#263746]">
                  {t("profile.securityTitle")}
                </p>

                <p className="mt-0.5 text-[11px] leading-4 text-[#71808A]">
                  {t("profile.securityDescription")}
                </p>

              </div>

            </div>

            <ChevronRight
              size={18}
              className="text-[#78908A]"
            />

          </div>

        </div>

      </main>

    </div>
  );
}


/* ========================================================= */
/* SECTION HEADER */
/* ========================================================= */

function SectionHeader({ icon, title }) {
  return (
    <div
      className="
        flex
        items-center
        gap-2.5
        border-b
        border-[#EDF1F0]
        px-5
        py-4
      "
    >

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

        <span className="text-[#19A878]">
          {icon}
        </span>

      </div>

      <h3 className="text-[15px] font-semibold text-[#263746]">
        {title}
      </h3>

    </div>
  );
}


/* ========================================================= */
/* INFO ROW */
/* ========================================================= */

function InfoRow({
  label,
  value,
  last = false,
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`
        flex
        min-h-[48px]
        items-center
        border-b
        border-[#EDF1F0]
        py-3
        ${last ? "border-b-0" : ""}
      `}
    >

      <span className="w-[155px] shrink-0 text-[13px] text-[#64748B]">
        {label}
      </span>

      <span
        className="break-words text-[14px] font-medium text-[#263746]"
        dir="auto"
      >
        {value || t("profile.emptyValue")}
      </span>

    </div>
  );
}


/* ========================================================= */
/* DISEASE TAG */
/* ========================================================= */

function DiseaseTag({ disease }) {

  let Icon = Activity;

  const lowerDisease =
    String(disease).toLowerCase();

  if (lowerDisease.includes("diabetes")) {
    Icon = Activity;
  } else if (
    lowerDisease.includes("hypertension")
  ) {
    Icon = Heart;
  } else if (
    lowerDisease.includes("asthma")
  ) {
    Icon = Wind;
  } else if (
    lowerDisease.includes("heart")
  ) {
    Icon = HeartPulse;
  }

  return (
    <span
      dir="auto"
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-md
        bg-[#EDF9F5]
        px-2.5
        py-1.5
        text-[12px]
        font-medium
        text-[#168267]
      "
    >

      <Icon size={13} />

      {disease}

    </span>
  );
}


export default Profile;
