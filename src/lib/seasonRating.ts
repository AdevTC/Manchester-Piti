/** GLOBAL: the season number on the card and the cromos. Each match gives a nota (0–10, 6,5 a normal match)
 * from what every action was worth (./rating); GLOBAL is their mean × 10 over a cushion of three normal
 * matches. Its constants and version are public so every point can be explained. */
import { isCompleted } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import { isPosCode, lineOf, resolvePositions, type Line } from "./positions";
import { computeStats } from "./playerStats";
import type { Standings } from "./standings";
import { MIN_RATED_MINUTES, MODEL_VERSION, PROVISIONAL_MINUTES } from "./rating/constants";
import { emptySeason, NO_STANDINGS, seasonRatings, type MatchNote, type PlusMinus, type SeasonRatings } from "./rating/season";
import type { Group, Item } from "./rating/values";

export { NO_STANDINGS, seasonRatings, type MatchNote, type SeasonRatings } from "./rating/season";
export const SEASON_RATING_VERSION = MODEL_VERSION;
export const GLOBAL_MIN = 0;
export const GLOBAL_MAX = 99;
export const GLOBAL_METHOD =
  "Cada partido tiene una nota de 0 a 10 (6,5 es un partido normal): lo que suma o resta cada acción tuya, en goles que ganas o regalas al rival, cada 50 minutos y comparado con los de tu línea. GLOBAL es la media de tus notas por 10: un partido cuenta entero desde 30 minutos y en proporción por debajo, uno sin narrar cuenta la mitad, y la media parte de tres partidos de 6,5 para que pocos partidos no decidan. Ante un rival fuerte de la clasificación lo bueno vale más y los fallos restan menos. Los votos MVP no cuentan. Sin minutos en el acta no hay nota: no se inventan.";
const GROUP_LABEL: Record<Group, string> = { ataque: "Ataque", pase: "Pase", defensa: "Defensa", porteria: "Portería", errores: "Errores", disciplina: "Disciplina" };

export interface SeasonRatingGroup {
  id: Group;
  label: string;
  /** What these actions were worth over the season, in goals. */
  value: number;
  items: Item[];
}
export interface SeasonRating {
  version: typeof SEASON_RATING_VERSION;
  /** GLOBAL, 0–99; null before his first match with a nota, or over several seasons. */
  value: number | null;
  /** FOR: the same over his last five matches. */
  form: number | null;
  status: "rated" | "provisional" | "insufficient";
  summary: string;
  explanation: string;
  role: Line | null;
  roleSource: "played" | "preferred" | "unknown";
  /** Minutes of his matches with a nota (null when he has none). */
  minutes: number | null;
  /** Matches with a nota. */
  matches: number;
  notes: MatchNote[];
  groups: SeasonRatingGroup[];
  plusMinus: PlusMinus | null;
}
export interface RatingPlayer {
  id: string;
  naturalPosition?: unknown;
  positions?: unknown;
}

/** Latest revision wins before visibility is checked: stale copies cannot revive an archive. (The same
 *  input gives the same array, so the season's numbers are computed once for every player.) */
const selected = new WeakMap<readonly ClubMatch[], ClubMatch[]>();
export function ratingMatches(matches: readonly ClubMatch[]): ClubMatch[] {
  const hit = selected.get(matches);
  if (hit) return hit;
  const unique = new Map<string, ClubMatch>();
  for (const match of matches) {
    const previous = unique.get(match.id);
    if (!previous || (match.revision ?? 0) >= (previous.revision ?? 0)) unique.set(match.id, match);
  }
  const out = [...unique.values()].filter(isCompleted);
  selected.set(matches, out);
  selected.set(out, out);
  return out;
}

/** His line: the one with most minutes certified by the actas (an estimated position is not proof), else
 *  his preferred one. */
function roleFor(player: RatingPlayer, games: readonly ClubMatch[]): Pick<SeasonRating, "role" | "roleSource"> {
  const minutes = new Map<Line, number>();
  for (const game of games) {
    const row = game.ledger?.[player.id];
    if (!row?.played || row.positionsEstimated) continue;
    for (const [code, min] of Object.entries(row.positionsPlayed ?? {})) {
      if (isPosCode(code) && typeof min === "number" && Number.isFinite(min) && min > 0) {
        const line = lineOf(code);
        minutes.set(line, (minutes.get(line) ?? 0) + min);
      }
    }
  }
  const known = [...minutes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (known.length && (!known[1] || known[0][1] > known[1][1])) return { role: known[0][0], roleSource: "played" };
  const role = resolvePositions({ positions: player.positions, naturalPosition: player.naturalPosition }).line;
  return { role, roleSource: role ? "preferred" : "unknown" };
}

const fmt = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 0 });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A player's GLOBAL from the period's numbers (`ratings`: seasonRatings over `games`). */
export function seasonRatingFrom(player: RatingPlayer, ratings: SeasonRatings, games: readonly ClubMatch[]): SeasonRating {
  const p = ratings.players.get(player.id) ?? emptySeason();
  const role = roleFor(player, games);
  const status: SeasonRating["status"] = p.value === null ? "insufficient" : p.minutes < PROVISIONAL_MINUTES ? "provisional" : "rated";
  // (played as every page counts it: an old acta without a ledger too, though it gives no nota)
  const played = computeStats(player.id, [...games]).matchesPlayed;
  const summary = ratings.multipleSeasons
    ? "Elige una temporada para consultar GLOBAL"
    : !played
      ? "Sin partidos esta temporada"
      : p.value === null
        ? p.played - p.unknownMinutes <= 0
          ? "GLOBAL pendiente: el acta no tiene sus minutos"
          : `GLOBAL pendiente: aún sin ${MIN_RATED_MINUTES} minutos en un partido`
        : `${status === "provisional" ? "GLOBAL provisional" : "GLOBAL"} ${p.value}/99 · ${plural(p.notes.length, "partido", "partidos")}${status === "provisional" ? ` · ${fmt(p.minutes)} min` : ""}`;
  const groups = (Object.keys(GROUP_LABEL) as Group[])
    .map((id) => {
      const items = p.items.filter((it) => it.group === id);
      return { id, label: GROUP_LABEL[id], value: items.reduce((s, it) => s + it.value, 0), items };
    })
    .filter((g) => g.items.length);
  return {
    version: SEASON_RATING_VERSION,
    value: ratings.multipleSeasons ? null : p.value,
    form: ratings.multipleSeasons ? null : p.form,
    status: ratings.multipleSeasons ? "insufficient" : status,
    summary,
    explanation: GLOBAL_METHOD,
    ...role,
    minutes: p.notes.length ? p.minutes : null,
    matches: p.notes.length,
    notes: p.notes,
    groups,
    plusMinus: p.plusMinus,
  };
}

/** A player's GLOBAL over `matches` (`standings`: every season's current table, for the rival's strength). */
export function seasonRating(player: RatingPlayer, matches: readonly ClubMatch[], standings: readonly Standings[] = NO_STANDINGS): SeasonRating {
  const games = ratingMatches(matches);
  return seasonRatingFrom(player, seasonRatings(games, standings), games);
}
