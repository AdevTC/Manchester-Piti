// «El siete» (P- boards, place-siete.js), pure: one glass pitch for the whole match day driven by the moviola's
// minute — who stands where (the acta's stints, rolling substitutions included), the marks beside each shirt laid
// out so they touch nothing (placeTags), who is off the pitch and since when, every player's stints, the player
// panel (the one touched; on a big screen, when nobody is touched, the one that matters now), who is not here and
// why, and the words of each moment. No React, no Firebase: the screen passes the page's model and the reads.
import type { ClubMatch } from "../../../lib/clubData";
import { computeStats } from "../../../lib/playerStats";
import { totalMinutes } from "../../../lib/derived/minutesOf";
import { scoreText } from "../../../lib/derived/words";
import { isVisibleMatch, type Participation } from "../../../../functions/src/matchEngine";
import type { TechnicalStats } from "../../../../functions/src/matchAnalysis";
import { isPosCode, positionLabel } from "../../../lib/positions";
import { F7_SPOTS } from "../../../lib/ficha";
import { andList as and, type Fase, type Lineup, type Play, type ResultWords, type Spot, type Stint, type Tag, type Timeline } from "./model";
import type { Person, Viewer } from "./ctx";

const POS: Record<string, string> = { POR: "Portero", LI: "Lateral izquierdo", DFC: "Central", LD: "Lateral derecho", MC: "Mediocentro", DC: "Delantero centro" };
const ROLE: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Centrocampista", DEL: "Delantero" };
const LABEL: Record<Tag["k"], string> = {
  gol: "Gol en el ",
  asis: "Asistencia en el ",
  amarilla: "Amarilla en el ",
  roja: "Roja en el ",
  parada: "Paró un penalti en el ",
  cambio: "En el campo desde el ",
  penalti: "Penalti en contra en el ",
  mvp: "MVP del partido",
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const posName = (code: string | null | undefined): string => (code ? (POS[code] ?? (isPosCode(code) ? positionLabel(code, "name") : "")) : "");
const fix1 = (n: number) => n.toFixed(1);

// ---------- the marks beside each shirt
export interface TagItem {
  /** The spot (0–100 of the pitch's width and height). */
  x: number;
  y: number;
  tags: { text: string; icon: boolean }[];
  /** The shirt name's length (its width under the shirt). */
  nameLen: number;
  me: boolean;
  cap: boolean;
}
export interface TagPlace {
  /** The column goes on the shirt's left. */
  tl: boolean;
  /** Nudged up (−) or down (+), px. */
  dy: number;
}

/**
 * The marks beside each shirt: a column on the roomier side, nudged up or down until it touches no shirt, name,
 * «Tú» chip, «C» or other column — checked on the narrowest pitch (340 px) and a roomier one, since the spots
 * spread as the pitch grows but the chips keep their size. The board's layout pass, verbatim.
 */
export function placeTags(items: readonly TagItem[]): TagPlace[] {
  type Box = { x: number; y: number; w: number; h: number };
  const scales = [1, 1.36];
  const done: Box[][] = [];
  const rect = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
  const ov = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const geo = (it: TagItem, s: number) => {
    const W = 340 * s;
    const H = W * 1.2;
    const sw = Math.max(36, Math.min(64, W * 0.11));
    return { W, H, X: (it.x / 100) * W, Y: (it.y / 100) * H, sw, sh: sw * 1.327 };
  };
  const obstacles = (s: number) => {
    const out: Box[] = [];
    for (const it of items) {
      const g = geo(it, s);
      const nw = it.nameLen * 6.8 + 6;
      out.push(rect(g.X - g.sw / 2, g.Y - g.sh / 2 - 7.5, g.sw, g.sh));
      out.push(rect(g.X - nw / 2, g.Y + g.sh / 2 - 5.5, nw, 14));
      if (it.me) out.push(rect(g.X + g.sw / 2 + 1, g.Y - g.sh / 2 - 9, 30, 19));
      if (it.cap) out.push(rect(g.X - g.sw / 2 - 8, g.Y - g.sh / 2 - 6, 18, 18));
    }
    return out;
  };
  const obs = scales.map(obstacles);
  const cands: { dy: number; sd: "p" | "o"; pen: number }[] = [];
  for (const dy of [0, -12, 12, -24, 24, -36, 36, 48, -48]) for (const sd of ["p", "o"] as const) cands.push({ dy, sd, pen: Math.abs(dy) / 12 + (sd === "o" ? 1.5 : 0) });
  cands.sort((a, b) => a.pen - b.pen);
  const order = items.map((_, i) => i).sort((a, b) => items[b].tags.length - items[a].tags.length);
  const res: TagPlace[] = items.map(() => ({ tl: false, dy: 0 }));
  for (const i of order) {
    const it = items[i];
    if (!it.tags.length) continue;
    let w = 0;
    for (const t of it.tags) w = Math.max(w, 12 + (t.icon ? 14 : 0) + t.text.length * 6.6);
    const h = it.tags.length * 18 + (it.tags.length - 1) * 3;
    const pref = it.x > 75 ? "l" : it.x < 25 ? "r" : it.x < 50 ? "l" : "r";
    let best: { cost: number; side: "l" | "r"; dy: number; boxes: Box[] } | null = null;
    for (const c of cands) {
      const side = c.sd === "p" ? pref : pref === "l" ? "r" : "l";
      let cost = 0;
      const boxes: Box[] = [];
      scales.forEach((s, k) => {
        const g = geo(it, s);
        const b = rect(side === "r" ? g.X + g.sw / 2 + 2 : g.X - g.sw / 2 - 2 - w, g.Y - g.sh / 2 - 7.5 + c.dy, w, h);
        boxes.push(b);
        cost += Math.max(0, b.w * b.h - ov(b, rect(3, 3, g.W - 6, g.H - 6)) - 0.5);
        for (const o of obs[k]) cost += ov(b, o);
        for (const d of done) cost += ov(b, d[k]);
      });
      if (cost < 0.5) cost = 0;
      if (!best || cost < best.cost - 0.5) best = { cost, side, dy: c.dy, boxes };
      if (cost === 0) break;
    }
    if (!best) continue;
    done.push(best.boxes);
    res[i] = { tl: best.side === "l", dy: best.dy };
  }
  return res;
}

// ---------- the playhead crossing a change or a mark
export interface Crossing {
  /** A spot whose man changed between the two minutes: who walks in, who walks off. */
  walks: { inId: string; outId: string }[];
  /** The minutes of the marks the playhead just passed (they pop). */
  fresh: number[];
}
/** What the moviola crossed going from minute `a` to `b` (a short step: dragging or playing, not a jump). */
export function crossingOf(tl: Pick<Timeline, "onPitchAt">, plays: readonly Play[], a: number, b: number): Crossing {
  const walks: Crossing["walks"] = [];
  if (a !== b && Math.abs(b - a) <= 6) {
    const A = tl.onPitchAt(a);
    tl.onPitchAt(b).forEach((sp, i) => {
      const was = A[i];
      if (was && was.id !== sp.id) walks.push({ inId: sp.id, outId: was.id });
    });
  }
  const fresh = b > a && b - a <= 4 ? plays.filter((p) => p.k !== "cambio" && a < p.m && p.m <= b).map((p) => p.m) : [];
  return { walks, fresh };
}

// ---------- his season
export interface SeasonCounts {
  partidos: number;
  minutos: number;
  goles: number;
  asistencias: number;
}
/** His counts over the season's other published actas (this match left out: tonight is added at the minute). */
export function seasonCountsOf(matches: readonly ClubMatch[], match: Pick<ClubMatch, "id" | "seasonId">, id: string): SeasonCounts {
  const others = matches.filter((m) => m.id !== match.id && !!match.seasonId && m.seasonId === match.seasonId && m.status === "finished" && isVisibleMatch(m));
  const s = computeStats(id, others);
  return { partidos: s.matchesPlayed, minutos: totalMinutes(others, id), goles: s.goals, asistencias: s.assists };
}

// ---------- who is not here, and why
export interface OutAnswer {
  uid: string;
  response: "yes" | "no" | "maybe";
  playerId: string | null;
}
/**
 * «No están»: the season's squad outside the convocatoria, each with the real reason — at the mesa, away (an
 * absence), «No puede», «En duda», not called by the captain, or no answer yet. `absentOf` gives an
 * absence's «hasta 19 oct» for a «No puedo» an absence covers (derived/absences absentBadge), else null.
 */
export function outOf(args: {
  squad: readonly string[];
  called: ReadonlySet<string>;
  notCalled: readonly string[];
  answers: readonly OutAnswer[];
  mesa: ReadonlySet<string>;
  absentOf: (a: OutAnswer) => string | null;
  /** The viewer at the mesa (his own row reads «En la mesa: tú»). */
  meAtMesa: string | null;
}): { id: string; why: string }[] {
  const byPlayer = new Map<string, OutAnswer>();
  for (const a of args.answers) if (a.playerId) byPlayer.set(a.playerId, a);
  const nc = new Set(args.notCalled);
  return args.squad
    .filter((id) => !args.called.has(id))
    .map((id) => {
      const a = byPlayer.get(id);
      let why: string;
      if (args.mesa.has(id)) why = id === args.meAtMesa ? "En la mesa: tú" : "En la mesa";
      else if (a?.response === "no") why = args.absentOf(a) ?? "No puede";
      else if (a?.response === "maybe") why = "En duda";
      else if (a?.response === "yes" || nc.has(id)) why = "No convocado";
      else why = "Sin responder";
      return { id, why };
    });
}

// ---------- the screen
export interface SieteInput {
  fase: Fase;
  minute: number;
  edge: number;
  duration: number;
  pre: boolean;
  live: boolean;
  played: boolean;
  plays: readonly Play[];
  tl: Timeline;
  lineup: Lineup;
  /** The whole match's result (the edge's while it is played). */
  result: ResultWords;
  captain: string | null;
  people: Map<string, Person>;
  viewer: Viewer;
  /** The MVP once the vote has closed (a tie shares it). */
  mvpIds: readonly string[];
  sel: string | null;
  view: "quien" | "min";
  fresh: readonly number[];
  /** Who walks in (→ who walks off), while the playhead crosses a change. */
  walking: ReadonlyMap<string, string>;
  /** The acta's ledger (its stints and numbers), when it has one. */
  ledger: Record<string, Participation> | null;
  /** The narrated analysis covers only part of the match. */
  partial: boolean;
  /** «el sábado a las 21:40» (the seven came from the pizarra), else null. */
  publishedAt: string | null;
  out: readonly { id: string; why: string }[];
  /** His counts over the season's other published actas. */
  seasonOf: (id: string) => SeasonCounts;
  seasonName: string;
  jornada: number | null;
  /** «20 h» until the MVP vote closes ("" unknown). */
  voteLeft: string;
}

export interface TagView {
  key: string;
  k: Tag["k"];
  cls: string;
  label: string;
  text: string;
}
export interface SpotView {
  id: string;
  left: number;
  top: number;
  wx: string;
  num: string;
  name: string;
  captain: boolean;
  me: boolean;
  cls: string;
  tags: TagView[];
  tdy: number;
  on: boolean;
  label: string;
}
export interface BenchView {
  id: string;
  num: string;
  name: string;
  status: string;
  cls: string;
  on: boolean;
  tags: TagView[];
}
export interface StintView {
  id: string;
  num: string;
  name: string;
  sub: string;
  me: boolean;
  mvp: boolean;
  cls: string;
  minText: string;
  headOn: boolean;
  headPct: string;
  dots: { left: string; cls: string }[];
  ghosts: { l: string; w: string }[];
  fills: { l: string; w: string }[];
  label: string;
}
export interface CardView {
  id: string;
  num: string;
  name: string;
  mine: boolean;
  mvp: boolean;
  meta: string;
  now: string;
  counts: { v: string; l: string }[] | null;
  seasonLabel: string;
  seasonNote: string;
  kicker: string;
  cls: string;
  closable: boolean;
  /** His ficha (null: a guest has none). */
  href: string | null;
  go: string;
  closeLabel: string;
}
export interface SieteView {
  cls: string;
  h: string;
  sub: string;
  hasSeg: boolean;
  view: "quien" | "min";
  pitchCls: string;
  ghost: boolean;
  rings: { left: number; top: number }[];
  spots: SpotView[];
  leaving: { key: string; left: number; top: number; wx: string; num: string; name: string }[];
  listLabel: string;
  hint: string;
  card: CardView | null;
  mvpWait: string;
  mvpVote: boolean;
  hasBench: boolean;
  convo: string | null;
  benchT: string;
  bench: BenchView[];
  showOut: boolean;
  out: { id: string; name: string; why: string }[];
  showDoor: boolean;
  note: string;
  pizarra: boolean;
  stints: StintView[];
  showChanges: boolean;
  chT: string;
  chSub: string;
  half: number;
  unused: string;
  minNote: string;
}

function tagView(t: Tag, fresh: readonly number[], i: number): TagView {
  const mm = parseInt(t.text, 10);
  return {
    key: `${t.k}${t.text}${i}`,
    k: t.k,
    cls: `vd-tag--${t.k}${t.gold ? " vd-tag--gold" : ""}${fresh.includes(mm) ? " is-new" : ""}`,
    label: t.k === "mvp" ? LABEL.mvp : LABEL[t.k] + mm,
    text: t.text,
  };
}
const iconless = (k: Tag["k"]) => k === "amarilla" || k === "roja";

export function sieteView(I: SieteInput): SieteView {
  const { fase: f, played, live, pre, duration: D, plays, tl, lineup } = I;
  const m = played ? I.minute : 0;
  const edge = I.edge;
  const half = Math.round(D / 2);
  const doneView = played && !live;
  const aplazado = f === "aplazado";
  const pendiente = f === "pendiente";
  const ghost = !played && lineup.slots.length === 0;
  const mvpSet = new Set(I.mvpIds);
  const mvp = I.mvpIds[0] ?? null;
  const R = I.result;
  const dash = scoreText(R.us, R.them);
  const me = I.viewer.playerId;
  const isPlayer = !!me && !I.viewer.anotador;
  const meOnPitch = isPlayer ? me : null;
  const person = (id: string) => I.people.get(id);
  const name = (id: string) => person(id)?.name ?? "Jugador";
  const short = (id: string) => person(id)?.short ?? "";
  const num = (id: string) => person(id)?.num ?? "";
  const sel = I.sel && person(I.sel) ? I.sel : null;
  const upTo = plays.filter((p) => p.m <= m);

  // ---- who is where at the minute
  const spotsRaw: Spot[] = ghost ? [] : tl.onPitchAt(m);
  const tags = played ? tl.tagsAt(m) : {};
  for (const id of I.mvpIds) (tags[id] = (tags[id] ?? []).slice()).push({ k: "mvp", text: "MVP", gold: true });
  const items: TagItem[] = spotsRaw.map((s) => ({
    x: clamp(s.x, 12, 88),
    y: clamp(s.y, 9, 88),
    tags: (tags[s.id] ?? []).map((t) => ({ text: t.text, icon: !iconless(t.k) })),
    nameLen: short(s.id).length,
    me: s.id === meOnPitch,
    cap: s.id === I.captain,
  }));
  const lay = placeTags(items);
  const spots: SpotView[] = spotsRaw.map((s, i) => {
    const it = items[i];
    const cap = s.id === I.captain;
    const isMe = s.id === meOnPitch;
    const isMvp = mvpSet.has(s.id);
    const pos = posName(s.code);
    const n = num(s.id);
    return {
      id: s.id,
      left: it.x,
      top: it.y,
      wx: fix1(106 - it.x),
      num: n,
      name: short(s.id),
      captain: cap,
      me: isMe,
      cls: [lay[i].tl ? "is-tl" : "", I.walking.has(s.id) ? "is-walk" : "", sel === s.id ? "is-sel" : "", isMvp ? "is-mvp" : "", isMe ? "is-me" : ""].filter(Boolean).join(" "),
      tags: (tags[s.id] ?? []).map((t, k) => tagView(t, I.fresh, k)),
      tdy: lay[i].dy,
      on: sel === s.id,
      label: `${name(s.id)}${n ? `, el ${n}` : ""}${pos ? `, ${pos.toLowerCase()}` : ""}${cap ? ", capitán" : ""}${isMe ? ", tú" : ""}${isMvp ? ", MVP del partido" : ""}. Ver su tarjeta`,
    };
  });
  const leaving: SieteView["leaving"] = [];
  for (const [inId, outId] of I.walking) {
    const sp = spots.find((s) => s.id === inId);
    if (sp) leaving.push({ key: `${outId}>${inId}`, left: sp.left, top: sp.top, wx: sp.wx, num: num(outId), name: short(outId) });
  }

  // ---- off the pitch at the minute: the rest of the convocatoria, with where each one stands
  const onNow = new Set(spotsRaw.map((s) => s.id));
  const seven = lineup.slots.map((s) => s.id);
  const convo = [...new Set([...seven, ...lineup.bench, ...(played ? Object.keys(tl.stints) : [])])];
  const rows = tl.stintsAt(m);
  const minOf = new Map(rows.map((r) => [r.id, r.min]));
  const rowOf = new Map(rows.map((r) => [r.id, r]));
  const tramos = (all: readonly Stint[]) => all.map((g) => `${g.from}–${g.to}`).join(", ");
  const bench: BenchView[] = ghost
    ? []
    : convo
        .filter((id) => (played ? !onNow.has(id) : lineup.bench.includes(id)))
        .map((id) => {
          let status: string;
          let cls = "";
          const segs = played ? tl.segsAt(id, m) : [];
          if (!played) status = ROLE[person(id)?.pos ?? ""] ?? "";
          else if (segs.length) {
            const lastOut = segs[segs.length - 1].to;
            const mins = minOf.get(id) ?? 0;
            status = `${live && m - lastOut <= 2 ? "Acaba de salir" : `Fuera desde el ${lastOut}′`} · ${mins}′ jugados${segs.length > 1 ? ` en ${segs.length} tramos` : ""}`;
            cls = "is-out";
          } else status = m >= D ? "No llegó a salir" : "Aún sin salir";
          const tg = (played ? (tags[id] ?? []) : []).filter((t) => t.k !== "cambio").map((t, k) => tagView(t, I.fresh, k));
          return { id, num: num(id), name: name(id), status, cls: (cls + (sel === id ? " is-sel" : "")).trim(), on: sel === id, tags: tg };
        });
  const benchT = !played ? "En el banquillo" : m >= D ? "Fuera al final" : "Fuera del campo ahora";
  const nCh = plays.filter((p) => p.k === "cambio" && p.m <= m).length;

  // ---- the head
  const dragged = played && m < edge;
  const sys = lineup.system;
  let h: string;
  let sub: string;
  const view: "quien" | "min" = doneView && I.view === "min" ? "min" : "quien";
  if (pre) {
    h = ghost ? "El siete" : `El siete, en ${sys}`;
    sub = ghost ? "Todavía sin publicar" : I.publishedAt ? `Publicado ${I.publishedAt}` : "El siete de la convocatoria";
  } else if (aplazado) {
    h = "La convocatoria";
    sub = "Como estaba antes del aplazamiento";
  } else if (pendiente) {
    h = `El siete, en ${sys}`;
    sub = "Sin acta: los minutos llegan con ella";
  } else if (live) {
    h = "Ahora en el campo";
    const who = nCh ? `${nCh}${nCh === 1 ? " cambio" : " cambios"} hasta aquí` : "el siete de salida";
    sub = dragged ? `En el minuto ${m} · ${who} · el directo va por el ${edge}` : f === "descanso" ? `Descanso · ${who}` : `Minuto ${m} · ${who}`;
  } else {
    h = view === "min" ? "Los minutos de cada uno" : "Quién hizo qué";
    const nAll = plays.filter((p) => p.k === "cambio").length;
    const tail =
      f === "final"
        ? `Final, ${dash} · minutos provisionales`
        : mvp
          ? `${R.verb} ${dash} · MVP: ${and(I.mvpIds.map(name))}`
          : `${R.verb} ${dash} · jugaron ${tl.stintsAt(D).length}${nAll > 2 ? ` · ${nAll} cambios` : ""}`;
    sub = dragged ? `En el minuto ${m} · ${nCh}${nCh === 1 ? " cambio" : " cambios"} hasta aquí` : tail;
  }

  // ---- every player's stints (the changes, player by player): all of them ghosted, filled up to the minute
  const pct = (x: number) => fix1((x / D) * 100);
  const full = played ? tl.stintsAt(D) : [];
  const endM = live ? edge : D;
  const stints: StintView[] = full
    .map((r) => {
      const c = rowOf.get(r.id);
      const segsNow = c ? c.segs : [];
      const fw = c ? c.min : 0;
      const all = r.all;
      // (while it is played the acta stops at the live edge: a stint that reaches it is still going)
      const subTxt =
        all.length === 1 && all[0].from === 0 && all[0].to >= D
          ? "Todo el partido"
          : all.length === 1
            ? `${all[0].from > 0 ? `Entró en el ${all[0].from}′` : "Titular"}${all[0].to < endM ? `, salió en el ${all[0].to}′` : ""}`
            : `${r.from === 0 ? "Titular · " : ""}${all.length} tramos: ${tramos(all)}`;
      const dots: StintView["dots"] = [];
      for (const p of plays) {
        if (p.who !== r.id) continue;
        if (p.k === "gol") dots.push({ left: pct(p.m), cls: `is-gol${p.m > m ? " is-later" : ""}` });
        if (p.k === "tarjeta" || p.k === "roja" || p.k === "penalti") dots.push({ left: pct(p.m), cls: `${p.k === "penalti" ? "is-pen" : "is-card"}${p.m > m ? " is-later" : ""}` });
      }
      const goals = plays.filter((p) => p.k === "gol" && p.who === r.id).length;
      const isMe = r.id === meOnPitch;
      const isMvp = mvpSet.has(r.id);
      const on = onNow.has(r.id) && m < D;
      const head = dragged || live;
      return {
        onNow: on ? 1 : 0,
        v: {
          id: r.id,
          num: num(r.id),
          name: name(r.id),
          sub: subTxt,
          me: isMe,
          mvp: isMvp,
          cls: [isMe ? "is-me" : "", isMvp ? "is-mvp" : "", sel === r.id ? "is-sel" : "", on ? "is-on" : ""].filter(Boolean).join(" "),
          minText: `${head ? fw : r.min}′`,
          headOn: head,
          headPct: pct(m),
          dots,
          ghosts: all.map((g) => ({ l: pct(g.from), w: pct(Math.max(g.to - g.from, 0.6)) })),
          fills: segsNow.map((g) => ({ l: pct(g.from), w: pct(g.to - g.from) })),
          label: `${name(r.id)}: ${tramos(all)}, ${r.min} minutos${goals ? `, ${plural(goals, "gol", "goles")}` : ""}${head ? `; hasta el ${m}, ${fw}` : ""}`,
        },
      };
    })
    .sort((a, b) => b.onNow - a.onNow)
    .map((x) => x.v);
  const unused = lineup.bench.filter((id) => !(tl.stints[id] ?? []).some((g) => g.to > g.from)).map(name);
  const rolling = full.some((r) => r.all.length > 1);

  // ---- the player panel: the one you touched; on a big screen, when nobody is touched, the one that matters
  // now (you, the MVP, the last scorer up to the moviola's minute, the captain, else the first of the seven)
  let lastScorer: string | null = null;
  if (played) for (const p of upTo) if (p.k === "gol" && p.who) lastScorer = p.who;
  const inMatch = (id: string | null) => !!id && (convo.includes(id) || onNow.has(id));
  const defId = (isPlayer && inMatch(me) ? me : null) ?? mvp ?? lastScorer ?? (inMatch(I.captain) ? I.captain : null) ?? spotsRaw[0]?.id ?? null;
  const isDef = !sel;
  const cid = sel ?? defId;
  let card: CardView | null = null;
  const sq = cid ? person(cid) : undefined;
  if (cid && sq && !ghost) {
    const onSp = spotsRaw.find((s) => s.id === cid);
    const lin = lineup.slots.find((s) => s.id === cid);
    const code = onSp ? onSp.code : lin ? lin.code : null;
    const posTxt = posName(code) || ROLE[sq.pos] || "";
    const cap = cid === I.captain;
    const mine = cid === me;
    const isMvp = mvpSet.has(cid);
    const lead0 = sq.first && sq.last ? `${sq.first} ${sq.last}` : sq.first && sq.first !== sq.name ? sq.first : "";
    const numBit = sq.num ? `nº ${sq.num}` : "";
    const metaBits = [[lead0, numBit].filter(Boolean).join(" · "), posTxt].filter(Boolean);
    if (cap) metaBits.push("capitán");
    let nowTxt: string;
    let counts: CardView["counts"] = null;
    let seasonLabel = "";
    let seasonNote = "";
    const gl = played ? upTo.filter((p) => p.k === "gol" && p.who === cid).length : 0;
    const as = played ? upTo.filter((p) => p.k === "gol" && p.assist === cid).length : 0;
    const mins = played ? (minOf.get(cid) ?? 0) : 0;
    const prior = I.seasonOf(cid);
    const countsOf = (s: SeasonCounts) => [
      { v: String(s.partidos), l: s.partidos === 1 ? "partido" : "partidos" },
      { v: `${Math.round(s.minutos)}′`, l: "minutos" },
      { v: String(s.goles), l: s.goles === 1 ? "gol" : "goles" },
      { v: String(s.asistencias), l: s.asistencias === 1 ? "asistencia" : "asistencias" },
    ];
    const jj = I.jornada ? `la J${I.jornada}` : "este partido";
    if (!played) {
      const linPos = lin ? posName(lin.code).toLowerCase() : "";
      nowTxt = lin ? `Sale de titular${linPos ? `, de ${linPos}` : ""}.` : "Empieza en el banquillo.";
      if (aplazado) nowTxt = lin ? `Iba de titular${linPos ? `, de ${linPos}` : ""}.` : "Iba al banquillo.";
      if (prior.partidos > 0) {
        counts = countsOf(prior);
        seasonLabel = "En la temporada";
      } else seasonNote = pendiente ? `Sin acta, ${jj} todavía no le cuenta minutos.` : `${I.seasonName ? `${I.seasonName}: ${jj}` : jj.charAt(0).toUpperCase() + jj.slice(1)} es su primer partido.`;
    } else {
      const bits: string[] = [];
      if (mins) bits.push(`${mins}′ jugados`);
      if (gl) bits.push(plural(gl, "gol", "goles"));
      if (as) bits.push(plural(as, "asistencia", "asistencias"));
      if (upTo.some((p) => p.k === "parada" && p.who === cid)) bits.push("un penalti parado");
      if (upTo.some((p) => p.k === "tarjeta" && p.who === cid)) bits.push("una amarilla");
      if (upTo.some((p) => p.k === "roja" && p.who === cid)) bits.push("una roja");
      if (upTo.some((p) => p.k === "penalti" && p.who === cid)) bits.push("un penalti en contra");
      const Lg = I.ledger?.[cid] as (Participation & Partial<TechnicalStats>) | undefined;
      if (Lg && m >= D) {
        if (Lg.passes) bits.push(`${Lg.passesCompleted ?? 0} de ${Lg.passes} pases buenos`);
        if (Lg.saves) bits.push(`${Lg.saves} paradas`);
        if (Lg.shots) bits.push(`${Lg.shots}${Lg.shots === 1 ? " remate" : " remates"}`);
      }
      const lead = m >= D ? "Esta noche: " : `Hasta el ${m}′: `;
      nowTxt = bits.length ? `${lead}${bits.join(" · ")}.` : m >= D ? "No llegó a salir." : "Aún no ha salido.";
      if (onSp && onSp.cameIn != null && m < D) metaBits.push(`en el campo desde el ${onSp.cameIn}′`);
      const segsC = tl.segsAt(cid, Math.max(m, 0.01));
      if (segsC.length > 1) nowTxt = `${nowTxt.replace(/\.$/, "")} · en ${segsC.length} tramos: ${tramos(segsC)}.`;
      seasonLabel = live || f === "final" ? "En la temporada, con esta noche" : "En la temporada";
      counts = countsOf({ partidos: prior.partidos + (mins ? 1 : 0), minutos: prior.minutos + mins, goles: prior.goles + gl, asistencias: prior.asistencias + as });
    }
    const where = !played ? (lin ? "En el siete" : "En el banquillo") : onSp ? (m >= D ? "Acabó en el campo" : `En el campo, minuto ${m}`) : "Desde el banquillo";
    const kicker = !isDef
      ? where
      : mine && isPlayer
        ? "Tú, en esta noche"
        : isMvp
          ? "El MVP"
          : cid === lastScorer
            ? R.loss && R.us === 1
              ? "El gol del Piti"
              : `El último gol, hasta el ${m}′`
            : cid === I.captain
              ? "El capitán"
              : where;
    const meta = metaBits.join(" · ");
    const guest = cid.startsWith("guest:");
    card = {
      id: cid,
      num: sq.num,
      name: sq.name,
      mine,
      mvp: isMvp,
      meta: meta.charAt(0).toUpperCase() + meta.slice(1),
      now: nowTxt,
      counts,
      seasonLabel,
      seasonNote,
      kicker,
      cls: isDef ? "is-default" : "is-picked",
      closable: !isDef,
      href: guest ? null : `/jugadores/${encodeURIComponent(cid)}`,
      go: mine ? "Ver mi ficha" : "Ver su ficha",
      closeLabel: `Cerrar la tarjeta de ${sq.name}`,
    };
  }

  // ---- who is out, the door, the notes
  const member = I.viewer.member;
  const showOut = member && (pre || aplazado) && I.out.length > 0;
  const note = pre
    ? ghost
      ? ""
      : `Cada uno, en su casilla de la pizarra (${sys}).`
    : aplazado
      ? "Cuando haya fecha nueva, el capitán vuelve a sacar el siete."
      : pendiente
        ? "Nadie arrancó el reloj en la mesa: el acta dirá quién jugó y cuánto."
        : live
          ? "Los cambios mueven el campo; los minutos son provisionales hasta el acta."
          : f === "final"
            ? "Minutos provisionales: el acta los confirma."
            : I.ledger
              ? `Minutos del acta, tramo a tramo.${I.partial ? " Provisionales: el relato narrado deja algún cambio aproximado." : ""}`
              : "Minutos calculados desde el siete inicial y cada entrada y salida.";
  const hint = ghost ? "" : played ? "Mueve la moviola y el campo vuelve a ese minuto. Toca a uno para ver su tarjeta." : "Toca a uno para ver su tarjeta.";
  const mvpWait = f === "acta" ? (member ? `El MVP se vota en el vestuario${I.voteLeft ? `: cierra en ${I.voteLeft}` : ""}.` : "El MVP sale cuando cierre la votación del vestuario.") : "";
  const benchNames = and(lineup.bench.map(name));
  const nConvo = new Set([...seven, ...lineup.bench]).size;
  const convoLine = `${aplazado ? `Convocados ${nConvo}, como estaba: ` : `Convocados ${nConvo}: `}el siete${lineup.bench.length ? ` y, en el banquillo, ${benchNames}` : ""}.`;

  return {
    cls: [pre ? "is-pre" : "", live ? "is-live" : "", doneView ? "is-done" : "", aplazado ? "is-aplazado" : "", pendiente ? "is-pendiente" : "", card?.closable ? "has-pick" : ""].filter(Boolean).join(" "),
    h,
    sub,
    hasSeg: doneView,
    view,
    pitchCls: [aplazado ? "is-dim" : "", ghost ? "is-ghost" : ""].filter(Boolean).join(" "),
    ghost,
    rings: ghost ? F7_SPOTS.slice(0, 7).map(([x, y]) => ({ left: clamp(x, 12, 88), top: clamp(Math.min(y, 90), 9, 88) - 3 })) : [],
    spots,
    leaving,
    listLabel: played ? (m >= D ? "Los siete al final" : `Los siete en el minuto ${m}`) : "Los siete",
    hint,
    card,
    mvpWait,
    mvpVote: f === "acta" && member,
    hasBench: !ghost,
    convo: !played && !ghost ? convoLine : null,
    benchT,
    bench,
    showOut,
    out: I.out.map((o) => ({ id: o.id, name: name(o.id), why: o.why })),
    showDoor: !member && (pre || aplazado),
    note,
    pizarra: member,
    stints,
    showChanges: played && !ghost,
    chT: rolling ? "Los cambios, jugador a jugador" : "Los minutos de cada uno",
    chSub: rolling ? `Cambios rotativos: cada uno entra y sale varias veces. La raya marca el minuto ${m}.` : "Desde el siete inicial y cada entrada y salida.",
    half,
    unused: unused.length ? `Sin jugar: ${and(unused)}.` : "",
    minNote: f === "final" ? "Minutos provisionales: el acta los confirma." : `Calculados desde el siete inicial y cada entrada y salida.${dragged ? ` La raya marca el minuto ${m}.` : ""}`,
  };
}

/** The tag's glyph (none for a card: its colour and its words say it). */
export const tagIcon = (k: Tag["k"]): "gol" | "asis" | "parada" | "cambio" | "star" | "pen" | null =>
  k === "gol" ? "gol" : k === "asis" ? "asis" : k === "parada" ? "parada" : k === "cambio" ? "cambio" : k === "mvp" ? "star" : k === "penalti" ? "pen" : null;
