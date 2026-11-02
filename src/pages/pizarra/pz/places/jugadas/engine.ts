// r14 «La pizarra» · Jugadas: the stateful side (the prototype's PJ engine in PiJugadas.dc.html, on the React store).
// One UI slice (`pj`: the step, playing, Ver/Editar, the selection, the library's search…), the device's replay
// settings, the stage writer (one writer: route + ui + edits; never from a render), the replay timer (one per page;
// runs follow their curves in sub-frames), and the edits of an own play (written to the board through act.saveBoard:
// undoable, toasted). A team play asks «Hacer mi copia» before it changes.
import type { PzApi } from "../../store/api";
import type { PzBoard, PzSlot } from "../../store/types";
import type { RoleKey } from "../../../formations";
import { playToData, type Play } from "../../../plays";
import { boardSeasonPlays, updateSeasonPlay, type SeasonPlay } from "../../../data/seasonPlays";
import { withSeasonPlay } from "../../../data/seasonPlayRefs";
import { strokePath } from "./drawView";
import {
  MAX_OWN,
  RATES,
  TAKER_K,
  clamp,
  cloneSteps,
  focusOf,
  frameSpec,
  fromSteps,
  keyStep,
  ownPlay,
  poseAt,
  r1,
  teamPlays,
  zoomOf,
  freeName,
  type PjPlay,
  type PjStep,
  type XY,
  boardBytes,
  sizeState,
  type SizeState,
} from "./jugadasView";

export interface PjUi {
  step: number;
  playing: boolean;
  anim: { from: number; to: number; t: number } | null;
  mode: "ver" | "editar";
  sel: string[];
  preview: string | null;
  q: string;
  type: string;
  confirmDel: boolean;
  vid: { url: string; at: string; err: string } | null;
  multi: boolean;
  lastId: string | null;
  /** The play open in the place (its id, "" = the library). */
  open: string | null;
  copyHot: boolean;
  dragFr: number | null;
  overFr: number | null;
  /** The steps being dragged (written to the board on release). */
  draft: { id: string; steps: PjStep[] } | null;
  cam0: string | null;
}
export const freshUi = (): PjUi => ({ step: 0, playing: false, anim: null, mode: "ver", sel: [], preview: null, q: "", type: "todas", confirmDel: false, vid: null, multi: false, lastId: null, open: null, copyHot: false, dragFr: null, overFr: null, draft: null, cam0: null });

export interface PjPrefs {
  rate: number;
  ghost: boolean;
  trails: boolean;
  rivals: boolean;
  ball: boolean;
  foco: boolean;
  cam: "grada" | "pizarra";
}
const PREF_KEY = "mp_pizarra_jugadas";
const DEF_PREFS: PjPrefs = { rate: 1, ghost: true, trails: true, rivals: true, ball: true, foco: true, cam: "grada" };
let prefsMem: PjPrefs | null = null;
/** The replay's speed and options, remembered on this device (A-JUG-25). */
export function pjPrefs(): PjPrefs {
  if (prefsMem) return prefsMem;
  let p = { ...DEF_PREFS };
  try {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem(PREF_KEY) : null;
    if (s) {
      const o = JSON.parse(s) as Partial<PjPrefs>;
      p = { ...p, ...o };
      if (!RATES.some((r) => r[0] === p.rate)) p.rate = 1;
    }
  } catch {
    /* storage blocked: the defaults */
  }
  prefsMem = p;
  return p;
}
export function setPjPrefs(patch: Partial<PjPrefs>): PjPrefs {
  prefsMem = { ...pjPrefs(), ...patch };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefsMem));
  } catch {
    /* storage blocked */
  }
  return prefsMem;
}

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────
export const ui = (P: PzApi) => P.slice<PjUi>("pj", freshUi);
export const U = (P: PzApi): PjUi => ui(P).get() ?? freshUi();
/** Change the UI (not undoable; re-renders every region). */
export const setUi = (P: PzApi, patch: Partial<PjUi>) => ui(P).set(patch, { undoable: false });

export const boardOf = (P: PzApi): PzBoard | null => P.sel.board();
export const slotsNow = (P: PzApi): PzSlot[] => P.sel.ver()?.slots ?? [];
export const canMake = (P: PzApi): boolean => {
  const b = boardOf(P);
  return !!b && P.sel.canEdit(b) && !P.sel.me().socia;
};
function takerPid(P: PzApi, role: RoleKey): string | null {
  const b = boardOf(P);
  const v = P.sel.ver();
  const k = TAKER_K[role];
  if (!b || !v) return null;
  let pid: string | null = null;
  if (k) {
    try {
      pid = P.sel.taker(b, v, k);
    } catch {
      pid = null;
    }
  }
  return pid ?? (b.lineup.roles as Partial<Record<RoleKey, string>>)[role] ?? null;
}
let teamCache: { key: string; plays: PjPlay[] } | null = null;
/** The team's plays for this seven (cached on the seven and the takers). */
export function team(P: PzApi): PjPlay[] {
  const slots = slotsNow(P);
  if (slots.length !== 7) return [];
  const tk = (["cornersId", "freekicksId"] as RoleKey[]).map((r) => takerPid(P, r) ?? "").join(",");
  const key = slots.map((s) => `${s.code}${s.x},${s.y}${s.playerId ?? ""}`).join(";") + "|" + tk;
  if (teamCache?.key === key) return teamCache.plays;
  const plays = teamPlays(slots, (r) => takerPid(P, r));
  teamCache = { key, plays };
  return plays;
}
const ownCache = new WeakMap<Play, { key: string; pj: PjPlay }>();

// ── the season's plays (seasonPlays/{id}; a board names the ones it uses in lineups.seasonPlays) ──────────────
/** What useSeasonPlays read (SeasonSync puts it here) and the edits not echoed back yet. */
const seasonReg = new WeakMap<object, { all: SeasonPlay[]; pending: Map<string, Play> }>();
function seasonOf(P: PzApi) {
  let r = seasonReg.get(P.state);
  if (!r) {
    r = { all: [], pending: new Map() };
    seasonReg.set(P.state, r);
  }
  return r;
}
export function setSeasonPlays(P: PzApi, all: SeasonPlay[]) {
  const r = seasonOf(P);
  r.all = all;
  // an edit is echoed once the read carries it
  for (const [id, pl] of r.pending) {
    const sp = all.find((x) => x.id === id);
    if (sp && JSON.stringify(playToData(sp.play)) === JSON.stringify(playToData({ ...pl, id }))) r.pending.delete(id);
  }
  ui(P).set({}, { undoable: false });
}
export const seasonAll = (P: PzApi): SeasonPlay[] => seasonOf(P).all;
/** The season plays this board uses (in its order) and the refs whose play is gone. */
export function boardSeason(P: PzApi): { plays: SeasonPlay[]; missing: string[] } {
  return boardSeasonPlays(boardOf(P)?.lineup.seasonPlays, seasonOf(P).all);
}

/** The board's own plays, read by slot, then the season plays it uses. */
export function own(P: PzApi): PjPlay[] {
  const b = boardOf(P);
  const slots = slotsNow(P);
  if (!b || slots.length !== 7) return [];
  const key = slots.map((s) => `${s.x},${s.y}${s.playerId ?? ""}`).join(";");
  const read = (pl: Play) => {
    const c = ownCache.get(pl);
    if (c && c.key === key) return c.pj;
    const pj = ownPlay(pl, slots);
    ownCache.set(pl, { key, pj });
    return pj;
  };
  const pend = seasonOf(P).pending;
  const season = boardSeason(P).plays.map((sp) => ({ ...read(pend.get(sp.id) ?? sp.play), id: sp.id, season: { id: sp.id, scope: sp.scope, ownerUid: sp.ownerUid, ownerNick: sp.ownerNickname } }));
  return [...(b.lineup.plays ?? []).map(read), ...season];
}
export const find = (P: PzApi, id: string | null | undefined): PjPlay | null => (id ? (own(P).find((p) => p.id === id) ?? team(P).find((p) => p.id === id) ?? null) : null);
export const curId = (P: PzApi): string => (P.state.route.place === "jugadas" ? P.state.route.sub || "" : "");
export const cur = (P: PzApi): PjPlay | null => find(P, curId(P));
/** A board play: the board is yours to edit. A season play: you made it, or you are a captain (any board). */
export const canEditPlay = (P: PzApi, pj: PjPlay | null): boolean => {
  if (!pj || !pj.own) return false;
  const m = P.sel.me();
  if (pj.season) return !m.socia && !m.fuera && (pj.season.ownerUid === m.uid || m.cap);
  return canMake(P);
};
/** The board's size against Firestore's 1 MiB. */
export const sizeOf = (P: PzApi): SizeState => sizeState(boardBytes(boardOf(P)?.lineup ?? null));
/** Nothing more can grow on this board (toast says why). */
export function fullBoard(P: PzApi, pj?: PjPlay | null): boolean {
  if (pj?.season) return false;
  if (sizeOf(P) !== "full") return false;
  P.toast("El tablero está casi lleno: quita jugadas, pasos o trazos que no uses para añadir más", { icon: "warn" });
  return true;
}
/** The steps on screen (the drag's draft while one is on). */
export function stepsOf(P: PzApi, pj: PjPlay): PjStep[] {
  const d = U(P).draft;
  return d && d.id === pj.id ? d.steps : pj.steps;
}
export function nameAt(P: PzApi, k: number): string {
  const s = slotsNow(P)[k];
  return s ? (s.playerId ? P.sel.name(s.playerId) : "El " + s.code) : "";
}
export function rivalInfo(P: PzApi): { name: string; code: string } {
  const M = P.sel.match();
  const name = M?.rival || "Rival";
  return { name, code: name === "Rival" ? "RIV" : name.slice(0, 3).toUpperCase() };
}
export function takerOf(P: PzApi, pj: PjPlay): { pid: string; k: "corners" | "freekicks" | "penalties"; on: boolean } | null {
  if (!pj.taker) return null;
  const k = TAKER_K[pj.taker.role];
  if (!k) return null;
  const pid = takerPid(P, pj.taker.role);
  return pid ? { pid, k, on: P.sel.placed().includes(pid) } : null;
}

// ── the stage (one writer) ──────────────────────────────────────────────────────────────────────────────
const reduced = () => {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
function zoomFor(P: PzApi, steps: PjStep[]) {
  return zoomOf(steps, { phone: P.state.layout === "phone", editing: U(P).mode === "editar" });
}
/** Writes the stage from the route, the UI and the play (dur: the glide of this frame, s). */
export function sync(P: PzApi, x: { pos?: { p: XY[]; r: XY[]; b: XY | null }; dur?: number; i?: number } = {}): void {
  if (P.state.route.place !== "jugadas") return;
  const u = U(P);
  const pr = pjPrefs();
  const riv = rivalInfo(P);
  const code = P.state.layout === "phone" ? "" : riv.code;
  const pj = cur(P);
  if (!pj) {
    const pv = find(P, u.preview) ?? find(P, u.lastId) ?? team(P)[0];
    if (!pv) {
      P.act.setStage({ source: "tokens", tokens: [], overlay: null, caption: "", zoom: null });
      return;
    }
    const steps = pv.steps;
    const k = keyStep(steps);
    const z = zoomFor(P, steps);
    P.act.setStage({ ...frameSpec(steps, k, { o: { ghost: true, trails: true, ball: true }, rivals: true, ball: true, rivalName: riv.name, rivalCode: code, short: !!z, draw: drawStep }), zoom: z });
    return;
  }
  const steps = stepsOf(P, pj);
  const i = clamp(x.i ?? u.step, 0, steps.length - 1);
  const edit = u.mode === "editar";
  const z = zoomFor(P, steps);
  const spec = frameSpec(steps, i, { pos: x.pos, dur: x.dur ?? 0.6, o: { ghost: edit || pr.ghost, trails: edit || pr.trails, ball: pr.ball }, rivals: pr.rivals || edit, ball: pr.ball || edit, rivalName: riv.name, rivalCode: code, short: !!z, draw: drawStep });
  P.act.setStage({ ...spec, zoom: z });
}

const drawStep = (s: Parameters<typeof strokePath>[0]) => strokePath(s, null);

// ── the replay ──────────────────────────────────────────────────────────────────────────────────────────
const timers = new WeakMap<object, ReturnType<typeof setTimeout>>();
const keyOf = (P: PzApi): object => P.state;
function stopTimer(P: PzApi) {
  const t = timers.get(keyOf(P));
  if (t) clearTimeout(t);
  timers.delete(keyOf(P));
}
function later(P: PzApi, fn: () => void, ms: number) {
  stopTimer(P);
  timers.set(keyOf(P), setTimeout(fn, ms));
}
const homeCam = (P: PzApi) => (U(P).cam0 === "pizarra" ? "pizarra" : U(P).cam0 === "grada" ? "grada" : pjPrefs().cam);
export function pause(P: PzApi, quiet = false) {
  const was = U(P).playing;
  stopTimer(P);
  setUi(P, { playing: false, anim: null });
  if (P.state.stage.camera === "foco") P.act.setCamera(homeCam(P));
  sync(P);
  if (was && !quiet) P.say("Pausa");
}
export function play(P: PzApi) {
  const pj = cur(P);
  if (!pj) return;
  if (U(P).mode === "editar") setMode(P, "ver");
  const steps = pj.steps;
  if (U(P).step >= steps.length - 1) {
    setUi(P, { step: 0 });
    sync(P);
  }
  const cam = P.state.stage.camera;
  setUi(P, { playing: true, cam0: cam !== "foco" ? (cam ?? null) : U(P).cam0 });
  const rt = RATES.find((r) => r[0] === pjPrefs().rate)?.[1] ?? "1×";
  P.say(`Reproduciendo «${pj.name}» a ${rt}${reduced() ? ". Movimiento reducido: paso a paso" : ""}`);
  later(P, () => advance(P), 650 / pjPrefs().rate);
}
function advance(P: PzApi) {
  const pj = cur(P);
  if (!pj || !U(P).playing) return;
  const steps = pj.steps;
  const n = steps.length;
  const rate = pjPrefs().rate;
  if (U(P).step >= n - 1) {
    setUi(P, { playing: false, anim: null });
    if (P.state.stage.camera === "foco") P.act.setCamera(homeCam(P));
    sync(P);
    P.say(`Fin de «${pj.name}»`);
    return;
  }
  const from = U(P).step;
  const to = from + 1;
  const a = steps[from];
  const b = steps[to];
  const D = (b.dur * 1000) / rate;
  const N = reduced() ? 1 : 8;
  const move = D * 0.7;
  const hold = D - move;
  const key = keyStep(steps);
  if (pjPrefs().foco && !reduced() && !zoomFor(P, steps)) {
    if (to === key) P.act.setCamera("foco", focusOf(steps, to));
    else if (P.state.stage.camera === "foco") P.act.setCamera(homeCam(P));
  }
  let j = 0;
  const frame = () => {
    if (!U(P).playing) return;
    j++;
    const t = j / N;
    const pos = poseAt(a, b, t);
    if (j < N) {
      setUi(P, { anim: { from, to, t } });
      sync(P, { pos, dur: move / N / 1000, i: to });
      later(P, frame, move / N);
    } else {
      setUi(P, { step: to, anim: null });
      sync(P, { pos, dur: move / N / 1000, i: to });
      P.say(`Paso ${to + 1} de ${n}: ${b.title}`);
      later(P, () => advance(P), hold);
    }
  };
  frame();
}
export const toggle = (P: PzApi) => (U(P).playing ? pause(P) : play(P));
export function goStep(P: PzApi, i: number, quiet = false) {
  const pj = cur(P);
  if (!pj) return;
  const n = pj.steps.length;
  const k = clamp(i, 0, n - 1);
  if (U(P).playing) stopTimer(P);
  setUi(P, { playing: false, anim: null, step: k, sel: [] });
  if (P.state.stage.camera === "foco") P.act.setCamera(homeCam(P));
  sync(P);
  if (!quiet) P.say(`Paso ${k + 1} de ${n}: ${pj.steps[k].title}`);
}
export function stopReplay(P: PzApi) {
  stopTimer(P);
}

// ── Ver · Editar (Editar: the pitch is the editor; the Dibujar dock's layer over the stage) ──────────────────
export function setMode(P: PzApi, m: "ver" | "editar") {
  const pj = cur(P);
  if (m === "editar") {
    if (!canMake(P)) {
      const b = boardOf(P);
      P.toast(b?.isOfficial ? "El oficial es de solo lectura: duplícalo para editar sus jugadas" : "Solo lectura: duplica el tablero para editar jugadas", { action: P.sel.me().socia ? null : { t: "Duplicar", run: () => P.act.duplicate() } });
      return;
    }
    stopTimer(P);
    setUi(P, { mode: "editar", sel: [], playing: false, anim: null });
    P.act.setCamera("pizarra");
    if (!P.state.drawing) P.act.setDrawing(true);
    P.say(pj && !pj.own ? "Editar: es del equipo, haz tu copia para cambiarla" : "Editar: arrastra una ficha para retocar el paso; el asa del medio curva su carrera");
  } else {
    setUi(P, { mode: "ver", sel: [], copyHot: false });
    if (P.state.drawing) P.act.setDrawing(false);
  }
  // the address says the mode too (a reload stays in it): `open` is set to the new route's key first, so onRoute
  // only syncs instead of reopening the play
  const id = P.state.route.sub || "";
  if (P.state.route.place === "jugadas" && id) {
    const paso = String(U(P).step + 1);
    const modo = m === "editar" ? "editar" : "";
    setUi(P, { open: id + "|" + modo + "|" + paso });
    P.act.go(`/pizarra/jugadas/${id}?${modo ? "modo=editar&" : ""}paso=${paso}`, { replace: true });
  }
  sync(P);
}

// ── edits of an own play ────────────────────────────────────────────────────────────────────────────────
/** Writes the steps of an own play to the board (undoable, toasted unless toast:false). */
export function saveSteps(P: PzApi, pj: PjPlay, steps: PjStep[], label: string, o: { toast?: boolean; long?: boolean; ids?: (string | null)[]; rivalIds?: string[]; name?: string; video?: Play["video"] | null; moment?: Play["moment"] | null } = {}): boolean {
  const b = boardOf(P);
  if (!b || !canEditPlay(P, pj)) {
    askCopy(P);
    return false;
  }
  let next = fromSteps(pj, steps, { ids: o.ids, rivalIds: o.rivalIds, name: o.name });
  if (o.video !== undefined) {
    next = { ...next };
    if (o.video) next.video = o.video;
    else delete next.video;
  }
  if (o.moment !== undefined) {
    next = { ...next };
    if (o.moment) next.moment = o.moment;
    else delete next.moment;
  }
  if (pj.season) return saveSeason(P, pj.season.id, pj.play, next, label);
  const plays = (b.lineup.plays ?? []).map((p) => (p.id === pj.id ? next : p));
  const ok = P.act.saveBoard({ plays }, label, { toast: o.toast, long: o.long });
  if (ok) sync(P);
  return ok;
}
/** A season play's new version (updateSeasonPlay): it changes on every board that uses it; undoable. */
function saveSeason(P: PzApi, id: string, before: Play, next: Play, label: string): boolean {
  const reg = seasonOf(P);
  const write = (pl: Play, what: string) => {
    reg.pending.set(id, pl);
    ui(P).set({}, { undoable: false });
    sync(P);
    updateSeasonPlay(id, pl).catch(() => {
      reg.pending.delete(id);
      ui(P).set({}, { undoable: false });
      sync(P);
      P.toast(`No se ha podido guardar ${what}: prueba otra vez`, { icon: "warn" });
    });
  };
  const prev = reg.pending.get(id) ?? before;
  write(next, "la jugada");
  P.pushUndo(
    `${label} · en todos los tableros que la usan`,
    () => write(prev, "el cambio"),
    () => write(next, "el cambio"),
    { toast: false },
  );
  return true;
}
/** «Usar en este tablero» / «Quitar de este tablero»: the board names (or stops naming) a season play. */
export function seasonOnBoard(P: PzApi, id: string, on: boolean, name: string): boolean {
  const b = boardOf(P);
  if (!b) return false;
  const refs = b.lineup.seasonPlays ?? [];
  let next: string[];
  try {
    next = withSeasonPlay(refs, id, on);
  } catch (e) {
    P.toast(e instanceof Error ? e.message : "Este tablero ya usa todas las que caben", { icon: "warn" });
    return false;
  }
  return P.act.saveBoard({ seasonPlays: next }, on ? `«${name}» ya está en este tablero` : `«${name}» ya no está en este tablero`, { long: !on });
}
/** The same steps with the ids a move needs: a slot of the seven not in the play joins it (its player's id). */
export function idsForMove(P: PzApi, pj: PjPlay, pieces: string[]): (string | null)[] | "hueco" {
  const ids = pj.ids.slice();
  const slots = slotsNow(P);
  for (const id of pieces) {
    if (id[0] !== "m") continue;
    const k = Number(id.slice(1));
    if (ids[k]) continue;
    const pid = slots[k]?.playerId;
    if (!pid) return "hueco";
    ids[k] = pid;
  }
  return ids;
}
export function askCopy(P: PzApi) {
  const pj = cur(P);
  if (!pj) return;
  setUi(P, { copyHot: true });
  if (!canMake(P)) {
    P.toast("Solo lectura: duplica el tablero para tener jugadas tuyas", { action: P.sel.me().socia ? null : { t: "Duplicar", run: () => P.act.duplicate() } });
    return;
  }
  P.toast(`«${pj.name}» es del equipo: haz tu copia para cambiarla`, { action: { t: "Hacer mi copia", run: () => makeCopy(P) } });
}
const newPlayId = () => "j" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
/** Adds an own play to the board (≤ 12) and opens it. */
function addOwn(P: PzApi, play: Play, label: string, then: string): boolean {
  const b = boardOf(P);
  if (!b) return false;
  if (!canMake(P)) {
    P.toast("Solo lectura: duplica el tablero para tener jugadas tuyas");
    return false;
  }
  const list = b.lineup.plays ?? [];
  if (fullBoard(P)) return false;
  if (list.length >= MAX_OWN) {
    P.toast(`Ya tienes ${MAX_OWN} jugadas en este tablero: borra una para guardar otra`, { icon: "warn" });
    return false;
  }
  const ok = P.act.saveBoard({ plays: [...list, play] }, label);
  if (ok) P.act.go(then);
  return ok;
}
/** «Hacer mi copia» of a team play: it becomes yours, the team's stays as it is. */
export function makeCopy(P: PzApi) {
  const pj = cur(P) ?? find(P, U(P).lastId);
  if (!pj) return;
  if (pj.own) {
    dupPlay(P);
    return;
  }
  const b = boardOf(P);
  const taken = (b?.lineup.plays ?? []).map((p) => p.name);
  const at = U(P).step;
  const ids = idsForMove(P, pj, []);
  const copy = fromSteps({ ...pj, play: { ...pj.play, id: newPlayId() } }, cloneSteps(pj.steps), { ids: ids === "hueco" ? pj.ids : ids, name: freeName(pj.name.slice(0, 33) + " (tuya)", taken) });
  copy.kind = pj.kind;
  setUi(P, { copyHot: false });
  addOwn(P, copy, `«${pj.name}» ya es tuya: la del equipo no se toca`, `/pizarra/jugadas/${copy.id}?modo=editar&paso=${at + 1}`);
}
export function dupPlay(P: PzApi) {
  const pj = cur(P);
  if (!pj) return;
  if (!pj.own) {
    makeCopy(P);
    return;
  }
  const b = boardOf(P);
  const taken = (b?.lineup.plays ?? []).map((p) => p.name);
  const c: Play = { ...structuredClone(pj.play), id: newPlayId(), name: freeName(pj.name.slice(0, 32) + " (copia)", taken) };
  delete c.video;
  addOwn(P, c, `Copia guardada: «${c.name}»`, `/pizarra/jugadas/${c.id}`);
}
/** «Nueva jugada»: two steps from where the seven stands, the rival's five, the ball at the keeper's feet. */
export function newPlay(P: PzApi) {
  const b = boardOf(P);
  if (!b || !canMake(P)) {
    P.toast("Solo lectura: duplica el tablero para crear jugadas");
    return;
  }
  const v = P.sel.ver();
  if (!v || !P.sel.placed().length) {
    P.toast("Coloca a alguien en el siete para crear una jugada", { action: { t: "Ir al siete", run: () => P.nav("/pizarra/siete") } });
    return;
  }
  const slots = v.slots;
  const p: XY[] = slots.map((s) => [s.x, s.y]);
  const r: XY[] = [
    [50, 6],
    [34, 24],
    [66, 24],
    [40, 42],
    [60, 42],
  ];
  const gk = p[slots.findIndex((s) => s.code === "POR")] ?? [50, 92];
  const ball: XY = [r1(gk[0] + 2), r1(gk[1] - 3)];
  const taken = (b.lineup.plays ?? []).map((x) => x.name);
  const name = freeName("Tu jugada " + ((b.lineup.plays ?? []).length + 1), taken);
  const steps: PjStep[] = [
    { title: "Salida", note: "", p, r, b: ball, dur: 2.3, c: {}, bk: null },
    { title: "Paso nuevo", note: "", p: p.map((q) => [q[0], q[1]] as XY), r: r.map((q) => [q[0], q[1]] as XY), b: [ball[0], ball[1]], dur: 2.6, c: {}, bk: null },
  ];
  const ids = slots.map((s) => s.playerId);
  const pj: PjPlay = { id: newPlayId(), name, kind: "propia", own: true, play: { id: "", name, kind: "propia", frames: [] }, ids, rivalIds: ["r1", "r2", "r3", "r4", "r5"], steps };
  pj.play.id = pj.id;
  addOwn(P, fromSteps(pj, steps), "Jugada nueva: mueve las fichas del paso 2", `/pizarra/jugadas/${pj.id}?modo=editar&paso=2`);
}
export function delPlay(P: PzApi) {
  const b = boardOf(P);
  const pj = cur(P);
  if (!b || !pj || !pj.own) return;
  setUi(P, { confirmDel: false });
  if (pj.season) {
    // (a season play is not deleted from here: it leaves this board, it stays in the season and on other boards)
    P.act.go("/pizarra/jugadas");
    seasonOnBoard(P, pj.season.id, false, pj.name);
    return;
  }
  const plays = (b.lineup.plays ?? []).filter((p) => p.id !== pj.id);
  P.act.go("/pizarra/jugadas");
  P.act.saveBoard({ plays }, `«${pj.name}» borrada`, { long: true });
}
export function editSteps(P: PzApi, label: string, fn: (steps: PjStep[]) => PjStep[] | null, o: { toast?: boolean; long?: boolean; goTo?: (n: number) => number; grow?: boolean } = {}): boolean {
  const pj = cur(P);
  if (!pj) return false;
  if (!canEditPlay(P, pj)) {
    askCopy(P);
    return false;
  }
  if (o.grow && fullBoard(P, pj)) return false;
  const next = fn(pj.steps);
  if (!next) {
    P.toast(`Una jugada tiene entre 2 y 8 pasos`);
    return false;
  }
  const ok = saveSteps(P, pj, next, label, o);
  if (ok && o.goTo) goStep(P, o.goTo(next.length), true);
  return ok;
}

// ── the route (the place opens a play, a step, a mode, a camera) ─────────────────────────────────────────
export function onRoute(P: PzApi) {
  const S = P.state;
  if (S.route.place !== "jugadas") return;
  const id = S.route.sub || "";
  const q = S.route.q || {};
  const u = U(P);
  const want = id && q.modo === "editar" && canMake(P) ? "editar" : "ver";
  const key = id + "|" + (q.modo ?? "") + "|" + (q.paso ?? "");
  if (u.open === key) {
    sync(P);
    return;
  }
  stopTimer(P);
  const pj = find(P, id);
  setUi(P, { open: key, playing: false, anim: null, sel: q.sel ? String(q.sel).split(",") : [], confirmDel: false, vid: null, copyHot: false, draft: null, step: q.paso ? Math.max(0, (parseInt(q.paso, 10) || 1) - 1) : 0, mode: want, ...(id && pj ? { lastId: id } : {}) });
  if (id && !pj && S.estado === "normal") P.toast("Esa jugada ya no está en este tablero", { icon: "warn" });
  if (want === "editar") {
    P.act.setCamera("pizarra");
    if (!S.drawing) P.act.setDrawing(true);
  } else {
    if (S.drawing) P.act.setDrawing(false);
    if (id && pj) {
      const c0 = q.camara || (zoomFor(P, pj.steps) ? "pizarra" : pjPrefs().cam);
      if (c0 === "foco") P.act.setCamera("foco", focusOf(pj.steps, clamp(U(P).step, 0, pj.steps.length - 1)));
      else P.act.setCamera(c0 === "grada" ? "grada" : "pizarra");
    } else if (!id) P.act.setCamera("pizarra");
  }
  sync(P);
}
