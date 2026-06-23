import React from "react";
import { useTheme } from "../hooks/useTheme";
import { Hint } from "./ui/hint";

/** Light/dark switch. Shows the icon for the mode you'd switch to. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "claro" : "oscuro";

  return (
    <Hint label={`Cambiar a tema ${next}`}>
    <button
      type="button"
      onClick={toggle}
      className={`mp-theme-toggle ${className}`}
      aria-label={`Cambiar a tema ${next}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
    </Hint>
  );
};
