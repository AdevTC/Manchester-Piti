// Pure rules of the push notices (functions/src/push.ts): which change of a match deserves a notice,
// to which topic, and its words. Apart so the app's tests can run them.
export const TOPICS = ["start", "goals", "final", "mvp", "dates"] as const;
/** Personal notices of the vestuario door: "door" for admins (someone asks to come in), "access" for whoever asked. */
export const DOOR_TOPICS = ["door", "access"] as const;
export type Topic = (typeof TOPICS)[number] | (typeof DOOR_TOPICS)[number];

export interface Notice {
  topic: Topic;
  title: string;
  body: string;
  /** Same tag replaces the previous notice of the same kind for that match on the phone. */
  tag: string;
  url: string;
}
interface Ev {
  id: string;
  type: string;
  minute?: number;
  playerId?: string;
}
export interface MatchLike {
  rival?: string;
  status?: string;
  date?: number;
  events?: Ev[];
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  voteClosesAt?: number;
  archived?: boolean;
}

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const TZ = "Europe/Madrid";

export function liveScore(events: Ev[] | undefined) {
  let gf = 0, ga = 0;
  for (const e of events ?? []) {
    if (OURS.has(e.type)) gf++;
    else if (THEIRS.has(e.type)) ga++;
  }
  return { gf, ga };
}

const when = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms).replace(".", "");

/**
 * What changed between two versions of a match, as notices: each goal written while it isn't
 * finished, the final whistle (and the MVP vote opening), and a new match or a new kick-off time.
 */
export function noticesFor(id: string, before: MatchLike | undefined, after: MatchLike | undefined, nameOf: (playerId: string) => string, now: number): Notice[] {
  if (!after || after.archived) return [];
  const url = `/matches/${id}`;
  const rival = after.rival ?? "el rival";
  const out: Notice[] = [];
  const finishedNow = after.status === "finished" && before?.status !== "finished";
  if (after.status !== "finished" && after.status !== "cancelled") {
    const seen = new Set((before?.events ?? []).map((e) => e.id));
    const fresh = (after.events ?? []).filter((e) => !seen.has(e.id) && (OURS.has(e.type) || THEIRS.has(e.type)));
    if (fresh.length) {
      const { gf, ga } = liveScore(after.events);
      const last = fresh[fresh.length - 1];
      const ours = OURS.has(last.type);
      const who = last.type === "opponent_own_goal" ? `Autogol de ${rival}` : ours && last.playerId ? nameOf(last.playerId) : rival;
      out.push({
        topic: "goals",
        title: ours ? `¡GOL del Piti! ${gf}–${ga}` : `Gol de ${rival}. ${gf}–${ga}`,
        body: `${who}${last.minute != null ? `, minuto ${last.minute}` : ""} · Manchester Piti ${gf}–${ga} ${rival}`,
        tag: `goal-${id}`,
        url,
      });
    }
  }
  if (finishedNow) {
    const gf = after.goalsFor ?? 0, ga = after.goalsAgainst ?? 0;
    const verdict = gf > ga ? "Victoria" : gf === ga ? "Empate" : "Derrota";
    out.push({ topic: "final", title: `Final: Manchester Piti ${gf}–${ga} ${rival}`, body: `${verdict}. La crónica, los minutos y el pulso del partido ya están en la web.`, tag: `final-${id}`, url });
    if ((after.voteClosesAt ?? 0) > now) out.push({ topic: "mvp", title: "Vota al MVP", body: `¿Quién se salió ante ${rival}? La votación está abierta 48 horas.`, tag: `mvp-${id}`, url });
  }
  const scheduled = after.status === "scheduled" && typeof after.date === "number" && after.date > now;
  if (scheduled && (!before || before.date !== after.date)) {
    out.push({ topic: "dates", title: before ? `Cambio de hora: ${rival}` : `Nuevo partido: ${rival}`, body: `${when(after.date!).replace(/^./, (c) => c.toUpperCase())}. Añádelo a tu calendario desde la web.`, tag: `date-${id}`, url });
  }
  return out;
}

/** The kick-off notice, sent by the 5-minute job. */
export const kickoffNotice = (id: string, rival: string): Notice => ({
  topic: "start",
  title: `¡Empieza el partido! Piti vs ${rival}`,
  body: "Sigue el marcador en directo en la web.",
  tag: `start-${id}`,
  url: `/matches/${id}`,
});
