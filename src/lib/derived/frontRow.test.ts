import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import { calculateLedger } from "../../../functions/src/matchEngine";
import type { ClubMatch, MatchEvent } from "../clubData";
import type { MvpResult } from "../vestuario";
import { frontRowMode, frontRowOf, type FrontRowInput, type Seat } from "./frontRow";

const MIN = 60_000;
const HOUR = 60 * MIN;
const KO = Date.UTC(2026, 9, 18, 17); // Sunday 18 Oct 2026, 19:00 Madrid
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });

// the real squad (BRIEF2): id, dorsal, name, position on his file
const SQUAD = (
  [
    ["evans", 1, "Evans", "POR"], ["illescas", 4, "Illescas", "DFC"], ["alcides", 7, "Alcides", "DC"], ["josito", 8, "Josito", "MC"],
    ["erik", 9, "Erik", "DC"], ["adrian", 10, "Adrián T.C.", "MC"], ["kevin", 11, "Kevin", "ED"], ["fer", 12, "Fer", "LI"],
    ["huberoski", 14, "Huberoski", "MC"], ["andia", 19, "Andia", "DFC"], ["pellete", 20, "Pellete", "MC"], ["almachi", 21, "Almachi", "EI"],
    ["eguzquiza", 22, "Eguzquiza", "MC"], ["jordi", 28, "Jordi", "LD"], ["jorge", 30, "Jorge", "DFC"], ["brawan", 33, "Brawan", "DC"],
  ] as const
).map(([id, n, name, position]) => ({ id, dorsal: String(n), name, position }));
const SEVEN = ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"];
const BENCH = ["erik", "kevin", "jorge", "brawan"];
const LINEUP = {
  system: "2-3-1",
  boardId: "b1",
  setBy: "uid-capi",
  setAt: KO - 3 * HOUR,
  slots: [
    { playerId: "evans", code: "POR", x: 50, y: 95 },
    { playerId: "fer", code: "LI", x: 15, y: 70 },
    { playerId: "illescas", code: "DFC", x: 50, y: 75 },
    { playerId: "jordi", code: "LD", x: 85, y: 70 },
    { playerId: "adrian", code: "MC", x: 35, y: 45 },
    { playerId: "eguzquiza", code: "MC", x: 65, y: 45 },
    { playerId: "alcides", code: "DC", x: 50, y: 15 },
  ],
};

// the live scenario: a play stamped by la mesa's clock at football minute `m` of half `period`
const at = (m: number) => (m - 1) * 60 + 20;
const play = (id: string, type: MatchEvent["type"], m: number, period: 1 | 2, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: at(m), minute: m - 1, period, byUid: "uid-hube", ...extra });
const FIRST_HALF: MatchEvent[] = [
  play("e1", "goal", 6, 1, { playerId: "alcides", assistPlayerId: "adrian", assistReviewed: true }),
  play("e2", "opponent_goal", 11, 1),
  play("e3", "yellow_card", 15, 1, { playerId: "eguzquiza" }),
  play("e4", "woodwork", 18, 1, { playerId: "adrian" }),
  play("e5", "goal", 21, 1, { playerId: "adrian", assistPlayerId: "jordi", assistReviewed: true }),
];
const SECOND_HALF: MatchEvent[] = [
  play("e6", "substitution", 30, 2, { playerId: "illescas", inPlayerId: "erik" }),
  play("e7", "penalty_saved", 34, 2, { playerId: "evans" }),
  play("e8", "substitution", 35, 2, { playerId: "eguzquiza", inPlayerId: "kevin" }),
  play("e9", "goal", 44, 2, { playerId: "kevin", assistReviewed: true }),
];

const started = transitionClock(readyClock(), "start", KO);
const half = transitionClock(started, "halftime", KO + 25 * MIN);
const second = transitionClock(half, "second", KO + 32 * MIN);
const ended = transitionClock(second, "finish", KO + 57 * MIN);

const base: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  version: 2,
  status: "scheduled",
  rival: "Orduña fc",
  date: ts(KO),
  duration: 50,
  home: true,
  venue: "Palomeras",
  clock: readyClock(),
  starters: SEVEN,
  bench: BENCH,
  notCalled: ["josito", "huberoski", "pellete", "almachi", "andia"],
  events: [],
};
const withLineup = (m: ClubMatch): ClubMatch => ({ ...m, lineup: LINEUP }) as ClubMatch;

const input = (over: Partial<FrontRowInput>): FrontRowInput => ({
  match: withLineup(base),
  phase: "antes",
  squad: SQUAD,
  seven: SEVEN,
  answers: [],
  absentIds: [],
  viewerPlayerId: null,
  scorerIds: [],
  mvpVoteOpen: false,
  now: KO - 2 * HOUR,
  ...over,
});
const seatOf = (seats: readonly Seat[], id: string): Seat => {
  const s = seats.find((x) => x.playerId === id);
  if (!s) throw new Error(`no seat for ${id}`);
  return s;
};
const states = (seats: readonly Seat[]) => Object.fromEntries(seats.map((s) => [s.playerId, s.state]));

describe("frontRowMode", () => {
  it("follows the phase", () => {
    const m = withLineup(base);
    expect(frontRowMode("pretemporada", null)).toBe("plantilla");
    expect(frontRowMode("semana", null)).toBe("plantilla");
    expect(["semana", "antes", "aplazado"].map((p) => frontRowMode(p as "semana", m))).toEqual(["convocatoria", "convocatoria", "convocatoria"]);
    // (nobody started la mesa's clock: no plays to seat anyone by, the convocatoria stands until the acta)
    expect(frontRowMode("pendiente", m)).toBe("convocatoria");
    expect(["pitido", "directo1", "descanso", "directo2"].map((p) => frontRowMode(p as "pitido", m))).toEqual(["banquillo", "banquillo", "banquillo", "banquillo"]);
    expect(["final", "acta", "despues"].map((p) => frontRowMode(p as "final", m))).toEqual(["jugaron", "jugaron", "jugaron"]);
  });
});

describe("plantilla", () => {
  it("every seat folded, nobody's answer, the viewer's seat marked", () => {
    const row = frontRowOf(input({ match: null, phase: "pretemporada", seven: [], viewerPlayerId: "jordi" }));
    expect(row).toMatchObject({ mode: "plantilla", counts: null, sevenPublished: false });
    expect(row.seats).toHaveLength(16);
    expect(new Set(row.seats.map((s) => s.state))).toEqual(new Set(["noconvocado"]));
    expect(seatOf(row.seats, "jordi")).toMatchObject({ mine: true, dorsal: "28", position: "LD", starter: false });
    expect(row.seats.filter((s) => s.mine)).toHaveLength(1);
  });
});

describe("convocatoria, for a member", () => {
  const answers: FrontRowInput["answers"] = [
    { playerId: "adrian", response: "yes" },
    { playerId: "jordi", response: "yes" },
    { playerId: "brawan", response: "yes" },
    { playerId: "erik", response: "yes" },
    { playerId: "fer", response: "maybe" },
    { playerId: "almachi", response: "no" },
    { playerId: null, response: "yes" }, // an answer without a linked player has no seat
  ];

  it("each seat says its answer; the counts add up to the squad", () => {
    const row = frontRowOf(input({ answers, absentIds: ["andia"], viewerPlayerId: "jordi" }));
    expect(row.mode).toBe("convocatoria");
    expect(states(row.seats)).toMatchObject({ adrian: "voy", jordi: "voy", brawan: "voy", erik: "voy", fer: "duda", almachi: "novoy", andia: "ausente", evans: "sinresponder", josito: "sinresponder" });
    expect(row.counts).toEqual({ vienen: 4, duda: 1, no: 1, sinResponder: 9, ausentes: 1 });
  });

  it("the seven (gold): starter and the lineup's code; «tú» on the viewer's seat", () => {
    const row = frontRowOf(input({ answers, viewerPlayerId: "jordi" }));
    expect(row.sevenPublished).toBe(true);
    expect(row.seats.filter((s) => s.starter).map((s) => s.playerId).sort()).toEqual([...SEVEN].sort());
    expect(seatOf(row.seats, "jordi")).toMatchObject({ starter: true, mine: true, position: "LD", state: "voy" });
    expect(seatOf(row.seats, "erik")).toMatchObject({ starter: false, mine: false, position: "DC" });
  });

  it("before the seven is out: nobody gold", () => {
    const row = frontRowOf(input({ match: base, seven: [], answers }));
    expect(row.sevenPublished).toBe(false);
    expect(row.seats.some((s) => s.starter)).toBe(false);
  });

  it("an absence is «ausente» unless he said Voy or Duda by hand", () => {
    const row = frontRowOf(input({ answers: [{ playerId: "andia", response: "yes" }, { playerId: "jorge", response: "no" }], absentIds: ["andia", "jorge"] }));
    expect(states(row.seats)).toMatchObject({ andia: "voy", jorge: "ausente" });
    expect(row.counts).toMatchObject({ vienen: 1, no: 0, ausentes: 1 });
  });

  it("the latest answer counts; the scorer's seat carries «anota»", () => {
    const row = frontRowOf(input({ answers: [{ playerId: "erik", response: "no" }, { playerId: "erik", response: "yes" }], scorerIds: ["huberoski"] }));
    expect(seatOf(row.seats, "erik").state).toBe("voy");
    expect(seatOf(row.seats, "huberoski").markers).toEqual([{ kind: "anota" }]);
  });

  it("the week and an aplazado read the same way", () => {
    for (const phase of ["semana", "aplazado"] as const) {
      const row = frontRowOf(input({ phase, match: { ...base, status: phase === "aplazado" ? "postponed" : "scheduled" }, seven: [], answers }));
      expect(row.mode).toBe("convocatoria");
      expect(row.counts?.vienen).toBe(4);
    }
  });
});

describe("convocatoria, for a fan", () => {
  it("the convocados and the seven; no answers, no counts, no absences", () => {
    const row = frontRowOf(input({ answers: null, absentIds: ["andia"] }));
    expect(row.counts).toBeNull();
    expect(row.sevenPublished).toBe(true);
    const s = states(row.seats);
    for (const id of [...SEVEN, ...BENCH]) expect(s[id]).toBe("convocado");
    for (const id of ["josito", "huberoski", "pellete", "almachi", "andia"]) expect(s[id]).toBe("noconvocado");
    expect(row.seats.some((x) => ["voy", "duda", "novoy", "sinresponder", "ausente"].includes(x.state))).toBe(false);
    expect(row.seats.filter((x) => x.starter)).toHaveLength(7);
  });
});

describe("banquillo through the live scenario", () => {
  const live = (events: MatchEvent[], clock = second) => withLineup({ ...base, clock, events });

  it("pitido: the seven on the pitch, four on the bench, the rest folded", () => {
    const row = frontRowOf(input({ phase: "pitido", match: withLineup(base), answers: null, now: KO + 3 * MIN }));
    expect(row.mode).toBe("banquillo");
    expect(row.counts).toBeNull();
    const s = states(row.seats);
    for (const id of SEVEN) expect(s[id]).toBe("campo");
    for (const id of BENCH) expect(s[id]).toBe("banquillo");
    expect(s.josito).toBe("noconvocado");
  });

  it("descanso: goals and the yellow on their seats, in play order", () => {
    const row = frontRowOf(input({ phase: "descanso", match: live(FIRST_HALF, half), answers: null, now: KO + 28 * MIN }));
    expect(seatOf(row.seats, "alcides").markers).toEqual([{ kind: "gol", minute: 6 }]);
    expect(seatOf(row.seats, "adrian").markers).toEqual([{ kind: "gol", minute: 21 }]);
    expect(seatOf(row.seats, "eguzquiza").markers).toEqual([{ kind: "amarilla", minute: 15 }]);
    expect(seatOf(row.seats, "evans").markers).toEqual([]);
  });

  it("directo2: who came on takes the slot (and code) of who went off", () => {
    const row = frontRowOf(input({ phase: "directo2", match: live([...FIRST_HALF, ...SECOND_HALF]), answers: null, now: KO + 45 * MIN, viewerPlayerId: "erik" }));
    const s = states(row.seats);
    expect(s).toMatchObject({ erik: "campo", kevin: "campo", illescas: "banquillo", eguzquiza: "banquillo", jorge: "banquillo", brawan: "banquillo" });
    expect(row.seats.filter((x) => x.state === "campo")).toHaveLength(7);
    expect(seatOf(row.seats, "erik")).toMatchObject({ position: "DFC", mine: true, starter: false, markers: [{ kind: "entra", minute: 30 }] });
    expect(seatOf(row.seats, "illescas")).toMatchObject({ position: "DFC", starter: true, markers: [{ kind: "sale", minute: 30 }] });
    expect(seatOf(row.seats, "kevin").markers).toEqual([{ kind: "entra", minute: 35 }, { kind: "gol", minute: 44 }]);
    expect(seatOf(row.seats, "eguzquiza").markers).toEqual([{ kind: "amarilla", minute: 15 }, { kind: "sale", minute: 35 }]);
  });

  it("a red empties his seat on the pitch: expulsado", () => {
    const red = play("r1", "red_card", 40, 2, { playerId: "fer" });
    const row = frontRowOf(input({ phase: "directo2", match: live([...FIRST_HALF, ...SECOND_HALF, red]), answers: null, now: KO + 45 * MIN }));
    expect(seatOf(row.seats, "fer")).toMatchObject({ state: "expulsado", markers: [{ kind: "roja", minute: 40 }] });
    expect(row.seats.filter((x) => x.state === "campo")).toHaveLength(6);
  });

  it("a red to a sub on the bench still shows", () => {
    const red = play("r2", "red_card", 40, 2, { playerId: "jorge" });
    const row = frontRowOf(input({ phase: "directo2", match: live([...FIRST_HALF, red]), answers: null, now: KO + 45 * MIN }));
    expect(seatOf(row.seats, "jorge")).toMatchObject({ state: "expulsado", markers: [{ kind: "roja", minute: 40 }] });
  });

  it("tocado and changed: lesionado on the bench, with both marks", () => {
    const events = [...FIRST_HALF, play("i1", "injury", 20, 1, { playerId: "illescas" }), play("i2", "substitution", 20, 1, { playerId: "illescas", inPlayerId: "erik" })];
    const row = frontRowOf(input({ phase: "directo1", match: live(events, started), answers: null, now: KO + 22 * MIN }));
    expect(seatOf(row.seats, "illescas")).toMatchObject({ state: "lesionado", markers: [{ kind: "lesion", minute: 20 }, { kind: "sale", minute: 20 }] });
    expect(seatOf(row.seats, "erik").state).toBe("campo");
  });

  it("a possible duplicate nobody resolved counts once", () => {
    const dup = play("d1", "goal", 21, 1, { playerId: "alcides", dupOf: "e5" });
    const row = frontRowOf(input({ phase: "directo1", match: live([...FIRST_HALF, dup], started), answers: null, now: KO + 22 * MIN }));
    expect(seatOf(row.seats, "alcides").markers).toEqual([{ kind: "gol", minute: 6 }]);
  });

  it("without a lineup doc: the seven from the convocatoria, positions from the files", () => {
    const row = frontRowOf(input({ phase: "directo2", match: { ...base, clock: second, events: [...FIRST_HALF, ...SECOND_HALF] }, answers: null, now: KO + 45 * MIN }));
    expect(seatOf(row.seats, "erik")).toMatchObject({ state: "campo", position: "DC" });
    expect(seatOf(row.seats, "illescas").state).toBe("banquillo");
  });

  it("members: «anota» on the scorer's seat, ausente for an absent one not called", () => {
    const row = frontRowOf(input({ phase: "directo1", match: live(FIRST_HALF, started), answers: [], absentIds: ["andia"], scorerIds: ["huberoski"], now: KO + 22 * MIN }));
    expect(seatOf(row.seats, "huberoski")).toMatchObject({ state: "noconvocado", markers: [{ kind: "anota" }] });
    expect(seatOf(row.seats, "andia").state).toBe("ausente");
  });
});

describe("jugaron", () => {
  const events = [...FIRST_HALF, ...SECOND_HALF];
  const WHISTLE = KO + 57 * MIN;

  it("final, acta pendiente: provisional minutes and goals from the plays; no logros yet", () => {
    const row = frontRowOf(input({ phase: "final", match: withLineup({ ...base, clock: ended, events }), answers: null, now: WHISTLE + 5 * MIN }));
    expect(row.mode).toBe("jugaron");
    const s = states(row.seats);
    for (const id of [...SEVEN, "erik", "kevin"]) expect(s[id]).toBe("jugo");
    expect(s).toMatchObject({ jorge: "nojugo", brawan: "nojugo", josito: "noconvocado" });
    expect(seatOf(row.seats, "evans")).toMatchObject({ minutes: 50, goals: 0 });
    expect(seatOf(row.seats, "alcides")).toMatchObject({ minutes: 50, goals: 1, markers: [{ kind: "gol", minute: 6 }] });
    expect(seatOf(row.seats, "illescas").minutes).toBe(29);
    expect(seatOf(row.seats, "erik").minutes).toBe(21);
    expect(seatOf(row.seats, "kevin").goals).toBe(1);
    expect(row.seats.some((x) => x.logros !== undefined || x.mvpCandidate !== undefined)).toBe(false);
  });

  // the published acta: the ledger the server stored (here calculateLedger's, one row adjusted by the acta)
  const ledger = calculateLedger({ starters: SEVEN, bench: BENCH, notCalled: base.notCalled ?? [], events, duration: 50 }, false).players;
  ledger.erik = { ...ledger.erik, minutes: 20 };
  const acta: ClubMatch = withLineup({ ...base, clock: ended, events, status: "finished", goalsFor: 3, goalsAgainst: 1, liveEndedAt: WHISTLE, voteClosesAt: WHISTLE + 48 * HOUR, ledger });

  it("acta: the ledger's minutes, the logros of the night, and who can be voted", () => {
    const row = frontRowOf(input({ phase: "acta", match: acta, answers: [], history: [acta], mvpResults: new Map(), mvpVoteOpen: true, now: WHISTLE + HOUR }));
    expect(seatOf(row.seats, "erik").minutes).toBe(20);
    expect(seatOf(row.seats, "alcides")).toMatchObject({ state: "jugo", goals: 1, mvpCandidate: true });
    expect(seatOf(row.seats, "alcides").logros).toEqual(expect.arrayContaining(["Debut", "Primer gol"]));
    expect(seatOf(row.seats, "evans").logros).toEqual(["Debut"]);
    expect(seatOf(row.seats, "jorge")).toMatchObject({ state: "nojugo", mvpCandidate: false });
    expect(seatOf(row.seats, "jorge").logros).toBeUndefined();
    expect(row.seats.filter((x) => x.mvpCandidate)).toHaveLength(9);
    expect(row.seats.some((x) => x.markers.some((m) => m.kind === "mvp"))).toBe(false);
  });

  it("después: the MVP once the vote has closed", () => {
    const results = new Map<string, MvpResult>([["j1", { id: "j1", counts: { alcides: 5, kevin: 2 }, total: 7 }]]);
    const row = frontRowOf(input({ phase: "despues", match: acta, answers: null, history: [acta], mvpResults: results, now: WHISTLE + 49 * HOUR }));
    expect(seatOf(row.seats, "alcides").markers).toEqual([{ kind: "gol", minute: 6 }, { kind: "mvp" }]);
    expect(seatOf(row.seats, "kevin").markers.some((m) => m.kind === "mvp")).toBe(false);
    expect(row.seats.some((x) => x.mvpCandidate !== undefined)).toBe(false);
  });

  it("no MVP before the vote closes, even with a tally", () => {
    const results = new Map<string, MvpResult>([["j1", { id: "j1", counts: { alcides: 5 }, total: 5 }]]);
    const row = frontRowOf(input({ phase: "acta", match: acta, answers: [], history: [acta], mvpResults: results, mvpVoteOpen: true, now: WHISTLE + HOUR }));
    expect(row.seats.some((x) => x.markers.some((m) => m.kind === "mvp"))).toBe(false);
  });
});
