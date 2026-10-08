// /profile › Avisos: the words for this device (which browser, which state, how to unblock it in that
// browser), the topics as the design names them, the test notice and the next matches of the
// calendar. Pure (the user agent and the data come in), so it is unit-tested.
import { dateMillis, matchPhase, type ClubMatch } from "../../lib/clubData";
import type { PushState, Topic } from "../../lib/push";

/** The design's four device states (pf-g «avisos» tweak). */
export type DeviceKind = "listo" | "iphone" | "denegado" | "no-soportado";
export function deviceKind(s: PushState): DeviceKind {
  return s === "ready" ? "listo" : s === "ios-install" ? "iphone" : s === "denied" ? "denegado" : "no-soportado";
}

export type Browser = "chrome" | "edge" | "samsung" | "opera" | "firefox" | "safari" | "otro";
export type Os = "android" | "iphone" | "ipad" | "windows" | "mac" | "linux" | "otro";
const BROWSER_NAME: Record<Browser, string> = { chrome: "Chrome", edge: "Edge", samsung: "Samsung Internet", opera: "Opera", firefox: "Firefox", safari: "Safari", otro: "Tu navegador" };
const OS_NAME: Record<Os, string> = { android: "Android", iphone: "iPhone", ipad: "iPad", windows: "Windows", mac: "Mac", linux: "Linux", otro: "" };

export function browserOf(ua: string): Browser {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/EdgA?\/|EdgiOS/i.test(ua)) return "edge";
  if (/OPR\/|Opera|OPiOS/i.test(ua)) return "opera";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Chrome|CriOS|Chromium/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "otro";
}
export function osOf(ua: string): Os {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/iPad/i.test(ua)) return "ipad";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux|CrOS/i.test(ua)) return "linux";
  return "otro";
}
/** «Chrome en Android». */
export function deviceName(ua: string): string {
  const b = BROWSER_NAME[browserOf(ua)];
  const o = OS_NAME[osOf(ua)];
  return o ? `${b} en ${o}` : b;
}

export interface DeviceView {
  kind: DeviceKind;
  /** chip / banner tone: the state is always in words too. */
  tone: "ok" | "warn" | "bad";
  chip: string;
  title: string;
  dev: string;
}
/**
 * The «Este móvil» banner. Ready: whether this device really gets notices now (a live subscription with
 * topics) and whether the browser already said yes.
 */
export function deviceView(s: PushState, ua: string, o: { permission: NotificationPermission | "unknown"; activeTopics: number }): DeviceView {
  const kind = deviceKind(s);
  const name = deviceName(ua);
  if (kind === "listo") {
    const granted = o.permission === "granted";
    return {
      kind,
      tone: "ok",
      chip: "Listo",
      title: o.activeTopics > 0 ? "Este móvil recibe avisos" : "Este móvil puede recibir avisos",
      dev: `${name} · ${granted ? "avisos permitidos" : "te pedirá permiso con el primer aviso"}`,
    };
  }
  if (kind === "iphone") {
    const dev = osOf(ua) === "ipad" ? "iPad" : "iPhone";
    return { kind, tone: "warn", chip: "Falta un paso", title: `En ${dev}, primero instala la web`, dev: `${dev} · Safari, sin añadir a la pantalla de inicio` };
  }
  if (kind === "denegado") return { kind, tone: "bad", chip: "Bloqueados", title: "Bloqueaste los avisos en este navegador", dev: "Se pueden volver a permitir en tres pasos" };
  return { kind, tone: "bad", chip: "No disponible", title: "Este navegador no admite avisos", dev: "Navegador sin notificaciones web" };
}

/**
 * How to allow the notices again, in this browser, in three plain steps. Words between *asterisks* go
 * in bold (the design's <b>).
 */
export function unblockSteps(ua: string, standalone: boolean): [string, string, string] {
  const b = browserOf(ua);
  const os = osOf(ua);
  if ((os === "iphone" || os === "ipad") && standalone)
    return [`Abre los *Ajustes* del ${os === "ipad" ? "iPad" : "iPhone"}`, "Entra en *Notificaciones* y busca *Manchester Piti*", "Activa *Permitir notificaciones* y vuelve aquí"];
  if (b === "safari" && os === "mac") return ["En la barra de arriba, abre *Safari › Ajustes*", "En *Sitios web › Notificaciones*, elige *Permitir* para esta web", "Recarga la página"];
  if (b === "samsung") return ["Abre el *menú* (☰) y entra en *Ajustes*", "En *Sitios y descargas › Notificaciones*, permite esta web", "Recarga la página"];
  if (b === "firefox") return ["Toca el *candado* de la barra de direcciones", "Junto a *Notificaciones*, quita el bloqueo (la ×)", "Recarga la página"];
  if ((b === "chrome" || b === "edge" || b === "opera") && os === "android")
    return ["Toca el *candado* (o los ajustes) junto a la dirección", "Entra en *Permisos › Notificaciones* y elige *Permitir*", "Recarga la página"];
  if (b === "chrome" || b === "edge" || b === "opera") return ["Pulsa el *icono de ajustes* a la izquierda de la dirección", "En *Notificaciones*, elige *Permitir*", "Recarga la página"];
  return ["Toca el *candado* de la barra de direcciones", "Entra en *Notificaciones* y elige *Permitir*", "Recarga la página"];
}
/** "a *b* c" → [["a ", false], ["b", true], [" c", false]]. */
export function boldParts(s: string): [string, boolean][] {
  return s
    .split("*")
    .map((t, i): [string, boolean] => [t, i % 2 === 1])
    .filter(([t]) => t.length > 0);
}

/** The topics as the design words them (pf-d-data TOPICS); the ids are push.ts's. */
export const TOPIC_COPY: Record<Topic, { label: string; sub: string; capOnly?: boolean }> = {
  start: { label: "Empieza el partido", sub: "El pitido inicial, con el once" },
  goals: { label: "Goles", sub: "Cada gol, nuestro y suyo, al momento" },
  final: { label: "Final", sub: "El resultado en cuanto pita el árbitro" },
  mvp: { label: "MVP de la jornada", sub: "Cuando se abre y se cierra la votación" },
  dates: { label: "Cambios de fecha u hora", sub: "Si un partido se mueve" },
  lineup: { label: "Cuando salga el siete oficial", sub: "El capitán publica el once del domingo" },
  door: { label: "Alguien llama a la puerta", sub: "Peticiones de acceso al vestuario", capOnly: true },
  access: { label: "Te abren la puerta", sub: "Cuando un capitán te deja entrar" },
};

/** «3 de 7 activos en este móvil.» / not ready: why they are off. */
export function topicsLead(ready: boolean, on: number, total: number): string {
  return ready ? `${on} de ${total} activos en este móvil.` : "Se activan cuando este móvil esté listo.";
}

/** The three test notices, in turn (pf-g NT): a goal with your name, the lineup, the final. */
export function testNotice(n: number, o: { name: string; rival: string | null; j: number | null }): { title: string; body: string } {
  const rival = o.rival || "el rival";
  const vs = o.rival || "RIVAL";
  const list = [
    { title: `GOOOL · ${o.name} · 31′`, body: `Manchester Piti 2–1 ${vs}${o.j ? " · J" + o.j : ""}` },
    { title: "Ya está el siete", body: `El capitán ha publicado el once para ${rival}` },
    { title: "Final · 3–1", body: `Manchester Piti gana a ${rival}. Vota al MVP` },
  ];
  return list[(((n - 1) % list.length) + list.length) % list.length];
}

export interface UpcomingRow {
  id: string;
  /** «J8» (empty when the match is not in its season's calendar). */
  j: string;
  rival: string;
  day: string;
  mon: string;
  /** «dom · 12:00 · fuera». */
  meta: string;
}
const TZ = "Europe/Madrid";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o });
const clean = (s: string) => s.replace(/\.$/, "").toLowerCase();
/** The next matches still to play (scheduled or on now), soonest first, as the calendar list shows them. */
export function upcomingRows(matches: readonly ClubMatch[], now: number, n = 3): UpcomingRow[] {
  const bySeason = new Map<string, string[]>();
  for (const m of [...matches].sort((a, b) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0) || a.id.localeCompare(b.id))) {
    const k = m.seasonId ?? "";
    bySeason.set(k, [...(bySeason.get(k) ?? []), m.id]);
  }
  return matches
    .filter((m) => Number.isFinite(dateMillis(m.date)) && ["scheduled", "playing"].includes(matchPhase(m, now)))
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))
    .slice(0, n)
    .map((m) => {
      const ms = dateMillis(m.date);
      const j = (bySeason.get(m.seasonId ?? "") ?? []).indexOf(m.id) + 1;
      const where = m.home === true ? "en casa" : m.home === false ? "fuera" : "";
      return {
        id: m.id,
        j: j > 0 ? "J" + j : "",
        rival: m.rival || "Rival",
        day: fmt({ day: "numeric" }).format(ms),
        mon: clean(fmt({ month: "short" }).format(ms)),
        meta: [clean(fmt({ weekday: "short" }).format(ms)), fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(ms), where].filter(Boolean).join(" · "),
      };
    });
}
