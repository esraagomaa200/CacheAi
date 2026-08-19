import { useState } from "react";
import {
  User,
  CreditCard,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Droplet,
  Smartphone,
  Heart,
  Wind,
  HeartPulse,
  Activity,
  MoreHorizontal,
  Pencil,
  Phone,
  ArrowRight,
  CalendarDays,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import {
  API_BASE_URL,
  formatApiError,
  setAccessToken,
} from "../lib/api";

const CHRONIC_DISEASES = [
  { id: "diabetes", label: "Diabetes", icon: Smartphone },
  { id: "hypertension", label: "Hypertension", icon: Heart },
  { id: "asthma", label: "Asthma", icon: Wind },
  { id: "heart_disease", label: "Heart Disease", icon: HeartPulse },
  { id: "kidney_disease", label: "Kidney Disease", icon: Activity },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon className="w-5 h-5 text-emerald-600" strokeWidth={2} />

      <h2 className="text-base font-semibold text-emerald-600 whitespace-nowrap">
        {title}
      </h2>

      <div className="h-px bg-gray-200 flex-1 ml-2" />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function InputShell({ icon: Icon, children }) {
  return (
    <div className="relative flex items-center">
      <Icon className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      {children}
    </div>
  );
}

const inputBase =
  "w-full h-11 pl-10 pr-4 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder-gray-400 bg-white outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export default function SignupFormFields() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    patientId: "",
    email: "",
    password: "",
    bloodType: "",
    otherCondition: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyEmail: "",
    agreeTerms: false,
    dateOfBirth: "",
    gender: "",
  });

  const [chronicDiseases, setChronicDiseases] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Update any form field
  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  // Select / unselect chronic disease
  const toggleDisease = (id) => {
    setChronicDiseases((prev) =>
      prev.includes(id)
        ? prev.filter((disease) => disease !== id)
        : [...prev, id]
    );
  };

  // Validate form
  const validate = () => {
    const nextErrors = {};

    if (!formData.fullName.trim()) {
      nextErrors.fullName = "Enter your full name";
    }

    if (!formData.email.trim()) {
      nextErrors.email = "Enter your email";
    }

    if (!formData.password.trim()) {
      nextErrors.password = "Create a password";
    }

    if (!formData.agreeTerms) {
      nextErrors.agreeTerms = "You must accept the terms";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  // Submit form
const handleSubmit = async (e) => {
  e.preventDefault();

  // Stop if validation fails
  if (!validate()) {
    return;
  }

  // Convert disease IDs into readable names
  const selectedDiseases = chronicDiseases
    .filter((id) => id !== "other")
    .map((id) => {
      const disease = CHRONIC_DISEASES.find(
        (item) => item.id === id
      );

      return disease ? disease.label : id;
    });

  // Add "Other" condition
  if (
    chronicDiseases.includes("other") &&
    formData.otherCondition.trim()
  ) {
    selectedDiseases.push(
      formData.otherCondition.trim()
    );
  }

  try {
    /*
     * Send ALL signup data to backend
     */

    const response = await fetch(
            `${API_BASE_URL}/auth/register`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,

          patient_id: formData.patientId,

          date_of_birth:
            formData.dateOfBirth || null,

          gender:
            formData.gender || null,

          blood_type:
            formData.bloodType || null,

          chronic_conditions:
            selectedDiseases,

          emergency_name:
            formData.emergencyName || null,

          emergency_phone:
            formData.emergencyPhone || null,

          emergency_email:
            formData.emergencyEmail || null,
        }),
      }
    );

    const result = await response.json();

    /*
     * Backend returned an error
     */

    if (!response.ok) {
      throw new Error(
        formatApiError(result, response.status)
      );
    }

    /*
     * Save access token if backend returns one
     */

    if (result.access_token) {
            setAccessToken(result.access_token);

    }

    /*
     * We no longer save profileData in localStorage.
     *
     * Profile page will get the data from PostgreSQL
     * using GET /profile/me
     */

    console.log(
      "Registration successful:",
      result
    );

    /*
     * Go to profile
     */

    navigate("/profile");

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    setErrors({
      submit:
        error.message ||
        "Something went wrong while creating your account.",
    });
  }
};

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Create Your Account
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Fill in your information to get started.
        </p>
      </div>

     {/* Personal Information */}
<section className="mb-8">

  <SectionHeader
    icon={User}
    title="Personal Information"
  />

  {/* Full Name + Patient ID */}
  <div className="grid grid-cols-2 gap-4 mb-4">

    {/* Full Name */}
    <Field label="Full Name">
      <InputShell icon={User}>
        <input
          className={inputBase}
          placeholder="Enter your full name"
          value={formData.fullName}
          onChange={(e) =>
            updateField("fullName", e.target.value)
          }
        />
      </InputShell>

      {errors.fullName && (
        <span className="text-xs text-red-500">
          {errors.fullName}
        </span>
      )}
    </Field>


    {/* Patient ID */}
    <Field label="Patient ID">
      <InputShell icon={CreditCard}>
        <input
          className={inputBase}
          placeholder="Enter your ID number"
          value={formData.patientId}
          onChange={(e) =>
            updateField("patientId", e.target.value)
          }
        />
      </InputShell>
    </Field>

  </div>


  {/* Date of Birth + Gender */}
  <div className="grid grid-cols-2 gap-4 mb-4">

    {/* Date of Birth */}
    <Field label="Date of Birth">
      <InputShell icon={CalendarDays}>
        <input
          type="date"
          className={inputBase}
          value={formData.dateOfBirth}
          onChange={(e) =>
            updateField("dateOfBirth", e.target.value)
          }
        />
      </InputShell>

      {errors.dateOfBirth && (
        <span className="text-xs text-red-500">
          {errors.dateOfBirth}
        </span>
      )}
    </Field>


    {/* Gender */}
    <Field label="Gender">
      <InputShell icon={User}>
        <select
          className={`${inputBase} appearance-none cursor-pointer`}
          value={formData.gender}
          onChange={(e) =>
            updateField("gender", e.target.value)
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

      {errors.gender && (
        <span className="text-xs text-red-500">
          {errors.gender}
        </span>
      )}
    </Field>

  </div>


  {/* Email + Password */}
  <div className="grid grid-cols-2 gap-4">

    {/* Email */}
    <Field label="Email Address">
      <InputShell icon={Mail}>
        <input
          type="email"
          className={inputBase}
          placeholder="Enter your email"
          value={formData.email}
          onChange={(e) =>
            updateField("email", e.target.value)
          }
        />
      </InputShell>

      {errors.email && (
        <span className="text-xs text-red-500">
          {errors.email}
        </span>
      )}
    </Field>


    {/* Password */}
    <Field label="Password">
      <div className="relative flex items-center">

        <Lock className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />

        <input
          type={showPassword ? "text" : "password"}
          className={`${inputBase} pr-10`}
          placeholder="Create a password"
          value={formData.password}
          onChange={(e) =>
            updateField("password", e.target.value)
          }
        />

        <button
          type="button"
          onClick={() =>
            setShowPassword((s) => !s)
          }
          className="absolute right-3 text-gray-400 hover:text-gray-600"
          aria-label={
            showPassword
              ? "Hide password"
              : "Show password"
          }
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>

      </div>

      {errors.password && (
        <span className="text-xs text-red-500">
          {errors.password}
        </span>
      )}
    </Field>

  </div>

</section>
      {/* Medical Information */}
      <section className="mb-8">

        <SectionHeader
          icon={Droplet}
          title="Medical Information"
        />

        {/* Blood Type */}
        <div className="mb-5">
          <Field label="Blood Type">

            <div className="relative flex items-center">

              <Droplet className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />

              <select
                className={`${inputBase} appearance-none pr-8`}
                value={formData.bloodType}
                onChange={(e) =>
                  updateField("bloodType", e.target.value)
                }
              >
                <option value="">
                  Select your blood type
                </option>

                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>

            </div>

          </Field>
        </div>

        {/* Chronic Diseases */}
        <div className="mb-2">
          <label className="text-sm font-medium text-gray-700">
            Chronic Diseases{" "}
            <span className="text-gray-400 font-normal">
              (Select all that apply)
            </span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">

          {CHRONIC_DISEASES.map(
            ({ id, label, icon: Icon }) => {

              const active =
                chronicDiseases.includes(id);

              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleDisease(id)}
                  className={`flex items-center gap-2 h-11 px-3 rounded-lg border text-sm transition-colors ${
                    active
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />

                  <span className="truncate">
                    {label}
                  </span>
                </button>
              );
            }
          )}

        </div>

        {/* Other Condition */}
        {chronicDiseases.includes("other") && (
          <Field label="If other, please specify">

            <InputShell icon={Pencil}>
              <input
                className={inputBase}
                placeholder="Please specify your condition"
                value={formData.otherCondition}
                onChange={(e) =>
                  updateField(
                    "otherCondition",
                    e.target.value
                  )
                }
              />
            </InputShell>

          </Field>
        )}

      </section>

      {/* Emergency Contact */}
      <section className="mb-6">

        <SectionHeader
          icon={Phone}
          title="Emergency Contact Information"
        />

        {/* Contact Name */}
        <div className="mb-4">

          <Field label="Emergency Contact Name">

            <InputShell icon={User}>
              <input
                className={inputBase}
                placeholder="Enter contact name"
                value={formData.emergencyName}
                onChange={(e) =>
                  updateField(
                    "emergencyName",
                    e.target.value
                  )
                }
              />
            </InputShell>

          </Field>

        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Phone */}
          <Field label="Emergency Phone Number">

            <InputShell icon={Smartphone}>
              <input
                className={inputBase}
                placeholder="Enter phone number"
                value={formData.emergencyPhone}
                onChange={(e) =>
                  updateField(
                    "emergencyPhone",
                    e.target.value
                  )
                }
              />
            </InputShell>

          </Field>

          {/* Email */}
          <Field label="Emergency Email">

            <InputShell icon={Mail}>
              <input
                type="email"
                className={inputBase}
                placeholder="Enter email address"
                value={formData.emergencyEmail}
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

      </section>

      {/* Terms */}
      <div className="mb-6">

        <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">

          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            checked={formData.agreeTerms}
            onChange={(e) =>
              updateField(
                "agreeTerms",
                e.target.checked
              )
            }
          />

          <span>
            I agree to the{" "}

            <a
              href="#"
              className="text-emerald-600 hover:underline"
            >
              Terms of Service
            </a>{" "}

            and{" "}

            <a
              href="#"
              className="text-emerald-600 hover:underline"
            >
              Privacy Policy
            </a>
          </span>

        </label>

        {errors.agreeTerms && (
          <span className="block text-xs text-red-500 mt-1">
            {errors.agreeTerms}
          </span>
        )}

      </div>

        {errors.submit && (
  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
    {errors.submit}
  </div>
)}

      {/* Create Account */}
      <button
        type="submit"
        className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all text-white font-medium flex items-center justify-center gap-2"
      >
        Create Account

        <ArrowRight className="w-4 h-4" />
      </button>

      {/* Sign In */}
      <p className="text-center text-sm text-gray-500 mt-4">

        Already have an account?{" "}

        <a
          href="#"
          className="text-emerald-600 hover:underline font-medium"
        >
          Sign in
        </a>

      </p>

    </form>
  );
}