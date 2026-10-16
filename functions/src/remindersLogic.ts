// Pure rules of «la convocatoria que persigue sola» (functions/src/reminders.ts): when a match is 48 h and
// 24 h away, who of its convocados hasn't answered yet and what the reminder says; and the captains'
// notice when someone changes their answer in the last 24 h. Apart so the app's tests can run them.
import { rsvpFields, type Notice } from "./pushLogic.js";
import { memberIds } from "./guests.js";

export const HOUR = 3_600_000;
/** No reminder this close to kick-off (the convocatoria is closed by then, in practice). */
export const REMINDER_MIN_LEAD = HOUR;
/** A late change of the same player for the same match is told once every this long (no flip-flop spam). */
export const LATE_DEBOUNCE_MS = 10 * 60_000;

export type ReminderKind = "48" | "24";
export type Answer = "yes" | "no" | "maybe";

/** Which reminder is due for a match kicking off at `kickoff` (null = none now). */
export function reminderDue(kickoff: number, now: number): ReminderKind | null {
  const lead = kickoff - now;
  if (!Number.isFinite(lead) || lead < REMINDER_MIN_LEAD) return null;
  if (lead <= 24 * HOUR) return "24";
  if (lead <= 48 * HOUR) return "48";
  return null;
}

/** The convocados (titulares + banquillo, once each, in that order) who haven't answered — members only:
 *  a guest («guest:g1») has no ficha, no devices and nothing to answer. */
export function unanswered(starters: readonly string[], bench: readonly string[], answered: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const id of memberIds([...starters, ...bench])) if (id && !answered.has(id) && !out.includes(id)) out.push(id);
  return out;
}

const TZ = "Europe/Madrid";
const weekday = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long" }).format(ms);
const hour = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(ms);

/** «¿Vas el domingo?» — the reminder to a convocado who hasn't answered. Same tag: the 24 h one replaces
 *  the 48 h one on the phone. It opens the match's Vestuario tab, where Voy / Duda / No puedo live
 *  (and so does the captains' late-change notice below: the answers' bar is there). It asks for an
 *  answer: «Voy» / «No puedo» on the phone (rsvpFields); the captains' notice doesn't. */
export function reminderNotice(matchId: string, kind: ReminderKind, match: { rival?: string; date: number }): Notice {
  const rival = match.rival ?? "el rival";
  const day = weekday(match.date);
  return {
    topic: "convocatoria",
    title: kind === "24" ? `Mañana se juega: ¿vas?` : `¿Vas el ${day}?`,
    body: `Estás convocado contra ${rival} (${day}, ${hour(match.date)}). Contesta en la web: Voy, Duda o No puedo.`,
    tag: `remind-${matchId}`,
    url: `/matches/${matchId}?tab=vestuario`,
    ...rsvpFields(matchId),
  };
}

const ANSWER_TXT: Record<Answer, string> = { yes: "Voy", maybe: "Duda", no: "No puedo" };
export const isAnswer = (v: unknown): v is Answer => v === "yes" || v === "no" || v === "maybe";

/**
 * The captains' notice when someone changes their answer within 24 h of kick-off (a first answer, the
 * same answer again or a match already started say nothing).
 */
export function lateChangeNotice(matchId: string, who: string, before: unknown, after: unknown, match: { rival?: string; date?: number }, now: number): Notice | null {
  if (!isAnswer(before) || !isAnswer(after) || before === after) return null;
  if (typeof match.date !== "number") return null;
  const lead = match.date - now;
  if (lead <= 0 || lead > 24 * HOUR) return null;
  const rival = match.rival ?? "el rival";
  return {
    topic: "convocatoria",
    title: after === "no" ? `Baja de última hora: ${who}` : `Cambio de última hora: ${who}`,
    body: `${who} ahora dice «${ANSWER_TXT[after]}» (antes «${ANSWER_TXT[before]}») para el partido contra ${rival}.`,
    tag: `late-${matchId}`,
    url: `/matches/${matchId}?tab=vestuario`,
  };
}
