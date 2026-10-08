// The acta's sheet model (pure, tested in sheetModel.test.ts) — what the old MatchEditor kept in its
// state, made explicit: a MatchSheet (functions/src/matchEngine) whose score is ALWAYS the count of the
// goals written down, exactly as the backend requires to publish (goalsFor = our goal events + rival own
// goals, goalsAgainst = rival goals + own goals). While editing, a goal can still lack its scorer (the
// «¿Quién marcó?» row) or its minute: those live in `events` as incomplete entries, and:
//   · reviewSheet() hides the ones the review must count as «missing» instead of as ledger errors;
//   · toPayload() serialises for saveMatchSheet: incomplete goals without minute leave the events (the
//     stored score keeps counting them, fromMatch() puts them back as open rows), anything else that the
//     backend would reject is reported as an error before calling it.
import { dateMillis, EVENT_LABELS, type EventType, type MatchEvent, type MatchSheet } from "../../../../functions/src/matchEngine";
import { opponentInitials } from "../../../lib/clubAnalytics";

export type { MatchEvent, MatchSheet };

/** Goals that count for the Piti (the rival's own goals included). */
export const OUR_GOAL_TYPES: readonly EventType[] = ["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"];
/** Goals that count for the rival (our own goals included). */
export const RIVAL_GOAL_TYPES: readonly EventType[] = ["opponent_goal", "own_goal"];
/** Our goals with a scorer of ours (and an optional assist). */
export const SCORER_TYPES: readonly EventType[] = ["goal", "goal_penalty", "goal_freekick"];
const OURS = new Set<string>(OUR_GOAL_TYPES);
const THEIRS = new Set<string>(RIVAL_GOAL_TYPES);
const SCORERS = new Set<string>(SCORER_TYPES);

export const isOurGoal = (e: Pick<MatchEvent, "type">) => OURS.has(e.type);
export const isRivalGoal = (e: Pick<MatchEvent, "type">) => THEIRS.has(e.type);
export const isScorerGoal = (e: Pick<MatchEvent, "type">) => SCORERS.has(e.type);
/** A minute the backend's schema accepts (the ledger also checks it against the duration). */
export const okMinute = (m: unknown): m is number => typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= 150;
/** An HTTPS link, or nothing (the backend's `url` rule). */
export const okHttps = (v: string | undefined) => !v || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v.trim());

/** Ids of the rows fromMatch() opens for goals the stored score counts but the events don't hold. */
const OPEN = "open-";
let seq = 0;
/** A fresh event id (crypto UUID when available). */
export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  seq += 1;
  return `ev-${Date.now().toString(36)}-${seq}`;
}

/** What a match document (published, draft or both merged) can bring. */
export interface MatchLike extends Partial<Omit<MatchSheet, "date" | "events" | "id">> {
  id?: string;
  date?: unknown;
  events?: MatchEvent[];
}

/** An empty sheet, as the old editor started a new match. */
export function defaultSheet(seasonId = "", over: Partial<MatchSheet> = {}): MatchSheet {
  return {
    version: 2,
    revision: 0,
    seasonId,
    rival: "",
    rivalLogoUrl: "",
    rivalInitials: "",
    competition: "Liga",
    date: NaN,
    duration: 50,
    venue: "",
    home: true,
    status: "scheduled",
    kit: "home",
    starters: [],
    bench: [],
    notCalled: [],
    events: [],
    report: "",
    photoUrl: "",
    gallery: [],
    meetingNote: "",
    ...over,
  };
}

/**
 * The editable sheet of a match (draft fields already merged over the published ones): the old editor's
 * normalisation (status from the result, millis date, ids on every event, empty lineups) plus the open
 * rows for the goals the stored score counts but the events don't name yet. `note` = the private
 * meeting note (matchPrivate) when the document doesn't carry it (a published match without draft).
 */
export function fromMatch(m: MatchLike, note = ""): MatchSheet {
  const status = m.status ?? (typeof m.goalsFor === "number" ? "finished" : "scheduled");
  const events: MatchEvent[] = (m.events ?? []).map((e, i) => clean({ ...e, id: e.id || `legacy-${i}` }));
  const ours = events.filter(isOurGoal).length;
  const theirs = events.filter(isRivalGoal).length;
  const gf = typeof m.goalsFor === "number" ? m.goalsFor : 0;
  const ga = typeof m.goalsAgainst === "number" ? m.goalsAgainst : 0;
  const used = new Set(events.map((e) => e.id));
  const openId = (side: "g" | "r") => {
    let k = 0;
    while (used.has(`${OPEN}${side}${k}`)) k++;
    used.add(`${OPEN}${side}${k}`);
    return `${OPEN}${side}${k}`;
  };
  for (let k = 0; k < gf - ours; k++) events.push({ id: openId("g"), type: "goal" });
  for (let k = 0; k < ga - theirs; k++) events.push({ id: openId("r"), type: "opponent_goal" });
  return defaultSheet(m.seasonId ?? "", {
    revision: m.revision ?? 0,
    rival: m.rival ?? "",
    rivalLogoUrl: m.rivalLogoUrl ?? "",
    rivalInitials: m.rivalInitials ?? "",
    competition: m.competition ?? "Liga",
    date: dateMillis(m.date),
    duration: m.duration ?? 60,
    venue: m.venue ?? "",
    home: m.home ?? true,
    status,
    kit: m.kit ?? "home",
    starters: [...(m.starters ?? [])],
    bench: [...(m.bench ?? [])],
    notCalled: [...(m.notCalled ?? [])],
    events,
    report: m.report ?? "",
    photoUrl: m.photoUrl ?? "",
    gallery: [...(m.gallery ?? [])],
    meetingNote: m.meetingNote ?? note,
  });
}

/** An event without its undefined / empty optional fields. */
function clean(e: MatchEvent): MatchEvent {
  const out: MatchEvent = { id: e.id, type: e.type };
  if (e.minute !== undefined && e.minute !== null) out.minute = e.minute;
  if (e.playerId) out.playerId = e.playerId;
  if (e.assistPlayerId) out.assistPlayerId = e.assistPlayerId;
  if (e.inPlayerId) out.inPlayerId = e.inPlayerId;
  if (e.note) out.note = e.note;
  return out;
}

/** The score, from the goals written down (complete or not). */
export function score(sheet: Pick<MatchSheet, "events">): { gf: number; ga: number } {
  let gf = 0;
  let ga = 0;
  for (const e of sheet.events) {
    if (isOurGoal(e)) gf++;
    else if (isRivalGoal(e)) ga++;
  }
  return { gf, ga };
}

/** A canonical signature (sorted keys, no undefined): equal sheets ⇔ equal signatures. */
export function sig(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(o)
          .sort()
          .filter((k) => o[k] !== undefined)
          .map((k) => [k, norm(o[k])]),
      );
    }
    if (typeof v === "number" && Number.isNaN(v)) return "NaN";
    return v;
  };
  return JSON.stringify(norm(value));
}

// ───────────────────────── goal rows ─────────────────────────
export type GoalKind = "goal" | "goal_penalty" | "goal_freekick" | "og";
export interface GoalRow {
  id: string;
  /** 1-based, in the acta's order. */
  n: number;
  minute: number | undefined;
  kind: GoalKind;
  /** Our scorer (null: still to choose, or a rival own goal). */
  scorer: string | null;
  assist: string | null;
  /** No scorer yet: «¿Quién marcó?». */
  open: boolean;
}
/** «Goles del Piti»: one row per goal of ours, in the order they were written down. */
export function goalRows(sheet: Pick<MatchSheet, "events">): GoalRow[] {
  return sheet.events.filter(isOurGoal).map((e, i) => {
    const og = e.type === "opponent_own_goal";
    return {
      id: e.id,
      n: i + 1,
      minute: e.minute,
      kind: og ? "og" : (e.type as GoalKind),
      scorer: og ? null : (e.playerId ?? null),
      assist: og ? null : (e.assistPlayerId ?? null),
      open: !og && !e.playerId,
    };
  });
}
export interface RivalRow {
  id: string;
  n: number;
  minute: number | undefined;
  /** own_goal: one of ours put it in our net (it has a player). */
  own: boolean;
  playerId: string | null;
}
/** «Goles de RIVAL»: rival goals and our own goals, in the order written down. */
export function rivalRows(sheet: Pick<MatchSheet, "events">): RivalRow[] {
  return sheet.events.filter(isRivalGoal).map((e, i) => ({ id: e.id, n: i + 1, minute: e.minute, own: e.type === "own_goal", playerId: e.playerId ?? null }));
}
/** Every other event (cards, changes, penalties, woodwork…), by minute. */
export function otherEvents(sheet: Pick<MatchSheet, "events">): MatchEvent[] {
  return sheet.events
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => !isOurGoal(e) && !isRivalGoal(e))
    .sort((a, b) => (a.e.minute ?? 0) - (b.e.minute ?? 0) || a.order - b.order)
    .map(({ e }) => e);
}

// ───────────────────────── edits (all pure: a new sheet each time) ─────────────────────────
const withEvents = (sheet: MatchSheet, events: MatchEvent[]): MatchSheet => ({ ...sheet, events });
function patch(sheet: MatchSheet, id: string, f: (e: MatchEvent) => MatchEvent): MatchSheet {
  return withEvents(
    sheet,
    sheet.events.map((e) => (e.id === id ? clean(f(e)) : e)),
  );
}

/** Score + 1: a new open goal of ours (the picker opens on it). */
export function addOurGoal(sheet: MatchSheet, type: "goal" | "goal_penalty" | "goal_freekick" = "goal", id = newId()): { sheet: MatchSheet; id: string } {
  return { sheet: withEvents(sheet, [...sheet.events, { id, type }]), id };
}
/** The last goal of ours (the one «−» removes), or null. */
export function lastOurGoal(sheet: MatchSheet): GoalRow | null {
  const rows = goalRows(sheet);
  return rows[rows.length - 1] ?? null;
}
/** Score + 1 for the rival: a rival goal (its minute is asked on the row). */
export function addRivalGoal(sheet: MatchSheet, id = newId()): { sheet: MatchSheet; id: string } {
  return { sheet: withEvents(sheet, [...sheet.events, { id, type: "opponent_goal" }]), id };
}
export function lastRivalGoal(sheet: MatchSheet): RivalRow | null {
  const rows = rivalRows(sheet);
  return rows[rows.length - 1] ?? null;
}
export function removeEvent(sheet: MatchSheet, id: string): MatchSheet {
  return withEvents(
    sheet,
    sheet.events.filter((e) => e.id !== id),
  );
}
/** Digits typed in a minute box → the event's minute (empty → none). */
export function setMinute(sheet: MatchSheet, id: string, text: string): MatchSheet {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 3);
  return patch(sheet, id, (e) => ({ ...e, minute: digits === "" ? undefined : Number(digits) }));
}
/** Step 1 of «¿Quién marcó?»: a player of ours (the assist is chosen again) or a rival own goal. */
export function setScorer(sheet: MatchSheet, id: string, scorer: string | "og"): MatchSheet {
  return patch(sheet, id, (e) =>
    scorer === "og"
      ? { id: e.id, type: "opponent_own_goal", minute: e.minute, note: e.note }
      : { ...e, type: e.type === "opponent_own_goal" ? "goal" : e.type, playerId: scorer, assistPlayerId: undefined },
  );
}
/** Step 2: the assist (null = «Sin asistencia»). */
export function setAssist(sheet: MatchSheet, id: string, assist: string | null): MatchSheet {
  return patch(sheet, id, (e) => ({ ...e, assistPlayerId: assist && assist !== e.playerId ? assist : undefined }));
}
/** Adds or replaces (by id) an event written in the «Otros eventos» form. */
export function upsertEvent(sheet: MatchSheet, event: MatchEvent): MatchSheet {
  const ev = clean(event);
  return sheet.events.some((e) => e.id === ev.id)
    ? withEvents(
        sheet,
        sheet.events.map((e) => (e.id === ev.id ? ev : e)),
      )
    : withEvents(sheet, [...sheet.events, ev]);
}
/** Changing the season empties the convocatoria and the events (other players, other acta). */
export function changeSeason(sheet: MatchSheet, seasonId: string): MatchSheet {
  return { ...sheet, seasonId, starters: [], bench: [], notCalled: [], events: [] };
}

// ───────────────────────── review & save ─────────────────────────
/**
 * The sheet as the review (reviewActa) must see it: the score from every goal written down, and the
 * events without the open rows (a goal still without scorer counts as «falta el goleador», a rival goal
 * without minute as «apunta cada gol rival» — not as ledger errors).
 */
export function reviewSheet(sheet: MatchSheet): MatchSheet {
  const { gf, ga } = score(sheet);
  return {
    ...sheet,
    goalsFor: gf,
    goalsAgainst: ga,
    events: sheet.events.filter((e) => !(isScorerGoal(e) && !e.playerId) && !(e.type === "opponent_goal" && !okMinute(e.minute))),
  };
}

export type NameOf = (playerId: string | undefined) => string;
export type PayloadResult = { ok: true; sheet: MatchSheet } | { ok: false; error: string; eventId?: string };

/**
 * The sheet for saveMatchSheet: only the fields its schema knows, the score from the goals, and the
 * events it accepts. Fails (with the reason, in Spanish) where the backend would refuse it.
 */
export function toPayload(sheet: MatchSheet, draft: boolean, nameOf: NameOf, rival = sheet.rival.trim() || "el rival"): PayloadResult {
  if (!sheet.seasonId || !sheet.rival.trim() || !Number.isFinite(sheet.date)) return { ok: false, error: "Completa temporada, rival y fecha." };
  if (!sheet.competition.trim()) return { ok: false, error: "Pon la competición (Liga, Copa, Amistoso…)." };
  if (!Number.isInteger(sheet.duration) || sheet.duration < 1 || sheet.duration > 150) return { ok: false, error: "La duración va de 1 a 150 minutos." };
  if (!okHttps(sheet.rivalLogoUrl)) return { ok: false, error: "El escudo del rival tiene que ser un enlace https://." };
  if (!okHttps(sheet.photoUrl)) return { ok: false, error: "La foto del partido tiene que ser un enlace https://." };
  if ((sheet.gallery ?? []).some((u) => !okHttps(u) || !u.trim())) return { ok: false, error: "Hay fotos en la galería que no son https://: quítalas o corrígelas." };
  if ((sheet.gallery ?? []).length > 20) return { ok: false, error: "La galería admite hasta 20 fotos." };
  if (!/^[A-Za-z0-9]{0,3}$/.test((sheet.rivalInitials ?? "").trim())) return { ok: false, error: "Las iniciales son hasta 3 letras o números." };

  const ours = goalRows(sheet);
  const theirs = rivalRows(sheet);
  const events: MatchEvent[] = [];
  for (const e of sheet.events) {
    if (isScorerGoal(e) && !e.playerId) {
      // A goal still without scorer: kept (with its minute) in a draft, counted by the score anyway.
      if (!draft) return { ok: false, error: `Falta el goleador del gol ${ours.find((r) => r.id === e.id)?.n ?? ""}.`.replace(" .", "."), eventId: e.id };
      if (okMinute(e.minute)) events.push(clean(e));
      continue;
    }
    if (e.type === "opponent_goal" && !okMinute(e.minute)) {
      if (!draft) return { ok: false, error: `Pon el minuto del gol ${theirs.find((r) => r.id === e.id)?.n ?? ""} de ${rival}.`, eventId: e.id };
      continue;
    }
    if (!okMinute(e.minute)) {
      const row = ours.find((r) => r.id === e.id);
      const what = row ? `del gol ${row.n}${row.scorer ? ` (${nameOf(row.scorer)})` : row.kind === "og" ? ` (autogol de ${rival})` : ""}` : `de «${EVENT_LABELS[e.type] ?? e.type}${e.playerId ? ` · ${nameOf(e.playerId)}` : ""}»`;
      return { ok: false, error: `Pon el minuto ${what}.`, eventId: e.id };
    }
    events.push(clean(e));
  }
  const { gf, ga } = score(sheet);
  const gallery = (sheet.gallery ?? []).map((u) => u.trim());
  const out: MatchSheet = {
    version: 2,
    revision: sheet.revision ?? 0,
    seasonId: sheet.seasonId,
    rival: sheet.rival.trim(),
    rivalLogoUrl: (sheet.rivalLogoUrl ?? "").trim(),
    rivalInitials: (sheet.rivalInitials ?? "").trim().toUpperCase(),
    competition: sheet.competition.trim(),
    date: sheet.date,
    duration: sheet.duration,
    venue: sheet.venue.trim(),
    home: sheet.home,
    status: sheet.status,
    kit: sheet.kit ?? "home",
    starters: sheet.starters,
    bench: sheet.bench,
    notCalled: sheet.notCalled,
    events,
    goalsFor: gf,
    goalsAgainst: ga,
    report: sheet.report,
    photoUrl: (sheet.photoUrl ?? "").trim(),
    gallery,
    meetingNote: sheet.meetingNote ?? "",
  };
  return { ok: true, sheet: out };
}

/** A stored (local draft) value that looks like a sheet. */
export function isSheet(v: unknown): v is MatchSheet {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const ids = (x: unknown) => Array.isArray(x) && x.every((i) => typeof i === "string");
  return (
    o.version === 2 &&
    typeof o.seasonId === "string" &&
    typeof o.rival === "string" &&
    typeof o.competition === "string" &&
    typeof o.venue === "string" &&
    typeof o.home === "boolean" &&
    typeof o.status === "string" &&
    typeof o.report === "string" &&
    ids(o.starters) &&
    ids(o.bench) &&
    ids(o.notCalled) &&
    Array.isArray(o.events) &&
    o.events.every((e) => !!e && typeof e === "object" && typeof (e as MatchEvent).id === "string" && typeof (e as MatchEvent).type === "string")
  );
}
/** A stored value back to a sheet (JSON turns a missing date into null). */
export const restoreSheet = (s: MatchSheet): MatchSheet => ({ ...s, date: typeof s.date === "number" ? s.date : NaN, duration: typeof s.duration === "number" ? s.duration : NaN });

/** Initials for a rival: the ones written, else the automatic ones. */
export const rivalInitialsOf = (sheet: Pick<MatchSheet, "rival" | "rivalInitials">) => (sheet.rivalInitials ?? "").trim().toUpperCase() || opponentInitials(sheet.rival || "Rival");
