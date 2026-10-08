import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
/** What the member chose: a fixed theme, or «Sistema» (follows the device, live). */
export type ThemePref = Theme | "system";

const STORAGE_KEY = "mp_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  try {
    return typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** The stored choice. Nothing stored (or "system") = follow the device, like the pre-paint script in index.html. */
function readPref(): ThemePref {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage may be unavailable */
  }
  return "system";
}

interface ThemeState {
  pref: ThemePref;
  theme: Theme;
}
// One theme for the whole app: every useTheme() (the header toggle, the pizarra, the profile's «Tema»)
// reads and writes this same store, so they never disagree.
let state: ThemeState = { pref: "light", theme: "light" };
const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function compute(): ThemeState {
  const pref = readPref();
  return { pref, theme: pref === "system" ? systemTheme() : pref };
}
function apply() {
  if (typeof document === "undefined") return;
  if (document.documentElement.getAttribute("data-theme") !== state.theme) document.documentElement.setAttribute("data-theme", state.theme);
}
/** Replaces the state only when something changed (a stable snapshot for useSyncExternalStore). */
function sync(next: ThemeState): boolean {
  if (next.pref === state.pref && next.theme === state.theme) return false;
  state = next;
  return true;
}
const notify = () => listeners.forEach((l) => l());

function watch() {
  if (typeof window === "undefined") return () => undefined;
  // «Sistema» keeps following the device while the app is open…
  const mq = window.matchMedia?.(DARK_QUERY);
  const onSystem = () => {
    if (state.pref !== "system") return;
    if (sync(compute())) {
      apply();
      notify();
    }
  };
  mq?.addEventListener?.("change", onSystem);
  // …and another tab's choice shows here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    if (sync(compute())) {
      apply();
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    mq?.removeEventListener?.("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    if (sync(compute())) queueMicrotask(notify);
    apply();
    stopWatching = watch();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}
function getSnapshot(): ThemeState {
  // Nobody is listening yet: read the stored choice afresh.
  if (!listeners.size) sync(compute());
  return state;
}
const getServerSnapshot = (): ThemeState => state;

/** Sets «Día» (light), «Noche» (dark) or «Sistema»; applied to <html data-theme> at once and kept. */
export function setThemePref(pref: ThemePref): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore persistence failure: this visit only */
  }
  state = { pref, theme: pref === "system" ? systemTheme() : pref };
  apply();
  notify();
}

/**
 * Theme state for the revamped surfaces. Reflects onto <html data-theme>
 * (an inline script in index.html sets it pre-paint to avoid a flash) and
 * persists the choice.
 */
export function useTheme() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => setThemePref(s.theme === "dark" ? "light" : "dark");
  return { theme: s.theme, pref: s.pref, toggle, setTheme: (t: Theme) => setThemePref(t), setPref: setThemePref };
}
