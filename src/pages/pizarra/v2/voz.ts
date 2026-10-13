// Bloque 5 · la voz en off de La charla (pure). The captain records a short audio for a step of the charla
// (≤ 30 s, at most six steps per board). The project has no Firebase Storage, so each clip is a small doc
// of the board's `voz` subcollection (lineups/{id}/voz/{v0…v5}) holding the audio as base64: six fixed
// slot ids cap the count in the rules, and each doc stays far below Firestore's 1 MiB (≤ 900 000
// characters of base64). A step is named by a stable key («sistema», «siete-3», «jugada-2», «final»…),
// so a clip stays with its step when the jugada changes length. Unit-tested in voz.test.ts.
import { z } from "zod";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { STEP_JUGADA, stepKind } from "./charla";

export const VOZ_LIMITS = {
  /** Clips per board (the rules allow only these slot ids). */
  slots: 6,
  /** The longest clip (ms). */
  ms: 30_000,
  /** The audio as base64 (characters): ≈ 660 KB of audio, a doc well under Firestore's 1 MiB. */
  chars: 900_000,
  key: 24,
  mime: 60,
} as const;

/** The six slot ids (the doc ids of lineups/{id}/voz). */
export const VOZ_SLOTS = ["v0", "v1", "v2", "v3", "v4", "v5"] as const;
export type VozSlot = (typeof VOZ_SLOTS)[number];

/** The bitrate asked of the recorder (a 30 s clip ≈ 120 KB): a voice, not music. */
export const VOZ_BPS = 32_000;

/** The step a clip belongs to: «sistema», «siete-1»…«siete-7», «banquillo», «balon», «plan»,
 *  «jugada-1»…, «quedada», «final». */
export function vozKey(step: number, last: number): string {
  const k = stepKind(step, last);
  if (k === "siete") return "siete-" + step;
  if (k === "jugada") return "jugada-" + (step - STEP_JUGADA + 1);
  return k;
}

const KEY_RE = /^(sistema|banquillo|balon|plan|quedada|final|siete-[1-7]|jugada-[1-8])$/;
const MIME_RE = /^audio\/[a-z0-9.+-]+(;[ a-z0-9=.,"+-]*)?$/i;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** A clip as stored (lenient on read: an invalid one is dropped and reported, the charla goes on). */
export const vozDocSchema = z.object({
  step: z.string().regex(KEY_RE),
  mime: z.string().max(VOZ_LIMITS.mime).regex(MIME_RE),
  ms: z.number().int().min(1).max(VOZ_LIMITS.ms),
  data: z.string().min(4).max(VOZ_LIMITS.chars).regex(B64_RE),
  by: z.string().max(128).optional(),
});

export interface VozClip {
  slot: VozSlot;
  step: string;
  mime: string;
  ms: number;
  data: string;
  /** When it was recorded (ms epoch; 0 while the write is pending). */
  at: number;
}

const isSlot = (v: string): v is VozSlot => (VOZ_SLOTS as readonly string[]).includes(v);
const millis = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  return 0;
};

/** One stored clip, or null (reported) when the doc is not one. */
export function parseVozDoc(id: string, data: unknown): VozClip | null {
  if (!isSlot(id)) return null;
  const r = vozDocSchema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("lineups.voz", id, r.error.issues);
    return null;
  }
  return { slot: id, step: r.data.step, mime: r.data.mime, ms: r.data.ms, data: r.data.data, at: millis((data as { at?: unknown }).at) };
}

/** The clips by step (two slots for one step — two devices at once — keep the newest). */
export function vozByStep(list: readonly VozClip[]): Map<string, VozClip> {
  const out = new Map<string, VozClip>();
  for (const c of list) {
    const was = out.get(c.step);
    if (!was || c.at >= was.at) out.set(c.step, c);
  }
  return out;
}

/** Where a new clip for `step` goes: its own slot when it has one (re-recording), else the first free
 *  one; null when the six are taken by other steps. */
export function slotFor(list: readonly VozClip[], step: string): VozSlot | null {
  const mine = list.find((c) => c.step === step);
  if (mine) return mine.slot;
  return VOZ_SLOTS.find((s) => !list.some((c) => c.slot === s)) ?? null;
}

/** The other slots of the same step (an older duplicate): they go when the step is re-recorded or deleted. */
export const extraSlots = (list: readonly VozClip[], step: string, keep: VozSlot | null): VozSlot[] =>
  list.filter((c) => c.step === step && c.slot !== keep).map((c) => c.slot);

/** The recorder's container, the first this browser can make: webm/opus (Chrome, Firefox, Edge), mp4
 *  (Safari); "" lets the browser choose. */
export function pickMime(isTypeSupported: ((t: string) => boolean) | undefined): string {
  if (!isTypeSupported) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      /* a browser that throws on the question */
    }
  }
  return "";
}

export type VozSupport = "ok" | "no-recorder" | "no-mic" | "insecure";

/** Whether this browser can record here (MediaRecorder + getUserMedia on a secure page). */
export function vozSupport(w: { isSecureContext?: boolean; MediaRecorder?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } } }): VozSupport {
  if (w.isSecureContext === false) return "insecure";
  if (typeof w.MediaRecorder !== "function") return "no-recorder";
  if (typeof w.navigator?.mediaDevices?.getUserMedia !== "function") return "no-mic";
  return "ok";
}

/** Why the voice can't be recorded here, in Spanish (null = it can). */
export function vozSupportTxt(s: VozSupport): string | null {
  if (s === "insecure") return "Para grabar la voz, abre la pizarra desde su dirección segura (https).";
  if (s === "no-recorder") return "Este navegador no puede grabar audio: prueba con Chrome, Edge, Firefox o Safari actualizados.";
  if (s === "no-mic") return "Este dispositivo no deja usar el micrófono desde el navegador.";
  return null;
}

/** A getUserMedia / MediaRecorder failure, in Spanish. */
export function vozErrorTxt(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Sin permiso para el micrófono: actívalo en los ajustes del navegador y vuelve a intentarlo.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No se encuentra ningún micrófono en este dispositivo.";
  if (name === "NotReadableError") return "El micrófono está ocupado por otra aplicación.";
  return "No se ha podido grabar la voz. Vuelve a intentarlo.";
}

/** 12 400 ms → «0:12». */
export function vozTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** The step's name for the voice controls («el sistema», «el jugador 3», «el paso 2 de la jugada»…). */
export function vozStepTxt(key: string): string {
  if (key.startsWith("siete-")) return "el jugador " + key.slice(6) + " del siete";
  if (key.startsWith("jugada-")) return "el paso " + key.slice(7) + " de la jugada";
  const T: Record<string, string> = { sistema: "el sistema", banquillo: "el banquillo", balon: "el balón parado", plan: "el plan", quedada: "la quedada", final: "«¡A por ellos!»" };
  return T[key] ?? "este paso";
}

/** «del plan», «de la quedada», «de «¡A por ellos!»». */
export const vozDe = (key: string): string => ("de " + vozStepTxt(key)).replace(/^de el /, "del ");

/** A Blob as base64 (no «data:» prefix). */
export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(s);
}

/** A clip as a data: URL the <audio> element plays. */
export const vozSrc = (c: Pick<VozClip, "mime" | "data">): string => "data:" + c.mime.split(";")[0] + ";base64," + c.data;
