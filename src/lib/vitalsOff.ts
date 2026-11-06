// The switch that keeps a browser out of the field measurements (lib/vitals): the tools on Jordi's PC (Playwright
// probes, the desktop app's browser pane) open the site with `?novitals` once, or set the key themselves, and that
// browser sends nothing from then on; `?novitals=0` turns it back on. Read at boot, before the router can rewrite the
// address. Tiny on purpose: it is part of the first bundle.

export const NOVITALS_KEY = "piti-novitals";

/** Whether this browser keeps its measurements to itself, after applying a `?novitals` in `search`. */
export function vitalsOff(search: string = location.search, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = safeLocalStorage()): boolean {
  const flag = new URLSearchParams(search).get("novitals");
  try {
    if (flag !== null) {
      if (flag === "0") storage?.removeItem(NOVITALS_KEY);
      else storage?.setItem(NOVITALS_KEY, "1");
    }
    return storage?.getItem(NOVITALS_KEY) === "1" || (flag !== null && flag !== "0");
  } catch {
    // (storage blocked: the address alone decides, for this load)
    return flag !== null && flag !== "0";
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
