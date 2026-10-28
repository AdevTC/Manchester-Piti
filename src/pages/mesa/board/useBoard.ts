// La mesa (r12) · what the screen holds between taps: which screen and sheet are open, what the pitch is asking
// («¿Quién marcó?», «¿Y el pase?», a change, a play that needs its player), the status line with «Deshacer», the
// double taps of the clock and the press-and-hold of the acta. Every write goes through useMesa's actions (the
// offline queue, the clock and publish callables); every failure says why in the status line, on every screen
// (B-MESA-04/05/10), and no button sends twice while its call is in flight (B-MESA-09).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiError } from "../../../lib/clubApi";
import { RIVAL_GOAL_HOLD_MS } from "../api";
import { swap, type SwapDirection } from "../../../components/vidrio/transitions";
import { useMaqueta } from "../useMaqueta";
import type { SheetControl } from "./useSheetUrl";
import { buzz } from "../screens/hooks";
import type { MesaEvent, MesaType, MesaView } from "../types";
import { fairHalf, finBlockers, halfPlan, listOf, NO_HALF, plural, secondHalfUi, shownScore, upper, whyNot, type HalfUi, type Kind } from "./derive";

export type Screen = "antes" | "lista" | "juego" | "descanso" | "final" | "publicado" | "cronica" | "cerrada";
export type Sheet = "" | "jugador" | "mas" | "rival" | "reloj" | "revisar" | "editar" | "anotador" | "invitado";
export type Pick = "tarjeta" | "foul" | "chance" | "woodwork" | "foul_received" | "penalty_received" | "penalty_committed" | "goal_penalty" | "goal_freekick" | "penalty_missed" | "own_goal" | "injury";
export type Mode =
  | { k: "scorer"; ev: string; until: number }
  | { k: "assist"; ev: string; scorer: string; until: number }
  | { k: "in"; pid: string }
  | { k: "outFrom"; pid: string }
  | { k: "pickSub" }
  | { k: "hole"; pid: string }
  | { k: "pick"; act: Pick }
  | { k: "swap"; a: string | null; n: number; at: { elapsed: number; period: 1 | 2 } | null };
export type Undo = { k: "play"; id: string; play?: MesaEvent } | { k: "restore"; play: MesaEvent } | { k: "kick" } | { k: "second"; ids: string[] };
export interface Status {
  tag: string;
  msg: string;
  tone: "" | "gold" | "them" | "warn" | "error";
  undo?: Undo;
  act?: { t: string; go: () => void };
  at: number;
  /** The rival's goal: its push leaves at this time (M-33). */
  hold?: number;
}
export interface EditDraft {
  id: string;
  type: MesaType;
  p: string | null;
  a: string | null;
  inP: string | null;
  min: number;
  /** The minute it had (only a changed minute is sent). */
  min0: number;
}
export interface BoardUi {
  filter: Kind;
  edit: EditDraft | null;
  editErr: string;
  half: HalfUi;
  report: string;
  skipped: string[];
  guest: string;
  /** «Por revisar»: the minute being fixed per refused play. */
  reviewMin: Record<string, number>;
}
const FRESH_UI: BoardUi = { filter: "todo", edit: null, editErr: "", half: NO_HALF, report: "", skipped: [], guest: "", reviewMin: {} };
/** How long «¿Quién marcó?» / «¿Y el pase?» wait for a tap. */
export const ASK_MS = 14_000;
/** How long «Deshacer» stays on the line after a play. */
export const UNDO_MS = 60_000;
/** «¿Seguro? Toca otra vez». */
export const SURE_MS = 4_000;
/** Keep pressed to publish. */
export const HOLD_MS = 1_000;

const isMesaType = (t: string): t is MesaType => !!t;
const SHEETS = new Set<string>(["jugador", "mas", "rival", "reloj", "revisar", "editar", "anotador", "invitado"]);
/** How the boards travel between screens (PK.swap): the whistle into the match and the views of la mesa (the
 *  roll call, the crónica) slide; the half-time, the end and the acta change in place. */
export function travelOf(from: Screen, to: Screen): SwapDirection | null {
  if (from === to) return null;
  if (from === "antes" && to === "juego") return "right";
  if (to === "lista" || to === "cronica") return "right";
  if (from === "lista" || from === "cronica") return "left";
  return null;
}
const elapsedAt = (e: MesaEvent) => e.elapsedSeconds ?? Math.max(0, ((e.minute ?? 1) - 1) * 60 + 30);

export function screenFor(v: MesaView, vista: string | undefined, local: { lista: boolean; justPublished: boolean }): Screen {
  if (v.match.published && !local.justPublished) return "cerrada";
  if (vista === "cronica") return "cronica";
  switch (v.match.clock.phase) {
    case "ready":
      return local.lista ? "lista" : "antes";
    case "halftime":
      return "descanso";
    case "ended":
      return v.match.published ? "publicado" : "final";
    default:
      return "juego";
  }
}

export function useBoard(view: MesaView, vista: string | undefined, sheetCtl?: SheetControl) {
  const v = view;
  const vRef = useRef(v);
  useEffect(() => {
    vRef.current = v;
  });
  const [lista, setLista] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  // the open sheet: the address's (?hoja=&j=, useSheetUrl) on the page, its own state without one (the tests)
  const [local, setLocal] = useState<{ hoja: string; j: string | null }>({ hoja: "", j: null });
  const ctl: SheetControl = sheetCtl ?? { hoja: local.hoja, j: local.j, open: (h, j = null) => setLocal({ hoja: h, j }), close: () => setLocal({ hoja: "", j: null }), pushedSheet: () => false };
  const hoja = (SHEETS.has(ctl.hoja) ? ctl.hoja : "") as Sheet;
  const sel = hoja === "jugador" ? ctl.j : null;
  const [sub, setSub] = useState<"" | "tarjeta">("");
  const [mode, setModeState] = useState<Mode | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirm, setConfirm] = useState<{ k: string; until: number }>({ k: "", until: 0 });
  const [busy, setBusy] = useState("");
  const [holding, setHolding] = useState(0);
  const [flash, setFlash] = useState(0);
  const [ui, setUiState] = useState<BoardUi>(FRESH_UI);
  const busyRef = useRef("");
  const ctlRef = useRef(ctl);
  useEffect(() => {
    ctlRef.current = ctl;
  });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const target = screenFor(v, vista, { lista, justPublished });
  // the screen shown: it follows the match, through the boards' slide where they have one (View Transitions, a
  // crossfade with reduced motion; vidrio/transitions)
  const [screen, setScreen] = useState<Screen>(target);
  const travel = travelOf(screen, target);
  // (a change the boards don't animate happens at once, in this same render)
  if (screen !== target && !travel) setScreen(target);
  useEffect(() => {
    if (travel) swap(travel, () => setScreen(target));
  }, [travel, target]);
  // (an error belongs to the screen it happened on: a new screen starts with a clean line, B-MESA-09)
  const prevScreen = useRef(screen);
  useEffect(() => {
    if (prevScreen.current === screen) return;
    prevScreen.current = screen;
    setStatus((s) => (s && (s.tone === "error" || s.tone === "warn") ? null : s));
    setModeState(null);
    ctlRef.current.close();
  }, [screen]);

  const setUi = useCallback((p: Partial<BoardUi>) => setUiState((u) => ({ ...u, ...p })), []);
  const setMode = setModeState;
  const say = useCallback((tag: string, msg: string, tone: Status["tone"] = "", extra: Partial<Status> = {}) => setStatus({ tag, msg, tone, at: Date.now(), ...extra }), []);
  const fail = useCallback((msg: string) => say("No se ha guardado", msg, "error"), [say]);
  const failed = useCallback((e: unknown) => fail(apiError(e)), [fail]);
  const online = v.queue.online;
  const queueNote = () => (vRef.current.queue.online ? "subiendo" : "en el móvil, se sube sola");
  const minNow = () => vRef.current.match.clock.minute;
  const nameOf = (id: string | null | undefined) => (id ? vRef.current.nameOf(id) : "alguien");

  // the ask runs out: «Lo apunto luego» by itself
  useEffect(() => {
    if (!mode || !("until" in mode)) return;
    const t = window.setTimeout(() => {
      setModeState(null);
      if (mode.k === "scorer") say("Gol sin autor", "Por completar: Final te lo pedirá antes de firmar", "warn");
    }, Math.max(0, mode.until - Date.now()));
    return () => window.clearTimeout(t);
  }, [mode, say]);
  // the double tap of the clock forgets itself
  useEffect(() => {
    if (!confirm.k) return;
    const t = window.setTimeout(() => setConfirm({ k: "", until: 0 }), Math.max(0, confirm.until - Date.now()));
    return () => window.clearTimeout(t);
  }, [confirm]);
  // «Deshacer» only for a while
  useEffect(() => {
    if (!status?.undo) return;
    const t = window.setTimeout(() => setStatus((s) => (s === status ? { ...s, undo: undefined } : s)), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  const sure = (k: string) => {
    if (confirm.k === k && confirm.until > Date.now()) {
      setConfirm({ k: "", until: 0 });
      return true;
    }
    setConfirm({ k, until: Date.now() + SURE_MS });
    return false;
  };
  /** One call at a time per button (B-MESA-09): a second tap while it runs does nothing. */
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = key;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      failed(e);
    } finally {
      busyRef.current = "";
      setBusy("");
    }
  };

  // ---------- the plays
  const add = (type: MesaType, opts: { playerId?: string; inPlayerId?: string } = {}, at?: { elapsed: number; period: 1 | 2 }) => vRef.current.actions.add(type, opts, at);
  const golPiti = () => {
    const why = whyNot(vRef.current, "goal");
    if (why) return fail(why);
    buzz([40, 60, 140]);
    const id = add("goal");
    setFlash(Date.now() + 4000);
    closeSheet();
    say("Gol del Piti", `Minuto ${minNow()} · ya cuenta · el club recibe «¡Gol del Piti!»`, "gold", { undo: { k: "play", id } });
    setModeState({ k: "scorer", ev: id, until: Date.now() + ASK_MS });
  };
  const golTo = (pid: string, type: "goal" | "goal_penalty" | "goal_freekick" = "goal") => {
    const why = whyNot(vRef.current, type);
    if (why) return fail(why);
    buzz([40, 60, 140]);
    const id = add(type, { playerId: pid });
    setFlash(Date.now() + 4000);
    closeSheet();
    setSub("");
    const what = type === "goal" ? `Gol de ${nameOf(pid)}` : type === "goal_penalty" ? `Gol de penalti de ${nameOf(pid)}` : `Gol de falta de ${nameOf(pid)}`;
    say("Gol del Piti", `${what}, minuto ${minNow()} · el club recibe «¡Gol de ${nameOf(pid)}!»`, "gold", { undo: { k: "play", id } });
    if (type !== "goal_penalty") setModeState({ k: "assist", ev: id, scorer: pid, until: Date.now() + ASK_MS });
    else setModeState(null);
  };
  const setScorer = (ev: string, pid: string) => {
    setModeState({ k: "assist", ev, scorer: pid, until: Date.now() + ASK_MS });
    setStatus((s) => ({ ...(s ?? { at: Date.now() }), tag: `Gol de ${nameOf(pid)}`, msg: "¿Y el pase? Toca quién se la dio, o «Sin pase»", tone: "gold", at: Date.now() }));
    vRef.current.actions.edit(ev, { playerId: pid }).catch(failed);
  };
  const setAssist = (ev: string, scorer: string, pid: string | null) => {
    setModeState(null);
    setStatus((s) => ({ ...(s ?? { at: Date.now() }), tag: "Gol", msg: `Gol de ${nameOf(scorer)}${pid ? `, pase de ${nameOf(pid)}` : ", sin pase"} · ${queueNote()}`, tone: "gold", at: Date.now() }));
    vRef.current.actions.edit(ev, { assistPlayerId: pid ?? "" }).catch(failed);
  };
  const ownGoalTheirs = (ev: string) => {
    setModeState(null);
    setStatus((s) => ({ ...(s ?? { at: Date.now() }), tag: "Autogol suyo", msg: `Cuenta para el Piti · ${queueNote()}`, tone: "gold", at: Date.now() }));
    vRef.current.actions.edit(ev, { type: "opponent_own_goal", playerId: "" }).catch(failed);
  };
  const laterScorer = () => {
    setModeState(null);
    say("Gol sin autor", "Por completar: Final te lo pedirá antes de firmar", "warn", { undo: status?.undo });
  };
  const play = (type: MesaType, pid?: string) => {
    const cur = vRef.current;
    const why = whyNot(cur, type);
    if (why) return fail(why);
    let t: MesaType = type;
    const player = pid ? [...cur.field, ...cur.bench].find((p) => p.id === pid) : undefined;
    if (type === "yellow_card" && player?.stickers.yellow) t = "double_yellow";
    buzz(type === "opponent_goal" ? [220] : [25]);
    const id = add(t, pid ? { playerId: pid } : {});
    closeSheet();
    setSub("");
    setModeState(null);
    const text = eventWords(t, pid ? nameOf(pid) : "", cur.match.rival);
    const extra: Partial<Status> = { undo: { k: "play", id } };
    if (t === "injury" && pid) extra.act = { t: "¿Se va? Cambio", go: () => setModeState({ k: "outFrom", pid }) };
    if (t === "double_yellow") say("2ª amarilla", `${text} · su sitio queda en hueco`, "", extra);
    else say(tagOf(t), `${text}, minuto ${minNow()}${t === "red_card" ? " · su sitio queda en hueco" : ` · ${queueNote()}`}`, "", extra);
  };
  const rivalGoal = () => {
    const cur = vRef.current;
    const why = whyNot(cur, "opponent_goal");
    if (why) return fail(why);
    buzz([220]);
    const id = add("opponent_goal");
    closeSheet();
    setModeState(null);
    say(`Gol de ${cur.match.rivalShort}`, "", "them", { undo: { k: "play", id }, hold: Date.now() + RIVAL_GOAL_HOLD_MS });
  };
  const doSub = (out: string, inn: string, fromPlan = false) => {
    const cur = vRef.current;
    const why = whyNot(cur, "substitution");
    if (why) return fail(why);
    buzz([20, 40, 20]);
    const at = { elapsed: cur.match.clock.elapsedSeconds, period: cur.match.clock.period };
    const id = add("substitution", { playerId: out, inPlayerId: inn });
    const p = cur.field.find((x) => x.id === out) ?? cur.bench.find((x) => x.id === out);
    const word = placeWord(p?.pos ?? p?.vacancy?.code ?? null);
    setModeState(null);
    closeSheet();
    setSub("");
    say("Cambio", `Entra ${nameOf(inn)}, sale ${nameOf(out)} · ocupa su sitio: ${word}${fromPlan ? " · del plan de la pizarra" : ""}`, "", {
      undo: { k: "play", id },
      act: { t: "Recolocar", go: () => setModeState({ k: "swap", a: null, n: 0, at }) },
    });
  };
  const swapPair = (a: string, b: string, m: Extract<Mode, { k: "swap" }>) => {
    const why = whyNot(vRef.current, "position_swap");
    if (why) return fail(why);
    const id = add("position_swap", { playerId: a, inPlayerId: b }, m.at ?? undefined);
    say("Cambio de sitio", `${nameOf(a)} y ${nameOf(b)} se cambian el sitio · ¿alguien más?`, "", { undo: { k: "play", id } });
    setModeState({ ...m, a: null, n: m.n + 1 });
  };
  const assistLast = (pid: string) => {
    const g = [...vRef.current.events].reverse().find((e) => (e.type === "goal" || e.type === "goal_freekick") && e.playerId && e.playerId !== pid && !e.assistId && !e.assistReviewed && !e.dupOf);
    closeSheet();
    setSub("");
    if (!g?.playerId) return fail("No hay un gol nuestro sin pase al que ponérselo.");
    setAssist(g.id, g.playerId, pid);
  };

  // ---------- taps on the pitch and the bench, by what the pitch asks
  function openSheet(h: Sheet, j: string | null = null) {
    ctl.open(h, j);
  }
  function closeSheet() {
    setSub("");
    if (hoja) ctl.close();
  }
  const tapField = (pid: string) => {
    const m = mode;
    if (!m) {
      setSub("");
      return openSheet("jugador", pid);
    }
    if (m.k === "scorer") return setScorer(m.ev, pid);
    if (m.k === "assist") {
      if (pid === m.scorer) return;
      return setAssist(m.ev, m.scorer, pid);
    }
    if (m.k === "in") return doSub(pid, m.pid);
    if (m.k === "pickSub") return setModeState({ k: "outFrom", pid });
    if (m.k === "swap") {
      if (!m.a) return setModeState({ ...m, a: pid });
      if (m.a === pid) return setModeState({ ...m, a: null });
      return swapPair(m.a, pid, m);
    }
    if (m.k === "pick") {
      setModeState(null);
      if (m.act === "tarjeta") {
        setSub("tarjeta");
        return openSheet("jugador", pid);
      }
      if (m.act === "goal_penalty" || m.act === "goal_freekick") return golTo(pid, m.act);
      return play(m.act, pid);
    }
  };
  const tapBench = (pid: string) => {
    const m = mode;
    if (m && (m.k === "outFrom" || m.k === "hole")) return doSub(m.pid, pid);
    if (m && (m.k === "scorer" || m.k === "assist" || m.k === "swap" || m.k === "pick")) return;
    const p = vRef.current.bench.find((x) => x.id === pid);
    if (p?.sentOff) return;
    if (m?.k === "pickSub") return setModeState({ k: "in", pid });
    const why = whyNot(vRef.current, "substitution");
    if (why) return fail(why);
    setModeState(m?.k === "in" && m.pid === pid ? null : { k: "in", pid });
    closeSheet();
  };
  const tapHole = (pid: string) => {
    const m = mode;
    if (m?.k === "in") return doSub(pid, m.pid);
    setModeState(m?.k === "hole" && m.pid === pid ? null : { k: "hole", pid });
  };
  const pickFor = (act: Pick) => {
    const type: MesaType = act === "tarjeta" ? "yellow_card" : act;
    const why = whyNot(vRef.current, type);
    if (why) return fail(why);
    closeSheet();
    setModeState({ k: "pick", act });
  };
  const startSwap = (a: string | null) => {
    const c = vRef.current.match.clock;
    closeSheet();
    setModeState({ k: "swap", a, n: 0, at: { elapsed: c.elapsedSeconds, period: c.period } });
  };

  // ---------- «Deshacer»
  const undo = () => {
    const s = status;
    if (!s?.undo) return;
    const u = s.undo;
    const cur = vRef.current;
    const held = !!s.hold && s.hold > Date.now();
    setModeState(null);
    setFlash(0);
    closeSheet();
    if (u.k === "play") {
      const goal = s.tone === "gold" || s.tone === "them";
      const after = shownScore(cur);
      const ev = cur.events.find((e) => e.id === u.id);
      const was = ev?.goal === "us" ? { us: after.us - 1, them: after.them } : ev?.goal === "them" ? { us: after.us, them: after.them - 1 } : after;
      setStatus({ tag: "Deshecho", msg: held ? "El gol del rival no llegó a avisarse: nadie se ha enterado." : goal ? `Quitado. El club recibe «Gol anulado · ${was.us}–${was.them}».` : "Vuelve a estar como antes.", tone: "", at: Date.now() });
      cur.actions.remove(u.id).catch(failed);
      return;
    }
    if (u.k === "restore") {
      const e = u.play;
      setStatus({ tag: "Deshecho", msg: "La jugada vuelve a estar apuntada.", tone: "", at: Date.now() });
      if (!isMesaType(e.type)) return;
      cur.actions.add(e.type as MesaType, { ...(e.playerId ? { playerId: e.playerId } : {}), ...(e.inPlayerId ? { inPlayerId: e.inPlayerId } : {}) }, { elapsed: elapsedAt(e), period: e.period });
      return;
    }
    if (u.k === "kick")
      return void run("clock", async () => {
        await cur.actions.clock("reset");
        setStatus({ tag: "Deshecho", msg: "El pitido inicial no cuenta: el reloj vuelve a la previa.", tone: "", at: Date.now() });
      });
    if (u.k === "second")
      return void run("clock", async () => {
        for (const id of u.ids) await cur.actions.remove(id);
        await cur.actions.clock("undo_second");
        setStatus({ tag: "Deshecho", msg: u.ids.length ? `Vuelve el descanso: ${plural(u.ids.length, "cambio quitado", "cambios quitados")}.` : "Vuelve el descanso.", tone: "", at: Date.now() });
      });
  };

  // ---------- the clock (it needs the network: without it, it says so and nothing changes)
  const clockAct = (a: "pause" | "add+" | "add-" | "half" | "end" | "resume_first" | "reopen") => {
    const cur = vRef.current;
    const c = cur.match.clock;
    if (!cur.queue.online) return fail("Sin red: el reloj necesita conexión. No ha cambiado; vuelve a tocar cuando haya señal.");
    if (a === "pause")
      return void run("clock", async () => {
        await cur.actions.clock(c.held ? "resume" : "pause");
        if (c.held) say("Seguimos", "El reloj vuelve a correr");
        else say("Pausa", "El reloj está parado · en pausa solo cambios, tarjetas y tocados", "", { act: { t: "Seguir", go: () => clockAct("pause") } });
      });
    if (a === "add+" || a === "add-") {
      const v2 = Math.max(0, Math.min(15, c.added + (a === "add+" ? 1 : -1)));
      if (v2 === c.added) return;
      return void run("clock", async () => {
        await cur.actions.clock("added", v2);
        say("Añadido", v2 ? `+${v2}′ en la ${c.period}ª parte (es una etiqueta: el reloj no se mueve)` : "Sin añadido");
      });
    }
    if (a === "half") {
      if (!sure("half")) return;
      return void run("clock", async () => {
        await cur.actions.clock("halftime");
        const sc = shownScore(cur);
        say("Descanso", `La 1ª acabó en el ${Math.max(1, Math.ceil(c.elapsedSeconds / 60))}′ · el club recibe «Descanso · ${sc.us}–${sc.them}»`);
      });
    }
    if (a === "end") {
      if (!sure("end")) return;
      return void run("clock", async () => {
        await cur.actions.clock("finish");
        const sc = shownScore(cur);
        say("Final", `Pitido final · el club recibe «Final (provisional) · ${sc.us}–${sc.them}»`);
      });
    }
    if (a === "resume_first") {
      if (!sure("resume_first")) return;
      return void run("clock", async () => {
        await cur.actions.clock("resume_first");
        say("Vuelve la 1ª", "Seguimos en la 1ª parte donde se cortó; el rato del descanso no cuenta");
      });
    }
    if (a === "reopen") {
      if (!sure("reopen")) return;
      return void run("clock", async () => {
        await cur.actions.reopen();
        say("Reabierto", `Vuelve la ${c.period}ª en el ${Math.max(1, Math.ceil(c.elapsedSeconds / 60))}′: el rato del final no suma minutos`);
      });
    }
  };
  const kickOff = () => {
    const cur = vRef.current;
    if (busyRef.current) return;
    if (cur.field.length !== 7) return fail("Confirma los siete titulares antes de pitar el inicio.");
    if (!cur.queue.online) return say("Sin red", "El pitido necesita conexión: no se ha pitado. Vuelve a tocar cuando haya señal.", "error");
    buzz([70, 50, 260]);
    void run("kick", async () => {
      await cur.actions.clock("start");
      say("Pitido inicial", "El reloj ya corre · el club recibe «¡Empieza el partido!»", "", { undo: { k: "kick" } });
    });
  };
  const setDuration = (minutes: number) => {
    const m = Math.max(10, Math.min(150, Math.round(minutes)));
    void run("dur", async () => {
      await vRef.current.actions.setDuration(m);
      say("Duración", `El partido dura ${m}′: el «Fin» sugerido y la barra lo siguen`);
    });
  };

  // ---------- descanso
  const half = halfPlan(v.field, v.bench, ui.half);
  const toggleHalf = (id: string) => {
    const h = ui.half;
    if (half.base.includes(id)) setUi({ half: { ...h, drop: h.drop.includes(id) ? h.drop.filter((x) => x !== id) : [...h.drop, id] } });
    else setUi({ half: { ...h, add: h.add.includes(id) ? h.add.filter((x) => x !== id) : [...h.add, id] } });
  };
  const keeperHalf = (id: string) => setUi({ half: { ...ui.half, keeper: id } });
  const fair = () => setUi({ half: fairHalf(v.field, v.bench, half, v.match.present) });
  /** «Como en la pizarra»: the board's «2ª parte» as the seven of the 2ª (only offered when the board has one). */
  const boardSecond = () => {
    const s = secondHalfUi(vRef.current, half.base);
    if (s) setUi({ half: s });
  };
  const startSecond = () => {
    const cur = vRef.current;
    const plan = halfPlan(cur.field, cur.bench, ui.half);
    if (!plan.ok) return fail(plan.sel.length !== 7 ? `Elige el siete de la 2ª: van ${plan.sel.length} de 7.` : "Elige quién va de portero en la 2ª.");
    if (!cur.queue.online) return fail("Sin red: arrancar la 2ª necesita conexión. No se ha escrito nada.");
    buzz([20, 40, 60]);
    const firstEnd = cur.match.clock.elapsedSeconds;
    void run("second", async () => {
      // the whistle first: the changes are written only once the 2ª has started (B-MESA-05), at its first second
      await cur.actions.clock("second");
      const ids = plan.items.length ? cur.actions.addMany(plan.items, { elapsed: firstEnd, period: 2 }) : [];
      setUi({ half: NO_HALF });
      say("Arranca la 2ª", `${plan.pairs.length ? `${plural(plan.pairs.length, "cambio", "cambios")} escritos · ` : ""}el reloj corre desde el ${Math.round(firstEnd / 60)}′`, "", { undo: { k: "second", ids } });
    });
  };

  // ---------- final
  const blockers = finBlockers(v);
  const holdRef = useRef(0);
  const publish = () =>
    run("publish", async () => {
      const cur = vRef.current;
      const sc = shownScore(cur);
      await cur.actions.publish();
      buzz([30, 50, 30, 50, 160]);
      setJustPublished(true);
      say("Acta publicada", `A tu nombre (${cur.me.name}) · el club recibe «Final: Manchester Piti ${sc.us}–${sc.them} ${cur.match.rival}» y «Vota al MVP»`);
    });
  const holdStart = () => {
    if (holdRef.current || busyRef.current) return;
    const b = finBlockers(vRef.current);
    if (b.length) return fail(`Aún no se puede publicar: ${listOf(b)}.`);
    if (!vRef.current.queue.online) return say("Sin red", "Publicar necesita conexión: no se ha publicado.", "error");
    const at = Date.now();
    holdRef.current = at;
    setHolding(at);
    later(() => {
      if (holdRef.current !== at) return;
      holdRef.current = 0;
      setHolding(0);
      void publish();
    }, HOLD_MS);
  };
  const holdEnd = () => {
    if (!holdRef.current) return;
    holdRef.current = 0;
    setHolding(0);
    say("Sin publicar", "Mantenlo un segundo; no se ha publicado.");
  };
  const finScorer = (e: MesaEvent, pid: string) => {
    say("Goleador", `Gol del ${e.minute ?? ""}′: ${nameOf(pid)}`);
    vRef.current.actions.edit(e.id, { playerId: pid }).catch(failed);
  };
  const finPass = (e: MesaEvent, pid: string | null) => {
    say("Pase", `Gol del ${e.minute ?? ""}′: ${pid ? `pase de ${nameOf(pid)}` : "sin pase"}`);
    vRef.current.actions.edit(e.id, { assistPlayerId: pid ?? "" }).catch(failed);
  };

  // ---------- la crónica: correct and delete, with the reason visible when the server says no (B-MESA-04)
  const editOpen = (e: MesaEvent) => {
    if (!isMesaType(e.type)) return;
    const min = e.minute ?? 1;
    setUi({ edit: { id: e.id, type: e.type as MesaType, p: e.playerId, a: e.assistId, inP: e.inPlayerId, min, min0: min }, editErr: "" });
    openSheet("editar", e.id);
  };
  const editSave = async () => {
    const d = ui.edit;
    const cur = vRef.current;
    if (!d) return;
    const e = cur.events.find((x) => x.id === d.id);
    const stop = (msg: string) => {
      setUi({ editErr: msg });
      fail(msg);
    };
    if (!e) return stop("Esa jugada ya no está: alguien la ha borrado.");
    if (d.a && d.a === d.p) return stop("El pase no puede ser del mismo que marca.");
    if (d.type === "substitution") {
      const at = (d.min - 1) * 60 + 30;
      const people = [...cur.field, ...cur.bench];
      const onThen = (id: string) => {
        const p = people.find((x) => x.id === id);
        return !!p && p.stints.some((s) => s.from < at && (s.to === null || s.to > at) && !(id === e.inPlayerId && s.from === elapsedAt(e)));
      };
      if (d.inP && d.inP !== e.inPlayerId && onThen(d.inP)) return stop(`${nameOf(d.inP)} ya estaba en el campo en el ${d.min}′: «Entra» tiene que ser alguien del banquillo.`);
    }
    const patch = {
      ...(d.type !== e.type ? { type: d.type } : {}),
      ...((d.p ?? null) !== e.playerId ? { playerId: d.p ?? "" } : {}),
      ...((d.a ?? null) !== e.assistId ? { assistPlayerId: d.a ?? "" } : {}),
      ...((d.inP ?? null) !== e.inPlayerId ? { inPlayerId: d.inP ?? "" } : {}),
      ...(d.min !== d.min0 ? { elapsedSeconds: (d.min - 1) * 60 + 30 } : {}),
    };
    try {
      if (Object.keys(patch).length) await cur.actions.edit(d.id, patch);
      setUi({ edit: null, editErr: "" });
      closeSheet();
      say("Corregido", `${e.text} · minuto ${d.min}`);
    } catch (err) {
      stop(apiError(err));
    }
  };
  const remove = (id: string) => {
    const cur = vRef.current;
    const e = cur.events.find((x) => x.id === id);
    if (!e) return fail("Esa jugada ya no está: alguien la ha borrado.");
    closeSheet();
    setUi({ edit: null, editErr: "" });
    say("Borrado", `${e.text}${e.goal ? " · el club recibe «Gol anulado»" : ""}`, "", { undo: { k: "restore", play: e } });
    cur.actions.remove(id).catch(failed);
  };
  const dupSame = (e: MesaEvent) => {
    say("Resuelto", "Era la misma: cuenta una vez");
    vRef.current.actions.remove(e.id).catch(failed);
  };
  const dupTwo = (e: MesaEvent) => {
    say("Resuelto", "Eran dos: cuentan las dos");
    vRef.current.actions.edit(e.id, { dupOk: true }).catch(failed);
  };

  // ---------- antes: the touchline's own
  const addGuest = () => {
    const name = ui.guest.trim();
    if (!name) return fail("Escribe su nombre.");
    void run("guest", async () => {
      await vRef.current.actions.addGuest(name);
      setUi({ guest: "" });
      closeSheet();
      say("Invitado", `${name} entra en la lista y en la banda`);
    });
  };
  const addScorer = (uid: string, name: string) =>
    run("scorer", async () => {
      const cur = vRef.current;
      await cur.actions.setScorers([...new Set([...cur.scorers.map((s) => s.uid).filter((u) => u !== cur.me.uid || !cur.me.admin), uid])]);
      closeSheet();
      say("Anotador", `${name} ya puede anotar este partido · lo ve al instante`);
    });
  const saveReport = () => {
    const text = ui.report.trim();
    if (!text) return fail("Escribe al menos una línea.");
    void run("report", async () => {
      await vRef.current.actions.saveReport(text);
      say("Crónica", "Guardada: sale debajo del marcador en la web.");
    });
  };

  // ---------- keys (desktop): G R C T F Z, space for the pause, Esc
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (e.key === "Escape") {
      if (hoja) {
        e.preventDefault();
        return closeSheet();
      }
      if (mode) {
        e.preventDefault();
        return setModeState(null);
      }
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || hoja || screen !== "juego") return;
    const k = e.key.toLowerCase();
    if (k === "g") golPiti();
    else if (k === "r") rivalGoal();
    else if (k === "c") setModeState({ k: "pickSub" });
    else if (k === "t") pickFor("tarjeta");
    else if (k === "f") pickFor("foul");
    else if (k === "z") undo();
    else if (e.key === " " && t?.tagName !== "BUTTON") clockAct("pause");
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  const confirmK = confirm.k;
  // a sheet that came in with the address (a link, Adelante) without what it needs: «Corregir» gets its play, a
  // player's sheet a player still on the pitch; otherwise it closes
  const fromAddress = useRef<() => void>(() => undefined);
  useEffect(() => {
    fromAddress.current = () => {
      const cur = vRef.current;
      if (hoja === "jugador" && !cur.field.some((p) => p.id === sel)) return closeSheet();
      if (hoja === "editar" && ui.edit?.id !== ctl.j) {
        const e = cur.events.find((x) => x.id === ctl.j);
        if (!e || !isMesaType(e.type)) return closeSheet();
        const min = e.minute ?? 1;
        setUi({ edit: { id: e.id, type: e.type as MesaType, p: e.playerId, a: e.assistId, inP: e.inPlayerId, min, min0: min }, editErr: "" });
      }
    };
  });
  useEffect(() => {
    fromAddress.current();
  }, [hoja, ctl.j]);
  // (DEV only: the replay's ?gol starts «Gol del Piti» once, as the boards' hoja=gol)
  const maq = useMaqueta();
  const golOnce = useRef(false);
  const golRef = useRef(golPiti);
  useEffect(() => {
    golRef.current = golPiti;
  });
  useEffect(() => {
    if (!maq || golOnce.current || !maq.maquetaGol()) return;
    golOnce.current = true;
    golRef.current();
  }, [maq]);
  const skip = (x: { inId: string; outId: string }) => {
    setUi({ skipped: [...ui.skipped, x.outId + x.inId] });
    say("Plan", `Saltado: ${nameOf(x.inId)} por ${nameOf(x.outId)}. El plan sigue en la pizarra.`);
  };

  return {
      screen, hoja, sel, sub, mode, status, busy, holding, flash, ui, confirmK, blockers, half, online,
      setUi, setSub, setMode, setLista, openSheet, closeSheet, say, fail,
      golPiti, golTo, play, rivalGoal, change: doSub, swapStart: startSwap, assistLast, pickFor, laterScorer, ownGoalTheirs, setAssist,
      tapField, tapBench, tapHole, undo, clockAct, kickOff, setDuration,
      toggleHalf, keeperHalf, fair, boardSecond, startSecond, holdStart, holdEnd, finScorer, finPass,
      editOpen, editSave, remove, dupSame, dupTwo, addGuest, addScorer, saveReport, skip,
  };
}

/** The status line's tag for a play. */
function tagOf(t: MesaType): string {
  const TAG: Partial<Record<MesaType, string>> = {
    foul: "Falta", foul_received: "Le hacen falta", chance: "Ocasión", woodwork: "Al palo", yellow_card: "Amarilla", red_card: "Roja", injury: "Tocado", save: "Parada",
    corner: "Córner", penalty_received: "Penalti a favor", penalty_committed: "Penalti en contra", penalty_missed: "Penalti fallado", penalty_saved: "Penalti parado",
    own_goal: "En propia", opponent_foul: "Falta suya", opponent_woodwork: "Al palo suyo", opponent_corner: "Córner suyo", opponent_chance: "Ocasión suya",
    opponent_offside: "Fuera de juego", opponent_yellow: "Amarilla suya", opponent_red: "Roja suya", opponent_penalty_missed: "Fallan su penalti",
  };
  return TAG[t] ?? "Jugada";
}
import { eventText } from "../model";
const eventWords = (t: MesaType, name: string, rival: string) => eventText({ type: t, playerId: name ? "x" : undefined }, () => name, rival);
/** «portero», «central»: a slot's code as la mesa says it. */
export function placeWord(code: string | null): string {
  const W: Record<string, string> = { POR: "portero", LI: "lateral izquierdo", LD: "lateral derecho", DFC: "central", MC: "medio", MCD: "medio defensivo", MCO: "mediapunta", DC: "delantero", EI: "extremo izquierdo", ED: "extremo derecho", MI: "interior izquierdo", MD: "interior derecho" };
  return code ? W[code] ?? code : "su sitio";
}
export { upper };
