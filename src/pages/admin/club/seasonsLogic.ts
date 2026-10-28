// Temporadas' domain logic, pure (tested in seasonsLogic.test.ts): each season's card (state, captain,
// jornadas, players, matches), the name check, the next season's name, what archiving touches, and the
// «Copiar plantilla de la temporada anterior» plan (who joins the new season with which shirt and dorsal).
import { dateMillis } from "../../../../functions/src/matchEngine";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import type { AdminMatch, AdminMatchState } from "../data/adminLogic";
import { nameIn, numberIn } from "./plantillaLogic";
import { resultLetter, resultTitle, type ResultLetter } from "../../../lib/derived/result";
import { calendarOrder } from "../../../lib/derived/jornada";
import { plural } from "../../../lib/derived/words";


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
    // (its jornadas: the numbered matches — published, not cancelled; a draft is not one yet)
    const numbered = ms.filter((m) => m.jornada != null).length;
    const played = ms.filter((m) => o.stateOf(m) === "published").length;
    const upcoming = ms.some((m) => dateMillis(m.date) > o.now);
    const state: SeasonState = s.id === o.activeId ? "active" : ms.length && !upcoming && played === ms.length ? "done" : "prep";
    return {
      id: s.id,
      name: s.name,
      state,
      captainId: s.captainPlayerId ?? "",
      captain,
      jornadas: `${played} de ${numbered}`,
      players: o.players.filter((p) => (p.seasons ?? []).includes(s.id)).length,
      matches: plural(played, "jugado", "jugados"),
      total: numbered,
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
  /** null: he had no dorsal in that season (he joins without one). */
  number: number | null;
}
/** «Copiar plantilla»: everyone in `fromId` with a dorsal joins the new season with that season's shirt name and
 *  dorsal; with `noNumber`, those without one too (B-CLUB-11: they were left out without a word — see
 *  copyLeftOut). By dorsal, the ones without last. */
export function copyRosterPlan(players: readonly PlayerDoc[], fromId: string, noNumber = false): CopyEntry[] {
  return players
    .filter((p) => (p.seasons ?? []).includes(fromId))
    .map((p) => ({ id: p.id, shirtName: nameIn(p, fromId).toUpperCase(), number: numberIn(p, fromId) }))
    .filter((e) => noNumber || e.number != null)
    .sort((a, b) => (a.number ?? 1000) - (b.number ?? 1000));
}
/** B-CLUB-11: who in `fromId` has no dorsal there (copying «con sus dorsales» leaves them out unless asked). */
export function copyLeftOut(players: readonly PlayerDoc[], fromId: string): string[] {
  return players.filter((p) => (p.seasons ?? []).includes(fromId) && numberIn(p, fromId) == null).map((p) => nameIn(p, fromId).toUpperCase());
}

// ───────────────────────── the vitrina (the active season as silverware) ─────────────────────────
/** Our goals with a scorer (penalties and free kicks included; own goals and the rival's own goals not). */
const SCORED = new Set(["goal", "goal_penalty", "goal_freekick"]);
/** One jornada on the shelf: its G/E/P once its acta is published, a gap otherwise. */
export interface ShelfSlot {
  id: string;
  /** «J4» (or the rival when the match has no jornada). */
  label: string;
  /** null = a gap (not played yet, or played and not published). */
  r: ResultLetter | null;
  /** «J4 · Victoria 4–1 a Emirates», «J7 · sin publicar», «J9 · por jugar». */
  aria: string;
}
export interface Showcase {
  /** Ganados · empatados · perdidos (G/E/P). */
  g: number;
  e: number;
  p: number;
  gf: number;
  ga: number;
  /** Matches whose acta is published (the ones that count). */
  published: number;
  /** The season's jornadas: its numbered matches (published, not cancelled). */
  total: number;
  shelf: ShelfSlot[];
  /** The top scorers of the published actas: every tied winner, with goals per player. */
  pichichi: { ids: string[]; goals: number } | null;
  /** The widest win. */
  biggest: { gf: number; ga: number; rival: string; label: string } | null;
  /** The longest run of wins in a row. */
  streak: number;
  /** Who was MVP most often (ties share it). */
  mvp: { ids: string[]; times: number } | null;
  /** Played jornadas whose acta is not published yet (they enter the vitrina when it is): «J5». */
  waiting: string[];
  /** Played matches still only a draft (no jornada yet): their rivals. */
  waitingDrafts: string[];
}
/**
 * The vitrina of `seasonId`: the record, the goals, the Pichichi, the shelf of jornadas and the trophies —
 * computed from the PUBLISHED actas only (the web's numbers). `mvpOf` = the MVP winners of a match.
 */
export function seasonShowcase(o: {
  seasonId: string;
  matches: readonly AdminMatch[];
  stateOf: (m: AdminMatch) => AdminMatchState;
  now: number;
  mvpOf: (m: AdminMatch) => readonly string[];
  nameOf: (id: string) => string;
}): Showcase {
  // The shelf holds the season's jornadas (derived/jornada: published, not cancelled, in calendar order);
  // a draft is not a jornada yet — the foot mentions it when it has been played.
  const inSeason = o.matches.filter((m) => m.seasonId === o.seasonId && m.status !== "cancelled").sort(calendarOrder);
  const ms = inSeason.filter((m) => m.jornada != null);
  const label = (m: AdminMatch) => `J${m.jornada}`;
  const counts = (m: AdminMatch) => o.stateOf(m) === "published" && m.status === "finished" && typeof m.goalsFor === "number";
  const pub = ms.filter(counts);
  const out: Showcase = { g: 0, e: 0, p: 0, gf: 0, ga: 0, published: pub.length, total: ms.length, shelf: [], pichichi: null, biggest: null, streak: 0, mvp: null, waiting: [], waitingDrafts: [] };
  const goals = new Map<string, number>();
  const mvps = new Map<string, number>();
  let run = 0;
  for (const m of pub) {
    const gf = m.goalsFor ?? 0;
    const ga = m.goalsAgainst ?? 0;
    const r = resultLetter(gf, ga);
    out[r === "G" ? "g" : r === "E" ? "e" : "p"] += 1;
    out.gf += gf;
    out.ga += ga;
    run = r === "G" ? run + 1 : 0;
    out.streak = Math.max(out.streak, run);
    if (r === "G" && (!out.biggest || gf - ga > out.biggest.gf - out.biggest.ga)) out.biggest = { gf, ga, rival: m.rival || "Rival", label: label(m) };
    for (const e of m.events ?? []) if (SCORED.has(e.type) && e.playerId) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
    for (const id of o.mvpOf(m)) mvps.set(id, (mvps.get(id) ?? 0) + 1);
  }
  const byName = (a: string, b: string) => o.nameOf(a).localeCompare(o.nameOf(b), "es");
  const mostGoals = Math.max(0, ...goals.values());
  if (mostGoals) out.pichichi = { ids: [...goals.keys()].filter((id) => goals.get(id) === mostGoals).sort(byName), goals: mostGoals };
  const most = Math.max(0, ...mvps.values());
  if (most) out.mvp = { ids: [...mvps.keys()].filter((id) => mvps.get(id) === most).sort(byName), times: most };
  out.shelf = ms.map((m) => {
    const l = label(m);
    if (counts(m)) {
      const gf = m.goalsFor ?? 0;
      const ga = m.goalsAgainst ?? 0;
      const r = resultLetter(gf, ga);
      return { id: m.id, label: l, r, aria: `${l} · ${resultTitle(r)} ${gf}–${ga} a ${m.rival || "Rival"}` };
    }
    const played = dateMillis(m.date) <= o.now && m.status !== "postponed";
    return { id: m.id, label: l, r: null, aria: `${l} · ${m.status === "postponed" ? "aplazado" : played ? "sin publicar" : "por jugar"}` };
  });
  const pending = (m: AdminMatch) => !counts(m) && m.status !== "postponed" && dateMillis(m.date) <= o.now;
  out.waiting = ms.filter(pending).map(label);
  out.waitingDrafts = inSeason.filter((m) => m.jornada == null && pending(m)).map((m) => m.rival || "Rival");
  return out;
}

/** The vitrina's foot: only published actas count — and which played ones are still waiting (the
 *  jornadas, then the drafts by their rival). */
export function countsNote(waiting: readonly string[], drafts: readonly string[] = []): string {
  const and = (xs: readonly string[]) => (xs.length < 2 ? xs[0] : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const parts = ["Cuentan las actas publicadas"];
  if (waiting.length) parts.push(waiting.length === 1 ? `la ${waiting[0]} entra al publicarla` : `la ${and(waiting)} entran al publicarlas`);
  if (drafts.length) parts.push(drafts.length === 1 ? `el borrador contra ${drafts[0]} entra al publicarlo` : `los borradores contra ${and(drafts)} entran al publicarlos`);
  return parts.join(" · ");
}

/** The lower thirds' tag for a season: «T1» for «Temporada 1», «TEMP» otherwise. */
export function seasonTag(name: string): string {
  const n = /temporada\s+(\d+)/i.exec(name)?.[1];
  return n ? `T${n}` : "TEMP";
}
