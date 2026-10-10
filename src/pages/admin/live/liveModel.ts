// En juego, pure (tested in liveModel.test.ts): who is on the pitch and on the bench, the log «Lo que va
// pasando», and the picker the pads open — GOL → ¿Quién marcó? → ¿Quién le dio el pase? (or «Autogol de
// …» / «Lo completo luego»), Tarjeta → which card → whom, Cambio → who leaves → who comes in. Each step
// either leads to the next one or to the event the liveEvent callable writes. Shared by Hoy's «En juego»
// hero and the En juego view.
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { onPitch } from "../../../lib/ficha";

/** What liveEvent({ action: "add" }) takes. */
export interface LiveEventInput {
  type: string;
  minute: number;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
}
export type CardType = "yellow_card" | "double_yellow" | "red_card";
export const CARD_LABEL: Record<CardType, string> = { yellow_card: "Amarilla", double_yellow: "Segunda amarilla", red_card: "Roja directa" };

export type PickState =
  | { k: "gol"; st: 1 }
  | { k: "gol"; st: 2; scorer: string }
  | { k: "tar"; st: 1 }
  | { k: "tar"; st: 2; card: CardType }
  | { k: "cam"; st: 1 }
  | { k: "cam"; st: 2; out: string };
export type PadKind = PickState["k"];

/** Where a choice leads: the next question, or the event to write (+ the LED flash or the caption). */
export type Step = { state: PickState } | { event: LiveEventInput; flash?: string; caption?: string };
export interface PickOption {
  id: string;
  num: string;
  name: string;
  aria: string;
  next: Step;
}
export interface PickerView {
  /** «GOL · 31′ · paso 1 de 2» */
  step: string;
  /** «¿Quién marcó?» */
  question: string;
  /** The label over the first grid («En el campo», «Asistencia (opcional)», «Banquillo»; empty = none). */
  label: string;
  options: PickOption[];
  /** The second grid, «Banquillo» (null = none). */
  bench: PickOption[] | null;
  /** The plain buttons under the grids («Autogol de …», «Lo completo luego», «Sin asistencia», the cards). */
  extras: { key: string; label: string; next: Step }[];
}
export interface PickerContext {
  minute: number;
  rival: string;
  /** On the pitch now (starters + who came in − who left or was sent off). */
  field: readonly string[];
  /** Called up and available to come in. */
  bench: readonly string[];
  player: (id: string) => { num: string; name: string };
}

/** Who is on the pitch and who can still come in, from the convocatoria and the live events. */
export function liveSides(starters: readonly string[] | undefined, bench: readonly string[] | undefined, events: readonly MatchEvent[] | undefined): { field: string[]; bench: string[] } {
  const field = onPitch([...(starters ?? [])], [...(events ?? [])]);
  const off = new Set((events ?? []).filter((e) => (e.type === "red_card" || e.type === "double_yellow") && e.playerId).map((e) => e.playerId as string));
  const called = [...(starters ?? []), ...(bench ?? [])];
  return { field, bench: called.filter((id) => !field.includes(id) && !off.has(id)) };
}

export function pickerView(s: PickState, c: PickerContext): PickerView {
  const m = `${c.minute}′`;
  const opt = (id: string, aria: string, next: Step): PickOption => ({ id, ...c.player(id), aria, next });
  const name = (id: string) => c.player(id).name;
  if (s.k === "gol" && s.st === 1) {
    const toAssist = (id: string): Step => ({ state: { k: "gol", st: 2, scorer: id } });
    return {
      step: `GOL · ${m} · paso 1 de 2`,
      question: "¿Quién marcó?",
      label: "En el campo",
      options: c.field.map((id) => opt(id, `Marcó ${name(id)}`, toAssist(id))),
      bench: c.bench.length ? c.bench.map((id) => opt(id, `Marcó ${name(id)}`, toAssist(id))) : null,
      extras: [
        { key: "og", label: `Autogol de ${c.rival}`, next: { event: { type: "opponent_own_goal", minute: c.minute }, flash: `Autogol de ${c.rival} · ${m}` } },
        { key: "later", label: "Lo completo luego", next: { event: { type: "goal", minute: c.minute }, flash: `Gol del Piti · ${m}` } },
      ],
    };
  }
  if (s.k === "gol" && s.st === 2) {
    const scorer = name(s.scorer);
    const goal = (assist?: string): Step => ({
      event: { type: "goal", minute: c.minute, playerId: s.scorer, ...(assist ? { assistPlayerId: assist } : {}) },
      flash: `${scorer} · ${m}${assist ? ` · pase de ${name(assist)}` : ""}`,
    });
    return {
      step: `GOL de ${scorer} · paso 2 de 2`,
      question: "¿Quién le dio el pase?",
      label: "Asistencia (opcional)",
      options: c.field.filter((id) => id !== s.scorer).map((id) => opt(id, `Pase de ${name(id)}`, goal(id))),
      bench: null,
      extras: [{ key: "none", label: "Sin asistencia", next: goal() }],
    };
  }
  if (s.k === "tar" && s.st === 1)
    return {
      step: `TARJETA · ${m} · paso 1 de 2`,
      question: "¿Qué tarjeta?",
      label: "",
      options: [],
      bench: null,
      extras: (Object.keys(CARD_LABEL) as CardType[]).map((card) => ({ key: card, label: CARD_LABEL[card], next: { state: { k: "tar", st: 2, card } } })),
    };
  if (s.k === "tar" && s.st === 2)
    return {
      step: `${CARD_LABEL[s.card]} · paso 2 de 2`,
      question: "¿A quién?",
      label: "En el campo",
      options: c.field.map((id) => opt(id, `${CARD_LABEL[s.card]} a ${name(id)}`, { event: { type: s.card, minute: c.minute, playerId: id }, caption: `${CARD_LABEL[s.card]} a ${name(id)} · ${m}` })),
      bench: null,
      extras: [],
    };
  if (s.k === "cam" && s.st === 1)
    return {
      step: `CAMBIO · ${m} · paso 1 de 2`,
      question: "¿Quién sale?",
      label: "En el campo",
      options: c.field.map((id) => opt(id, `Sale ${name(id)}`, { state: { k: "cam", st: 2, out: id } })),
      bench: null,
      extras: [],
    };
  const out = (s as { out: string }).out;
  return {
    step: `Sale ${name(out)} · paso 2 de 2`,
    question: "¿Quién entra?",
    label: "Banquillo",
    options: c.bench.map((id) => opt(id, `Entra ${name(id)}`, { event: { type: "substitution", minute: c.minute, playerId: out, inPlayerId: id }, caption: `Entra ${name(id)}, sale ${name(out)}` })),
    bench: null,
    extras: [],
  };
}

/** A line of «Lo que va pasando». */
export interface LogRow {
  id: string;
  minute: string;
  /** `rv` = theirs, `y` = yellow, `rj` = red / second yellow. */
  cls: "" | "rv" | "y" | "rj";
  icon: "ball" | "card" | "swap" | null;
  text: string;
  detail: string;
}
const GOALS = new Set(["goal", "goal_penalty", "goal_freekick"]);
const OTHER: Record<string, string> = { penalty_saved: "Penalti parado", penalty_missed: "Penalti fallado", woodwork: "Tiro al palo", penalty_committed: "Penalti cometido", penalty_received: "Penalti recibido" };

/** The match's events as the log tells them, newest first. */
export function liveLog(events: readonly MatchEvent[] | undefined, rival: string, nameOf: (id: string) => string): LogRow[] {
  const nm = (id?: string) => (id ? nameOf(id) : "—");
  const rows = (events ?? []).map((e, i): LogRow & { order: number; at: number } => {
    const base = { id: e.id, minute: typeof e.minute === "number" ? String(e.minute) : "–", order: i, at: typeof e.minute === "number" ? e.minute : -1 };
    if (GOALS.has(e.type)) {
      const how = e.type === "goal_penalty" ? "de penalti" : e.type === "goal_freekick" ? "de falta" : "";
      const detail = !e.playerId ? "falta el goleador" : [how, e.assistPlayerId ? `pase de ${nm(e.assistPlayerId)}` : ""].filter(Boolean).join(" · ");
      return { ...base, cls: "", icon: "ball", text: e.playerId ? `Gol de ${nm(e.playerId)}` : "Gol del Piti", detail };
    }
    if (e.type === "opponent_own_goal") return { ...base, cls: "", icon: "ball", text: `Autogol de ${rival}`, detail: "" };
    if (e.type === "opponent_goal") return { ...base, cls: "rv", icon: "ball", text: `Gol de ${rival}`, detail: "" };
    if (e.type === "own_goal") return { ...base, cls: "rv", icon: "ball", text: `Gol de ${rival}`, detail: `en propia de ${nm(e.playerId)}` };
    if (e.type === "yellow_card") return { ...base, cls: "y", icon: "card", text: `Amarilla a ${nm(e.playerId)}`, detail: "" };
    if (e.type === "double_yellow") return { ...base, cls: "rj", icon: "card", text: `Segunda amarilla a ${nm(e.playerId)}`, detail: "" };
    if (e.type === "red_card") return { ...base, cls: "rj", icon: "card", text: `Roja directa a ${nm(e.playerId)}`, detail: "" };
    if (e.type === "substitution") return { ...base, cls: "", icon: "swap", text: `Entra ${nm(e.inPlayerId)}`, detail: `sale ${nm(e.playerId)}` };
    return { ...base, cls: "", icon: null, text: `${OTHER[e.type] ?? "Jugada"} · ${nm(e.playerId)}`, detail: "" };
  });
  rows.sort((a, b) => b.at - a.at || b.order - a.order);
  return rows.map((r) => ({ id: r.id, minute: r.minute, cls: r.cls, icon: r.icon, text: r.text, detail: r.detail }));
}
