// How the site feels on the visitors' own phones: the Core Web Vitals (web-vitals, attribution build: what made
// each one slow) and the frames of each View Transition, sent once the tab is hidden or closed (one beacon) to
// /datos/v (vercel.json → functions/src/vitals.ts). Nothing personal: no account, the device only as a class.
// Loaded after the first paint, never on the way to it.
import type { CLSMetricWithAttribution, FCPMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution, TTFBMetricWithAttribution } from "web-vitals/attribution";
import type { VitalDevice, VitalRecord } from "../../functions/src/vitalsLogic";
import { onViewTransition } from "../components/celeste/pageTransition";

export const VITALS_URL = "/datos/v";
/** The share of visits that report (the club's traffic is small: all of them). */
export const SAMPLE = 1;
/** At most this many measurements per report (the function refuses more). */
const MAX_RECORDS = 40;

type AnyMetric = LCPMetricWithAttribution | INPMetricWithAttribution | CLSMetricWithAttribution | FCPMetricWithAttribution | TTFBMetricWithAttribution;
type Attr = NonNullable<VitalRecord["a"]>;

/** Folds ids out of a path, so pages group: /jugadores/abc/temporada → /jugadores/:id/temporada. */
export function pageOf(path: string): string {
  const p = path.split(/[?#]/)[0].replace(/(.)\/+$/, "$1") || "/";
  return p
    .replace(/^\/jugadores\/[^/]+/, "/jugadores/:id")
    .replace(/^\/partidos\/(?!tabla$|balance$)[^/]+/, "/partidos/:id")
    .replace(/^\/club\/vitrina\/[^/]+/, "/club/vitrina/:id")
    .replace(/^\/vestuario\/encuestas\/[^/]+/, "/vestuario/encuestas/:id")
    .replace(/^\/invitacion\/[^/]+/, "/invitacion/:id")
    .slice(0, 80);
}

const ms = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : undefined);
const text = (s: string | undefined, n = 120) => (s ? s.slice(0, n) : undefined);
/** A URL as its path only (a resource of this site or another one's host and path). */
const urlPath = (u: string | undefined) => {
  if (!u) return undefined;
  try {
    const url = new URL(u, location.href);
    return text(url.origin === location.origin ? url.pathname : url.host + url.pathname);
  } catch {
    return text(u);
  }
};
const compact = (a: Record<string, number | string | boolean | undefined>): Attr =>
  Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as Attr;

/** What made a metric what it is, in a few fields. */
export function attributionOf(m: AnyMetric): Attr {
  switch (m.name) {
    case "LCP": {
      const a = m.attribution;
      return compact({ el: text(a.target), url: urlPath(a.url), ttfb: ms(a.timeToFirstByte), wait: ms(a.resourceLoadDelay), load: ms(a.resourceLoadDuration), render: ms(a.elementRenderDelay) });
    }
    case "INP": {
      const a = m.attribution;
      const ls = a.longestScript;
      return compact({
        el: text(a.interactionTarget),
        type: a.interactionType,
        input: ms(a.inputDelay),
        proc: ms(a.processingDuration),
        pres: ms(a.presentationDelay),
        js: ms(a.totalScriptDuration),
        style: ms(a.totalStyleAndLayoutDuration),
        paint: ms(a.totalPaintDuration),
        other: ms(a.totalUnattributedDuration),
        script: urlPath(ls?.entry.sourceURL) ?? text(ls?.entry.invoker),
        scriptMs: ms(ls?.intersectingDuration),
        load: a.loadState,
      });
    }
    case "CLS": {
      const a = m.attribution;
      return compact({ el: text(a.largestShiftTarget), shift: a.largestShiftValue !== undefined ? Math.round(a.largestShiftValue * 1000) / 1000 : undefined, at: ms(a.largestShiftTime), load: a.loadState });
    }
    case "FCP": {
      const a = m.attribution;
      return compact({ ttfb: ms(a.timeToFirstByte), toFcp: ms(a.firstByteToFCP), load: a.loadState });
    }
    case "TTFB": {
      const a = m.attribution;
      return compact({ wait: ms(a.waitingDuration), cache: ms(a.cacheDuration), dns: ms(a.dnsDuration), conn: ms(a.connectionDuration), req: ms(a.requestDuration) });
    }
  }
}

/** A metric as one compact record. */
export function recordOf(m: AnyMetric): VitalRecord {
  const v = m.name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value);
  const url = (m as { navigationURL?: string }).navigationURL;
  return { n: m.name, v, r: m.rating, p: pageOf(url ? new URL(url, location.href).pathname : location.pathname), nt: m.navigationType, a: attributionOf(m) };
}

/** The device as a class (no identifiers). */
export function deviceOf(nav: Navigator = navigator, win: Window = window, doc: Document = document): VitalDevice {
  const ua = nav.userAgent;
  const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1) ? "ios" : "other";
  const n = nav as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  return {
    os,
    touch: win.matchMedia?.("(pointer: coarse)").matches ?? false,
    w: Math.round(win.innerWidth / 10) * 10,
    dpr: Math.round(win.devicePixelRatio * 100) / 100,
    ...(n.deviceMemory ? { mem: n.deviceMemory } : {}),
    ...(nav.hardwareConcurrency ? { cpu: nav.hardwareConcurrency } : {}),
    ...(n.connection?.effectiveType ? { net: n.connection.effectiveType.slice(0, 12) } : {}),
    ssr: doc.documentElement.hasAttribute("data-ssr"),
    sw: !!nav.serviceWorker?.controller,
  };
}

/** The page on screen before the current change (the router writes the new address before its transition starts). */
let here = "";
/** The frames of a View Transition: its longest, how many took over 50 ms, and how long it ran. */
function watchFrames(t: ViewTransition, page: boolean, push: (r: VitalRecord) => void) {
  const from = here || pageOf(location.pathname);
  const start = performance.now();
  let last = start;
  let longest = 0;
  let slow = 0;
  let running = true;
  const tick = (now: number) => {
    const d = now - last;
    last = now;
    if (d > longest) longest = d;
    if (d > 50) slow++;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(tick);
  });
  const end = () => {
    running = false;
    here = pageOf(location.pathname);
    push({ n: "VT", v: Math.round(longest), p: here, a: { kind: page ? "page" : "inpage", from, slow, dur: Math.round(performance.now() - start) } });
  };
  t.finished.then(end, end);
}

let started = false;
/** Starts measuring this visit (once). */
export async function startVitals(): Promise<void> {
  if (started || typeof window === "undefined" || typeof navigator.sendBeacon !== "function") return;
  started = true;
  if (Math.random() >= SAMPLE) return;
  const queue: VitalRecord[] = [];
  const push = (r: VitalRecord) => {
    if (queue.length < MAX_RECORDS) queue.push(r);
  };
  const flush = () => {
    if (!queue.length) return;
    const body = JSON.stringify({ d: deviceOf(), m: queue.splice(0, MAX_RECORDS) });
    // (text/plain: a simple request, no preflight; the function reads the raw body)
    navigator.sendBeacon(VITALS_URL, new Blob([body], { type: "text/plain" }));
  };
  here = pageOf(location.pathname);
  onViewTransition((t, page) => watchFrames(t, page, push));
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals/attribution");
  const report = (m: AnyMetric) => push(recordOf(m));
  // (each page of the app reports its own INP, CLS and LCP where the browser tells page changes apart)
  onLCP(report, { reportSoftNavs: true });
  onINP(report, { reportSoftNavs: true });
  onCLS(report, { reportSoftNavs: true });
  onFCP(report);
  onTTFB(report);
  // (after web-vitals' own listeners: on hiding the page it reports LCP, CLS and INP first, then this sends them)
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  addEventListener("pagehide", flush);
}
