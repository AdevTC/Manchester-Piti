// r14 · La pizarra, the server's pure half (pizarraR14.ts runs it): the official seven's version (PZ-D01: the
// reactions start again when the seven changes), the board's history (PZ-D21T: a snapshot when the sistema
// changes, someone comes in or it is published) and the fan view (PZ-D21F: the cartel and the seven, with
// shirt names and dorsales only). No Firebase here, so the web's tests run it too.
import { boardSlotCodes, boardSystem, type BoardLike } from "./boardCodes.js";
import { sevenOf, sieteKey } from "./pushLogic.js";
import { seasonShirtName, type NameSource } from "./names.js";
import { isFormationName, systemDef } from "./formations.js";

/** What these rules read of a stored board (lineups/{id}). */
export interface R14Board extends BoardLike {
  isOfficial?: boolean;
  matchId?: string | null;
  seasonId?: string;
  name?: string;
  ownerUid?: string;
  sevenKey?: string;
  sevenRev?: number;
  fanToken?: string;
  roles?: Record<string, unknown>;
  takers?: Record<string, unknown>;
  tactics?: Record<string, unknown>;
  rival?: unknown;
  plan?: unknown;
}

// ───────────────────────── PZ-D01 · the official seven's version ─────────────────────────

/** The longest `sevenKey` stored as is (firestore.rules caps it at 1000; the rules cap each player id at 128, so
 *  seven of them always fit, but an id written past the rules — by an admin script — must never lock the board). */
export const SEVEN_KEY_MAX = 900;
/** A short, stable fingerprint of a long key (FNV-1a over two lanes): «h:<hex>». */
function hashKey(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return "h:" + a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0") + ":" + s.length;
}
/** The seven as a fingerprint: who plays, order aside (the same key as «Cambio en el siete», seven.ts); a key past
 *  SEVEN_KEY_MAX is hashed so it always fits its rule. */
export const boardSevenKey = (b: Pick<R14Board, "slots"> | undefined): string => {
  const k = sieteKey(sevenOf(b?.slots));
  return k.length > SEVEN_KEY_MAX ? hashKey(k) : k;
};

const rev = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);

/**
 * The stamp an official board needs after a write (null = nothing to write). The version (`sevenRev`)
 * moves when the board becomes official (or official of another match) and when its seven changes, so the
 * reactions given to an older seven stop counting (and the server deletes them). A board official before
 * r14 (no `sevenKey` yet) only gets its key: its reactions keep counting until its seven really changes.
 */
export function sevenStamp(before: R14Board | undefined, after: R14Board | undefined): { sevenKey: string; sevenRev: number; bumped: boolean } | null {
  if (!after?.isOfficial) return null;
  const key = boardSevenKey(after);
  const current = rev(after.sevenRev);
  const wasOfficial = before?.isOfficial === true && (before.matchId ?? null) === (after.matchId ?? null);
  // (the trigger's own stamp re-runs it with `before` already official: that one lands below, as nothing)
  if (!wasOfficial) return { sevenKey: key, sevenRev: current + 1, bumped: true };
  if (after.sevenKey === key) return null;
  const known = typeof after.sevenKey === "string" ? after.sevenKey : typeof before?.sevenKey === "string" ? before.sevenKey : null;
  // (first write after r14 of an official from before: same seven → only its key)
  if (known === null) return boardSevenKey(before) === key ? { sevenKey: key, sevenRev: current, bumped: false } : { sevenKey: key, sevenRev: current + 1, bumped: true };
  return known === key ? { sevenKey: key, sevenRev: current, bumped: false } : { sevenKey: key, sevenRev: current + 1, bumped: true };
}

/** Whether a reaction counts for the board's current seven (a reaction without `rev` is version 0). */
export const reactionCurrent = (reaction: { rev?: unknown } | undefined, board: Pick<R14Board, "sevenRev"> | undefined): boolean =>
  rev(reaction?.rev) === rev(board?.sevenRev);

// ───────────────────────── PZ-D21T · la historia del tablero ─────────────────────────

export type HistoryKind = "nuevo" | "sistema" | "entra" | "publica";

/** The most snapshots a board keeps (the oldest go). */
export const HISTORY_MAX = 20;
/** Two snapshots of the same kind closer than this are one (the newest replaces it): an autosave every few
 *  seconds while someone drags never fills the history. */
export const HISTORY_MERGE_MS = 10 * 60_000;

/** Why this write deserves a snapshot (null = it doesn't): created, published, its sistema changed, or
 *  someone came into the seven (a player that wasn't in it). */
export function historyKind(before: R14Board | undefined, after: R14Board | undefined): HistoryKind | null {
  if (!after) return null;
  if (!before) return "nuevo";
  if (after.isOfficial === true && (before.isOfficial !== true || (before.matchId ?? null) !== (after.matchId ?? null))) return "publica";
  if (boardSystem(before) !== boardSystem(after)) return "sistema";
  const was = new Set(sevenOf(before.slots));
  if (sevenOf(after.slots).some((id) => !was.has(id))) return "entra";
  return null;
}

/** One stored slot of a snapshot. */
export interface HistorySlot {
  playerId: string | null;
  code: string;
  x: number;
  y: number;
}

/** lineups/{id}/history/{hid} */
export interface HistorySnapshot {
  kind: HistoryKind;
  /** «Se publica», «Pasa al 3-2-1», «Entra ERIK»… (the words of the change; names are the client's). */
  label: string;
  /** Who came in (ids), for «Entra X». */
  entra: string[];
  formation: string;
  freeMode: boolean;
  system: string;
  slots: HistorySlot[];
  roles: Record<string, unknown>;
  takers: Record<string, unknown>;
  tactics: Record<string, unknown>;
  /** The board's editor at that moment isn't known to a trigger: the owner, and whether it was official. */
  isOfficial: boolean;
  at: number;
}

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : d);
const plainMap = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});

/** The board as a snapshot (its seven with codes and spots, roles, takers, tactics). */
export function snapshotOf(after: R14Board, kind: HistoryKind, before: R14Board | undefined, at: number): HistorySnapshot {
  const formation = isFormationName(after.formation) ? after.formation : "2-3-1";
  const spots = systemDef(formation).spots;
  const codes = boardSlotCodes(after);
  const free = after.freeMode === true;
  const slots: HistorySlot[] = Array.from({ length: 7 }, (_, i) => {
    const s = after.slots?.[i];
    const [, fx, fy] = spots[i] ?? ["MC", 50, 50];
    const id = typeof s?.playerId === "string" && s.playerId ? s.playerId : null;
    return { playerId: id, code: codes[i], x: free ? num(s?.x, fx) : fx, y: free ? num(s?.y, fy) : fy };
  });
  const was = new Set(sevenOf(before?.slots));
  const entra = kind === "entra" ? sevenOf(after.slots).filter((id) => !was.has(id)) : [];
  const system = boardSystem(after);
  const label = kind === "nuevo" ? "Primer borrador · " + system : kind === "publica" ? "Se publica · " + system : kind === "sistema" ? "Pasa al " + system : "Entra alguien nuevo";
  return {
    kind,
    label,
    entra,
    formation,
    freeMode: free,
    system,
    slots,
    roles: plainMap(after.roles),
    takers: plainMap(after.takers),
    tactics: plainMap(after.tactics),
    isOfficial: after.isOfficial === true,
    at,
  };
}

/** What to do with the history on a snapshot: replace the newest one (same kind, recent, not a publication) or
 *  add, and which old ones to delete to keep HISTORY_MAX. `existing` newest first. */
export function historyPlan(existing: readonly { id: string; kind?: unknown; at?: unknown }[], kind: HistoryKind, now: number): { replace: string | null; drop: string[] } {
  const newest = existing[0];
  const at = typeof newest?.at === "number" ? newest.at : -Infinity;
  const replace = newest && kind !== "publica" && kind !== "nuevo" && newest.kind === kind && now - at < HISTORY_MERGE_MS ? newest.id : null;
  const keep = HISTORY_MAX - (replace ? 0 : 1);
  return { replace, drop: existing.slice(Math.max(0, keep)).map((d) => d.id) };
}

// ───────────────────────── PZ-D21F · la vista de la afición ─────────────────────────

/** A player as the fans see him: the shirt name of that season and the dorsal. Never the full name. */
export interface FanPlayer {
  /** «ADRIÁN T.C.» (the season's shirt name, else his shirt name, else his first name, else «Jugador»). */
  shirt: string;
  /** The dorsal, when known. */
  num: number | null;
  /** «POR», «DFC»… */
  code: string;
  x: number;
  y: number;
  captain: boolean;
  /** A guest of the match. */
  guest: boolean;
}

/** fanBoards/{token} — public, read by anyone with the link. */
export interface FanBoard {
  v: 1;
  /** The board's season (the page asks the season's crest and kit) and match (public anyway). */
  seasonId: string;
  matchId: string | null;
  /** «J3 · Red Demons», «El siete de la temporada». */
  title: string;
  /** The match, as the public match page shows it (null for a season's board). */
  match: { rival: string; date: number | null; venue: string; home: boolean | null; jornada: number | null } | null;
  system: string;
  official: boolean;
  seven: FanPlayer[];
  /** Their system and dorsales, when the board shows the rival (never the notes). */
  rival: { system: string; nums: (number | null)[] } | null;
  /** The plan's keys (short sentences meant for the charla: no names, no notas). */
  claves: string[];
  updatedAt: number;
}

export interface FanPlayerSource extends NameSource {
  number?: unknown;
  seasonDetails?: Record<string, unknown>;
}

/** The dorsal of the season (seasonDetails[seasonId].number), else the ficha's. */
export function fanNumber(p: FanPlayerSource | undefined, seasonId: string): number | null {
  const sd = p?.seasonDetails?.[seasonId];
  const n = sd && typeof sd === "object" ? (sd as Record<string, unknown>).number : undefined;
  const v = typeof n === "number" ? n : typeof p?.number === "number" ? p.number : null;
  return v !== null && Number.isInteger(v) && v >= 0 && v <= 99 ? v : null;
}

/** The name a fan sees: the shirt name (that season's, else his own), else ONLY the first name. */
export function fanShirt(p: FanPlayerSource | undefined, seasonId: string): string {
  const s = seasonShirtName(p, seasonId) || (typeof p?.shirtName === "string" && p.shirtName.trim() ? p.shirtName : "");
  if (s) return s.trim().slice(0, 24);
  const first = typeof p?.firstName === "string" ? p.firstName.trim().split(/\s+/)[0] : "";
  return first ? first.slice(0, 24) : "Jugador";
}

const GUEST = /^guest:/;
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The sanitized snapshot of a board for the fans. `players` by id; `guests` = the match's guests (their first
 *  name only). Rival notes, the plan's notes, notas, reactions, names and owners never go. */
export function fanBoardOf(
  b: R14Board,
  o: {
    players: ReadonlyMap<string, FanPlayerSource>;
    guests?: readonly { id: string; name: string }[];
    match?: { rival?: unknown; date?: unknown; venue?: unknown; home?: unknown } | null;
    jornada?: number | null;
    now: number;
  },
): FanBoard {
  const seasonId = typeof b.seasonId === "string" ? b.seasonId : "all";
  const formation = isFormationName(b.formation) ? b.formation : "2-3-1";
  const spots = systemDef(formation).spots;
  const codes = boardSlotCodes(b);
  const free = b.freeMode === true;
  const captainId = typeof b.roles?.captainId === "string" ? b.roles.captainId : null;
  const seven: FanPlayer[] = [];
  for (let i = 0; i < 7; i++) {
    const s = b.slots?.[i];
    const id = typeof s?.playerId === "string" && s.playerId ? s.playerId : null;
    if (!id) continue;
    const [, fx, fy] = spots[i] ?? ["MC", 50, 50];
    const guest = GUEST.test(id) ? (o.guests ?? []).find((g) => "guest:" + g.id === id || g.id === id) : undefined;
    const p = o.players.get(id);
    seven.push({
      shirt: GUEST.test(id) ? (guest ? str(guest.name, 30).split(/\s+/)[0] || "Invitado" : "Invitado") : fanShirt(p, seasonId),
      num: GUEST.test(id) ? null : fanNumber(p, seasonId),
      code: codes[i],
      x: free ? num(s?.x, fx) : fx,
      y: free ? num(s?.y, fy) : fy,
      captain: captainId === id,
      guest: GUEST.test(id),
    });
  }
  const m = b.matchId ? o.match : null;
  const rv = b.rival && typeof b.rival === "object" ? (b.rival as { formation?: unknown; players?: unknown; visible?: unknown }) : null;
  const rival =
    rv && rv.visible !== false && isFormationName(rv.formation)
      ? { system: rv.formation, nums: (Array.isArray(rv.players) ? rv.players : []).slice(0, 7).map((p) => (p && typeof p === "object" && typeof (p as { num?: unknown }).num === "number" ? ((p as { num: number }).num) : null)) }
      : null;
  const plan = b.plan && typeof b.plan === "object" ? (b.plan as { claves?: unknown }) : null;
  const claves = Array.isArray(plan?.claves) ? plan.claves.filter((c): c is string => typeof c === "string" && !!c.trim()).slice(0, 3).map((c) => c.trim().slice(0, 60)) : [];
  const rivalName = m ? str(m.rival, 60) : "";
  const title = m ? [o.jornada ? "J" + o.jornada : "", rivalName].filter(Boolean).join(" · ") || "El siete del partido" : "El siete de la temporada";
  const date = m && typeof m.date === "number" ? m.date : m && m.date && typeof (m.date as { toMillis?: unknown }).toMillis === "function" ? (m.date as { toMillis(): number }).toMillis() : null;
  return {
    v: 1,
    seasonId,
    matchId: b.matchId ?? null,
    title,
    match: m ? { rival: rivalName, date, venue: str(m.venue, 80), home: typeof m.home === "boolean" ? m.home : null, jornada: o.jornada ?? null } : null,
    system: boardSystem(b),
    official: b.isOfficial === true,
    seven,
    rival,
    claves,
    updatedAt: o.now,
  };
}

/** An unguessable token for a fan link (24 url-safe characters from `random` bytes). */
export function fanTokenOf(bytes: Uint8Array): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < 24; i++) out += abc[(bytes[i] ?? 0) & 63];
  return out;
}

// ───────────────────────── PZ-D04 · Adivina el siete ─────────────────────────

/** How many of the official seven a guess got (players, order aside) and how many in their exact slot. */
export function guessHits(guess: readonly string[], official: readonly (string | null)[]): { hits: number; exact: number } {
  const off = new Set(official.filter((x): x is string => !!x));
  const seen = new Set<string>();
  let hits = 0;
  let exact = 0;
  guess.forEach((id, i) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    if (off.has(id)) hits++;
    if (official[i] === id) exact++;
  });
  return { hits, exact };
}
