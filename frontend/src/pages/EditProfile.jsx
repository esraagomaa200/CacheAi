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

import SidebarProfile from "../components/SidebarProfile";


/* ========================================================= */
/* CHRONIC DISEASES */
/* ========================================================= */

const CHRONIC_DISEASES = [
  {
    id: "Diabetes",
    label: "Diabetes",
    icon: Activity,
  },
  {
    id: "Hypertension",
    label: "Hypertension",
    icon: Heart,
  },
  {
    id: "Asthma",
    label: "Asthma",
    icon: Wind,
  },
  {
    id: "Heart Disease",
    label: "Heart Disease",
    icon: HeartPulse,
  },
  {
    id: "Kidney Disease",
    label: "Kidney Disease",
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


  /* ======================================================= */
  /* LOAD PROFILE */
  /* ======================================================= */

  useEffect(() => {

    const savedProfile =
      localStorage.getItem("profileData");

    if (!savedProfile) {
      navigate("/profile");
      return;
    }

    try {

      const profile = JSON.parse(savedProfile);

      setFormData({
        fullName: profile.fullName || "",
        patientId: profile.patientId || "",
        email: profile.email || "",

        dateOfBirth:
          profile.dateOfBirth || "",

        gender:
          profile.gender || "",

        bloodType:
          profile.bloodType || "",

        emergencyName:
          profile.emergencyName || "",

        emergencyPhone:
          profile.emergencyPhone || "",

        emergencyEmail:
          profile.emergencyEmail || "",

        otherCondition:
          profile.otherCondition || "",
      });


      if (Array.isArray(profile.chronicDiseases)) {

        setChronicDiseases(
          profile.chronicDiseases
        );

      }

    } catch (error) {

      console.error(
        "Failed to load profile:",
        error
      );

      navigate("/profile");

    }

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

  const handleSubmit = (e) => {

    e.preventDefault();


    const updatedProfile = {

      fullName:
        formData.fullName,

      patientId:
        formData.patientId,

      email:
        formData.email,

      dateOfBirth:
        formData.dateOfBirth,

      gender:
        formData.gender,

      bloodType:
        formData.bloodType,

      chronicDiseases:
        chronicDiseases,

      otherCondition:
        formData.otherCondition,

      emergencyName:
        formData.emergencyName,

      emergencyPhone:
        formData.emergencyPhone,

      emergencyEmail:
        formData.emergencyEmail,
    };


    localStorage.setItem(
      "profileData",
      JSON.stringify(
        updatedProfile
      )
    );


    navigate("/profile");

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
                Edit Profile
              </h1>

              <p
                className="
                  mt-1
                  text-[16px]
                  text-[#64748B]
                "
              >
                Update your personal and medical
                information.
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

              <ArrowLeft size={16} />

              Back to Profile

            </button>

          </div>


          {/* ================================================= */}
          {/* FORM */}
          {/* ================================================= */}

          <form
            onSubmit={handleSubmit}
          >


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
                title="Personal Information"
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

                  <Field label="Full Name">

                    <InputShell icon={User}>

                      <input
                        type="text"
                        className={inputBase}
                        placeholder="Enter your full name"
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

                  <Field label="Patient ID">

                    <InputShell
                      icon={CreditCard}
                    >

                      <input
                        type="text"
                        className={inputBase}
                        placeholder="Enter your ID"
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

                  <Field label="Email Address">

                    <InputShell icon={Mail}>

                      <input
                        type="email"
                        className={inputBase}
                        placeholder="Enter your email"
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

                  <Field label="Date of Birth">

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

                  <Field label="Gender">

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
                          Select your gender
                        </option>

                        <option value="Male">
                          Male
                        </option>

                        <option value="Female">
                          Female
                        </option>

                        <option value="Prefer not to say">
                          Prefer not to say
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
                title="Medical Information"
              />


              <div className="p-6">


                {/* Blood Type */}

                <div className="mb-6">

                  <Field label="Blood Type">

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
                          Select your blood type
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
                      Chronic Diseases
                    </label>

                    <p
                      className="
                        mt-1
                        text-[12px]
                        text-[#8A989D]
                      "
                    >
                      Select all that apply.
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
                        label,
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
                              {label}
                            </span>

                          </button>

                        );

                      }
                    )}

                  </div>


                  {/* Other Condition */}

                  <div className="mt-5">

                    <Field label="Other Condition">

                      <InputShell
                        icon={MoreHorizontal}
                      >

                        <input
                          type="text"
                          className={inputBase}
                          placeholder="Enter any other condition"
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
                title="Emergency Contact"
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

                  <Field label="Contact Name">

                    <InputShell icon={User}>

                      <input
                        type="text"
                        className={inputBase}
                        placeholder="Enter contact name"
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

                  <Field label="Phone Number">

                    <InputShell
                      icon={Smartphone}
                    >

                      <input
                        type="tel"
                        className={inputBase}
                        placeholder="Enter phone number"
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

                    <Field label="Email Address">

                      <InputShell icon={Mail}>

                        <input
                          type="email"
                          className={inputBase}
                          placeholder="Enter email address"
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
                    Keeping your emergency contact
                    information updated helps us provide
                    faster assistance when needed.
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
                Cancel
              </button>


              {/* Save */}

              <button
                type="submit"
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
                "
              >

                <Check size={17} />

                Save Changes

              </button>

            </div>


          </form>

        </div>

      </main>

    </div>

  );
}

export default EditProfile;