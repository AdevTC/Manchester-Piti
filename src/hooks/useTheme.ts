import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "mp_theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage may be unavailable */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Theme state for the revamped surfaces. Reflects onto <html data-theme>
 * (an inline script in index.html sets it pre-paint to avoid a flash) and
 * persists the choice.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failure */
    }
  }, [theme]);

  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle, setTheme: setThemeState };
}
