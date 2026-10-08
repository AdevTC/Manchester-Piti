// The edit buffer of a match form (the acta, a convocatoria): the value being edited, the version it
// started from (`base`, dirty = they differ), and the live server version, adopted whenever the buffer is
// clean (another captain's save, or the echo of ours). Every dirty state is mirrored to localStorage
// (local draft recovery); reopening offers the mirror when it started from the current version.
import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, draftKey, readDraft, recoverable, writeDraft } from "../acta/localDraft";
import { sig } from "../acta/sheetModel";

interface BufferState<T> {
  /** sig() of the server version the buffer last adopted. */
  src: string;
  base: T;
  value: T;
}
export interface EditBuffer<T> {
  value: T;
  base: T;
  dirty: boolean;
  set: (next: T | ((v: T) => T)) => void;
  /** After a successful save of `saved`: it becomes the base (later edits stay dirty). */
  commit: (saved: T) => void;
  /** Throws the edits away (back to the base). */
  reset: () => void;
  /** Unsaved edits mirrored on this device earlier, offered for recovery (null when none). */
  offer: { at: number } | null;
  recover: () => void;
  dismissOffer: () => void;
  /** Keep the local mirror even if the form closes dirty (a failed «Guardar borrador y salir»). */
  keepMirror: () => void;
}

export function useEditBuffer<T>(server: T, kind: "acta" | "conv", matchId: string, isValue: (v: unknown) => v is T, restore: (v: T) => T = (v) => v): EditBuffer<T> {
  const key = draftKey(kind, matchId);
  const serverSig = sig(server);
  const [state, setState] = useState<BufferState<T>>(() => ({ src: serverSig, base: server, value: server }));
  const [offer, setOffer] = useState(() => recoverable(readDraft(key, isValue), serverSig, sig));
  const dirty = sig(state.value) !== sig(state.base);
  // A new server version while clean: adopt it (render-time derived state, no effect round trip).
  if (state.src !== serverSig && !dirty) setState({ src: serverSig, base: server, value: server });

  const serverRef = useRef(serverSig);
  const dirtyRef = useRef(dirty);
  const keep = useRef(false);
  useEffect(() => {
    serverRef.current = serverSig;
    dirtyRef.current = dirty;
  });
  // The mirror: written on every dirty state, cleared once clean (unless a recovery is on offer).
  useEffect(() => {
    if (dirty) {
      writeDraft(key, { at: Date.now(), base: sig(state.base), value: state.value });
      keep.current = false;
    } else if (!offer) clearDraft(key);
  }, [dirty, state, offer, key]);
  // Closing the form dirty means the edits were discarded (the guard asked): forget them.
  useEffect(
    () => () => {
      if (dirtyRef.current && !keep.current) clearDraft(key);
    },
    [key],
  );

  const set = useCallback((next: T | ((v: T) => T)) => {
    setOffer(null);
    setState((s) => ({ ...s, value: typeof next === "function" ? (next as (v: T) => T)(s.value) : next }));
  }, []);
  const commit = useCallback((saved: T) => setState((s) => ({ src: serverRef.current, base: saved, value: s.value })), []);
  const reset = useCallback(() => setState((s) => ({ ...s, value: s.base })), []);
  const recover = useCallback(() => {
    if (!offer) return;
    const v = restore(offer.value);
    setOffer(null);
    setState((s) => ({ ...s, value: v }));
  }, [offer, restore]);
  const dismissOffer = useCallback(() => {
    setOffer(null);
    clearDraft(key);
  }, [key]);
  const keepMirror = useCallback(() => {
    keep.current = true;
  }, []);
  return { value: state.value, base: state.base, dirty, set, commit, reset, offer: offer ? { at: offer.at } : null, recover, dismissOffer, keepMirror };
}
