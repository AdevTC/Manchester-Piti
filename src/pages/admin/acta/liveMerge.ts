// The acta being edited while the match goes on (M4): the touchline (liveEvent) keeps appending jugadas
// with unique `live-*` ids and bumping the match's revision, so an editor with unsaved changes would
// stop seeing them and only learn of it when saveMatchSheet refuses the old revision. Pure (tested in
// liveMerge.test.ts): how many jugadas are new for this editor, and the edits with the server's
// version taken in, by event id.
import { sig, type MatchEvent, type MatchSheet } from "./sheetModel";

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

/**
 * The edits (`local`, started from `base`) with the server's version taken in, so saving them neither
 * loses what the touchline wrote nor fails the revision check:
 * - every field the editor hasn't touched takes the server's value; the ones it changed keep its own;
 * - events, by id: one the editor hasn't touched follows the server (and goes if the server undid it),
 *   one it changed keeps its edit, one it removed stays removed, and the server's new ones are appended;
 * - the revision is the server's (saveMatchSheet compares it with the stored one).
 */
export function mergeLive(local: MatchSheet, base: MatchSheet, server: MatchSheet, removed: ReadonlySet<string>): MatchSheet {
  const out: Record<string, unknown> = {};
  const l = local as unknown as Record<string, unknown>;
  const b = base as unknown as Record<string, unknown>;
  const s = server as unknown as Record<string, unknown>;
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
  return { ...(out as unknown as MatchSheet), events, revision: server.revision ?? 0 };
}
