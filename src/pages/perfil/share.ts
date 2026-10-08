// /profile «La carta» › the share studio: what it offers in each ficha state (Diseño «Mi carta» |
// «¡Ya es oficial!», Formato, Cara), its copy, the poster's words, the file names, the public link, and
// how «Compartir» reaches the phone's share sheet (the image as a file, else the link, else the
// clipboard). Pure, except shareOut, which only touches what it is handed. Design: pf-g.mjs share().
// Nothing here ever carries the member's email or uid: only the shirt name, the apodo and the ficha.
import type { FichaState } from "./card";

export type ShareDesign = "carta" | "poster";
export type ShareFormat = "historia" | "post";
export type ShareFace = "frente" | "dorso";

/** The pixels of each format: Historia 9:16, Post 4:5. */
export const SHARE_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  historia: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

/** «ADRIÁN T.C.» → «adrian-t-c»; «@adrian_tc» → «adrian-tc»; nothing usable → «socio». */
export function slugOf(text: string): string {
  const s = text
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "socio";
}

/** carta-{slug}.png / oficial-{slug}.png. */
export function shareFileName(design: ShareDesign, slug: string): string {
  return (design === "carta" ? "carta-" : "oficial-") + (slug || "socio") + ".png";
}

/**
 * The link that goes with the image: your public page once the ficha is yours (in production through
 * /compartir/jugador/:id, which carries the share preview and lands on /jugadores/:id), the club's home
 * while it isn't (pendiente: the ficha is not yours yet; sin ficha: there is none).
 */
export function shareLink(o: { origin: string; playerId: string | null; state: FichaState; dev: boolean }): string {
  if (o.state !== "vinculada" || !o.playerId) return o.origin + "/";
  const id = encodeURIComponent(o.playerId);
  return o.dev ? `${o.origin}/jugadores/${id}` : `${o.origin}/compartir/jugador/${id}`;
}
/** What the image's footer prints: «manchesterpiti.es/jugadores/:id» (the page a person lands on). */
export function pageText(origin: string, playerId: string | null): string {
  const host = origin.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
  return host + "/jugadores/" + (playerId ?? "");
}

export interface SegOption<K extends string> {
  id: K;
  label: string;
  sub: string;
  disabled: boolean;
}
export interface StudioCopy {
  title: string;
  lead: string;
  tiny: string;
  /** pendiente / sin ficha: what changes on the poster when the ficha arrives. */
  note: string | null;
  designs: SegOption<ShareDesign>[];
  formats: SegOption<ShareFormat>[];
  faces: SegOption<ShareFace>[];
}

/** «Mi carta» only exists with a ficha: in pendiente / sin ficha the studio always shows the poster. */
export function designFor(state: FichaState, wanted: ShareDesign): ShareDesign {
  return state === "vinculada" ? wanted : "poster";
}

export function studioCopy(state: FichaState, design: ShareDesign): StudioCopy {
  const vinc = state === "vinculada";
  const pend = state === "pendiente";
  const ds = designFor(state, design);
  return {
    title: vinc ? "Compartir mi carta" : "Compartir mi póster",
    lead:
      ds === "carta"
        ? "Elige diseño, formato y cara: se descarga tal cual la ves."
        : vinc
          ? "El cartel de «¡Ya es oficial!» con tu nombre, dorsal y posición, listo para historias y posts."
          : pend
            ? "Tu cartel para redes. Hoy dice «Fichaje en trámite»; cuando el capitán acepte, «¡Ya es oficial!»."
            : "Tu cartel para redes. Hoy te presenta como nuevo socio; con tu ficha, «¡Ya es oficial!».",
    tiny:
      ds === "carta"
        ? "La imagen no lleva tu correo ni tu id: solo lo que ves. El dorso lleva el QR a tu página pública."
        : "El póster no lleva tu correo ni tu id: solo lo que ves.",
    note: vinc
      ? null
      : pend
        ? "Mientras el capitán confirma tu ficha, el póster dice «Fichaje en trámite». En cuanto la tengas, sale «¡Ya es oficial!» con tu dorsal."
        : "Sin ficha, el póster te presenta como nuevo socio. Con tu ficha, sale «¡Ya es oficial!» con tu dorsal y posición.",
    designs: [
      { id: "carta", label: "Mi carta", sub: vinc ? "frente o dorso" : "cuando tengas carta", disabled: !vinc },
      { id: "poster", label: "¡Ya es oficial!", sub: vinc ? "tu fichaje" : pend ? "en trámite" : "nuevo socio", disabled: false },
    ],
    formats: [
      { id: "historia", label: "Historia", sub: "9:16", disabled: false },
      { id: "post", label: "Post", sub: "4:5", disabled: false },
    ],
    faces: [
      { id: "frente", label: "Frente", sub: "tu carta", disabled: false },
      { id: "dorso", label: "Dorso", sub: "carné y QR", disabled: false },
    ],
  };
}

export interface PosterModel {
  /** gold / amber / sky: the words say the state, colour only reinforces it. */
  tone: "ok" | "warn" | "off";
  l1: string;
  l2: string;
  /** «FICHAJE / EN TRÁMITE» needs the smaller LED letters. */
  long: boolean;
  /** The shirt: the shirt name printed (vinculada) or blank. */
  blank: boolean;
  print: string;
  num: string;
  /** The big name: the shirt name, or @apodo before there is a ficha. */
  name: string;
  /** '' up to 8 characters · m up to 11 · s longer. */
  nmCls: "" | "m" | "s";
  line: string;
  presented: string;
  aria: string;
}

export function posterModel(o: { state: FichaState; shirt: string; nick: string; number: string; posLong: string | null; presented: string; format: ShareFormat }): PosterModel {
  const vinc = o.state === "vinculada";
  const pend = o.state === "pendiente";
  const nick = "@" + o.nick;
  const name = vinc ? o.shirt : nick.toLocaleUpperCase("es-ES");
  const pos = (o.posLong ?? "Jugador").toLocaleUpperCase("es-ES");
  const fmt = o.format === "post" ? "post 4:5" : "historia 9:16";
  return {
    tone: vinc ? "ok" : pend ? "warn" : "off",
    l1: vinc ? "¡YA ES" : pend ? "FICHAJE" : "NUEVO",
    l2: vinc ? "OFICIAL!" : pend ? "EN TRÁMITE" : "SOCIO",
    long: pend,
    blank: !vinc,
    print: vinc ? o.shirt : "",
    num: vinc ? o.number || "?" : pend ? o.number || "?" : "?",
    name,
    nmCls: name.length > 11 ? "s" : name.length > 8 ? "m" : "",
    line: vinc ? (o.number ? `DORSAL ${o.number} · ${pos}` : pos) : pend ? (o.number ? `PIDE EL ${o.number} · EN REVISIÓN` : "FICHA PEDIDA · EN REVISIÓN") : "SIN DORSAL TODAVÍA",
    presented: o.presented.toLocaleUpperCase("es-ES"),
    aria:
      `Vista previa del póster (${fmt}): ` +
      (vinc
        ? `¡Ya es oficial! ${o.shirt}${o.number ? ", dorsal " + o.number : ""}, ${o.posLong ?? "jugador"}`
        : pend
          ? `Fichaje en trámite: ${nick} pide el ${o.number || "dorsal"}`
          : `Nuevo socio: ${nick}, sin dorsal todavía`),
  };
}

/** «Mi carta · T1» over the card (front), «Socio del club» over the carné. */
export function cartaKicker(face: ShareFace, racha: boolean, season: string): string {
  return face === "dorso" ? "Socio del club" : (racha ? "En racha" : "Mi carta") + " · " + season;
}
export function cartaAria(o: { face: ShareFace; format: ShareFormat; rating: string; pos: string; shirt: string; number: string; showNumbers: boolean }): string {
  const fmt = o.format === "post" ? "post 4:5" : "historia 9:16";
  return `Vista previa (${fmt}): ` + (o.face === "dorso" ? "el dorso de tu carta, carné de socio con QR a tu página" : `tu carta, ${o.showNumbers ? o.rating + " " : ""}${o.pos}, ${o.shirt}${o.number ? ", dorsal " + o.number : ""}`);
}

// ── «Compartir»: the image as a file where the browser takes files, else the link, else the clipboard.
export interface ShareNav {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}
export type SharePlan = "files" | "url" | "copy";
export type ShareOutcome = "shared-file" | "shared-link" | "copied" | "cancelled" | "failed";

export function sharePlan(nav: ShareNav, file: File | null): SharePlan {
  if (typeof nav.share !== "function") return "copy";
  let files = false;
  try {
    files = !!file && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
  } catch {
    files = false;
  }
  return files ? "files" : "url";
}

/** The person closed the share sheet: not an error. */
export const isAbort = (e: unknown): boolean => !!e && typeof e === "object" && (e as { name?: unknown }).name === "AbortError";

export async function shareOut(o: { nav: ShareNav; file: File | null; link: string; title: string; text: string; copy: (s: string) => Promise<boolean> }): Promise<ShareOutcome> {
  const plan = sharePlan(o.nav, o.file);
  const share = o.nav.share;
  if (plan !== "copy" && share) {
    try {
      if (plan === "files" && o.file) await share.call(o.nav, { files: [o.file], title: o.title, text: o.text, url: o.link });
      else await share.call(o.nav, { title: o.title, text: o.text, url: o.link });
      return plan === "files" ? "shared-file" : "shared-link";
    } catch (e) {
      if (isAbort(e)) return "cancelled";
      /* refused (no gesture left, a file type it won't take…): the link goes to the clipboard instead */
    }
  }
  return (await o.copy(o.link)) ? "copied" : "failed";
}

/** The words that travel with the image (title + text of the share sheet): never an email or an id. */
export function shareWords(o: { state: FichaState; design: ShareDesign; shirt: string; number: string }): { title: string; text: string } {
  const club = "Manchester Piti";
  if (o.state === "pendiente") return { title: `Fichaje en trámite · ${club}`, text: "Fichaje en trámite: el capitán lo revisa." };
  if (o.state === "sin-ficha") return { title: `Nuevo socio · ${club}`, text: `Nuevo socio del vestuario del ${club}.` };
  const dorsal = o.number ? `, dorsal ${o.number}` : "";
  return designFor(o.state, o.design) === "carta"
    ? { title: `${o.shirt} · ${club}`, text: `Mi carta del ${club}: ${o.shirt}${dorsal}.` }
    : { title: `¡Ya es oficial! · ${club}`, text: `¡Ya es oficial! ${o.shirt}${dorsal}, ${club}.` };
}

/** The toast after «Compartir» (null: nothing to say). `plan` «copy» = this browser can't share at all. */
export function shareToast(out: ShareOutcome, plan: SharePlan): string | null {
  switch (out) {
    case "shared-file":
      return "Imagen enviada al menú de compartir";
    case "shared-link":
      return "Enlace enviado al menú de compartir";
    case "copied":
      return plan === "copy" ? "Este navegador no comparte imágenes: te hemos copiado el enlace" : "No se ha podido compartir: te hemos copiado el enlace";
    case "cancelled":
      return null;
    case "failed":
      return null;
  }
}
