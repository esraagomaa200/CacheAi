import { useEffect, useLayoutEffect, useState } from "react";

import ThemeContext from "./theme-context";

const STORAGE_KEY = "najda-theme";
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    return storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : null;
  } catch {
    return null;
  }
}

function readSystemTheme() {
  return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

function readInitialTheme() {
  return readStoredTheme() || readSystemTheme();
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const systemPreference = window.matchMedia(SYSTEM_QUERY);
    const handleSystemChange = (event) => {
      if (!readStoredTheme()) {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    systemPreference.addEventListener("change", handleSystemChange);
    return () => {
      systemPreference.removeEventListener("change", handleSystemChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";

      try {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // The visual switch still works when browser storage is unavailable.
      }

      return nextTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

