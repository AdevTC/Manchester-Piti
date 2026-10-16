// «Tu temporada en 10 cromos» around the viewer: which recap the perfil offers (and the vestuario
// announces), the cromos' titles and the PNGs' file names. Pure.
//
// recapAvailable says «closed» once a later season is the club's current one. The recap on offer is the
// previous season's (closed) for 30 days after its last match, else the current one's («hasta ahora», from
// its 10th match).
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

const DAY = 86_400_000;
/** How long the previous season's closed recap stays on offer (and the vestuario's banner on). */
export const RECAP_WINDOW_DAYS = 30;

/** The season's last match (null without a dated match). */
export function seasonLastMatchAt(matches: ClubMatch[], seasonId: string): number | null {
  const at = matches.filter((m) => m.seasonId === seasonId).map((m) => dateMillis(m.date)).filter((t) => t > 0);
  return at.length ? Math.max(...at) : null;
}

/**
 * The previous season while its closed recap is on offer: it is «closed» for the player and `now` is at
 * most 30 days past its last match. Cheap (no recap is built): the vestuario's banner and the perfil's
 * porra listener ask it first.
 */
export function closedRecapSeason(base: Omit<RecapInput, "porraStandings">, playerId: string | null | undefined, currentId: string): string | null {
  if (!playerId || !currentId) return null;
  const prev = previousSeasonId(base.seasons, currentId);
  if (!prev) return null;
  const last = seasonLastMatchAt(base.matches, prev);
  if (last === null || base.now > last + RECAP_WINDOW_DAYS * DAY) return null;
  return recapAvailable({ ...base, porraStandings: [] }, playerId, prev, base.now) === "closed" ? prev : null;
}

/**
 * The recap on offer: the previous season's, closed, within its 30 days (closedRecapSeason); otherwise
 * the current season's «hasta ahora» from its 10th match. `porra` holds each season's porra rows.
 */
export function recapOffer(base: Omit<RecapInput, "porraStandings">, porra: Record<string, RecapPorraRow[]>, playerId: string | null | undefined, currentId: string): RecapOffer | null {
  if (!playerId || !currentId) return null;
  const closed = closedRecapSeason(base, playerId, currentId);
  if (closed) {
    const recap = seasonRecap({ ...base, porraStandings: porra[closed] ?? [] }, playerId, closed);
    if (recap) return { status: "closed", recap };
  }
  const input: RecapInput = { ...base, porraStandings: porra[currentId] ?? [] };
  const status = recapAvailable(input, playerId, currentId, base.now);
  if (!status) return null;
  const recap = seasonRecap(input, playerId, currentId);
  return recap ? { status, recap } : null;
}

/** The vestuario's banner: the closed season's name while its recap is on offer (no recap built). */
export function recapBannerSeason(base: Omit<RecapInput, "porraStandings">, playerId: string | null | undefined, currentId: string): string | null {
  const id = closedRecapSeason(base, playerId, currentId);
  return id ? (base.seasons.find((s) => s.id === id)?.name ?? null) : null;
}

/** The shirt the PNGs print: the recap's own portada (that season's name and number), not today's. */
export function recapShirt(recap: SeasonRecap): { name: string; number: string } {
  for (const c of recap.cards) if (c.kind === "portada") return { name: c.name, number: c.number };
  return { name: "", number: "" };
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
