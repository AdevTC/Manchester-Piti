// «Tu temporada en 10 cromos» around the viewer: which recap the perfil offers (and the vestuario
// announces), the cromos' titles and the PNGs' file names. Pure.
//
// recapAvailable says «closed» once a later season is the club's current one, so the recap on offer is
// the current season's («hasta ahora», from its 10th match) or else the one just before it (closed).
import { recapAvailable, seasonRecap, type RecapCard, type RecapInput, type RecapPorraRow, type SeasonRecap } from "../../lib/derived/seasonRecap";
import { dateMillis, type ClubMatch } from "../../lib/clubData";
import { slugOf } from "./share";

/** What recapDraw needs besides the cromo (the site's theme, the shirt). */
export type RecapCtx = Parameters<typeof import("./recapDraw").recapCardBlob>[1];

/** The block's offer: the recap and whether its season is over or still going («hasta ahora»). */
export interface RecapOffer {
  status: "closed" | "partial";
  recap: SeasonRecap;
}

/** The season just before the current one (the seasons in their app order, archived ones left out). */
export function previousSeasonId(seasons: RecapInput["seasons"], currentId: string): string | null {
  const live = seasons.filter((s) => !s.archived);
  const at = live.findIndex((s) => s.id === currentId);
  return at > 0 ? live[at - 1].id : null;
}

/**
 * The recap on offer: the current season's while it is «hasta ahora», else the previous season's once it
 * is closed. `porra` holds each season's porra rows (the recap's season decides which).
 */
export function recapOffer(base: Omit<RecapInput, "porraStandings">, porra: Record<string, RecapPorraRow[]>, playerId: string | null | undefined, currentId: string): RecapOffer | null {
  if (!playerId || !currentId) return null;
  const prev = previousSeasonId(base.seasons, currentId);
  for (const id of prev ? [currentId, prev] : [currentId]) {
    const input: RecapInput = { ...base, porraStandings: porra[id] ?? [] };
    const status = recapAvailable(input, playerId, id, base.now);
    if (!status) continue;
    const recap = seasonRecap(input, playerId, id);
    if (recap) return { status, recap };
  }
  return null;
}

const DAY = 86_400_000;
export const RECAP_BANNER_DAYS = 14;

/**
 * When the recap's season closed for the vestuario's banner: the day the season after it kicks off (its
 * first match), never before the recap's own last match. Null when that season has no match yet.
 */
export function recapClosedAt(matches: ClubMatch[], recapSeasonId: string, nextSeasonId: string): number | null {
  const first = matches.filter((m) => m.seasonId === nextSeasonId).map((m) => dateMillis(m.date)).filter((t) => t > 0);
  if (!first.length) return null;
  const last = matches.filter((m) => m.seasonId === recapSeasonId).map((m) => dateMillis(m.date));
  return Math.max(Math.min(...first), ...last);
}

/** The banner: a closed recap, from its close until 14 days after it. */
export function recapBannerOn(offer: RecapOffer | null, closedAt: number | null, now: number): boolean {
  return offer?.status === "closed" && closedAt !== null && now < closedAt + RECAP_BANNER_DAYS * DAY;
}

const TITLE: Record<RecapCard["kind"], string> = {
  portada: "Portada",
  partidos: "Partidos y minutos",
  goles: "Goles y asistencias",
  mvp: "MVP",
  socio: "Tu socio",
  posiciones: "Dónde jugaste",
  porra: "La porra",
  medallas: "Tus medallas",
  equipo: "El equipo",
  cierre: "Cierre",
};
export const cardTitle = (c: RecapCard): string => TITLE[c.kind];

/** «temporada-1-03-goles.png»: the season, the cromo's place and what it is. */
export function recapFileName(seasonName: string, i: number, card: RecapCard): string {
  return `${slugOf(seasonName) || "temporada"}-${String(i + 1).padStart(2, "0")}-${card.kind}.png`;
}
