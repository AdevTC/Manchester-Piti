// La pizarra «Noche de partido» — la charla: the team talk before the match, as a running order on the
// pitch. Step 0 is the system; 1–7 present the seven one by one (slot order: the cromos flip face up);
// 8 is the banquillo (the suplentes of the convocatoria, or the available, with whether each one goes);
// 9 las pelotas paradas (who wears each galón: brazalete, penaltis, faltas, córners); 10 el plan (the
// consignas of the tactics, painted on the pitch); then every paso of the jugada; la quedada (the
// match's day, time and campo); and the last one, «¡A por ellos!». A small controller says which step is on screen and whether it plays
// (each step holds for its beat, as designed; prev / next / the timeline pause it; a hidden tab pauses it
// and the tab coming back resumes it), and what the broadcast graphics say at each step. Pure: the hook
// in useCharla.ts gives it a clock, the board draws it, and the 3D director (director.ts) films it.
import type { Lineup } from "../formations";
import type { Play } from "../plays";
import { defaultTactics } from "../tactics";
import { slotLabel } from "./geometry";
import { CONSIGNA } from "./plan";
import { GALONES, galonesOf, isFull, placedCount, type Cromo, type Squad } from "./model";
import { plural } from "./plural";
import { wavesTxt } from "./cambios";
import { orderTxt, ROLE_TAKER, takersOf } from "./takers";

/** El sistema, the first step. */
export const STEP_SISTEMA = 0;
/** Los suplentes, right after the seven. */
export const STEP_BANQUILLO = 8;
/** Las pelotas paradas: who takes what. */
export const STEP_BALON = 9;
/** El plan. */
export const STEP_PLAN = 10;
/** The first paso of the jugada. */
export const STEP_JUGADA = 11;
/** The last step («¡A por ellos!») of a charla whose jugada has `pasos` pasos (la quedada goes just before it). */
export const charlaLast = (pasos: number): number => STEP_JUGADA + Math.max(0, pasos) + 1;
/** La quedada: the step before «¡A por ellos!» (where the jugada's last paso hands over). */
export const stepQuedada = (last: number): number => last - 1;

export type StepKind = "sistema" | "siete" | "banquillo" | "balon" | "plan" | "jugada" | "quedada" | "final";

export function stepKind(step: number, last: number): StepKind {
  if (step <= STEP_SISTEMA) return "sistema";
  if (step < STEP_BANQUILLO) return "siete";
  if (step === STEP_BANQUILLO) return "banquillo";
  if (step === STEP_BALON) return "balon";
  if (step === STEP_PLAN) return "plan";
  if (step >= last) return "final";
  return step === stepQuedada(last) ? "quedada" : "jugada";
}

const MS: Record<StepKind, number> = { sistema: 2600, siete: 2300, banquillo: 3200, balon: 3000, plan: 4400, jugada: 2400, quedada: 3200, final: 2000 };

/** How long a step stays on screen while the charla plays (ms), as designed (the new steps read a list:
 *  a little longer). */
export function stepMs(step: number, last: number): number {
  return MS[stepKind(step, last)];
}

/** The longest the 3D stadium may take over a step it paces (ms): a stadium that never reports moves on
 *  by the clock, so a hung engine never freezes the charla. */
export const ENGINE_MAX_MS = 12000;

const clampStep = (i: number, last: number): number => Math.max(0, Math.min(last, Number.isFinite(i) ? Math.round(i) : 0));

// ───────────────────────────── the controller ─────────────────────────────

export interface CharlaState {
  step: number;
  playing: boolean;
  /** Paused because the tab went hidden: it plays again when the tab comes back. */
  resume: boolean;
}

/** The charla opens on the system and plays; with reduced motion it waits for each step (no clock). */
export const charla0 = (rm: boolean): CharlaState => ({ step: STEP_SISTEMA, playing: !rm, resume: false });

/** The clock's beat (or the 3D stadium reaching a step): on to `to` (the next one by default); the last
 *  step ends the charla's run. */
export function advance(s: CharlaState, last: number, to = s.step + 1): CharlaState {
  if (!s.playing) return s;
  const step = clampStep(to, last);
  return { ...s, step, playing: step < last };
}

/** Play / pause. Play at the end starts the charla over. With reduced motion there is no clock: the
 *  button walks the charla one step at a time (and back to the start from the end). */
export function toggle(s: CharlaState, last: number, rm: boolean): CharlaState {
  if (rm) return { step: s.step >= last ? STEP_SISTEMA : s.step + 1, playing: false, resume: false };
  if (s.playing) return { ...s, playing: false, resume: false };
  if (s.step >= last) return { step: STEP_SISTEMA, playing: true, resume: false };
  return { ...s, playing: true, resume: false };
}

/** Straight to a step (prev, next, the timeline): the charla pauses there. */
export const goTo = (i: number, last: number): CharlaState => ({ step: clampStep(i, last), playing: false, resume: false });

/** The tab went hidden: a playing charla pauses and remembers to go on. */
export const hide = (s: CharlaState): CharlaState => (s.playing ? { ...s, playing: false, resume: true } : s);
/** The tab is back: a charla paused by hiding plays again. */
export const show = (s: CharlaState): CharlaState => (s.resume ? { ...s, playing: true, resume: false } : s);

// ───────────────────────────── what it says ─────────────────────────────

/** The consignas the plan step shows, from the tactics (as designed: presión, línea, amplitud, salida). */
export interface Consigna {
  t: string;
  d: string;
  /** Entrance delay of its card. */
  dl: string;
}

export function consignas(L: Lineup): Consigna[] {
  const t = { ...defaultTactics(), ...L.tactics };
  return (["press", "defLine", "width", "buildup"] as const).flatMap((k, j) => {
    const c = CONSIGNA[k][t[k]];
    return c ? [{ t: c[0], d: c[1], dl: (j * 0.18).toFixed(2) + "s" }] : [];
  });
}

/** What the seven still lacks, said at the system step (null when it is a whole seven with a keeper). */
export function missingTxt(L: Lineup, sq: Squad): string | null {
  const n = placedCount(L);
  if (n === 0) return "El siete está vacío: colócalo (o «Sugerir siete») y la charla lo presenta.";
  if (n < 7) return (7 - n === 1 ? "Falta 1 en el siete" : "Faltan " + (7 - n) + " en el siete") + ": sus huecos salen en la charla.";
  if (!isFull(L, sq)) return "Sin portero en la portería: la charla lo avisa.";
  return null;
}

/** The match the charla is for («J8 · MAD SKY», «sáb 8 nov», «12:00», «J8»), or none linked. */
export interface CharlaMatch {
  short: string;
  date: string;
  time?: string;
  j?: string;
  /** Where: «En casa · Campo de la Mina» (empty / absent when the calendar doesn't say). */
  place?: string;
  /** Everyone the match's convocatoria calls (starters and banquillo); absent = no convocatoria yet. */
  called?: string[];
}

const CV_TXT = { voy: "va", duda: "duda", no: "no va" } as const;

/** Whether a player goes, in words (never by colour alone): «va», «duda», «no va», «lesionado», «sin responder». */
export function availTxt(c: Cromo): string {
  if (c.baja) return c.baja.toLowerCase();
  return c.cv ? CV_TXT[c.cv] : "sin responder";
}

// voy first, then who hasn't answered, the doubts, and those who can't
const AVAIL_ORDER = (c: Cromo): number => (c.baja ? 4 : c.cv === "voy" ? 0 : !c.cv ? 1 : c.cv === "duda" ? 2 : 3);

/** The suplentes: who the convocatoria calls and isn't in the seven; without a convocatoria, the squad
 *  off the pitch that can play (no bajas, nobody who said no). `fromConv` says which. */
export function suplentes(L: Lineup, sq: Squad, called: readonly string[] | undefined): { list: Cromo[]; fromConv: boolean } {
  const on = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  const fromConv = !!called?.length;
  const pool = fromConv
    ? called.filter((id, k) => called.indexOf(id) === k && !on.has(id)).flatMap((id) => sq.byId.get(id) ?? [])
    : sq.list.filter((c) => !on.has(c.id) && !c.baja && c.cv !== "no");
  return { list: pool.map((c, k) => ({ c, k })).sort((a, b) => AVAIL_ORDER(a.c) - AVAIL_ORDER(b.c) || a.k - b.k).map((x) => x.c), fromConv };
}

/** «KEVIN (va) · ERIK (duda) · … y 3 más». */
export function suplentesTxt(list: Cromo[], max = 8): string {
  const shown = list.slice(0, max).map((c) => c.name + " (" + availTxt(c) + ")");
  return shown.join(" · ") + (list.length > max ? " y " + (list.length - max) + " más" : "");
}

/** Who wears each galón of the dead ball (and the brazalete), as the charla says it: the dead balls in
 *  their order («TELLO › KEVIN»: the first on the pitch takes it), the brazalete with its vice. */
export function lanzadores(L: Lineup, sq: Squad): { label: string; letter: string; name: string | null; onPitch: boolean }[] {
  const on = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  const nm = (id: string) => sq.byId.get(id)?.name ?? "";
  const t = takersOf(L);
  return GALONES.map((g) => {
    const kind = ROLE_TAKER[g.key];
    const list = (kind ? t[kind] : [L.roles[g.key]]).filter((id): id is string => !!id && sq.byId.has(id));
    const vice = g.key === "captainId" && L.roles.viceId && sq.byId.has(L.roles.viceId) ? L.roles.viceId : null;
    const name = list.length ? orderTxt(list, nm) + (vice && vice !== list[0] ? " (vice: " + nm(vice) + ")" : "") : vice ? "vice " + nm(vice) : null;
    return { label: g.key === "captainId" ? "Brazalete" : g.label, letter: g.letter, name, onPitch: list.some((id) => on.has(id)) || (!!vice && on.has(vice)) };
  });
}

/** «Dom 8 nov · a las 12:00 · En casa · Campo de la Mina». */
export function quedadaTxt(m: CharlaMatch): string {
  const day = m.date ? m.date.charAt(0).toLocaleUpperCase("es") + m.date.slice(1) : "Fecha por confirmar";
  return [day, m.time ? "a las " + m.time : "", m.place ?? ""].filter(Boolean).join(" · ");
}

export interface CharlaArgs {
  L: Lineup;
  sq: Squad;
  step: number;
  /** The jugada of the charla and its short label («Córner»). */
  play: Play;
  playShort: string;
  match: CharlaMatch | null;
  /** The board's name (the title when no match is linked). */
  boardName: string;
  sysName: string;
  tacSum: string;
  /** The química (for the LED board). */
  qv: number;
  /** The 3D stadium films the charla. */
  in3d: boolean;
  playing: boolean;
  /** The board is still loading (a link straight to the charla): it waits for it. */
  loading?: boolean;
}

export interface LowerThird {
  n: string;
  nSm: boolean;
  k: string;
  t: string;
  d: string;
  gal: { l: string; t: string }[];
}

export interface CharlaView {
  last: number;
  kind: StepKind;
  /** The broadcast bug: «LA CHARLA · SÁB 8 NOV · 12:00» over «J8 · MAD SKY». */
  kick: string;
  title: string;
  /** «3/14» and what the step is («LOS SIETE»). */
  n: string;
  nk: string;
  /** The big word on the pitch (the system, «¡A POR ELLOS!»). */
  big: { txt: string; fin: boolean } | null;
  lt: LowerThird | null;
  plan: Consigna[] | null;
  /** The progress segments (relative widths, the running one animates for its beat). */
  segs: { w: string; t: string; cls: string }[];
  /** The running order (the sheet on desktop). */
  guion: { n: string; t: string; cls: string }[];
  /** The slot presented now (1–7), else -1. */
  hero: number;
  /** The jugada's paso on the pitch, else -1. */
  paso: number;
  /** The plan's cambios, one line per tanda («25′ · KEVIN por TELLO»), at the plan step (null = none). */
  cambios: string[] | null;
  /** The LED board over the pitch. */
  led: string;
  /** The 3D LED boards during the charla and at «¡A por ellos!». */
  board3d: { start: string[]; end: string[] };
}

const NK: Record<StepKind, string> = { sistema: "SISTEMA", siete: "LOS SIETE", banquillo: "BANQUILLO", balon: "BALÓN PARADO", plan: "EL PLAN", jugada: "JUGADA", quedada: "QUEDADA", final: "FINAL" };

/** The broadcast graphics of the charla at `step`. */
export function charlaView(a: CharlaArgs): CharlaView {
  const { L, sq, play, match } = a;
  const N = play.frames.length;
  const last = charlaLast(N);
  const cs = clampStep(a.step, last);
  const kind = stepKind(cs, last);
  const ms = match?.short ?? a.boardName;
  const when = match ? [match.date, match.time].filter(Boolean).join(" · ").toUpperCase() : "";
  const kick = "LA CHARLA" + (a.in3d ? " · ESTADIO 3D" : "") + (when ? " · " + when : "");
  let lt: LowerThird | null = null;
  let big: CharlaView["big"] = null;
  let plan: Consigna[] | null = null;
  if (kind === "sistema") {
    const miss = a.loading ? "Cargando el siete…" : missingTxt(L, sq);
    lt = { n: a.sysName, nSm: true, k: "EL SISTEMA · " + ms.toUpperCase(), t: "Así salimos", d: a.tacSum + "." + (miss ? " " + miss : ""), gal: [] };
    big = { txt: a.sysName, fin: false };
  } else if (kind === "siete") {
    const i = cs - 1;
    const id = L.slots[i]?.playerId ?? null;
    const c = id ? sq.byId.get(id) : undefined;
    const lab = slotLabel(L, i);
    if (id && c) {
      const st = c.stats;
      const why = c.cv === "no" ? " · dijo que no va" : c.baja ? " · " + c.baja.toLowerCase() : "";
      lt = {
        n: String(c.num),
        nSm: false,
        k: "LOS SIETE · " + cs + " DE 7 · " + lab,
        t: c.name,
        d: plural(st.played, "partido") + " · " + plural(st.goals, "gol", "goles") + " · " + st.assists + " asist. · forma " + c.rt + why,
        gal: galonesOf(L, id).map((g) => ({ l: g.letter, t: g.label })),
      };
    } else lt = { n: "–", nSm: false, k: "LOS SIETE · " + cs + " DE 7 · " + lab, t: "Hueco libre", d: "Falta un jugador en " + lab + ".", gal: [] };
  } else if (kind === "banquillo") {
    const s = suplentes(L, sq, match?.called);
    lt = {
      n: String(s.list.length),
      nSm: false,
      k: "EL BANQUILLO · " + (s.fromConv ? "CONVOCATORIA" : "SIN CONVOCATORIA: LOS DISPONIBLES"),
      t: "Los suplentes",
      d: s.list.length ? suplentesTxt(s.list) + "." : s.fromConv ? "La convocatoria no deja a nadie en el banquillo: los siete y a jugar." : "No queda nadie disponible fuera del siete.",
      gal: [],
    };
  } else if (kind === "balon") {
    const ls = lanzadores(L, sq);
    const set = ls.filter((x) => x.name).length;
    lt = {
      n: set + "/" + ls.length,
      nSm: true,
      k: "LAS PELOTAS PARADAS · QUIÉN LA TOCA",
      t: set ? "Los lanzadores" : "Sin lanzadores",
      d: set
        ? ls.map((x) => x.label + ": " + (x.name ? x.name + (x.onPitch ? "" : " (no está en el siete)") : "sin asignar")).join(" · ") + "."
        : "Nadie lleva galones: mantén pulsado un cromo para darle el brazalete, los penaltis, las faltas o los córners.",
      gal: ls.flatMap((x) => (x.name ? [{ l: x.letter, t: x.name }] : [])),
    };
  } else if (kind === "plan") plan = consignas(L);
  else if (kind === "quedada") {
    lt = match
      ? { n: match.j ?? "–", nSm: true, k: "LA QUEDADA · " + match.short.toUpperCase(), t: "Nos vemos allí", d: quedadaTxt(match) + ".", gal: [] }
      : { n: "–", nSm: true, k: "LA QUEDADA", t: "Sin partido enlazado", d: "Enlaza el partido en Tableros y aquí saldrán el día, la hora y el campo.", gal: [] };
  }
  else if (kind === "jugada") {
    const k = cs - STEP_JUGADA;
    const f = play.frames[k];
    lt = {
      n: k + 1 + "/" + N,
      nSm: true,
      k: "LA JUGADA · " + a.playShort.toUpperCase() + " · PASO " + (k + 1) + " DE " + N,
      t: f?.title || "Paso " + (k + 1),
      d: f?.note || (Object.keys(f?.players ?? {}).length ? "" : "Sin jugadores del siete en la jugada: colócalos en el Siete."),
      gal: [],
    };
  } else {
    lt = {
      n: match?.j ?? "¡YA!",
      nSm: true,
      k: (match ? [match.short, match.date, match.time].filter(Boolean).join(" · ") : "Manchester Piti · " + a.boardName).toUpperCase(),
      t: "¡A por ellos!",
      d: "Juntos. Como lo hemos hablado.",
      gal: [],
    };
    big = { txt: "¡A POR ELLOS!", fin: true };
  }
  const widths = Array.from({ length: last + 1 }, (_, k) => MS[stepKind(k, last)] / 1000);
  const segs = widths.map((w, k) => ({
    w: w.toFixed(1),
    t: w + "s",
    cls: k < cs ? "done" : k === cs ? (a.playing && cs < last && !a.in3d ? "cur" : "cur st") : "",
  }));
  const nm = (i: number) => {
    const id = L.slots[i]?.playerId;
    const c = id ? sq.byId.get(id) : undefined;
    return c ? c.num + " · " + c.name : "Hueco · " + slotLabel(L, i);
  };
  const nSup = suplentes(L, sq, match?.called).list.length;
  const steps = [
    "El sistema · " + a.sysName,
    ...Array.from({ length: 7 }, (_, i) => nm(i)),
    "Los suplentes · " + nSup,
    "Las pelotas paradas",
    "El plan · " + a.tacSum + (L.subs?.length ? " · " + plural(L.subs.length, "cambio") : ""),
    ...play.frames.map((f, k) => a.playShort + " · " + (k + 1) + " · " + (f.title || "Paso " + (k + 1))),
    "La quedada" + (match?.date ? " · " + match.date : ""),
    "¡A por ellos!",
  ];
  const guion = steps.map((t, k) => ({ n: k < 10 ? "0" + k : String(k), t, cls: k < cs ? "done" : k === cs ? "now" : "" }));
  return {
    last,
    kind,
    kick,
    title: ms,
    n: cs + 1 + "/" + (last + 1),
    nk: NK[kind],
    big,
    lt,
    plan,
    segs,
    guion,
    hero: kind === "siete" ? cs - 1 : -1,
    paso: kind === "jugada" ? cs - STEP_JUGADA : -1,
    cambios: kind === "plan" && L.subs?.length ? wavesTxt(L.subs, (id) => sq.byId.get(id)?.name ?? "Jugador") : null,
    led: "LA CHARLA · " + ms.toUpperCase() + " · " + a.sysName + " · QUÍMICA " + a.qv + " · ",
    board3d: { start: ["La charla", ms, "Sistema " + a.sysName, "Vamos Piti"], end: ["¡A por ellos!", "Manchester Piti", ms] },
  };
}

/** The 2D camera pushing in (the frame's transform): zoomed on (x, y) (frame %), kept inside the frame. */
export function pushIn(x: number, y: number, zoom: number, yc = 50): string {
  const lim = 50 - 50 / zoom;
  const tx = Math.max(-lim, Math.min(lim, 50 - x));
  const ty = Math.max(-lim, Math.min(lim, yc - y));
  return "scale(" + zoom + ") translate(" + tx.toFixed(2) + "%, " + ty.toFixed(2) + "%)";
}

/** The charla's jugada: the one picked in Jugadas, else the board's first own one, else the library's
 *  first (the córner). */
export function charlaJugada<T extends { own: boolean }>(list: T[], picked: T | null): T {
  return picked ?? list.find((j) => j.own) ?? list[0];
}
