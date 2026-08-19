import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function AppearanceControls({ compact = false, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LanguageToggle compact={compact} />
      <ThemeToggle compact={compact} />
    </div>
  );
}
