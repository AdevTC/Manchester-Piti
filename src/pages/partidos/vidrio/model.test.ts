import { describe, expect, it } from "vitest";
import { seasonStrip, windowAt } from "../../../lib/derived/vidrio/strip";
import { longSeasonFixture, madridMs } from "../../../lib/derived/vidrio/fixtures";
import {
  breakName,
  closesWord,
  newDateLine,
  newDateOf,
  playedWeatherLine,
  postponedLine,
  decollide,
  leaguePhrase,
  lightLine,
  placeLine,
  porraVerdict,
  seasonSpan,
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
    expect(segmentAria(seg(17), F.now, 23)).toBe("J17, domingo 17 de enero, contra Orduña fc. En directo: 2\u2060–\u20601, minuto 23");
    expect(segmentAria(seg(1), F.now, null)).toMatch(/^J1, .*Jugado: 3\u2060–\u20601, ganamos$/);
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
    expect(g.find((x) => x.label)).toMatchObject({ units: 3, label: "Navidad" });
    expect(g.filter((x) => x.units === 1).length).toBeGreaterThan(20);
    expect(ribbonGaps([{ day: "2026-10-04" }, { day: "2026-10-18" }])[0]).toMatchObject({ units: 2, label: "11 oct, sin partido" });
  });
  it("a long stop is named by what it holds: Navidad, Semana Santa, Verano, else «Sin partido»", () => {
    expect(breakName("2025-12-14", "2026-01-11")).toBe("Navidad");
    expect(breakName("2026-03-22", "2026-04-19")).toBe("Semana Santa");
    expect(breakName("2026-07-26", "2026-09-06")).toBe("Verano");
    expect(breakName("2026-02-01", "2026-03-01")).toBe("Sin partido");
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

describe("the cierre: today, the light line, the season in words, the lens's words", () => {
  it("today's segment says «Hoy»", () => {
    const at = madridMs(2026, 10, 18, 19);
    expect(shortDay(at, at - 3 * 3_600_000)).toBe("Hoy, 19:00");
    expect(tinyDay(at, at - 3 * 3_600_000)).toBe("Hoy, 19:00");
    expect(shortDay(at, at - 86_400_000)).toMatch(/^Dom 18 oct, 19:00$/);
  });
  it("the light of a kick-off in words, the forecast's temperature instead of the sun's height", () => {
    const noon = madridMs(2026, 10, 25, 14);
    expect(lightLine({ light: { light: "dia", lightEnd: "dia", floodlights: false, sunset: 0 }, at: noon })).toMatch(/^Sol de mediodía, a \d+°$/);
    expect(lightLine({ light: { light: "dorada", lightEnd: "noche", floodlights: true, sunset: 0 }, at: noon }, 14)).toBe("Atardecer y focos, 14°");
    expect(lightLine({ light: { light: "ocaso", lightEnd: "noche", floodlights: true, sunset: 0 }, at: noon })).toBe("Anochece al empezar: con focos");
    expect(lightLine({ light: null, at: null })).toBe("");
  });
  it("the league as a phrase, the season's span", () => {
    expect(leaguePhrase("Liga F7")).toBe("liga de fútbol 7");
    expect(leaguePhrase("Liga de fútbol 7")).toBe("liga de fútbol 7");
    expect(leaguePhrase("")).toBe("");
    expect(seasonSpan(["2026-03-08", "2026-05-24"])).toBe("primavera de 2026");
    expect(seasonSpan(["2025-09-14", "2026-05-24"])).toBe("de septiembre de 2025 a mayo de 2026");
    expect(seasonSpan([])).toBe("");
  });
  it("the place line, the porra's verdict", () => {
    expect(placeLine(true, "Puente de Vallecas", "CDM PALOMERAS")).toBe("En casa, en Puente de Vallecas");
    expect(placeLine(false, null, "Campo de Moratalaz")).toBe("Fuera, en Moratalaz");
    expect(porraVerdict({ gf: 2, ga: 1 }, { gf: 2, ga: 1 })).toBe("exacta");
    expect(porraVerdict({ gf: 2, ga: 1 }, { gf: 3, ga: 1 })).toBe("cerca");
    expect(porraVerdict({ gf: 0, ga: 0 }, { gf: 3, ga: 1 })).toBe("no");
  });
  it("the momentum marks don't pile up: a goal keeps its glyph, a card next to it only shapes the wave", () => {
    const out = decollide(
      [
        { x: 40, side: "us" as const, goal: false, kind: "tarjeta" as const },
        { x: 42, side: "us" as const, goal: true, kind: "gol" as const },
        { x: 43, side: "them" as const, goal: false, kind: "parada" as const },
        { x: 70, side: "us" as const, goal: false, kind: "palo" as const },
      ],
      8,
    );
    expect(out.map((o) => o.kind)).toEqual(["otro", "gol", "parada", "palo"]);
  });
  it("the new data in words: why it was postponed, its new date, when the vote closes, the weather it had", () => {
    expect(postponedLine("Por lluvia: el campo no estaba para jugar")).toBe("Aplazado por lluvia: el campo no estaba para jugar.");
    expect(postponedLine("El campo estaba cerrado por obras")).toBe("Aplazado: el campo estaba cerrado por obras.");
    expect(postponedLine("Aplazado por la federación.")).toBe("Aplazado por la federación.");
    expect(postponedLine("  ")).toBe("");
    expect(newDateOf({ postponedTo: 5 })).toBe(5);
    expect(newDateOf({ postponedTo: null })).toBeNull();
    expect(newDateLine(madridMs(2027, 2, 3, 21))).toBe("Se juega el miércoles 3 de febrero a las 21:00");
    const now = madridMs(2026, 10, 18, 20);
    expect(closesWord(madridMs(2026, 10, 20, 21), now)).toBe("el martes");
    expect(closesWord(madridMs(2026, 10, 19, 21), now)).toBe("mañana a las 21:00");
    expect(closesWord(madridMs(2026, 11, 3, 21), now)).toBe("el martes 3 de noviembre");
    expect(playedWeatherLine({ temp: 15.4, label: "Nubes y claros" })).toBe("Hizo 15°, nubes y claros, a la hora del pitido.");
  });
});
