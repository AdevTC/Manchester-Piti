// En juego, pure (tested in liveModel.test.ts): who is on the pitch and on the bench, the log «Lo que va
// pasando», and the picker the pads open — GOL → ¿Quién marcó? → ¿Quién le dio el pase? (or «Autogol de
// …» / «Lo completo luego»), Tarjeta → which card → whom, Cambio → who leaves → who comes in, Penalti o
// palo → which → whom. Each step either leads to the next one or to the event the liveEvent callable
// writes. The pads' types, the questions, where each player comes from, the events and the words (in the
// captions and in the log) all come from the shared catalogue (src/lib/liveActions.ts) that the match
// page's Mesa de partido reads too. Shared by Hoy's «En juego» hero and the En juego view.
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { onPitch } from "../../../lib/ficha";
import { eventMinute } from "../../../lib/partidos";
import { buildLiveEvent, isLiveActionType, liveAction, liveLine, liveTypesOn, type LiveAction, type LiveEventInput, type LiveTypesOn } from "../../../lib/liveActions";

export type { LiveEventInput };
/** Behind the «Tarjeta» pad. */
export type CardType = LiveTypesOn<"tar">;
const CARDS = liveTypesOn("tar");
export const CARD_LABEL = Object.fromEntries(CARDS.map((t) => [t, liveAction(t).name])) as Record<CardType, string>;
/** Behind the «Penalti o palo» pad: the plays of ours that are not goals, cards or changes. */
export type OtherType = LiveTypesOn<"mas">;

export type PickState =
  | { k: "oca" | "cor"; st: 1 | 2 }
  | { k: "gol"; st: 1 }
  | { k: "gol"; st: 2; scorer: string }
  | { k: "tar"; st: 1 }
  | { k: "tar"; st: 2; card: CardType }
  | { k: "cam"; st: 1 }
  | { k: "cam"; st: 2; out: string }
  | { k: "mas"; st: 1 }
  | { k: "mas"; st: 2; type: OtherType };
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
  /** The minute the events are stamped with (liveMinute). */
  minute: number;
  /** The minute people read in the captions and the flash (shownMinute); `minute` when absent. */
  shown?: number;
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
  const m = `${c.shown ?? c.minute}′`;
  const opt = (id: string, aria: string, next: Step): PickOption => ({ id, ...c.player(id), aria, next });
  const name = (id: string) => c.player(id).name;
  /** The player grids of an action: on the pitch, plus the banquillo when its pool is the convocatoria (cards). */
  const grids = (act: LiveAction, aria: (id: string) => string, next: (id: string) => Step, except?: string) => ({
    options: c.field.filter((id) => id !== except).map((id) => opt(id, aria(id), next(id))),
    bench: act.pool === "squad" && c.bench.length ? c.bench.map((id) => opt(id, aria(id), next(id))) : null,
  });
  /** One player's play, written at once with its caption: «Amarilla a TELLO · 31′». */
  const played = (act: LiveAction) => grids(act, (id) => liveLine(act, name(id)), (id) => ({ event: buildLiveEvent(act, { playerId: id }, c.minute), caption: `${liveLine(act, name(id))} · ${m}` }));

  if (s.k === "oca" || s.k === "cor") {
    const behind = liveTypesOn(s.k).map((t) => liveAction(t));
    const ours = behind.find((x) => x.side === "us") as LiveAction; // (the catalogue has one of each side per pad: liveActions.test)
    const theirs = behind.find((x) => x.side === "them") as LiveAction;
    const save = (act: LiveAction, playerId?: string): Step => ({ event: buildLiveEvent(act, { playerId }, c.minute), caption: `${liveLine(act, act.side === "them" ? c.rival : playerId && name(playerId))} · ${m}` });
    if (s.st === 1) return { step: `${ours.name.toUpperCase()} · ${m}`, question: "¿De qué equipo?", label: "", options: [], bench: null, extras: [
      { key: "us", label: "Manchester Piti", next: { state: { k: s.k, st: 2 } } },
      { key: "them", label: c.rival, next: save(theirs) },
    ] };
    const optional = ours.player === "optional";
    return {
      step: `${ours.label.toUpperCase()} · ${m}`,
      question: ours.ask,
      label: optional ? "En el campo · opcional" : "En el campo",
      ...grids(ours, (id) => liveLine(ours, name(id)), (id) => save(ours, id)),
      extras: optional ? [{ key: "team", label: "Apuntar al equipo, sin jugador", next: save(ours) }] : [],
    };
  }
  if (s.k === "gol" && s.st === 1) {
    const goal = liveAction("goal");
    // also behind the pad, written at once: the goals without a player of ours (the rival's autogol)
    const outright = liveTypesOn("gol").map((t) => liveAction(t)).filter((x) => x.player === "none");
    return {
      step: `GOL · ${m} · paso 1 de 2`,
      question: goal.ask,
      label: "En el campo",
      ...grids(goal, (id) => `Marcó ${name(id)}`, (id) => ({ state: { k: "gol", st: 2, scorer: id } })),
      extras: [
        ...outright.map((x) => ({ key: x.type === "opponent_own_goal" ? "og" : x.type, label: liveLine(x, c.rival), next: { event: buildLiveEvent(x, {}, c.minute), flash: `${liveLine(x, c.rival)} · ${m}` } })),
        ...(goal.player === "later" ? [{ key: "later", label: "Lo completo luego", next: { event: buildLiveEvent(goal, {}, c.minute), flash: `${goal.label} · ${m}` } }] : []),
      ],
    };
  }
  if (s.k === "gol" && s.st === 2) {
    const act = liveAction("goal");
    const scorer = name(s.scorer);
    const goal = (assist?: string): Step => ({
      event: buildLiveEvent(act, { playerId: s.scorer, assistPlayerId: assist }, c.minute),
      flash: `${scorer} · ${m}${assist ? ` · pase de ${name(assist)}` : ""}`,
    });
    return {
      step: `GOL de ${scorer} · paso 2 de 2`,
      question: act.askSecond,
      label: "Asistencia (opcional)",
      // (the assist comes from the pitch, never the scorer)
      ...grids({ ...act, pool: "field" }, (id) => `Pase de ${name(id)}`, (id) => goal(id), s.scorer),
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
      extras: CARDS.map((card) => ({ key: card, label: CARD_LABEL[card], next: { state: { k: "tar", st: 2, card } } })),
    };
  if (s.k === "tar" && s.st === 2) {
    const act = liveAction(s.card);
    return { step: `${act.name} · paso 2 de 2`, question: act.ask, label: "En el campo", ...played(act), extras: [] };
  }
  if (s.k === "cam" && s.st === 1) {
    const act = liveAction("substitution");
    return {
      step: `CAMBIO · ${m} · paso 1 de 2`,
      question: act.ask,
      label: "En el campo",
      ...grids(act, (id) => `Sale ${name(id)}`, (id) => ({ state: { k: "cam", st: 2, out: id } })),
      extras: [],
    };
  }
  if (s.k === "mas" && s.st === 1)
    return {
      step: `PENALTI O PALO · ${m} · paso 1 de 2`,
      question: "¿Qué ha pasado?",
      label: "",
      options: [],
      bench: null,
      extras: liveTypesOn("mas").map((type) => ({ key: type, label: liveAction(type).name, next: { state: { k: "mas", st: 2, type } } })),
    };
  if (s.k === "mas" && s.st === 2) {
    const act = liveAction(s.type);
    return { step: `${act.name} · paso 2 de 2`, question: act.ask, label: "En el campo", ...played(act), extras: [] };
  }
  const act = liveAction("substitution");
  const out = (s as { out: string }).out;
  return {
    step: `Sale ${name(out)} · paso 2 de 2`,
    question: act.askSecond,
    label: "Banquillo",
    options: c.bench.map((id) => opt(id, `Entra ${name(id)}`, { event: buildLiveEvent(act, { playerId: out, inPlayerId: id }, c.minute), caption: `${liveLine(act, name(id))}, sale ${name(out)}` })),
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
  icon: "ball" | "card" | "swap" | "flag" | "spark" | null;
  text: string;
  detail: string;
}
const GOALS = new Set(["goal", "goal_penalty", "goal_freekick"]);
/** The plays outside the live catalogue (written from the acta). */
const OTHER: Record<string, string> = { penalty_committed: "Penalti cometido", penalty_received: "Penalti recibido" };
const CLS: Partial<Record<string, LogRow["cls"]>> = { yellow_card: "y", double_yellow: "rj", red_card: "rj" };
const ICON: Partial<Record<string, LogRow["icon"]>> = { opponent_goal: "ball", opponent_own_goal: "ball", yellow_card: "card", double_yellow: "card", red_card: "card", substitution: "swap", chance: "spark", opponent_chance: "spark", corner: "flag", opponent_corner: "flag" };

/** The match's events as the log tells them, newest first, in the catalogue's words (liveLine). */
export function liveLog(events: readonly MatchEvent[] | undefined, rival: string, nameOf: (id: string) => string): LogRow[] {
  const nm = (id?: string) => (id ? nameOf(id) : "—");
  const rows = (events ?? []).map((e, i): LogRow & { order: number; at: number } => {
    const shown = eventMinute(e);
    const base = { id: e.id, minute: shown !== null ? String(shown) : "–", order: i, at: typeof e.minute === "number" ? e.minute : -1 };
    if (GOALS.has(e.type)) {
      const how = e.type === "goal_penalty" ? "de penalti" : e.type === "goal_freekick" ? "de falta" : "";
      const detail = !e.playerId ? "falta el goleador" : [how, e.assistPlayerId ? `pase de ${nm(e.assistPlayerId)}` : ""].filter(Boolean).join(" · ");
      return { ...base, cls: "", icon: "ball", text: liveLine("goal", e.playerId && nm(e.playerId)), detail };
    }
    if (e.type === "own_goal") return { ...base, cls: "rv", icon: "ball", text: liveLine("opponent_goal", rival), detail: `en propia de ${nm(e.playerId)}` };
    if (!isLiveActionType(e.type)) return { ...base, cls: "", icon: null, text: `${OTHER[e.type] ?? "Jugada"} · ${nm(e.playerId)}`, detail: "" };
    const act = liveAction(e.type);
    // who the line is about: the rival for their plays (and their autogol), who comes in for a change,
    // nobody for a chance or corner of the whole team («Ocasión del Piti»)
    const who = act.side === "them" || act.type === "opponent_own_goal" ? rival : act.second === "in" ? nm(e.inPlayerId) : act.player === "optional" ? e.playerId && nm(e.playerId) : nm(e.playerId);
    const detail = act.second === "in" ? `sale ${nm(e.playerId)}` : act.pad === "oca" || act.pad === "cor" ? (e.note ?? "") : "";
    return { ...base, cls: CLS[e.type] ?? (act.side === "them" ? "rv" : ""), icon: ICON[e.type] ?? null, text: liveLine(act, who), detail };
  });
  rows.sort((a, b) => b.at - a.at || b.order - a.order);
  return rows.map((r) => ({ id: r.id, minute: r.minute, cls: r.cls, icon: r.icon, text: r.text, detail: r.detail }));
}
