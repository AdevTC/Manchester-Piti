// How the site feels on the visitors' own phones: the Core Web Vitals (web-vitals, attribution build: what made
// each one slow) and the frames of each View Transition, sent once the tab is hidden or closed (one beacon) to
// /datos/v (vercel.json → functions/src/vitals.ts). Nothing personal: no account, the device only as a class.
// Loaded after the first paint, never on the way to it.
import type { CLSMetricWithAttribution, FCPMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution, TTFBMetricWithAttribution } from "web-vitals/attribution";
import type { VitalDevice, VitalRecord } from "../../functions/src/vitalsLogic";
import { onViewTransition } from "../components/celeste/pageTransition";
import { vitalsOff } from "./vitalsOff";
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

type NotRestored = { reasons?: { reason?: string }[] | null; children?: NotRestored[] | null };
/** Why a page reached with back/forward was loaded again instead of coming back from the back/forward cache (Chrome's
 *  notRestoredReasons: this page's and its frames', deduplicated), or nothing when it wasn't such a load. */
export function notRestored(entry: unknown): string | undefined {
  const root = (entry as { notRestoredReasons?: NotRestored | null } | undefined)?.notRestoredReasons;
  if (!root) return undefined;
  const seen = new Set<string>();
  const walk = (n: NotRestored) => {
    for (const r of n.reasons ?? []) if (r?.reason) seen.add(r.reason);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return text([...seen].join(","), 120) || "-";
}

/** When the View Transitions of this visit started (performance.now()), the last few: an INP that started one says so. */
const vtStarts: number[] = [];
/** Whether a View Transition started between a tap and the frame that showed its answer (`starts`: their start times). */
export function startedTransition(a: { interactionTime?: number; nextPaintTime?: number }, starts: readonly number[] = vtStarts): boolean {
  const { interactionTime: from, nextPaintTime: to } = a;
  if (typeof from !== "number" || typeof to !== "number") return false;
  return starts.some((t) => t >= from && t <= to);
}

/** What made a metric what it is, in a few fields. */
export function attributionOf(m: AnyMetric): Attr {
  switch (m.name) {
    case "LCP": {
      const a = m.attribution;
      return compact({ el: text(a.target), url: urlPath(a.url), ttfb: ms(a.timeToFirstByte), wait: ms(a.resourceLoadDelay), load: ms(a.resourceLoadDuration), render: ms(a.elementRenderDelay) });
    }
    case "INP": {
      const a = m.attribution;
      // (with reportSoftNavs, a page reached by a soft navigation whose taps were all quick still reports an INP, with
      // no interaction behind it: web-vitals fills it in as all «presentation» and no element. A filler, not a tap.)
      if (m.entries.length === 0) return compact({ fill: true, load: a.loadState });
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
        // (the tap started a View Transition: its «presentation» includes the transition's first frame)
        vt: startedTransition(a) || undefined,
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
      return compact({ wait: ms(a.waitingDuration), cache: ms(a.cacheDuration), dns: ms(a.dnsDuration), conn: ms(a.connectionDuration), req: ms(a.requestDuration), nr: notRestored(a.navigationEntry) });
    }
  }
}

/** True when this document started loading in a tab nobody was looking at: the service worker's switch to a new
 *  deploy reloads a hidden tab (lib/appUpdate), and a hidden tab's load runs throttled (its TTFB waits ~1 s for a
 *  slot), so its numbers are no one's wait. The first `visibility-state` entry says how it started; without that API,
 *  whether it is hidden now (this runs right after the first render). */
export function startedHidden(perf: Pick<Performance, "getEntriesByType"> = performance, doc: Pick<Document, "visibilityState"> = document): boolean {
  try {
    const first = perf.getEntriesByType("visibility-state")[0];
    if (first) return first.name === "hidden";
  } catch {
    /* no such entry type */
  }
  return doc.visibilityState === "hidden";
}

/** A metric as one compact record. */
export function recordOf(m: AnyMetric, hidden = false): VitalRecord {
  const v = m.name === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value);
  const url = (m as { navigationURL?: string }).navigationURL;
  const a = attributionOf(m);
  // (only TTFB is reported for a load that began hidden: web-vitals leaves out the paints of such a page)
  if (hidden && m.name === "TTFB") a.bg = true;
  return { n: m.name, v, r: m.rating, p: pageOf(url ? new URL(url, location.href).pathname : location.pathname), nt: m.navigationType, a };
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
    ...(nav.webdriver ? { bot: true } : {}),
  };
}

/** A Long Animation Frame entry (Chrome 123+), the fields used here. */
export type Loaf = {
  startTime: number;
  duration: number;
  renderStart: number;
  styleAndLayoutStart: number;
  scripts?: readonly { duration: number; forcedStyleAndLayoutDuration?: number; sourceURL?: string; invoker?: string }[];
};
/** The long animation frames seen lately (Chrome only; the observer keeps the last ones). */
const loafs: Loaf[] = [];
let loafObserver: PerformanceObserver | null = null;
const MAX_LOAFS = 60;
const keepLoafs = (list: PerformanceEntryList) => {
  for (const e of list) loafs.push(e as unknown as Loaf);
  if (loafs.length > MAX_LOAFS) loafs.splice(0, loafs.length - MAX_LOAFS);
};
function watchLoafs() {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) return;
    loafObserver = new PerformanceObserver((l) => keepLoafs(l.getEntries()));
    loafObserver.observe({ type: "long-animation-frame", buffered: true });
  } catch {
    loafObserver = null;
  }
}

/** Where the time of a View Transition's worst frame went, from the long animation frames that overlap it (`from`–`to`):
 *  `lf` the frame, `lfJs` tasks and scripts before rendering, `lfRaf` rAF callbacks and observers, `lfLay` style,
 *  layout and paint, `lfForced` layout forced from scripts, `lfScript` its longest script, `lfN` how many long frames.
 *  Long frames short next to the longest frame rAF saw mean the time went to the GPU (raster, compositing). */
export function frameBreakdown(entries: readonly Loaf[], from: number, to: number): Attr {
  const during = entries.filter((e) => e.startTime < to && e.startTime + e.duration > from);
  if (!during.length) return {};
  const worst = during.reduce((a, b) => (b.duration > a.duration ? b : a));
  const end = worst.startTime + worst.duration;
  const rendered = worst.renderStart > 0;
  const scripts = worst.scripts ?? [];
  const longest = scripts.reduce<(typeof scripts)[number] | undefined>((a, b) => (!a || b.duration > a.duration ? b : a), undefined);
  return compact({
    lf: ms(worst.duration),
    lfJs: ms((rendered ? worst.renderStart : end) - worst.startTime),
    lfRaf: rendered ? ms(Math.max(0, (worst.styleAndLayoutStart || end) - worst.renderStart)) : 0,
    lfLay: rendered ? ms(end - (worst.styleAndLayoutStart || end)) : 0,
    lfForced: ms(scripts.reduce((s, x) => s + (x.forcedStyleAndLayoutDuration ?? 0), 0)),
    lfScript: urlPath(longest?.sourceURL) ?? text(longest?.invoker),
    lfN: during.length,
  });
}

/** The page on screen before the current change (the router writes the new address before its transition starts). */
let here = "";
/** The frames of a View Transition: its longest, how many took over 50 ms, how long it ran, and (Chrome) where the
 *  time of its worst frame went. */
function watchFrames(t: ViewTransition, page: boolean, push: (r: VitalRecord) => void) {
  const from = here || pageOf(location.pathname);
  const start = performance.now();
  vtStarts.push(start);
  if (vtStarts.length > 20) vtStarts.shift();
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
    const now = performance.now();
    // (the frames that ended just now may not have reached the observer's callback yet)
    if (loafObserver) keepLoafs(loafObserver.takeRecords());
    push({ n: "VT", v: Math.round(longest), p: here, a: { kind: page ? "page" : "inpage", from, slow, dur: Math.round(now - start), ...frameBreakdown(loafs, start, now) } });
  };
  t.finished.then(end, end);
}

let started = false;
/** Starts measuring this visit (once). */
export async function startVitals(): Promise<void> {
  if (started || typeof window === "undefined" || typeof navigator.sendBeacon !== "function" || vitalsOff()) return;
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
  watchLoafs();
  onViewTransition((t, page) => watchFrames(t, page, push));
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals/attribution");
  const hidden = startedHidden();
  const report = (m: AnyMetric) => push(recordOf(m, hidden));
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
