// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { planArrows, planNote, setTactic, tacRows } from "./plan";
import { planLayer } from "./view";
import { changes, cmpMarks, galonesOn, meanForm, naturalCount, PLAYED_ID, playedOption, playedSeven, tape } from "./compare";
import { boardLink, charlaMatch, convCounts, convocatoriaOf, copyName, matchBand, matchLabel, nameError, officialFor, seasonPending, uniqueName, withConvocatoria, type CalMatch } from "./boards";
import { CARTEL_H, CARTEL_W, cartelConsignas, cartelFile, cartelHead, cartelLayout, drawCartel, preparedFor, shareCartel } from "./cartel";
import { parsePrefs, PREFS0, readPrefs, SHOW0, writePrefs } from "./prefs";
import { chem } from "./quimica";
import { slotPos } from "./geometry";
import { boardDoc, cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import { lineOf, type PosCode } from "../../../lib/positions";

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
  });

  it("free mode: the salida and the foco are painted from where the cromos stand; the Plan tab says the scales move nobody", () => {
    const sys = withTac({ buildup: "Corta", attackFocus: "Centro" });
    // the cromos where the system had them, then the right central pushed up into the middle
    const free = { ...sys, freeMode: true, slots: sys.slots.map((s, i) => ({ ...s, x: slotPos(sys, i).u, y: i === 2 ? 50 : slotPos(sys, i).v })) };
    const arr = planArrows(free, "tv");
    // one central left in the line: one short pass from the keeper, and the centre lane
    expect(arr.map((a) => a.key)).toEqual(["s0", "f0"]);
    expect(arr[0].d).toBe(planArrows(sys, "tv")[0].d);
    expect(planNote(free)).toBe("En modo libre el plan no mueve a nadie: colócalos tú. La salida y el foco sí se pintan, desde donde los has puesto.");
    expect(planNote(sys)).toBeNull();
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

  it("the tale of the tape: química, system, media, the seven's minutes, natural positions and galones, the better side marked", () => {
    const rows = tape(A, B, sq);
    expect(rows.map((r) => r.k)).toEqual(["Química", "Sistema", "Media", "Minutos del siete", "En su sitio", "Galones en el campo"]);
    expect(rows[1]).toMatchObject({ a: "2-3-1", b: "3-2-1", ca: "", cb: "" });
    const form = rows[2];
    expect(form.a).toBe(meanForm(A, sq));
    expect(form.b).toBe(meanForm(B, sq));
    if (form.a !== form.b) expect(form.a > form.b ? form.ca : form.cb).toBe("w");
    expect(meanForm(lineupOf([]), sq)).toBe(0);
  });

  it("the rows that matter for a lineup come from real data", () => {
    const sq2 = { ...sq, byId: new Map(sq.byId) };
    sq2.byId.set("evans", { ...sq.byId.get("evans")!, stats: { played: 6, goals: 0, assists: 0, minutes: 300, starts: 6, mvps: 0 } });
    sq2.byId.set("kevin", { ...sq.byId.get("kevin")!, stats: { played: 9, goals: 3, assists: 1, minutes: 1250, starts: 8, mvps: 1 } });
    // 2-3-1 with everyone in his line; B (3-2-1) has huberoski (MED) in the third defender's slot and kevin
    // (DEL) in an MC slot: 5 in their line
    const Ag = { ...A, roles: { captainId: "illescas", penaltiesId: "adrian", cornersId: "kevin" } };
    const Bg = { ...B, roles: Ag.roles };
    const rows = tape(Ag, Bg, sq2);
    expect(rows[3]).toEqual({ k: "Minutos del siete", a: "300′", b: "1550′", ca: "", cb: "w" });
    expect(rows[4]).toEqual({ k: "En su sitio", a: "7/7", b: "5/7", ca: "w", cb: "" });
    expect(rows[5]).toEqual({ k: "Galones en el campo", a: "2/4", b: "2/4", ca: "", cb: "" });
    expect(naturalCount(lineupOf([]), sq)).toBe(0);
    expect(galonesOn(lineupOf([]))).toBe(0);
  });

  it("«En su sitio» with exact positions: in place = preferida or también (an adaptado is not)", () => {
    // 2-3-1: POR · DFC DFC · MI MC MD · DC
    const x = (id: string, num: number, main: PosCode, also: PosCode[] = []) => cromo(id, num, lineOf(main), { ps: { main, also, line: lineOf(main) } });
    const xs = squadOf([x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "DFC"), x("piv", 4, "MCD", ["MI"]), x("mc", 5, "MCO"), x("md", 6, "MD"), x("dc", 9, "DC")]);
    // piv at MI (también), mc (a mediapunta) at MC: adaptado — 6 in place, not the 7 his line would say
    const X = lineupOf(["gk", "d1", "d2", "piv", "mc", "md", "dc"], "2-3-1", xs);
    expect(naturalCount(X, xs)).toBe(6);
    // a «Jugar de» at that very position counts as in place
    expect(naturalCount({ ...X, playerPositions: { mc: "MC" } }, xs)).toBe(7);
    // «El siete que jugó» places the starters by encaje too, so its count is not low for the listed order
    // (by line, md listed first would take MI and piv MD: 4 in place)
    const P = playedSeven(X, ["dc", "md", "mc", "piv", "d2", "gk", "d1"], xs);
    expect(P.slots.map((s) => s.playerId).slice(3, 6)).toEqual(["piv", "mc", "md"]);
    expect(naturalCount(P, xs)).toBe(6);
  });

  it("«El siete que jugó»: the match's starters as a seven on this system (keeper in goal, each in his line)", () => {
    const m: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: 0, played: true, gf: 3, ga: 1, home: true, venue: "", conv: { starters: ["kevin", "tello", "evans", "huberoski", "illescas", "eguzquiza", "erik"], bench: ["fer"] } };
    expect(playedOption(m)).toEqual({ id: PLAYED_ID, name: "El siete que jugó · J8 · MAD SKY" });
    expect(playedOption({ ...m, played: false })?.name).toBe("El siete convocado · J8 · MAD SKY");
    expect(playedOption({ ...m, conv: { starters: [], bench: [] } })).toBeNull();
    expect(playedOption(null)).toBeNull();
    const P = playedSeven(A, m.conv!.starters, sq);
    // 2-3-1: POR · DFC DFC · MI MC MD · DC
    expect(P.slots.map((s) => s.playerId)).toEqual(["evans", "tello", "illescas", "huberoski", "eguzquiza", "erik", "kevin"]);
    expect(P.formation).toBe("2-3-1");
    expect(changes(A, P)).toEqual({ ins: ["erik", "kevin"], outs: ["almachi", "adrian"] });
    // no keeper among them: the last one left goes in goal; never more than seven
    const nk = playedSeven(A, ["tello", "illescas", "huberoski", "eguzquiza", "almachi", "adrian", "erik", "kevin"], sq);
    expect(nk.slots.filter((s) => s.playerId)).toHaveLength(7);
    expect(nk.slots[0].playerId).toBe("erik");
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
    expect(matchBand(m({ played: true, gf: 3, ga: 1 }))).toMatchObject({ r: "g", letter: "G", title: "Victoria · 3–1 · MAD SKY" });
    expect(matchBand(m({ played: true, gf: 2, ga: 2 }))).toMatchObject({ r: "e", letter: "E" });
    expect(matchBand(m({ played: true, gf: 0, ga: 1 }))).toMatchObject({ r: "p", letter: "P", title: "Derrota · 0–1 · MAD SKY" });
    const next = matchBand(m({}));
    expect(next).toMatchObject({ r: "f", letter: "·", title: "Por jugar · MAD SKY" });
    expect(next.sub).toMatch(/^J8 · dom 8 nov · 11:00 · En casa · Campo 3$/);
    expect(matchBand(null).title).toBe("Sin partido vinculado");
    expect(matchLabel(m({ played: true, gf: 3, ga: 1 }))).toBe("J8 · MAD SKY · 3–1");
    expect(matchLabel(m({}))).toBe("J8 · MAD SKY");
  });

  it("the match as the charla reads it: day, time, campo and who the convocatoria calls", () => {
    expect(charlaMatch(m({ conv: { starters: ["evans", "tello"], bench: ["kevin"] } }))).toEqual({ short: "J8 · MAD SKY", date: "dom 8 nov", time: "11:00", j: "J8", place: "En casa · Campo 3", called: ["evans", "tello", "kevin"] });
    // no convocatoria yet: nobody called (the charla falls back to the available)
    expect(charlaMatch(m({ home: false, venue: "", conv: { starters: [], bench: [] } }))).toEqual({ short: "J8 · MAD SKY", date: "dom 8 nov", time: "11:00", j: "J8", place: "Fuera" });
    expect(charlaMatch(m({ home: null, venue: "Polideportivo", dateMs: 0 }))).toMatchObject({ date: "", time: "", place: "Polideportivo" });
  });

  it("the link to a board, and the one straight to its charla", () => {
    expect(boardLink("https://piti.club", "a b")).toBe("https://piti.club/pizarra?tablero=a%20b");
    expect(boardLink("https://piti.club", "x", true)).toBe("https://piti.club/pizarra?tablero=x#charla");
  });

  it("the link carries the board's season, so the receiver opens it in that season", () => {
    expect(boardLink("https://piti.club", "x", false, "t 2")).toBe("https://piti.club/pizarra?tablero=x&season=t%202");
    expect(boardLink("https://piti.club", "x", true, "all")).toBe("https://piti.club/pizarra?tablero=x&season=all#charla");
    // the board waits until the season context has adopted the link's season
    expect(seasonPending("t2", "t1")).toBe(true);
    expect(seasonPending("t2", "t2")).toBe(false);
    expect(seasonPending(undefined, "t1")).toBe(false);
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

  it("with the board's match: day and time, the convocatoria's banquillo and up to three consignas (the captain's first)", () => {
    const L = { ...lineupOf(SEVEN, "2-3-1", sq), tactics: { ...lineupOf(SEVEN).tactics, buildup: "En largo" } };
    const sq2 = { ...sq, byId: new Map(sq.byId) };
    sq2.byId.set("erik", { ...sq.byId.get("erik")!, cv: "duda" });
    const c = cartelLayout(L, sq2, chem(L, sq2), { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", j: "J8", called: [...SEVEN, "kevin", "erik"] }, "Temporada 1");
    expect(c.kick).toBe("J8 · MAD SKY · 2-3-1");
    expect(c.when).toBe("DOM 8 NOV · 12:00");
    expect(cartelHead(c)).toBe("J8 · MAD SKY · 2-3-1 · DOM 8 NOV · 12:00");
    expect(c.bench).toEqual(["KEVIN", "ERIK (duda)"]);
    expect(c.cons).toEqual(["En largo", "Presión media", "Línea media"]);
    expect(cartelConsignas(lineupOf(SEVEN))).toEqual(["Presión media", "Línea media", "Salida mixta"]);
    expect(c.aria).toMatch(/^Cartel: los siete de J8 · MAD SKY \(dom 8 nov · 12:00\), 2-3-1, química \d+: .*\. Banquillo: KEVIN, ERIK \(duda\)\. Consignas: En largo, Presión media, Línea media$/);
    // no convocatoria, no banquillo (the cartel never guesses it); just a name, no date
    const plain = cartelLayout(L, sq, chem(L, sq), { short: "J8 · MAD SKY", date: "" }, "Temporada 1");
    expect([plain.bench, plain.when]).toEqual([[], ""]);
  });

  it("draws the date, the consignas and the banquillo under the pitch", async () => {
    const texts: string[] = [];
    const grad = { addColorStop: () => {} };
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === "fillText" || k === "strokeText") return (s: string) => texts.push(s);
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
    const c = cartelLayout(L, sq, chem(L, sq), { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", called: [...SEVEN, "kevin"] }, "Temporada 1");
    expect(await drawCartel(canvas, c, null)).toBe(true);
    expect(texts).toContain("J8 · MAD SKY · 2-3-1 · DOM 8 NOV · 12:00");
    expect(texts).toContain("CONSIGNAS");
    expect(texts).toContain("PRESIÓN MEDIA · LÍNEA MEDIA · SALIDA MIXTA");
    expect(texts).toContain("BANQUILLO");
    expect(texts).toContain("KEVIN");
  });

  it("Safari keeps the tap: the share sheet opens synchronously with the PNG prepared for this very cartel", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    expect(preparedFor({ key: "a", blob }, "a")).toBe(blob);
    expect(preparedFor({ key: "a", blob }, "b")).toBeNull();
    expect(preparedFor(null, "a")).toBeNull();
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    const p = shareCartel(blob, "pizarra.png", "Los siete", "J8");
    // called in the same task as the tap, before anything is awaited
    expect(share).toHaveBeenCalledTimes(1);
    await expect(p).resolves.toBe("shared");
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
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
