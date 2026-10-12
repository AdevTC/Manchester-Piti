// «Recordatorios automáticos» of a match's convocatoria (convocatoriaReminders/{matchId}): on unless a
// captain turns them off. The backend's job (functions/src/reminders.ts) pushes 48 h and 24 h before kick-off
// to the convocados who haven't answered. Apart so tests replace it.
import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase";

export interface RemindersState {
  /** On (the default) or off. */
  auto: boolean;
  loading: boolean;
  set: (on: boolean) => Promise<void>;
}

/** What the stored doc says: off only when a captain said so. */
export const remindersOn = (d: { auto?: unknown } | undefined): boolean => d?.auto !== false;

export function useReminders(matchId: string): RemindersState {
  const [st, setSt] = useState<{ id: string; auto: boolean } | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "convocatoriaReminders", matchId),
        (s) => setSt({ id: matchId, auto: remindersOn(s.exists() ? s.data() : undefined) }),
        () => setSt({ id: matchId, auto: true }),
      ),
    [matchId],
  );
  const cur = st && st.id === matchId ? st : null;
  return {
    auto: cur?.auto ?? true,
    loading: !cur,
    set: async (on) => {
      await setDoc(doc(db, "convocatoriaReminders", matchId), { auto: on, by: auth.currentUser?.uid ?? "", at: serverTimestamp() });
    },
  };
}
