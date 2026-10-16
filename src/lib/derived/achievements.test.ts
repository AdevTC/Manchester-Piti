import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../clubData";
import { analysePlayer, chronological } from "../clubAnalytics";
import type { PlayerDoc } from "../schemas";
import type { MvpResult } from "../vestuario";
import { achievements, nextToChase, type Achievement, type AchievementsCtx } from "./achievements";
import { mvpOfFrom } from "./mvpOf";
import { totalMinutes } from "./minutesOf";

// One season of «me», a week apart from 1 oct 2026 (18:00 in Madrid):
// m1  legacy acta (no ledger): his hat-trick, 3–1           → debut, primer gol, hat-trick, doblete
// m2  POR 50′, 1–0, the MVP vote is his                      → portería a cero (POR), MVP
// m3  split minutes DFC 25′ + MC 25′, his goal, 2–2
// m4  MC 30′ + DC 20′, his goal, 1–3 (the defeat)            → comodín (POR, DFC, MC, DC), racha (m3–m5 starts here)
// m5  DC 50′, his goal, 2–1                                  → racha (3 in a row)
// m6–m9  DC 50′, no goal, unbeaten                           → invicto (m5–m9)
// plus an archived match and a scheduled one, which count nothing.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 16);
const at = (week: number) => T0 + week * 7 * DAY;
const NOW = at(20);
const row = (minutes: number, extra: Partial<Participation> = {}) =>
  ({ played: minutes > 0, started: minutes > 0, benched: minutes === 0, minutes, secondsPlayed: Math.round(minutes * 60), goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, ...extra }) as Participation;
const match = (id: string, week: number, gf: number, ga: number, o: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId: "s1", rival: `Rival ${id}`, status: "finished", date: at(week), duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ...o });
const goal = (n: number) => ({ id: `g${n}`, type: "goal" as const, minute: n, playerId: "me" });

const MATCHES: ClubMatch[] = [
  match("m1", 0, 3, 1, { events: [{ id: "p", type: "match_played", playerId: "me" }, goal(1), goal(2), goal(3)] }),
  match("m2", 1, 1, 0, { voteClosesAt: at(1) + DAY, ledger: { me: row(50, { positionsPlayed: { POR: 50 } }) } }),
  match("m3", 2, 2, 2, { ledger: { me: row(50, { goals: 1, positionsPlayed: { DFC: 25, MC: 25 } }) } }),
  match("m4", 3, 1, 3, { ledger: { me: row(50, { goals: 1, positionsPlayed: { MC: 30, DC: 20 } }) } }),
  match("m5", 4, 2, 1, { ledger: { me: row(50, { goals: 1, positionsPlayed: { DC: 50 } }) } }),
  ...[5, 6, 7, 8].map((w) => match(`m${w + 1}`, w, w % 2 ? 1 : 0, 0, { ledger: { me: row(50, { positionsPlayed: { DC: 50 } }) } })),
  match("hidden", 9, 5, 0, { archived: true, ledger: { me: row(50, { goals: 5, positionsPlayed: { ED: 50 } }) } }),
  match("next", 30, 0, 0, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined }),
];
const MVP = new Map<string, MvpResult>([["m2", { id: "m2", counts: { me: 3, pal: 1 }, total: 4 }]]);
const CTX: AchievementsCtx = { mvpResults: MVP, seasons: [{ id: "s1", name: "Temporada 1" }], now: NOW };
const list = achievements("me", MATCHES, CTX);
const byId = (l: Achievement[]) => Object.fromEntries(l.map((a) => [a.id, a]));
const A = byId(list);

describe("achievements: the catalogue", () => {
  it("lists every medal once, in catalogue order, with stable ids (the six vitrina ids kept)", () => {
    expect(list.map((a) => a.id)).toEqual([
      "debut", "ten", "partidos-25", "partidos-50", "partidos-100",
      "goal", "goles-10", "goles-25", "goles-50",
      "assist", "asistencias-10", "asistencias-25",
      "mvp", "mvp-3", "mvp-5",
      "hat", "doblete", "cero", "cero-5", "cero-10",
      "invicto", "racha", "comodin", "minutos",
    ]);
    expect(A["goles-10"]).toMatchObject({ family: "goles", tier: 1, label: "10 goles" });
    expect(A["mvp-5"]).toMatchObject({ family: "mvp", tier: 3, label: "MVP ×5" });
    expect(A.hat).toMatchObject({ family: "hattrick", tier: 0, label: "Hat-trick" });
  });

  it("earns what the season holds, each at the match where the threshold was crossed", () => {
    const earned = list.filter((a) => a.earned).map((a) => [a.id, a.at?.matchId]);
    expect(earned).toEqual([
      ["debut", "m1"],
      ["goal", "m1"],
      ["mvp", "m2"],
      ["hat", "m1"],
      ["doblete", "m1"],
      ["cero", "m2"],
      ["invicto", "m9"],
      ["racha", "m5"],
      ["comodin", "m4"],
    ]);
  });

  it("dates the medal and names the rival: «vs Rival m4 · 22 oct»", () => {
    expect(A.comodin.at).toEqual({ matchId: "m4", date: at(3), rival: "Rival m4" });
    expect(A.comodin.detail).toBe("vs Rival m4 · 22 oct");
    expect(A.hat.detail).toBe("vs Rival m1 · 1 oct");
    expect(A.invicto.detail).toBe("vs Rival m9 · 26 nov");
  });

  it("shows the progress of what is still to come: «9 / 10»", () => {
    expect(A.ten).toMatchObject({ earned: false, detail: "9 / 10", progress: { now: 9, goal: 10 } });
    expect(A.ten.at).toBeUndefined();
    expect(A["goles-10"]).toMatchObject({ earned: false, detail: "6 / 10", progress: { now: 6, goal: 10 } });
    expect(A.assist).toMatchObject({ earned: false, detail: "0 / 3" });
    expect(A["mvp-3"]).toMatchObject({ detail: "1 / 3" });
    expect(A["cero-5"]).toMatchObject({ detail: "1 / 5", progress: { now: 1, goal: 5 } });
    // the racha under way after m5: m6–m9 without his goal
    expect(A.racha.progress).toEqual({ now: 3, goal: 3 });
  });

  it("matches the stats page's numbers (analysePlayer) for the same fixture", () => {
    const stats = analysePlayer({ id: "me" } as PlayerDoc, chronological(MATCHES));
    expect(A.ten.progress?.now).toBe(stats.matchesPlayed);
    expect(A["goles-10"].progress?.now).toBe(stats.goals);
    expect(A.minutos.progress?.now).toBe(stats.minutes);
    expect(stats.goalStreak.best.count).toBe(3);
    expect(stats.hatTricks).toBe(1);
  });
});

describe("achievements: the rules", () => {
  it("minutes: only the known ones (the legacy acta adds nothing), split minutes counted whole", () => {
    expect(A.minutos).toMatchObject({ earned: false, detail: "400 / 1000", progress: { now: 400, goal: 1000 } });
    const long = [
      match("x1", 0, 1, 0, { events: [{ id: "p", type: "match_played", playerId: "me" }] }),
      match("x2", 1, 1, 0, { duration: 600, ledger: { me: row(599.5, { positionsPlayed: { DC: 300, MC: 299.5 } }) } }),
      match("x3", 2, 1, 0, { duration: 600, ledger: { me: row(400, { positionsPlayed: { DC: 400 } }) } }),
      match("x4", 3, 1, 0, { duration: 600, ledger: { me: row(1, { positionsPlayed: { DC: 1 } }) } }),
    ];
    const m = byId(achievements("me", long, CTX)).minutos;
    expect(m).toMatchObject({ earned: true, at: { matchId: "x4" }, progress: { now: totalMinutes(long, "me"), goal: 1000 } });
  });

  it("portería a cero: POR or defence in a won match with 0 against; plata and oro count POR only", () => {
    const def = byId(achievements("me", [match("d1", 0, 1, 0, { ledger: { me: row(50, { positionsPlayed: { DFC: 50 } }) } })], CTX));
    expect(def.cero).toMatchObject({ earned: true, at: { matchId: "d1" } });
    expect(def["cero-5"].progress).toEqual({ now: 0, goal: 5 });
    // a draw 0–0 or a midfield clean sheet don't count
    const no = byId(achievements("me", [match("e1", 0, 0, 0, { ledger: { me: row(50, { positionsPlayed: { POR: 50 } }) } }), match("e2", 1, 2, 0, { ledger: { me: row(50, { positionsPlayed: { MC: 50 } }) } })], CTX));
    expect(no.cero.earned).toBe(false);
    const keeper = Array.from({ length: 11 }, (_, i) => match(`k${i + 1}`, i, i === 3 ? 1 : 2, i === 3 ? 1 : 0, { ledger: { me: row(50, { positionsPlayed: { POR: 50 } }) } }));
    const k = byId(achievements("me", keeper, CTX));
    expect(k.cero.at?.matchId).toBe("k1");
    expect(k["cero-5"].at?.matchId).toBe("k6"); // k4 was a draw
    expect(k["cero-10"]).toMatchObject({ earned: true, at: { matchId: "k11" }, progress: { now: 10, goal: 10 } });
  });

  it("invicto counts his own matches (one he misses neither counts nor breaks it); a defeat starts again", () => {
    expect(A.invicto.progress).toEqual({ now: 5, goal: 5 });
    const games = [0, 1, 2, 3, 4, 5].map((w) => match(`u${w}`, w, 1, w === 1 ? 2 : 0, { ledger: w === 3 ? {} : { me: row(50) } }));
    const u = byId(achievements("me", games, CTX)).invicto;
    expect(u).toMatchObject({ earned: false, detail: "3 / 5", progress: { now: 3, goal: 5 } });
  });

  it("the MVP is the vote's winner once closed; a caller's mvpOf gives the same answer", () => {
    expect(byId(achievements("me", MATCHES, { ...CTX, now: at(1) })).mvp.earned).toBe(false);
    const games = chronological(MATCHES);
    const viaMvpOf = achievements("me", MATCHES, { ...CTX, mvpOf: mvpOfFrom(MVP, games, NOW) });
    expect(viaMvpOf).toEqual(list);
  });

  it("a player with nothing: every medal unearned, «0 / n»", () => {
    const none = achievements("nobody", MATCHES, CTX);
    expect(none.every((a) => !a.earned && !a.at)).toBe(true);
    expect(byId(none).debut.detail).toBe("0 / 1");
  });
});

describe("nextToChase", () => {
  it("one per family (its next tier), closest to done first, then catalogue order", () => {
    expect(nextToChase(list).map((a) => a.id)).toEqual(["ten", "goles-10", "minutos"]);
    expect(nextToChase(list, 6).map((a) => a.id)).toEqual(["ten", "goles-10", "minutos", "mvp-3", "cero-5", "assist"]);
  });
  it("never offers an earned medal", () => {
    const all = list.map((a) => ({ ...a, earned: true }));
    expect(nextToChase(all)).toEqual([]);
  });
});
