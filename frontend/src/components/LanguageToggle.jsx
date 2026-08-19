import { useTranslation } from "react-i18next";

import { persistLanguage } from "../i18n/language.js";

export default function LanguageToggle({ compact = false }) {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  const nextLanguage = currentLanguage === "ar" ? "en" : "ar";
  const label = t(
    nextLanguage === "ar"
      ? "appearance.switchToArabic"
      : "appearance.switchToEnglish"
  );
  const text = t(
    nextLanguage === "ar" ? "appearance.arabic" : "appearance.english"
  );

  const handleLanguageChange = () => {
    persistLanguage(window.localStorage, nextLanguage);
    i18n.changeLanguage(nextLanguage);
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleLanguageChange}
      className={`theme-toggle ${compact ? "theme-toggle--compact" : ""}`}
    >
      <span>{compact ? text : label}</span>
    </button>
  );
}
