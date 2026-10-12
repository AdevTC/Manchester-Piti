// «El oficial ha cambiado: entra X»: what this device last saw of the official's seven against what it is
// now (oficialSeen.ts). The first visit only remembers it; the captain editing the official never gets the
// banner (the changes are his), and «Vale» / «Ver el oficial» remember the seven as seen.
import { useEffect, useState } from "react";
import type { LineupDoc } from "../lineupDoc";
import { oficialChange, readSeen, sevenIds, writeSeen } from "./oficialSeen";

export interface OficialBannerState {
  msg: string | null;
  dismiss: () => void;
}

export function useOficialBanner(off: LineupDoc | null, editingIt: boolean, name: (id: string) => string): OficialBannerState {
  const seven = off ? sevenIds(off) : [];
  const sig = off ? off.id + ":" + seven.join(",") : "";
  const [seen, setSeen] = useState<{ sig: string; ids: string[] | null }>({ sig: "", ids: null });
  const [dismissed, setDismissed] = useState("");
  // (read once per official and seven)
  if (off && seen.sig !== sig) setSeen({ sig, ids: readSeen(off.id) });
  const offId = off?.id ?? null;
  const sevenKey = seven.join(",");
  // The first visit only remembers it; the captain's own edits are remembered as he makes them.
  useEffect(() => {
    if (!offId) return;
    if (editingIt || readSeen(offId) === null) writeSeen(offId, sevenKey ? sevenKey.split(",") : []);
  }, [offId, sevenKey, editingIt]);
  const msg = off && !editingIt && dismissed !== sig && seen.sig === sig ? oficialChange(seen.ids, seven, name) : null;
  return {
    msg,
    dismiss: () => {
      if (off) writeSeen(off.id, seven);
      setDismissed(sig);
    },
  };
}
