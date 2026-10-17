// The catalogue of the older live actions, kept for how the admin's log «Lo que va pasando» (Hoy, the
// acta) says the plays: each entry's `type` (one of the callable's LIVE_TYPES), its names (`label`, `name`,
// `liveLine`), icon, side and what player it is about. Scoring itself is la mesa's (src/pages/mesa), with
// its own catalogue.
import type { LIVE_TYPES } from "../../functions/src/liveLogic";
import { allowedAtBreak } from "../../functions/src/liveRules";
import type { IconName } from "../components/celeste/icons";

/** The event types the liveEvent callable accepts (functions/src/liveLogic.ts). */
export type LiveEventType = (typeof LIVE_TYPES)[number];
/** The admin pad an action sits behind: GOL, Gol rival, Tarjeta, Cambio, Ocasión, Córner, Penalti o palo. */
export type LivePad = "gol" | "rival" | "tar" | "cam" | "oca" | "cor" | "mas";

interface Def {
  /** The Mesa de partido's button: «Gol del Piti», «Ocasión rival». */
  label: string;
  /** The bare name the wizard, its captions and the log use: «Gol», «Roja directa», «Ocasión». */
  name: string;
  /** What joins the name to who did it: «Amarilla a X», «Penalti parado por X», «Al palo: X». */
  by: string;
  icon: IconName | null;
  pad: LivePad;
  side?: "us" | "them";
  player?: "required" | "optional" | "later" | "none";
  pool?: "field" | "squad";
  second?: "assist" | "in";
  ask?: string;
  askSecond?: string;
}

const DEFS = {
  goal: { label: "Gol del Piti", name: "Gol", by: " de ", icon: "ball", pad: "gol", player: "later", second: "assist", ask: "¿Quién marcó?", askSecond: "¿Quién le dio el pase?" },
  opponent_goal: { label: "Gol rival", name: "Gol", by: " de ", icon: "ball", pad: "rival", side: "them", player: "none" },
  opponent_own_goal: { label: "Autogol del rival", name: "Autogol", by: " de ", icon: "ball", pad: "gol", player: "none" },
  yellow_card: { label: "Amarilla", name: "Amarilla", by: " a ", icon: null, pad: "tar", pool: "squad", ask: "¿A quién?" },
  double_yellow: { label: "Segunda amarilla", name: "Segunda amarilla", by: " a ", icon: null, pad: "tar", pool: "squad", ask: "¿A quién?" },
  red_card: { label: "Roja", name: "Roja directa", by: " a ", icon: null, pad: "tar", pool: "squad", ask: "¿A quién?" },
  substitution: { label: "Cambio", name: "Cambio", by: ": entra ", icon: "swap", pad: "cam", second: "in", ask: "¿Quién sale?", askSecond: "¿Quién entra?" },
  penalty_saved: { label: "Penalti parado", name: "Penalti parado", by: " por ", icon: "shield", pad: "mas", ask: "¿Quién lo paró?" },
  woodwork: { label: "Al palo", name: "Al palo", by: ": ", icon: "boot", pad: "mas", ask: "¿Quién lo tiró?" },
  penalty_missed: { label: "Penalti fallado", name: "Penalti fallado", by: " por ", icon: "x", pad: "mas", ask: "¿Quién lo tiró?" },
  chance: { label: "Ocasión del Piti", name: "Ocasión", by: " de ", icon: "flame", pad: "oca", player: "optional", ask: "¿Qué jugador?" },
  opponent_chance: { label: "Ocasión rival", name: "Ocasión", by: " de ", icon: "flame", pad: "oca", side: "them", player: "none" },
  corner: { label: "Córner del Piti", name: "Córner", by: " de ", icon: "flag", pad: "cor", player: "optional", ask: "¿Qué jugador?" },
  opponent_corner: { label: "Córner rival", name: "Córner", by: " de ", icon: "flag", pad: "cor", side: "them", player: "none" },
} as const satisfies { [T in LiveEventType]?: Def };

/** The types in the catalogue: the only ones the UIs write. */
export type LiveActionType = keyof typeof DEFS;
export interface LiveAction<T extends LiveActionType = LiveActionType> extends Required<Omit<Def, "second">> {
  type: T;
  second: "assist" | "in" | null;
  /** Can be written during the break: the callable's own rule (functions/src/liveRules.ts). */
  atBreak: boolean;
}

const normalise = <T extends LiveActionType>(type: T, d: Def): LiveAction<T> => ({
  type,
  label: d.label,
  name: d.name,
  by: d.by,
  icon: d.icon,
  pad: d.pad,
  side: d.side ?? "us",
  player: d.player ?? "required",
  pool: d.pool ?? "field",
  second: d.second ?? null,
  ask: d.ask ?? "",
  askSecond: d.askSecond ?? "",
  atBreak: allowedAtBreak(type),
});

/** In the Mesa de partido's order. */
export const LIVE_ACTIONS: readonly LiveAction[] = (Object.keys(DEFS) as LiveActionType[]).map((t) => normalise(t, DEFS[t]));
const BY_TYPE = new Map<string, LiveAction>(LIVE_ACTIONS.map((x) => [x.type, x]));

export const isLiveActionType = (type: string): type is LiveActionType => BY_TYPE.has(type);
/** The catalogue entry of a type. */
export function liveAction<T extends LiveActionType>(type: T): LiveAction<T> {
  return BY_TYPE.get(type) as LiveAction<T>; // (BY_TYPE holds every key of DEFS, each under its own type)
}
/** How a play is said, in the toasts and in the log: «Amarilla a EVANS», «Gol de MAD SKY», «Al palo: ERIK»,
 *  «Cambio: entra KEVIN». Without anyone, the button's own words: «Gol del Piti», «Ocasión del Piti». */
export function liveLine(action: LiveAction | LiveActionType, who?: string): string {
  const act = typeof action === "string" ? liveAction(action) : action;
  return who ? `${act.name}${act.by}${who}` : act.label;
}
