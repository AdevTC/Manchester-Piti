// What a visitor's phone reports about how the site felt (src/lib/vitals.ts), checked before it is stored
// (vitals.ts): the Core Web Vitals with their causes, and the frames of each View Transition. No personal data: no
// account, no address, no IP; the device only as a class. Pure: tested without Firestore.
import { z } from "zod";

const num = z.number().finite().min(0).max(600_000);
/** Text without control characters (it ends up printed in a terminal: functions/scripts/vitals-report.mjs). */
/** A control character (C0, DEL or C1). */
export const isControl = (code: number) => code < 0x20 || (code >= 0x7f && code <= 0x9f);
const printable = (s: string) => ![...s].some((c) => isControl(c.charCodeAt(0)));
const text = (n: number) => z.string().max(n).refine(printable, "control characters");
const short = (n: number) => text(n).optional();

/** One measurement: a Web Vital (LCP · INP · CLS · FCP · TTFB) or a View Transition («VT»). */
const record = z.object({
  /** metric */
  n: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB", "VT"]),
  /** value: ms (CLS: the score; VT: its longest frame) */
  v: num,
  /** rating */
  r: z.enum(["good", "needs-improvement", "poor"]).optional(),
  /** the page it belongs to, with ids folded (/jugadores/:id) */
  p: text(80),
  /** how the page was reached: navigate · reload · back-forward · back-forward-cache · prerender · restore · soft-navigation */
  nt: short(24),
  /** causes (each metric its own: lib/vitals.ts attributionOf). INP `fill`: a soft navigation's filler, no tap behind
   *  it; INP `vt`: the tap started a View Transition; VT `lf*`: where its worst long animation frame went
   *  (lib/vitals.ts frameBreakdown) */
  a: z.record(text(24), z.union([z.number().finite(), text(120), z.boolean()])).optional(),
});
export type VitalRecord = z.infer<typeof record>;

/** The device, as a class only. */
const device = z.object({
  /** android · ios · other */
  os: z.enum(["android", "ios", "other"]),
  /** a touch screen as the main pointer */
  touch: z.boolean(),
  /** CSS px width, rounded to 10 */
  w: z.number().int().min(0).max(10_000),
  dpr: z.number().min(0).max(8),
  /** navigator.deviceMemory · hardwareConcurrency · connection.effectiveType (Chrome only) */
  mem: z.number().min(0).max(64).optional(),
  cpu: z.number().int().min(0).max(256).optional(),
  net: short(12),
  /** the page arrived server-rendered; a service worker served it */
  ssr: z.boolean(),
  sw: z.boolean(),
  /** navigator.webdriver: a browser driven by automation (a crawler, a test), left out of the report */
  bot: z.boolean().optional(),
});
export type VitalDevice = z.infer<typeof device>;

export const vitalsPayload = z.object({ d: device, m: z.array(record).min(1).max(40) });
export type VitalsPayload = z.infer<typeof vitalsPayload>;

/** The largest report accepted (a full one is ~4 KB). */
export const MAX_BODY = 24_000;
/** How long a report is kept (Firestore TTL on `expireAt`, when the project has it on). */
export const KEEP_DAYS = 90;

/** The report to store, or null for anything that isn't one. */
export function parseVitals(body: string): VitalsPayload | null {
  if (body.length > MAX_BODY) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = vitalsPayload.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** An INP with no tap behind it: with reportSoftNavs, web-vitals reports one for each page reached by a soft navigation
 *  even when none of its taps was slow, all «presentation» and no element. Marked `fill` by the site since 2026-11-06;
 *  the ones stored before are told by their shape (no element, no input or processing, presentation = the value). */
export function isFillerInp(m: Pick<VitalRecord, "n" | "v" | "a">): boolean {
  if (m.n !== "INP") return false;
  const a = m.a ?? {};
  return a.fill === true || (a.el === undefined && a.input === 0 && a.proc === 0 && a.pres === m.v);
}

/** Jordi's PC as it reports itself (24 threads, 32 GB): the agents' browsers there (the desktop app's pane does not
 *  say it is automated) measured pages no visitor waited for (FCP 3.2 s on 31-10, /admin 13 s on 28-10). Since
 *  2026-11-06 its tools open the site with `?novitals` and send nothing (src/lib/vitalsOff.ts); this tells apart what
 *  it sent before. A class, not an identifier: any other machine with the same two numbers is left out too. */
export const AGENT_PCS: readonly { cpu: number; mem: number }[] = [{ cpu: 24, mem: 32 }];
export function isAgentPc(d: Pick<VitalDevice, "cpu" | "mem"> | undefined): boolean {
  return !!d && AGENT_PCS.some((pc) => d.cpu === pc.cpu && d.mem === pc.mem);
}

/** Reports one instance stores a minute at most. */
export const RATE_PER_MIN = 60;
/** Whether a report at `now` fits this minute's allowance; records it when it does (`recent` is the instance's list). */
export function withinRate(recent: number[], now: number, max = RATE_PER_MIN): boolean {
  while (recent.length && now - recent[0] >= 60_000) recent.shift();
  if (recent.length >= max) return false;
  recent.push(now);
  return true;
}
