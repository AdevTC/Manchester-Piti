// /profile «La carta»: everything the page needs, assembled from the app's shared subscriptions (the
// same keys the vestuario, the pizarra and the door use, so nothing is listened to twice). The only
// one-shot read is your convocatoria answers of the season (one small doc per match, cached).
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useSeason } from "../../context/SeasonContext";
import { useClubData, dateMillis, nextFixture, type ClubMatch } from "../../lib/clubData";
import { currentSeasonId } from "../../lib/vestuario";
import { achievements, nextToChase, type Achievement } from "../../lib/derived/achievements";
import type { PlayerPositions } from "../../lib/positionStats";
import { useClock } from "../../hooks/useClock";
import { useLineups } from "../pizarra/useLineups";
import {
  useAvailability,
  useDoorRequests,
  useMembership,
  useMvpResults,
  useMyClaim,
  useNicknameOf,
  usePendingClaims,
  usePlayerLinks,
  usePorraStandings,
  type Claim,
  type DoorRequestRow,
} from "../vestuario/live";
import { buildCard, POSITION_LONG, seasonCalendar, seasonSquad, type CardView, type FichaState } from "./card";
import {
  accessInfo,
  boardsLine,
  convocatoriaLine,
  convocatoriaMatches,
  fichaInfo,
  porraLine,
  positionsInfo,
  positionsPlayed,
  seasonPlayers,
  squadShirts,
  type AccessInfo,
  type Answer,
  type BoardsLine,
  type ConvocatoriaLine,
  type PorraLine,
  type PositionsInfo,
} from "./profileData";
import type { SquadShirt } from "./rules";
import { upcomingRows, type UpcomingRow } from "./avisos";
import { closedRecapSeason, recapOffer, type RecapOffer } from "./recapView";
import type { TuMaqueta } from "../../components/vidrio/tu/maqueta";

export type Role = "superadmin" | "admin" | "user";
/** A ficha the member can still ask for (the claim picker): this season's, nobody linked to it. */
export interface FreeFicha {
  id: string;
  name: string;
  number: string;
  posLong: string | null;
  /** The cromo's rating (null before the season starts: «—»). */
  rating: number | null;
}
export interface NextMatch {
  id: string;
  rival: string;
  dateMs: number;
  home: boolean | null;
  /** Its jornada in the season's calendar (null when it isn't in this season's). */
  j: number | null;
}

export interface ProfileData {
  loading: boolean;
  /** Something essential could not be read (club data, your membership or your request). */
  error: boolean;
  uid: string;
  nickname: string;
  role: Role;
  /** Captains (admins) see the Capitanía tab, the door notice and the «C». */
  isCaptain: boolean;
  isSuperadmin: boolean;
  google: { name: string; email: string; photo: string | null };
  access: AccessInfo;
  seasonId: string;
  seasonName: string;
  ficha: { state: FichaState; playerId: string | null; rejectedPlayerId: string | null; claim: Claim | null };
  /** «En la espalda»: what you wear now and every other shirt (for «Ya la lleva el 9 (ERIK)»). */
  shirt: { current: string; number: string; squad: SquadShirt[]; fullName: string };
  card: CardView;
  /** «Tus posiciones» (vinculada only, live: the captain's answer shows as it lands). */
  positions: PositionsInfo | null;
  /** «Dónde has jugado» (vinculada only): his minutes by exact position in this season's actas. */
  played: PlayerPositions | null;
  freeFichas: FreeFicha[];
  next: NextMatch | null;
  /** Avisos › Calendario: the next three matches to play. */
  upcoming: UpcomingRow[];
  stuff: { boards: BoardsLine; porra: PorraLine | null; convocatorias: ConvocatoriaLine; loading: boolean };
  captain: { doorRequests: DoorRequestRow[]; pendingClaims: Claim[] } | null;
  /** «Tus logros» (vinculada only): the medals of the whole career and the three to chase next. */
  logros: { list: Achievement[]; next: Achievement[] } | null;
  /** «Tu temporada en 10 cromos» (vinculada only): the season's recap once it can be opened. */
  recap: RecapOffer | null;
}

const toMillis = (v: unknown): number | null => {
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && "toMillis" in v && typeof v.toMillis === "function") {
    const ms: unknown = v.toMillis();
    return typeof ms === "number" ? ms : null;
  }
  return null;
};
const isAnswer = (v: unknown): v is Answer => v === "yes" || v === "no" || v === "maybe";

/** Your answers to this season's convocatorias (matchPrivate/{match}/availability/{uid}). */
function useSeasonAnswers(uid: string, matchIds: string[]) {
  return useQuery({
    queryKey: ["perfil-availability", uid, matchIds.join(",")],
    enabled: !!uid && matchIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const snaps = await Promise.all(matchIds.map((id) => getDoc(doc(db, "matchPrivate", id, "availability", uid))));
      const answers = new Map<string, Answer>();
      snaps.forEach((s, i) => {
        const r: unknown = s.exists() ? s.get("response") : undefined;
        if (isAnswer(r)) answers.set(matchIds[i], r);
      });
      return answers;
    },
  });
}

/** `maq` (DEV only, components/vidrio/tu/maqueta): look at the page as another viewer with production's data —
 *  a player (`jugador`: his ficha linked), a socio without a ficha, a new account (a pending request), a captain. */
export function useProfileData(maq: TuMaqueta | null = null): ProfileData {
  const { user, profile, loading: authLoading } = useAuth();
  const { seasons, loadingSeasons } = useSeason();
  const { matches, players, loading: clubLoading, error: clubError } = useClubData();
  const mvpResults = useMvpResults();
  const now = useClock(60_000);
  const minute = Math.floor(now / 60_000) * 60_000;
  const uid = user?.uid ?? "";
  const q = maq?.quien ?? null;
  const role: Role = q === "admin" ? "superadmin" : q === "capitan" ? "admin" : q ? "user" : (profile?.role ?? "user");
  const isCaptain = role === "admin" || role === "superadmin";
  const named = (p: { shirtName?: string; firstName?: string }) => (p.shirtName || p.firstName || "").toLowerCase();
  const maqPlayer = q === "jugador" ? (players.find((p) => p.id === maq?.jugador || named(p) === (maq?.jugador ?? "kevin").toLowerCase()) ?? players.find((p) => p.id !== profile?.playerId)) : undefined;
  const linkedId = q === "jugador" ? (maqPlayer?.id ?? null) : q === "socio" || q === "nuevo" || q === "pendiente" ? null : (profile?.playerId ?? null);

  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "Temporada";

  const claim = useMyClaim(linkedId ? undefined : uid || undefined);
  const maqClaim = q === "pendiente" ? { playerId: players.find((p) => p.id !== profile?.playerId)?.id ?? "", status: "pending" as const } : null;
  const info = fichaInfo(linkedId, q ? maqClaim : claim.data);
  const membership = useMembership(uid || undefined);
  const openedBy = membership.data && membership.data.by && membership.data.by !== uid ? membership.data.by : undefined;
  const opener = useNicknameOf(openedBy);
  const links = usePlayerLinks(!linkedId || isCaptain);
  const lineups = useLineups(seasonId || "all");
  const porra = usePorraStandings(seasonId || undefined);
  // (the cromos may be the previous season's, closed: its porra too, only for a linked member and only
  // while that recap is the one on offer)
  const recapPlayer = info.state === "vinculada" ? info.playerId : null;
  const recapBase = { matches, players, seasons, mvpResults, uid, now: minute };
  const closedId = closedRecapSeason(recapBase, recapPlayer, seasonId);
  const prevPorra = usePorraStandings(closedId ?? undefined);
  const nextAvailability = useAvailability(next?.id);
  const doorRequests = useDoorRequests(isCaptain);
  const pendingClaims = usePendingClaims(isCaptain);

  const nextId = next?.id ?? null;
  const calendar: ClubMatch[] = seasonCalendar(matches, seasonId);
  const convIds = convocatoriaMatches(calendar, nextId).map((m) => m.id);
  const answersQ = useSeasonAnswers(uid, convIds);

  // Plain derivations: the React Compiler memoizes them (the inputs are the shared, stable caches).
  const squadPlayers = seasonPlayers(players, seasonId, seasons, info.playerId);
  const shirtSquad = squadShirts(players, seasonId, seasons);
  const captain = isCaptain || (!!season?.captainPlayerId && info.state === "vinculada" && season.captainPlayerId === info.playerId);
  const card = buildCard({
    state: info.state,
    playerId: info.playerId,
    nickname: profile?.nickname ?? "",
    captain,
    squad: squadPlayers,
    matches,
    seasonId,
    seasonName,
    seasons,
    mvpResults,
    now: minute,
  });

  const taken = new Set(links.data.map((l) => l.playerId));
  const built = seasonSquad(squadPlayers, matches, seasonId, mvpResults, minute);
  const freeFichas: FreeFicha[] = built.squad.list
    .filter((c) => !taken.has(c.id) && c.id !== linkedId && !c.baja)
    .map((c) => ({ id: c.id, name: c.name, number: c.num ? String(c.num) : "", posLong: c.pos ? POSITION_LONG[c.pos] : null, rating: built.games.length ? c.rt : null }));

  const answers = new Map(answersQ.data ?? []);
  // The next match's answer is live (shared with the vestuario): it wins over the cached read.
  const live = nextAvailability.data.find((a) => a.uid === uid)?.response;
  if (nextId && isAnswer(live)) answers.set(nextId, live);
  const convocatorias = convocatoriaLine(answers, convIds, nextId);

  const me = info.state === "vinculada" ? squadPlayers.find((p) => p.id === info.playerId) : undefined;
  const meDoc = me ? players.find((p) => p.id === me.id) : undefined;
  // (the linked ficha's own doc, not the season squad's: a ficha of another season still has positions)
  const fichaDoc = info.state === "vinculada" ? players.find((p) => p.id === info.playerId) : undefined;
  const createdAt = toMillis(profile?.createdAt);
  const porraBySeason = closedId ? { [seasonId]: porra.data, [closedId]: prevPorra.data } : { [seasonId]: porra.data };
  const recap = recapPlayer ? recapOffer(recapBase, porraBySeason, recapPlayer, seasonId) : null;
  const medals = recapPlayer ? achievements(recapPlayer, matches, { mvpResults, seasons, now: minute }) : null;
  return {
    loading: authLoading || clubLoading || loadingSeasons || claim.loading || membership.loading,
    error: !!clubError || claim.error || membership.error,
    uid,
    nickname: profile?.nickname ?? "",
    role,
    isCaptain,
    isSuperadmin: role === "superadmin",
    google: { name: user?.displayName ?? "", email: user?.email ?? profile?.email ?? "", photo: user?.photoURL ?? null },
    access: accessInfo(membership.data, createdAt, uid, opener.data),
    seasonId,
    seasonName,
    ficha: { ...info, claim: claim.data },
    shirt: { current: me?.shirtName || [meDoc?.firstName, meDoc?.lastName].filter(Boolean).join(" "), number: me && me.number ? String(me.number) : "", squad: shirtSquad, fullName: [meDoc?.firstName, meDoc?.lastName].filter(Boolean).join(" ") },
    card,
    positions: positionsInfo(fichaDoc, seasonId),
    played: info.state === "vinculada" && info.playerId ? positionsPlayed(info.playerId, calendar, mvpResults, minute) : null,
    freeFichas,
    next: next ? { id: next.id, rival: next.rival || "Rival", dateMs: dateMillis(next.date), home: typeof next.home === "boolean" ? next.home : null, j: built.jornada.get(next.id) ?? null } : null,
    upcoming: upcomingRows(matches, minute),
    stuff: {
      boards: boardsLine(lineups.mine),
      porra: porraLine(porra.data, uid),
      convocatorias,
      loading: lineups.loading || porra.loading || answersQ.isLoading,
    },
    captain: isCaptain ? { doorRequests: doorRequests.data, pendingClaims: pendingClaims.data } : null,
    logros: medals ? { list: medals, next: nextToChase(medals, 3) } : null,
    recap,
  };
}
