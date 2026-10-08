// The club views' own live data (what useAdminData does not carry): every ficha claim with its dates and
// who resolved it, how each member came into the vestuario, the counts of archived seasons (their docs
// never reach the app) and the club content with a «loaded» flag. Kept apart so the views' tests can
// replace it.
import { useEffect, useState } from "react";
import { collection, getCountFromServer, onSnapshot, query, Timestamp, where, type DocumentData } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "../../../firebase";
import { useClubContent, type ClubContent } from "../../../lib/clubContent";
import { CONTENT_KEY } from "../../../lib/publicData";
import type { MemberVia } from "./fichasLogic";
import type { HiddenCounts } from "./seasonsLogic";

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : 0);

export interface ClaimLogRow {
  uid: string;
  playerId: string;
  playerName: string;
  nickname: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  /** When it was asked (ms, 0 = unknown). */
  at: number;
  resolvedAt: number;
  /** uid of the captain who resolved it. */
  resolvedBy: string;
}
interface Live<T> {
  data: T;
  loading: boolean;
  error: boolean;
}
function useCollection<T>(path: string, map: (id: string, d: DocumentData) => T): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true, error: false });
  useEffect(
    () =>
      onSnapshot(
        collection(db, path),
        (s) => setState({ data: s.docs.map((d) => map(d.id, d.data())), loading: false, error: false }),
        () => setState({ data: [], loading: false, error: true }),
      ),
    [path, map],
  );
  return state;
}
const mapClaim = (uid: string, d: DocumentData): ClaimLogRow => ({
  uid,
  playerId: String(d.playerId ?? ""),
  playerName: String(d.playerName ?? ""),
  nickname: String(d.nickname ?? ""),
  email: String(d.email ?? ""),
  status: d.status === "approved" || d.status === "rejected" ? d.status : "pending",
  at: millis(d.at),
  resolvedAt: millis(d.resolvedAt),
  resolvedBy: String(d.resolvedBy ?? ""),
});
/** Every claim (pending and resolved): one per member, a club's handful. */
export function useClaimsLog(): Live<ClaimLogRow[]> {
  return useCollection("playerClaims", mapClaim);
}
const mapMember = (uid: string, d: DocumentData): MemberVia & { uid: string } => ({ uid, via: String(d.via ?? ""), by: String(d.by ?? "") });
/** How each member came in (teamMembers: via + by). */
export function useMembersVia(): Live<(MemberVia & { uid: string })[]> {
  return useCollection("teamMembers", mapMember);
}

/** Matches and players of each archived season, counted on the server (null while counting / on error). */
export function useArchivedCounts(seasonIds: readonly string[]): Record<string, HiddenCounts | undefined> {
  const key = [...seasonIds].sort().join(",");
  const [counts, setCounts] = useState<Record<string, HiddenCounts | undefined>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    const ids = key.split(",");
    void Promise.all(
      ids.map(async (id) => {
        try {
          const [m, p] = await Promise.all([
            getCountFromServer(query(collection(db, "matches"), where("seasonId", "==", id))),
            getCountFromServer(query(collection(db, "players"), where("seasons", "array-contains", id))),
          ]);
          return [id, { matches: m.data().count, players: p.data().count }] as const;
        } catch {
          return [id, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (live) setCounts(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, [key]);
  return counts;
}

/** The club content as published, and whether the document has arrived yet (drafts need the real base). */
export function useLiveClubContent(): { content: ClubContent; loaded: boolean } {
  const content = useClubContent();
  const qc = useQueryClient();
  return { content, loaded: qc.getQueryData(CONTENT_KEY) !== undefined };
}
