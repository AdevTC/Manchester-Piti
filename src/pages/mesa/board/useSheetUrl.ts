// La mesa's open sheet lives in the address (?hoja=, and ?j= whose: the player or the play), as the web's other sheets
// do: opening one pushes an entry, so the phone's Atrás closes it and Adelante opens it again. Closing it from the
// page goes back over the entry it pushed; a sheet that came in with the address (a link, a reload) is closed by
// replacing the entry, so closing never leaves la mesa. Opening a sheet while another is open replaces it (one entry
// per sheet stack, never a trail). The gol's questions are not sheets and never touch the history.
import { useCallback, useEffect, useMemo, useRef } from "react";

export interface SheetAddress {
  hoja: string;
  j: string | null;
}
export interface SheetHistory {
  /** A new entry with this sheet. */
  push(hoja: string, j: string | null): void;
  /** This entry, with this sheet (or none). */
  replace(hoja: string | null, j: string | null): void;
  /** One entry back. */
  back(): void;
}
export interface SheetControl extends SheetAddress {
  open(hoja: string, j?: string | null): void;
  close(): void;
  /** Leaving for another screen of la mesa with a sheet open: the sheet's entry is reused for it. */
  pushedSheet(): boolean;
}

export function useSheetUrl(at: SheetAddress, history: SheetHistory): SheetControl {
  const pushed = useRef(false);
  const ours = useRef(false);
  const prev = useRef(at.hoja);
  useEffect(() => {
    const was = prev.current;
    prev.current = at.hoja;
    if (ours.current) {
      ours.current = false;
      return;
    }
    // (the address changed by itself: Atrás closed the sheet, or Adelante brought it back over an entry without it)
    if (!at.hoja) pushed.current = false;
    else if (!was) pushed.current = true;
  }, [at.hoja]);
  const open = useCallback(
    (hoja: string, j: string | null = null) => {
      ours.current = true;
      if (at.hoja) history.replace(hoja, j);
      else {
        pushed.current = true;
        history.push(hoja, j);
      }
    },
    [at.hoja, history],
  );
  const close = useCallback(() => {
    if (!at.hoja) return;
    ours.current = true;
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else history.replace(null, null);
  }, [at.hoja, history]);
  const pushedSheet = useCallback(() => {
    const p = pushed.current && !!at.hoja;
    if (p) pushed.current = false;
    return p;
  }, [at.hoja]);
  return useMemo(() => ({ hoja: at.hoja, j: at.j, open, close, pushedSheet }), [at.hoja, at.j, open, close, pushedSheet]);
}
