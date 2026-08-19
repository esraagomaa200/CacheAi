import { useEffect } from "react";

import i18n from "../i18n/index.js";
import { getDirection } from "../i18n/language.js";

function syncDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = getDirection(language);
}

export default function LanguageSync() {
  syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);

  useEffect(() => {
    const handleLanguageChange = (language) => {
      syncDocumentLanguage(language);
    };

    i18n.on("languageChanged", handleLanguageChange);
    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  return null;
}
