export const LANGUAGE_STORAGE_KEY = "najda-language";

export function normalizeLanguage(value) {
  if (typeof value !== "string") return null;
  const primary = value.trim().toLowerCase().split("-")[0];
  return primary === "en" || primary === "ar" ? primary : null;
}

export function detectLanguage({ storedLanguage, browserLanguages = [] }) {
  const stored = normalizeLanguage(storedLanguage);
  if (stored) return stored;
  return normalizeLanguage(browserLanguages[0]) || "en";
}

export const getDirection = (language) =>
  normalizeLanguage(language) === "ar" ? "rtl" : "ltr";

export const getFormattingLocale = (language) =>
  normalizeLanguage(language) === "ar" ? "ar-EG" : "en";

export function readStoredLanguage(storage) {
  try {
    const storedLanguage = storage.getItem(LANGUAGE_STORAGE_KEY);
    return storedLanguage === "en" || storedLanguage === "ar"
      ? storedLanguage
      : null;
  }
  catch { return null; }
}

export function persistLanguage(storage, language) {
  const normalized = normalizeLanguage(language);
  if (!normalized) return false;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}
