import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useFirestoreCollection } from "../../lib/useFirestoreCollection";
import { mapReaction } from "../../lib/firestoreMappers";
import { canReact, doubters, tallyReactions, type ReactionTally, type ReactionValue } from "./reactions";

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

/** A profile's nickname (the users collection, readable by the team). */
function mapPerson(id: string, data: unknown): { id: string; nickname: string } | null {
  if (!data || typeof data !== "object") return null;
  const n = (data as { nickname?: unknown }).nickname;
  return { id, nickname: typeof n === "string" ? n : "" };
}

export interface UseReactions extends ReactionTally {
  /** The member may react to this board (it is official and they are inside the vestuario). */
  enabled: boolean;
  /** Admins only: who has doubts, by nickname (undefined for everyone else: the doubts stay anonymous). */
  who?: string[];
  loading: boolean;
  /** Give (or change) your reaction; null takes it back. Rejects when not `enabled`. */
  react: (value: ReactionValue | null) => Promise<void>;
}

/** Live counts of the reactions to an official board, and the member's own. */
export function useReactions(board: { id: string; isOfficial: boolean } | null): UseReactions {
  const { user, profile } = useAuth();
  const { member } = useTeam();
  const uid = user?.uid ?? null;
  const lineupId = board?.id ?? "";
  const enabled = canReact(board, member, uid) && lineupId !== "";

  const q = useMemo(() => collection(db, "lineups", lineupId || "-", "reactions"), [lineupId]);
  const key = useMemo(() => ["lineupReactions", lineupId], [lineupId]);
  const { data, isPending } = useFirestoreCollection(key, q, mapReaction, enabled && !PREVIEW);

  const [local, setLocal] = useState<LocalStore>(() => (PREVIEW ? localRead() : {}));

  const docs = useMemo(() => {
    if (!enabled) return [];
    if (PREVIEW) return Object.entries(local[lineupId] ?? {}).map(([id, value]) => ({ id, value }));
    return data ?? [];
  }, [enabled, local, lineupId, data]);
  const tally = useMemo(() => tallyReactions(docs, uid), [docs, uid]);

  // Admins see who has doubts (the reactions are stored by uid; the nicknames come from the profiles,
  // read only while someone has doubts).
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  const wantWho = enabled && admin && !PREVIEW && tally.dudas > 0;
  const pq = useMemo(() => collection(db, "users"), []);
  const pkey = useMemo(() => ["pizarraPeople"], []);
  const { data: people } = useFirestoreCollection(pkey, pq, mapPerson, wantWho);
  const who = useMemo(() => (admin && enabled ? doubters(docs, new Map((people ?? []).map((p) => [p.id, p.nickname ? "@" + p.nickname : ""]))) : undefined), [admin, enabled, docs, people]);

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

  return { ...tally, enabled, ...(who ? { who } : {}), loading: enabled && !PREVIEW && isPending, react };
}
