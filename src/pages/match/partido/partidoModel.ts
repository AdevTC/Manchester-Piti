// «El partido» · the Partido screen's words and shapes (P- boards, place-partido.js), pure: the head by moment,
// the day hour by hour (quedada, pitido, the floodlights, the final), the goals in blocks of ten minutes and by
// halves, «si acaba así», the MVP's lines, the match's signature drawn from the pressure line and the
// aplazado / pendiente words. No React, no Firebase: the screen passes the match's model and the clock.
import { sunPosition, sunTimes } from "../../../lib/derived/sun";
import { madridTime } from "../../../lib/derived/madrid";
import { longDay } from "./words";
import { scoreAt, type Fase, type Play, type ResultWords } from "./model";

const MIN = 60_000;
const NUMWORD = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const numWord = (n: number): string => NUMWORD[n] ?? String(n);

/** «Orduña fc» → «Orduña» (the board's short rival in running text). */
export function rivalShort(r: string): string {
  return r.replace(/\s+(f\.?c\.?|c\.?f\.?|cf|fc)$/i, "").trim() || r;
}

/** «en el CDM Palomeras» · «en el Campo de la Elipa» · «en Leganés». */
export function atVenue(venue: string): string {
  if (!venue) return "";
  return /^(CDM|CDF|Campo|Polideportivo|Estadio|Pabellón|Complejo)\b/i.test(venue) ? `en el ${venue}` : `en ${venue}`;
}

// ---------- the head
export function headOf(f: Fase, o: { kick: number; venue: string; rival: string; home: boolean; result: ResultWords; mesa: string | null; cancelled: boolean; postponedTo: number | null }): { h: string; sub: string } {
  const where = o.home ? `Contra ${o.rival}, en casa` : `En casa de ${o.rival}`;
  const published = o.mesa ? `Publicada por ${o.mesa} desde la mesa` : "El resultado oficial, con sus jugadas";
  switch (f) {
    case "antes": {
      const day = longDay(o.kick);
      const at = atVenue(o.venue);
      return { h: "El plan del día", sub: day && at ? `${day}, ${at}` : day || (at ? at.charAt(0).toUpperCase() + at.slice(1) : "Sin fecha todavía") };
    }
    case "pitido":
      return { h: "A punto de empezar", sub: "La mesa arranca el reloj con el pitido" };
    case "primera":
    case "segunda":
      return { h: "En directo", sub: "Lo apunta la mesa al momento; toca un minuto y la moviola va allí" };
    case "descanso":
      return { h: `Descanso, ${o.result.half}`, sub: "Repasa la primera parte con la moviola" };
    case "final":
      return { h: `Final, ${o.result.dash}`, sub: "El acta, en unos minutos" };
    case "acta":
    case "despues":
      return { h: "El acta", sub: published };
    case "aplazado":
      return { h: o.cancelled ? "Suspendido" : "Aplazado", sub: where };
    case "pendiente":
      return { h: "Pendiente del acta", sub: where };
  }
}

// ---------- before: the day hour by hour
/** The quedada's time: one written in the meeting note («18:30», «18.30», «18h30») when it falls in the four hours
 *  before the kick-off, else half an hour before it (the board's). */
export function meetTimeOf(note: string, kick: number): number {
  const fallback = kick - 30 * MIN;
  if (!Number.isFinite(kick)) return fallback;
  const m = /(?:^|[^\d])([01]?\d|2[0-3])\s*[:.h]\s*([0-5]\d)(?!\d)/.exec(note);
  if (!m) return fallback;
  const [kh, km] = madridTime(kick).split(":").map(Number);
  const meet = kick + (Number(m[1]) * 60 + Number(m[2]) - (kh * 60 + km)) * MIN;
  return meet < kick && kick - meet <= 4 * 60 * MIN ? meet : fallback;
}

/** The floodlights: the first minute (from 2 h 30 before the kick-off to 1 h 30 after) the setting sun is under
 *  3° (a morning sun still rising out of the dark switches nothing on). */
export function focosOf(kick: number): number | null {
  if (!Number.isFinite(kick)) return null;
  for (let t = kick - 150 * MIN; t <= kick + 90 * MIN; t += MIN) {
    const el = sunPosition(t).elevation;
    if (el < 3 && el < sunPosition(t - MIN).elevation) return t;
  }
  return null;
}

export interface Step {
  at: number;
  h: string;
  t: string;
  d: string;
  cls: string;
}
/** «El día, hora a hora»: the quedada (members), the whistle, the floodlights when they come on before the end,
 *  and the final, in time order. */
export function dayPlan(o: { kick: number; duration: number; member: boolean; meet: number; meetNote: string; mesa: string | null; whistle: boolean }): Step[] {
  const { kick, duration } = o;
  if (!Number.isFinite(kick)) return [];
  const end = kick + duration * MIN;
  const steps: Step[] = [];
  if (o.member) steps.push({ at: o.meet, h: madridTime(o.meet), t: "Quedada", d: o.meetNote.trim() || "Media hora antes del pitido.", cls: "" });
  steps.push({ at: kick, h: madridTime(kick), t: "Pitido inicial", d: `${duration} minutos de fútbol 7.${o.mesa ? ` Lo anota ${o.mesa} desde la mesa.` : ""}`, cls: o.whistle ? "is-key is-now" : "is-key" });
  const focos = focosOf(kick);
  if (focos != null && focos < end) {
    const sunset = madridTime(sunTimes(kick).sunset);
    const half = kick + (duration / 2) * MIN;
    const how = focos <= kick ? "todo el partido se juega con luz artificial" : focos < half ? "la segunda parte se juega con luz artificial" : "el final se juega con luz artificial";
    steps.push({ at: focos, h: madridTime(focos), t: "Encienden los focos", d: `El sol se pone a las ${sunset}: ${how}.`, cls: "" });
  }
  steps.push({ at: end, h: madridTime(end), t: "Final", d: "Se abre el voto del MVP: 48 horas, en el vestuario de esta página.", cls: "" });
  return steps.sort((a, b) => a.at - b.at);
}

const POS_WORD: Record<string, string> = { POR: "portero", LI: "lateral izquierdo", DFC: "central", LD: "lateral derecho", MC: "mediocentro", MCD: "mediocentro", MI: "interior izquierdo", MD: "interior derecho", MP: "mediapunta", EI: "extremo izquierdo", ED: "extremo derecho", DC: "delantero centro" };
/** «El siete ya está publicado: 3-2-1, con Adrián T.C., el capitán, de mediocentro.» (null until it is published). */
export function sevenLine(o: { published: boolean; system: string; captain: string | null; captainName: string; captainCode: string | null }): string | null {
  if (!o.published) return null;
  const cap = o.captain && o.captainCode ? `, con ${o.captainName}, el capitán, de ${POS_WORD[o.captainCode] ?? "titular"}` : "";
  return `El siete ya está publicado: ${o.system}${cap}.`;
}

// ---------- live: the goals in blocks of ten and by halves, up to the moviola's minute
export interface Block {
  lab: string;
  us: number;
  them: number;
  usH: number;
  themH: number;
  later: boolean;
  aria: string;
}
export function goalBlocks(plays: readonly Play[], upto: number, duration: number, rival: string): Block[] {
  const n = Math.max(1, Math.ceil(duration / 10));
  const raw = Array.from({ length: n }, (_, i) => {
    const a = i * 10;
    const b = Math.min(duration, a + 10);
    let us = 0;
    let them = 0;
    for (const p of plays) {
      if (p.m > upto) continue;
      const inBlock = i === 0 ? p.m <= b : p.m > a && (p.m <= b || (i === n - 1 && p.m > b));
      if (!inBlock) continue;
      if (p.k === "gol") us++;
      if (p.k === "rival") them++;
    }
    return { a, b, us, them };
  });
  const max = Math.max(1, ...raw.map((x) => Math.max(x.us, x.them)));
  return raw.map((x) => ({
    lab: `${x.a}–${x.b}′`,
    us: x.us,
    them: x.them,
    usH: Math.round((x.us / max) * 100),
    themH: Math.round((x.them / max) * 100),
    later: x.a >= upto,
    aria: `Del ${x.a} al ${x.b}: ${x.us} del Piti y ${x.them} de ${rival}`,
  }));
}
export function halvesOf(plays: readonly Play[], upto: number, duration: number): { t: string; s: string }[] {
  const half = duration / 2;
  const h1 = scoreAt(plays, Math.min(upto, half));
  const h2 = scoreAt(plays, upto);
  return [{ t: "1ª parte", s: `${h1.us}–${h1.them}` }, ...(upto > half ? [{ t: "2ª parte", s: `${h2.us - h1.us}–${h2.them - h1.them}` }] : [])];
}
export const blocksTitle = (upto: number, duration: number): string => (upto >= duration ? "Los goles, de diez en diez" : `Los goles hasta el ${upto}′, de diez en diez`);

/** «Si acaba así» (live) / «Si el acta lo confirma» (final): points, or the table when the season has one. */
export function asiOf(o: { fase: Fase; us: number; them: number; m: number; table: { position: number | null } | null }): { k: string; t: string; sub: string; go: string } {
  const k = o.fase === "final" ? "Si el acta lo confirma" : "Si acaba así";
  const win = o.us > o.them;
  const draw = o.us === o.them;
  const score = o.fase === "final" ? `Con el ${o.us}–${o.them} final` : `Con el ${o.us}–${o.them} del minuto ${o.m}`;
  if (o.table) {
    const pos = o.table.position;
    const t = win ? (pos === 1 ? "Dormimos líderes" : "Tres puntos") : draw ? "Empate y un punto" : "Nos quedamos a cero";
    return { k, t, sub: `${score}${pos ? `: ${pos}º en la tabla` : ""}.`, go: "Ver la tabla, si acaba así" };
  }
  return { k, t: win ? "Tres puntos" : draw ? "Un punto" : "Sin puntos esta vez", sub: "La liga aún no ha publicado la clasificación: los puntos cuentan en cuanto la suba.", go: "Ver las cifras del partido" };
}

// ---------- after: the MVP
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
const DAYMONTH = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
const DAYKEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
const dayKey = (ms: number) => DAYKEY.format(ms);
/** «hoy a las 21:54» · «mañana a las 21:54» · «el viernes a las 21:54» · «el 30 de octubre a las 21:54». */
export function closesWords(at: number, now: number): string {
  const days = Math.round((Date.parse(dayKey(at)) - Date.parse(dayKey(now))) / 86_400_000);
  const t = madridTime(at);
  if (days === 0) return `hoy a las ${t}`;
  if (days === 1) return `mañana a las ${t}`;
  if (days > 1 && days < 7) return `el ${WEEKDAY.format(at)} a las ${t}`;
  return `el ${DAYMONTH.format(at)} a las ${t}`;
}

export interface MvpView {
  decided: boolean;
  k: string;
  line: string;
  vote: boolean;
  winners: string[];
}
export function mvpView(o: {
  fase: Fase;
  member: boolean;
  jornada: number | null;
  winners: string[];
  counts: Record<string, number>;
  total: number;
  eligible: number | null;
  closesAt: number | null;
  now: number;
  nameOf: (id: string) => string;
}): MvpView {
  const of = o.eligible ? ` de ${o.eligible}` : "";
  const decided = o.fase === "despues" && o.winners.length > 0;
  if (decided) {
    const names = o.winners.map(o.nameOf);
    const who = names.length < 2 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
    const n = o.counts[o.winners[0]] ?? 0;
    return {
      decided,
      k: `MVP${o.winners.length > 1 ? " compartido" : ""} ${o.jornada ? `de la J${o.jornada}` : "del partido"}`,
      line: `${who}, con ${n} de ${o.total} votos${o.winners.length > 1 ? " cada uno" : ""}. Lo eligió el vestuario.`,
      vote: false,
      winners: o.winners,
    };
  }
  if (o.fase === "despues")
    return { decided, k: "El MVP", line: o.total ? `La votación cerró con ${o.total}${of} votos: el MVP sale cuando se publique el recuento.` : "Nadie votó al MVP de este partido.", vote: false, winners: [] };
  const until = o.closesAt ? ` hasta ${closesWords(o.closesAt, o.now)}` : "";
  const turnout = o.total ? `${o.total === 1 ? "Ya ha votado" : "Ya han votado"} ${o.total}${of}` : "Aún no ha votado nadie";
  return {
    decided,
    k: "El MVP, votándose",
    line: o.member ? `Se vota${until}. ${turnout}; el recuento sale al cerrar.` : `El vestuario vota al MVP${until}: ${turnout.charAt(0).toLowerCase()}${turnout.slice(1)}.`,
    vote: o.fase === "acta" && o.member,
    winners: [],
  };
}

// ---------- after: the match's signature
/** The minutes around a circle (the whistle on top, the break at the bottom): out when the Piti presses, in when the
 *  rival does; a dot for every goal, ours out and theirs in. */
export function firmaOf(pulse: readonly number[], plays: readonly Play[], duration: number): { d: string; dots: { x: string; y: string; them: boolean }[] } {
  const pts: [number, number][] = [];
  for (let i = 0; i <= duration; i++) {
    const a = ((-90 + (i / duration) * 360) * Math.PI) / 180;
    const r = 52 + (pulse[i] ?? 0) * 2.2;
    pts.push([80 + r * Math.cos(a), 80 + r * Math.sin(a)]);
  }
  const f = (x: number) => x.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let j = 1; j < pts.length; j++) {
    const p0 = pts[j - 2] ?? pts[j - 1];
    const p1 = pts[j - 1];
    const p2 = pts[j];
    const p3 = pts[j + 1] ?? pts[j];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)},${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)},${f(p2[0])} ${f(p2[1])}`;
  }
  const dots = plays
    .filter((p) => p.k === "gol" || p.k === "rival")
    .map((p) => {
      const m = Math.max(0, Math.min(duration, p.m));
      const a = ((-90 + (m / duration) * 360) * Math.PI) / 180;
      const v = pulse[m] ?? 0;
      const r = p.k === "gol" ? 52 + Math.max(0, v) * 2.2 + 7 : 52 + Math.min(0, v) * 2.2 - 8;
      return { x: f(80 + r * Math.cos(a)), y: f(80 + r * Math.sin(a)), them: p.k === "rival" };
    });
  return { d: `${d} Z`, dots };
}
/** «…; un gol nuestro y ocho suyos». */
export function firmaGoals(us: number, them: number): string {
  return `${us === 1 ? "un gol nuestro" : `${numWord(us)} goles nuestros`} y ${numWord(them)} ${them === 1 ? "suyo" : "suyos"}`;
}

// ---------- aplazado / pendiente
export interface OffView {
  big: string;
  d: string;
  facts: { icon: "chart" | "star" | "cal" | "mesa"; t: string }[];
  notify: boolean;
  mesa: boolean;
  side: string;
}
export function offOf(f: "aplazado" | "pendiente", o: { reason: string; mesa: boolean; cancelled: boolean; postponedTo: number | null }): OffView {
  if (f === "aplazado") {
    const reason = o.reason.trim() ? `${o.reason.trim().replace(/\.?$/, ".")} ` : "";
    if (o.cancelled)
      return { big: "No se jugará", d: `${reason}El partido queda suspendido.`, facts: [{ icon: "chart", t: "La tabla no lo cuenta." }, { icon: "star", t: "La porra y el voto del MVP no se abren." }], notify: false, mesa: false, side: "" };
    if (o.postponedTo != null && Number.isFinite(o.postponedTo))
      return {
        big: `Se juega el ${longDay(o.postponedTo).charAt(0).toLowerCase()}${longDay(o.postponedTo).slice(1)}`,
        d: `${reason}La nueva hora: las ${madridTime(o.postponedTo)}.`,
        facts: [{ icon: "chart", t: "La tabla no lo cuenta hasta que se juegue." }, { icon: "cal", t: "La convocatoria y la porra se abren otra vez para la nueva fecha." }],
        notify: false,
        mesa: false,
        side: "El siete que estaba publicado se guarda en «El siete», atenuado, hasta la nueva fecha.",
      };
    return {
      big: "Sin fecha nueva todavía",
      d: `${reason}La liga pondrá la fecha y te avisamos en cuanto la haya.`,
      facts: [
        { icon: "chart", t: "La tabla no lo cuenta hasta que se juegue." },
        { icon: "star", t: "La porra queda en pausa: no suma puntos mientras esté aplazado." },
        { icon: "cal", t: "La convocatoria se abre otra vez cuando haya fecha nueva." },
      ],
      notify: true,
      mesa: false,
      side: "El siete que estaba publicado se guarda en «El siete», atenuado, hasta la nueva fecha.",
    };
  }
  const facts: OffView["facts"] = [
    { icon: "chart", t: "Sin acta, la tabla y los números no cuentan este partido todavía." },
    { icon: "star", t: "El voto del MVP y la porra se abren al publicarla." },
  ];
  if (o.mesa) facts.push({ icon: "mesa", t: "Escribe el resultado y las jugadas en la mesa y publica el acta." });
  return {
    big: "El resultado llega con el acta",
    d: "Nadie arrancó el reloj en la mesa: no hubo marcador en directo.",
    facts,
    notify: !o.mesa,
    mesa: o.mesa,
    side: "Con el acta llegan el marcador, los minutos de cada uno, los números y el voto del MVP.",
  };
}

/** «Te avisaremos de la fecha» / «Avísame cuando esté el acta»… */
export const notifyLabel = (f: "aplazado" | "pendiente", on: boolean): string =>
  on ? (f === "aplazado" ? "Te avisaremos de la fecha" : "Te avisaremos del acta") : f === "aplazado" ? "Avísame cuando haya fecha" : "Avísame cuando esté el acta";

// ---------- «Al calendario»
/** An .ics event with a DESCRIPTION (the quedada) added after its SUMMARY (lib/ics writes none). */
export function icsWithDescription(ics: string, text: string): string {
  if (!text.trim()) return ics;
  const esc = text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  const lines = ics.split("\r\n");
  const i = lines.findIndex((l) => l.startsWith("SUMMARY:"));
  lines.splice(i < 0 ? lines.length - 2 : i + 1, 0, `DESCRIPTION:${esc}`);
  return lines.join("\r\n");
}
