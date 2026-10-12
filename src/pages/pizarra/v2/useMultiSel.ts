// Bloque 5 · the fichas picked to move together (multiSel.ts): which ones, and «Seleccionar» (touch). They
// belong to one place — the board in free mode, or one paso of one jugada — and start empty in another
// (`scope`); a scope of null means picking is not possible right now.
import { useState } from "react";
import { keepKeys, toggleKey } from "./multiSel";

export interface MultiSel {
  /** Picking is possible here (free mode on an editable board, a paso being edited). */
  on: boolean;
  keys: string[];
  selecting: boolean;
  toggle: (k: string) => string[];
  clear: () => void;
  setSelecting: (v: boolean) => void;
}

interface St {
  scope: string;
  keys: string[];
  selecting: boolean;
}

export function useMultiSel(scope: string | null, there: (k: string) => boolean): MultiSel {
  const [st, setSt] = useState<St>({ scope: "", keys: [], selecting: false });
  const cur: St = scope && st.scope === scope ? st : { scope: scope ?? "", keys: [], selecting: scope ? st.selecting : false };
  const keys = scope ? keepKeys(cur.keys, there) : [];
  return {
    on: !!scope,
    keys,
    selecting: !!scope && cur.selecting,
    toggle: (k) => {
      const next = toggleKey(keys, k);
      setSt({ scope: scope ?? "", keys: next, selecting: cur.selecting });
      return next;
    },
    clear: () => setSt({ scope: scope ?? "", keys: [], selecting: cur.selecting }),
    setSelecting: (v) => setSt({ scope: scope ?? "", keys, selecting: v }),
  };
}
