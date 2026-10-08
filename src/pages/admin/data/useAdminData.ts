// useAdminData(): everything the admin shell and its views read, from the app's existing realtime
// subscriptions (each collection has ONE listener, shared with the rest of the app through the cache
// bridge / the vestuario's shared store): published matches + players (useClubData), every season
// (archived ones too), match drafts, pending ficha claims, users (roles), door requests, the next
// match's RSVP and meeting note, MVP results and the club content. The domain logic lives in
// adminLogic.ts (pure); this hook only wires the sources and memoizes.
import { useCallback, useMemo } from "react";
import { collection, orderBy, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { useClock } from "../../../hooks/useClock";
import { useClubContent } from "../../../lib/clubContent";
import { dateMillis, playerForSeason, playerName, useClubData, type ClubMatch } from "../../../lib/clubData";
import { mapMatch, mapSeason } from "../../../lib/firestoreMappers";
import { SEASONS_KEY, seasonQuery } from "../../../lib/publicData";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { mvpWinners } from "../../../lib/vestuario";
import {
  useAvailability,
  useClubPeople,
  useDoorRequests,
  useMeetingNote,
  useMvpResults,
  usePendingClaims,
  type Claim,
  type PersonRow,
} from "../../vestuario/live";
import {
  buildOverview,
  contentGaps,
  convocatoriaState,
  lastActaMatch,
  matchState,
  mergeMatches,
  mvpNote,
  nextMatch,
  reviewActa,
  rsvpCounts,
  type ActaReview,
  type AdminMatch,
  type AdminMatchState,
  type ContentGap,
  type ConvocatoriaState,
  type Overview,
  type RsvpCounts,
} from "./adminLogic";

export const DRAFTS_KEY = ["matchDrafts"] as const;
const draftsQuery = query(collection(db, "matchDrafts"), orderBy("updatedAt", "desc"));

/** A player as the admin shows it in the current season (season shirt name + dorsal). */
export interface RosterPlayer {
  id: string;
  /** Shirt name for the season (playerName fallback). */
  name: string;
  number: number | null;
  /** POR / DEF / MED / DEL (upper-case) or "". */
  position: string;
  injured: boolean;
  doc: PlayerDoc;
}
export interface AdminData {
  /** Still waiting for the first snapshot of matches/players/seasons. */
  loading: boolean;
  /** A collection could not be read (the views show their error state). */
  error: boolean;
  now: number;
  /** Every season (archived ones flagged), by name. */
  seasons: SeasonDoc[];
  /** The season the admin is about (the next match's, else the latest played, else the newest). */
  season: SeasonDoc | null;
  /** All players (validated docs). */
  players: PlayerDoc[];
  /** The current season's squad, by dorsal. */
  roster: RosterPlayer[];
  /** Published matches + drafts merged (draft fields win), oldest first, with jornada numbers. */
  matches: AdminMatch[];
  /** A match's state for the captains (draft / acta / published / next / scheduled / postponed / cancelled). */
  stateOf: (m: AdminMatch) => AdminMatchState;
  /** The acta review of any match (its season's roster). */
  reviewOf: (m: AdminMatch) => ActaReview;
  /** The played match whose acta matters now (pending first), with its review. */
  last: { match: AdminMatch; review: ActaReview; publishedClean: boolean } | null;
  /** The next match to prepare, its convocatoria, RSVP counts and meeting note. */
  next: { match: AdminMatch; conv: ConvocatoriaState; rsvp: RsvpCounts; note: string } | null;
  /** Pending ficha claims (with the requested player resolved). */
  claims: (Claim & { player: RosterPlayer | null; playerLabel: string })[];
  /** users/* (roles): admins = admin + superadmin. */
  people: PersonRow[];
  admins: number;
  /** Door requests waiting (La puerta, in the vestuario). */
  doorRequests: number;
  content: { gaps: ContentGap[] };
  /** The Jornada card's MVP line. */
  mvp: string;
  /** Por hacer + the menu's live counters. */
  overview: Overview;
}

const NO_PLAYERS: RosterPlayer[] = [];
const isAdminRole = (r: string) => r === "admin" || r === "superadmin";

export function useAdminData(): AdminData {
  const now = useClock(60_000);
  const club = useClubData();
  const seasonsQ = useFirestoreCollection(SEASONS_KEY, seasonQuery, mapSeason);
  const draftsQ = useFirestoreCollection(DRAFTS_KEY, draftsQuery, mapMatch);
  const claimsQ = usePendingClaims(true);
  const peopleQ = useClubPeople(true);
  const doorQ = useDoorRequests(true);
  const mvpResults = useMvpResults();
  const content = useClubContent();

  const seasons = useMemo(() => seasonsQ.data ?? [], [seasonsQ.data]);
  const published = club.matches;
  const drafts = useMemo(() => (draftsQ.data ?? []) as (ClubMatch & { updatedAt?: unknown })[], [draftsQ.data]);
  const matches = useMemo(() => mergeMatches(published, drafts), [published, drafts]);
  const next = useMemo(() => nextMatch(matches, now), [matches, now]);
  const last = useMemo(() => lastActaMatch(matches, now), [matches, now]);
  const visibleSeasons = useMemo(() => seasons.filter((s) => !s.archived), [seasons]);
  const seasonId = next?.seasonId || last?.seasonId || visibleSeasons.at(-1)?.id || "";
  const season = seasons.find((s) => s.id === seasonId) ?? null;

  // Every season's squad (season shirt name + dorsal), by dorsal.
  const rosters = useMemo(() => {
    const out = new Map<string, RosterPlayer[]>();
    for (const p of club.players)
      for (const sid of p.seasons ?? []) {
        const s = playerForSeason(p, sid, seasons);
        const row = { id: p.id, name: playerName(s), number: typeof s.number === "number" ? s.number : null, position: String(p.naturalPosition ?? "").toUpperCase(), injured: !!p.injured, doc: p };
        out.set(sid, [...(out.get(sid) ?? []), row]);
      }
    out.forEach((list) => list.sort((a, b) => (a.number ?? 999) - (b.number ?? 999)));
    return out;
  }, [club.players, seasons]);
  const rosterOf = useCallback((sid: string | undefined): RosterPlayer[] => (sid ? (rosters.get(sid) ?? NO_PLAYERS) : NO_PLAYERS), [rosters]);
  const roster = rosterOf(seasonId);

  const reviewOf = useCallback((m: AdminMatch) => reviewActa(m, rosterOf(m.seasonId).map((p) => p.id), now, m.published && !m.draft), [rosterOf, now]);
  const stateOf = useCallback((m: AdminMatch) => matchState(m, now, next?.id), [now, next?.id]);

  const avail = useAvailability(next?.id);
  const note = useMeetingNote(next?.id);

  const lastView = useMemo(() => (last ? { match: last, review: reviewOf(last), publishedClean: last.published && !last.draft } : null), [last, reviewOf]);
  const nextView = useMemo(() => {
    if (!next) return null;
    const ids = rosterOf(next.seasonId).map((p) => p.id);
    return { match: next, conv: convocatoriaState(next, ids, next.published && !next.draft), rsvp: rsvpCounts(avail.data, ids), note: note.data };
  }, [next, rosterOf, avail.data, note.data]);

  const claims = useMemo(
    () =>
      claimsQ.data.map((c) => {
        const player = club.players.find((p) => p.id === c.playerId);
        const r = player ? (rosterOf(seasonId).find((x) => x.id === player.id) ?? null) : null;
        return { ...c, player: r, playerLabel: r?.name ?? (player ? playerName(player) : c.playerName || "Jugador") };
      }),
    [claimsQ.data, club.players, rosterOf, seasonId],
  );
  const people = peopleQ.data;
  const admins = people.filter((p) => !p.removed && isAdminRole(p.role)).length;
  const gaps = useMemo(() => contentGaps(content, roster.map((p) => ({ name: p.name, bio: p.doc.bio }))), [content, roster]);

  const mvp = useMemo(() => {
    const pub = matches.filter((m) => m.published && m.voteClosesAt && m.status === "finished");
    const open = pub.find((m) => (m.voteClosesAt ?? 0) > now);
    const closed = pub.filter((m) => (m.voteClosesAt ?? 0) <= now).sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
    let previous: { jornada: number | null; names: string[]; votes: number } | null = null;
    if (closed) {
      const res = mvpResults.get(closed.id);
      const ids = mvpWinners(closed, res, now);
      if (ids.length && res) previous = { jornada: closed.jornada, names: ids.map((id) => playerName(club.players.find((p) => p.id === id))), votes: res.counts[ids[0]] ?? 0 };
    }
    return mvpNote({ openUntil: open?.voteClosesAt ?? null, actaPending: !!lastView && !lastView.publishedClean, previous });
  }, [matches, mvpResults, now, club.players, lastView]);

  const actasPending = useMemo(() => matches.filter((m) => ["draft", "acta"].includes(matchState(m, now, next?.id))).length, [matches, now, next?.id]);
  const overview = useMemo(
    () =>
      buildOverview({
        last: lastView ? { ...lastView, mvpOpen: !!lastView.match.voteClosesAt && lastView.match.voteClosesAt > now } : null,
        next: nextView,
        claims: claims.map((c) => ({ uid: c.uid, nickname: c.nickname, playerName: c.playerLabel })),
        contentGaps: gaps,
        actasPending,
        roster: roster.length,
        seasons: seasons.length,
        admins,
        doorRequests: doorQ.data.length,
      }),
    [lastView, nextView, claims, gaps, actasPending, roster.length, seasons.length, admins, doorQ.data.length, now],
  );

  return {
    loading: club.loading || seasonsQ.isPending,
    error: !!club.error || claimsQ.error,
    now,
    seasons,
    season,
    players: club.players,
    roster,
    matches,
    stateOf,
    reviewOf,
    last: lastView,
    next: nextView,
    claims,
    people,
    admins,
    doorRequests: doorQ.data.length,
    content: { gaps },
    mvp,
    overview,
  };
}
