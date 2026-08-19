import { Moon, Sun } from "lucide-react";

import useTheme from "../theme/useTheme";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const switchesToLight = theme === "dark";
  const label = switchesToLight
    ? "Switch to light mode"
    : "Switch to dark mode";
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
      {!compact && <span>{switchesToLight ? "Light" : "Dark"}</span>}
    </button>
  );
}

