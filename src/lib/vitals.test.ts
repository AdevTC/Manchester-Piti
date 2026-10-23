import { describe, expect, it } from "vitest";
import type { INPMetricWithAttribution, LCPMetricWithAttribution, CLSMetricWithAttribution } from "web-vitals/attribution";
import { parseVitals, MAX_BODY, RATE_PER_MIN, withinRate } from "../../functions/src/vitalsLogic";
import { attributionOf, deviceOf, pageOf, recordOf } from "./vitals";

describe("pages group by their kind, ids folded", () => {
  it.each([
    ["/", "/"],
    ["/numeros/", "/numeros"],
    ["/jugadores/alcides/temporada", "/jugadores/:id/temporada"],
    ["/partidos/j1/siete", "/partidos/:id/siete"],
    ["/partidos/tabla", "/partidos/tabla"],
    ["/club/vitrina/escudo?x=1", "/club/vitrina/:id"],
  ])("%s → %s", (path, page) => expect(pageOf(path)).toBe(page));
});

describe("a metric becomes one small record with its cause", () => {
  it("INP: the tapped element and where the time went", () => {
    const m = {
      name: "INP",
      value: 312.4,
      rating: "poor",
      navigationType: "navigate",
      attribution: {
        interactionTarget: "button.nu-rail__b",
        interactionType: "pointer",
        inputDelay: 12.2,
        processingDuration: 180.6,
        presentationDelay: 119.6,
        totalScriptDuration: 170,
        totalStyleAndLayoutDuration: 60,
        totalPaintDuration: 40,
        totalUnattributedDuration: 4,
        longestScript: { entry: { sourceURL: `${location.origin}/assets/NumerosPage-abc.js`, invoker: "BUTTON#onclick" }, intersectingDuration: 150.2, subpart: "processing-duration" },
        loadState: "complete",
        longAnimationFrameEntries: [],
        processedEventEntries: [],
      },
    } as unknown as INPMetricWithAttribution;
    expect(recordOf(m)).toEqual({
      n: "INP",
      v: 312,
      r: "poor",
      p: pageOf(location.pathname),
      nt: "navigate",
      a: { el: "button.nu-rail__b", type: "pointer", input: 12, proc: 181, pres: 120, js: 170, style: 60, paint: 40, other: 4, script: "/assets/NumerosPage-abc.js", scriptMs: 150, load: "complete" },
    });
  });

  it("LCP keeps a foreign resource as host + path, and leaves out what it doesn't know", () => {
    const m = { name: "LCP", value: 2210, rating: "good", attribution: { target: "img.in-hero", url: "https://cdn.example.com/a/b.png?q=1", timeToFirstByte: 300, resourceLoadDelay: 10, resourceLoadDuration: 900, elementRenderDelay: 1000 } } as unknown as LCPMetricWithAttribution;
    expect(attributionOf(m)).toEqual({ el: "img.in-hero", url: "cdn.example.com/a/b.png", ttfb: 300, wait: 10, load: 900, render: 1000 });
  });

  it("CLS keeps three decimals", () => {
    const m = { name: "CLS", value: 0.05312, rating: "good", attribution: { largestShiftTarget: "div.nu-screen", largestShiftValue: 0.0531, largestShiftTime: 1234.5 } } as unknown as CLSMetricWithAttribution;
    expect(recordOf(m).v).toBe(0.053);
    expect(attributionOf(m)).toEqual({ el: "div.nu-screen", shift: 0.053, at: 1235 });
  });
});

describe("the device is a class, never an identifier", () => {
  it("reads an Android phone", () => {
    const nav = { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/150", maxTouchPoints: 5, hardwareConcurrency: 8, deviceMemory: 4, connection: { effectiveType: "4g" }, serviceWorker: { controller: {} } } as unknown as Navigator;
    const win = { innerWidth: 412, devicePixelRatio: 2.625, matchMedia: () => ({ matches: true }) } as unknown as Window;
    const doc = { documentElement: { hasAttribute: () => true } } as unknown as Document;
    expect(deviceOf(nav, win, doc)).toEqual({ os: "android", touch: true, w: 410, dpr: 2.63, mem: 4, cpu: 8, net: "4g", ssr: true, sw: true });
  });
  it("marks a browser driven by automation", () => {
    const nav = { userAgent: "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/150", maxTouchPoints: 0, hardwareConcurrency: 4, webdriver: true } as unknown as Navigator;
    const win = { innerWidth: 1280, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) } as unknown as Window;
    const doc = { documentElement: { hasAttribute: () => false } } as unknown as Document;
    expect(deviceOf(nav, win, doc)).toMatchObject({ os: "other", bot: true });
  });
});

describe("what the function accepts", () => {
  const device = { os: "ios", touch: true, w: 390, dpr: 3, ssr: false, sw: true };
  it("a report as the phones send it", () => {
    const body = JSON.stringify({ d: device, m: [{ n: "LCP", v: 1800, r: "good", p: "/", nt: "navigate", a: { el: "h1", ttfb: 200 } }, { n: "VT", v: 48, p: "/numeros", a: { kind: "page", from: "/", slow: 0, dur: 420 } }] });
    expect(parseVitals(body)?.m).toHaveLength(2);
  });
  it.each([
    ["not JSON", "{"],
    ["no measurements", JSON.stringify({ d: device, m: [] })],
    ["an unknown metric", JSON.stringify({ d: device, m: [{ n: "XYZ", v: 1, p: "/" }] })],
    ["a negative value", JSON.stringify({ d: device, m: [{ n: "INP", v: -1, p: "/" }] })],
    ["a page too long", JSON.stringify({ d: device, m: [{ n: "INP", v: 1, p: "/".repeat(81) }] })],
    ["too many measurements", JSON.stringify({ d: device, m: Array.from({ length: 41 }, () => ({ n: "INP", v: 1, p: "/" })) })],
    ["too big", "x".repeat(MAX_BODY + 1)],
  ])("refuses %s", (_label, body) => expect(parseVitals(body)).toBeNull());
});

describe("a flood of reports can't run up the writes", () => {
  it("stores at most RATE_PER_MIN a minute, then makes room again", () => {
    const recent: number[] = [];
    for (let i = 0; i < RATE_PER_MIN; i++) expect(withinRate(recent, 1_000 + i)).toBe(true);
    expect(withinRate(recent, 2_000)).toBe(false);
    expect(withinRate(recent, 61_000)).toBe(true);
  });
});

describe("nothing that could drive a terminal is stored", () => {
  it.each([
    ["in the page", { n: "INP", v: 1, p: "/\u001b[2J" }],
    ["in a cause", { n: "INP", v: 1, p: "/", a: { el: "x\u0007" } }],
    ["in a cause's name", { n: "INP", v: 1, p: "/", a: { "e\u0000l": "x" } }],
  ])("refuses control characters %s", (_label, m) => {
    expect(parseVitals(JSON.stringify({ d: { os: "ios", touch: true, w: 390, dpr: 3, ssr: false, sw: true }, m: [m] }))).toBeNull();
  });
});
