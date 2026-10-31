// «Tú» (the four places, IMPL-SPEC 2026-11): who looks at /perfil, which places his page has (Tú · Partidos ·
// Juego · Vitrina + the gear «Ajustes» with its sections), what each address shows and the direction a move
// between them takes. Pure: the page (ProfilePage) reads the screen from the address and draws it.
import { apiError } from "../../../lib/clubApi";
import { PERFIL_MOVES } from "../../../lib/legacyUrls";

/** «Salir en este dispositivo» failed: say why (the connection, Google…), not only that it failed. */
export const signOutFailText = (e: unknown): string => `No se ha podido cerrar la sesión. ${apiError(e)}`;

/** Who looks: no session · a member without a ficha (his carné) · a new account whose ficha is pending or was
 *  turned down (the sobre / the pick) · a player with his ficha linked. */
export type Kind = "fan" | "socio" | "nuevo" | "jugador";
/** The places: the four of the bar and the gear. */
export type Sec = "tu" | "partidos" | "juego" | "vitrina" | "ajustes";
/** Ajustes' sections (/perfil/ajustes/<section>). */
export type AjSec = "nombre" | "avisos" | "apariencia" | "cuenta" | "capitania";
/** The two surfaces with an address of their own: the studio (over Vitrina… or wherever it was opened) and the
 *  cromos viewer (over Vitrina). */
export type Open = "compartir" | "cromos" | null;
export type Page = "perfil" | "avisos";

export interface Screen {
  page: Page;
  sec: Sec;
  /** Ajustes' section (null: the index — the phone's list; on a desktop the first section beside it). */
  aj: AjSec | null;
  open: Open;
}

/** The places in their order (the move's direction follows it; the gear last). */
export const SECS: readonly Sec[] = ["tu", "partidos", "juego", "vitrina", "ajustes"];
/** Ajustes' sections in their order. */
export const AJ_SECS: readonly AjSec[] = ["nombre", "avisos", "apariencia", "cuenta", "capitania"];

const PATH: Record<Sec, string> = {
  tu: "/perfil",
  partidos: "/perfil/partidos",
  juego: "/perfil/juego",
  vitrina: "/perfil/vitrina",
  ajustes: "/perfil/ajustes",
};
export const COMPARTIR_PATH = "/perfil/compartir";
export const CROMOS_PATH = "/perfil/vitrina/cromos";
export const AVISOS_PATH = "/avisos";
/** «A medida» outside the page (fans without an account and old links). */
export const A_MEDIDA_PATH = "/avisos/a-medida";

/** A place's address (an Ajustes section: /perfil/ajustes/<section>). */
export const secPath = (s: Sec, aj: AjSec | null = null): string => (s === "ajustes" && aj ? `${PATH.ajustes}/${aj}` : PATH[s]);

/** The address of a screen (the inverse of screenAt). */
export function screenPath(s: Screen): string {
  if (s.page === "avisos") return AVISOS_PATH;
  if (s.open === "compartir") return COMPARTIR_PATH;
  if (s.open === "cromos") return CROMOS_PATH;
  return secPath(s.sec, s.aj);
}

const at = (sec: Sec, aj: AjSec | null = null, open: Open = null): Screen => ({ page: "perfil", sec, aj, open });

/** The screen an address shows (/perfil/compartir: Vitrina under the studio; /perfil/vitrina/cromos: Vitrina
 *  under the cromos). An old screen's address (the router redirects it first) still lands on its place. */
export function screenAt(pathname: string): Screen {
  const raw = pathname.replace(/\/+$/, "") || "/";
  const p = PERFIL_MOVES[raw] ?? raw;
  if (p === AVISOS_PATH || p.startsWith(`${AVISOS_PATH}/`)) return { page: "avisos", sec: "tu", aj: null, open: null };
  if (p === COMPARTIR_PATH) return at("vitrina", null, "compartir");
  if (p === CROMOS_PATH) return at("vitrina", null, "cromos");
  if (p.startsWith(`${PATH.ajustes}/`)) {
    const aj = p.slice(PATH.ajustes.length + 1) as AjSec;
    return at("ajustes", AJ_SECS.includes(aj) ? aj : null);
  }
  const sec = SECS.find((s) => PATH[s] === p);
  return at(sec ?? "tu");
}

export interface Who {
  kind: Kind;
  captain: boolean;
}

/** The places of his bar (not the gear): a player's four; a socio's and a new account's Tú + Vitrina (the carné);
 *  a fan has only Tú (the door). */
export function placesOf(w: Who): Sec[] {
  if (w.kind === "fan") return ["tu"];
  if (w.kind === "jugador") return ["tu", "partidos", "juego", "vitrina"];
  return ["tu", "vitrina"];
}

/** Every place he can be in: his bar's and, for any member, Ajustes. */
export function secsOf(w: Who): Sec[] {
  return w.kind === "fan" ? ["tu"] : [...placesOf(w), "ajustes"];
}

/** Ajustes' sections he has (Capitanía only for a captain). */
export function ajSecsOf(w: Who): AjSec[] {
  return w.captain ? [...AJ_SECS] : AJ_SECS.filter((a) => a !== "capitania");
}

/** A place he can't have (Partidos for a socio…) shows Tú. */
export function allowedSec(sec: Sec, w: Who): Sec {
  return secsOf(w).includes(sec) ? sec : "tu";
}

/** An Ajustes section he can't have (Capitanía for a player) shows the index. */
export function allowedAj(aj: AjSec | null, w: Who): AjSec | null {
  return aj && ajSecsOf(w).includes(aj) ? aj : null;
}

/** Each place's name in the bar. */
export function secLabel(id: Sec): string {
  return { tu: "Tú", partidos: "Partidos", juego: "Juego", vitrina: "Vitrina", ajustes: "Ajustes" }[id];
}

/** Each place's title on the phone's top bar and in its head. */
export function secTitle(id: Sec): string {
  return { tu: "Tú", partidos: "Tus partidos", juego: "Tu juego", vitrina: "Tu vitrina", ajustes: "Ajustes" }[id];
}

/** Each Ajustes section's name (a socio's «nombre» is his apodo). */
export function ajLabel(id: AjSec, kind: Kind): string {
  switch (id) {
    case "nombre":
      return kind === "socio" ? "Tu apodo" : "Tu nombre";
    case "avisos":
      return "Avisos";
    case "apariencia":
      return "Apariencia";
    case "cuenta":
      return "Cuenta";
    case "capitania":
      return "Capitanía";
  }
}

/** Each Ajustes section's line under its title (TuCarta ajSub). */
export function ajDesc(id: AjSec): string {
  switch (id) {
    case "nombre":
      return "Lo que va en tu espalda y cómo te llaman en el vestuario. Se cambia aquí mismo.";
    case "avisos":
      return "Qué te llega a este móvil. Se guarda solo.";
    case "apariencia":
      return "Cómo se ve la web en este móvil. Se guarda solo.";
    case "cuenta":
      return "Tu acceso con Google, lo que guarda el club y la baja.";
    case "capitania":
      return "Solo lo tuyo de capitán: la puerta. Lo demás, en la sala de control.";
  }
}

export const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const WORDS = ["Ninguna", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
/** «Dos peticiones esperan tu sí o tu no.» */
export function doorLead(n: number): string {
  if (n === 0) return "Nadie llama ahora mismo.";
  if (n === 1) return "Una petición espera tu sí o tu no.";
  return `${n <= 10 ? WORDS[n] : n} peticiones esperan tu sí o tu no.`;
}

/** Capitanía's «Administrar el club» (today's screen; the redesign keeps only «Ir a la Sala de control»). */
export type AdminLinkKey = "hoy" | "partidos" | "convocatoria" | "plantilla" | "socios" | "caja" | "club";
const ADMIN_LINKS: readonly { key: AdminLinkKey; t: string; hint: string; path: string }[] = [
  { key: "hoy", t: "Sala de control", hint: "Lo que te toca esta semana", path: "/admin" },
  { key: "partidos", t: "Partidos", hint: "La temporada, cada partido con su carril", path: "/admin/partidos" },
  { key: "convocatoria", t: "Convocatoria", hint: "El próximo partido: quién va y el siete", path: "/admin/partidos/proximo/convocatoria" },
  { key: "plantilla", t: "Plantilla", hint: "Jugadores, fichas y dorsales", path: "/admin/plantilla" },
  { key: "socios", t: "Socios", hint: "La puerta: quién pide su ficha y quién está dentro", path: "/admin/plantilla/socios" },
  { key: "caja", t: "Caja", hint: "Cuotas, campo y árbitro, y el bote", path: "/admin/caja" },
  { key: "club", t: "Club", hint: "Temporadas, la web del club, turnos y avisos", path: "/admin/club" },
];
export const adminLinks = (): { key: AdminLinkKey; t: string; hint: string; path: string }[] => ADMIN_LINKS.map((l) => ({ ...l }));

/** The move's direction between two screens: by the places' order (Ajustes' sections by theirs); La bandeja
 *  (/avisos) always to the right, coming back from it to the left. */
export function dirOf(from: Screen, to: Screen): "left" | "right" {
  if (from.page !== to.page) return to.page === "avisos" ? "right" : "left";
  const a = SECS.indexOf(from.sec);
  const b = SECS.indexOf(to.sec);
  if (a !== b) return b > a ? "right" : "left";
  return AJ_SECS.indexOf(to.aj ?? "nombre") >= AJ_SECS.indexOf(from.aj ?? "nombre") ? "right" : "left";
}

/** «Tu nombre»'s fit on the back (the board's words): up to 7 letters holgado, 10 justo, 12 al límite. */
export function fitWord(len: number): string {
  return len <= 7 ? "Holgado" : len <= 10 ? "Justo" : len <= 12 ? "Al límite" : "No cabe";
}

const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «sep 2026» → «septiembre de 2026» (Cuenta › Socio desde). */
export function sinceLong(s: string): string {
  const [m, y] = s.split(" ");
  const i = MONTHS_SHORT.indexOf(m ?? "");
  return i < 0 || !y ? s : `${MONTHS_LONG[i]} de ${y}`;
}

const DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric" });
/** «domingo 25» (the convocatoria's question, as the boards say it). */
export function dayName(ms: number): string {
  const parts = DAY.formatToParts(ms);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${wd} ${d}`.trim();
}

/** Initials of a name («Jordi Sumba» → «JS»). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
