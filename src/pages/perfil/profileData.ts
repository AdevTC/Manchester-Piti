// /profile: the pure parts of useProfileData — which state the ficha is in, the season's squad as the
// pizarra resolves it, how you came in, and the «Tus cosas en el vestuario» lines.
import { isCompleted } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { porraPosition } from "../../lib/vestuario";
import type { SquadPlayer } from "../pizarra/v2/ratings";
import type { FichaState } from "./card";
import type { SquadShirt } from "./rules";

const TZ = "Europe/Madrid";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export interface ClaimLike {
  playerId: string;
  status: "pending" | "approved" | "rejected";
}
export interface FichaInfo {
  state: FichaState;
  /** The ficha the card is about: the linked one, or the one asked for. */
  playerId: string | null;
  /** «El capitán no aprobó el 10»: the last request was turned down (and nothing is linked). */
  rejectedPlayerId: string | null;
}
export function fichaInfo(linkedId: string | undefined | null, claim: ClaimLike | null): FichaInfo {
  if (linkedId) return { state: "vinculada", playerId: linkedId, rejectedPlayerId: null };
  if (claim?.status === "pending") return { state: "pendiente", playerId: claim.playerId, rejectedPlayerId: null };
  return { state: "sin-ficha", playerId: null, rejectedPlayerId: claim?.status === "rejected" ? claim.playerId : null };
}

type Detail = { shirtName?: unknown; number?: unknown };
const detailOf = (p: PlayerDoc, sid: string): Detail | null => {
  const d = p.seasonDetails?.[sid];
  return d && typeof d === "object" ? (d as Detail) : null;
};
/** The shirt name and dorsal of a season, as the pizarra and the plantilla print them. */
export function resolveShirt(p: PlayerDoc, seasonId: string, seasons: { id: string }[]): { shirtName: string; number: number } {
  const sid = seasonId !== "all" && detailOf(p, seasonId) ? seasonId : [...seasons].reverse().find((s) => p.seasons?.includes(s.id) && detailOf(p, s.id))?.id;
  const d = sid ? detailOf(p, sid) : null;
  return {
    shirtName: (typeof d?.shirtName === "string" && d.shirtName) || p.shirtName || "",
    number: typeof d?.number === "number" ? d.number : (p.number ?? 0),
  };
}

/** The season's squad for the cromos (and the card): its players, plus `me` if he isn't in it. */
export function seasonPlayers(players: PlayerDoc[], seasonId: string, seasons: { id: string }[], me: string | null): SquadPlayer[] {
  return players
    .filter((p) => seasonId === "all" || p.seasons?.includes(seasonId) || p.id === me)
    .map((p) => {
      const { shirtName, number } = resolveShirt(p, seasonId, seasons);
      return { id: p.id, shirtName, firstName: p.firstName ?? "", number, naturalPosition: p.naturalPosition, injured: p.injured === true, active: p.active !== false };
    })
    .sort((a, b) => a.number - b.number);
}

/** Every shirt of the club (for «Ya la lleva el 9 (ERIK)»): the name each player wears this season. */
export function squadShirts(players: PlayerDoc[], seasonId: string, seasons: { id: string }[]): SquadShirt[] {
  return players
    .map((p) => {
      const { shirtName, number } = resolveShirt(p, seasonId, seasons);
      return { id: p.id, name: shirtName || [p.firstName, p.lastName].filter(Boolean).join(" "), number: number || null };
    })
    .filter((s) => !!s.name);
}

/** «sep 2026», in club time. */
export function monthYear(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "numeric", year: "numeric" }).formatToParts(ms);
  const m = Number(parts.find((x) => x.type === "month")?.value ?? "1");
  const y = parts.find((x) => x.type === "year")?.value ?? "";
  return `${MONTHS[m - 1]} ${y}`;
}

export interface MembershipLike {
  joinedAt: number;
  via: string;
  by: string;
}
export interface AccessInfo {
  /** Socio desde: the first time this account had a profile or got in. */
  since: number | null;
  sinceText: string;
  /** «Cómo entraste». */
  howIn: string;
  /** «Te abrió». */
  whoOpened: string;
}
/** The back of the card and «Tu acceso». Members from the shared key («returning» or no `via`) came in on their own. */
export function accessInfo(m: MembershipLike | null, createdAt: number | null, uid: string, openerNick: string): AccessInfo {
  const times = [createdAt, m?.joinedAt].filter((t): t is number => typeof t === "number" && t > 0);
  const since = times.length ? Math.min(...times) : null;
  const via = m?.via ?? "";
  const opened = (via === "invite" || via === "request") && !!m?.by && m.by !== uid;
  return {
    since,
    sinceText: since ? monthYear(since) : "—",
    howIn: via === "invite" ? "Por invitación" : via === "request" ? "Llamando a la puerta" : "Con la clave antigua",
    whoOpened: opened ? (openerNick ? `@${openerNick}` : "Un capitán") : "Nadie: de los primeros",
  };
}

export interface BoardLike {
  id: string;
  name: string;
  updatedAt: number | null;
  createdAt: number | null;
}
export interface BoardsLine {
  count: number;
  last: { id: string; name: string; at: number | null; href: string } | null;
}
/** «Tus pizarras»: how many boards you have this season and the last one you touched. */
export function boardsLine(mine: BoardLike[]): BoardsLine {
  const at = (b: BoardLike) => b.updatedAt ?? b.createdAt ?? 0;
  const last = mine.reduce<BoardLike | null>((best, b) => (!best || at(b) > at(best) ? b : best), null);
  return { count: mine.length, last: last ? { id: last.id, name: last.name, at: last.updatedAt ?? last.createdAt, href: `/pizarra?tablero=${encodeURIComponent(last.id)}` } : null };
}

export interface PorraLine {
  /** Predictions on finished matches this season. */
  predictions: number;
  exact: number;
  points: number;
  rank: number;
  of: number;
}
export function porraLine(rows: { uid: string; points: number; exact: number; played: number }[], uid: string): PorraLine | null {
  const pos = porraPosition(rows, uid);
  return pos ? { predictions: pos.row.played, exact: pos.row.exact, points: pos.row.points, rank: pos.position, of: rows.length } : null;
}

export type Answer = "yes" | "no" | "maybe";
/** The matches whose convocatoria counts this season: the played ones and the next one (not cancelled or postponed). */
export function convocatoriaMatches(calendar: ClubMatch[], nextId: string | null): ClubMatch[] {
  return calendar.filter((m) => m.status !== "cancelled" && m.status !== "postponed" && (isCompleted(m) || m.id === nextId));
}
export interface ConvocatoriaLine {
  answered: number;
  total: number;
  yes: number;
  maybe: number;
  no: number;
  /** Your answer for the next match (null = not yet, or there is none). */
  next: Answer | null;
  nextId: string | null;
}
export function convocatoriaLine(answers: Map<string, Answer>, matchIds: string[], nextId: string | null): ConvocatoriaLine {
  const mine = matchIds.map((id) => answers.get(id)).filter((a): a is Answer => !!a);
  return {
    answered: mine.length,
    total: matchIds.length,
    yes: mine.filter((a) => a === "yes").length,
    maybe: mine.filter((a) => a === "maybe").length,
    no: mine.filter((a) => a === "no").length,
    next: nextId ? (answers.get(nextId) ?? null) : null,
    nextId,
  };
}
