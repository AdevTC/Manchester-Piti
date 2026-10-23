// Tú (TU boards, component.js): who looks at /perfil, which screens his page has, what each tab says it holds
// and which address each screen is. Pure: the page (TuPage) reads the screen from the address and draws it.

/** Who looks: no session · a member without a ficha (his carné) · a new account whose ficha is pending or was
 *  turned down (the sobre / the pick) · a player with his ficha linked. */
export type Kind = "fan" | "socio" | "nuevo" | "jugador";
export type Sec = "carta" | "temporada" | "posiciones" | "nombre" | "ajustes" | "cuenta" | "capitania";
/** The two surfaces with an address of their own (the studio and the cromos). */
export type Open = "compartir" | "cromos" | null;
export type Page = "perfil" | "avisos";

export interface Screen {
  page: Page;
  sec: Sec;
  open: Open;
}

/** The screens in their order (the move's direction follows it). */
export const SECS: readonly Sec[] = ["carta", "temporada", "posiciones", "nombre", "ajustes", "cuenta", "capitania"];
/** «Fuera del campo»: the card shows its back (the carné). */
export const BACKSIDE: ReadonlySet<Sec> = new Set(["ajustes", "cuenta", "capitania"]);

const PATH: Record<Sec, string> = {
  carta: "/perfil",
  temporada: "/perfil/temporada",
  posiciones: "/perfil/posiciones",
  nombre: "/perfil/nombre",
  ajustes: "/perfil/ajustes",
  cuenta: "/perfil/cuenta",
  capitania: "/perfil/capitania",
};
export const secPath = (s: Sec): string => PATH[s];
export const COMPARTIR_PATH = "/perfil/compartir";
export const CROMOS_PATH = "/perfil/temporada/cromos";

/** The screen an address shows (/perfil/compartir: La carta under the studio; …/cromos: Temporada under them). */
export function screenAt(pathname: string): Screen {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/avisos" || p.startsWith("/avisos/")) return { page: "avisos", sec: "carta", open: null };
  if (p === COMPARTIR_PATH) return { page: "perfil", sec: "carta", open: "compartir" };
  if (p === CROMOS_PATH) return { page: "perfil", sec: "temporada", open: "cromos" };
  const sec = (Object.keys(PATH) as Sec[]).find((s) => PATH[s] === p);
  return { page: "perfil", sec: sec ?? "carta", open: null };
}

export interface Who {
  kind: Kind;
  captain: boolean;
}

/** The screens his page has (component.js secsOf): a player's season and positions, a captain's Capitanía. */
export function secsOf(w: Who): { id: Sec | "avisos"; g: "campo" | "fuera" }[] {
  if (w.kind === "fan") return [{ id: "carta", g: "campo" }];
  const out: { id: Sec | "avisos"; g: "campo" | "fuera" }[] = [{ id: "carta", g: "campo" }];
  if (w.kind === "jugador") out.push({ id: "temporada", g: "campo" }, { id: "posiciones", g: "campo" });
  out.push({ id: "nombre", g: "campo" }, { id: "avisos", g: "fuera" }, { id: "ajustes", g: "fuera" }, { id: "cuenta", g: "fuera" });
  if (w.captain) out.push({ id: "capitania", g: "fuera" });
  return out;
}

/** A screen he can't have (Temporada for a socio, Capitanía for a player…) shows La carta. */
export function allowedSec(sec: Sec, w: Who): Sec {
  return secsOf(w).some((x) => x.id === sec) ? sec : "carta";
}

/** Each tab's name (the socio's carta is his carné, his «nombre» his apodo). */
export function secLabel(id: Sec | "avisos", kind: Kind): string {
  switch (id) {
    case "carta":
      return kind === "socio" ? "Tu carné" : "Tu carta";
    case "temporada":
      return "Temporada";
    case "posiciones":
      return "Posiciones";
    case "nombre":
      return kind === "socio" ? "Tu apodo" : "Tu nombre";
    case "avisos":
      return "Avisos";
    case "ajustes":
      return "Ajustes";
    case "cuenta":
      return "Cuenta";
    case "capitania":
      return "Capitanía";
  }
}

/** Each screen's line under its title (component.js SCRD). */
export function secDesc(id: Sec, kind: Kind, pack: boolean): string {
  switch (id) {
    case "carta":
      return kind === "socio" ? "Lo que el club sabe de ti y desde cuándo." : kind === "nuevo" ? (pack ? "Tu petición, mientras el capitán la mira." : "Elige tu dorsal: el capitán lo confirma.") : "Lo que dice tu carta y cómo mejora.";
    case "temporada":
      return "Tus partidos, tus minutos y lo tuyo en el vestuario.";
    case "posiciones":
      return "Dónde has jugado y dónde quieres jugar.";
    case "nombre":
      return kind === "socio" ? "Así te ven en la porra, el MVP y el vestuario." : "El que llevas a la espalda y el que usas en el vestuario.";
    case "ajustes":
      return "Cómo se ve y cómo suena la web en este móvil. Se guarda solo.";
    case "cuenta":
      return "Tu Google, tu acceso, salir y tus datos.";
    case "capitania":
      return "Lo que solo ves tú como capitán.";
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

/** The move's direction between two screens (an «Avisos» tab always goes right, coming back from it left). */
export function dirOf(from: Screen, to: Screen): "left" | "right" {
  if (from.page !== to.page) return to.page === "avisos" ? "right" : "left";
  return SECS.indexOf(to.sec) >= SECS.indexOf(from.sec) ? "right" : "left";
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
