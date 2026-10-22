// «El partido»: the header's and the tabs' words by moment (the P- boards' component.js), pure.
import { countdownParts } from "../../../lib/home";
import { madridDate } from "../../../lib/derived/madrid";
import { madridTime } from "../../../lib/derived/madrid";
import type { Fase, ResultWords, Score } from "./model";

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
const DAYMONTH = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

/** «Domingo 18 de octubre». */
export const longDay = (ms: number): string => (Number.isFinite(ms) ? cap(`${WEEKDAY.format(ms)} ${DAYMONTH.format(ms)}`) : "");
/** «Dom 25 oct, 14:00». */
export function shortWhen(ms: number): string {
  if (!Number.isFinite(ms)) return "Sin fecha";
  const wd = cap(WEEKDAY.format(ms).slice(0, 3));
  const [, mo, d] = madridDate(ms).split("-").map(Number);
  const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${wd} ${d} ${MON[mo - 1]}, ${madridTime(ms)}`;
}

/** «Faltan 2 h 14 min», «Faltan 3 días». */
export function leftWords(at: number, now: number): string {
  const { d, h, m } = countdownParts(at, now);
  if (d > 0) return `Faltan ${d} ${d === 1 ? "día" : "días"}`;
  if (h > 0) return `Faltan ${h} h ${m} min`;
  return m > 0 ? `Faltan ${m} min` : "Ya casi";
}

/** «Hoy a las 19:00», «Mañana a las 19:00», «Domingo 25 a las 14:00». */
export function whenWords(at: number, now: number): string {
  const day = (ms: number) => Date.UTC(...(madridDate(ms).split("-").map(Number) as [number, number, number]));
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  const t = madridTime(at);
  if (days === 0) return `Hoy a las ${t}`;
  if (days === 1) return `Mañana a las ${t}`;
  const [, , d] = madridDate(at).split("-").map(Number);
  return `${cap(WEEKDAY.format(at))} ${d} a las ${t}`;
}

export interface StatusIn {
  fase: Fase;
  m: number;
  edge: number;
  dragged: boolean;
  result: ResultWords;
  kick: number;
  now: number;
  postponedTo: number | null;
  cancelled: boolean;
}
export function statusOf(s: StatusIn): string {
  const { fase: f, m, dragged, result: R } = s;
  switch (f) {
    case "antes":
      return Number.isFinite(s.kick) ? `${whenWords(s.kick, s.now)}. ${leftWords(s.kick, s.now)}` : "Sin fecha todavía";
    case "pitido":
      return "Pendiente del pitido inicial";
    case "primera":
      return dragged ? `en directo; estás viendo el minuto ${m}` : "de la primera parte";
    case "segunda":
      return dragged ? `en directo; estás viendo el minuto ${m}` : "de la segunda parte";
    case "descanso":
      return dragged ? `Descanso, ${R.half}. Estás viendo el minuto ${m}` : `Descanso, ${R.half} en la primera parte`;
    case "final":
      return dragged ? `Final, ${R.dash}. Estás viendo el minuto ${m}` : "Final. El acta, en unos minutos";
    case "acta":
    case "despues":
      return dragged ? `${R.word} ${R.dash}. Estás viendo el minuto ${m}` : `Final · ${R.word}`;
    case "aplazado":
      if (s.cancelled) return "No se jugará";
      if (s.postponedTo) return `Se juega el ${longDay(s.postponedTo).charAt(0).toLowerCase()}${longDay(s.postponedTo).slice(1)} a las ${madridTime(s.postponedTo)}`;
      return Number.isFinite(s.kick) ? `Iba a jugarse el ${WEEKDAY.format(s.kick)} ${madridDate(s.kick).split("-").map(Number)[2]} a las ${madridTime(s.kick)}` : "Sin fecha todavía";
    case "pendiente":
      return "Pendiente del acta";
  }
}

/** The page's title, by moment (the long one; the phone's short one beside it). */
export function titleOf(f: Fase, j: string, rival: string, home: boolean, R: ResultWords, cancelled: boolean): { l: string; s: string } {
  const where = home ? "en casa" : "fuera";
  const l: Record<Fase, string> = {
    antes: `${j}Contra ${rival}, ${where}`,
    pitido: `${j}Contra ${rival}, ${where}`,
    primera: `${j}Se juega contra ${rival}`,
    descanso: `${j}Descanso contra ${rival}`,
    segunda: `${j}Se juega contra ${rival}`,
    final: `${j}Terminado ante ${rival}, falta el acta`,
    acta: `${j}${R.word} ${R.dash} ante ${rival}`,
    despues: `${j}${R.word} ${R.dash} ante ${rival}`,
    aplazado: `${j}${cancelled ? "Suspendido" : "Aplazado"}: ${rival}, ${where}`,
    pendiente: `${j}Pendiente del acta ante ${rival}`,
  };
  const s: Record<Fase, string> = {
    antes: `${rival}, ${where}`,
    pitido: `${rival}, ${where}`,
    primera: "En juego",
    descanso: "Descanso",
    segunda: "En juego",
    final: "Falta el acta",
    acta: `${R.word} ${R.dash}`,
    despues: `${R.word} ${R.dash}`,
    aplazado: cancelled ? "Suspendido" : "Aplazado",
    pendiente: "Sin acta",
  };
  return { l: l[f], s: `${j}${s[f]}` };
}

/** The tabs' second lines (long, short) for El partido · El siete · Números; Vestuario's comes from its state. */
export function tabHints(f: Fase, R: ResultWords, kickTime: string, system: string, nChanges: number, hasTable: boolean, pos: string | null): Record<"partido" | "siete" | "numeros", [string, string]> {
  const pre = f === "antes" || f === "pitido";
  const live = f === "primera" || f === "descanso" || f === "segunda";
  const done = f === "acta" || f === "despues";
  const played = live || done || f === "final";
  const partido: Record<Fase, [string, string]> = {
    antes: [`El plan · ${kickTime}`, kickTime],
    pitido: ["A punto de empezar", "Ya casi"],
    primera: ["Jugada a jugada", "En directo"],
    descanso: [`Descanso, ${R.half}`, "Descanso"],
    segunda: ["Jugada a jugada", "En directo"],
    final: [`${R.dash}, falta el acta`, R.dash],
    acta: [`El acta · ${R.dash}`, "El acta"],
    despues: [`El acta · ${R.dash}`, "El acta"],
    aplazado: ["Sin fecha nueva", "Sin fecha"],
    pendiente: ["Sin acta todavía", "Sin acta"],
  };
  const siete: [string, string] = pre
    ? [`En ${system}`, system]
    : live
      ? nChanges
        ? [`${nChanges} ${nChanges === 1 ? "cambio" : "cambios"} ya`, "Ahora"]
        : ["El de salida", "Ahora"]
      : done || f === "final"
        ? ["Quién hizo qué", "Quién jugó"]
        : f === "aplazado"
          ? ["La convocatoria", "Convocados"]
          : [`En ${system}`, system];
  const numeros: [string, string] = pre
    ? ["El rival y la tabla", "El rival"]
    : !hasTable
      ? live
        ? ["Las cifras, en directo", "Las cifras"]
        : played
          ? ["Las cifras del partido", "Las cifras"]
          : ["Sin cifras aún", "Sin cifras"]
      : live
        ? [`Si acaba así: ${pos ?? "–"}`, "Si acaba así"]
        : f === "final"
          ? [`Si se confirma: ${pos ?? "–"}`, `Seremos ${pos ?? "–"}`]
          : done
            ? [`${pos ?? "–"} en la tabla`, pos ?? "–"]
            : f === "aplazado"
              ? ["No cuenta todavía", "No cuenta"]
              : ["Sin acta", "Sin acta"];
  return { partido: partido[f], siete, numeros };
}

export const scoreLabelOf = (rival: string, sc: Score, opts: { played: boolean; pre: boolean; dragged: boolean; live: boolean; m: number; kickTime: string; word: string }): string =>
  opts.played ? `Manchester Piti ${sc.us}, ${rival} ${sc.them}${opts.dragged ? `, en el minuto ${opts.m}` : opts.live ? ", en directo" : ""}` : opts.pre ? `Pitido inicial a las ${opts.kickTime}` : opts.word;
