// La pizarra · Bloque 5 — «Imprimir el plan»: what the A4 sheet carries, worked out from the board. The
// seven on a pitch (top view: their spots as the board draws them), the bench, the consignas, the cambios
// by tandas, the lanzadores and what we know of the rival. Pure; PrintPlan.tsx lays it out.
import type { Lineup } from "../formations";
import { slotLabel, slotPos } from "./geometry";
import type { Squad } from "./model";
import { tacRows } from "./plan";
import { wavesTxt } from "./cambios";
import { orderTxt, TAKER_KINDS, TAKER_LABEL, takersOf } from "./takers";
import { rivalName } from "./rival";

/** The pitch's length : width on the sheet (as the board's plane: 1.42 : 1). */
export const PITCH_RATIO = 1.42;

export interface PrintSpot {
  /** Across, 0–100 (left to right). */
  x: number;
  /** Along, 0–142 (their goal at the top, ours at the bottom). */
  y: number;
  num: number;
  name: string;
  pos: string;
  cap: boolean;
}

export interface PrintView {
  title: string;
  /** «J8 · MAD SKY · sáb 8 nov · 12:00 · 2-3-1». */
  sub: string;
  seven: PrintSpot[];
  /** Empty spots of the seven (still to fill). */
  empty: number;
  bench: string[];
  consignas: { t: string; d: string }[];
  tandas: string[];
  takers: { k: string; v: string }[];
  rivalSys: string | null;
  rival: { who: string; note: string }[];
}

export interface PrintInput {
  name: string;
  /** The match line («J8 · MAD SKY · sáb 8 nov · 12:00»), empty without one. */
  match: string;
  /** Who the convocatoria calls (null = not known: the whole available squad is the bench). */
  called: ReadonlySet<string> | null;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

export function printView(L: Lineup, sq: Squad, o: PrintInput): PrintView {
  const name = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const seven: PrintSpot[] = [];
  L.slots.forEach((s, i) => {
    if (!s.playerId) return;
    const p = slotPos(L, i);
    seven.push({ x: r1(p.u), y: r1(p.v * PITCH_RATIO), num: sq.byId.get(s.playerId)?.num ?? 0, name: name(s.playerId), pos: slotLabel(L, i), cap: L.roles.captainId === s.playerId });
  });
  const on = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  const bench = sq.list.filter((c) => !on.has(c.id) && !c.baja && c.cv !== "no" && (!o.called || o.called.has(c.id))).map((c) => c.name);
  const t = takersOf(L);
  const takers = TAKER_KINDS.filter((k) => t[k].length).map((k) => ({ k: TAKER_LABEL[k], v: orderTxt(t[k], name) }));
  const riv = L.rival ?? null;
  return {
    title: o.name,
    sub: [o.match, L.freeMode ? "Libre" : L.formation].filter(Boolean).join(" · "),
    seven,
    empty: L.slots.length - seven.length,
    bench,
    consignas: tacRows(L).map((r) => ({ t: r.ct, d: r.cd })),
    tandas: wavesTxt(L.subs ?? [], name),
    takers,
    rivalSys: riv ? riv.formation : null,
    rival: riv ? riv.players.flatMap((p, i) => (p.note ? [{ who: rivalName(riv, i), note: p.note }] : [])) : [],
  };
}
