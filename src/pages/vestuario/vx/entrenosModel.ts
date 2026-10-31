// «Entrenos · cuándo entrenamos» (/vestuario/entrenos, the canvas prototype's SalaEntrenos.dc.html): the pure pieces
// of the room — the head's live status in words, the proposed slots (calendar leaf, votes against the squad, «Más
// votado» / «Ya hay equipo» / «Ya pasó»), the slots a proposer or a captain can fix, the confirmed training's «hay
// equipo» line, the three ghost slots of an empty week and the propose form's ranges (day, desde, hasta in the
// viewer's clock).
import { madridDate } from "../../../lib/derived/madrid";
import { MIN_PLAYERS, plural, slotParts, slotTime, slotVotes, type TrainingSlot } from "../../../lib/vestuario";

/** «Sábado 24 oct». */
export const slotDayMonth = (ms: number) => {
  const p = slotParts(ms);
  return `${p.day} ${p.date} ${p.month}`;
};
/** A calendar leaf: «Sáb» / «24» / «oct». */
export const leaf = (ms: number) => {
  const p = slotParts(ms);
  return { dow: p.day.slice(0, 3), dnum: p.date, mon: p.month };
};
export const hoursPlace = (s: { at: number; end?: number; place?: string }) => `${slotTime(s)}${s.place ? ` · ${s.place}` : ""}`;

export type SlotTag = "" | "Ya pasó" | "Ya hay equipo" | "Más votado";
export interface TrainRow {
  id: string;
  /** «Sábado 24 oct». */
  day: string;
  leaf: { dow: string; dnum: string; mon: string };
  /** «10:00–11:30». */
  t: string;
  /** «10:00–11:30 · Campo de siempre» (no place: just the hours). */
  when: string;
  count: number;
  /** «5 votos». */
  nT: string;
  tag: SlotTag;
  on: boolean;
  past: boolean;
  /** Most voted among the slots still to come (ties: all of them). */
  top: boolean;
  at: number;
  /** The fichas of who voted it (null: a member without a ficha). */
  voters: (string | null)[];
}

/** The proposed slots: each with its votes; «Ya pasó», «Ya hay equipo» (7 or more) or «Más votado» (among the slots
 *  still to come); mine pressed. */
export function trainRows(slots: TrainingSlot[], votes: { slotIds: string[]; playerId?: string | null }[], mine: readonly string[], now: number): TrainRow[] {
  const counts = slotVotes(slots, votes);
  const live = slots.filter((s) => s.at > now);
  const max = Math.max(0, ...live.map((s) => counts.get(s.id) ?? 0));
  return slots.map((s) => {
    const count = counts.get(s.id) ?? 0;
    const past = s.at <= now;
    const top = !past && max > 0 && count === max;
    const tag: SlotTag = past ? "Ya pasó" : count >= MIN_PLAYERS ? "Ya hay equipo" : top ? "Más votado" : "";
    return {
      id: s.id,
      day: slotDayMonth(s.at),
      leaf: leaf(s.at),
      t: slotTime(s),
      when: hoursPlace(s),
      count,
      nT: plural(count, "voto", "votos"),
      tag,
      on: mine.includes(s.id),
      past,
      top,
      at: s.at,
      voters: votes.filter((v) => v.slotIds.includes(s.id)).map((v) => v.playerId ?? null),
    };
  });
}
/** The slots the proposer (or a captain) can still fix: the future ones, most voted first, then by date. */
export const confirmable = (rows: TrainRow[]) => rows.filter((r) => !r.past).sort((x, y) => y.count - x.count || x.at - y.at);

/** The bar of a slot: its votes out of the squad, and where 7 falls on it (percentages). */
export function barOf(count: number, squadN: number) {
  const n = Math.max(squadN, MIN_PLAYERS);
  return { pw: `${Math.min(100, (count / n) * 100)}%`, s7: `${(MIN_PLAYERS / n) * 100}%`, aria: `${count} de ${n} votos; con ${MIN_PLAYERS} hay equipo`, n };
}

/** The confirmed training's «hay equipo» line: «4 van. Con 7 hay equipo.» */
export function sevenLine(n: number) {
  if (n >= MIN_PLAYERS) return `${plural(n, "va", "van")}. Hay equipo.`;
  return n === 0 ? "Todavía no se ha apuntado nadie." : `${plural(n, "va", "van")}. Con ${MIN_PLAYERS} hay equipo.`;
}

export type Head = { kind: "conf"; at: number; byMe: boolean; byName: string; going: number; answered: boolean } | { kind: "vote"; byMe: boolean; byName: string } | { kind: "empty" };
/** The room's head: its live status in words (the title) and what to do (the sub). */
export function headOf(h: Head): { title: string; sub: string } {
  if (h.kind === "conf") {
    const n = h.going;
    const who = h.byMe ? "Lo fijaste tú. " : h.byName ? `Lo fijó ${h.byName}. ` : "";
    const count =
      n >= MIN_PLAYERS ? `Van ${n}: hay equipo.` : n === 0 ? `Aún no va nadie: con ${MIN_PLAYERS} hay equipo.` : `${n === 1 ? "Va 1" : `Van ${n}`}: con ${MIN_PLAYERS} hay equipo.`;
    return { title: `Entreno el ${slotDayMonth(h.at).toLowerCase()}, a las ${slotParts(h.at).time}`, sub: `${who}${count}${h.answered ? "" : " Dinos si vas."}` };
  }
  if (h.kind === "vote") return { title: "¿Cuándo entrenamos?", sub: `Propuesto por ${h.byMe ? "ti" : h.byName}. Vota los huecos que te vienen bien.` };
  return { title: "Nadie ha propuesto huecos", sub: "Esta semana no hay entreno a la vista. Propón hasta tres huecos y el equipo vota el que mejor le venga." };
}

/** «J2 · Pitutis, en casa · domingo 25, 14:00» → the match («J2 · Pitutis, en casa») and when («Domingo 25, 14:00»). */
export function matchParts(line: string) {
  const i = line.lastIndexOf(" · ");
  if (i < 0) return { t: line, s: "" };
  const s = line.slice(i + 3);
  return { t: line.slice(0, i), s: s.charAt(0).toLocaleUpperCase("es") + s.slice(1) };
}

// ---------- the propose form
const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export interface Range {
  day: string;
  from: string;
  to: string;
}
export const EMPTY_RANGE: Range = { day: "", from: "", to: "" };
/** A ghost slot prefills 10:00–11:30, on its day («Sábado», «Domingo») or with the day still to choose («Otro día»). */
export const ghostRange = (at: number | null): Range => ({ day: at ? localDay(at) : "", from: "10:00", to: "11:30" });

export interface Ghost {
  key: string;
  dow: string;
  big: string;
  mon: string;
  t: string;
  s: string;
  aria: string;
  at: number | null;
}
/** An empty week's three ghost slots: next Saturday, next Sunday (with the match, when it is that day) and another day.
 *  `sat` / `sun` come from nextWeekday (10:00 local); `next` is the next match's kick-off and its «J3». */
export function ghosts(sat: number, sun: number, next: { at: number; j: string } | null): Ghost[] {
  const match = next && madridDate(next.at) === madridDate(sun) ? ` · la ${next.j} es a las ${slotParts(next.at).time}` : "";
  const g = (key: string, at: number | null, t: string, s: string): Ghost => {
    const l = at ? leaf(at) : { dow: "Día", dnum: "?", mon: "" };
    return { key, dow: l.dow, big: l.dnum, mon: l.mon, t, s, aria: `Proponer: ${t.toLowerCase()}`, at };
  };
  return [g("sat", sat, "Sábado", "Propón hora"), g("sun", sun, "Domingo", `Propón hora${match}`), g("other", null, "Otro día", "Elige el día")];
}

/** A range the backend accepts: complete, ending after it starts. */
export function rangeMs(r: Range) {
  if (!r.day || !r.from || !r.to) return null;
  const at = new Date(`${r.day}T${r.from}`).getTime(),
    end = new Date(`${r.day}T${r.to}`).getTime();
  return end > at ? { at, end } : null;
}
export const started = (r: Range) => !!(r.day || r.from || r.to);
/** What is wrong with a started range (empty: nothing). */
export function rangeProblem(r: Range) {
  if (!started(r) || rangeMs(r)) return "";
  return r.day && r.from && r.to ? "La hora de fin debe ser posterior a la de inicio." : "Completa día, desde y hasta.";
}
/** The form's errors on «Proponer entreno», per slot: the first one is required, the others only once started. */
export const formErrors = (ranges: Range[]) => ranges.map((r, i) => (i === 0 && !started(r) ? "Completa día, desde y hasta." : rangeProblem(r)));
/** The form's slots as the callable takes them (null: nothing started, or one is incomplete). */
export function proposal(ranges: Range[], place: string) {
  const used = ranges.filter(started);
  const ms = used.map(rangeMs);
  if (!used.length || ms.some((m) => !m)) return null;
  return ms.map((m) => ({ at: m!.at, end: m!.end, place: place.trim() }));
}
