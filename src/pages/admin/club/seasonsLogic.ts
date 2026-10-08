// Temporadas' domain logic, pure (tested in seasonsLogic.test.ts): each season's card (state, captain,
// jornadas, players, matches), the name check, the next season's name, what archiving touches, and the
// «Copiar plantilla de la temporada anterior» plan (who joins the new season with which shirt and dorsal).
import { dateMillis } from "../../../../functions/src/matchEngine";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import type { AdminMatch, AdminMatchState } from "../data/adminLogic";
import { nameIn, numberIn } from "./plantillaLogic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type SeasonState = "active" | "archived" | "prep" | "done";
export const STATE_LABEL: Record<SeasonState, string> = { active: "Activa", archived: "Archivada", prep: "En preparación", done: "Terminada" };

export interface SeasonCard {
  id: string;
  name: string;
  state: SeasonState;
  captainId: string;
  /** Captain's shirt name in that season, or «Sin elegir». */
  captain: string;
  /** «7 de 22» (played of the season's matches), «—» when unknown (archived, still counting). */
  jornadas: string;
  /** Players in the season (null = unknown). */
  players: number | null;
  /** «7 jugados», «18 partidos» (archived: what the server counted). */
  matches: string;
  /** Matches of the season in the calendar (not cancelled). */
  total: number;
  played: number;
}
/** Counts the server reports for an archived season (its docs never reach the app). */
export interface HiddenCounts {
  matches: number;
  players: number;
}

/**
 * The season cards: the active one first, then the visible ones (newest name first), archived last.
 * `activeId` = the season the admin is about (useAdminData's `season`).
 */
export function seasonCards(o: {
  seasons: readonly SeasonDoc[];
  players: readonly PlayerDoc[];
  matches: readonly AdminMatch[];
  stateOf: (m: AdminMatch) => AdminMatchState;
  activeId: string | undefined;
  now: number;
  hidden?: Readonly<Record<string, HiddenCounts | undefined>>;
}): SeasonCard[] {
  const cards = o.seasons.map((s): SeasonCard => {
    const captainDoc = s.captainPlayerId ? o.players.find((p) => p.id === s.captainPlayerId) : undefined;
    const captain = captainDoc ? nameIn(captainDoc, s.id) : s.captainPlayerId ? "Ya no está" : "Sin elegir";
    if (s.archived) {
      const h = o.hidden?.[s.id];
      return { id: s.id, name: s.name, state: "archived", captainId: s.captainPlayerId ?? "", captain: captainDoc ? captain : s.captainPlayerId ? "—" : "Sin elegir", jornadas: h ? `${h.matches} de ${h.matches}` : "—", players: h ? h.players : null, matches: h ? plural(h.matches, "partido", "partidos") : "—", total: h?.matches ?? 0, played: h?.matches ?? 0 };
    }
    const ms = o.matches.filter((m) => m.seasonId === s.id && m.status !== "cancelled");
    const played = ms.filter((m) => o.stateOf(m) === "published").length;
    const upcoming = ms.some((m) => dateMillis(m.date) > o.now);
    const state: SeasonState = s.id === o.activeId ? "active" : ms.length && !upcoming && played === ms.length ? "done" : "prep";
    return {
      id: s.id,
      name: s.name,
      state,
      captainId: s.captainPlayerId ?? "",
      captain,
      jornadas: `${played} de ${ms.length}`,
      players: o.players.filter((p) => (p.seasons ?? []).includes(s.id)).length,
      matches: plural(played, "jugado", "jugados"),
      total: ms.length,
      played,
    };
  });
  const rank = (c: SeasonCard) => (c.state === "active" ? 0 : c.state === "archived" ? 2 : 1);
  return cards.sort((a, b) => rank(a) - rank(b) || b.name.localeCompare(a.name, "es", { numeric: true }));
}

/** A season name: 3 to 40 characters, not repeated. Null = fine. */
export function seasonNameError(name: string, seasons: readonly Pick<SeasonDoc, "id" | "name">[], exceptId: string | null): string | null {
  const t = name.trim();
  if (t.length < 3) return "Mínimo 3 letras.";
  if (t.length > 40) return "Máximo 40 letras.";
  if (seasons.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === t.toLowerCase())) return "Ya hay una temporada con ese nombre.";
  return null;
}
/** «Temporada N+1» after the highest numbered season. */
export function nextSeasonName(seasons: readonly Pick<SeasonDoc, "name">[]): string {
  const nums = seasons.map((s) => Number(/temporada\s+(\d+)/i.exec(s.name)?.[1])).filter((n) => Number.isFinite(n));
  return `Temporada ${nums.length ? Math.max(...nums) + 1 : seasons.length + 1}`;
}

/** What archiving `seasonId` hides: its matches and the players who only play archived seasons. */
export function archiveImpact(seasonId: string, seasons: readonly SeasonDoc[], players: readonly PlayerDoc[], matches: readonly AdminMatch[]): { matches: number; players: number; hiddenPlayers: number } {
  const archived = new Set(seasons.filter((s) => s.archived || s.id === seasonId).map((s) => s.id));
  const inSeason = players.filter((p) => (p.seasons ?? []).includes(seasonId));
  return {
    matches: matches.filter((m) => m.seasonId === seasonId && m.published).length,
    players: inSeason.length,
    hiddenPlayers: inSeason.filter((p) => (p.seasons ?? []).every((id) => archived.has(id))).length,
  };
}

export interface CopyEntry {
  id: string;
  shirtName: string;
  number: number;
}
/** «Copiar plantilla»: everyone in `fromId` joins the new season with that season's shirt name and dorsal. */
export function copyRosterPlan(players: readonly PlayerDoc[], fromId: string): CopyEntry[] {
  return players
    .filter((p) => (p.seasons ?? []).includes(fromId))
    .map((p) => ({ id: p.id, shirtName: nameIn(p, fromId).toUpperCase(), number: numberIn(p, fromId) }))
    .filter((e): e is CopyEntry => e.number != null)
    .sort((a, b) => a.number - b.number);
}
