// /profile «La carta»: the sentences of the Temporada tab and the stage, from the real data. Pure.
import type { BoardsLine, ConvocatoriaLine, PorraLine } from "./profileData";
import type { NextMatch } from "./useProfileData";
import type { CardView, SeriesPoint } from "./card";

const TZ = "Europe/Madrid";
const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const longFmt = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric", month: "long" });

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** «dom 8 nov». */
export const matchDay = (ms: number): string => (ms ? dayFmt.format(new Date(ms)).replace(/,/g, "").replace(/\./g, "") : "");
/** «12:00». */
export const matchTime = (ms: number): string => (ms ? timeFmt.format(new Date(ms)) : "");
/** «8 de noviembre». */
export const longDay = (ms: number): string => (ms ? longFmt.format(new Date(ms)) : "");

/** «ahora», «hace 3 min», «hace 5 h», «ayer», «hace 2 días». */
export function ago(t: number | null, now: number): string {
  if (!t) return "hace poco";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
  if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
  if (s < 172800) return "ayer";
  return "hace " + Math.floor(s / 86400) + " días";
}

export interface StuffLine {
  key: "call" | "boards" | "porra" | "conv";
  title: string;
  text: string;
  href: string;
  /** Gold: something is waiting for you (the next convocatoria unanswered). */
  call: boolean;
}

const ANSWER: Record<"yes" | "no" | "maybe", string> = { yes: "Has dicho que vas.", maybe: "Has dicho que tienes duda.", no: "Has dicho que no vas." };

/** «Tus cosas en el vestuario»: the next convocatoria, your boards, your porra, your answers. */
export function stuffLines(s: { next: NextMatch | null; boards: BoardsLine; porra: PorraLine | null; conv: ConvocatoriaLine; now: number }): StuffLine[] {
  const out: StuffLine[] = [];
  const n = s.next;
  if (n) {
    const where = n.home === true ? "en casa" : n.home === false ? "fuera" : "";
    const meta = [n.j ? `J${n.j}` : "", matchDay(n.dateMs), matchTime(n.dateMs), where].filter(Boolean).join(" · ");
    const answer = s.conv.nextId === n.id && s.conv.next ? ANSWER[s.conv.next] : "Aún no has respondido.";
    out.push({ key: "call", title: `¿Vas a ${n.rival}?`, text: meta ? `${meta}. ${answer}` : answer, href: "/vestuario", call: !(s.conv.nextId === n.id && s.conv.next) });
  }
  const b = s.boards;
  out.push({
    key: "boards",
    title: "Tus pizarras",
    text: !b.count || !b.last ? "Aún no tienes tableros: crea el primero" : b.count === 1 ? `1 tablero · «${b.last.name}», ${ago(b.last.at, s.now)}` : `${plural(b.count, "tablero", "tableros")} · el último, «${b.last.name}», ${ago(b.last.at, s.now)}`,
    href: b.last ? b.last.href : "/pizarra",
    call: false,
  });
  const p = s.porra;
  out.push({
    key: "porra",
    title: "Tu porra",
    text: p && p.predictions ? `${plural(p.predictions, "pronóstico", "pronósticos")} · ${plural(p.exact, "exacto", "exactos")} · vas ${p.rank}.º de ${p.of}` : "Aún sin pronósticos esta temporada",
    href: "/vestuario",
    call: false,
  });
  const c = s.conv;
  const counts = [c.yes ? `Voy ×${c.yes}` : "", c.maybe ? `Duda ×${c.maybe}` : "", c.no ? `No voy ×${c.no}` : ""].filter(Boolean);
  out.push({
    key: "conv",
    title: "Convocatorias",
    text: c.total ? [`${c.answered} de ${c.total} respondidas`, ...counts].join(" · ") : "Aún no hay convocatorias esta temporada",
    href: "/vestuario",
    call: false,
  });
  return out;
}

/** «de la J1 a la J7» / «en la J1» (the season's played jornadas). */
export function jornadaRange(series: SeriesPoint[]): string {
  if (!series.length) return "";
  const a = series[0].j;
  const b = series[series.length - 1].j;
  return a === b ? `en la J${a}` : `de la J${a} a la J${b}`;
}

/** «Se revela en la J1, el 8 de noviembre contra MAD SKY» pieces for the empty season. */
export function firstMatchText(card: CardView): string {
  return card.first ? `el ${longDay(card.first.dateMs)} contra ${card.first.rival}` : "con el primer partido";
}
