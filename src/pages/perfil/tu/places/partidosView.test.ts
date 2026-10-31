import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../../../../lib/clubData";
import type { PlayerDoc } from "../../../../lib/schemas";
import { MODEL_VERSION } from "../../../../lib/rating/constants";
import { buildMe, type Answer, type MeInput } from "../me";
import { chartOf, defaultIndex, figsOf, filterOpts, focusLedger, focusOf, headOf, nowIndex, phoneRiver, riverCol, riverMeta, seasonChoices, slugOf, tableRows } from "./partidosView";

// Production-shaped (2026-10-31): Temporada 1 with the J1 played (40′ at right back in two stints, a frozen 4,7,
// lost 1–8 at home), the J2 seen from outside (in the acta, no minutes) and twenty jornadas to play.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 18, 10); // Sunday 18 October 2026, 12:00 in Madrid
const NOW = T0 + 13 * DAY;
const player = (id: string, number: number, shirtName: string): PlayerDoc => ({ id, number, shirtName, firstName: shirtName, lastName: "", seasons: ["t1"], active: true }) as unknown as PlayerDoc;
const PLAYERS = [player("jordi", 28, "JORDI"), player("alcides", 7, "ALCIDES"), player("kevin", 10, "KEVIN")];
const row = (o: Partial<Participation>): Participation =>
  ({ minutes: 0, started: false, benched: false, notCalled: false, played: false, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...o }) as Participation;
const notas = (players: Record<string, number>) => ({ model: MODEL_VERSION, rival: 1, players: Object.fromEntries(Object.entries(players).map(([id, nota]) => [id, { nota, minutes: 40, weight: 0.8, narrated: false }])) });
const finished = (id: string, day: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>, home: boolean | null = true): ClubMatch =>
  ({ id, seasonId: "t1", rival: `Rival ${id}`, home, status: "finished", date: T0 + day * DAY, duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ledger, notas: notas(nts) }) as unknown as ClubMatch;
const upcoming = (n: number, from = 3): ClubMatch[] => Array.from({ length: n }, (_, i) => ({ id: `u${i + from}`, seasonId: "t1", rival: `Rival ${i + from}`, home: i % 2 === 0, status: "scheduled", date: T0 + (21 + i * 7) * DAY, events: [] }) as unknown as ClubMatch);

const J1 = finished(
  "j1",
  0,
  1,
  8,
  {
    jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 25 }, { from: 35, to: 50 }], positionsPlayed: { LD: 40 }, passesCompleted: 11, passes: 15, recoveries: 3 } as Partial<Participation>),
    alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }], goals: 1 }),
    kevin: row({ played: true, minutes: 10, stints: [{ from: 25, to: 35 }] }),
  },
  { jordi: 4.7, alcides: 6.2, kevin: 5.1 },
);
const J2 = finished("j2", 7, 3, 8, { jordi: row({ benched: true }), alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }] }) }, { alcides: 7.1 }, false);
const REAL = [J1, J2, ...upcoming(20)];
const input = (over: Partial<MeInput> = {}): MeInput => ({ playerId: "jordi", seasonId: "t1", matches: REAL, players: PLAYERS, seasons: [{ id: "t1", name: "Temporada 1" }], mvpResults: new Map(), standings: [], now: NOW, answers: new Map<string, Answer>(), card: null, ...over });

describe("Tus partidos with production's season (1 played, 1 from outside, 20 to come)", () => {
  const me = buildMe(input());
  const rows = me.rows;
  it("has the rows the place draws", () => {
    expect(rows).toHaveLength(22);
    expect(rows.slice(0, 3).map((r) => r.kind)).toEqual(["played", "didnt", "next"]);
  });
  it("says it in the head: «Uno jugado, con un 4,7» and what's behind it", () => {
    const h = headOf(rows, me.figures, "Temporada 1");
    expect(h.title).toBe("Uno jugado, con un 4,7");
    expect(h.sub).toMatch(/^Tras la J2: jugaste la J1 \(40′ de lateral derecho\) y la J2 la viste desde fuera\. La J3 es el (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d+\.$/);
  });
  it("the river: the played bar is the nota with its word, the J2 «No jugaste», the rest outlines; «1 jugado» (singular)", () => {
    const [c1, c2, c3, c4] = rows.map(riverCol);
    expect(c1).toMatchObject({ isPlayed: true, notaT: "4,7", band: "s5", word: "Baja", h: "56px", res: "P", mvp: false, gT: "", aT: "" });
    expect(c1.aria).toBe("J1, Rival j1, tu nota 4,7, Baja, 40 minutos, perdimos 1–8");
    expect(c2).toMatchObject({ isPlayed: false, ghostCls: "is-out", ghostT: "No jugaste", res: "P" });
    expect(c3.kind).toBe("next");
    expect(c3.aria).toContain("(la siguiente)");
    expect(c4).toMatchObject({ ghostCls: "is-up", res: null });
    expect(riverMeta(rows, me.figures)).toBe("1 jugado · 20 por jugar · tu media 4,7 (baja)");
  });
  it("our score always first, even when we lose by a lot («3–8», never «8–3»)", () => {
    expect(riverCol(rows[1]).pline).toContain("Perdimos 3–8");
    expect(focusOf(rows, 1, me.figures)?.title).toBe("Perdimos 3–8 contra Rival j2");
    expect(tableRows(rows, "todos", null)[1].resT).toBe("P · 3–8");
  });
  it("«Hoy» is the next jornada; with nothing asked the panel shows his last played", () => {
    expect(nowIndex(rows)).toBe(2);
    expect(defaultIndex(rows)).toBe(0);
  });
  it("the phone river: the next on top, then the past from the newest, the future folded", () => {
    const pr = phoneRiver(rows, false);
    expect(pr.list.map((x) => x.r.jLabel)).toEqual(["J3", "J2", "J1"]);
    expect(pr.futureT).toBe("Más adelante: 19 jornadas, de la J4 a la J22");
    expect(phoneRiver(rows, true).list[0].r.jLabel).toBe("J22");
  });
  it("the match sheet of the J1: the nota against nothing yet, the result, the two stints on 50′, the acta's figures", () => {
    const fo = focusOf(rows, 0, me.figures);
    expect(fo).toMatchObject({ mode: "played", title: "Tu partido contra Rival j1", notaT: "4,7", word: "Baja", score: "1–8", resLine: "Perdimos en casa contra Rival j1", durT: "50′", half: "25′" });
    expect(fo?.kick).toMatch(/^Tu J1 · domingo 18 de octubre · en casa$/);
    expect(fo?.notaLine).toBe("Tu nota del partido, congelada en el acta. Es tu primera nota de la temporada.");
    expect(fo?.stints).toEqual([
      { left: "0.0%", width: "50.0%" },
      { left: "70.0%", width: "30.0%" },
    ]);
    expect(fo?.stintT).toBe("40′ de 50 · titular, en 2 tramos: del 0′ al 25′ y del 35′ al 50′ · lateral derecho");
    expect(fo?.ledger).toEqual([
      { k: "Pases", v: "11 de 15", s: "73 % buenos" },
      { k: "Recuperaciones", v: "3", s: "" },
    ]);
    expect(fo?.prev).toBeNull();
    expect(fo?.next).toMatchObject({ i: 1, t: "J2" });
  });
  it("the J2 from outside and the next one", () => {
    expect(focusOf(rows, 1, me.figures)).toMatchObject({ mode: "out", outT: "No jugaste", outLine: "La viste desde fuera. Perdimos 3–8." });
    const n = focusOf(rows, 2, me.figures);
    expect(n?.mode).toBe("next");
    expect(n?.lead).toMatch(/^La siguiente: .+, 1[0-9]:00 · en casa\.$/);
  });
  it("one nota is a point, with «con la segunda sale tu línea»", () => {
    const ch = chartOf(rows, me.figures);
    expect(ch.n).toBe(1);
    expect(ch.line).toBe("");
    expect(ch.avg).toBe("");
    expect(ch.labs).toHaveLength(1);
    expect(ch.js.map((j) => j.t)).toEqual(["J1", "J2 ·"]);
    expect(ch.note).toContain("con la segunda sale tu línea");
    expect(ch.note).toContain("La J2 no cuenta: no jugaste.");
  });
  it("the figures and the filters", () => {
    expect(figsOf(rows, me.figures).map((f) => f.v)).toEqual(["1 de 2", "40′", "4,7", "J1", "0 · 0", "0"]);
    expect(filterOpts(rows).map((o) => [o.k, o.n])).toEqual([
      ["jugados", 1],
      ["todos", 22],
      ["porjugar", 20],
    ]);
    expect(tableRows(rows, "jugados", null).map((x) => x.r.jLabel)).toEqual(["J1"]);
    const up = tableRows(rows, "porjugar", "yes");
    expect(up).toHaveLength(20);
    expect(up[0]).toMatchObject({ kindT: "Has dicho que vas", trCls: "is-next" });
    expect(tableRows(rows, "todos", null)[0]).toMatchObject({ minT: "40′", posT: "Lateral derecho", gaT: "—", isPlayed: true });
  });
});

describe("Tus partidos with many jornadas played (a long season fits)", () => {
  const many: ClubMatch[] = Array.from({ length: 21 }, (_, k) =>
    finished(`m${k + 1}`, k * 7, k % 3, 1, { jordi: row({ played: true, started: k % 2 === 0, minutes: 30 + (k % 3) * 10, stints: [{ from: 0, to: 30 + (k % 3) * 10 }], goals: k === 4 ? 2 : 0, assists: k === 6 ? 1 : 0 }) }, { jordi: 5 + (k % 5) }),
  );
  const me = buildMe(input({ matches: [...many, ...upcoming(1, 22).map((m) => ({ ...m, date: T0 + 160 * DAY }) as ClubMatch)], now: T0 + 150 * DAY }));
  it("draws every jornada, the line through the notas and the average dashed", () => {
    expect(me.rows).toHaveLength(22);
    const h = headOf(me.rows, me.figures, "Temporada 1");
    expect(h.title).toMatch(/^21 partidos, \d,\d de media$/);
    expect(h.sub).toMatch(/^Tras la J21: jugaste 21 de 21\. Tu mejor noche, la J\d+ contra Rival m\d+ \(9,0\)\./);
    const ch = chartOf(me.rows, me.figures);
    expect(ch.n).toBe(21);
    expect(ch.line.startsWith("M")).toBe(true);
    expect(ch.avg).not.toBe("");
    expect(riverCol(me.rows[4])).toMatchObject({ gT: "2G" });
    expect(riverCol(me.rows[6])).toMatchObject({ aT: "A" });
  });
});

describe("the season switcher", () => {
  const seasons = [
    { id: "old", name: "Temporada 2025/26", archived: true },
    { id: "t1", name: "Temporada 1" },
  ];
  it("puts the current first, names the archived «Archivo …», and honours ?temporada= (id or slug)", () => {
    const s = seasonChoices(seasons, "t1", undefined);
    expect(s.selected).toBe("t1");
    expect(s.opts.map((o) => o.t)).toEqual(["Temporada 1", "Archivo 2025/26"]);
    expect(seasonChoices(seasons, "t1", "old").selected).toBe("old");
    expect(seasonChoices(seasons, "t1", slugOf("Temporada 2025/26")).selected).toBe("old");
    expect(seasonChoices(seasons, "t1", "nope").selected).toBe("t1");
  });
});

describe("the acta's figures as the sheet lists them", () => {
  it("goals and assists first, passes «de» the total, shots with those on target, only what exists", () => {
    const r = buildMe(input()).rows[0];
    expect(focusLedger({ ...r, g: 2, a: 1, ledger: [{ k: "shots", label: "Remates", v: 4 }, { k: "shotsOnTarget", label: "Remates a puerta", v: 2 }, { k: "saves", label: "Paradas", v: 1 }] })).toEqual([
      { k: "Goles", v: "2", s: "" },
      { k: "Asistencia", v: "1", s: "" },
      { k: "Remates", v: "4", s: "2 a puerta" },
      { k: "Paradas", v: "1", s: "" },
    ]);
  });
});
