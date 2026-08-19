const en = {
  common: {
    user: "User",
    openUserMenu: "Open user menu",
    editProfile: "Edit Profile",
    logout: "Logout",
    noActiveAccount: "Please sign up or log in to view your profile.",
    checking: "Checking...",
  },
  navigation: {
    home: "Home",
  },
  home: {
    badge: "Your AI Health Assistant",
    title: "Smart Healthcare, Anytime, Anywhere",
    description:
      "NajdaAI is your intelligent medical assistant. Ask questions, describe symptoms, and get reliable health information in seconds.",
    startChatting: "Start Chatting",
    emergency: "Emergency",
    imageAlt: "NajdaAI AI Health Assistant",
    features: {
      answers: {
        title: "AI-Powered Answers",
        description: "Get accurate, evidence-based medical information.",
      },
      voice: {
        title: "Voice Interaction",
        description: "Talk to NajdaAI using your voice in Arabic or English.",
      },
      privacy: {
        title: "Private & Secure",
        description: "Your conversations are encrypted and safe.",
      },
    },
  },
  auth: {
    logoAlt: "NajdaAI Logo",
    welcome: "Welcome Back",
    instructions: "Sign in to continue to your account.",
    emailLabel: "Email Address",
    emailPlaceholder: "Enter your email",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    signIn: "Sign In",
    signingIn: "Signing in...",
    divider: "or",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    privacyNote: "Your health data stays private and secure.",
    googleClientMissing:
      "Google Client ID is missing. Add VITE_GOOGLE_CLIENT_ID to .env.local and restart the frontend.",
    emergencyTitle: "Emergency Mode",
    emergencyInstructions:
      "Sign in with your Google account to continue to Emergency Mode.",
    emergencyIdentityNote:
      "Your Google account is only used to verify your identity.",
  },
  signup: {
    title: "Create Your Account",
    instructions: "Fill in your information to get started.",
    sections: {
      personal: "Personal Information",
      medical: "Medical Information",
      emergency: "Emergency Contact Information",
    },
    fields: {
      fullName: "Full Name",
      patientId: "Patient ID",
      dateOfBirth: "Date of Birth",
      gender: "Gender",
      email: "Email Address",
      password: "Password",
      bloodType: "Blood Type",
      chronicDiseases: "Chronic Diseases",
      selectAll: "(Select all that apply)",
      otherCondition: "If other, please specify",
      emergencyName: "Emergency Contact Name",
      emergencyPhone: "Emergency Phone Number",
      emergencyEmail: "Emergency Email",
    },
    placeholders: {
      fullName: "Enter your full name",
      patientId: "Enter your ID number",
      email: "Enter your email",
      password: "Create a password",
      gender: "Select your gender",
      bloodType: "Select your blood type",
      otherCondition: "Please specify your condition",
      emergencyName: "Enter contact name",
      emergencyPhone: "Enter phone number",
      emergencyEmail: "Enter email address",
    },
    gender: {
      male: "Male",
      female: "Female",
      preferNotToSay: "Prefer not to say",
    },
    chronicDiseases: {
      diabetes: "Diabetes",
      hypertension: "Hypertension",
      asthma: "Asthma",
      heart_disease: "Heart Disease",
      kidney_disease: "Kidney Disease",
      other: "Other",
    },
    termsPrefix: "I agree to the",
    termsOfService: "Terms of Service",
    termsAnd: "and",
    privacyPolicy: "Privacy Policy",
    createAccount: "Create Account",
    creatingAccount: "Creating account...",
    existingAccount: "Already have an account?",
    signIn: "Sign in",
    sidebar: {
      logoAlt: "CacheAI",
      titleStart: "Create Your",
      titleHighlight: "Health",
      titleEnd: "Profile",
      description:
        "Help us personalize your experience and provide you with accurate medical support.",
      dataSafe: {
        title: "Your Data is Safe",
        description:
          "We use industry-standard encryption to protect your information.",
      },
      personalizedCare: {
        title: "Personalized Care",
        description: "Get medical support tailored to your health profile.",
      },
      betterAssistance: {
        title: "Better Assistance",
        description:
          "Help our AI assistant understand you better for accurate answers.",
      },
    },
  },
  errors: {
    requiredName: "Enter your full name",
    requiredEmail: "Enter your email",
    requiredPassword: "Create a password",
    requiredTerms: "You must accept the terms",
    requiredCredentials: "Please enter your email and password.",
    invalidCredentials: "Incorrect email or password",
    duplicateEmail: "An account with this email already exists.",
    googleFailure: "Unable to sign in with Google.",
    registrationFailure: "Something went wrong while creating your account.",
    genericFailure: "Something went wrong. Please try again.",
  },
  appearance: {
    switchToArabic: "Switch to Arabic",
    switchToEnglish: "Switch to English",
    arabic: "عربي",
    english: "EN",
  },
};

export default en;
