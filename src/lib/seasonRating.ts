/** GLOBAL is a club rubric, not a professional scouting model or a match rating.
 * Its versioned weights and reference rates are public so every point can be explained. */
import { isCompleted } from "../../functions/src/matchEngine";
import { evaluateNarrated, prepareNarrated } from "../../functions/src/narrated/engine";
import { kindOf, quantity } from "../../functions/src/narrated/operators";
import { mergedObservations } from "../../functions/src/narrated/observations";
import type { MetricResult } from "../../functions/src/narrated/types";
import type { ClubMatch } from "./clubData";
import { minutesOf } from "./derived/minutesOf";
import { cardPoints } from "./form";
import { isPosCode, lineOf, resolvePositions, type Line } from "./positions";

export const SEASON_RATING_VERSION = "piti-season-v2";
export const GLOBAL_MIN = 0;
export const GLOBAL_MAX = 99;
type BlockId = "finishing" | "creation" | "passing" | "retention" | "dribbling" | "defence" | "keeping" | "discipline";
export const GLOBAL_WEIGHTS: Record<Line, Record<BlockId, number>> = {
  POR: { finishing: 0, creation: 0, passing: 15, retention: 10, dribbling: 0, defence: 0, keeping: 70, discipline: 5 },
  DEF: { finishing: 10, creation: 10, passing: 20, retention: 15, dribbling: 5, defence: 35, keeping: 0, discipline: 5 },
  MED: { finishing: 5, creation: 20, passing: 25, retention: 20, dribbling: 10, defence: 15, keeping: 0, discipline: 5 },
  DEL: { finishing: 35, creation: 20, passing: 15, retention: 10, dribbling: 15, defence: 0, keeping: 0, discipline: 5 },
};
export const GLOBAL_METHOD = "Índice propio del club, de 0 a 99. Toda la temporada pesa igual; no es una nota oficial ni mide ritmo o físico. Cada bloque tiene un peso máximo según la posición. Sólo se usan indicadores conocidos y se reparte el peso entre los disponibles. Con menos de 150 minutos o 30 acciones, la nota se acerca al centro 50 para limitar muestras pequeñas. Los datos ausentes nunca valen cero.";
export interface SeasonRatingBlock {
  id: BlockId;
  label: string;
  weight: number;
  score: number | null;
  detail: string;
  metrics: string[];
  partial: boolean;
}
export interface SeasonRating {
  version: typeof SEASON_RATING_VERSION;
  value: number | null;
  status: "rated" | "provisional" | "insufficient";
  summary: string;
  explanation: string;
  role: Line | null;
  roleSource: "played" | "preferred" | "unknown";
  minutes: number | null;
  matches: number;
  sample: number;
  knownWeight: number;
  confidence: number;
  blocks: SeasonRatingBlock[];
}
export interface RatingPlayer { id: string; naturalPosition?: unknown; positions?: unknown }
const ids = ["015", "034", "070", "105", "106", "116", "121", "138", "154", "167", "201", "206", "272", "274", "295"];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const fmt = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 1 });

/** Latest revision wins before visibility is checked: stale copies cannot revive an archive. */
export function ratingMatches(matches: readonly ClubMatch[]): ClubMatch[] {
  const unique = new Map<string, ClubMatch>();
  for (const match of matches) {
    const previous = unique.get(match.id);
    if (!previous || (match.revision ?? 0) >= (previous.revision ?? 0)) unique.set(match.id, match);
  }
  return [...unique.values()].filter(isCompleted);
}
function roleFor(player: RatingPlayer, games: readonly ClubMatch[]): Pick<SeasonRating, "role" | "roleSource"> {
  const minutes = new Map<Line, number>();
  for (const game of games) {
    const row = game.ledger?.[player.id];
    if (!row?.played || row.positionsEstimated) continue;
    for (const [code, min] of Object.entries(row.positionsPlayed ?? {})) {
      if (isPosCode(code) && typeof min === "number" && Number.isFinite(min) && min > 0) {
        const line = lineOf(code); minutes.set(line, (minutes.get(line) ?? 0) + min);
      }
    }
  }
  const known = [...minutes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (known.length && (!known[1] || known[0][1] > known[1][1])) return { role: known[0][0], roleSource: "played" };
  const role = resolvePositions({ positions: player.positions, naturalPosition: player.naturalPosition }).line;
  return { role, roleSource: role ? "preferred" : "unknown" };
}
type Indicator = { score: number; detail: string; metric: string; partial: boolean };
const usable = (r: MetricResult | undefined): r is MetricResult & { value: number } => !!r && r.value != null && Number.isFinite(r.value) && (r.status === "complete" || r.status === "partial") && r.pending === 0;

export function seasonRating(player: RatingPlayer, matches: readonly ClubMatch[]): SeasonRating {
  const selected = ratingMatches(matches);
  const multipleSeasons = new Set(selected.map(m => m.seasonId ?? "legacy")).size > 1;
  const games = selected.filter(m => {
    if (m.notCalled?.includes(player.id) || m.ledger?.[player.id]?.notCalled) return false;
    if (m.ledger?.[player.id]?.played === true || (m.events ?? []).some(e => e.playerId === player.id || e.assistPlayerId === player.id)) return true;
    return mergedObservations(m).some(e => {
      if (["lineup", "substitution", "context", "control", "gap", "tactical"].includes(kindOf(e))) return false;
      return e.team === "us" ? e.actorId === player.id || e.receiverId === player.id || e.facts.assistPlayerId === player.id : e.facts.keeperId === player.id || e.facts.defenderId === player.id;
    });
  });
  const role = roleFor(player, games);
  // A narrated action proves presence, not its duration. The legacy minutes helper
  // cannot distinguish rich-only participation from absence when no ledger exists.
  const minutes = games.length && games.every(m => m.ledger?.[player.id] && minutesOf(m, player.id) != null) ? games.reduce((sum, m) => sum + (minutesOf(m, player.id) ?? 0), 0) : null;
  const results = new Map(evaluateNarrated(games, { playerIds: [player.id] }, ids).map(r => [r.id, r]));
  const context = prepareNarrated(games, { playerIds: [player.id] });
  // A linked duel/tackle/recovery is one sample, not three independent pieces of evidence.
  const actions = new Map<string, number>();
  for (const e of context.events) {
    if (!["pass", "distribution", "shot", "goal", "save", "dribble", "duel", "tackle", "recovery", "interception", "clearance", "block", "loss"].includes(kindOf(e))) continue;
    const outcome = e.facts.outcome;
    const knownAction = ["goal", "save", "recovery", "interception", "clearance", "block", "loss"].includes(kindOf(e)) || e.facts.goal === true || typeof outcome === "string" && !["unknown", "pending"].includes(outcome) || kindOf(e) === "tackle" && ["us", "opponent", "out"].includes(e.controlAfter ?? "");
    if (!knownAction) continue;
    const key = `${e.matchId}:${e.links?.action ?? e.links?.duel ?? e.canonicalEventId ?? e.id}`;
    actions.set(key, Math.max(actions.get(key) ?? 0, quantity(e)));
  }
  const sample = [...actions.values()].reduce((a, b) => a + b, 0);
  const percentage = (id: string, label: string): Indicator | undefined => {
    const r = results.get(id);
    if (!usable(r) || !r.denominator) return;
    return { score: clamp(r.value / 100), detail: `${label}: ${fmt(r.numerator ?? r.value * r.denominator / 100)}/${fmt(r.denominator)} (${fmt(r.value)} %)`, metric: id, partial: r.status !== "complete" };
  };
  // Reference intensities are house rules, not inferred facts or elite-football benchmarks.
  // x/(x+reference) gives 50/100 at the stated reference and never overflows the block.
  const rate = (id: string, label: string, reference: number): Indicator | undefined => {
    const r = results.get(id);
    if (!usable(r) || r.status !== "complete" || !minutes) return;
    const per50 = r.value * 50 / minutes;
    return { score: per50 / (per50 + reference), detail: `${label}: ${fmt(r.value)} en ${fmt(minutes)} min; ${fmt(per50)}/50 min (referencia del club: ${reference})`, metric: id, partial: false };
  };
  const blocks: SeasonRatingBlock[] = [];
  const block = (id: BlockId, label: string, values: (Indicator | undefined)[]) => {
    const known = values.filter((v): v is Indicator => !!v);
    blocks.push({ id, label, weight: role.role ? GLOBAL_WEIGHTS[role.role][id] : 0, score: known.length ? known.reduce((sum, v) => sum + v.score, 0) * 100 / known.length : null, detail: known.length ? known.map(v => v.detail).join(" · ") : "Sin muestra suficiente o cobertura completa para este bloque.", metrics: known.map(v => v.metric), partial: known.some(v => v.partial) || known.length < values.length });
  };
  block("finishing", "Finalización", [rate("015", "Goles", 1), percentage("034", "Remates a puerta")]);
  // Assists are a fallback, never added to the key-pass count which already includes them.
  block("creation", "Creación", [rate("106", "Pases que crean remate", 2) ?? rate("105", "Asistencias", 0.5), percentage("116", "Centros completados")]);
  block("passing", "Pase", [percentage("070", "Pases completados")]);
  const losses = results.get("201"), contacts = results.get("121");
  const retention = usable(losses) && usable(contacts) && losses.status === "complete" && contacts.status === "complete" && contacts.value > 0
    ? { score: clamp(1 - losses.value / contacts.value), detail: `Pérdidas: ${fmt(losses.value)} por ${fmt(contacts.value)} intervenciones registradas`, metric: "201/121", partial: false } : undefined;
  block("retention", "Conservación", [retention]);
  block("dribbling", "Regate", [percentage("138", "Regates completados")]);
  // A tackle can also be a duel: prefer the latter, do not reward the same contest twice.
  block("defence", "Defensa", [percentage("154", "Duelos ganados") ?? percentage("167", "Entradas con recuperación"), rate("206", "Recuperaciones", 5)]);
  const saves = results.get("272"), conceded = results.get("274");
  // A missing keeperId must not remove a goal from the denominator. 274 also reads
  // certified goalkeeper intervals; reconcile every opponent goal with the final score.
  const goalTimelineKnown = context.matches.every(m => {
    const opponentGoals = m.events.filter(e => e.team === "opponent" && (kindOf(e) === "goal" || e.facts.goal === true) && e.facts.ownGoal !== true && e.facts.shootout !== true);
    return m.match.goalsAgainst != null && opponentGoals.reduce((sum, e) => sum + quantity(e), 0) === m.match.goalsAgainst;
  });
  // A certified full-match goalkeeper also identifies the denominator without
  // repeating keeperId on every goal. A preferred/estimated position is not proof.
  const wholeMatchKeeper = games.length > 0 && games.every(m => {
    const row = m.ledger?.[player.id];
    const duration = (m.durationSeconds ?? (m.duration ?? 0) * 60) / 60;
    return duration > 0 && row?.played && !row.positionsEstimated && (row.positionsPlayed?.POR ?? 0) >= duration && row.minutes >= duration && m.goalsAgainst != null;
  });
  const goalsConceded = usable(conceded) ? conceded.value : wholeMatchKeeper ? games.reduce((sum, m) => sum + m.goalsAgainst!, 0) : null;
  const faced = usable(saves) && goalsConceded != null ? saves.value + goalsConceded : 0;
  const keeping: Indicator | undefined = goalTimelineKnown && faced > 0 && usable(saves) && goalsConceded != null
    ? { score: saves.value / faced, detail: `Paradas: ${fmt(saves.value)}/${fmt(faced)} remates a puerta (${fmt(100 * saves.value / faced)} %)`, metric: "272/274", partial: saves.status !== "complete" || conceded?.status !== "complete" } : undefined;
  block("keeping", "Portería", [keeping]);
  const rowsKnown = games.length > 0 && games.every(m => !!m.ledger?.[player.id]);
  const cards = rowsKnown ? games.reduce((sum, m) => sum + cardPoints(m.ledger![player.id]), 0) : null;
  const fouls = results.get("295");
  // Discipline indicators share a fixed 5% block; a second yellow counts only as a dismissal.
  const knownFouls = usable(fouls) && fouls.status === "complete" ? fouls.value : null;
  const discipline: Indicator | undefined = cards != null && minutes
    ? { score: 1 / (1 + (cards + (knownFouls ?? 0) / 4) * 50 / minutes), detail: `${fmt(cards)} puntos de tarjeta${knownFouls != null ? ` y ${fmt(knownFouls)} faltas` : "; faltas sin cobertura suficiente, no ponderan"} en ${fmt(minutes)} min; amarilla=1, expulsión=2${knownFouls != null ? ", falta=0,25" : ""}`, metric: knownFouls == null ? "cards" : "295/cards", partial: knownFouls == null } : undefined;
  block("discipline", "Disciplina", [discipline]);
  const known = blocks.filter(b => b.weight > 0 && b.score != null);
  const knownWeight = known.reduce((sum, b) => sum + b.weight, 0);
  const confidence = Math.min(1, (minutes ?? 0) / 150, sample / 30);
  const sufficient = !multipleSeasons && !!role.role && (minutes ?? 0) >= 10 && sample >= 6 && known.filter(b => b.id !== "discipline").length >= 2 && knownWeight >= 30;
  const raw = knownWeight ? known.reduce((sum, b) => sum + b.weight * b.score!, 0) / knownWeight : 0;
  const value = sufficient ? Math.round(99 * (0.5 + (raw / 100 - 0.5) * confidence)) : null;
  const status = value == null ? "insufficient" : confidence < 1 || knownWeight < 100 || known.some(b => b.partial) ? "provisional" : "rated";
  const summary = multipleSeasons ? "Elige una temporada para consultar GLOBAL" : !games.length ? "Sin partidos esta temporada" : value == null ? "GLOBAL pendiente: faltan minutos, posición o variedad de acciones registradas" : `${status === "provisional" ? "GLOBAL provisional" : "GLOBAL"} ${value}/99 · ${games.length} ${games.length === 1 ? "partido" : "partidos"} · ${knownWeight} % del perfil con datos`;
  return { version: SEASON_RATING_VERSION, value, status, summary, explanation: `${GLOBAL_METHOD} Referencias por 50 minutos: 1 gol, 2 pases que crean remate (o 0,5 asistencias), 5 recuperaciones. Los porcentajes se recalculan sobre todas las oportunidades conocidas, no se promedian por partido.`, ...role, minutes, matches: games.length, sample, knownWeight, confidence, blocks };
}
