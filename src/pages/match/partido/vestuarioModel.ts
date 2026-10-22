// «El partido» · Vestuario, pure (the P- boards' place-vestuario.js and component.js): what the viewer still has
// to do now (the tab's badge), the tab's second line, the order of the blocks (the most urgent first, in glass;
// the rest quieter and, on a phone, folded into «N más · Ver todo»), the porra's verdicts and tables, and the
// small words. No React, no Firebase: vestuarioState.ts reads the team's data and ScreenVestuario draws it.
import type { Fase, Score } from "./model";

export type Task = "rsvp" | "porra" | "caja" | "mvp" | "nota";
export type Block = "mesa" | "rsvp" | "porra" | "caja" | "ready" | "quedada" | "turnos" | "ausentes" | "live" | "team" | "mvp" | "nota" | "partido" | "res" | "paused" | "pend" | "pub" | "door";
export const BLOCKS: readonly Block[] = ["mesa", "rsvp", "porra", "caja", "ready", "quedada", "turnos", "ausentes", "live", "team", "mvp", "nota", "partido", "res", "paused", "pend", "pub", "door"];
export const TEAM_BLOCKS: readonly Block[] = ["quedada", "turnos", "ausentes", "team", "res", "pub"];

export const TASK_WORD: Record<Task, string> = { rsvp: "decir si vas", porra: "tu porra", caja: "la caja", mvp: "votar al MVP", nota: "la nota" };
const TASKH: Record<Task, [string, string]> = { rsvp: ["¿Vas? Aún no has respondido", "¿Vas?"], porra: ["Te falta la porra", "Tu porra"], caja: ["Te falta pagar la caja", "La caja"], mvp: ["Vota al MVP", "Vota al MVP"], nota: ["Ponle nota al partido", "Tu nota"] };

/** «a», «a y b», «a, b y c». */
export const andList = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
export const cap = (s: string): string => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
/** «2,0». */
export const comma = (x: number): string => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
/** «5 €», «2,50 €» (whole euros without cents, as the boards say them). */
export const euros = (cents: number): string => (cents % 100 === 0 ? `${cents / 100} €` : `${(cents / 100).toFixed(2).replace(".", ",")} €`);
export const dash = (p: { gf: number; ga: number }): string => `${p.gf}–${p.ga}`;

// ---------- the porra
export type Verdict = "exacta" | "cerca" | "lejos";
/** A pick against the score: exact, one goal off, or further. */
export function verdict(p: { gf: number; ga: number } | null, s: Score): Verdict | null {
  if (!p) return null;
  if (p.gf === s.us && p.ga === s.them) return "exacta";
  return Math.abs(p.gf - s.us) + Math.abs(p.ga - s.them) === 1 ? "cerca" : "lejos";
}
/** The big word: «La clavas» while it is played, «La clavaste» once it ended. */
export const verdictWord = (v: Verdict, ended: boolean): string => (ended ? { exacta: "La clavaste", cerca: "A un gol", lejos: "Esta vez no" } : { exacta: "La clavas", cerca: "A un gol", lejos: "No la clavas" })[v];

export interface TeamPick {
  uid: string;
  name: string;
  gf: number;
  ga: number;
  /** Points with the acta (done only). */
  points?: number;
}
export interface RankRow {
  uid: string;
  name: string;
  pick: string;
  me: boolean;
  v: string;
  cls: string;
}
/** «La porra del equipo»: while it is played (and before the acta) each pick's verdict at the minute, the
 *  closest first; with the acta, the points, the most first. */
export function teamRank(picks: readonly TeamPick[], sc: Score, opts: { done: boolean; ended: boolean; uid: string | null }): RankRow[] {
  const W: Record<Verdict, number> = { exacta: 0, cerca: 1, lejos: 2 };
  return picks
    .map((p) => {
      const vv = verdict({ gf: p.gf, ga: p.ga }, sc) ?? "lejos";
      const me = !!opts.uid && p.uid === opts.uid;
      const pts = p.points ?? 0;
      return {
        row: { uid: p.uid, name: p.name, pick: `${p.gf}–${p.ga}`, me, v: opts.done ? `${pts} ${pts === 1 ? "punto" : "puntos"}` : { exacta: opts.ended ? "la clavó" : "la clava", cerca: "a un gol", lejos: "lejos" }[vv], cls: `${me ? "is-me " : ""}is-${vv}` },
        w: opts.done ? -pts : W[vv],
        name: p.name,
      };
    })
    .sort((a, b) => a.w - b.w || a.name.localeCompare(b.name, "es"))
    .map((x) => x.row);
}

export interface DistRow {
  t: string;
  c: number;
  w: number;
  real: boolean;
  mine: boolean;
  cls: string;
}
/** «Nadie clavó el 1–8»: the picks the team made, the result's first, then the most repeated. */
export function porraDistribution(picks: readonly { gf: number; ga: number }[], real: Score, mine: { gf: number; ga: number } | null): { exact: number; rows: DistRow[] } {
  const n = new Map<string, number>();
  for (const p of picks) n.set(dash(p), (n.get(dash(p)) ?? 0) + 1);
  const rd = `${real.us}–${real.them}`;
  const md = mine ? dash(mine) : null;
  const keys = [...n.keys()].sort((a, b) => Number(b === rd) - Number(a === rd) || (n.get(b) ?? 0) - (n.get(a) ?? 0) || a.localeCompare(b));
  const max = Math.max(1, ...n.values());
  return {
    exact: n.get(rd) ?? 0,
    rows: keys.map((k) => {
      const c = n.get(k) ?? 0;
      return { t: k, c, w: Math.max(8, Math.round((c / max) * 100)), real: k === rd, mine: k === md, cls: [k === rd ? "is-real" : "", k === md ? "is-mine" : ""].filter(Boolean).join(" ") };
    }),
  };
}
/** «Brawan se lleva la jornada con 3: dijo 1–3.» (ties share it; nobody scoring says so). */
export function bestLine(table: readonly TeamPick[]): string {
  const top = Math.max(0, ...table.map((p) => p.points ?? 0));
  if (!table.length) return "";
  if (top <= 0) return "Nadie puntuó en esta jornada.";
  const best = table.filter((p) => (p.points ?? 0) === top);
  if (best.length === 1) return `${best[0].name} se lleva la jornada con ${top}: dijo ${best[0].gf}–${best[0].ga}.`;
  return `${andList(best.map((p) => p.name))} se llevan la jornada con ${top}.`;
}

// ---------- what the viewer still has to do, and the order of the blocks
export interface Who {
  member: boolean;
  /** A jugador of the squad (not the match's anotador). */
  isJ: boolean;
  /** The match's designated anotador. */
  isMesa: boolean;
}
export interface Pending {
  rsvp: boolean;
  porra: boolean;
  caja: boolean;
  mvp: boolean;
  nota: boolean;
}
/** The things to do, in the board's order: before the whistle ¿Vas?, the porra and the caja; with the acta the
 *  MVP, the nota and the caja. */
export function tasksOf(fase: Fase, w: Who, p: Pending): Task[] {
  if (!w.member) return [];
  const pre = fase === "antes" || fase === "pitido";
  const done = fase === "acta" || fase === "despues";
  const out: Task[] = [];
  if (pre) {
    if (p.rsvp) out.push("rsvp");
    if (p.porra) out.push("porra");
    if (p.caja) out.push("caja");
  } else if (done) {
    if (p.mvp) out.push("mvp");
    if (p.nota) out.push("nota");
    if (p.caja) out.push("caja");
  }
  return out;
}

export interface OrderIn {
  fase: Fase;
  who: Who;
  tasks: readonly Task[];
  /** «Vota al MVP» is on (the ballot): the despues MVP goes up too. */
  has: Partial<Record<Block, boolean>>;
}
/** The blocks shown, most urgent first (the board's order). `has` false drops a block that has nothing real. */
export function blockOrder({ fase, who, tasks, has }: OrderIn): Block[] {
  const B: Block[] = [];
  const add = (id: Block) => {
    if (has[id] === false || B.includes(id)) return;
    B.push(id);
  };
  const { member, isJ, isMesa } = who;
  const pre = fase === "antes" || fase === "pitido";
  const live = fase === "primera" || fase === "descanso" || fase === "segunda";
  const done = fase === "acta" || fase === "despues";
  if (!member) {
    if (done) add("pub");
    add("door");
  } else if (fase === "aplazado") add("paused");
  else if (fase === "pendiente") {
    if (isMesa) add("mesa");
    add("pend");
    if (isJ || isMesa) add("turnos");
  } else if (pre) {
    if (isMesa) add("mesa");
    for (const t of tasks) add(t);
    if (!tasks.length && !isMesa) add("ready");
    if (fase === "antes") add("quedada");
    add("rsvp");
    add("porra");
    if (isJ || isMesa) add("turnos");
    if (isJ) add("caja");
    if (fase === "antes") add("ausentes");
  } else if (live || fase === "final") {
    if (isMesa) add("mesa");
    add("live");
    add("team");
    if (isJ || isMesa) add("turnos");
  } else if (done) {
    for (const t of tasks) add(t);
    if (fase === "despues") add("mvp");
    add("partido");
    add("mvp");
    add("nota");
    add("res");
    add("team");
    if (isJ) add("caja");
    if (isJ || isMesa) add("turnos");
  }
  return B;
}

const LABEL = (isJ: boolean): Record<Block, string> => ({ mesa: "la mesa", rsvp: isJ ? "tu respuesta" : "la convocatoria", porra: "tu porra", caja: "la caja", quedada: "la quedada", turnos: "los turnos", ausentes: "los ausentes", team: "la porra del equipo", res: "la porra de la jornada", partido: isJ ? "tu partido" : "la mesa", mvp: "el MVP", nota: "la nota", live: "tu porra", pend: "el acta", ready: "lo tuyo", paused: "la pausa", pub: "el MVP", door: "la puerta" });
export const VIS = 2;
export interface Fold {
  /** Per block: shown, its CSS order, its classes. */
  b: Record<Block, { show: boolean; o: number; c: string }>;
  more: { show: boolean; o: number; n: number; what: string };
}
/** The CSS order and classes: the first in glass when it holds a control, the rest folded past VIS on a phone. */
export function foldOf(B: readonly Block[], opts: { open: boolean; tasky: Partial<Record<Block, boolean>>; isJ: boolean; gold: boolean }): Fold {
  const fold = B.length > VIS + 1;
  const b = {} as Fold["b"];
  for (const id of BLOCKS) {
    const i = B.indexOf(id);
    const c: string[] = [];
    if (i === 0) c.push(opts.tasky[id] ? "is-now vd-glass vd-glass--clear vd-orn" : "is-lead");
    if (fold && i >= VIS) c.push(opts.open ? "is-extra-open" : "is-extra");
    if (id === "mvp" && opts.gold) c.push("is-gold");
    b[id] = { show: i >= 0, o: i < 0 ? 99 : i < VIS ? i : i + 1, c: c.join(" ") };
  }
  const L = LABEL(opts.isJ);
  const extras = fold ? B.slice(VIS).map((id) => L[id]) : [];
  return { b, more: { show: fold, o: opts.open ? 98 : VIS, n: extras.length, what: andList(extras.slice(0, 3)) + (extras.length > 3 ? "…" : "") } };
}

/** The tab's second line (long, short), as component.js says it. */
export function hintOf(fase: Fase, who: Who, tasks: readonly Task[], live: { word: string } | null, winner: string | null): [string, string] {
  if (!who.member) return ["Solo el equipo", "Del equipo"];
  const pre = fase === "antes" || fase === "pitido";
  const playing = fase === "primera" || fase === "descanso" || fase === "segunda";
  if (who.isMesa && (pre || playing || fase === "final" || fase === "pendiente")) return ["Hoy anotas tú", "Anotas tú"];
  if (pre) return tasks.length ? TASKH[tasks[0]] : ["Lo tienes todo", "Todo hecho"];
  if (playing || fase === "final") return live ? [`Tu porra: ${live.word.toLocaleLowerCase("es")}`, live.word] : ["La porra del equipo", "La porra"];
  if (fase === "acta" || fase === "despues") return fase === "despues" && winner ? [`MVP: ${winner}`, "MVP"] : tasks.length ? TASKH[tasks[0]] : ["Votado y con nota", "Hecho"];
  return fase === "aplazado" ? ["Todo en pausa", "En pausa"] : ["La porra espera", "Sin acta"];
}
/** «2 cosas pendientes: votar al MVP y la nota». */
export const badgeTextOf = (tasks: readonly Task[]): string => (tasks.length ? `${tasks.length === 1 ? "1 cosa pendiente" : `${tasks.length} cosas pendientes`}: ${andList(tasks.map((t) => TASK_WORD[t]))}` : "");

const SUB: Record<Fase, string> = { antes: "Lo tuyo antes del pitido", pitido: "Lo último antes del pitido", primera: "Tu porra y la del equipo, en vivo", descanso: "Tu porra, al descanso", segunda: "Tu porra y la del equipo, en vivo", final: "Los puntos llegan con el acta", acta: "El MVP, la nota y la porra", despues: "", aplazado: "En pausa hasta la nueva fecha", pendiente: "En pausa hasta el acta" };
/** The screen's subtitle. */
export function subOf(fase: Fase, who: Who, tasks: readonly Task[], winner: string | null, mesaH: string): string {
  if (!who.member) return "Solo para el equipo";
  const s =
    tasks.length === 1
      ? `Te queda una cosa: ${TASK_WORD[tasks[0]]}`
      : tasks.length
        ? `Te quedan ${tasks.length} cosas: ${andList(tasks.map((t) => TASK_WORD[t]))}`
        : fase === "despues"
          ? `${winner ? `MVP: ${winner}` : "El MVP, a falta del recuento"} · la nota sigue abierta`
          : SUB[fase];
  const pre = fase === "antes" || fase === "pitido";
  const playing = fase === "primera" || fase === "descanso" || fase === "segunda";
  if (who.isMesa && (pre || playing || fase === "final" || fase === "pendiente")) return mesaH + (tasks.length ? ` · y ${TASK_WORD[tasks[0]]}` : "");
  return s;
}

/** The goleador picked for each goal of a porra (the board's one goleador and one asistencia for all of them). */
export function goalsOf(gf: number, scorer: string, assist: string): { playerId: string; assistPlayerId?: string }[] {
  if (!gf || !scorer) return [];
  return Array.from({ length: gf }, () => (assist && assist !== scorer ? { playerId: scorer, assistPlayerId: assist } : { playerId: scorer }));
}
