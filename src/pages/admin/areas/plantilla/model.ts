// PLANTILLA · the words of the board's rows and ficha, pure (tested in model.test.ts): a row's line and state, what
// a ficha still lacks (in the row: «faltan foto, altura y peso»; in the ficha: «Le faltan …»), his account, the
// birthdays coming (Madrid days), his numbers of the season (minutes, goals, assists, cards from the published
// actas), the guests of the convocatorias who could become fichas (M-41), the old ones (Antiguos) and whether a ficha
// can still be deleted (B-CLUB-05: only one nobody cites; the server checks it again).
import type { ClubMatch } from "../../../../lib/clubData";
import { dateMillis } from "../../../../lib/clubData";
import { madridDate } from "../../../../lib/derived/absences";
import { plural } from "../../../../lib/derived/words";
import { LINE_NAMES, resolvePositions } from "../../../../lib/positions";
import type { PlayerDoc, SeasonDoc } from "../../../../lib/schemas";
import { shortDate } from "../../data/adminLogic";
import type { BoardFilter, BoardRow, GapKey } from "../../club/plantillaBoard";
import { fold, POSITIONS, type Position } from "../../club/plantillaLogic";

/** «Portero», «Defensa», «Medio», «Delantero». */
export const LINE_ONE: Record<Position, string> = { POR: LINE_NAMES.POR.short, DEF: LINE_NAMES.DEF.short, MED: LINE_NAMES.MED.short, DEL: LINE_NAMES.DEL.short };
/** «pasa a la portería / a la defensa / al medio / a la delantera». */
export const LINE_TO: Record<Position, string> = { POR: "a la portería", DEF: "a la defensa", MED: "al medio", DEL: "a la delantera" };

const GAP_WORD: Record<GapKey, [string, string]> = { pos: ["la", "posición"], foto: ["la", "foto"], nac: ["el", "nacimiento"], alt: ["la", "altura"], peso: ["el", "peso"] };
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/** The row's words: «ficha completa», «falta la foto», «faltan foto, altura y peso». */
export function gapWords(gaps: readonly GapKey[]): string {
  if (!gaps.length) return "ficha completa";
  if (gaps.length === 1) return `falta ${GAP_WORD[gaps[0]].join(" ")}`;
  return `faltan ${andList(gaps.map((g) => GAP_WORD[g][1]))}`;
}
/** The ficha's: «Ficha completa», «Le falta la foto», «Le faltan foto, altura y peso». */
export const gapLine = (gaps: readonly GapKey[]) => (gaps.length ? `Le ${gapWords(gaps)}` : "Ficha completa");

/** «Defensa · LD» / «Sin posición». */
export function lineWords(r: Pick<BoardRow, "position" | "pref">): string {
  return r.position ? `${LINE_ONE[r.position]}${r.pref ? ` · ${r.pref}` : ""}` : "Sin posición";
}
/** «@erik9», «Pide su ficha», «@pablo · fuera», «Sin cuenta». */
export function accountWords(r: Pick<BoardRow, "account" | "who">): string {
  if (r.account === "vinculada") return r.who ? `@${r.who}` : "Cuenta vinculada";
  if (r.account === "pide") return "Pide su ficha";
  if (r.account === "fuera") return r.who ? `@${r.who} · fuera` : "Su socio está fuera";
  return "Sin cuenta";
}

/** The chips of «Qué falta», in the board's order: what each one says. */
export const CHIP_ORDER: Exclude<BoardFilter, "todos">[] = ["propuestas", "pos", "foto", "datos", "lesion", "sanc", "cuenta", "pide", "dup"];

/** A birthday coming: in how many days, the age he turns and when («hoy», «mañana», «el vie 6 nov»). */
export interface Birthday {
  id: string;
  name: string;
  days: number;
  age: number;
  when: string;
}
const DAY = 86_400_000;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** His next birthday from `now` (Madrid days), or null without a birth date. */
export function birthdayOf(birth: string | undefined, now: number): Omit<Birthday, "id" | "name"> | null {
  if (!isDay(birth)) return null;
  const [y, m, d] = birth.split("-").map(Number);
  const [ty, tm, td] = madridDate(now).split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td, 12);
  let next = Date.UTC(ty, m - 1, d, 12);
  if (next < today) next = Date.UTC(ty + 1, m - 1, d, 12);
  const days = Math.round((next - today) / DAY);
  const age = new Date(next).getUTCFullYear() - y;
  return { days, age, when: days === 0 ? "hoy" : days === 1 ? "mañana" : `el ${shortDate(next)}` };
}
/** The squad's birthdays within `within` days (soonest first, `max` at most). */
export function birthdays(rows: readonly BoardRow[], now: number, within = 45, max = 4): Birthday[] {
  return rows
    .map((r) => {
      const b = birthdayOf(r.doc.birthDate, now);
      return b && b.days <= within ? { id: r.id, name: r.name, ...b } : null;
    })
    .filter((b): b is Birthday => b !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, max);
}
/** «cumple 22 hoy», «cumple 24 el lun 30 nov». */
export const birthdayWords = (b: Pick<Birthday, "age" | "when">) => `cumple ${b.age} ${b.when}`;

/** His numbers in the season's published actas: matches with minutes, minutes, goals, assists, cards. */
export interface SeasonNums {
  games: number;
  minutes: number | null;
  goals: number;
  assists: number;
  cards: number;
}
export function seasonNums(id: string, published: readonly ClubMatch[], seasonId: string | undefined, stats?: { played: number; goals: number; assists: number; minutes: number | null }): SeasonNums {
  const acts = published.filter((m) => m.status === "finished" && (!seasonId || m.seasonId === seasonId));
  let cards = 0;
  for (const m of acts) for (const e of m.events ?? []) if (e.playerId === id) cards += e.type === "double_yellow" ? 2 : e.type === "yellow_card" || e.type === "red_card" ? 1 : 0;
  return { games: stats?.played ?? 0, minutes: stats?.minutes ?? null, goals: stats?.goals ?? 0, assists: stats?.assists ?? 0, cards };
}

/** A ficha nobody cites (no match or draft names him, no account inside): «Borrar la ficha» can be offered. */
export function nobodyCites(p: Pick<PlayerDoc, "id">, matches: readonly ClubMatch[], account: BoardRow["account"]): boolean {
  if (account === "vinculada" || account === "fuera") return false;
  const id = p.id;
  return !matches.some(
    (m) =>
      (m.starters ?? []).includes(id) ||
      (m.bench ?? []).includes(id) ||
      (m.notCalled ?? []).includes(id) ||
      (m.events ?? []).some((e) => e.playerId === id || e.assistPlayerId === id || e.inPlayerId === id),
  );
}

/** The seasons a ficha can be switched on (the visible ones; an archived one is changed from Club › Temporadas). */
export const liveSeasons = (seasons: readonly SeasonDoc[]) => seasons.filter((s) => !s.archived);

/** The guests of the convocatorias (M-41): one per name (accents and case ignored), with the matches he played. */
export interface GuestRow {
  key: string;
  name: string;
  matches: { matchId: string; guestId: string; j: string }[];
}
export function guestRows(matches: readonly (ClubMatch & { jornada?: number | null })[]): GuestRow[] {
  const by = new Map<string, GuestRow>();
  const sorted = [...matches].sort((a, b) => dateMillis(a.date) - dateMillis(b.date));
  for (const m of sorted)
    for (const g of m.guests ?? []) {
      const name = (g.name ?? "").trim();
      if (!name || !g.id) continue;
      const key = fold(name).replace(/\s+/g, " ");
      const row = by.get(key) ?? { key, name, matches: [] };
      if (!row.matches.some((x) => x.matchId === m.id)) row.matches.push({ matchId: m.id, guestId: g.id, j: m.jornada ? `J${m.jornada}` : m.rival || "un partido" });
      by.set(key, row);
    }
  return [...by.values()];
}
/** «Vino de invitado 2 veces · J1, J3». */
export const guestLine = (g: GuestRow) => `Vino de invitado ${plural(g.matches.length, "vez", "veces")} · ${g.matches.map((x) => x.j).join(", ")}`;
/** A guest's name as a shirt name: capitals, 12 letters at most. */
export const shirtFromName = (name: string) => name.trim().toLocaleUpperCase("es").slice(0, 12);

/** The line on the map's preferred spot for a row (his exact preferida, or the line's first spot). */
export const linesInOrder: readonly ("" | Position)[] = ["", ...POSITIONS];
/** The row's position line («DEF»…, "" = none) as resolve does it. */
export const lineOfDoc = (p: PlayerDoc) => resolvePositions(p).line ?? "";
