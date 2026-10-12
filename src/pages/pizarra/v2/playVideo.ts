// Bloque 5 · «Ver en vídeo»: a jugada can carry a link to a video (YouTube, Drive or any https page) and
// the moment it starts at. Pure helpers for the editor and the link: read «12:34» (or «1:02:03», or plain
// seconds), write it back, check the link (https only) and build the link that opens at that moment where
// the site understands it (YouTube's t=, a video file's #t=). Unit-tested in playVideo.test.ts.
import { PLAY_VIDEO_LIMITS, playVideoSchema, type PlayVideo } from "../../../lib/schemas";

export type { PlayVideo };

/** «12:34» → 754, «1:02:03» → 3723, «90» → 90; null when it is not a time (or past the limit). */
export function parseClock(raw: string): number | null {
  const t = raw.trim().replace(/[′']/g, ":").replace(/[″"]/g, "").replace(/\s+/g, "");
  if (!t) return 0;
  if (!/^\d{1,5}(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((n) => n > 59)) return null;
  const s = parts.reduce((acc, n) => acc * 60 + n, 0);
  return s <= PLAY_VIDEO_LIMITS.at ? s : null;
}

const two = (n: number) => String(n).padStart(2, "0");
/** 754 → «12:34», 3723 → «1:02:03». */
export function clockTxt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? h + ":" + two(m) + ":" + two(s % 60) : m + ":" + two(s % 60);
}

/** What is wrong with a link (Spanish, for the field), or null when it can be kept. */
export function videoUrlError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Pega el enlace del vídeo.";
  if (v.length > PLAY_VIDEO_LIMITS.url) return "El enlace es demasiado largo (" + PLAY_VIDEO_LIMITS.url + " caracteres como mucho).";
  if (/^http:\/\//i.test(v)) return "Solo enlaces seguros: tiene que empezar por https://";
  const r = playVideoSchema.shape.url.safeParse(v);
  return r.success ? null : "Ese enlace no vale: tiene que empezar por https://";
}

/** The video to keep from the editor's two fields, or what is wrong with them. */
export function readVideo(url: string, at: string): { video: PlayVideo } | { error: string } {
  const e = videoUrlError(url);
  if (e) return { error: e };
  const s = parseClock(at);
  if (s == null) return { error: "El minuto va como 12:34 (minutos y segundos)." };
  return { video: { url: url.trim(), at: s } };
}

const YT = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/i;
const FILE = /\.(mp4|webm|mov|m4v|ogv)$/i;

/** The link that opens the video at its moment: YouTube's t= (seconds), a video file's #t=; any other
 *  page opens as it is (the label says the minute). */
export function videoHref(v: PlayVideo): string {
  try {
    const u = new URL(v.url);
    if (u.protocol !== "https:") return "";
    if (v.at > 0 && YT.test(u.hostname)) u.searchParams.set("t", v.at + "s");
    else if (v.at > 0 && FILE.test(u.pathname)) u.hash = "t=" + v.at;
    return u.toString();
  } catch {
    return "";
  }
}

/** «Ver en vídeo (12:34)», and where it goes (for its accessible name). */
export function videoLabel(v: PlayVideo): { txt: string; aria: string } {
  let host = "";
  try {
    host = new URL(v.url).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const txt = "Ver en vídeo (" + clockTxt(v.at) + ")";
  return { txt, aria: txt + (host ? ", en " + host : "") + ". Se abre en otra pestaña" };
}
