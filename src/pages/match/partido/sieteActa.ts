// «El siete» once the acta is published (the «Notas del partido» board, approved 2026-10-26), pure: everyone who
// played with his nota on the traffic light; the pitch at any minute (the starting seven at rest, the final one, or
// the moviola's), every shirt a token that walks on, off and across when a recolocación moves it; who came off the
// bench; the changes minute by minute with the score and the recolocaciones; the notas in order; each one's minutes
// spot by spot; and the player's ficha. No React, no Firebase: the screen passes the page's model and the ratings.
import type { Participation } from "../../../../functions/src/matchEngine";
import type { TechnicalStats } from "../../../../functions/src/matchAnalysis";
import { isPosCode, lineOf, positionLabel, type Line } from "../../../lib/positions";
import { notaBand, notaText, type NotaBand } from "../../../lib/rating/semaforo";
import type { Group, MatchValue } from "../../../lib/rating/values";
import { notesMean, type MatchNote } from "../../../lib/rating/season";
import { FORM_CUSHION, FORM_MATCHES } from "../../../lib/rating/constants";
import { andList as and, type ChangeGroup, type Lineup, type Play, type PosSeg, type Spot, type Stint, type Tag } from "./model";
import type { Person, Viewer } from "./ctx";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const low = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const r2 = (n: number) => Math.round(n * 100) / 100;
/** «Central», «Lateral izquierdo» (empty for a code it doesn't know). */
export const posName = (code: string | null | undefined): string => (code && isPosCode(code) ? positionLabel(code, "name") : "");
/** «+0,12» / «−0,05», a real minus. */
export const signed = (n: number, d = 2): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d).replace(".", ",")}`;

// ---------- the players
export interface ActaStats {
  goals: number;
  assists: number;
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  recoveries: number;
  clearances: number;
}
export interface ActaPlayer {
  id: string;
  name: string;
  short: string;
  num: string;
  nota: number | null;
  band: NotaBand;
  /** «7,4» / «—». */
  notaTxt: string;
  /** «Buena» / «Sin nota». */
  word: string;
  /** His minutes, whole. */
  minutes: number;
  start: boolean;
  /** Where the seven had him at the kick-off (null: the bench, or no published seven). */
  startCode: string | null;
  me: boolean;
  cap: boolean;
  mvp: boolean;
  /** A guest («guest:g1»): no ficha, no nota. */
  guest: boolean;
  keeper: boolean;
  /** «con los defensas» (the line his nota is compared with). */
  line: string;
  stats: ActaStats;
  stints: Stint[];
  segs: PosSeg[];
  /** When he first stood on the pitch (minutes). */
  firstIn: number;
}

export interface PlayersInput {
  lineup: Lineup;
  stints: Record<string, Stint[]>;
  posSegs: Record<string, PosSeg[]>;
  ledger: Record<string, Participation> | null;
  people: Map<string, Person>;
  viewer: Viewer;
  captain: string | null;
  mvpIds: readonly string[];
  notaOf: (id: string) => number | null;
  values: MatchValue | null;
  duration: number;
}

const LINE_WORD: Record<Line, string> = { POR: "porteros", DEF: "defensas", MED: "medios", DEL: "delanteros" };
/** «con los defensas»; «con defensas y medios, según sus minutos en cada sitio»; «con todo el equipo». */
export function lineText(lines: Partial<Record<Line, number>>): string {
  const e = (Object.entries(lines) as [Line, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!e.length) return "con todo el equipo";
  if (e.length === 1 || e[0][1] >= 0.85) return `con los ${LINE_WORD[e[0][0]]}`;
  return `con ${and(e.map(([l]) => LINE_WORD[l]))}, según sus minutos en cada sitio`;
}

/** Everyone who stood on the pitch: the seven in slot order, then the rest as they came on. */
export function actaPlayers(I: PlayersInput): ActaPlayer[] {
  const seven = I.lineup.slots.map((s) => s.id);
  const played = (id: string) => (I.stints[id] ?? []).some((g) => g.to > g.from) || !!I.posSegs[id];
  const ids = [...new Set([...seven, ...Object.keys(I.posSegs), ...Object.keys(I.stints).filter(played), ...Object.entries(I.ledger ?? {}).filter(([, r]) => r?.played).map(([id]) => id)])].filter((id) => seven.includes(id) || played(id));
  const me = I.viewer.playerId && !I.viewer.anotador ? I.viewer.playerId : null;
  const mvp = new Set(I.mvpIds);
  const out = ids.map((id): ActaPlayer => {
    const p = I.people.get(id);
    const row = I.ledger?.[id] as (Participation & Partial<TechnicalStats>) | undefined;
    const stints = (I.stints[id] ?? []).filter((g) => g.to > g.from);
    const mins = row && typeof row.minutes === "number" ? row.minutes : stints.reduce((s, g) => s + (g.to - g.from), 0);
    const nota = id.startsWith("guest:") ? null : I.notaOf(id);
    const b = notaBand(nota);
    const lines = I.values?.players.get(id)?.lines ?? {};
    const slot = I.lineup.slots.find((s) => s.id === id);
    return {
      id,
      name: p?.name ?? "Jugador",
      short: p?.short ?? "",
      num: p?.num ?? "",
      nota,
      band: b.k,
      notaTxt: notaText(nota),
      word: b.word,
      minutes: Math.round(mins),
      start: !!slot,
      startCode: slot && I.lineup.published ? slot.code : null,
      me: id === me,
      cap: id === I.captain,
      mvp: mvp.has(id),
      guest: id.startsWith("guest:"),
      keeper: (lines.POR ?? 0) >= 0.5,
      line: lineText(lines),
      stats: {
        goals: row?.goals ?? 0,
        assists: row?.assists ?? 0,
        passes: row?.passes ?? 0,
        passesCompleted: row?.passesCompleted ?? 0,
        shots: row?.shots ?? 0,
        shotsOnTarget: row?.shotsOnTarget ?? 0,
        saves: row?.saves ?? 0,
        recoveries: row?.recoveries ?? 0,
        clearances: row?.clearances ?? 0,
      },
      stints,
      segs: I.posSegs[id] ?? [],
      firstIn: stints[0]?.from ?? (slot ? 0 : I.duration),
    };
  });
  const rank = (p: ActaPlayer) => (p.start ? seven.indexOf(p.id) : seven.length);
  return out.sort((a, b) => rank(a) - rank(b) || a.firstIn - b.firstIn || a.name.localeCompare(b.name, "es"));
}

// ---------- the marks beside a shirt
export interface MarkView {
  key: string;
  k: Tag["k"];
  cls: string;
  text: string;
  label: string;
}
const MARK_LABEL: Partial<Record<Tag["k"], string>> = { gol: "Gol en el ", asis: "Asistencia en el ", amarilla: "Amarilla en el ", roja: "Roja en el ", parada: "Paró un penalti en el ", penalti: "Penalti en contra en el " };
/** His marks up to minute `m` (`all`: the whole match), the last goal of ours up to then in gold. */
export function marksOf(plays: readonly Play[], id: string, m: number, all: boolean): MarkView[] {
  const upTo = all ? plays : plays.filter((p) => p.m <= m);
  const lastGoal = [...upTo].reverse().find((p) => p.k === "gol")?.id;
  const out: MarkView[] = [];
  const add = (k: Tag["k"], p: Play, gold = false) =>
    out.push({ key: `${k}${p.id}`, k, cls: `vd-tag--${k}${gold ? " vd-tag--gold" : ""}`, text: `${p.m}′`, label: `${MARK_LABEL[k] ?? ""}${p.m}` });
  for (const p of upTo) {
    if (p.k === "gol" && p.who === id) add("gol", p, p.id === lastGoal);
    if (p.k === "gol" && p.assist === id) add("asis", p);
    if (p.k === "tarjeta" && p.who === id) add("amarilla", p);
    if (p.k === "roja" && p.who === id) add("roja", p);
    if (p.k === "parada" && p.who === id) add("parada", p);
    if (p.k === "penalti" && p.who === id) add("penalti", p);
  }
  return out;
}

// ---------- the pitch
export interface TokenView {
  id: string;
  num: string;
  short: string;
  nota: string;
  band: NotaBand;
  /** On the pitch at this minute (off: waiting by the touchline, hidden). */
  on: boolean;
  left: number;
  top: number;
  me: boolean;
  cap: boolean;
  mvp: boolean;
  marks: MarkView[];
  /** Someone right below: the marks go to the side, not over his shirt. */
  side: boolean;
  label: string;
}
/** Every player's token at minute `m`: on his spot, or by the touchline on the side of the spot he had or will have. */
export function tokensAt(P: readonly ActaPlayer[], frame: (m: number) => Spot[], m: number, duration: number, plays: readonly Play[], all: boolean, published: boolean): TokenView[] {
  const now = frame(m);
  const spotOf = new Map(now.map((s) => [s.id, s]));
  const xy = (s: Spot) => ({ x: clamp(s.x, 10, 90), y: clamp(s.y, 8, 88) });
  return P.map((p) => {
    const s = spotOf.get(p.id);
    let left: number;
    let top: number;
    if (s) ({ x: left, y: top } = xy(s));
    else {
      let near: Spot | undefined;
      for (let d = 1; d <= duration && !near; d++) near = frame(m - d).find((x) => x.id === p.id) ?? frame(m + d).find((x) => x.id === p.id);
      left = near && near.x < 50 ? -16 : 116;
      top = near ? xy(near).y : 50;
    }
    const marks = s ? marksOf(plays, p.id, m, all) : [];
    const side = !!s && now.some((q) => q.id !== p.id && q.y - s.y > 0 && q.y - s.y < 18 && Math.abs(q.x - s.x) < 22);
    const pos = s && published ? low(posName(s.code)) : "";
    const label = [`${p.name}${p.num ? `, el ${p.num}` : ""}${pos ? `, ${pos}` : ""}${p.cap ? ", capitán" : ""}${p.me ? ", tú" : ""}${p.mvp ? ", MVP del partido" : ""}`, p.nota !== null ? `Nota ${p.notaTxt}, ${low(p.word)}` : "Sin nota", ...marks.map((k) => k.label), p.me ? "Abrir tu ficha" : "Abrir su ficha"].join(". ");
    return { id: p.id, num: p.num, short: p.short, nota: p.notaTxt, band: p.band, on: !!s, left, top, me: p.me, cap: p.cap, mvp: !!s && p.mvp, marks, side, label };
  });
}

/** Who to show in the pitch's keyboard order: top to bottom, left to right. */
export const pitchOrder = (spots: readonly Spot[]): string[] => [...spots].sort((a, b) => a.y - b.y || a.x - b.x).map((s) => s.id);

// ---------- desde el banquillo
export interface BenchRow {
  id: string;
  num: string;
  name: string;
  nota: string;
  band: NotaBand;
  marks: MarkView[];
  label: string;
}
export function benchRows(P: readonly ActaPlayer[], plays: readonly Play[], duration: number): BenchRow[] {
  return P.filter((p) => !p.start).map((p) => {
    const marks = marksOf(plays, p.id, duration, true);
    return { id: p.id, num: p.num, name: p.name, nota: p.notaTxt, band: p.band, marks, label: [`${p.name}${p.num ? `, el ${p.num}` : ""}`, p.nota !== null ? `Nota ${p.notaTxt}, ${low(p.word)}` : "Sin nota", ...marks.map((k) => k.label), "Abrir su ficha"].join(". ") };
  });
}

// ---------- los cambios
export interface CambioSub {
  inId: string;
  outId: string;
  inName: string;
  outName: string;
  inNota: string;
  outNota: string;
  inBand: NotaBand;
  outBand: NotaBand;
}
export type CambioRow =
  | { k: "half"; key: string; sc: string }
  | { k: "now"; key: string; m: number }
  | { k: "group"; key: string; m: number; f: number; sc: string; subs: CambioSub[]; sw: { title: string; text: string } | null; later: boolean; here: boolean; his: boolean; ids: string[]; label: string };

const involves = (g: ChangeGroup, id: string) => g.subs.some((s) => s.inId === id || s.outId === id) || g.moves.some((w) => w.id === id);
/** «Huberoski pasa a central · Alcides, a punta» (without a published seven: «X y Y se cambian el sitio»). */
function movesText(g: ChangeGroup, name: (id: string) => string, published: boolean): string {
  if (!published) return `${and(g.moves.map((w) => name(w.id)))} se cambian el sitio`;
  return g.moves.map((w, k) => `${name(w.id)}${k === 0 ? " pasa a " : ", a "}${low(posName(w.to)) || w.to}`).join(" · ");
}

export interface CambiosInput {
  groups: readonly ChangeGroup[];
  P: readonly ActaPlayer[];
  /** The moviola's minute while it is held back (the list follows it), else null. */
  follow: number | null;
  filter: string | null;
  sel: string | null;
  /** The score at the break, «0–5». */
  halfScore: string;
  duration: number;
  published: boolean;
}
export function cambiosRows(I: CambiosInput): CambioRow[] {
  const by = new Map(I.P.map((p) => [p.id, p]));
  const name = (id: string) => by.get(id)?.name ?? "Jugador";
  const half = I.duration / 2;
  const rows: CambioRow[] = [];
  let halfDone = false;
  let nowDone = I.follow === null;
  const mm = I.follow ?? 0;
  for (const g of I.groups) {
    if (!nowDone && g.m > mm && mm < half) {
      rows.push({ k: "now", key: "now", m: mm });
      nowDone = true;
    }
    if (!halfDone && g.second) {
      rows.push({ k: "half", key: "half", sc: I.halfScore });
      halfDone = true;
    }
    if (!nowDone && g.m > mm) {
      rows.push({ k: "now", key: "now", m: mm });
      nowDone = true;
    }
    if (I.filter && !involves(g, I.filter)) continue;
    const subs = g.subs.map((s): CambioSub => {
      const a = by.get(s.inId);
      const o = by.get(s.outId);
      return { inId: s.inId, outId: s.outId, inName: name(s.inId), outName: name(s.outId), inNota: a?.notaTxt ?? "—", outNota: o?.notaTxt ?? "—", inBand: a?.band ?? "no", outBand: o?.band ?? "no" };
    });
    const breakMin = g.second && g.f <= Math.ceil(half);
    const sw = g.moves.length ? { title: g.subs.length ? "Y se recolocan" : breakMin ? "Recolocación al volver del descanso" : "Recolocación", text: movesText(g, name, I.published) } : null;
    const sc = `${g.sc.us}–${g.sc.them}`;
    const label = [
      `Minuto ${g.m}, ${g.sc.us} a ${g.sc.them}`,
      ...subs.map((s) => `Entra ${s.inName}, nota ${s.inNota}, por ${s.outName}, nota ${s.outNota}`),
      ...(sw ? [`${sw.title}: ${sw.text}`] : []),
      "Llevar la moviola a ese minuto",
    ].join(". ");
    rows.push({ k: "group", key: `g${g.m}`, m: g.m, f: g.f, sc, subs, sw, later: I.follow !== null && g.m > mm, here: I.follow !== null && (g.m === mm || g.f === mm), his: !!I.sel && involves(g, I.sel), ids: [...new Set([...g.subs.flatMap((s) => [s.inId, s.outId]), ...g.moves.map((w) => w.id)])], label });
  }
  if (!halfDone && I.groups.length) rows.push({ k: "half", key: "half", sc: I.halfScore });
  if (!nowDone) rows.push({ k: "now", key: "now", m: mm });
  return rows;
}
/** «7 cambios en 4 momentos y 1 recolocación»; filtered: «Los de Fer: 2 momentos de 5». */
export function cambiosSub(groups: readonly ChangeGroup[], filter: string | null, name: (id: string) => string): string {
  if (filter) return `Los de ${name(filter)}: ${plural(groups.filter((g) => involves(g, filter)).length, "momento", "momentos")} de ${groups.length}.`;
  const nSubs = groups.reduce((s, g) => s + g.subs.length, 0);
  const nMoments = groups.filter((g) => g.subs.length).length;
  const nSw = groups.filter((g) => g.moves.length).length;
  if (!nSubs && !nSw) return "Jugaron los siete todo el partido: sin cambios.";
  const head = nSubs ? `${plural(nSubs, "cambio", "cambios")} en ${plural(nMoments, "momento", "momentos")}` : "";
  const tail = nSw ? `${plural(nSw, "recolocación", "recolocaciones")}` : "";
  return `${[head, tail].filter(Boolean).join(" y ")}. Toca uno y el campo vuelve a ese minuto.`.replace(/^./, (c) => c.toUpperCase());
}

// ---------- las notas
export interface RankRow {
  id: string;
  num: string;
  name: string;
  me: boolean;
  mvp: boolean;
  nota: string;
  band: NotaBand;
  minPct: number;
  sub: string;
  label: string;
}
export function rankRows(P: readonly ActaPlayer[], duration: number): RankRow[] {
  return [...P]
    .filter((p) => !p.guest)
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || b.minutes - a.minutes || a.name.localeCompare(b.name, "es"))
    .map((p) => {
      const how = p.start ? "Titular" : "Desde el banquillo";
      return {
        id: p.id,
        num: p.num,
        name: p.name,
        me: p.me,
        mvp: p.mvp,
        nota: p.notaTxt,
        band: p.band,
        minPct: Math.round(clamp(p.minutes / duration, 0, 1) * 100),
        sub: `${how} · ${p.minutes}′${p.nota === null ? " · sin nota" : ""}`,
        label: `${p.name}. ${p.nota !== null ? `Nota ${p.notaTxt}, ${low(p.word)}` : "Sin nota: menos de 10 minutos"}. ${how}, ${p.minutes} minutos.${p.mvp ? " MVP del partido." : ""}${p.me ? " Tú." : ""} Abrir su ficha`,
      };
    });
}

export interface SwarmDot {
  id: string;
  num: string;
  band: NotaBand;
  x: number;
  row: number;
  me: boolean;
}
export interface Swarm {
  dots: SwarmDot[];
  ticks: { x: number; t: string }[];
  normal: number;
  rowsAbove: number;
  rowsBelow: number;
}
/** The notas on one axis, a dot each: a dot that would touch another (closer than `gap`, % of the width) moves to the
 *  next free row, alternating above and below the axis. */
export function swarmOf(P: readonly ActaPlayer[], gap: number): Swarm {
  const rated = P.filter((p) => p.nota !== null) as (ActaPlayer & { nota: number })[];
  const lo = Math.min(5, Math.floor(Math.min(...rated.map((p) => p.nota), 6))) - 0.4;
  const hi = Math.max(9, Math.ceil(Math.max(...rated.map((p) => p.nota), 7))) + 0.1;
  const xOf = (n: number) => clamp(((n - lo) / (hi - lo)) * 100, 3, 97);
  const rows: number[][] = [];
  const OFFS = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const dots = [...rated]
    .sort((a, b) => a.nota - b.nota)
    .map((p) => {
      const x = xOf(p.nota);
      let r = 0;
      while (rows[r]?.some((v) => Math.abs(v - x) < gap)) r++;
      (rows[r] ??= []).push(x);
      return { id: p.id, num: p.num, band: p.band, x: r2(x), row: OFFS[r] ?? r, me: p.me };
    });
  const ticks: Swarm["ticks"] = [];
  for (let t = Math.ceil(lo); t <= Math.floor(hi); t++) ticks.push({ x: r2(xOf(t)), t: String(t) });
  return { dots, ticks, normal: r2(xOf(6.5)), rowsAbove: Math.max(0, ...dots.map((d) => -d.row)), rowsBelow: Math.max(0, ...dots.map((d) => d.row)) };
}

// ---------- los minutos
export interface SegView {
  key: string;
  l: number;
  w: number;
  code: string;
  cls: string;
}
const LINE_CLS: Record<Line, string> = { POR: "is-por", DEF: "is-def", MED: "is-med", DEL: "is-del" };
/** His stretches on the 0–duration bar: each spot's code (from 3′ on, the label fits) and its line's colour; without a
 *  published seven, his stints alone. */
export function segViews(p: Pick<ActaPlayer, "segs" | "stints">, duration: number, published: boolean): SegView[] {
  const pct = (x: number) => (x / duration) * 100;
  const list = published && p.segs.length ? p.segs : p.stints.map((g) => ({ ...g, code: "" }));
  return list.map((g, i) => ({
    key: `${i}-${g.from}`,
    l: r2(pct(g.from) + 0.15),
    w: r2(Math.max(0.8, pct(g.to - g.from) - 0.3)),
    code: g.code && g.to - g.from >= 3 ? g.code : "",
    cls: g.code && isPosCode(g.code) ? LINE_CLS[lineOf(g.code)] : "is-plain",
  }));
}
export interface ShiftRow {
  id: string;
  num: string;
  name: string;
  min: number;
  nota: string;
  band: NotaBand;
  segs: SegView[];
  dots: { key: string; l: number; cls: string }[];
  label: string;
}
const at = (m: number) => Math.round(m);
/** «del 0 al 25, central; del 25 al 50, punta» (his stints without the spot when the seven isn't published). */
export function whereLabel(p: Pick<ActaPlayer, "segs" | "stints">, published: boolean): string {
  const list = published && p.segs.length ? p.segs : p.stints.map((g) => ({ ...g, code: "" }));
  return list.map((g) => `del ${at(g.from)} al ${at(g.to)}${g.code ? `, ${low(posName(g.code)) || g.code}` : ""}`).join("; ");
}
export function shiftRows(P: readonly ActaPlayer[], plays: readonly Play[], duration: number, published: boolean): ShiftRow[] {
  const pct = (x: number) => r2((x / duration) * 100);
  return P.map((p) => {
    const dots: ShiftRow["dots"] = [];
    for (const k of plays) {
      if (k.who !== p.id) continue;
      if (k.k === "gol") dots.push({ key: k.id, l: pct(k.m), cls: "is-gol" });
      if (k.k === "tarjeta" || k.k === "roja") dots.push({ key: k.id, l: pct(k.m), cls: "is-card" });
      if (k.k === "penalti") dots.push({ key: k.id, l: pct(k.m), cls: "is-pen" });
    }
    return {
      id: p.id,
      num: p.num,
      name: p.name,
      min: p.minutes,
      nota: p.notaTxt,
      band: p.band,
      segs: segViews(p, duration, published),
      dots,
      label: `${p.name}: ${whereLabel(p, published)}. ${p.minutes} minutos. ${p.nota !== null ? `Nota ${p.notaTxt}` : "Sin nota"}. Abrir su ficha`,
    };
  });
}

// ---------- la ficha
export interface SeasonLine {
  /** GLOBAL and FOR with this match (null without a nota), and GLOBAL before it. */
  gl: number | null;
  glBefore: number | null;
  fo: number | null;
  /** Minutes of his matches with a nota, this one included. */
  minutes: number;
  /** His notas match by match: the season's jornadas around this one (five), the ones to play with none. */
  jj: { id: string; j: number | null; rival: string; nota: number | null; played: boolean; mine: boolean; this: boolean }[];
}
export interface FichaView {
  id: string;
  kicker: string;
  name: string;
  short: string;
  num: string;
  me: boolean;
  mvp: boolean;
  guest: boolean;
  meta: string;
  nota: string;
  band: NotaBand;
  word: string;
  notaLabel: string;
  hasNota: boolean;
  lineText: string;
  counts: { l: string; v: string; s: string }[];
  segs: SegView[];
  whereLabel: string;
  where: { name: string; min: number }[];
  whereNote: string;
  chLink: string;
  nCh: number;
  gl: string;
  fo: string;
  seasNote: string;
  jj: { key: string; j: string; rival: string; nota: string; band: NotaBand; cls: string; label: string }[];
  groups: { key: string; name: string; v: string; dir: "is-pos" | "is-neg"; w: number; items: string }[];
  lineShort: string;
  go: string;
  href: string | null;
  closeLabel: string;
}
const GROUP_NAME: Record<Group, string> = { ataque: "Ataque", pase: "Pase", defensa: "Defensa", porteria: "Portería", errores: "Errores", disciplina: "Disciplina" };

export interface FichaInput {
  p: ActaPlayer;
  groups: readonly ChangeGroup[];
  values: MatchValue | null;
  season: SeasonLine | null;
  duration: number;
  published: boolean;
  /** His minutes by position from the acta's ledger (when the seven isn't published). */
  positionsPlayed: Partial<Record<string, number>> | null;
  provisionalMinutes: number;
}
export function fichaOf(I: FichaInput): FichaView {
  const { p } = I;
  const half = I.duration / 2;
  // where he played: the spots stretch by stretch (the published seven's), else the acta's minutes by position
  const byCode = new Map<string, number>();
  if (I.published) for (const g of p.segs) byCode.set(g.code, (byCode.get(g.code) ?? 0) + (g.to - g.from));
  else for (const [code, min] of Object.entries(I.positionsPlayed ?? {})) if (typeof min === "number" && min > 0) byCode.set(code, min);
  const where = [...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([code, min]) => ({ name: posName(code) || code, min: Math.round(min) }));
  const moves: string[] = [];
  for (const g of I.groups) {
    const cameIn = g.subs.some((s) => s.inId === p.id);
    for (const w of g.moves) {
      if (w.id !== p.id) continue;
      const when = g.second && !g.subs.length && g.f <= Math.ceil(half) ? "En el descanso" : `En el ${g.m}′`;
      // (one who came on in that very change took that place: he did not «pass» anywhere; back to where he started
      // reads as a return)
      const back = !!p.startCode && w.to === p.startCode;
      const verb = cameIn ? (back ? " entró y volvió a " : " entró y se puso de ") : back ? " volvió a " : " pasó a ";
      moves.push(`${when}${verb}${low(posName(w.to)) || w.to}`);
    }
  }
  const startTxt = p.start ? (p.startCode ? `Empezó de ${low(posName(p.startCode))}. ` : "Empezó en el siete. ") : "Salió desde el banquillo. ";
  const rest = moves.length ? `${moves.join(". ")}.` : where.length > 1 ? "Con los cambios rotativos, en cada entrada ocupó el sitio de quien salía." : where.length ? "Siempre en el mismo sitio." : "";
  const nCh = I.groups.filter((g) => involves(g, p.id)).length;
  const st = p.stats;
  const nSt = p.stints.length;
  const counts = [
    { l: "Minutos", v: `${p.minutes}′`, s: nSt > 1 ? `en ${nSt} tramos` : "" },
    { l: "Goles", v: String(st.goals), s: "" },
    { l: "Asistencias", v: String(st.assists), s: "" },
    { l: "Pases buenos", v: String(st.passesCompleted), s: st.passes ? `de ${st.passes}` : "" },
    p.keeper ? { l: "Paradas", v: String(st.saves), s: "" } : { l: "A puerta", v: String(st.shotsOnTarget), s: st.shots ? `de ${plural(st.shots, "remate", "remates")}` : "" },
    p.keeper ? { l: "Despejes", v: String(st.clearances), s: "" } : { l: "Recuperaciones", v: String(st.recoveries), s: "" },
  ];
  // what his actions were worth, by kind
  const items = I.values?.players.get(p.id)?.items ?? [];
  const sums = new Map<Group, { sum: number; items: typeof items }>();
  for (const it of items) {
    const g = sums.get(it.group) ?? { sum: 0, items: [] };
    g.sum += it.value;
    g.items.push(it);
    sums.set(it.group, g);
  }
  const maxAbs = Math.max(0.0001, ...[...sums.values()].map((g) => Math.abs(g.sum)));
  const groups = [...sums.entries()]
    .sort((a, b) => Math.abs(b[1].sum) - Math.abs(a[1].sum))
    .map(([group, g]) => {
      const its = [...g.items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const txt = its
        .slice(0, 5)
        .map((it) => `${it.label}${it.n > 1 ? ` ×${it.n}` : ""} ${signed(it.value)}`)
        .join(" · ");
      return { key: group, name: GROUP_NAME[group] ?? group, v: signed(g.sum), dir: g.sum >= 0 ? ("is-pos" as const) : ("is-neg" as const), w: r2((Math.abs(g.sum) / maxAbs) * 50), items: `${txt}${its.length > 5 ? ` · y ${its.length - 5} más` : ""}` };
    });
  // his season, with this match
  const s = I.season;
  let seasNote = "";
  if (s && p.nota !== null) {
    const prov = s.minutes < I.provisionalMinutes ? ` Es provisional hasta los ${I.provisionalMinutes} minutos con nota: lleva ${Math.round(s.minutes)}.` : "";
    seasNote = s.glBefore === null ? `Con este partido estrena su GLOBAL.${prov}` : s.gl === s.glBefore ? `Con este partido se queda en ${s.gl}.${prov}` : `Con este partido, de ${s.glBefore} a ${s.gl}.${prov}`;
  } else if (s && s.gl !== null) seasNote = "Este partido no le cuenta: sin nota.";
  const jj = (s?.jj ?? []).map((x) => {
    const b = notaBand(x.nota);
    const j = x.j !== null ? `J${x.j}` : "—";
    return {
      key: x.id,
      j,
      rival: x.rival,
      nota: x.played ? notaText(x.nota) : "·",
      band: x.played ? b.k : ("no" as NotaBand),
      cls: [x.this ? "is-this" : "", !x.played ? "is-next" : ""].filter(Boolean).join(" "),
      label: `${j}, ${x.rival}: ${!x.played ? "por jugar" : x.nota !== null ? `${notaText(x.nota)}${x.this ? ", este partido" : ""}` : x.mine ? "sin nota" : "no jugó"}`,
    };
  });
  const posStart = p.startCode ? low(posName(p.startCode)) : "";
  return {
    id: p.id,
    kicker: p.start ? (posStart ? `Titular · empezó de ${posStart}` : "Titular") : "Desde el banquillo",
    name: p.name,
    short: p.short,
    num: p.num,
    me: p.me,
    mvp: p.mvp,
    guest: p.guest,
    meta: [p.num ? `Dorsal ${p.num}` : "", p.cap ? "capitán" : "", `${p.minutes} minutos`].filter(Boolean).join(" · "),
    nota: p.notaTxt,
    band: p.band,
    word: p.word,
    notaLabel: p.nota !== null ? `Nota ${p.notaTxt}, ${low(p.word)}` : "Sin nota",
    hasNota: p.nota !== null,
    lineText: p.nota !== null ? `Comparado ${p.line}, cada 50 minutos.` : p.guest ? "Los invitados no tienen nota." : p.minutes < 10 ? "Con menos de 10 minutos no hay nota." : "El acta no da para su nota.",
    counts,
    segs: segViews(p, I.duration, I.published),
    whereLabel: whereLabel(p, I.published),
    where,
    whereNote: `${startTxt}${rest}`.trim(),
    chLink: nCh ? `Ver sus cambios (${nCh})` : "Ver los cambios",
    nCh,
    gl: s?.gl == null ? "—" : String(s.gl),
    fo: s?.fo == null ? "—" : String(s.fo),
    seasNote,
    jj,
    groups,
    lineShort: p.line.replace(/, según sus minutos en cada sitio$/, ""),
    go: p.me ? "Ver mi página" : "Ver su página",
    href: p.guest ? null : `/jugadores/${encodeURIComponent(p.id)}`,
    closeLabel: `Cerrar la ficha de ${p.name}`,
  };
}

// ---------- the head
export interface HeadInput {
  view: "quien" | "notas" | "min";
  /** The minute the pitch shows and how: at rest (the start or the end) or held by the moviola. */
  minute: number;
  rest: "start" | "end" | null;
  verb: string;
  dash: string;
  mvpNames: readonly string[];
  played: number;
  groups: readonly ChangeGroup[];
  scoreAt: string;
}
export function headOf(I: HeadInput): { h: string; sub: string } {
  const nSubs = I.groups.reduce((s, g) => s + g.subs.length, 0);
  const nMoments = I.groups.filter((g) => g.subs.length).length;
  const nSw = I.groups.filter((g) => g.moves.length).length;
  const changes = nSubs ? `${plural(nSubs, "cambio", "cambios")} en ${plural(nMoments, "momento", "momentos")}${nSw ? ` y ${plural(nSw, "recolocación", "recolocaciones")}` : ""}` : nSw ? plural(nSw, "recolocación", "recolocaciones") : "sin cambios";
  const result = `${I.verb} ${I.dash} · ${I.mvpNames.length ? `MVP: ${and([...I.mvpNames])}` : `jugaron ${I.played}`}`;
  if (I.view === "notas") return { h: "Las notas", sub: result };
  if (I.view === "min") return { h: "Los minutos", sub: changes.charAt(0).toUpperCase() + changes.slice(1) };
  if (I.rest === "start") return { h: "El siete inicial", sub: result };
  if (I.rest === "end") return { h: "Cómo acabó", sub: `Acabó ${I.dash} · ${changes}` };
  const upTo = I.groups.filter((g) => g.m <= I.minute).reduce((s, g) => s + g.subs.length, 0);
  return { h: `En el minuto ${I.minute}`, sub: `Íbamos ${I.scoreAt} · ${plural(upTo, "cambio", "cambios")} hasta aquí` };
}

// ---------- his season around this match
export interface SeasonGame {
  id: string;
  date: number;
  rival: string;
  jornada: number | null;
  finished: boolean;
  /** He stood on the pitch in it. */
  playedBy: (id: string) => boolean;
}
/** GLOBAL and FOR with this match (and GLOBAL before it) from his frozen notas, and the five jornadas around it: the
 *  ones up to it first, the ones to play after. `notes`: his notas this season, in play order. */
export function seasonLineOf(id: string, matchId: string, notes: readonly MatchNote[], games: readonly SeasonGame[]): SeasonLine {
  const i = notes.findIndex((n) => n.matchId === matchId);
  const gi = games.findIndex((g) => g.id === matchId);
  const thisDate = gi >= 0 ? games[gi].date : Number.POSITIVE_INFINITY;
  const before = i >= 0 ? notes.slice(0, i) : notes.filter((n) => n.date < thisDate);
  const upTo = i >= 0 ? notes.slice(0, i + 1) : before;
  const round = (x: readonly MatchNote[], cushion?: number) => (x.length ? Math.round(notesMean(x, cushion)) : null);
  const start = Math.max(0, Math.min(gi - 4, games.length - 5));
  const noteIn = new Map(notes.map((n) => [n.matchId, n.nota]));
  return {
    gl: round(upTo),
    glBefore: round(before),
    fo: round(upTo.slice(-FORM_MATCHES), FORM_CUSHION),
    minutes: upTo.reduce((s, n) => s + n.minutes, 0),
    jj: (gi >= 0 ? games.slice(start, start + 5) : []).map((g) => ({ id: g.id, j: g.jornada, rival: g.rival, nota: noteIn.get(g.id) ?? null, played: g.finished, mine: g.playedBy(id), this: g.id === matchId })),
  };
}
