// Avisos (TU boards: the bell, «Tú», /avisos and /avisos/a-medida), pure: who looks, what kind each notice is, its
// icon and its in-place actions, the bandeja's filters and their counts, what is unread, the match stacks and the
// days, the device's words, the presets and the pause. The board's component.js renderVals() in the app's terms;
// the hook (useInbox) reads, the screens draw.
import type { Notice } from "../../../lib/derived/notices";
import { noticeMatchId } from "../../../../functions/src/noticeUrl";
import type { MatchMark } from "../../../lib/derived/vidrio/matchMarks";
import type { TuIconName } from "../../../components/vidrio/tu/ui";
import type { PushChoice, PushState } from "../../../lib/push";
import type { PauseKind } from "../../../../functions/src/pushPauseLogic";
import type { TuMovil, TuQuien } from "../../../components/vidrio/tu/maqueta";

// ---------- who looks

/** The board's viewers: a fan (no session), a socio without a ficha, a new account, a player (his ficha linked). */
export type Who = "fan" | "socio" | "nuevo" | "jugador";
export interface Viewer {
  who: Who;
  /** A captain (an admin): the door, the payments and the bajas too. */
  captain: boolean;
}

/** Who looks, from the session (`member`, `admin`, `playerId`, a pending claim) or the DEV maqueta's «quien». */
export function viewerOf(real: { member: boolean; admin: boolean; playerId: string | null; pendingClaim?: boolean }, quien: TuQuien | null): Viewer {
  if (quien === "fan") return { who: "fan", captain: false };
  if (quien === "socio") return { who: "socio", captain: false };
  if (quien === "nuevo" || quien === "pendiente") return { who: "nuevo", captain: false };
  if (quien === "jugador") return { who: "jugador", captain: false };
  if (quien === "capitan" || quien === "admin") return { who: real.playerId ? "jugador" : "socio", captain: true };
  if (!real.member) return { who: "fan", captain: false };
  return { who: real.playerId ? "jugador" : real.pendingClaim ? "nuevo" : "socio", captain: real.admin };
}

/** The notices a viewer reads: a captain's are the team's, his own and the captains'; anyone else's lose the
 *  captains' (the maqueta's player looking through a captain's session). */
export function noticesFor(list: readonly Notice[], v: Viewer): Notice[] {
  if (v.who === "fan") return [];
  return v.captain ? [...list] : list.filter((n) => n.audience !== "captains");
}

// ---------- each notice

export type NoticeKind = "partido" | "vestuario" | "tuyo";
export const KIND_LABEL: Record<NoticeKind, string> = { partido: "Del partido", vestuario: "Del vestuario", tuyo: "Tuyo" };
const MATCH_TOPICS = new Set(["start", "goals", "cards", "final", "mvp", "lineup", "dates", "tabla"]);

/** «Tuyo» (personal), «Del partido» (the match's topics, the poll excepted) or «Del vestuario». */
export function kindOf(n: Pick<Notice, "audience" | "topic" | "title">): NoticeKind {
  if (n.audience === "personal") return "tuyo";
  if (n.title === "Nueva encuesta") return "vestuario";
  return MATCH_TOPICS.has(n.topic) ? "partido" : "vestuario";
}

/** The match a notice is about (its address), null for the vestuario's. The table's notice has no match. */
export const matchOf = (n: Pick<Notice, "url">): string | null => noticeMatchId(n.url);

const ICON: Record<string, TuIconName> = { goals: "ball", start: "whistle", cards: "card", final: "flag", mvp: "star", lineup: "shirt", dates: "cal", convocatoria: "check", personal: "user", rota: "wash", polls: "poll", caja: "euro", access: "lock", door: "door", tabla: "chart" };
/** The board's glyph of a notice (the poll's bars, a turno's wash, else its topic's). */
export function iconOf(n: Pick<Notice, "topic" | "title">): TuIconName {
  if (n.title === "Nueva encuesta") return "poll";
  if (n.topic === "personal" && /^Te toca /.test(n.title)) return "wash";
  if (/^Pago avisado/.test(n.title)) return "euro";
  return ICON[n.topic] ?? "bell";
}

/** The topics a notice can be silenced by on this device (its row's «⋯»), with the board's names. */
export const TOPIC_NAME: Record<string, string> = {
  goals: "Goles",
  start: "Empieza y descanso",
  cards: "Tarjetas",
  final: "El final",
  mvp: "El MVP",
  lineup: "El siete y la convocatoria",
  dates: "Fechas nuevas",
  tabla: "La clasificación",
  convocatoria: "La convocatoria",
  door: "La puerta",
};
export const MUTABLE = new Set(Object.keys(TOPIC_NAME));

/** A notice's own actions, right on its row (component.js actsOf, real.js's words). */
export type ActKey = "open" | "goles" | "acta" | "cal" | "conv" | "carta" | "caja";
export function actsOf(n: Pick<Notice, "topic" | "title" | "url" | "audience">): { k: ActKey; t: string }[] {
  if (n.topic === "goals") return [{ k: "open", t: "Abrir el partido" }, { k: "goles", t: "Solo goles" }];
  if (n.topic === "final") return [{ k: "acta", t: "Leer la crónica" }];
  if (n.topic === "mvp" && /^MVP/.test(n.title)) return [{ k: "acta", t: "Ver el acta" }];
  if (n.topic === "dates") return [{ k: "cal", t: "Al calendario" }];
  if (n.topic === "convocatoria" && n.audience === "captains") return [{ k: "conv", t: "Ver la convocatoria" }];
  if (n.topic === "lineup" && /convocatoria/i.test(n.title)) return [{ k: "conv", t: "Ver la convocatoria" }];
  if (/^Pago avisado/.test(n.title)) return [{ k: "caja", t: "Confirmar en la caja" }];
  if (n.audience === "personal" && n.url.startsWith("/perfil")) return [{ k: "carta", t: "Ver tu carta" }];
  return [];
}

// ---------- the bandeja's filters (?ver=)

export type AvFilter = "todos" | "toca" | "sinleer" | "partidos" | "vestuario" | "tuyos" | `m:${string}`;
const VER: Record<string, AvFilter> = { "te-toca": "toca", "sin-leer": "sinleer", partidos: "partidos", partido: "partidos", vestuario: "vestuario", tuyos: "tuyos" };

/** The filter an address asks for (?ver=…, the board's words; «partido-<id>» one match). */
export function filterOf(ver: unknown): AvFilter {
  if (typeof ver !== "string") return "todos";
  if (VER[ver]) return VER[ver];
  const m = /^partido-([A-Za-z0-9_-]+)$/.exec(ver);
  return m ? `m:${m[1]}` : "todos";
}
/** The ?ver= of a filter (none for «Todos»). */
export function verOf(f: AvFilter): string | undefined {
  if (f === "todos") return undefined;
  if (f.startsWith("m:")) return `partido-${f.slice(2)}`;
  return { toca: "te-toca", sinleer: "sin-leer", partidos: "partidos", vestuario: "vestuario", tuyos: "tuyos" }[f as "toca"];
}

// ---------- unread, the feed, the stacks, the days

export const unreadText = (n: number): string => (n === 0 ? "Al día" : `${n} sin leer`);
export const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The feed: the notices that no «Te toca» item holds (an answered convocatoria is in «Te toca», not twice). */
export function feedOf<T extends Pick<Notice, "id">>(list: readonly T[], tied: ReadonlySet<string>): T[] {
  return list.filter((n) => !tied.has(n.id));
}

/** Each match one stack, newest first (the order its newest notice gives), and the loose ones. */
export function stacksOf<T extends Pick<Notice, "url">>(feed: readonly T[]): { stacks: { matchId: string; rows: T[] }[]; loose: T[] } {
  const by = new Map<string, T[]>();
  const loose: T[] = [];
  for (const n of feed) {
    const id = matchOf(n);
    if (!id) {
      loose.push(n);
      continue;
    }
    const rows = by.get(id) ?? [];
    rows.push(n);
    by.set(id, rows);
  }
  return { stacks: [...by.entries()].map(([matchId, rows]) => ({ matchId, rows })), loose };
}

export interface FilterRow {
  f: AvFilter;
  t: string;
  n: number;
}
/** The rail's filters and their counts (component.js F). */
export function filterRows(list: readonly Pick<Notice, "url" | "audience" | "topic" | "title">[], openPend: number, unread: number): FilterRow[] {
  return [
    { f: "toca", t: "Te toca", n: openPend },
    { f: "sinleer", t: "Sin leer", n: unread },
    { f: "todos", t: "Todos", n: list.length },
    { f: "partidos", t: "Partidos", n: list.filter((n) => !!matchOf(n)).length },
    { f: "vestuario", t: "Del vestuario", n: list.filter((n) => kindOf(n) === "vestuario").length },
    { f: "tuyos", t: "Tuyos", n: list.filter((n) => kindOf(n) === "tuyo").length },
  ];
}

/** What a filter shows: «Te toca», the stacks (all, or one match open), the loose rows by day, the unread rows. */
export function shownBy(f: AvFilter): { pend: boolean; stacks: "all" | "one" | "none"; loose: "all" | "vestuario" | "tuyos" | "none"; unread: boolean } {
  if (f.startsWith("m:")) return { pend: false, stacks: "one", loose: "none", unread: false };
  switch (f) {
    case "toca":
      return { pend: true, stacks: "none", loose: "none", unread: false };
    case "sinleer":
      return { pend: false, stacks: "none", loose: "none", unread: true };
    case "partidos":
      return { pend: false, stacks: "all", loose: "none", unread: false };
    case "vestuario":
      return { pend: false, stacks: "none", loose: "vestuario", unread: false };
    case "tuyos":
      return { pend: false, stacks: "none", loose: "tuyos", unread: false };
    default:
      return { pend: true, stacks: "all", loose: "all", unread: false };
  }
}

// ---------- a match's stack

export type Res = "G" | "E" | "P" | "";
export const RES_WORD: Record<Exclude<Res, "">, string> = { G: "Ganamos", E: "Empatamos", P: "Perdimos" };

export const resOf = (finished: boolean, gf: number, ga: number): Res => (!finished ? "" : gf > ga ? "G" : gf < ga ? "P" : "E");

/** «8 goles de Orduña fc · 1 nuestro · 2 tarjetas» for a played match (from its marks); before it, the first two
 *  notices' titles. */
export function stackSummary(res: Res, rival: string, marks: readonly MatchMark[], titles: readonly string[]): string {
  if (!res) return titles.slice(0, 2).join(" · ");
  const them = marks.filter((m) => m.k === "them").length;
  const us = marks.filter((m) => m.k === "us").length;
  const cards = marks.filter((m) => m.k === "card-us" || m.k === "card-them").length;
  return [them ? pl(them, `gol de ${rival}`, `goles de ${rival}`) : "", us ? pl(us, "nuestro", "nuestros") : "", cards ? pl(cards, "tarjeta", "tarjetas") : ""].filter(Boolean).join(" · ");
}

/** The words a stack's timeline is read as. */
export function timelineAlt(res: Res, gf: number, ga: number, rival: string): string {
  if (!res) return `Por jugar contra ${rival}`;
  return `${RES_WORD[res]} ${gf}–${ga} contra ${rival}`;
}

const TZ = "Europe/Madrid";
const WHEN = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" });
const TIME = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const clean = (s: string) => s.replace(/\./g, "").replace(",", "");

/** «domingo 18 oct · 19:00 · en casa». */
export function whenLine(at: number, home: boolean | null | undefined): string {
  if (!Number.isFinite(at)) return "";
  return [clean(WHEN.format(at)), TIME.format(at), home === true ? "en casa" : home === false ? "fuera" : ""].filter(Boolean).join(" · ");
}

/** The two letters on a stack's disc («OR» for Orduña fc), from the rival's own initials when it has them. */
export function rivalIni(rival: string, own?: string | null): string {
  if (own && own.trim()) return own.trim().slice(0, 2).toUpperCase();
  const words = rival.replace(/\b(fc|f\.c\.|cf|cd|ud|de|del)\b/gi, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? rival).slice(0, 2).toUpperCase();
}

// ---------- «Te toca»

/** «Te toca · 5», or «Te toca · todo hecho». */
export const pendTitle = (open: number): string => (open ? `Te toca · ${open}` : "Te toca · todo hecho");
/** Under the one shown in «Tú»: «4 cosas más te tocan». */
export const tocaMore = (open: number): string => (open > 1 ? `${pl(open - 1, "cosa más", "cosas más")} te toca${open > 2 ? "n" : ""}` : "");

export type Answer = "yes" | "maybe" | "no";
export const ANSWER_WORD: Record<Answer, string> = { yes: "Voy", maybe: "Duda", no: "No voy" };
export const ANSWERED: Record<Answer, string> = { yes: "Has dicho que vas.", maybe: "Has dicho que tienes duda.", no: "Has dicho que no vas." };
export const ANSWER_SAID: Record<Answer, string> = { yes: "Apuntado: vas.", maybe: "Apuntado: tienes duda.", no: "Apuntado: no vas." };

/** «J2 · 14:00 · fuera · contestan 6 de 16». */
export function rsvpBody(j: number | null, at: number, home: boolean | null | undefined, answered: number, squad: number): string {
  return [j ? `J${j}` : "", Number.isFinite(at) ? TIME.format(at) : "", home === true ? "en casa" : home === false ? "fuera" : "", squad > 0 ? `contestan ${answered} de ${squad}` : ""].filter(Boolean).join(" · ");
}

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long" });
const DAY_NUM = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric" });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayGap = (a: number, b: number) => Math.round((Date.parse(`${DAY_KEY.format(b)}T00:00:00Z`) - Date.parse(`${DAY_KEY.format(a)}T00:00:00Z`)) / 86_400_000);

/** «hoy a las 23:54», «mañana a las 23:54», «el viernes a las 23:54», further «el viernes 30 a las 23:54». */
export function closesAt(at: number, now: number): string {
  const d = dayGap(now, at);
  const day = d <= 0 ? "hoy" : d === 1 ? "mañana" : d < 7 ? `el ${WEEKDAY.format(at)}` : `el ${DAY_NUM.format(at)}`;
  return `${day} a las ${TIME.format(at)}`;
}
/** «5 de 7 ya han votado · se cierra el viernes a las 23:54». */
export function mvpBody(votes: number, eligible: number | null, closes: number, now: number): string {
  const turnout = eligible ? `${votes} de ${eligible} ya han votado` : votes === 1 ? "1 ya ha votado" : `${votes} ya han votado`;
  return `${turnout} · se cierra ${closesAt(closes, now)}`;
}
/** «Puedes cambiarlo hasta el domingo 25.» */
export const untilDay = (at: number): string => `hasta el ${DAY_NUM.format(at)}`;

// ---------- this device

export type DeviceKind = "listo" | "iphone" | "bloqueado" | "nosoporta";
export const deviceKindOf = (s: PushState, maq: TuMovil | null): DeviceKind => maq ?? (s === "ready" ? "listo" : s === "ios-install" ? "iphone" : s === "denied" ? "bloqueado" : "nosoporta");

export interface DeviceWords {
  tone: "ok" | "warn" | "bad";
  chip: string;
  title: string;
  dev: string;
  steps: string[];
  btn: string;
}
/** The «Este móvil» card (component.js dev): `name` «Chrome en Windows», `steps` how to unblock in this browser. */
export function deviceWords(kind: DeviceKind, o: { name: string; receiving: boolean; unblock: readonly string[]; ipad?: boolean }): DeviceWords {
  if (kind === "listo") return { tone: "ok", chip: "Listo", title: o.receiving ? "Este móvil recibe avisos" : "Este móvil puede recibir avisos", dev: `${o.name} · avisos permitidos`, steps: [], btn: "" };
  if (kind === "iphone") {
    const dev = o.ipad ? "iPad" : "iPhone";
    return { tone: "warn", chip: "Falta un paso", title: `En ${dev}, primero instala la web`, dev: `${dev} · Safari, sin añadir a la pantalla de inicio`, steps: ["En Safari, pulsa Compartir", "Elige Añadir a pantalla de inicio", "Abre Manchester Piti desde el icono y vuelve aquí"], btn: "Ya la he añadido" };
  }
  if (kind === "bloqueado") return { tone: "bad", chip: "Bloqueados", title: "Bloqueaste los avisos en este navegador", dev: "Se pueden volver a permitir en tres pasos", steps: [...o.unblock], btn: "Ya los he permitido" };
  return { tone: "bad", chip: "No disponible", title: "Este navegador no admite avisos", dev: "Navegador sin notificaciones web. Mientras, el calendario te recuerda cada partido.", steps: [], btn: "Ir al calendario" };
}
/** The bell's line when this device can't ring (bell.blockedText). */
export function blockedText(kind: DeviceKind): string {
  if (kind === "iphone") return "En este iPhone aún no te llegan: falta instalar la web.";
  if (kind === "bloqueado") return "Los ves aquí, pero no te llegan: bloqueaste los avisos en este navegador.";
  return "Este navegador no recibe avisos: los ves aquí y en el calendario.";
}

// ---------- the presets and the pause

export const PRESET_WORD: Record<PushChoice, string> = { goles: "Solo goles", todo: "Todo", nada: "Nada", custom: "A medida" };
/** The board's notes under the shortcuts. */
export const PRESET_NOTE: Record<PushChoice, string> = {
  goles: "Te avisamos de cada gol, nuestro o suyo.",
  todo: "Goles, tarjetas, descanso, final, acta, el siete y tus turnos.",
  nada: "Sin avisos. El marcador sigue en la web.",
  custom: "Los avisos que eliges uno a uno, aquí debajo.",
};
/** «Este móvil: Todo» / «En pausa». */
export const presetLine = (choice: PushChoice, paused: boolean): string => (paused ? "En pausa" : PRESET_WORD[choice]);

export const PAUSES: { k: PauseKind; t: string }[] = [
  { k: "1h", t: "Una hora" },
  { k: "manana", t: "Hasta mañana" },
  { k: "partido", t: "Hasta después del partido" },
];
const PAUSE_WORDS: Record<PauseKind, string> = { "1h": "durante una hora", manana: "hasta mañana a las 9:00", partido: "hasta después del próximo partido" };
/** «Avisos en pausa en este móvil durante una hora.» */
export const pauseLine = (k: PauseKind): string => `Avisos en pausa en este móvil ${PAUSE_WORDS[k]}.`;
/** The toast on pausing. */
export const pauseSaid = (k: PauseKind): string => `Pausados ${PAUSE_WORDS[k]}. Siguen llegando a la campana.`;

/** A topic on this device for «Tema a tema» (component.js TOPICS, the app's «tabla» after the siete). */
export interface TopicRow {
  id: "start" | "goals" | "cards" | "final" | "mvp" | "dates" | "lineup" | "tabla" | "convocatoria" | "door";
  t: string;
  d: string;
  icon: TuIconName;
  who?: "member" | "cap";
}
export const TOPICS: readonly TopicRow[] = [
  { id: "start", t: "Empieza el partido", d: "El pitido inicial, el descanso y la 2ª parte", icon: "whistle" },
  { id: "goals", t: "Goles", d: "Cada gol, nuestro y suyo, al momento", icon: "ball" },
  { id: "cards", t: "Tarjetas", d: "Las amarillas y las rojas, en directo", icon: "card" },
  { id: "final", t: "Final", d: "El resultado en cuanto pita el árbitro", icon: "flag" },
  { id: "mvp", t: "MVP de la jornada", d: "Cuando se abre y se cierra la votación", icon: "star" },
  { id: "dates", t: "Cambios de fecha u hora", d: "Si un partido se mueve", icon: "cal" },
  { id: "lineup", t: "Cuando salga el siete oficial", d: "El capitán publica el siete del domingo", icon: "shirt" },
  { id: "tabla", t: "Cuando se publique la clasificación", d: "La tabla de la liga, en Partidos", icon: "chart" },
  { id: "convocatoria", t: "Si no has contestado", d: "La convocatoria, 48 h y 24 h antes; a los capitanes, las bajas de última hora", icon: "check", who: "member" },
  { id: "door", t: "Alguien llama a la puerta", d: "Peticiones para entrar al vestuario", icon: "door", who: "cap" },
];
export const topicsFor = (v: Viewer): TopicRow[] => TOPICS.filter((t) => !t.who || (t.who === "member" && v.who !== "fan") || (t.who === "cap" && v.captain));

/** «Lo próximo: J2, domingo 25 a las 14:00, en casa de Pitutis.» */
export function nextLine(next: { j: number | null; at: number; home: boolean | null | undefined; rival: string } | null): string {
  if (!next) return "Aún no hay próximo partido en el calendario.";
  const day = Number.isFinite(next.at) ? `${DAY_NUM.format(next.at)} a las ${TIME.format(next.at)}` : "sin fecha";
  const where = next.home === false ? `en casa de ${next.rival}` : `en casa contra ${next.rival}`;
  return `Lo próximo: ${next.j ? `J${next.j}, ` : ""}${day}, ${where}.`;
}

/** The test notices, in turn (component.js TEST): `name` your shirt or @apodo. */
export function testNotice(n: number, o: { name: string; rival: string | null; j: number | null }): { title: string; body: string } {
  const r = o.rival || "el rival";
  const list = [
    { title: `GOOOL · ${o.name} · 31′`, body: `Manchester Piti 2–1 ${r}${o.j ? ` · J${o.j}` : ""}` },
    { title: "Ya está el siete", body: `El capitán ha publicado el siete para ${r}` },
    { title: "Final · 3–1", body: `Manchester Piti gana a ${r}. Vota al MVP` },
  ];
  return list[(((n - 1) % list.length) + list.length) % list.length];
}
