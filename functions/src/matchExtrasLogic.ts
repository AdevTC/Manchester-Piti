// r12 (la Sala de control y la mesa): the pure rules of the server's new pieces — the video marks of each goal,
// when the acta was published, the MVP window moved by hand, the crónica corta, a guest added from the
// touchline, the match's duration, which ficha can be deleted, what deleting a season does to its players, and
// a guest promoted to a ficha. The callables live in matchExtras.ts, seasons.ts, players.ts and promoteGuest.ts;
// apart so the app's tests can run them.
import { z } from "zod";
import { GUEST_NAME_MAX, GUEST_PREFIX, MAX_GUESTS, type MatchGuest } from "./guests.js";

export const HOUR = 3_600_000;
export const MVP_WINDOW_MS = 48 * HOUR;
/** «Reabrir 24 h». */
export const MVP_REOPEN_MS = 24 * HOUR;
/** The match's ratings close 7 days after the publication (firestore.rules ratingOpen): no reopening after. */
export const RATING_WINDOW_MS = 7 * 24 * HOUR;

// ── M-43 · las marcas del vídeo ──
export const VIDEO_MARKS_MAX = 60;
/** 5 h of video. */
export const VIDEO_MARK_MAX_S = 18_000;
const eventId = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/);
export const videoMarksSchema = z
  .record(eventId, z.number().int().min(0).max(VIDEO_MARK_MAX_S))
  .refine((m) => Object.keys(m).length <= VIDEO_MARKS_MAX, `Como mucho ${VIDEO_MARKS_MAX} marcas del vídeo.`);
const GOALS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal", "opponent_goal", "own_goal"]);
/** The marks that still point at a goal of the acta (a deleted goal takes its mark with it). */
export function pruneVideoMarks(marks: Readonly<Record<string, number>> | null | undefined, events: readonly { id?: string; type?: string }[] | null | undefined): Record<string, number> {
  const goals = new Set((events ?? []).filter((e) => typeof e.id === "string" && GOALS.has(e.type ?? "")).map((e) => e.id as string));
  return Object.fromEntries(Object.entries(marks ?? {}).filter(([id, s]) => goals.has(id) && Number.isInteger(s) && s >= 0 && s <= VIDEO_MARK_MAX_S));
}
/** The stored marks read defensively (anything malformed: none). */
export function storedVideoMarks(v: unknown): Record<string, number> | undefined {
  const r = videoMarksSchema.safeParse(v);
  return r.success ? r.data : undefined;
}

// ── el acta publicada ──
const ms = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** When the acta was first published: its stamp, else (older actas) its MVP window's start, else `now` (a
 *  first publication). */
export function actaPublishedAt(old: { actaPublishedAt?: unknown; voteClosesAt?: unknown } | null | undefined, now: number): number {
  return ms(old?.actaPublishedAt) ?? (ms(old?.voteClosesAt) != null ? (ms(old?.voteClosesAt) as number) - MVP_WINDOW_MS : now);
}

/**
 * The draft of a published match after a callable changes the published one (B-ACTA-01): a draft that was based on
 * the published revision (in step) takes the same changes and the new revision, so the acta editor can still save
 * and publish; a draft already behind stays behind (a real conflict: «Descartar el borrador»).
 */
export function draftFollows(publishedRevision: unknown, draftRevision: unknown): boolean {
  const p = typeof publishedRevision === "number" ? publishedRevision : 0;
  const d = typeof draftRevision === "number" ? draftRevision : 0;
  return p === d;
}
/** The revision saveMatchSheet compares an acta with (B-PAR-01): the published match's, or — a match that is
 *  only a draft — the draft's (archiving and restoring it moved it). */
export function baseRevision(published: { exists: boolean; revision?: unknown }, draft: { exists: boolean; revision?: unknown }): number {
  const r = published.exists ? published.revision : draft.exists ? draft.revision : 0;
  return typeof r === "number" ? r : 0;
}

// ── M-11 · el MVP a mano ──
export type MvpAction = "close" | "reopen";
/** The new `voteClosesAt` (or why not). */
export function mvpWindow(action: MvpAction, m: { status?: unknown; voteClosesAt?: unknown; actaPublishedAt?: unknown }, now: number): { voteClosesAt: number } | { problem: string } {
  const closes = ms(m.voteClosesAt);
  if (m.status !== "finished" || closes == null) return { problem: "El acta aún no está publicada: el MVP se abre al publicarla." };
  if (action === "close") {
    if (closes <= now) return { problem: "La votación ya está cerrada." };
    return { voteClosesAt: now };
  }
  if (now >= actaPublishedAt(m, now) + RATING_WINDOW_MS) return { problem: "Ya no se puede reabrir: pasaron los 7 días del partido." };
  return { voteClosesAt: now + MVP_REOPEN_MS };
}

// ── M-38 · la crónica corta ──
export const SCORER_REPORT_MAX = 220;
export const REPORT_MAX = 10_000;
/** Why this member can't write the crónica corta (null = he can). */
export function reportProblem(o: { isAdmin: boolean; report: string; current: unknown; currentBy: unknown; uid: string }): string | null {
  if (!o.isAdmin && o.report.length > SCORER_REPORT_MAX) return `La crónica corta cabe en ${SCORER_REPORT_MAX} letras.`;
  if (o.report.length > REPORT_MAX) return "La crónica es demasiado larga.";
  const had = typeof o.current === "string" && o.current.trim().length > 0;
  if (!o.isAdmin && had && o.currentBy !== o.uid) return "La crónica ya la ha escrito un capitán: pídele que la cambie desde la sala.";
  return null;
}

// ── M-48 · un invitado desde la mesa, la duración ──
/** Folded for comparing names: no case, accents or extra spaces. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
export interface GuestPlan {
  guest: MatchGuest;
  created: boolean;
  guests: MatchGuest[];
  bench: string[];
  present: string[] | null;
}
/** The guest added to a match (or the one already there with that name), and its lists after it. */
export function addGuestPlan(m: { guests?: unknown; starters?: unknown; bench?: unknown; present?: unknown }, rawName: string): GuestPlan | { problem: string } {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name || name.length > GUEST_NAME_MAX) return { problem: `El nombre del invitado debe tener entre 1 y ${GUEST_NAME_MAX} caracteres.` };
  const guests = (Array.isArray(m.guests) ? m.guests : []).filter((g): g is MatchGuest => !!g && typeof g.id === "string" && typeof g.name === "string");
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const starters = ids(m.starters), bench = ids(m.bench);
  const present = Array.isArray(m.present) ? ids(m.present) : null;
  const same = guests.find((g) => fold(g.name) === fold(name));
  const place = (g: MatchGuest, created: boolean): GuestPlan => {
    const ref = GUEST_PREFIX + g.id;
    const listed = starters.includes(ref) || bench.includes(ref);
    return { guest: g, created, guests: created ? [...guests, g] : guests, bench: listed ? bench : [...bench, ref], present: present && !present.includes(ref) ? [...present, ref] : present };
  };
  if (same) return place(same, false);
  if (guests.length >= MAX_GUESTS) return { problem: `Como mucho ${MAX_GUESTS} invitados por partido.` };
  const free = ["g1", "g2", "g3", "g4"].find((id) => !guests.some((g) => g.id === id))!;
  return place({ id: free, name }, true);
}
export const DURATION_MIN = 10;
export const DURATION_MAX = 150;
/** A match still being prepared or played (its whistle not blown, not published): la mesa may change it. */
export function stillOpen(m: { status?: unknown; clock?: { phase?: unknown } | null; liveEndedAt?: unknown }): boolean {
  return m.status === "scheduled" && m.clock?.phase !== "ended" && typeof m.liveEndedAt !== "number";
}

// ── B-CLUB-05 · borrar una ficha ──
export interface MatchRefs {
  id: string;
  label: string;
  starters?: unknown;
  bench?: unknown;
  notCalled?: unknown;
  events?: unknown;
  ledger?: unknown;
}
/** The first match that cites this ficha (its label), or null: only a ficha nobody cites can be deleted. */
export function citedIn(playerId: string, matches: readonly MatchRefs[]): string | null {
  for (const m of matches) {
    const lists = [m.starters, m.bench, m.notCalled].flatMap((l) => (Array.isArray(l) ? l : []));
    if (lists.includes(playerId)) return m.label;
    const events = Array.isArray(m.events) ? (m.events as Record<string, unknown>[]) : [];
    if (events.some((e) => e && [e.playerId, e.assistPlayerId, e.inPlayerId, e.receiverId].includes(playerId))) return m.label;
    if (m.ledger && typeof m.ledger === "object" && playerId in (m.ledger as object)) return m.label;
  }
  return null;
}

// ── B-CLUB-01 · eliminar una temporada ──
/** A player's seasons and archive flag once `seasonId` is gone: archived only while every season he still has
 *  is archived (none left: not archived, he shows among «Antiguos» as a baja). */
export function afterSeasonDeleted(seasons: readonly string[], seasonId: string, archivedIds: ReadonlySet<string>): { seasons: string[]; archived: boolean } {
  const left = seasons.filter((s) => s !== seasonId);
  return { seasons: left, archived: left.length > 0 && left.every((s) => archivedIds.has(s)) };
}

// ── M-41 · un invitado pasa a su ficha ──
/** Every `guest:<id>` reference to this guest in a value (strings, lists, maps), as `playerId`. */
export function replaceRef<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") return (value === from ? to : value) as T;
  if (Array.isArray(value)) return value.map((v) => replaceRef(v, from, to)) as T;
  if (value && typeof value === "object" && !(value as { toMillis?: unknown }).toMillis) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k === from ? to : k] = replaceRef(v, from, to);
    return out as T;
  }
  return value;
}
/** The match's fields with the guest made a member: every reference, and the guest off the list. */
export function promoteInMatch(m: Record<string, unknown>, guestId: string, playerId: string): Record<string, unknown> | { problem: string } {
  const guests = Array.isArray(m.guests) ? (m.guests as MatchGuest[]) : [];
  if (!guests.some((g) => g.id === guestId)) return { problem: "Ese invitado ya no está en el partido." };
  const from = GUEST_PREFIX + guestId;
  const out: Record<string, unknown> = {};
  for (const key of ["starters", "bench", "notCalled", "events", "analysis", "lineup", "present", "videoMarks"]) if (key in m) out[key] = replaceRef(m[key], from, playerId);
  out.guests = guests.filter((g) => g.id !== guestId);
  // (the member can't be listed twice: a ficha already in the lineup keeps its first place)
  for (const key of ["starters", "bench", "notCalled", "present"]) if (Array.isArray(out[key])) out[key] = [...new Set(out[key] as string[])];
  return out;
}
