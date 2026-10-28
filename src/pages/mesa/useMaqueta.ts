// DEV only: la mesa's replay hatch (./maqueta, `?fase=`) is loaded with a dynamic import behind import.meta.env.DEV,
// so a production build drops it whole (the condition is false at build time and the import goes with it).
import { useEffect, useState } from "react";

type Maqueta = typeof import("./maqueta");

/** The maqueta's module once loaded (in the dev server, with `?fase=` in the address), else null. */
export function useMaqueta(): Maqueta | null {
  const [mod, setMod] = useState<Maqueta | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fase")) {
      let on = true;
      void import("./maqueta").then((m) => {
        if (on) setMod(m);
      });
      return () => {
        on = false;
      };
    }
  }, []);
  return mod;
}
