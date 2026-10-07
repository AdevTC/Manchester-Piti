import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapReaction } from "../../lib/firestoreMappers";
import { canReact, tallyReactions, type ReactionTally, type ReactionValue } from "./reactions";

// `?preview` has no Firebase token (rules would reject): reactions live in localStorage there,
// like the boards in useLineups.
const PREVIEW =
  import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview");
const LOCAL_KEY = "mp_pizarra_reactions";
type LocalStore = Record<string, Record<string, ReactionValue>>;
function localRead(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as LocalStore) : {};
  } catch {
    return {};
  }
}

export interface UseReactions extends ReactionTally {
  /** The member may react to this board (it is official and they are inside the vestuario). */
  enabled: boolean;
  loading: boolean;
  /** Give (or change) your reaction; null takes it back. Rejects when not `enabled`. */
  react: (value: ReactionValue | null) => Promise<void>;
}

/** Live counts of the reactions to an official board, and the member's own. */
export function useReactions(board: { id: string; isOfficial: boolean } | null): UseReactions {
  const { user } = useAuth();
  const { member } = useTeam();
  const uid = user?.uid ?? null;
  const lineupId = board?.id ?? "";
  const enabled = canReact(board, member, uid) && lineupId !== "";

  const q = useMemo(() => collection(db, "lineups", lineupId || "-", "reactions"), [lineupId]);
  const key = useMemo(() => ["lineupReactions", lineupId], [lineupId]);
  const { data, isPending } = useFirestoreCollection(key, q, mapReaction, enabled && !PREVIEW);

  const [local, setLocal] = useState<LocalStore>(() => (PREVIEW ? localRead() : {}));

  const tally = useMemo(() => {
    if (!enabled) return tallyReactions([], uid);
    if (PREVIEW) return tallyReactions(Object.entries(local[lineupId] ?? {}).map(([id, value]) => ({ id, value })), uid);
    return tallyReactions(data ?? [], uid);
  }, [enabled, local, lineupId, data, uid]);

  const react = async (value: ReactionValue | null) => {
    if (!enabled || !uid) throw new Error("Solo los miembros pueden opinar sobre el siete oficial.");
    if (PREVIEW) {
      setLocal((prev) => {
        const mine = { ...(prev[lineupId] ?? {}) };
        if (value) mine[uid] = value;
        else delete mine[uid];
        const next = { ...prev, [lineupId]: mine };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    const ref = doc(db, "lineups", lineupId, "reactions", uid);
    if (value) await setDoc(ref, { value, at: serverTimestamp() });
    else await deleteDoc(ref);
  };

  return { ...tally, enabled, loading: enabled && !PREVIEW && isPending, react };
}
