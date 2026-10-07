// The new pizarra stays behind a switch until it replaces the old one: `/pizarra?v2` turns it on (and
// remembers it on this device), `?v2=0` turns it off. Tiny on purpose: the layout reads it too.
import { useEffect, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";

export const V2_KEY = "mp_pizarra_v2";
const EVT = "mp-pizarra-v2";

/** `?v2` / `?v2=1` → on, `?v2=0` (or false/off) → off, absent → null (use the stored choice). */
export function parseV2(search: string): boolean | null {
  const q = new URLSearchParams(search.startsWith("?") ? search : "?" + search);
  if (!q.has("v2")) return null;
  const v = (q.get("v2") ?? "").toLowerCase();
  return !["0", "false", "off", "no"].includes(v);
}

function readStored(): boolean {
  try {
    return localStorage.getItem(V2_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistV2(on: boolean): void {
  try {
    if (on) localStorage.setItem(V2_KEY, "1");
    else localStorage.removeItem(V2_KEY);
  } catch {
    /* private mode: the URL still decides for this visit */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

// The URL can lose `?v2` early (the season sync rewrites the search), so the first load remembers it.
if (typeof window !== "undefined") {
  const v = parseV2(window.location.search);
  if (v !== null) persistV2(v);
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Whether /pizarra shows the new board. */
export function usePizarraV2(): boolean {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const fromUrl = parseV2(searchStr);
  const stored = useSyncExternalStore(subscribe, readStored, () => false);
  useEffect(() => {
    if (fromUrl !== null && fromUrl !== readStored()) persistV2(fromUrl);
  }, [fromUrl]);
  return fromUrl ?? stored;
}
