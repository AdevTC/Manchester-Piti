// La pizarra «día de partido» — what the Cambios tab shows (pure): who can play the match, the tandas as
// FUT rows «SALE X → ENTRA Y» (with who can leave / come in at that minute, and why a cambio can't be
// made), the timeline's markers, the scrub's words, the minutes table with names, and the preview of
// «Repartir minutos» (what changes, player by player).
import type { Lineup, Sub } from "../formations";
import { canCome } from "./ops";
import type { Squad } from "./model";
import { checkSub, minutesTable, plannedMinutes, seatsAt, sortSubs, SUBS_MAX, wavesOf, type MinTable } from "./cambios";
import { plural } from "./plural";

/** Who can play this match: the seven, whoever the plan brings on, and the convocatoria's available
 *  (without one, those who said «Voy»). */
export function cambiosPool(L: Pick<Lineup, "slots" | "subs">, sq: Squad, called: ReadonlySet<string> | null): string[] {
  const on = L.slots.map((s) => s.playerId).filter((x): x is string => !!x);
  const ins = (L.subs ?? []).map((s) => s.in);
  const more = sq.list.filter((c) => canCome(sq, c.id, called) && (called ? true : c.cv === "voy")).map((c) => c.id);
  return Array.from(new Set([...on, ...ins, ...more])).filter((id) => sq.byId.has(id));
}

export interface Opt {
  id: string;
  label: string;
}
export interface SubRow {
  id: string;
  min: number;
  out: string;
  in: string;
  outName: string;
  inName: string;
  outNum: string;
  inNum: string;
  /** Why it can't be made as planned (null = it can). */
  why: string | null;
  /** Already written in the acta (live). */
  made: boolean;
  outOpts: Opt[];
  inOpts: Opt[];
}
export interface WaveRow {
  min: number;
  rows: SubRow[];
  /** Live: its minute has gone. */
  past: boolean;
}
export interface Marker {
  min: number;
  /** Position on the bar (%). */
  pct: number;
  n: number;
  aria: string;
}
export interface NamedRow {
  id: string;
  num: string;
  name: string;
  min: number;
  pct: number;
  delta: string;
  keeper: boolean;
  starter: boolean;
  eaten: boolean;
  off: "lo" | "hi" | null;
}
export interface CambiosView {
  duration: number;
  waves: WaveRow[];
  markers: Marker[];
  /** «2 tandas · 4 cambios» / «Sin cambios planeados». */
  count: string;
  canAdd: boolean;
  /** The scrub: the minute shown on the pitch and what it means. */
  scrub: number;
  scrubTxt: string;
  table: Omit<MinTable, "rows"> & { rows: NamedRow[] };
}

export interface CambiosArgs {
  L: Lineup;
  sq: Squad;
  subs: readonly Sub[];
  pool: readonly string[];
  duration: number;
  keeperFixed: boolean;
  scrub: number;
  /** Live: the minute, and the cambios already in the acta. */
  minute?: number | null;
  made?: ReadonlySet<string>;
}

export function cambiosView(a: CambiosArgs): CambiosView {
  const { L, sq, duration: D } = a;
  const name = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const num = (id: string) => String(sq.byId.get(id)?.num ?? "–");
  const ordered = sortSubs(a.subs);
  const rows = new Map<string, SubRow>();
  ordered.forEach((s, k) => {
    const before = ordered.slice(0, k);
    const { seats } = seatsAt(L, before, s.min);
    const on = seats.filter((x): x is string => !!x);
    const outIds = Array.from(new Set([...on, s.out]));
    const inIds = Array.from(new Set([...a.pool.filter((id) => !on.includes(id)), s.in]));
    const c = checkSub(L, before, s, D, name);
    rows.set(s.id, {
      id: s.id,
      min: s.min,
      out: s.out,
      in: s.in,
      outName: name(s.out),
      inName: name(s.in),
      outNum: num(s.out),
      inNum: num(s.in),
      why: c.ok ? null : (c.why ?? "No se puede hacer"),
      made: !!a.made?.has(s.id),
      outOpts: outIds.map((id) => ({ id, label: num(id) + " · " + name(id) })),
      inOpts: inIds.map((id) => ({ id, label: num(id) + " · " + name(id) })),
    });
  });
  const ws = wavesOf(a.subs);
  const waves = ws.map((w) => ({ min: w.min, rows: w.subs.map((s) => rows.get(s.id) as SubRow), past: a.minute != null && w.min < a.minute }));
  const markers = ws.map((w) => ({
    min: w.min,
    pct: D ? +((w.min / D) * 100).toFixed(2) : 0,
    n: w.subs.length,
    aria: "Tanda del " + w.min + "′: " + w.subs.map((s) => name(s.in) + " por " + name(s.out)).join(", ") + ". Flechas para moverla",
  }));
  const nS = a.subs.length;
  const count = nS ? plural(ws.length, "tanda") + " · " + plural(nS, "cambio") : "Sin cambios planeados";
  // the scrub: who is on at that minute, and what the last tanda before it did
  const t = Math.max(0, Math.min(D, a.scrub));
  const lastW = ws.filter((w) => w.min <= t).pop();
  const scrubTxt =
    t === 0
      ? "Minuto 0: el siete titular"
      : "Minuto " + t + ": " + (lastW ? "tras la tanda del " + lastW.min + "′ (" + lastW.subs.map((s) => name(s.in) + " por " + name(s.out)).join(", ") + ")" : "el siete titular, sin cambios aún");
  const mt = minutesTable(L, a.subs, a.pool, D, a.keeperFixed);
  return {
    duration: D,
    waves,
    markers,
    count,
    canAdd: nS < SUBS_MAX,
    scrub: t,
    scrubTxt,
    table: {
      ...mt,
      rows: mt.rows.map((r) => ({ id: r.id, num: num(r.id), name: name(r.id), min: r.min, pct: r.pct, delta: r.delta, keeper: r.keeper, starter: r.starter, eaten: r.eaten, off: r.off })),
    },
  };
}

/** A new cambio at `min`: out, the one on the pitch then with the most planned minutes (not the keeper);
 *  in, the one who can come on with the fewest. Null when nobody can come on. */
export function suggestSub(L: Lineup, subs: readonly Sub[], pool: readonly string[], min: number, duration: number, id: string): Sub | null {
  const { seats } = seatsAt(L, subs, min);
  const mins = plannedMinutes(L, subs, duration);
  const on = seats.filter((x): x is string => !!x);
  const bench = pool.filter((p) => !on.includes(p)).sort((a, b) => (mins.get(a) ?? 0) - (mins.get(b) ?? 0));
  const field = seats
    .map((p, i) => ({ p, i }))
    .filter((x): x is { p: string; i: number } => !!x.p && x.i !== 0)
    .sort((a, b) => (mins.get(b.p) ?? 0) - (mins.get(a.p) ?? 0));
  if (!bench.length || !field.length) return null;
  return { id, min, out: field[0].p, in: bench[0] };
}

/** «Repartir minutos»'s preview: the new tandas and, player by player, the minutes before → after. */
export function previewDiff(L: Lineup, before: readonly Sub[], after: readonly Sub[], pool: readonly string[], duration: number, sq: Squad): { waves: string[]; rows: { id: string; name: string; was: number; now: number }[] } {
  const name = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const a = plannedMinutes(L, before, duration);
  const b = plannedMinutes(L, after, duration);
  const ids = Array.from(new Set([...pool, ...a.keys(), ...b.keys()]));
  const rows = ids
    .map((id) => ({ id, name: name(id), was: a.get(id) ?? 0, now: b.get(id) ?? 0 }))
    .filter((r) => r.was !== r.now)
    .sort((x, y) => y.now - y.was - (x.now - x.was));
  const waves = wavesOf(after).map((w) => w.min + "′ · " + w.subs.map((s) => name(s.in) + " por " + name(s.out)).join(", "));
  return { waves, rows };
}
