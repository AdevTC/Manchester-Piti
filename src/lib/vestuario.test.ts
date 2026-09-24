import { describe, expect, it } from "vitest";
import { predictionPoints, sortPorra } from "../../functions/src/vestuarioLogic";
import type { ClubMatch } from "./clubData";
import {
  bestPartner,
  calledUp,
  countdown,
  slotStanding,
  trainingOver,
  slotTime,
  firstSteps,
  nextWeekday,
  suggestFicha,
  currentSeasonId,
  greeting,
  initials,
  kickoffLabel,
  mvpWinners,
  nextMilestone,
  podium,
  porraPosition,
  seasonSummary,
  slotVotes,
  versusBest,
  vitrina,
  type MvpResult,
} from "./vestuario";

const DAY = 86_400_000;
const played = (id: string) => ({ id: `p-${id}-${Math.random()}`, type: "match_played" as const, playerId: id });
const goal = (scorer: string, assist?: string) => ({ id: `g-${Math.random()}`, type: "goal" as const, playerId: scorer, assistPlayerId: assist });
function match(id: string, seasonId: string, day: number, events: ClubMatch["events"], gf = 1, ga = 0, extra: Partial<ClubMatch> = {}): ClubMatch {
  return { id, seasonId, rival: `Rival ${id}`, status: "finished", date: day * DAY, goalsFor: gf, goalsAgainst: ga, events, ...extra };
}
const matches: ClubMatch[] = [
  match("a1", "old", 1, [played("me"), goal("me"), goal("me"), goal("me"), played("pal")], 3, 1),
  match("b1", "now", 10, [played("me"), played("pal"), goal("pal", "me")], 1, 0),
  match("b2", "now", 11, [played("me"), played("pal"), played("x"), goal("me", "pal")], 1, 2),
  match("b3", "now", 12, [played("x")], 0, 0),
];

describe("porra", () => {
  it("puntúa 3 por el resultado exacto y 1 por acertar el signo", () => {
    expect(predictionPoints({ goalsFor: 2, goalsAgainst: 1 }, { goalsFor: 2, goalsAgainst: 1 })).toBe(3);
    expect(predictionPoints({ goalsFor: 3, goalsAgainst: 0 }, { goalsFor: 2, goalsAgainst: 1 })).toBe(1);
    expect(predictionPoints({ goalsFor: 1, goalsAgainst: 1 }, { goalsFor: 0, goalsAgainst: 0 })).toBe(1);
    expect(predictionPoints({ goalsFor: 0, goalsAgainst: 1 }, { goalsFor: 2, goalsAgainst: 1 })).toBe(0);
  });
  it("ordena por puntos, exactos y menos partidos", () => {
    const row = (uid: string, points: number, exact: number, playedN: number) => ({ uid, name: uid, playerId: null, points, exact, hits: 0, played: playedN });
    const sorted = sortPorra([row("a", 4, 0, 4), row("b", 4, 1, 4), row("c", 4, 1, 3), row("d", 6, 0, 6)]);
    expect(sorted.map((r) => r.uid)).toEqual(["d", "c", "b", "a"]);
    expect(porraPosition(sorted, "b")).toMatchObject({ position: 3 });
    expect(porraPosition(sorted, "zz")).toBeNull();
  });
});

describe("tiempo y textos", () => {
  it("cuenta atrás legible", () => {
    expect(countdown(1000 + 3 * DAY + 14 * 3_600_000 + 22 * 60_000, 1000)).toBe("3 d 14 h 22 min");
    expect(countdown(5 * 60_000, 0)).toBe("5 min");
    expect(countdown(0, 10)).toBe("¡Ya!");
  });
  it("saluda según la hora de Madrid", () => {
    expect(greeting(Date.UTC(2026, 8, 24, 8, 0))).toBe("Buenos días"); // 10:00 CEST
    expect(greeting(Date.UTC(2026, 8, 24, 14, 0))).toBe("Buenas tardes"); // 16:00
    expect(greeting(Date.UTC(2026, 8, 24, 21, 30))).toBe("Buenas noches"); // 23:30
  });
  it("formatea el saque en hora de Madrid", () => {
    expect(kickoffLabel(Date.UTC(2026, 8, 26, 14, 0))).toBe("Sábado, 16:00");
  });
  it("iniciales y comparación con tu mejor temporada", () => {
    expect(initials("Adrián T.C.")).toBe("AT");
    expect(initials("capitan")).toBe("CA");
    expect(versusBest(1, 0, "goles", "Tu primer gol")).toBe("Tu primer gol con el Piti.");
    expect(versusBest(2, 5, "goles", "Tu primer gol")).toBe("Tu mejor temporada fueron 5. Te faltan 4 para superarte.");
    expect(versusBest(6, 5, "goles", "Tu primer gol")).toBe("Ya es tu mejor temporada.");
    expect(nextMilestone(7)).toBe(10);
    expect(nextMilestone(10)).toBe(25);
  });
});

describe("MVP", () => {
  const m = match("m", "now", 1, [], 1, 0, { voteClosesAt: 100 });
  const result: MvpResult = { id: "m", counts: { a: 3, b: 3, c: 1 }, total: 7 };
  it("solo hay ganadores cuando la votación ha cerrado, y comparten el empate", () => {
    expect(mvpWinners(m, result, 50)).toEqual([]);
    expect(mvpWinners(m, result, 100).sort()).toEqual(["a", "b"]);
    expect(mvpWinners(m, { id: "m", counts: {}, total: 0 }, 200)).toEqual([]);
  });
  it("el podio ordena por votos y descarta ceros", () => {
    expect(podium({ id: "x", counts: { a: 1, b: 4, c: 0, d: 2 }, total: 7 }).map((p) => p.playerId)).toEqual(["b", "d", "a"]);
  });
});

describe("temporada, vitrina y química", () => {
  const results = new Map<string, MvpResult>([["b1", { id: "b1", counts: { me: 2, pal: 1 }, total: 3 }]]);
  const closed = matches.map((m) => (m.id === "b1" ? { ...m, voteClosesAt: 5 } : m));
  it("resume la temporada actual frente a las anteriores", () => {
    const s = seasonSummary("me", "now", closed, results, 10);
    expect(s).toMatchObject({ played: 2, goals: 1, assists: 1, mvps: 1, careerPlayed: 3, milestone: 5, bestGoals: 3, bestAssists: 0 });
    expect(s.assistTarget).toEqual({ playerId: "pal", count: 1 });
    expect(s.streak).toBe(0); // missed the latest match (b3)
  });
  it("la vitrina solo muestra logros reales", () => {
    const medals = vitrina("me", closed, results, [{ id: "old", name: "Temporada 1" }], 10);
    const byId = Object.fromEntries(medals.map((m) => [m.id, m]));
    expect(byId.debut).toMatchObject({ earned: true, detail: "Temporada 1" });
    expect(byId.goal).toMatchObject({ earned: true, detail: "vs Rival a1" });
    expect(byId.hat).toMatchObject({ earned: true, detail: "vs Rival a1" });
    expect(byId.mvp).toMatchObject({ earned: true, detail: "votado 1 vez" });
    expect(byId.assist).toMatchObject({ earned: false, detail: "1 / 3" });
    expect(byId.ten).toMatchObject({ earned: false, detail: "3 / 10" });
  });
  it("el mejor socio es con quien más partidos has jugado", () => {
    expect(bestPartner("me", matches, ["me", "pal", "x"])).toEqual({ playerId: "pal", together: 3, wins: 2, theirGoalsFromYou: 1, yourGoalsFromThem: 1 });
    expect(bestPartner("nobody", matches, ["me"])).toBeNull();
  });
});

describe("convocatoria y entrenos", () => {
  it("convocado = titular o suplente del próximo partido", () => {
    const next = { id: "n", starters: ["a"], bench: ["b"], notCalled: ["c"] } as ClubMatch;
    expect(calledUp(next, "a")).toBe(true);
    expect(calledUp(next, "b")).toBe(true);
    expect(calledUp(next, "c")).toBe(false);
    expect(calledUp(next, undefined)).toBe(false);
  });
  it("temporada del vestuario: la del próximo partido, si no la del último jugado", () => {
    expect(currentSeasonId({ id: "n", seasonId: "next" }, matches, [])).toBe("next");
    expect(currentSeasonId(undefined, matches, [])).toBe("old");
    expect(currentSeasonId(undefined, [], [{ id: "s1" }, { id: "s2" }])).toBe("s2");
  });
  it("cuenta los votos de cada hueco", () => {
    const slots = [{ id: "s1", at: 1, place: "" }, { id: "s2", at: 2, place: "" }];
    const counts = slotVotes(slots, [{ slotIds: ["s1", "s2"] }, { slotIds: ["s2", "zz"] }]);
    expect([...counts.entries()]).toEqual([["s1", 1], ["s2", 2]]);
  });
});

describe("first visit", () => {
  const fichas = [
    { id: "a", names: ["JORDIX", "Jordi Pérez"] },
    { id: "b", names: ["KEVIN"] },
    { id: "c", names: ["Álex"] },
  ];
  it("suggests the ficha that matches the nickname", () => {
    expect(suggestFicha("jordi", fichas)?.id).toBe("a");
    expect(suggestFicha("Kevin", fichas)?.id).toBe("b");
    expect(suggestFicha("alex", fichas)?.id).toBe("c");
    expect(suggestFicha("zz", fichas)).toBeNull();
    expect(suggestFicha("marta", fichas)).toBeNull();
  });
  it("highlights the first step that can be done now", () => {
    const base = { linked: false, claimPending: false, matchOpen: false, answered: false, posted: false };
    expect(firstSteps(base).map((s) => s.state)).toEqual(["done", "now", "todo", "todo"]);
    expect(firstSteps({ ...base, claimPending: true }).map((s) => s.state)).toEqual(["done", "todo", "todo", "now"]);
    expect(firstSteps({ ...base, linked: true, matchOpen: true }).map((s) => s.state)).toEqual(["done", "done", "now", "todo"]);
  });
  it("finds the next weekday at least an hour ahead", () => {
    const fri = new Date(2026, 8, 25, 12).getTime(); // Friday
    expect(new Date(nextWeekday(fri, 6, 10)).getDate()).toBe(26);
    const sat = new Date(2026, 8, 26, 10, 30).getTime();
    expect(new Date(nextWeekday(sat, 6, 10)).getDate()).toBe(3);
  });
});

describe("training slot ranges", () => {
  it("shows the range in club time, or just the start for old slots", () => {
    const at = Date.UTC(2026, 9, 3, 19, 0); // 21:00 in Madrid (CEST)
    expect(slotTime({ at, end: at + 90 * 60_000 })).toBe("21:00–22:30");
    expect(slotTime({ at })).toBe("21:00");
  });
});

describe("training standing and confirmation", () => {
  const slots = [{ id: "s1", at: 1, place: "" }, { id: "s2", at: 2, place: "" }];
  it("marks the most voted and the slots with enough players", () => {
    const votes = [...Array(7)].map(() => ({ slotIds: ["s2"] })).concat([{ slotIds: ["s1", "s2"] }]);
    const st = slotStanding(slots, votes);
    expect([...st.top]).toEqual(["s2"]);
    expect([...st.ready]).toEqual(["s2"]);
    expect(slotStanding(slots, []).top.size).toBe(0);
  });
  it("a confirmed training stops showing once it ends", () => {
    expect(trainingOver({ confirmed: { at: 0, end: 1000 } }, 2000)).toBe(true);
    expect(trainingOver({ confirmed: { at: 0 } }, 60 * 60_000)).toBe(false);
    expect(trainingOver({}, 9e12)).toBe(false);
  });
});
