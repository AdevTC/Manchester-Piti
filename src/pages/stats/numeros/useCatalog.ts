import { useEffect, useState } from "react";
import { loadCatalog, type CatRow } from "./catalog";

export function useCatalog(enabled: boolean) {
  const [catalog, setCatalog] = useState<CatRow[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || catalog) return;
    let active = true;
    void loadCatalog().then((rows) => {
      if (active) { setCatalog(rows); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [enabled, catalog, attempt]);
  return { catalog, error, retry: () => { setError(false); setAttempt((n) => n + 1); } };
}
