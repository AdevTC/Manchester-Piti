import { describe, expect, it, vi } from "vitest";
import { makeND, type NMatch, type NSeasonData, type StandRow } from "../numeros/nd";
import { squadOf } from "../numeros/adapt";
import { numerosView, type Act, type Env, type NuState } from "../numeros/view";
import { simulate, temporadaView, ysiView } from "./temporadaView";

const m = (j: number, p: Partial<NMatch>): NMatch => ({
  id: `m${j}`, j, day: `Dom ${j} oct`, long: "", month: 10, time: "19:00", home: j % 2 === 1, rival: `Rival ${j}`, venue: "", st: "por", gf: null, ga: null,
  goals: [], opp: [], cards: [], reds: [], saves: [], wood: [], chances: [], corners: [], fouls: [], frec: [], oppChances: 0, oppCorners: 0, oppCards: 0,
  starters: [], bench: [], notCalled: [], subs: 0, minutes: null, mvp: null, system: null, ...p,
});
const people = [
  { id: "por", name: "Evans", num: "1", first: "", last: "", line: "POR", spots: ["POR"] },
  { id: "a", name: "Alcides", num: "7", first: "", last: "", line: "DEL", spots: [] },
  { id: "b", name: "Adrián T.C.", num: "10", first: "", last: "", line: "MED", spots: [] },
];
const row = (team: string, pts: number, p: Partial<StandRow> = {}): StandRow => ({ team, pj: 3, g: 0, e: 0, p: 0, gf: 4, gc: 4, pts, us: false, ...p });
// J1 home 3–1 (G), J2 away 0–0 (E), J3 home 1–2 (P); J4 away and J5 home still to play
const S: NSeasonData = {
  id: "t1", slug: "temporada-1", name: "Temporada 1", league: "Liga", real: true, mvpDemo: false, porra: null,
  standings: [row("Rival 9", 9), row("Rival 4", 5), row("Manchester Piti", 4, { us: true, g: 1, e: 1, p: 1, gf: 4, gc: 3 }), row("Rival 5", 3), row("Rival 1", 1)],
  matches: [
    m(1, { st: "fin", gf: 3, ga: 1, goals: [["a", "b", 6], ["b", null, 21], ["a", null, 44]], opp: [11], starters: ["por", "a", "b"] }),
    m(2, { st: "fin", gf: 0, ga: 0, starters: ["por", "a", "b"] }),
    m(3, { st: "fin", gf: 1, ga: 2, goals: [["a", null, 30]], opp: [5, 40], starters: ["por", "a", "b"] }),
    m(4, {}),
    m(5, {}),
  ],
};
const BASE: NuState = {
  place: "temporada", upto: Number.POSITIVE_INFINITY, playing: false, raceK: "goles", star: null, temporada: "esta", campo: "todo", jug: [], partidos: [], grow: null, sheet: null, sheetId: null,
  rankK: "goles", pick: null, rival: null, campoView: "pases", puesto: "", team: "us", parte: "all", recView: "rachas", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles",
  q: "", rq: "", catQ: "", catFam: "", catN: 24, catX: false, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "",
  jugView: "ranking", vsOn: false, vsB: null, allRank: false, allTable: false, jkey: null, replay: false, exFmt: "json",
};
const mkAct = (): Act => ({ set: vi.fn(), open: vi.fn(), closeSheet: vi.fn(), go: vi.fn(), grow: vi.fn(), say: vi.fn(), stop: vi.fn(), seek: vi.fn(), play: vi.fn(), narrow: () => false, ask: vi.fn(), csv: vi.fn(), json: vi.fn() });
const env: Env = {
  nd: makeND(squadOf(people, S.matches)), S, moment: { edge: 3, live: false, closed: false }, others: [], catalog: null, demo: false, today: "2026-10-31",
  viewer: { kind: "fan", playerId: null, name: "", porraKey: null },
};
const tem = (p: Partial<NuState> = {}, act = mkAct()) => {
  const st = { ...BASE, ...p };
  return temporadaView(numerosView(st, env, act), st, act);
};

describe("Temporada · la cinta", () => {
  it("today: every played jornada counts, the head is the J3, the points line and the 1,5 pace", () => {
    const t = tem();
    expect(t.cinta.map((c) => c.l)).toEqual(["G", "E", "P", "", ""]);
    expect(t.cinta.filter((c) => c.cls.includes("is-ahead"))).toHaveLength(0);
    expect(t.cinta.find((c) => c.now)?.j).toBe("J3");
    expect(t.cinta.find((c) => c.now)?.nowT).toBe("Ahora");
    expect(t.cintaMeta).toBe("3 de 5 jornadas jugadas · toca una");
    // max(3, 4, 4, 1,5·5·0,75) · 1,12 = 6,3 points at the top of the box
    expect(t.ptsLine).toBe("M0.50 52.38 L1.50 36.51 L2.50 36.51");
    expect(t.ptsArea).toBe("M0.50 52.38 L1.50 36.51 L2.50 36.51 L2.50 100 L0.50 100 Z");
    expect(t.pace).toBe("M0 100 L5.00 0.00");
    expect(t.ptsDots.map((d) => d.cls)).toEqual(["", "", "is-head"]);
    expect(t.ptsLab?.v).toBe("4 puntos");
  });

  it("en casa: the away games dim like the replay's future, and the counts and points follow", () => {
    const t = tem({ campo: "casa" });
    expect(t.cinta.map((c) => c.cls.includes("is-ahead"))).toEqual([false, true, false, true, false]);
    expect(t.cinta[1].aria).toBe("J2, Empatamos 0–0 en casa de Rival 2, no cuenta con este filtro");
    expect(t.cinta[1].l).toBe("");
    expect(t.cintaMeta).toBe("2 de 5 jornadas jugadas en casa · toca una");
    expect(t.ptsLab?.v).toBe("3 puntos");
    expect(t.ptsLine).toBe("M0.50 52.38 L2.50 52.38");
  });

  it("the replay dims what has not come yet, says «Repaso» on its head and pauses on «Seguir el repaso»", () => {
    const t = tem({ upto: 1, replay: true });
    expect(t.cinta.map((c) => c.cls.includes("is-ahead"))).toEqual([false, true, true, true, true]);
    expect(t.cinta[2].aria).toBe("J3, aún por llegar en el repaso");
    expect(t.cinta[0].now && t.cinta[0].nowT).toBe("Repaso");
    expect(t.playT).toBe("Seguir el repaso");
    expect(t.repJ).toBe("J1 / 3");
    expect(t.cintaMeta).toBe("1 de 5 jornadas hasta la J1 · toca una");
    // replay + casa/fuera combine
    const both = tem({ upto: 2, replay: true, campo: "fuera" });
    expect(both.cinta.map((c) => c.cls.includes("is-ahead"))).toEqual([true, false, true, true, true]);
    expect(both.ptsLab?.v).toBe("1 punto");
  });

  it("prev, next and «Volver a hoy» move the replay; next past the edge is today", () => {
    const act = mkAct();
    tem({}, act).prev();
    expect(act.set).toHaveBeenLastCalledWith({ upto: 2, replay: true, playing: false, jkey: null });
    const at2 = tem({ upto: 2, replay: true }, act);
    at2.next();
    expect(act.set).toHaveBeenLastCalledWith({ upto: Number.POSITIVE_INFINITY, replay: false, playing: false, jkey: null });
    const at1 = tem({ upto: 1, replay: true }, act);
    at1.next();
    expect(act.set).toHaveBeenLastCalledWith({ upto: 2, replay: true, playing: false, jkey: null });
    expect(tem().noNext).toBe(true);
    expect(tem().hasBack).toBe(false);
  });
});

describe("Temporada · the jornada card", () => {
  it("a past jornada offers «Ver la temporada hasta aquí» and says who scored", () => {
    const act = mkAct();
    const t = tem({ jkey: "m1" }, act);
    expect(t.jd?.big).toBe("3–1");
    expect(t.jd?.line).toBe("Ganamos 3–1 · En casa · 3 pts");
    expect(t.jd?.who).toBe("Alcides 6′, Adrián T.C. 21′, Alcides 44′");
    expect(t.jd?.href).toBe("/partidos/m1");
    expect(t.jd?.canUpto).toBe(true);
    t.jd?.upto();
    expect(act.set).toHaveBeenLastCalledWith({ upto: 1, replay: false, playing: false });
  });
  it("not for today's jornada, a game to play, or the jornada the season is already cut at", () => {
    expect(tem().jd?.canUpto).toBe(false);
    const future = tem({ jkey: "m4" }).jd;
    expect(future?.canUpto).toBe(false);
    expect(future?.go).toBe("Ver la previa");
    expect(future?.line).toBe("Fuera · Dom 4 oct, 19:00");
    expect(tem({ upto: 1, jkey: "m1" }).jd?.canUpto).toBe(false);
    const ahead = tem({ upto: 1, replay: true, jkey: "m3" }).jd;
    expect(ahead?.line).toBe("Aún no ha llegado en el repaso");
    expect(ahead?.hasWho).toBe(false);
  });
});

describe("Temporada · ¿Y si…?", () => {
  it("our made-up win moves us and the rival of the game, and the whole league re-sorts", () => {
    const t = tem({ ysi: { m4: "g" }, allTable: true });
    expect(t.tableT).toBe("La clasificación, con tus resultados");
    expect(t.tableSub).toBe("Acabaríamos 2º con 7 puntos · de mentira");
    const us = t.rows.find((r) => r.us);
    const r4 = t.rows.find((r) => r.team === "Rival 4");
    expect(us?.mv).toBe("▲ sube al 2º");
    expect(r4?.mv).toBe("▼ baja al 3º");
    expect(r4?.pj).toBe(4);
    expect(r4?.p).toBe(1);
    expect(t.ysiT).toBe("¿Y si…? · 1 resultado de mentira");
  });
  it("a made-up defeat hands the rival three points", () => {
    const v = numerosView(BASE, env, mkAct());
    const sim = simulate(v.tem.all, { m5: "p" }, v.ysi.rows);
    const r5 = sim?.find((r) => r.team === "Rival 5");
    expect(r5?.pts).toBe(6);
    expect(r5?.pos).toBe(2);
    expect(r5?.mv).toBe("▲ sube al 2º");
    expect(sim?.find((r) => r.us)?.pos).toBe(4);
    expect(simulate(v.tem.all, {}, v.ysi.rows)).toBeNull();
  });
  it("the sheet counts the points and says where we would finish", () => {
    const st = { ...BASE, ysi: { m4: "g" as const, m5: "e" as const } };
    const act = mkAct();
    const ys = ysiView(numerosView(st, env, act), st, act);
    expect(ys.proj).toBe(8);
    expect(ys.projT).toBe("puntos con tus resultados de mentira");
    expect(ys.pos).toBe("Acabaríamos 2º");
    const none = ysiView(numerosView(BASE, env, act), BASE, act);
    expect(none.proj).toBe(4);
    expect(none.projT).toBe("puntos ahora mismo · quedan 2");
    expect(none.hasPos).toBe(false);
  });
  it("during the replay the table waits: the league only keeps today's", () => {
    const t = tem({ upto: 2, replay: true, ysi: { m4: "g" } });
    expect(t.showTable).toBe(false);
    expect(t.tableSub).toBe("Sin tabla de la liga tras la J2");
    expect(t.calSub).toBe("La liga solo guarda su tabla al día: tras la J2 llevábamos 4 puntos. Sigue el repaso o vuelve a hoy.");
  });
});
