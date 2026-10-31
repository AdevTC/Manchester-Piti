// Ajustes (TuCarta «ajustes»): the pure words of the index and its five sections — each row's hint, the head's
// title and line, the shirt's fit, the theme's note, the account's rows and who knocks at the door. The place
// (Ajustes.tsx + ajustes/*) draws them; nothing here touches the DOM or a subscription.
import { ago } from "../../lines";
import { endSentence } from "../../../../lib/derived/words";
import { ajDesc, ajLabel, ajSecsOf, doorLead, initials, pl, type AjSec, type Kind, type Who } from "../model";

export { endSentence };

export type ThemePref = "light" | "dark" | "system";
export type IndexIcon = "shirt" | "bell" | "sun" | "user" | "flag";

export interface AjRow {
  id: AjSec;
  t: string;
  hint: string;
  icon: IndexIcon;
  /** A captain's people at the door (0: no badge). */
  badge: number;
}

const ICON: Record<AjSec, IndexIcon> = { nombre: "shirt", avisos: "bell", apariencia: "sun", cuenta: "user", capitania: "flag" };

/** «Como tu móvil» · «Día» · «Noche» (Apariencia's hint). */
export const themeHint = (pref: ThemePref): string => ({ system: "Como tu móvil", light: "Día", dark: "Noche" })[pref];

/** Capitanía's hint: «2 llaman a la puerta» / «Nadie llama». */
export const doorHint = (n: number): string => (n ? `${n} ${n === 1 ? "llama" : "llaman"} a la puerta` : "Nadie llama");

/** The index (the desktop's side list, the phone's whole screen): his sections with their live hints. */
export function ajIndex(o: { who: Who; shirt: string; nickname: string; deviceLine: string; theme: ThemePref; doorN: number }): AjRow[] {
  const shirt = o.who.kind === "jugador" && o.shirt ? `${o.shirt.toUpperCase()} · ` : "";
  const hint: Record<AjSec, string> = {
    nombre: `${shirt}@${o.nickname}`,
    avisos: o.deviceLine,
    apariencia: themeHint(o.theme),
    cuenta: "Google, acceso y baja",
    capitania: doorHint(o.doorN),
  };
  return ajSecsOf(o.who).map((id) => ({ id, t: ajLabel(id, o.who.kind), hint: hint[id], icon: ICON[id], badge: id === "capitania" ? o.doorN : 0 }));
}

/** The section shown: the address's one, else (the index on a desktop) the first. */
export const shownAj = (aj: AjSec | null, who: Who): AjSec => aj ?? ajSecsOf(who)[0];

/** The head over a section: kicker «Ajustes», its name and its line (a socio's «nombre» is only his apodo). */
export function ajHead(aj: AjSec, kind: Kind): { title: string; sub: string } {
  const sub = aj === "nombre" && kind === "socio" ? "Cómo te llaman en el vestuario: la porra, el MVP y las convocatorias. Se cambia aquí mismo." : ajDesc(aj);
  return { title: ajLabel(aj, kind), sub };
}

/** The shirt's fit chip (the board's words): empty, holgado ≤7, justo ≤10, al límite ≤12, no cabe; locked
 *  without a ficha. `tone` is never the only signal: the word says it. */
export function fitOf(len: number, linked: boolean): { t: string; tone: "ok" | "warn" | "off" } {
  if (!linked) return { t: "Bloqueado", tone: "off" };
  if (!len) return { t: "Sin nombre", tone: "off" };
  if (len <= 7) return { t: "Holgado", tone: "ok" };
  if (len <= 10) return { t: "Justo", tone: "ok" };
  if (len <= 12) return { t: "Al límite", tone: "warn" };
  return { t: "No cabe", tone: "warn" };
}

/** Apariencia › Tema's line. */
export function themeNote(pref: ThemePref, theme: "light" | "dark"): string {
  if (pref === "system") return `Sigue a tu móvil: ahora mismo, de ${theme === "light" ? "día" : "noche"}.`;
  return `Siempre de ${pref === "light" ? "día" : "noche"} en este móvil.`;
}

/** Apariencia › Animaciones' line (it follows «reducir movimiento»; nothing to switch). */
export const motionNote = (reduced: boolean): string =>
  reduced ? "Tu móvil pide menos movimiento: la carta sale quieta y las pantallas cambian con un fundido corto." : "Siguen a tu móvil: ahora mismo, completas. Si activas «reducir movimiento», la carta sale quieta y las pantallas cambian con un fundido corto.";

/** Cuenta: his role under his Google name. */
export function roleLine(captain: boolean, kind: Kind): string {
  return `${captain ? "Capitán del vestuario" : kind === "jugador" ? "Jugador" : "Socio"} del Manchester Piti`;
}

/** Cuenta › «En la espalda». */
export function backLine(kind: Kind, shirt: string, number: string, pending: boolean, wanted: string): string {
  if (kind === "jugador") return `${shirt.toUpperCase()}${number ? ` · dorsal ${number}` : ""}`;
  if (kind === "nuevo") return pending && wanted ? `Cuando el capitán acepte tu ficha del ${wanted}` : "Cuando tengas ficha";
  return "Sin ficha de jugador";
}

export interface Knock {
  key: string;
  name: string;
  /** The dorsal he asks for (its printed shirt), else null (his initials). */
  num: string | null;
  ini: string;
  line: string;
  at: string;
}

/** Capitanía › La puerta: who knocks, newest first as they come, with the shirt of the ficha he asks for. */
export function knockRows(
  reqs: readonly { uid: string; name: string | null; googleName: string; email: string; playerId: string | null; at: number }[],
  squad: readonly { id: string; name: string; number?: number | string | null }[],
  now: number,
): Knock[] {
  return reqs.map((r) => {
    const sq = r.playerId ? squad.find((s) => s.id === r.playerId) : undefined;
    const num = sq && sq.number !== null && sq.number !== undefined && String(sq.number) !== "" ? String(sq.number) : null;
    const name = r.name || r.googleName || r.email;
    return { key: r.uid, name, num, ini: initials(name), line: num ? `Pide la carta del ${num}${sq?.name ? ` (${sq.name})` : ""}` : "Sin dorsal todavía", at: ago(r.at, now) };
  });
}

/** La puerta's line above the list. */
export const doorLine = (n: number): string => doorLead(n);

/** The door notice's toggle, its state in words (never only the switch's colour). */
export function doorToggle(on: boolean, ready: boolean): string {
  if (!ready) return "Aviso de la puerta: primero, este móvil tiene que estar listo";
  return `Aviso de la puerta: ${on ? "activado" : "desactivado"} en este móvil`;
}

/** «N peticiones» for a screen reader on the index badge. */
export const badgeAria = (n: number): string => pl(n, "persona en la puerta", "personas en la puerta");
