// «Avisos a medida»: the three presets of a device's push notices, shared by the web (src/lib/push.ts) and
// the backend (push.ts: pushSubscribe stores the preset its topics make, pushSetPreset rewrites them, sendTo
// honours it). No dependencies: the web's bundle imports it as it is.
//   · «Solo goles» (goles): every goal, ours or theirs — nothing else, not even the personal notices.
//   · «Todo» (todo): the match (start, goals, cards, final, MVP, dates, the seven) and, for a member, his
//     personal notices (convocatoria, turnos…).
//   · «Nada» (nada): no notices (the device is forgotten).
// Any other choice of topics (the old switches) is «A medida» (custom). The vestuario door's topics (door,
// access) are apart: no preset adds or removes them.

/** The topics «Todo» is read from: a device with all of them is on «Todo» (the ones added later count too when
 *  present, but a device from before them stays on «Todo»). */
const CORE_TOPICS = ["start", "goals", "cards", "final", "mvp", "dates", "lineup"] as const;
/** The club's public topics (anyone can follow them): «tabla», the league table published on Partidos. */
export const PUBLIC_TOPICS = [...CORE_TOPICS, "tabla"] as const;
/** The door's personal topics (captains: someone knocks; whoever waits to be let in). */
export const DOOR_TOPIC_IDS = ["door", "access"] as const;

export type PushPreset = "goles" | "todo" | "nada";
export const PUSH_PRESETS: readonly PushPreset[] = ["goles", "todo", "nada"];
/** A device's choice as the bell shows it: one of the presets, or «A medida». */
export type PushChoice = PushPreset | "custom";

const DOOR = new Set<string>(DOOR_TOPIC_IDS);

/** The topics a preset means for a device (`current`: its topics now, whose door topics it keeps;
 *  `member`: a signed-in member, whose «Todo» carries the convocatoria's personal notices). */
export function presetTopics(preset: PushPreset, current: readonly string[], member: boolean): string[] {
  const door = [...new Set(current.filter((t) => DOOR.has(t)))];
  if (preset === "goles") return ["goals", ...door];
  if (preset === "todo") return [...PUBLIC_TOPICS, ...(member ? ["convocatoria"] : []), ...door];
  return door;
}

/** Which preset a device's topics make («A medida» when none). */
export function presetOf(topics: readonly string[]): PushChoice {
  const t = new Set(topics.filter((x) => !DOOR.has(x)));
  if (!t.size) return "nada";
  if (t.size === 1 && t.has("goals")) return "goles";
  return CORE_TOPICS.every((x) => t.has(x)) ? "todo" : "custom";
}

/** Whether a device on `choice` gets a notice of `topic` ("personal": news about its member). The door's
 *  topics always go (they are their own choice); «Solo goles» gets only goals; «Nada», nothing. */
export function presetAllows(choice: unknown, topic: string): boolean {
  if (DOOR.has(topic)) return true;
  if (choice === "nada") return false;
  if (choice === "goles") return topic === "goals";
  return true;
}

/** The note under each choice (the bell's «Avisos a medida»). */
export const PRESET_NOTES: Record<PushChoice, string> = {
  goles: "Te avisamos de cada gol, nuestro o suyo.",
  todo: "Goles, tarjetas, descanso, final, acta, el siete y tus turnos.",
  nada: "Sin avisos. El marcador sigue en la web.",
  custom: "Los avisos que elegiste uno a uno.",
};
export const PRESET_LABELS: Record<PushChoice, string> = { goles: "Solo goles", todo: "Todo", nada: "Nada", custom: "A medida" };

/** The vibration a goal notice asks for when the device chose «Vibrar con los goles». */
export const GOAL_VIBRATE = [80, 40, 120] as const;
