// Bloque 5 · where the charla's voice clips live: the board's `voz` subcollection (lineups/{id}/voz/{v0…v5},
// see voz.ts for why there and not in Storage). Read live only while the charla is on screen (the page
// says when through `want`); written by whoever may edit the board (the rules: its owner while it is
// not official, or a captain). `?preview` keeps them in memory (no Firebase token there).
import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { extraSlots, parseVozDoc, slotFor, VOZ_LIMITS, type VozClip } from "./voz";

const PREVIEW = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview");

export interface VozRecording {
  mime: string;
  ms: number;
  data: string;
}

export interface VozStore {
  /** The board's clips (none until the charla asks for them). */
  clips: VozClip[];
  loading: boolean;
  /** The clips could not be read. */
  error: boolean;
  /** The board is stored (a draft has nowhere to keep a clip yet). */
  stored: boolean;
  /** Keep a clip for a step (re-recording replaces it). Rejects with a Spanish message. */
  save: (step: string, rec: VozRecording) => Promise<void>;
  /** Delete the step's clip. */
  remove: (step: string) => Promise<void>;
  /** The charla is on screen (the clips are read only then). */
  want: (on: boolean) => void;
}

/** Deletes every clip of a board (before the board itself goes: the rules read the board to allow it). */
export async function clearVoz(lineupId: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, "lineups", lineupId, "voz"));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.error("No se pudo borrar la voz de la charla", err);
  }
}

/** The checks a clip passes before it is written (the rules check the same). */
export function vozWriteError(rec: VozRecording): string | null {
  if (rec.ms > VOZ_LIMITS.ms + 500) return "La voz dura más de 30 segundos: grábala más corta.";
  if (rec.data.length > VOZ_LIMITS.chars) return "La grabación pesa demasiado: grábala más corta.";
  if (!rec.data) return "La grabación ha salido vacía: vuelve a intentarlo.";
  return null;
}

export function useVozStore(lineupId: string | null, uid: string): VozStore {
  const [on, setOn] = useState(false);
  const real = !!lineupId && !PREVIEW;
  const q = useMemo(() => collection(db, "lineups", lineupId || "-", "voz"), [lineupId]);
  const key = useMemo(() => ["lineupVoz", lineupId ?? "-"], [lineupId]);
  const { data, isPending, error } = useFirestoreCollection(key, q, parseVozDoc, on && real);
  const [mem, setMem] = useState<Record<string, VozClip[]>>({});
  const clips = useMemo(() => (!lineupId ? [] : PREVIEW ? (mem[lineupId] ?? []) : on ? (data ?? []) : []), [lineupId, mem, on, data]);

  const save = async (step: string, rec: VozRecording) => {
    if (!lineupId) throw new Error("Guarda el tablero antes de grabar la voz.");
    const bad = vozWriteError(rec);
    if (bad) throw new Error(bad);
    const slot = slotFor(clips, step);
    if (!slot) throw new Error("Ya hay voz en " + VOZ_LIMITS.slots + " pasos: borra una para grabar otra.");
    const ms = Math.min(VOZ_LIMITS.ms, Math.max(1, Math.round(rec.ms)));
    if (PREVIEW) {
      setMem((m) => {
        const list = (m[lineupId] ?? []).filter((c) => c.step !== step && c.slot !== slot);
        return { ...m, [lineupId]: [...list, { slot, step, mime: rec.mime, ms, data: rec.data, at: Date.now() }] };
      });
      return;
    }
    await setDoc(doc(db, "lineups", lineupId, "voz", slot), { step, mime: rec.mime, ms, data: rec.data, by: uid, at: serverTimestamp() });
    await Promise.all(extraSlots(clips, step, slot).map((s) => deleteDoc(doc(db, "lineups", lineupId, "voz", s))));
  };
  const remove = async (step: string) => {
    if (!lineupId) return;
    if (PREVIEW) {
      setMem((m) => ({ ...m, [lineupId]: (m[lineupId] ?? []).filter((c) => c.step !== step) }));
      return;
    }
    await Promise.all(extraSlots(clips, step, null).map((s) => deleteDoc(doc(db, "lineups", lineupId, "voz", s))));
  };

  return { clips, loading: on && real && isPending, error: on && real && !!error, stored: !!lineupId, save, remove, want: setOn };
}
