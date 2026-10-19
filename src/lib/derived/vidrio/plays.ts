// «Vidrio» · jugada a jugada: every play of a match that stands (la mesa's types, no pending duplicate), told
// as the rest of the site tells it (eventMeta: eventSentence, eventMetaOf, goalOrdinal) in the boards' two lines
// (boardPlay: «Gol de Adrián T.C.» · «Pase de Jordi»; «Al palo» · «Disparo de Adrián T.C.»), newest first, with
// its half, its kind for the filters (Todo · Goles · Tarjetas · Cambios) and whose it is. Every list of plays
// (Inicio, the grow window, the live sheet, the match page, Partidos) reads these rows, so a play never reads
// two ways. Pure.
import type { ClubMatch, MatchEvent } from "../../clubData";
import { eventMetaOf, eventSentence, goalOrdinal, isMesaType, minuteText, settled, type EventGlyph, type EventSide } from "../../eventMeta";
import { eventMinute } from "../../../../functions/src/matchEngine";
import { eventSeconds } from "../../../../functions/src/matchAnalysis";
import { withGuestNames } from "../guests";

export type PlayKind = "gol" | "tarjeta" | "cambio" | "ocasion" | "parada" | "otro";

export interface PlayRow {
  id: string;
  /** The minute to show (eventMinute); null when the acta has none. */
  minute: number | null;
  /** «19′», or "". */
  minuteText: string;
  /** The half it happened in: the clock's period, else its minute against half the duration; null without. */
  half: 1 | 2 | null;
  kind: PlayKind;
  /** Good for us: our plays, and the goals that count for us (an own goal of ours is theirs; theirs, ours). */
  ours: boolean;
  /** Whose play it is (eventMetaOf). */
  side: EventSide;
  goal: "for" | "against" | null;
  card: "a" | "r" | null;
  glyph: EventGlyph;
  /** The strap's word: «GOL», «PALO». */
  tag: string;
  /** «Gol de Alcides», «Córner para Orduña». */
  title: string;
  /** «Pase de Adrián T.C.», «Disparo de Jordi» (the post), the note, or which of his goals it is today; ""
   *  when nothing. */
  sub: string;
  /** The ids it names (a guest as `guest:g1`). */
  people: string[];
  event: MatchEvent;
}

export interface PlayHalf {
  half: 1 | 2 | null;
  /** «Segunda parte», «Primera parte», «Sin minuto». */
  label: string;
  rows: PlayRow[];
}

export interface PlaysLog {
  /** Newest first (by time of play; a tie, the later written first); plays without a minute last. */
  rows: PlayRow[];
  count: number;
  counts: Record<PlayKind, number>;
  /** `rows` by half, in the same order. */
  halves: PlayHalf[];
}

export type PlayFilter = "todo" | "gol" | "tarjeta" | "cambio";
export const PLAY_FILTERS: readonly { id: PlayFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "gol", label: "Goles" },
  { id: "tarjeta", label: "Tarjetas" },
  { id: "cambio", label: "Cambios" },
];

/** A play's kind: a goal (either side), a card, a change, a save, a chance (woodwork and missed penalties
 *  too), or the rest (fouls, corners, offsides, knocks, the penalties given). */
export function playKind(e: Pick<MatchEvent, "type" | "team">): PlayKind {
  const m = eventMetaOf(e);
  if (m.goal) return "gol";
  if (m.card) return "tarjeta";
  if (m.group === "cambios") return "cambio";
  if (m.glyph === "parada") return "parada";
  if (m.group === "ocasiones") return "ocasion";
  return "otro";
}

/** The half of a play in a match of `duration` minutes. */
export function playHalf(e: Pick<MatchEvent, "period" | "elapsedSeconds" | "minute">, duration = 50): 1 | 2 | null {
  if (e.period === 1 || e.period === 2) return e.period;
  if (typeof e.elapsedSeconds === "number") return e.elapsedSeconds < duration * 30 ? 1 : 2;
  if (typeof e.minute === "number") return e.minute <= duration / 2 ? 1 : 2;
  return null;
}

const HALF_LABEL = { 1: "Primera parte", 2: "Segunda parte", none: "Sin minuto" } as const;

/** `rows` grouped by half, in their order. */
export function playHalves(rows: readonly PlayRow[]): PlayHalf[] {
  const out: PlayHalf[] = [];
  for (const r of rows) {
    let g = out.find((h) => h.half === r.half);
    if (!g) {
      g = { half: r.half, label: r.half ? HALF_LABEL[r.half] : HALF_LABEL.none, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out;
}

/** The rows a filter keeps. */
export function filterPlays(rows: readonly PlayRow[], filter: PlayFilter): PlayRow[] {
  return filter === "todo" ? [...rows] : rows.filter((r) => r.kind === filter);
}

/** A play as the boards tell it: what happened above, who / how below («Gol de Adrián T.C.» · «Pase de
 *  Jordi»; «Al palo» · «Disparo de Adrián T.C.»). */
export function boardPlay(r: { title: string; sub: string }): { title: string; sub: string } {
  const sub = r.sub.replace(/^Asistencia de /, "Pase de ");
  const palo = /^Al palo, (.+)$/.exec(r.title);
  if (palo) return { title: "Al palo", sub: sub || (palo[1] === "el Piti" ? "Disparo del Piti" : `Disparo de ${palo[1]}`) };
  return { title: r.title, sub };
}

const hasTime = (e: MatchEvent) => typeof e.elapsedSeconds === "number" || typeof e.minute === "number";

/** Every play of `match` that stands, newest first. `nameOf` names our players (the match's guests are
 *  named «Rafa (invitado)» on top of it); `rival` defaults to the match's. */
export function playsLog(match: Pick<ClubMatch, "events" | "guests" | "duration" | "rival">, nameOf: (id: string) => string, rival?: string): PlaysLog {
  const named = withGuestNames(match, nameOf);
  const them = rival ?? match.rival ?? "Rival";
  const duration = match.duration ?? 50;
  const events = settled(match.events);
  const list = events
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => isMesaType(e.type))
    .sort((a, b) => {
      const ta = hasTime(a.e) ? eventSeconds(a.e) : -Infinity;
      const tb = hasTime(b.e) ? eventSeconds(b.e) : -Infinity;
      return tb - ta || b.order - a.order;
    });
  const counts: Record<PlayKind, number> = { gol: 0, tarjeta: 0, cambio: 0, ocasion: 0, parada: 0, otro: 0 };
  const rows = list.map(({ e }): PlayRow => {
    const meta = eventMetaOf(e);
    const said = eventSentence(e, { nameOf: named, rival: them });
    const board = boardPlay(said);
    const kind = playKind(e);
    counts[kind]++;
    return {
      id: e.id,
      minute: eventMinute(e),
      minuteText: minuteText(e),
      half: playHalf(e, duration),
      kind,
      ours: meta.goal ? meta.goal === "for" : meta.side === "us",
      side: meta.side,
      goal: meta.goal,
      card: meta.card,
      glyph: meta.glyph,
      tag: meta.tag,
      title: board.title,
      sub: board.sub || goalOrdinal(events, e),
      people: said.people,
      event: e,
    };
  });
  return { rows, count: rows.length, counts, halves: playHalves(rows) };
}
