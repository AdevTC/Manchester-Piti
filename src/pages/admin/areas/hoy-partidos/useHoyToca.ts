// HOY Y PARTIDOS · «Te toca» from the sala's data and the shared listeners it needs beyond AdminData (who knocks at the
// door, the payments said to the caja): Hoy draws it and the dock counts it (count.ts), the same list.
import { useMemo } from "react";
import { pendingProposals } from "../../data/adminLogic";
import type { AdminData } from "../../data/useAdminData";
import { useCajaClaims } from "../../data/useCaja";
import { useDoorRequests } from "../../../vestuario/live";
import { tocaList, type TocaItem } from "./hoyModel";
import type { MatchRowView } from "./useMatchRows";

/** Everything Hoy and its counter read beyond AdminData (the shared listeners). */
export function useHoyToca(data: AdminData, rows: readonly MatchRowView[]): TocaItem[] {
  const door = useDoorRequests(true);
  const caja = useCajaClaims(data.season?.id, !!data.season);
  return useMemo(() => {
    const shirt = (id: string) => data.roster.find((p) => p.id === id)?.name ?? data.players.find((p) => p.id === id)?.shirtName ?? "?";
    const next = data.next;
    const answered = new Set((next?.answers ?? []).map((a) => a.playerId).filter(Boolean));
    const nextRoster = next ? data.roster : [];
    const seasonMatches = data.season ? rows.filter((r) => r.m.seasonId === data.season?.id) : rows;
    return tocaList({
      now: data.now,
      matches: rows,
      next: next
        ? { m: next.match, unanswered: nextRoster.filter((p) => !answered.has(p.id)).map((p) => p.name), notified: !!next.match.convocatoriaNotifiedAt, scorer: !!next.match.mesa?.name }
        : null,
      claims: data.claims.map((c) => ({ uid: c.uid, nick: c.nickname, shirt: c.playerLabel })),
      door: door.data.filter((d) => d.status === "pending").map((d) => ({ uid: d.uid, name: d.name || d.googleName || "Alguien", at: d.at })),
      caja: caja.data.filter((c) => c.status === "pendiente").map((c) => ({ shirt: shirt(c.playerId), amount: c.amount })),
      proposals: pendingProposals(data.roster),
      gaps: data.content.gaps,
      drafts: [],
      emptySeason: data.season && !seasonMatches.length ? { name: data.season.name } : null,
    });
  }, [data, rows, door.data, caja.data]);
}
