import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import type { MvpResult } from "../../../lib/vestuario";
import { MODEL_VERSION } from "../../../lib/rating/constants";
import { buildMe, ledgerFigures, matchLabel, tierInfo, type Answer, type MeInput } from "./me";

// Production-shaped (2026-10-31): Temporada 1 with the J1 played (Jordi 40′ at right back in two stints, a frozen
// nota of 4,7, lost 1–8), the J2 seen from outside (not called up) and twenty jornadas still to play.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 12); // the J1, Sunday 11 October 2026
const NOW = T0 + 14 * DAY;
const player = (id: string, number: number, shirtName: string, firstName: string): PlayerDoc => ({ id, number, shirtName, firstName, lastName: "", seasons: ["t1"], active: true }) as unknown as PlayerDoc;
const PLAYERS = [player("jordi", 28, "JORDI", "Jordi"), player("alcides", 7, "ALCIDES", "Alcides"), player("kevin", 10, "KEVIN", "Kevin"), player("erik", 9, "ERIK", "Erik")];

const row = (o: Partial<Participation>): Participation =>
  ({ minutes: 0, started: false, benched: false, notCalled: false, played: false, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...o }) as Participation;
const notas = (players: Record<string, number>) => ({ model: MODEL_VERSION, rival: 1, players: Object.fromEntries(Object.entries(players).map(([id, nota]) => [id, { nota, minutes: 40, weight: 0.8, narrated: false }])) });
const played = (id: string, min: number, extra: Partial<Participation> = {}) => [id, row({ played: true, started: true, minutes: min, stints: [{ from: 0, to: min }], ...extra })] as const;

function finished(id: string, day: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>, extra: Partial<ClubMatch> = {}): ClubMatch {
  return { id, seasonId: "t1", rival: `Rival ${id}`, home: true, status: "finished", date: T0 + day * DAY, duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ledger, notas: notas(nts), ...extra } as ClubMatch;
}
const upcoming = (n: number): ClubMatch[] => Array.from({ length: n }, (_, i) => ({ id: `u${i + 3}`, seasonId: "t1", rival: `Rival ${i + 3}`, home: i % 2 === 0 ? true : i % 3 === 0 ? null : false, status: "scheduled", date: T0 + (21 + i * 7) * DAY, events: [] }) as unknown as ClubMatch);

const J1 = finished(
  "j1",
  0,
  1,
  8,
  {
    jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 25 }, { from: 35, to: 50 }], positionsPlayed: { LD: 40 }, passesCompleted: 11, recoveries: 3, shots: 0 }),
    alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }], goals: 1 }),
    kevin: row({ played: true, started: false, minutes: 10, stints: [{ from: 25, to: 35 }] }),
    erik: row({ notCalled: true }),
  },
  { jordi: 4.7, alcides: 6.2, kevin: 5.1 },
);
const J2 = finished("j2", 7, 3, 1, { jordi: row({ notCalled: true }), ...Object.fromEntries([played("alcides", 50), played("kevin", 50), played("erik", 50)]) }, { alcides: 7.1, kevin: 6.4, erik: 6.8 });
const REAL = [J1, J2, ...upcoming(20)];

const base = (over: Partial<MeInput> = {}): MeInput => ({ playerId: "jordi", seasonId: "t1", matches: REAL, players: PLAYERS, seasons: [{ id: "t1", name: "Temporada 1" }], mvpResults: new Map(), standings: [], now: NOW, answers: new Map<string, Answer>(), card: null, ...over });

describe("me: production's season (one played, one from outside, twenty to come)", () => {
  const me = buildMe(base());
  it("gives one row per jornada: played, absent with why, the next one and the ones to come", () => {
    expect(me.rows).toHaveLength(22);
    expect(me.rows.map((r) => r.kind).slice(0, 4)).toEqual(["played", "absent", "next", "up"]);
    expect(me.rows.filter((r) => r.kind === "up")).toHaveLength(19);
    expect(me.next?.matchId).toBe("u3");
    expect(me.rows[1]).toMatchObject({ jLabel: "J2", reason: "No convocado", nota: null, notaText: "—", bandWord: "Sin nota", min: null });
  });
  it("the J1 as the acta says it: our score first, 40′ in two stints at right back, the frozen nota and its word", () => {
    expect(me.rows[0]).toMatchObject({ j: 1, jLabel: "J1", rival: "Rival j1", home: true, gf: 1, ga: 8, result: "P", dur: 50, min: 40, start: true, pos: "LD", posLong: "Lateral derecho", g: 0, a: 0, nota: 4.7, notaText: "4,7", band: "s5", bandWord: "Baja", mvp: false });
    expect(me.rows[0].stints).toEqual([
      { from: 0, to: 25 },
      { from: 35, to: 50 },
    ]);
    // (only the figures the acta recorded, above zero)
    expect(me.rows[0].ledger).toEqual([
      { k: "passesCompleted", label: "Pases completados", v: 11 },
      { k: "recoveries", label: "Recuperaciones", v: 3 },
    ]);
  });
  it("an unknown home is never «en casa» (bug 14)", () => {
    expect(me.rows.some((r) => r.kind === "up" && r.home === null)).toBe(true);
  });
  it("the season's figures and the form (the J2 counts as «no jugaste»)", () => {
    expect(me.figures).toMatchObject({ jornadas: 2, played: 1, minutes: 40, goals: 0, assists: 0, ga: 0, mvps: 0 });
    expect(me.figures.average).toBeCloseTo(4.7);
    expect(me.figures.best?.matchId).toBe("j1");
    expect(me.form.map((r) => [r.jLabel, r.kind])).toEqual([
      ["J1", "played"],
      ["J2", "absent"],
    ]);
  });
  it("ranks him honestly: a place where he has a value, «a cero» with how many more otherwise", () => {
    const by = Object.fromEntries(me.ranks.map((r) => [r.key, r]));
    expect(by.minutos).toMatchObject({ value: 40, text: "40′", rank: 4, of: 4 });
    expect(by.minutos.leader).toMatchObject({ playerId: "alcides", value: 100 });
    // (Alcides and Kevin 2; Erik 1 like him: a shared 3.º)
    expect(by.partidos).toMatchObject({ value: 1, rank: 3, tied: 1 });
    expect(by.goles).toMatchObject({ value: 0, rank: null, zeroWith: 2, leader: { playerId: "alcides", value: 1 } });
    expect(by.asistencias).toMatchObject({ value: 0, rank: null, zeroWith: 3, leader: null });
    expect(by.nota).toMatchObject({ value: 4.7, text: "4,7", rank: 4, of: 4 });
  });
  it("his partner is who shared most minutes with him", () => {
    expect(me.partner).toEqual({ playerId: "alcides", name: "ALCIDES", num: "7", minutes: 40, matches: 1 });
  });
  it("one reward list: the debut earned in the J1, no records before 3 played, the next ones with progress", () => {
    const debut = me.rewards.earned.find((r) => r.id === "evo-debut");
    expect(debut?.match?.matchId).toBe("j1");
    expect(debut?.match?.label).toBe(matchLabel({ j: 1, rival: "Rival j1", dateMs: T0 }));
    expect(me.rewards.earned.some((r) => r.kind === "record")).toBe(false);
    // (the medal «Debut» is the same thing as the evolución: it shows once)
    expect(me.rewards.earned.some((r) => r.id === "logro-debut")).toBe(false);
    const goal = me.rewards.next.find((r) => r.id === "evo-goal");
    expect(goal).toMatchObject({ earned: false, gold: true, progress: { cur: 0, goal: 1, pct: 0 }, need: "Te falta 1 gol" });
    expect(me.rewards.next[0].progress?.pct).toBeGreaterThanOrEqual(me.rewards.next[me.rewards.next.length - 1].progress?.pct ?? 0);
  });
  it("without a ficha every list is empty", () => {
    const socio = buildMe(base({ playerId: null }));
    expect(socio.rows).toEqual([]);
    expect(socio.ranks).toEqual([]);
    expect(socio.partner).toBeNull();
    expect(socio.rewards).toEqual({ earned: [], next: [] });
  });
});

describe("me: a richer season", () => {
  // J1–J4 played (goals in J1, J3 and J4; MVP of the J3), the J5 on the bench without minutes, the J6 said «no»
  const J = (n: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>, extra: Partial<ClubMatch> = {}) => finished(`r${n}`, (n - 1) * 7, gf, ga, ledger, nts, extra);
  const rich: ClubMatch[] = [
    J(1, 3, 1, Object.fromEntries([played("jordi", 50, { goals: 1, positionsPlayed: { DC: 50 } }), played("alcides", 50, { goals: 1 }), played("kevin", 30)]), { jordi: 7.4, alcides: 7.0, kevin: 6.0 }),
    J(2, 0, 2, Object.fromEntries([played("jordi", 35), played("alcides", 50), played("kevin", 50)]), { jordi: 5.9, alcides: 6.1, kevin: 6.3 }),
    J(3, 4, 4, Object.fromEntries([played("jordi", 50, { goals: 2 }), played("alcides", 20), played("kevin", 50, { assists: 1 })]), { jordi: 8.6, alcides: 6.0, kevin: 7.2 }, { voteClosesAt: T0 + 16 * DAY }),
    J(4, 2, 0, Object.fromEntries([played("jordi", 25, { goals: 1 }), played("alcides", 50, { goals: 3 }), played("kevin", 50)]), { jordi: 6.6, alcides: 8.0, kevin: 6.5 }),
    J(5, 1, 1, { jordi: row({ benched: true }), ...Object.fromEntries([played("alcides", 50), played("kevin", 50)]) }, { alcides: 6.0, kevin: 6.0 }),
    J(6, 2, 2, { jordi: row({ notCalled: true }), ...Object.fromEntries([played("alcides", 50), played("kevin", 50)]) }, { alcides: 6.0, kevin: 6.0 }),
    ...upcoming(3).map((m, i) => ({ ...m, date: T0 + (50 + i * 7) * DAY })),
  ];
  const mvp = new Map<string, MvpResult>([["r3", { id: "r3", counts: { jordi: 5, kevin: 2 }, total: 7 }]]);
  const me = buildMe(base({ matches: rich, mvpResults: mvp, now: T0 + 45 * DAY, answers: new Map<string, Answer>([["r6", "no"]]) }));

  it("tells «no jugaste» (in the acta, no minutes) from absent (with why)", () => {
    expect(me.rows.slice(0, 6).map((r) => r.kind)).toEqual(["played", "played", "played", "played", "didnt", "absent"]);
    expect(me.rows[4].reason).toBeNull();
    expect(me.rows[5]).toMatchObject({ reason: "Dijiste que no podías", answer: "no" });
    expect(me.rows[2]).toMatchObject({ mvp: true, g: 2, result: "E", notaText: "8,6", bandWord: "Muy buena" });
  });
  it("figures: 4 played, 160′, the mean of his notas, his best night, G·A and the MVP", () => {
    expect(me.figures).toMatchObject({ jornadas: 6, played: 4, minutes: 160, goals: 4, ga: 4, mvps: 1 });
    expect(me.figures.average).toBeCloseTo((7.4 + 5.9 + 8.6 + 6.6) / 4);
    expect(me.figures.best?.matchId).toBe("r3");
    expect(me.form.map((r) => r.jLabel)).toEqual(["J2", "J3", "J4", "J5", "J6"]);
  });
  it("ties share a place", () => {
    const goles = me.ranks.find((r) => r.key === "goles");
    // (Alcides 4, Jordi 4: both first)
    expect(goles).toMatchObject({ value: 4, rank: 1, tied: 1 });
    const partidos = me.ranks.find((r) => r.key === "partidos");
    expect(partidos).toMatchObject({ value: 4, rank: 3, tied: 0 });
  });
  it("with 3 played the records come in, each with its match; his MVP is one piece", () => {
    const recs = me.rewards.earned.filter((r) => r.kind === "record");
    expect(recs.map((r) => r.t)).toEqual(["Más minutos · 50′", "Mejor nota · 8,6", "Más goles · 2"]);
    expect(recs.map((r) => r.match?.matchId)).toEqual(["r1", "r3", "r3"]);
    expect(me.rewards.earned.find((r) => r.id === "mvp-r3")).toMatchObject({ t: "MVP de la J3", gold: true });
    expect(me.rewards.earned.find((r) => r.id === "evo-double")?.match?.matchId).toBe("r3");
    // earned, oldest match first
    const dates = me.rewards.earned.map((r) => r.match?.dateMs ?? 0);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe("me: pieces", () => {
  it("ledgerFigures keeps only what the acta recorded", () => {
    expect(ledgerFigures(undefined)).toEqual([]);
    expect(ledgerFigures({ saves: 4, yellowCards: 0, passes: "x" })).toEqual([{ k: "saves", label: "Paradas", v: 4 }]);
  });
  it("tierInfo: the road from the live thresholds (Plata 65, Oro 75)", () => {
    const t = (rating: number | null, tier: "bronce" | "plata" | "oro" | null) => tierInfo({ rating, tier, tierName: tier ?? "Por estrenar", racha: false });
    expect(t(59, "bronce")).toMatchObject({ plata: 65, oro: 75, next: { name: "Plata", at: 65, missing: 6 } });
    expect(t(70, "plata").next).toEqual({ name: "Oro", at: 75, missing: 5 });
    expect(t(80, "oro").next).toBeNull();
    expect(t(null, null)).toMatchObject({ rating: null, next: null, name: "Por estrenar" });
    expect(t(59, "bronce").tiers.find((x) => x.mine)?.k).toBe("bronce");
  });
});
