// r14 «La pizarra» · Plan: the place's own logic (the prototype's PiPlan helpers): which parts are ready, what the
// pitch shows for each part (planStage), the set pieces, the rival's tokens and the edits as Lineup patches. Pure
// (reads the store through PlanReader-like selectors); the component writes with P.act.saveBoard.
import type { CondRuleR14 } from "../../../data/condPlan";
import { emptyParado, type BoardPlan, type KeyIcon, type Parado, type VizZone } from "../../../data/plan";
import { rivalVisible, type RivalPlan } from "../../../data/rival";
import { FORMATIONS, type FormationName, type Lineup } from "../../../formations";
import type { Play } from "../../../plays";
import { rivalSpots } from "../../../v2/rival";
import { runners, sinPositions } from "../../../v2/phases";
import { lineOf, type Line, type PosCode } from "../../../../../lib/positions";
import type { StyleId } from "../../../../../lib/tacticaSchemas";
import type { Layout, OverlayHandle, OverlayPath, PzBoard, PzPlay, PzVer, StageSpec, Token } from "../../store/types";
import { PARADO_KINDS, planOf, planRuleText, planStyle, rivalDanger, ruleConse, vizOf, type ParadoKind, type PlanPart, type PlanReader } from "./planView";
import type { PzApi } from "../../store/api";

// ── the place's UI state (a slice: not undoable, survives a re-render) ──────────────────────────────────────
export interface PlanUi {
  tab: "con" | "sin" | "fases";
  preview: StyleId | null;
  fase: number;
  fPlay: boolean;
  clave: number;
  editKey: number;
  kind: ParadoKind;
  step: number;
  playing: boolean;
  showPlay: boolean;
  tkOpen: boolean;
  focus: boolean;
  edit: { rid: string; chip: string } | null;
  showRule: string | null;
}
export const PLAN_UI0: PlanUi = { tab: "con", preview: null, fase: 0, fPlay: false, clave: 0, editKey: -1, kind: "corners", step: 0, playing: false, showPlay: false, tkOpen: false, focus: false, edit: null, showRule: null };

export const FASES = [
  { id: "plan", t: "El plan", s: "Como los has colocado en el siete." },
  { id: "salida", t: "Salida", s: "Sacamos desde atrás: los centrales se abren." },
  { id: "progresion", t: "Progresión", s: "Subimos juntos: los de banda, arriba." },
  { id: "bloque", t: "Bloque bajo", s: "Juntos atrás: entre líneas no cabe nadie." },
  { id: "presion", t: "Presión", s: "Saltamos a la vez: que no salgan jugando." },
] as const;
const FASE_BALL: Record<string, { x: number; y: number } | null> = { plan: null, salida: { x: 50, y: 89 }, progresion: { x: 72, y: 38 }, bloque: { x: 50, y: 33 }, presion: { x: 56, y: 9 } };

export const CONS: Record<string, { t: string; v: string[] }> = {
  buildup: { t: "Salida de balón", v: ["Corta", "Mixta", "En largo"] },
  tempo: { t: "Ritmo", v: ["Pausado", "Medio", "Rápido"] },
  attackFocus: { t: "Foco de ataque", v: ["Bandas", "Centro", "Equilibrado"] },
  width: { t: "Amplitud", v: ["Estrecha", "Media", "Amplia"] },
  mentality: { t: "Mentalidad", v: ["Defensiva", "Equilibrada", "Ofensiva"] },
  press: { t: "Presión", v: ["Repliegue", "Media", "Alta"] },
  defLine: { t: "Línea defensiva", v: ["Baja", "Media", "Alta"] },
};
export const CON_KEYS = ["buildup", "tempo", "attackFocus", "width", "mentality"] as const;
export const SIN_KEYS = ["press", "defLine"] as const;
/** What each consigna means, in a title and a line (the prototype's W.consigna). */
export const CONSIGNA: Record<string, Record<string, [string, string]>> = {
  press: { Alta: ["Presión alta", "Mordemos arriba: que no salgan jugando."], Media: ["Presión media", "Esperamos en el medio y saltamos juntos."], Repliegue: ["Repliegue", "Juntos atrás y a la contra."] },
  defLine: { Alta: ["Línea alta", "Los centrales cerca del medio: campo corto."], Media: ["Línea media", "Ni encima del portero ni a la espalda."], Baja: ["Línea baja", "Cerca del área, sin espacio a la espalda."] },
  width: { Amplia: ["Campo grande", "Las bandas pegadas a la cal."], Media: ["Amplitud media", "Abrimos sin perder el centro."], Estrecha: ["Juntos por dentro", "Cerramos el centro y salimos por dentro."] },
  buildup: { Corta: ["Salida corta", "El portero a los centrales, siempre al pie."], Mixta: ["Salida mixta", "Corta si se puede, larga si aprietan."], "En largo": ["En largo", "Al 9 y a por la segunda jugada."] },
  mentality: { Defensiva: ["Primero, no encajar", "Bloque junto y a la contra."], Equilibrada: ["Equilibrados", "Siempre dos por detrás del balón."], Ofensiva: ["A por el partido", "Todos arriba: el portero hace de líbero."] },
  tempo: { Pausado: ["Balón quieto", "Tocamos y esperamos el hueco."], Medio: ["Ritmo medio", "Dos toques y cambio de orientación."], Rápido: ["A un toque", "Robo y vertical, sin pensarlo."] },
  attackFocus: { Bandas: ["Por fuera", "Abrimos a banda y centro atrás."], Centro: ["Por dentro", "Paredes en la frontal."], Equilibrado: ["Por todo el frente", "Donde haya espacio, sin prisa."] },
};

export const KEY_ICON_NAMES: [KeyIcon, string][] = [
  ["spark", "Chispa"],
  ["eye", "Ojo"],
  ["ball", "Balón"],
  ["shield", "Escudo"],
  ["users", "Juntos"],
  ["flag", "Bandera"],
];
export const VIZ: { id: VizZone; t: string; paths?: OverlayPath[] }[] = [
  { id: "nada", t: "Nada" },
  { id: "arriba", t: "Presión arriba", paths: [{ kind: "zona", pts: [[8, 10], [92, 10], [92, 36], [8, 36]], label: "Aquí mordemos" }] },
  { id: "su7", t: "Su peligroso" },
  { id: "medio", t: "El medio", paths: [{ kind: "zona", pts: [[20, 38], [80, 38], [80, 58], [20, 58]], label: "El medio es nuestro" }] },
  { id: "atras", t: "Juntos atrás", paths: [{ kind: "zona", pts: [[14, 62], [86, 62], [86, 84], [14, 84]], label: "Juntos atrás" }] },
  { id: "bandas", t: "Por las bandas", paths: [{ kind: "carrera", pts: [[14, 66], [10, 22]], label: "Banda" }, { kind: "carrera", pts: [[86, 66], [90, 22]], label: "Banda" }] },
  { id: "centro", t: "Centro atrás", paths: [{ kind: "carrera", pts: [[84, 66], [90, 20]] }, { kind: "pase", pts: [[90, 18], [54, 15]], label: "Atrás, al punto de penalti" }] },
];
export const IDEAS = ["Presión alta los diez primeros minutos", "Juntos atrás cuando la pierdan", "Centros atrás, nunca colgados", "Por las bandas: campo grande"];
export const MISS_T: Record<string, [string, string]> = { rival: ["el rival", "falta"], claves: ["las claves", "faltan"], juego: ["el estilo", "falta"], parado: ["las pelotas paradas", "faltan"], sipasa: ["el «si pasa…»", "falta"] };
const PLAY_KIND: Record<"corners" | "freekicks", Play["kind"]> = { corners: "corner", freekicks: "falta" };

// ── reading ────────────────────────────────────────────────────────────────────────────────────────────────
export const titular = (P: PlanReader, b: PzBoard | null): PzVer | null => (b ? P.sel.ver(b, "titular") : null);
export const paradoOf = (L: Lineup | null | undefined): Parado => L?.plan?.parado ?? emptyParado();
/** The board's plays a set piece can run: its own, then the built-in library (+ the season's the page read). */
export const playsFor = (k: "corners" | "freekicks", all: readonly Play[]): Play[] => all.filter((p) => p.kind === PLAY_KIND[k]);
export const playById = (all: readonly Play[], id: string | null | undefined): Play | null => (id ? (all.find((p) => p.id === id) ?? null) : null);

/** The set piece is ready: someone on the seven takes it (and, for corners and free kicks, a play is linked). */
export function setOk(P: PlanReader, b: PzBoard | null, k: ParadoKind): boolean {
  const v = titular(P, b);
  if (!b || !v) return false;
  const tk = P.sel.taker(b, v, k);
  return k === "penalties" ? !!tk : !!(tk && paradoOf(b.lineup)[k].playId);
}
export function paradoGap(P: PlanReader, b: PzBoard | null): string[] {
  const out: string[] = [];
  const v = titular(P, b);
  PARADO_KINDS.forEach((k) => {
    const tk = b && v ? P.sel.taker(b, v, k) : null;
    const all = k === "corners" ? "los córners" : k === "freekicks" ? "las faltas" : "los penaltis";
    if (!tk) out.push("quién tira " + all);
    else if (k !== "penalties" && !paradoOf(b?.lineup)[k].playId) out.push("la jugada de " + all);
  });
  return out;
}
export interface PartsStatus {
  st: Record<PlanPart, boolean>;
  miss: Exclude<PlanPart, "notas">[];
  done: number;
}
export function partsStatus(P: PlanReader, b: PzBoard | null = P.sel.board()): PartsStatus {
  const L = b?.lineup;
  const pl = planOf(L);
  const st: Record<PlanPart, boolean> = {
    rival: !!L?.rival,
    claves: pl.claves.length > 0,
    juego: !!(L && (L.style || L.shapeOff)),
    parado: !!b && PARADO_KINDS.every((k) => setOk(P, b, k)),
    sipasa: (L?.condPlan ?? []).length > 0,
    notas: !!pl.notes,
  };
  const miss = (["rival", "claves", "juego", "parado", "sipasa"] as const).filter((k) => !st[k]);
  return { st, miss, done: 5 - miss.length };
}

// ── the pitch ──────────────────────────────────────────────────────────────────────────────────────────────
type PTok = Token & { line: Line };
const cx = (x: number) => Math.round(Math.max(7, Math.min(93, x)) * 10) / 10;
const cy = (y: number) => Math.round(Math.max(5, Math.min(95, y)) * 10) / 10;
const lineOfCode = (code: string): Line => {
  try {
    return lineOf(code as PosCode);
  } catch {
    return "MED";
  }
};
export function baseTokens(P: PlanReader, b: PzBoard | null): PTok[] {
  const v = titular(P, b);
  if (!v) return [];
  return v.slots.map((s, i) => ({ id: "m" + i, kind: "us", ...(s.playerId ? { pid: s.playerId } : {}), x: s.x, y: s.code === "POR" ? Math.min(s.y, 89) : s.y, code: s.code, label: s.playerId ? P.sel.name(s.playerId) : "Falta " + s.code, line: lineOfCode(s.code) }));
}
const moved = (toks: PTok[], f: (t: PTok) => [number, number]): PTok[] =>
  toks.map((t) => {
    const r = f(t);
    return { ...t, x: cx(r[0]), y: cy(r[1]) };
  });
export const styleMove = (toks: PTok[], mv: { DEF: number; MED: number; DEL: number; w: number }): PTok[] =>
  moved(toks, (t) => (t.line === "POR" ? [t.x, t.y] : [50 + (t.x - 50) * (mv.w || 1), t.y + (t.line === "DEF" ? mv.DEF : t.line === "MED" ? mv.MED : mv.DEL)]));
function faseMove(L: Lineup, toks: PTok[], id: string): PTok[] {
  const tac = L.tactics;
  const dl = tac.defLine === "Alta" ? -5 : tac.defLine === "Baja" ? 5 : 0;
  if (id === "salida") return moved(toks, (t) => (t.line === "POR" ? [50, 92] : t.line === "DEF" ? [50 + (t.x - 50) * 1.4, t.y + 5] : t.line === "MED" ? [t.x, t.y + 9] : [t.x, t.y + 4]));
  if (id === "progresion") return moved(toks, (t) => (t.line === "POR" ? [t.x, t.y - 6] : t.line === "DEF" ? [t.x, t.y - 14 + dl] : t.line === "MED" ? [50 + (t.x - 50) * 1.18, t.y - (Math.abs(t.x - 50) > 15 ? 22 : 14)] : [t.x, t.y - 6]));
  if (id === "bloque") return moved(toks, (t) => (t.line === "POR" ? [t.x, t.y] : t.line === "DEF" ? [50 + (t.x - 50) * 0.8, t.y + 6] : t.line === "MED" ? [50 + (t.x - 50) * 0.78, t.y + 16 + (tac.press === "Repliegue" ? 4 : 0)] : [50 + (t.x - 50) * 0.7, t.y + 20]));
  if (id === "presion") return moved(toks, (t) => (t.line === "POR" ? [t.x, t.y - 8] : t.line === "DEF" ? [t.x, t.y - 16 + dl] : t.line === "MED" ? [t.x, t.y - 20 - (tac.press === "Alta" ? 4 : 0)] : [t.x, t.y - 11]));
  return toks;
}
/** The shape without the ball (the board's own, else the one the pizarra proposes: v2/phases). */
export function offShape(L: Lineup, toks: PTok[]): { own: boolean; formation: FormationName; toks: PTok[] } {
  const at = sinPositions(L);
  return { own: !!L.shapeOff, formation: L.shapeOff?.formation ?? L.formation, toks: toks.map((t, i) => (at[i] ? { ...t, x: cx(at[i].u), y: cy(at[i].v) } : t)) };
}
/** «ALCIDES corre 24 m entre fases». */
export const runWarnings = (L: Lineup, name: (id: string) => string): string[] => runners(L).map((r) => name(r.id) + " corre " + r.m + " m entre fases");

function arrowsBetween(a: PTok[], c: PTok[], kind: OverlayPath["kind"] = "carrera"): OverlayPath[] {
  const out: OverlayPath[] = [];
  a.forEach((t, i) => {
    const d = t.pid ? c.find((x) => x.pid === t.pid && x.kind !== "ghost") : c[i];
    if (d && Math.abs(d.x - t.x) + Math.abs(d.y - t.y) > 5) out.push({ kind, pts: [[t.x, t.y], [d.x, d.y]] });
  });
  return out;
}
function freeX(toks: PTok[], y: number, need: number): number | null {
  let best = 50;
  let bd = -1;
  [50, 36, 64, 22, 78].forEach((x) => {
    const near = toks.filter((t) => Math.abs(t.y - y) < 14);
    const d = near.length ? Math.min(...near.map((t) => Math.abs(t.x - x))) : 99;
    if (d > bd) {
      bd = d;
      best = x;
    }
  });
  return bd >= need ? best : null;
}
const LINE_Y: Record<string, number> = { Alta: 60, Media: 70, Baja: 80 };
const low = (s: string | undefined, d: string) => String(s || d).toLowerCase();
function painted(L: Lineup, toks: PTok[], handle: OverlayHandle | null): OverlayPath[] {
  const tac = L.tactics;
  const out: OverlayPath[] = [];
  const py = tac.press === "Alta" ? 30 : tac.press === "Repliegue" ? 56 : 44;
  const dy = LINE_Y[tac.defLine] ?? 70;
  const lab = (y: number, t: string) => {
    const x = freeX(toks, y, 17);
    if (x != null) out.push({ kind: "lapiz", pts: [[x, y], [x, y]], label: t });
  };
  out.push({ kind: "lapiz", pts: [[6, py], [94, py]], color: "celeste" });
  lab(py + 4, "Presión " + low(tac.press, "media"));
  out.push({ kind: "lapiz", pts: [[6, dy], [94, dy]], color: "blanco", ...(handle ? { handle } : {}) });
  lab(dy - 3, "Línea " + low(tac.defLine, "media"));
  if (tac.attackFocus === "Centro") out.push({ kind: "flecha", pts: [[50, 52], [50, 26]] });
  else if (tac.attackFocus === "Bandas") out.push({ kind: "flecha", pts: [[16, 58], [12, 26]] }, { kind: "flecha", pts: [[84, 58], [88, 26]] });
  else out.push({ kind: "flecha", pts: [[30, 56], [26, 28]] }, { kind: "flecha", pts: [[70, 56], [74, 28]] });
  if (tac.buildup === "En largo") out.push({ kind: "pase", pts: [[50, 90], [50, 30]] });
  else out.push({ kind: "pase", pts: [[50, 92], [24, 76]] });
  return out;
}
/** Their seven as tokens (the shell's own siete source draws them itself). */
export function rivalTokens(r: RivalPlan | null | undefined, name: string): Token[] {
  if (!r) return [];
  const spots = rivalSpots(r);
  const code = name ? name.slice(0, 3).toUpperCase() : "";
  return r.players.map((p, k) => ({ id: "r" + k, kind: "rival", x: spots[k]?.x ?? 50, y: spots[k]?.y ?? 20, num: p.num ?? "", code, label: FORMATIONS[r.formation][k]?.position ?? "", note: p.note ?? "" }));
}
/** Where their danger man stands (their half, as the pitch draws them). */
export function dangerSpot(L: Lineup | null | undefined): { x: number; y: number } | null {
  const d = rivalDanger(L);
  const r = L?.rival;
  if (!d || !r) return null;
  const s = rivalSpots(r)[d.i];
  return s ? { x: s.x, y: s.y } : null;
}
function vizPaths(L: Lineup, zona: VizZone): OverlayPath[] {
  if (zona === "su7") {
    const d = rivalDanger(L);
    const s = dangerSpot(L);
    if (!d || !s) return [];
    return [{ kind: "zona", pts: [[s.x - 12, s.y - 9], [s.x + 12, s.y - 9], [s.x + 12, s.y + 9], [s.x - 12, s.y + 9]], label: (d.num != null ? "Su " + d.num : "Su " + d.code) + ": encima" }];
  }
  const z = VIZ.find((v) => v.id === zona);
  return z?.paths ? structuredClone(z.paths) : [];
}
function ruleTokens(P: PlanReader, b: PzBoard, r: CondRuleR14, layout: Layout): PTok[] {
  let toks = baseTokens(P, b);
  const vv = r.ver ? P.sel.ver(b, r.ver === "segunda" ? "segunda" : "planb") : null;
  if (vv && vv.exists) toks = vv.slots.map((s, i) => ({ id: "m" + i, kind: "us", ...(s.playerId ? { pid: s.playerId } : {}), x: s.x, y: s.y, code: s.code, label: s.playerId ? P.sel.name(s.playerId) : s.code, line: lineOfCode(s.code) }));
  const val = ruleConse(r).value;
  const mv = val === "Ofensiva" || val === "Alta" ? -6 : val === "Defensiva" || val === "Repliegue" || val === "Baja" ? 6 : 0;
  toks = moved(toks, (t) => (t.line === "POR" ? [t.x, t.y] : [t.x, t.y + mv]));
  const extra: PTok[] = [];
  const sub = r.sub && r.sub.out && r.sub.in ? r.sub : null;
  if (sub)
    toks = toks.map((t) => {
      if (t.pid !== sub.out) return t;
      if (layout !== "phone") extra.push({ id: "g-out", kind: "ghost", pid: sub.out, x: cx(t.x + (t.x <= 50 ? 24 : -24)), y: cy(t.y + 2), label: P.sel.name(sub.out), ring: "sale", line: t.line });
      return { ...t, pid: sub.in, label: P.sel.name(sub.in), ring: "entra" };
    });
  return [...toks, ...extra];
}
const clean = (t: PTok[]): Token[] => t.map(({ line: _l, ...x }) => x);

/** A board play as the pitch's `jugada` source reads it (by slot of the titular). */
export function toPzPlay(play: Play, v: PzVer | null): PzPlay {
  const slots = v?.slots ?? [];
  let last: [number, number][] = slots.map((s) => [s.x, s.y]);
  return {
    id: play.id,
    name: play.name,
    steps: play.frames.map((f) => {
      const p = slots.map((s, k): [number, number] => {
        const at = s.playerId ? f.players[s.playerId] : undefined;
        return at ? [at.x, at.y] : (last[k] ?? [s.x, s.y]);
      });
      last = p;
      return { title: f.title || "Paso", ...(f.note ? { note: f.note } : {}), p, r: f.rivals.map((r): [number, number] => [r.x, r.y]), b: [f.ball.x, f.ball.y] };
    }),
  };
}

export interface StageCtx {
  part: PlanPart;
  ui: PlanUi;
  layout: Layout;
  plays: readonly Play[];
  rivalName: string;
  /** The defensive line's handle on the pitch (editable boards only). */
  lineHandle: OverlayHandle | null;
}
/** What the pitch shows for the part on screen (the prototype's wantStage). */
export function planStage(P: PlanReader, c: StageCtx): StageSpec {
  const b = P.sel.board();
  const L = b?.lineup;
  const U = c.ui;
  const vis = rivalVisible(L?.rival);
  const w: StageSpec = { source: "siete", rival: vis, overlay: null, caption: "", editable: false, focus: null, camera: "pizarra", rivalName: "", tokens: [], ball: null, ghost: false };
  if (!b || !L) return w;
  if (c.part === "rival" && U.focus) {
    const d = rivalDanger(L);
    const s = dangerSpot(L);
    if (d && s) {
      w.camera = "foco";
      w.focus = { x: s.x, y: s.y };
      w.caption = (d.num != null ? "Su " + d.num : "Su " + d.code) + " · " + (d.note || d.code);
    }
  }
  if (c.part === "claves") {
    const pl = planOf(L);
    const i = Math.min(U.clave, pl.claves.length - 1);
    if (i >= 0) {
      w.overlay = { paths: vizPaths(L, vizOf(L, i).zona) };
      w.caption = pl.claves[i];
    }
  }
  if (c.part === "juego") {
    const base = baseTokens(P, b);
    let toks = base;
    let paths: OverlayPath[] = [];
    let ball: { x: number; y: number } | null = null;
    let cap = "";
    if (U.tab === "con") {
      const st = U.preview ? planStyle(U.preview) : null;
      if (st) {
        toks = styleMove(base, st.mv);
        paths = arrowsBetween(base, toks);
        cap = "Vista previa · " + st.t + " · Esc para volver";
      } else {
        paths = painted(L, base, c.lineHandle);
        cap = "Presión " + low(L.tactics.press, "media") + " (celeste) · línea " + low(L.tactics.defLine, "media") + " (blanca)";
      }
    } else if (U.tab === "sin") {
      const o = offShape(L, base);
      const dy = LINE_Y[L.tactics.defLine] ?? 70;
      toks = o.toks;
      paths = [...arrowsBetween(base, toks, "flecha"), { kind: "lapiz", pts: [[6, dy], [94, dy]], color: "blanco", ...(c.lineHandle ? { handle: c.lineHandle } : {}) }];
      cap = "Sin balón · " + o.formation + (o.own ? "" : " · propuesta") + " · línea " + low(L.tactics.defLine, "media");
    } else {
      const f = FASES[U.fase] ?? FASES[0];
      toks = faseMove(L, base, f.id);
      paths = arrowsBetween(base, toks);
      ball = FASE_BALL[f.id] ?? null;
      cap = "Fase · " + f.t;
    }
    const withRival = U.tab !== "con" && vis;
    w.source = "tokens";
    w.tokens = [...clean(toks), ...(withRival ? rivalTokens(L.rival, c.rivalName) : [])];
    w.rivalName = withRival ? c.rivalName : "";
    w.overlay = { paths };
    w.ball = ball;
    w.caption = cap;
  }
  if (c.part === "parado") {
    const k = U.kind;
    const pd = paradoOf(L);
    const v = titular(P, b);
    const pl = k !== "penalties" ? playById(c.plays, pd[k].playId) : null;
    if (pl && U.showPlay) {
      const pz = toPzPlay(pl, v);
      w.source = "jugada";
      w.play = pz;
      w.playId = pz.id;
      w.step = Math.min(U.step, pz.steps.length - 1);
      w.ghost = true;
      delete w.caption;
    } else {
      const tk = v ? P.sel.taker(b, v, k) : null;
      const bx = (k === "penalties" ? pd.penalties.rechace : pd[k].box).filter((x) => x !== tk);
      const SP: [number, number][] = k === "corners" ? [[42, 15], [58, 13], [50, 21], [66, 19]] : k === "freekicks" ? [[38, 13], [54, 11], [64, 16], [46, 19]] : [[30, 27], [70, 27]];
      const toks = moved(baseTokens(P, b), (t) => {
        const j = t.pid ? bx.indexOf(t.pid) : -1;
        if (t.pid && t.pid === tk) return k === "penalties" ? [50, 17] : k === "corners" ? [91, 9] : [50, 31];
        if (j >= 0 && SP[j]) return SP[j];
        if (t.line === "POR") return [50, 89];
        if (k === "penalties") return [t.x, 40 + (t.y - 22) * 0.25];
        return t.line === "DEF" ? [t.x, t.y - 6] : [t.x, Math.max(30, t.y - 10)];
      });
      const T = k === "corners" ? "Córners" : k === "freekicks" ? "Faltas" : "Penaltis";
      w.source = "tokens";
      w.tokens = clean(toks);
      w.ball = k === "penalties" ? { x: 50, y: 13 } : k === "corners" ? { x: 94, y: 5 } : { x: 50, y: 28 };
      w.overlay = null;
      w.caption = T + " · " + (tk ? P.sel.name(tk) : "sin lanzador") + (bx.length ? " · " + bx.length + (k === "penalties" ? " al rechace" : " al área") : "");
    }
  }
  if (c.part === "sipasa") {
    const rules = L.condPlan ?? [];
    const r = rules.find((x) => x.id === U.showRule) ?? rules[0];
    if (r) {
      const base = baseTokens(P, b);
      const toks = ruleTokens(P, b, r, c.layout);
      w.source = "tokens";
      w.tokens = clean(toks);
      w.overlay = { paths: arrowsBetween(base, toks.slice(0, base.length), "flecha") };
      w.ball = null;
      w.caption = "Si " + (r.when === "perdiendo" ? "perdemos" : r.when === "ganando" ? "ganamos" : "empatamos") + (r.from > 0 ? " desde el " + r.from + "′" : " desde el principio") + ": así quedaría";
    }
  }
  if (c.layout === "phone" && !(c.part === "juego" && U.preview)) w.caption = "";
  return w;
}

/** A stage value without functions, to compare (the handle's callbacks change every render). */
export function stageKey(s: unknown): string {
  return JSON.stringify(s ?? null, (_k, v: unknown) => (typeof v === "function" ? undefined : v)) ?? "null";
}
/** The stage on the pitch already shows `want` (every key `want` sets has the same value). */
export function stageHas(cur: StageSpec, want: StageSpec): boolean {
  return (Object.keys(want) as (keyof StageSpec)[]).every((k) => stageKey(cur[k]) === stageKey(want[k]));
}

/** Apply a «Si pasa…» rule now (the live match): its consigna to the board, and tell whoever listens. */
export function applyRule(P: PzApi, r: CondRuleR14): void {
  const b = P.sel.board();
  if (!b) return;
  const c = ruleConse(r);
  const label = "Plan aplicado: " + planRuleText(r, (id) => P.sel.name(id)).split(" → ")[1];
  if (c.key && c.value) P.act.saveBoard({ tactics: { ...b.lineup.tactics, [c.key]: c.value } }, label);
  else P.toast(label);
  P.emit("plan:aplicar", { rule: r, sub: r.sub ?? null, ver: r.ver ?? null });
}

// ── edits (the Lineup patch each one writes) ───────────────────────────────────────────────────────────────
/** The plan with its `viz` filled for every key (a stored viz is never guessed again). */
export function planFilled(L: Lineup): BoardPlan {
  const pl = planOf(L);
  return { claves: [...pl.claves], viz: pl.claves.map((_, i) => ({ ...vizOf(L, i) })), notes: pl.notes, parado: pl.parado ? structuredClone(pl.parado) : null };
}
export function withPlan(L: Lineup, fn: (p: BoardPlan) => void): { plan: BoardPlan } {
  const p = planFilled(L);
  fn(p);
  return { plan: p };
}
export function withParado(L: Lineup, fn: (p: Parado) => void): { plan: BoardPlan } {
  return withPlan(L, (p) => {
    if (!p.parado) p.parado = structuredClone(paradoOf(L));
    fn(p.parado);
  });
}
/** A rival copy that keeps r14's visible/danger (v2's setters drop them). */
export function keepR14(prev: RivalPlan, next: RivalPlan): RivalPlan {
  if (next === prev) return prev;
  const out: RivalPlan = { ...next, players: next.players.map((p) => ({ ...p })) };
  if (prev.visible === false) out.visible = false;
  if (typeof prev.danger === "number") out.danger = prev.danger;
  return out;
}
let ruleSeq = 0;
export const newRuleId = (): string => "c" + Date.now().toString(36) + (ruleSeq++).toString(36);
