import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { detectLanguage, getDirection, readStoredLanguage } from "./language.js";
import ar from "./locales/ar.js";
import en from "./locales/en.js";

const browserLanguages =
  typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language];

const storedLanguage =
  typeof window === "undefined" ? null : readStoredLanguage(window.localStorage);

const language = detectLanguage({ storedLanguage, browserLanguages });

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: language,
  fallbackLng: "en",
  supportedLngs: ["en", "ar"],
  load: "languageOnly",
  interpolation: {
    escapeValue: false,
  },
  initImmediate: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = language;
  document.documentElement.dir = getDirection(language);
}

export default i18n;
