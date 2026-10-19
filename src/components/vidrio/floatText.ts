// The floating score's words, pure: what the compact drop says in each state and its accessible name.
// (P5 added the member's own states of the match day: «¿Vas hoy?», «Hoy anotas tú», the whistle's wait and
// «Vota al MVP».)
export type FloatState = "previa" | "rsvp" | "anotador" | "pitido" | "directo" | "descanso" | "final" | "acta" | "mvp" | "mvpres" | "pendiente" | "offline";

export interface FloatMatch {
  state: FloatState;
  /** Our goals and theirs (ignored before kick-off and while «pendiente»). */
  us: number;
  them: number;
  rival: string;
  /** The clock while live («23′»). */
  clock?: string;
  /** Kick-off (ms), for «previa». */
  kickoff?: number;
  /** The play or the turn of the match it unfolds for (~4 s each), in any state. */
  event?: { title: string; sub?: string } | null;
  /** «MVP: Alcides» (state mvpres): the winner's name. */
  winner?: string;
  /** Offline: the minute of the last good score («26′»). */
  staleAt?: string;
  /** Our crest (default /crest-128.webp). */
  crest?: string;
}

const hhmm = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);

/** «en 2 h 14 min», «en 14 min», «ya» (kick-off passed). */
export function untilText(kickoff: number, now: number): string {
  const min = Math.ceil((kickoff - now) / 60_000);
  if (min <= 0) return "ya";
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return `en ${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? "día" : "días"}`;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

export interface FloatLines {
  /** The big figure: the score «2–1» or the kick-off «19:00» (null when there is none to show). */
  big: string | null;
  /** The line beside it. */
  main: string;
  /** The small one (the clock, «Descanso», «Acta lista»). */
  small: string;
  /** small is the clock (Geist Mono). */
  clock: boolean;
}

export function floatLines(m: FloatMatch, now: number): FloatLines {
  const score = `${m.us}–${m.them}`;
  // (a play or a turn of the match unfolds the drop, whatever the state: «Descanso · 2–1 en la primera parte»)
  if (m.event && m.state !== "offline") return { big: m.state === "previa" || m.state === "rsvp" || m.state === "anotador" || m.state === "pitido" ? null : score, main: m.event.title, small: m.event.sub ?? "", clock: false };
  switch (m.state) {
    case "previa":
      return { big: m.kickoff ? hhmm(m.kickoff) : null, main: m.kickoff ? `${m.rival}, ${untilText(m.kickoff, now)}` : m.rival, small: "", clock: false };
    case "rsvp":
      return { big: m.kickoff ? hhmm(m.kickoff) : null, main: "¿Vas hoy?", small: m.rival, clock: false };
    case "anotador":
      return { big: m.kickoff ? hhmm(m.kickoff) : null, main: "Hoy anotas tú", small: m.rival, clock: false };
    case "pitido":
      return { big: null, main: m.rival, small: "Pendiente del pitido", clock: false };
    case "mvp":
      return { big: score, main: "Vota al MVP", small: m.rival, clock: false };
    case "mvpres":
      return { big: score, main: m.winner ? `MVP: ${m.winner}` : "MVP elegido", small: m.rival, clock: false };
    case "directo":
      return { big: score, main: m.rival, small: m.clock ?? "", clock: !!m.clock };
    case "descanso":
      return { big: score, main: m.rival, small: "Descanso", clock: false };
    case "final":
      return { big: score, main: "Final", small: m.rival, clock: false };
    case "acta":
      return { big: score, main: "Final", small: "Acta lista", clock: false };
    case "pendiente":
      return { big: null, main: m.rival, small: "Pendiente del acta", clock: false };
    case "offline":
      return { big: score, main: m.staleAt ? `Marcador del ${m.staleAt}, sin actualizar` : "Sin actualizar", small: "", clock: false };
  }
}

/** The drop's accessible name. */
export function floatLabel(m: FloatMatch, now: number): string {
  const s = `Manchester Piti ${m.us}, ${m.rival} ${m.them}`;
  switch (m.state) {
    case "previa":
      return m.kickoff ? `Contra ${m.rival} a las ${hhmm(m.kickoff)}, ${untilText(m.kickoff, now)}` : `Contra ${m.rival}`;
    case "rsvp":
      return `¿Vas hoy? Contra ${m.rival}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}`;
    case "anotador":
      return `Hoy anotas tú: contra ${m.rival}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}`;
    case "pitido":
      return `Contra ${m.rival}, pendiente del pitido inicial`;
    case "mvp":
      return `${s}, vota al mejor del partido`;
    case "mvpres":
      return `${s}, final${m.winner ? `. MVP: ${m.winner}` : ""}`;
    case "directo":
      return m.clock ? `${s}, minuto ${m.clock.replace(/[′']/g, "")}` : `${s}, en directo`;
    case "descanso":
      return `${s}, descanso`;
    case "final":
      return `${s}, final`;
    case "acta":
      return `${s}, final, acta lista`;
    case "pendiente":
      return `Contra ${m.rival}, pendiente del acta`;
    case "offline":
      return `${s}, sin conexión${m.staleAt ? `: marcador del ${m.staleAt}` : ""}`;
  }
}
