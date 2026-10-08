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
  seasonPlayers,
  squadShirts,
  type AccessInfo,
  type Answer,
  type BoardsLine,
  type ConvocatoriaLine,
  type PorraLine,
} from "./profileData";
import type { SquadShirt } from "./rules";

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
  freeFichas: FreeFicha[];
  next: NextMatch | null;
  stuff: { boards: BoardsLine; porra: PorraLine | null; convocatorias: ConvocatoriaLine; loading: boolean };
  captain: { doorRequests: DoorRequestRow[]; pendingClaims: Claim[] } | null;
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

export function useProfileData(): ProfileData {
  const { user, profile, loading: authLoading } = useAuth();
  const { seasons, loadingSeasons } = useSeason();
  const { matches, players, loading: clubLoading, error: clubError } = useClubData();
  const mvpResults = useMvpResults();
  const now = useClock(60_000);
  const minute = Math.floor(now / 60_000) * 60_000;
  const uid = user?.uid ?? "";
  const role: Role = profile?.role ?? "user";
  const isCaptain = role === "admin" || role === "superadmin";
  const linkedId = profile?.playerId ?? null;

  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "Temporada";

  const claim = useMyClaim(linkedId ? undefined : uid || undefined);
  const info = fichaInfo(linkedId, claim.data);
  const membership = useMembership(uid || undefined);
  const openedBy = membership.data && membership.data.by && membership.data.by !== uid ? membership.data.by : undefined;
  const opener = useNicknameOf(openedBy);
  const links = usePlayerLinks(!linkedId || isCaptain);
  const lineups = useLineups(seasonId || "all");
  const porra = usePorraStandings(seasonId || undefined);
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
  const createdAt = toMillis(profile?.createdAt);
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
    freeFichas,
    next: next ? { id: next.id, rival: next.rival || "Rival", dateMs: dateMillis(next.date), home: typeof next.home === "boolean" ? next.home : null, j: calendar.findIndex((m) => m.id === next.id) + 1 || null } : null,
    stuff: {
      boards: boardsLine(lineups.mine),
      porra: porraLine(porra.data, uid),
      convocatorias,
      loading: lineups.loading || porra.loading || answersQ.isLoading,
    },
    captain: isCaptain ? { doorRequests: doorRequests.data, pendingClaims: pendingClaims.data } : null,
  };
}
