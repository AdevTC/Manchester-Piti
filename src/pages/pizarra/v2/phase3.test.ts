import { describe, expect, it } from "vitest";
import { planArrows, setTactic, tacRows } from "./plan";
import { planLayer } from "./view";
import { changes, cmpMarks, meanForm, tape } from "./compare";
import { boardLink, convCounts, convocatoriaOf, copyName, matchBand, matchLabel, nameError, officialFor, uniqueName, withConvocatoria, type CalMatch } from "./boards";
import { CARTEL_H, CARTEL_W, cartelFile, cartelLayout, drawCartel } from "./cartel";
import { parsePrefs, PREFS0, readPrefs, SHOW0, writePrefs } from "./prefs";
import { chem } from "./quimica";
import { slotPos } from "./geometry";
import { boardDoc, demoSquad, lineupOf } from "./testkit";

// The pure logic of phase 3: the plan painted on the pitch, Comparar, the boards (names, the official,
// the match band), the convocatoria on the cromos, the cartel's layout and the stored preferences.

const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const sq = demoSquad();
const withTac = (t: Record<string, string>) => {
  const L = lineupOf(SEVEN, "2-3-1", sq);
  return { ...L, tactics: { ...L.tactics, ...t } };
};

describe("el plan", () => {
  it("lists the seven consignas as designed: five scales, then salida and foco as choices", () => {
    const rows = tacRows(withTac({ press: "Alta" }));
    expect(rows.map((r) => r.key)).toEqual(["defLine", "press", "width", "mentality", "tempo", "buildup", "attackFocus"]);
    expect(rows.map((r) => r.kind)).toEqual(["esc", "esc", "esc", "esc", "esc", "seg", "seg"]);
    expect(rows[1]).toMatchObject({ value: "Alta", vi: 2 });
    // a stored value that isn't on the scale reads as the default
    expect(tacRows(withTac({ tempo: "Frenético" }))[4]).toMatchObject({ value: "Medio", vi: 1 });
  });

  it("changes one consigna, only to a value of its scale", () => {
    const L = withTac({});
    expect(setTactic(L, "width", "Amplia").tactics.width).toBe("Amplia");
    expect(setTactic(L, "width", "Gigante")).toBe(L);
    const same = setTactic(L, "width", "Amplia");
    expect(setTactic(same, "width", "Amplia")).toBe(same);
  });

  it("amplitud spreads the block and mentalidad moves it (the goalkeeper stays)", () => {
    const narrow = withTac({ width: "Estrecha" });
    const wide = withTac({ width: "Amplia" });
    expect(Math.abs(slotPos(wide, 3).u - 50)).toBeGreaterThan(Math.abs(slotPos(narrow, 3).u - 50));
    const back = withTac({ mentality: "Defensiva" });
    const up = withTac({ mentality: "Ofensiva" });
    expect(slotPos(up, 6).v).toBeLessThan(slotPos(back, 6).v);
    expect(slotPos(up, 0)).toEqual(slotPos(back, 0));
  });

  it("paints the salida from the keeper and the foco lanes", () => {
    const corta = planArrows(withTac({ buildup: "Corta", attackFocus: "Bandas" }), "tv");
    // 2-3-1: two defenders, no long ball; two lanes on the wings
    expect(corta.filter((a) => a.key.startsWith("s"))).toHaveLength(2);
    expect(corta.some((a) => a.key === "l")).toBe(false);
    expect(corta.filter((a) => a.c === "sky")).toHaveLength(2);
    const largo = planArrows(withTac({ buildup: "En largo", attackFocus: "Centro" }), "tv");
    expect(largo.map((a) => a.key)).toEqual(["l", "f0"]);
    const mixta = planArrows(withTac({ buildup: "Mixta", attackFocus: "Equilibrado" }), "tv");
    expect(mixta.filter((a) => !a.c.startsWith("sky")).every((a) => a.c === "thin")).toBe(true);
    expect(mixta.filter((a) => a.c === "sky thin")).toHaveLength(3);
    mixta.forEach((a) => expect(a.d).toMatch(/^M[\d.]+ [\d.]+Q/));
    expect(planArrows({ ...withTac({}), freeMode: true }, "tv")).toEqual([]);
  });

  it("the plan layer paints the arrows only while the plan is open", () => {
    const L = withTac({});
    expect(planLayer(L, "tv", "editar").tarrs).toEqual([]);
    expect(planLayer(L, "tv", "editar", true).tarrs.length).toBeGreaterThan(0);
  });
});

describe("comparar", () => {
  const A = lineupOf(SEVEN, "2-3-1", sq);
  const B = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "kevin", "erik"], "3-2-1", sq);

  it("the tale of the tape: química, system, mean form and goals+assists per line, the better side marked", () => {
    const rows = tape(A, B, sq);
    expect(rows.map((r) => r.k)).toEqual(["Química", "Sistema", "Forma media", "DEF · G+A", "MED · G+A", "DEL · G+A"]);
    expect(rows[1]).toMatchObject({ a: "2-3-1", b: "3-2-1", ca: "", cb: "" });
    const form = rows[2];
    expect(form.a).toBe(meanForm(A, sq));
    expect(form.b).toBe(meanForm(B, sq));
    if (form.a !== form.b) expect(form.a > form.b ? form.ca : form.cb).toBe("w");
    expect(meanForm(lineupOf([]), sq)).toBe(0);
  });

  it("who comes in and who goes out, marked on the pitch", () => {
    expect(changes(A, B)).toEqual({ ins: ["kevin", "erik"], outs: ["almachi", "adrian"] });
    const marks = cmpMarks(A, B, "tv");
    expect(marks.filter((m) => m.cls === "")).toHaveLength(2);
    expect(marks.filter((m) => m.cls === "out")).toHaveLength(2);
    marks.forEach((m) => {
      expect(+m.x).toBeGreaterThanOrEqual(0);
      expect(+m.x).toBeLessThanOrEqual(100);
    });
    expect(changes(A, A)).toEqual({ ins: [], outs: [] });
    expect(cmpMarks(A, A, "tv")).toEqual([]);
  });
});

describe("tableros", () => {
  const mine = [
    { id: "a", name: "J8 · MAD SKY" },
    { id: "b", name: "Plan B" },
  ];

  it("a name must be there, short and yours only once (case and accents aside)", () => {
    expect(nameError("   ", mine, "a")).toBe("Ponle un nombre al tablero");
    expect(nameError("x".repeat(41), mine, "a")).toMatch(/Máximo 40/);
    expect(nameError("plan b", mine, "a")).toBe("Ya tienes un tablero con ese nombre");
    expect(nameError("PLÁN  B ", mine, "a")).toBe("Ya tienes un tablero con ese nombre");
    // its own name is fine
    expect(nameError("Plan B", mine, "b")).toBeNull();
    expect(nameError("Ensayo de córners", mine, "a")).toBeNull();
  });

  it("new boards and copies get a free name", () => {
    expect(uniqueName("Tablero nuevo", [])).toBe("Tablero nuevo");
    expect(uniqueName("Tablero nuevo", ["Tablero nuevo", "tablero nuevo 2"])).toBe("Tablero nuevo 3");
    expect(copyName("Plan B", false, ["Plan B (copia)"])).toBe("Plan B (copia) 2");
    expect(copyName("Oficial J8", true, [])).toBe("Copia del oficial");
    expect(uniqueName("x".repeat(60), []).length).toBeLessThanOrEqual(40);
  });

  it("the official for a match: that match's, else the season's, the newest first", () => {
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const season = boardDoc("s", L, { isOfficial: true, matchId: null, updatedAt: 5 });
    const j8 = boardDoc("j8", L, { isOfficial: true, matchId: "m8", updatedAt: 3 });
    const old = boardDoc("old", L, { isOfficial: true, matchId: "m8", updatedAt: 1 });
    expect(officialFor([season, j8, old], "m8")?.id).toBe("j8");
    expect(officialFor([season, j8], "m9")?.id).toBe("s");
    expect(officialFor([season, j8], null)?.id).toBe("s");
    expect(officialFor([j8], "m9")).toBeNull();
  });

  const m = (o: Partial<CalMatch>): CalMatch => ({ id: "m8", j: 8, rival: "MAD SKY", dateMs: Date.UTC(2026, 10, 8, 10), played: false, gf: null, ga: null, home: true, venue: "Campo 3", ...o });
  it("the match band: V / E / D once played, por jugar before", () => {
    expect(matchBand(m({ played: true, gf: 3, ga: 1 }))).toMatchObject({ r: "g", letter: "V", title: "Victoria · 3–1 · MAD SKY" });
    expect(matchBand(m({ played: true, gf: 2, ga: 2 }))).toMatchObject({ r: "e", letter: "E" });
    expect(matchBand(m({ played: true, gf: 0, ga: 1 }))).toMatchObject({ r: "p", letter: "D", title: "Derrota · 0–1 · MAD SKY" });
    const next = matchBand(m({}));
    expect(next).toMatchObject({ r: "f", letter: "·", title: "Por jugar · MAD SKY" });
    expect(next.sub).toMatch(/^J8 · dom 8 nov · 11:00 · En casa · Campo 3$/);
    expect(matchBand(null).title).toBe("Sin partido vinculado");
    expect(matchLabel(m({ played: true, gf: 3, ga: 1 }))).toBe("J8 · MAD SKY · 3–1");
    expect(matchLabel(m({}))).toBe("J8 · MAD SKY");
  });

  it("the link to a board turns the new board on while it is behind its switch", () => {
    expect(boardLink("https://piti.club", "a b")).toBe("https://piti.club/pizarra?tablero=a%20b&v2");
    expect(boardLink("https://piti.club", "x", false)).toBe("https://piti.club/pizarra?tablero=x");
  });
});

describe("la convocatoria en los cromos", () => {
  it("maps the answers to Voy / Duda / No va by ficha; the most cautious wins", () => {
    const conv = convocatoriaOf([
      { response: "yes", playerId: "tello" },
      { response: "maybe", playerId: "kevin" },
      { response: "no", playerId: "adrian" },
      { response: "yes", playerId: null },
      { response: "yes", playerId: "erik" },
      { response: "no", playerId: "erik" },
    ]);
    expect(Object.fromEntries(conv)).toEqual({ tello: "voy", kevin: "duda", adrian: "no", erik: "no" });
  });

  it("puts each answer on its cromo and leaves the rest without one", () => {
    const sq2 = withConvocatoria(sq, new Map([["tello", "voy"], ["adrian", "no"]]));
    expect(sq2.byId.get("tello")?.cv).toBe("voy");
    expect(sq2.byId.get("adrian")?.cv).toBe("no");
    expect(sq2.byId.get("evans")?.cv).toBeUndefined();
    expect(convCounts(sq2)).toEqual({ voy: 1, duda: 0, no: 1, sin: sq.list.length - 2 });
    // nothing to say: the same squad
    expect(withConvocatoria(sq, null)).toBe(sq);
    expect(withConvocatoria(sq, new Map())).toBe(sq);
    // answers that went away are cleared
    expect(withConvocatoria(sq2, new Map()).byId.get("tello")?.cv).toBeUndefined();
  });
});

describe("el cartel", () => {
  it("lays the seven out as the preview draws them, with the química between them", () => {
    const L = { ...lineupOf(SEVEN, "2-3-1", sq), roles: { captainId: "illescas" } };
    const ch = chem(L, sq);
    const c = cartelLayout(L, sq, ch, "J8 · MAD SKY", "Temporada 1");
    expect(c.kick).toBe("J8 · MAD SKY · 2-3-1");
    expect(c.cromos).toHaveLength(7);
    expect(c.cromos[0]).toMatchObject({ id: "evans", gk: true });
    expect(c.cromos.find((x) => x.id === "illescas")?.gal).toEqual(["C"]);
    const p = slotPos(L, 6);
    expect(c.cromos[6]).toMatchObject({ x: +p.u.toFixed(1), y: +(6 + p.v * 0.86).toFixed(1) });
    c.cromos.forEach((x) => {
      expect(x.x).toBeGreaterThanOrEqual(7);
      expect(x.x).toBeLessThanOrEqual(93);
      expect(x.y).toBeGreaterThanOrEqual(8);
      expect(x.y).toBeLessThanOrEqual(86);
    });
    expect(c.links).toHaveLength(ch.links.length);
    expect(c.qv).toBe(ch.v);
    expect(c.aria).toMatch(/^Cartel: los siete de J8 · MAD SKY, 2-3-1, química \d+: 1 EVANS/);
    const empty = cartelLayout(lineupOf([]), sq, chem(lineupOf([]), sq), null, "Temporada 1");
    expect(empty.kick).toBe("Temporada 1 · 2-3-1");
    expect(empty.cromos).toEqual([]);
  });

  it("draws the 1080×1350 cartel: title, the seven, the química and the crest", async () => {
    // a 2D context that records what is written (no canvas in the test DOM)
    const texts: string[] = [];
    const images: unknown[] = [];
    const grad = { addColorStop: () => {} };
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === "fillText" || k === "strokeText") return (s: string) => texts.push(s);
        if (k === "drawImage") return (img: unknown) => images.push(img);
        if (k === "measureText") return (s: string) => ({ width: s.length * 12 });
        if (k === "createLinearGradient" || k === "createRadialGradient") return () => grad;
        return () => {};
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    });
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "getContext", { value: () => ctx });
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const c = cartelLayout(L, sq, chem(L, sq), "J8 · MAD SKY", "Temporada 1");
    const crest = new Image();
    expect(await drawCartel(canvas, c, crest)).toBe(true);
    expect([canvas.width, canvas.height]).toEqual([CARTEL_W, CARTEL_H]);
    expect(texts).toContain("LOS SIETE");
    expect(texts).toContain("J8 · MAD SKY · 2-3-1");
    expect(texts).toContain("2-3-1");
    expect(texts).toContain("QUÍMICA");
    expect(texts).toContain(String(c.qv));
    c.cromos.forEach((x) => expect(texts).toContain(String(x.num)));
    expect(images).toEqual([crest]);
    // no canvas here: nothing to draw, and it says so
    const none = document.createElement("canvas");
    Object.defineProperty(none, "getContext", { value: () => null });
    expect(await drawCartel(none, c, null)).toBe(false);
  });

  it("names the PNG after the board", () => {
    expect(cartelFile("J8 · MAD SKY")).toBe("pizarra-j8-mad-sky.png");
    expect(cartelFile("Córners ¡ya!")).toBe("pizarra-corners-ya.png");
    expect(cartelFile("···")).toBe("pizarra-los-siete.png");
  });
});

describe("ajustes guardados", () => {
  it("reads each choice on its own and falls back to the default for anything broken", () => {
    expect(parsePrefs(null)).toEqual(PREFS0);
    expect(parsePrefs("{nope")).toEqual(PREFS0);
    expect(parsePrefs("42")).toEqual(PREFS0);
    // a board saved before phase 3 (sound and grid only)
    expect(parsePrefs(JSON.stringify({ snd: true, grid: false }))).toEqual({ ...PREFS0, snd: true, grid: false });
    const p = parsePrefs(JSON.stringify({ cam: "top", v3: false, show: { num: false, rt: "no", extra: true } }));
    expect(p).toMatchObject({ cam: "top", v3: false });
    expect(p.show).toEqual({ ...SHOW0, num: false });
    expect(parsePrefs(JSON.stringify({ cam: "drone" })).cam).toBe("tv");
  });

  it("are kept on this device between visits", () => {
    localStorage.clear();
    expect(readPrefs()).toEqual(PREFS0);
    const mine = { ...PREFS0, snd: true, cam: "top" as const, show: { ...SHOW0, name: false } };
    writePrefs(mine);
    expect(readPrefs()).toEqual(mine);
    localStorage.clear();
  });
});
