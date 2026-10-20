// The acta being edited while the match goes on (M4): the touchline (liveEvent) keeps appending jugadas
// with unique `live-*` ids and bumping the match's revision, so an editor with unsaved changes would
// stop seeing them and only learn of it when saveMatchSheet refuses the old revision. Pure (tested in
// liveMerge.test.ts): how many jugadas are new for this editor, and the edits with the server's
// version taken in, by event id.
import { sig, type MatchEvent, type MatchSheet } from "./sheetModel";
import { synchronizeCanonicalAnalysis } from "../../../../functions/src/narrated/editing";

const ids = (events: readonly MatchEvent[]) => new Set(events.map((e) => e.id));

/**
 * The events the editor has removed so far: `prev` plus those in `before` that `after` lacks (an id that
 * comes back, e.g. «Descartar», leaves the set). The merge never brings them back.
 */
export function removedIds(prev: ReadonlySet<string>, before: readonly MatchEvent[], after: readonly MatchEvent[]): ReadonlySet<string> {
  const now = ids(after);
  const out = new Set([...prev].filter((id) => !now.has(id)));
  for (const e of before) if (!now.has(e.id)) out.add(e.id);
  return out.size === prev.size && [...out].every((id) => prev.has(id)) ? prev : out;
}

/** Live jugadas on the server this editor hasn't got: not in its edits, not in the version it started
 *  from, not removed here. */
export function newLiveEvents(local: MatchSheet, base: MatchSheet, server: MatchSheet, removed: ReadonlySet<string>): MatchEvent[] {
  const mine = ids(local.events);
  const known = ids(base.events);
  return server.events.filter((e) => e.id.startsWith("live-") && !mine.has(e.id) && !known.has(e.id) && !removed.has(e.id));
}

/** Additions, corrections and removals not yet incorporated by this dirty editor. */
export function pendingLiveChanges(local: MatchSheet, base: MatchSheet, server: MatchSheet, removed: ReadonlySet<string>): number {
  const mine = new Map(local.events.map(e => [e.id, e]));
  const known = new Map(base.events.map(e => [e.id, e]));
  const theirs = new Map(server.events.map(e => [e.id, e]));
  let count = 0;
  for (const id of new Set([...known.keys(), ...theirs.keys()])) {
    const before = known.get(id), after = theirs.get(id), edited = mine.get(id);
    if (sig(before) === sig(after) || sig(edited) === sig(after)) continue;
    if (!before && removed.has(id)) continue;
    count++;
  }
  return count;
}

const fields = (v: MatchSheet) => v as unknown as Record<string, unknown>;

/**
 * Whether the editor and the server changed the same thing since `base` (a lost update if the edits were
 * saved over it): a field both changed to different values, an event the editor changed that the server
 * changed or removed (e.g. a jugada the touchline undid), or an event the editor removed that the server
 * changed. New jugadas and the server's changes to what the editor didn't touch are not conflicts.
 */
export function liveConflicts(local: MatchSheet, base: MatchSheet, server: MatchSheet): boolean {
  const l = fields(local);
  const b = fields(base);
  const s = fields(server);
  for (const k of new Set([...Object.keys(l), ...Object.keys(b), ...Object.keys(s)])) {
    if (k === "events" || k === "revision") continue;
    const [lk, bk, sk] = [sig(l[k]), sig(b[k]), sig(s[k])];
    if (lk !== bk && sk !== bk && lk !== sk) return true;
  }
  const localById = new Map(local.events.map((e) => [e.id, e]));
  const serverById = new Map(server.events.map((e) => [e.id, e]));
  for (const was of base.events) {
    const mine = localById.get(was.id);
    const theirs = serverById.get(was.id);
    const theyChanged = !theirs || sig(theirs) !== sig(was);
    if (mine && sig(mine) !== sig(was) && theyChanged && sig(mine) !== sig(theirs)) return true; // incompatible edits, or undone there
    if (!mine && theirs && sig(theirs) !== sig(was)) return true; // removed here, changed there
  }
  return false;
}

/**
 * The edits (`local`, started from `base`) with the server's version taken in, so saving them doesn't
 * lose what the touchline wrote:
 * - every field the editor hasn't touched takes the server's value; the ones it changed keep its own;
 * - events, by id: one the editor hasn't touched follows the server (and goes if the server undid it),
 *   one it changed keeps its edit, one it removed stays removed, and the server's new ones are appended;
 * - the revision is the server's — unless the two sides conflict (liveConflicts): then it stays the
 *   edits' own, so saveMatchSheet still refuses the save («Otro administrador ha actualizado este
 *   partido…») instead of silently overwriting the other change.
 */
export function mergeLive(local: MatchSheet, base: MatchSheet, server: MatchSheet, removed: ReadonlySet<string>): MatchSheet {
  const out: Record<string, unknown> = {};
  const l = fields(local);
  const b = fields(base);
  const s = fields(server);
  for (const k of new Set([...Object.keys(l), ...Object.keys(s)])) {
    if (k === "events" || k === "revision") continue;
    const v = sig(l[k]) === sig(b[k]) ? s[k] : l[k];
    if (v !== undefined) out[k] = v;
  }
  const baseById = new Map(base.events.map((e) => [e.id, e]));
  const serverById = new Map(server.events.map((e) => [e.id, e]));
  const events: MatchEvent[] = [];
  for (const e of local.events) {
    const was = baseById.get(e.id);
    const theirs = serverById.get(e.id);
    const untouched = !!was && sig(e) === sig(was);
    if (was && !theirs && untouched) continue; // undone (or dropped) on the server
    events.push(untouched && theirs ? theirs : e);
  }
  const mine = ids(local.events);
  for (const e of server.events) if (!mine.has(e.id) && !baseById.has(e.id) && !removed.has(e.id)) events.push(e);
  const revision = liveConflicts(local, base, server) ? (local.revision ?? 0) : (server.revision ?? 0);
  const merged = { ...(out as unknown as MatchSheet), events, revision };
  if (merged.analysis) merged.analysis = synchronizeCanonicalAnalysis(merged.analysis, merged.analysis === local.analysis ? local.events : server.events, events, merged.durationSeconds ?? merged.duration * 60);
  return merged;
}
