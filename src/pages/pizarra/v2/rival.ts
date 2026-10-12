// El rival en la pizarra: a board's optional rival seven (a system, mirrored onto their half), a dorsal
// and a note per rival player («presionar al 9 por su izquierda»), its red tokens on the pitch, and the
// boards list filtered by the rival of their linked match. Pure; stored as the board's `rival` field
// (lineupDoc.ts reads it tolerantly, firestore.rules caps its size).
import { z } from "zod";
import { FORMATIONS, type FormationName } from "../formations";
import type { BoardPoint } from "../../../lib/schemas";
import { LINEUP_FORMATIONS } from "../../../lib/schemas";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const RIVAL_LIMITS = { players: 7, note: 80, num: 99 } as const;

export interface RivalPlayer {
  /** Their dorsal, when known. */
  num?: number;
  /** What to do about him («presionar al 9 por su izquierda»). */
  note?: string;
}
export interface RivalSeven {
  formation: FormationName;
  /** One per spot of their system (index 0 = their keeper), always seven. */
  players: RivalPlayer[];
}

const playerSchema = z.object({
  num: z.number().int().min(0).max(RIVAL_LIMITS.num).optional(),
  note: z.string().max(RIVAL_LIMITS.note * 2).optional(),
});
/** Lenient: a bad player is read as a blank one; only a missing system or a non-list drops it all. */
export const rivalSchema = z.object({
  formation: z.enum(LINEUP_FORMATIONS),
  players: z.array(z.unknown()).max(RIVAL_LIMITS.players * 2),
});

const cleanNote = (v: string): string | undefined => {
  const t = v.replace(/\s+/g, " ").trim().slice(0, RIVAL_LIMITS.note);
  return t || undefined;
};
const blank = (): RivalPlayer[] => Array.from({ length: RIVAL_LIMITS.players }, () => ({}));

/** A rival seven with nothing known yet about its players. */
export const newRival = (formation: FormationName = "2-3-1"): RivalSeven => ({ formation, players: blank() });

/**
 * The stored `rival` of a board: undefined when the board never had one, null when it was taken off,
 * else the rival seven (repaired: seven players, bad dorsales and notes dropped and reported).
 */
export function parseRival(raw: unknown, docId = "-"): RivalSeven | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const r = rivalSchema.safeParse(raw);
  if (!r.success) {
    reportDroppedDoc("lineups.rival", docId, r.error.issues);
    return null;
  }
  const players = blank().map((_, i) => {
    const one = playerSchema.safeParse(r.data.players[i] ?? {});
    if (!one.success) {
      reportDroppedDoc("lineups.rival", docId + "#" + i, one.error.issues);
      return {};
    }
    const p: RivalPlayer = {};
    if (one.data.num !== undefined) p.num = one.data.num;
    const note = one.data.note !== undefined ? cleanNote(one.data.note) : undefined;
    if (note) p.note = note;
    return p;
  });
  return { formation: r.data.formation, players };
}

/** Firestore payload (nothing undefined); null = taken off the board. */
export function rivalToData(r: RivalSeven | null): Record<string, unknown> | null {
  if (!r) return null;
  return {
    formation: r.formation,
    players: r.players.slice(0, RIVAL_LIMITS.players).map((p) => ({ ...(p.num !== undefined ? { num: p.num } : {}), ...(p.note ? { note: p.note } : {}) })),
  };
}

export const copyRival = (r: RivalSeven): RivalSeven => ({ formation: r.formation, players: r.players.map((p) => ({ ...p })) });

/** Their system, mirrored onto their half (they attack down: our y 0 is their goal line). */
export function rivalSpots(r: RivalSeven): BoardPoint[] {
  return FORMATIONS[r.formation].map((d) => ({ x: 100 - d.x, y: 100 - d.y }));
}

/** Their seven in another system (the dorsales and notes stay with each spot). */
export const setRivalSystem = (r: RivalSeven, f: FormationName): RivalSeven => (r.formation === f ? r : { ...copyRival(r), formation: f });

/** The note of rival `i` (an empty one clears it). */
export function setRivalNote(r: RivalSeven, i: number, note: string): RivalSeven {
  if (i < 0 || i >= r.players.length) return r;
  const n = cleanNote(note);
  if ((r.players[i].note ?? undefined) === n) return r;
  const next = copyRival(r);
  if (n) next.players[i].note = n;
  else delete next.players[i].note;
  return next;
}

/** The dorsal of rival `i` («» or out of range clears it). */
export function setRivalNum(r: RivalSeven, i: number, raw: string): RivalSeven {
  if (i < 0 || i >= r.players.length) return r;
  const t = raw.trim();
  const n = /^\d{1,2}$/.test(t) ? Number(t) : undefined;
  if (r.players[i].num === n) return r;
  const next = copyRival(r);
  if (n === undefined) delete next.players[i].num;
  else next.players[i].num = n;
  return next;
}

/** «POR», «DC»… of their spot i. */
export const rivalPos = (r: RivalSeven, i: number): string => FORMATIONS[r.formation][i]?.position ?? "";

/** «El 9 (DC)» / «Su DC». */
export const rivalName = (r: RivalSeven, i: number): string => {
  const p = r.players[i];
  const pos = rivalPos(r, i);
  return p?.num !== undefined ? "El " + p.num + " (" + pos + ")" : "Su " + pos;
};

/** What a screen reader hears for a rival token: who, and the note. */
export const rivalAria = (r: RivalSeven, i: number): string => {
  const note = r.players[i]?.note;
  return "Rival: " + rivalName(r, i).toLowerCase() + (note ? ". " + note : "");
};

/** How many rival players carry a note. */
export const rivalNotes = (r: RivalSeven | null | undefined): number => (r ? r.players.filter((p) => !!p.note).length : 0);

// ── the boards list, by rival ──

/** The rivals of the boards' linked matches, once each, in the list's order. */
export function rivalOptions(rows: { rival?: string }[]): string[] {
  const out: string[] = [];
  rows.forEach((r) => {
    const v = r.rival?.trim();
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  });
  return out;
}

/** The boards against `rival` (null = all of them). */
export function filterByRival<T extends { rival?: string }>(rows: T[], rival: string | null): T[] {
  if (!rival) return rows;
  const k = rival.trim().toLowerCase();
  return rows.filter((r) => (r.rival ?? "").trim().toLowerCase() === k);
}
