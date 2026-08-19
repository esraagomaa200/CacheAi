import { useEffect, useState } from "react";

import {
  User,
  CreditCard,
  Mail,
  CalendarDays,
  Droplet,
  HeartPulse,
  Phone,
  Smartphone,
  Heart,
  Wind,
  Activity,
  MoreHorizontal,
  ArrowLeft,
  Check,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import SidebarProfile from "../components/SidebarProfile";
import {
  apiFetch,
  mapBackendProfileToForm,
  profileFormToBackendPayload,
} from "../lib/api";
import { getApiErrorKey } from "../i18n/api-error";


/* ========================================================= */
/* CHRONIC DISEASES */
/* ========================================================= */

const CHRONIC_DISEASES = [
  {
    id: "Diabetes",
    translationKey: "profile.diseases.diabetes",
    icon: Activity,
  },
  {
    id: "Hypertension",
    translationKey: "profile.diseases.hypertension",
    icon: Heart,
  },
  {
    id: "Asthma",
    translationKey: "profile.diseases.asthma",
    icon: Wind,
  },
  {
    id: "Heart Disease",
    translationKey: "profile.diseases.heartDisease",
    icon: HeartPulse,
  },
  {
    id: "Kidney Disease",
    translationKey: "profile.diseases.kidneyDisease",
    icon: Activity,
  },
];

const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];


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

function SectionHeader({ icon: Icon, title }) {
  return (
    <div
      className="
        flex
        items-center
        gap-2
        border-b
        border-[#EDF1F0]
        px-6
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
        <Icon
          size={17}
          className="text-[#19A878]"
        />
      </div>

      <h2 className="text-[15px] font-semibold text-[#263746]">
        {title}
      </h2>

    </div>
  );
}


/* ========================================================= */
/* FIELD */
/* ========================================================= */

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">

      <label className="text-[13px] font-medium text-[#526572]">
        {label}
      </label>

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

      <Icon
        size={17}
        className="
          pointer-events-none
          absolute
          left-3
          text-[#9AA7AC]
        "
      />

      {children}

    </div>
  );
}


/* ========================================================= */
/* EDIT PROFILE */
/* ========================================================= */

function EditProfile() {

  const { t } = useTranslation();
  const navigate = useNavigate();


  /* ======================================================= */
  /* FORM DATA */
  /* ======================================================= */

  const [formData, setFormData] = useState({
    fullName: "",
    patientId: "",
    email: "",
    dateOfBirth: "",
    gender: "",

    bloodType: "",

    emergencyName: "",
    emergencyPhone: "",
    emergencyEmail: "",

    otherCondition: "",
  });


  /* ======================================================= */
  /* CHRONIC DISEASES */
  /* ======================================================= */

  const [chronicDiseases, setChronicDiseases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadStatus, setLoadStatus] = useState("loading");


  /* ======================================================= */
  /* LOAD PROFILE FROM BACKEND */
  /* ======================================================= */

  useEffect(() => {
    const loadProfile = async () => {
      if (!localStorage.getItem("accessToken")) {
        navigate("/login");
        return;
      }

      try {
        const data = await apiFetch("/profile/me");
        const profile = mapBackendProfileToForm(data);

        setFormData({
          fullName: profile.fullName,
          patientId: profile.patientId,
          email: profile.email,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          bloodType: profile.bloodType,
          emergencyName: profile.emergencyName,
          emergencyPhone: profile.emergencyPhone,
          emergencyEmail: profile.emergencyEmail,
          otherCondition: "",
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


  /* ======================================================= */
  /* UPDATE FIELD */
  /* ======================================================= */

  const updateField = (
    field,
    value
  ) => {

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

  };


  /* ======================================================= */
  /* TOGGLE DISEASE */
  /* ======================================================= */

  const toggleDisease = (
    disease
  ) => {

    setChronicDiseases((prev) => {

      if (prev.includes(disease)) {

        return prev.filter(
          (item) => item !== disease
        );

      }

      return [
        ...prev,
        disease,
      ];

    });

  };


  /* ======================================================= */
  /* SAVE CHANGES */
  /* ======================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loadStatus !== "loaded" || saving) {
      return;
    }
    setSaving(true);
    setError("");

    try {
      await apiFetch("/profile/me", {
        method: "PUT",
        body: JSON.stringify(
          profileFormToBackendPayload(formData, chronicDiseases)
        ),
      });

      navigate("/profile");
    } catch (submitError) {
      console.error("Failed to update profile:", submitError);
      setError(
        getApiErrorKey(submitError instanceof Error ? submitError.message : "")
      );
    } finally {
      setSaving(false);
    }
  };


  /* ======================================================= */
  /* PAGE */
  /* ======================================================= */

  return (

    <div className="flex min-h-screen bg-[#F8FAFB]">

      {/* =================================================== */}
      {/* SIDEBAR */}
      {/* =================================================== */}

      <SidebarProfile />


      {/* =================================================== */}
      {/* MAIN */}
      {/* =================================================== */}

      <main
        className="
          min-w-0
          flex-1
          overflow-y-auto
          px-6
          py-7
          lg:px-8
          xl:px-10
        "
      >

        <div className="mx-auto w-full max-w-5xl">


          {/* ================================================= */}
          {/* HEADER */}
          {/* ================================================= */}

          <div
            className="
              mb-7
              flex
              items-start
              justify-between
              gap-4
            "
          >

            <div>

              <h1
                className="
                  text-[27px]
                  font-bold
                  text-[#182B3A]
                "
              >
                {t("profile.editProfile")}
              </h1>

              <p
                className="
                  mt-1
                  text-[16px]
                  text-[#64748B]
                "
              >
                {t("profile.editDescription")}
              </p>

            </div>


            {/* Back Button */}

            <button
              type="button"
              onClick={() =>
                navigate("/profile")
              }
              className="
                flex
                shrink-0
                items-center
                gap-2
                rounded-lg
                border
                border-[#D8E5E2]
                bg-white
                px-4
                py-2
                text-[14px]
                font-medium
                text-[#526572]
                transition
                hover:bg-[#F5FBF9]
              "
            >

              <ArrowLeft size={16} className="rtl-flip" />

              {t("profile.backToProfile")}

            </button>

          </div>


          {/* ================================================= */}
          {/* FORM */}
          {/* ================================================= */}

          <form
            onSubmit={handleSubmit}
          >
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {t(error)}
              </div>
            )}


            {/* ================================================= */}
            {/* PERSONAL INFORMATION */}
            {/* ================================================= */}

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
                icon={User}
                title={t("profile.sections.personal")}
              />


              <div className="p-6">

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-5
                    md:grid-cols-2
                  "
                >


                  {/* Full Name */}

                  <Field label={t("profile.fields.fullName")}>

                    <InputShell icon={User}>

                      <input
                        type="text"
                        dir="auto"
                        className={inputBase}
                        placeholder={t("profile.placeholders.fullName")}
                        value={
                          formData.fullName
                        }
                        onChange={(e) =>
                          updateField(
                            "fullName",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Patient ID */}

                  <Field label={t("profile.fields.patientId")}>

                    <InputShell
                      icon={CreditCard}
                    >

                      <input
                        type="text"
                        dir="ltr"
                        className={inputBase}
                        placeholder={t("profile.placeholders.patientId")}
                        value={
                          formData.patientId
                        }
                        onChange={(e) =>
                          updateField(
                            "patientId",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Email */}

                  <Field label={t("profile.fields.email")}>

                    <InputShell icon={Mail}>

                      <input
                        type="email"
                        dir="ltr"
                        className={inputBase}
                        placeholder={t("profile.placeholders.email")}
                        value={
                          formData.email
                        }
                        onChange={(e) =>
                          updateField(
                            "email",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Date of Birth */}

                  <Field label={t("profile.fields.dateOfBirth")}>

                    <InputShell
                      icon={CalendarDays}
                    >

                      <input
                        type="date"
                        className={inputBase}
                        value={
                          formData.dateOfBirth
                        }
                        onChange={(e) =>
                          updateField(
                            "dateOfBirth",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Gender */}

                  <Field label={t("profile.fields.gender")}>

                    <InputShell icon={User}>

                      <select
                        className={`${inputBase} cursor-pointer appearance-none`}
                        value={
                          formData.gender
                        }
                        onChange={(e) =>
                          updateField(
                            "gender",
                            e.target.value
                          )
                        }
                      >

                        <option value="">
                          {t("profile.placeholders.gender")}
                        </option>

                        <option value="Male">
                          {t("profile.gender.male")}
                        </option>

                        <option value="Female">
                          {t("profile.gender.female")}
                        </option>

                        <option value="Prefer not to say">
                          {t("profile.gender.preferNotToSay")}
                        </option>

                      </select>

                    </InputShell>

                  </Field>


                </div>

              </div>

            </section>


            {/* ================================================= */}
            {/* MEDICAL INFORMATION */}
            {/* ================================================= */}

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
                icon={HeartPulse}
                title={t("profile.sections.medical")}
              />


              <div className="p-6">


                {/* Blood Type */}

                <div className="mb-6">

                  <Field label={t("profile.fields.bloodType")}>

                    <InputShell
                      icon={Droplet}
                    >

                      <select
                        className={`${inputBase} cursor-pointer appearance-none`}
                        value={
                          formData.bloodType
                        }
                        onChange={(e) =>
                          updateField(
                            "bloodType",
                            e.target.value
                          )
                        }
                      >

                        <option value="">
                          {t("profile.placeholders.bloodType")}
                        </option>

                        {BLOOD_TYPES.map(
                          (type) => (

                            <option
                              key={type}
                              value={type}
                            >
                              {type}
                            </option>

                          )
                        )}

                      </select>

                    </InputShell>

                  </Field>

                </div>


                {/* Chronic Diseases */}

                <div>

                  <div className="mb-3">

                    <label
                      className="
                        text-[13px]
                        font-medium
                        text-[#526572]
                      "
                    >
                      {t("profile.fields.chronicDiseases")}
                    </label>

                    <p
                      className="
                        mt-1
                        text-[12px]
                        text-[#8A989D]
                      "
                    >
                      {t("profile.selectAll")}
                    </p>

                  </div>


                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-3
                      md:grid-cols-3
                    "
                  >

                    {CHRONIC_DISEASES.map(
                      ({
                        id,
                        translationKey,
                        icon: Icon,
                      }) => {

                        const active =
                          chronicDiseases.includes(
                            id
                          );

                        return (

                          <button
                            type="button"
                            key={id}
                            onClick={() =>
                              toggleDisease(
                                id
                              )
                            }
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

                            <Icon
                              size={17}
                              className={
                                active
                                  ? "text-[#19A878]"
                                  : "text-[#8A989D]"
                              }
                            />

                            <span className="truncate">
                              {t(translationKey)}
                            </span>

                          </button>

                        );

                      }
                    )}

                  </div>


                  {/* Other Condition */}

                  <div className="mt-5">

                    <Field label={t("profile.fields.otherCondition")}>

                      <InputShell
                        icon={MoreHorizontal}
                      >

                        <input
                          type="text"
                          dir="auto"
                          className={inputBase}
                          placeholder={t("profile.placeholders.otherCondition")}
                          value={
                            formData.otherCondition
                          }
                          onChange={(e) =>
                            updateField(
                              "otherCondition",
                              e.target.value
                            )
                          }
                        />

                      </InputShell>

                    </Field>

                  </div>

                </div>

              </div>

            </section>


            {/* ================================================= */}
            {/* EMERGENCY CONTACT */}
            {/* ================================================= */}

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
                icon={Phone}
                title={t("profile.sections.emergency")}
              />


              <div className="p-6">

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-5
                    md:grid-cols-2
                  "
                >


                  {/* Contact Name */}

                  <Field label={t("profile.fields.contactName")}>

                    <InputShell icon={User}>

                      <input
                        type="text"
                        dir="auto"
                        className={inputBase}
                        placeholder={t("profile.placeholders.contactName")}
                        value={
                          formData.emergencyName
                        }
                        onChange={(e) =>
                          updateField(
                            "emergencyName",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Phone */}

                  <Field label={t("profile.fields.phoneNumber")}>

                    <InputShell
                      icon={Smartphone}
                    >

                      <input
                        type="tel"
                        dir="ltr"
                        className={inputBase}
                        placeholder={t("profile.placeholders.phoneNumber")}
                        value={
                          formData.emergencyPhone
                        }
                        onChange={(e) =>
                          updateField(
                            "emergencyPhone",
                            e.target.value
                          )
                        }
                      />

                    </InputShell>

                  </Field>


                  {/* Emergency Email */}

                  <div className="md:col-span-2">

                    <Field label={t("profile.fields.email")}>

                      <InputShell icon={Mail}>

                        <input
                          type="email"
                          dir="ltr"
                          className={inputBase}
                          placeholder={t("profile.placeholders.emergencyEmail")}
                          value={
                            formData.emergencyEmail
                          }
                          onChange={(e) =>
                            updateField(
                              "emergencyEmail",
                              e.target.value
                            )
                          }
                        />

                      </InputShell>

                    </Field>

                  </div>

                </div>


                {/* Emergency Note */}

                <div
                  className="
                    mt-6
                    flex
                    items-start
                    gap-3
                    rounded-lg
                    border
                    border-[#E1EFEB]
                    bg-[#F5FBF9]
                    px-4
                    py-4
                  "
                >

                  <HeartPulse
                    size={20}
                    className="
                      mt-0.5
                      shrink-0
                      text-[#19A878]
                    "
                  />

                  <p
                    className="
                      text-[12px]
                      leading-5
                      text-[#526572]
                    "
                  >
                    {t("profile.editEmergencyNote")}
                  </p>

                </div>

              </div>

            </section>


            {/* ================================================= */}
            {/* ACTIONS */}
            {/* ================================================= */}

            <div
              className="
                mb-8
                flex
                items-center
                justify-end
                gap-3
              "
            >

              {/* Cancel */}

              <button
                type="button"
                onClick={() =>
                  navigate("/profile")
                }
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
                "
              >
                {t("profile.cancel")}
              </button>


              {/* Save */}

              <button
                type="submit"
                disabled={loadStatus !== "loaded" || saving}
                className="
                  flex
                  items-center
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

                {saving ? t("profile.saving") : t("profile.saveChanges")}

              </button>

            </div>


          </form>

        </div>

      </main>

    </div>

  );
}

export default EditProfile;
