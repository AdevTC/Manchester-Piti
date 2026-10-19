import { describe, expect, it } from "vitest";
import { seasonStrip, windowAt } from "../../../lib/derived/vidrio/strip";
import { longSeasonFixture, madridMs } from "../../../lib/derived/vidrio/fixtures";
import {
  countLine,
  distanceText,
  formLetters,
  goalsByStretch,
  lensTabs,
  longDay,
  minimapOf,
  nearestOnTrack,
  niceName,
  paintGradient,
  paintOf,
  ribbonGaps,
  rivalInitials,
  rivalTitle,
  seasonTotals,
  segmentAria,
  shortDay,
  signed,
  tinyDay,
  untilText,
  whenLine,
  windowSizeFor,
} from "./model";
import { sunCurve } from "./sunCurve";

const MIN = 60_000;
const F = longSeasonFixture();
const strip = seasonStrip(F.matches, F.seasonId, F.now);
const seg = (n: number) => strip.segments.find((s) => s.jornada === n)!;

describe("the light each jornada is painted in", () => {
  it("a midday kick-off is the noon sky with its high sun; a night one is floodlit, with no sun", () => {
    const noon = paintOf({ at: madridMs(2026, 9, 13, 12), light: { light: "dia", lightEnd: "dia", floodlights: false, sunset: 0 } });
    expect(noon.a).toBe("noon");
    expect(noon.b).toBe("noon");
    expect(noon.sun?.noon).toBe(true);
    const night = paintOf(seg(17));
    expect(night.a).toBe("flood");
    expect(night.sun).toBeNull();
    expect(night.floods).toBe(true);
  });
  it("a kick-off at sunset blends the light it starts in into the one it ends in", () => {
    const p = paintOf({ at: madridMs(2026, 9, 13, 19, 30), light: { light: "dorada", lightEnd: "noche", floodlights: true, sunset: 0 } });
    expect([p.a, p.b]).toEqual(["golden", "flood"]);
    expect(p.m0).toBeLessThan(p.m1);
  });
  it("undated: a plain night", () => {
    expect(paintOf({ at: null, light: null })).toMatchObject({ a: "flood", sun: null });
  });
  it("the gradient the CSS and the cartel share", () => {
    expect(paintGradient("noon")).toMatch(/^linear-gradient\(180deg,#17457F 0%/);
  });
});

describe("dates and words", () => {
  const ko = madridMs(2027, 1, 17, 19);
  it("segment lines", () => {
    expect(shortDay(ko)).toBe("Dom 17 ene, 19:00");
    expect(tinyDay(ko)).toBe("17 ene, 19:00");
    expect(longDay(ko)).toBe("domingo 17 de enero");
  });
  it("countdowns and distances", () => {
    expect(untilText(ko, ko - 134 * MIN)).toBe("Faltan 2 h 14 min");
    expect(untilText(ko, ko - 13 * MIN)).toBe("Faltan 13 min");
    expect(untilText(ko, ko + MIN)).toBe("Ya es la hora");
    expect(distanceText(ko, ko - 86_400_000)).toBe("Mañana.");
    expect(distanceText(ko, ko - 5 * 86_400_000)).toBe("Dentro de 5 días.");
    expect(distanceText(ko, ko - 49 * 86_400_000)).toBe("Dentro de 7 semanas.");
  });
  it("the lens's lines", () => {
    expect(rivalTitle({ rival: "Orduña fc", home: true })).toBe("Contra Orduña fc");
    expect(rivalTitle({ rival: "Pitutis", home: false })).toBe("En casa de Pitutis");
    expect(whenLine(seg(17), F.now)).toBe("Hoy, domingo 17 de enero, a las 19:00");
    expect(whenLine({ ...seg(20), state: "aplazado" }, F.now)).toMatch(/\(se aplazó\)$/);
  });
  it("crests and names", () => {
    expect(rivalInitials("Orduña fc")).toBe("OR");
    expect(rivalInitials("Cañas y Goles CF")).toBe("CG");
    expect(rivalInitials("Pitutis", "pi")).toBe("PI");
    expect(niceName("ADRIÁN T.C.")).toBe("Adrián T.C.");
    expect(niceName("Jordi")).toBe("Jordi");
    expect(signed(18)).toBe("+18");
    expect(signed(-3)).toBe("−3");
    expect(signed(0)).toBe("0");
  });
  it("a segment says what it is, never by its colour alone", () => {
    expect(segmentAria(seg(17), F.now, 23)).toBe("J17, domingo 17 de enero, contra Orduña fc. En directo: 2–1, minuto 23");
    expect(segmentAria(seg(1), F.now, null)).toMatch(/^J1, .*Jugado: 3–1, ganamos$/);
    expect(segmentAria(seg(9), F.now, null)).toMatch(/Aplazado$/);
  });
});

describe("the ribbon's window, gaps and minimap", () => {
  it("how many jornadas a width shows", () => {
    expect(windowSizeFor(1920)).toBe(10);
    expect(windowSizeFor(1440)).toBe(7);
    expect(windowSizeFor(820)).toBe(6);
    expect(windowSizeFor(390)).toBe(Number.POSITIVE_INFINITY);
  });
  it("a week is one unit; the Christmas break is wider and says so", () => {
    const g = ribbonGaps(strip.segments);
    expect(g.find((x) => x.label)).toMatchObject({ units: 3, label: "Sin partido" });
    expect(g.filter((x) => x.units === 1).length).toBeGreaterThan(20);
    expect(ribbonGaps([{ day: "2026-10-04" }, { day: "2026-10-18" }])[0]).toMatchObject({ units: 2, label: "11 oct, sin partido" });
  });
  it("the minimap: every jornada, the window, the months, today", () => {
    const w = windowAt(13, 7, strip.segments.length);
    const ids = strip.segments.slice(w.start, w.end).map((s) => s.id);
    const mm = minimapOf(strip.segments, ids, new Set(strip.segments.map((s) => s.id)), "j17", strip.todayIndex, F.now);
    expect(mm.marks).toHaveLength(26);
    expect(mm.marks.filter((m) => m.inWindow)).toHaveLength(7);
    expect(mm.marks.find((m) => m.selected)?.id).toBe("j17");
    expect(mm.marks[0].letter).toBe("G");
    expect(mm.marks[8].letter).toBe("A");
    expect(mm.marks[16].letter).toBe("•");
    expect(mm.months.map((m) => m.label)).toEqual(["sept", "oct", "nov", "dic", "ene", "feb", "mar"]);
    expect(mm.win.w).toBeGreaterThan(0);
    expect(mm.hoy).not.toBeNull();
    expect(nearestOnTrack(mm.marks, 0)).toBe(0);
    expect(nearestOnTrack(mm.marks, 1)).toBe(25);
  });
});

describe("the lens's tabs by state", () => {
  it("played, live, today, ahead, postponed, pendiente", () => {
    expect(lensTabs({ state: "jugado", at: 0, provisional: false })).toMatchObject({ initial: "acta", only: null });
    expect(lensTabs({ state: "jugado", at: 0, provisional: true }).tabs.map((t) => t.label)).toEqual(["Previa", "Directo", "Final"]);
    expect(lensTabs({ state: "directo", at: 0, provisional: true })).toMatchObject({ initial: "directo", tabs: [{ id: "previa" }, { id: "directo", live: true }] });
    const today = lensTabs({ state: "hoy", at: madridMs(2027, 1, 17, 19), provisional: false });
    expect(today.initial).toBe("previa");
    expect(today.tabs[1]).toMatchObject({ disabled: true, small: "a las 19:00" });
    expect(lensTabs({ state: "proximo", at: 0, provisional: false })).toMatchObject({ tabs: [], only: "Previa" });
    expect(lensTabs({ state: "aplazado", at: 0, provisional: false })).toMatchObject({ initial: "aplazado", only: "Aplazado" });
    expect(lensTabs({ state: "pendiente", at: 0, provisional: false })).toMatchObject({ initial: "pendiente", only: "Pendiente del acta" });
  });
});

describe("the season in words and figures", () => {
  it("the count line, and with a filter what it keeps", () => {
    expect(countLine(strip.counts, 10, "todos", 26)).toBe("26 jornadas; 15 jugadas, una en directo y 10 por jugar");
    expect(countLine(strip.counts, 10, "proximos", 11)).toBe("11 jornadas por jugar");
    expect(countLine(strip.counts, 10, "resultados", 1)).toBe("1 jornada con resultado");
  });
  it("the form: the last six played (tonight provisional), then what is open", () => {
    const f = formLetters(strip.segments, { j18: "G" });
    expect(f).toHaveLength(7);
    expect(f[5]).toMatchObject({ text: "G", kind: "prov", aria: "J17, ganando, provisional" });
    expect(f[6]).toMatchObject({ text: "G", kind: "prov", aria: "J18, de mentira" });
    expect(formLetters(strip.segments).at(-1)).toMatchObject({ text: "J18", kind: "empty" });
  });
  it("goals by five-minute stretch: ours and theirs", () => {
    const g = goalsByStretch(strip.segments.filter((s) => s.state === "jugado" || s.state === "directo").map((s) => s.match));
    expect(g.us).toHaveLength(10);
    expect(g.us.reduce((a, b) => a + b, 0)).toBeGreaterThan(20);
    expect(g.them.reduce((a, b) => a + b, 0)).toBeGreaterThan(10);
  });
  it("totals: provisional while live, what is left or what was played", () => {
    const t = seasonTotals({ gf: 36, gc: 18 }, { gf: 0, ga: 0 }, 2, 11, true, false, 26);
    expect(t.items.map((i) => i.value)).toEqual(["36", "18", "+18", "2º", "11"]);
    expect(t.items[3].label).toBe("si acaba así");
    expect(t.items[0].provisional).toBe(true);
    expect(seasonTotals(null, { gf: 1, ga: 1 }, null, 0, false, true, 10).items.map((i) => `${i.value} ${i.label}`)).toEqual(["1 gol nuestro", "1 encajado", "0 de diferencia", "– en la tabla", "10 jornadas jugadas"]);
  });
});

describe("the light of that evening", () => {
  it("a winter evening: the sun sets before a 19:00 kick-off, the hours around it", () => {
    const c = sunCurve(madridMs(2027, 1, 17, 19));
    expect(c.labels.map((l) => l.text)).toEqual(["17:00", "focos", "19:00 pitido", "21:00"]);
    expect(c.sunY).toBeNull();
    expect(c.aria).toMatch(/^La luz de esa tarde: el sol se pone a las 18:/);
  });
  it("a summer midday: the sun is up at the whistle", () => {
    const c = sunCurve(madridMs(2026, 9, 13, 12));
    expect(c.sunY).not.toBeNull();
    expect(c.labels).toHaveLength(3);
  });
});
