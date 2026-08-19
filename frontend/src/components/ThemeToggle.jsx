import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import useTheme from "../theme/useTheme";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const switchesToLight = theme === "dark";
  const label = t(
    switchesToLight
      ? "appearance.switchToLight"
      : "appearance.switchToDark"
  );
  const Icon = switchesToLight ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? "theme-toggle--compact" : ""} ${className}`}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      {!compact && (
        <span>
          {t(switchesToLight ? "appearance.light" : "appearance.dark")}
        </span>
      )}
    </button>
  );
}
