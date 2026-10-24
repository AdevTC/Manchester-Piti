import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import { addrOf, hrefOf } from "./address";
import { adn, age, birthday, heightText, missing, periodCtx, sign, stats, toPlayer } from "./model";
import { duelView, homeView, ledeView, matchLines, railView, type DayInput, type Squad, type ViewState, type Who } from "./views";

describe("the addresses", () => {
  it("reads each screen from the address", () => {
    expect(addrOf("/plantilla", { kit: 2, orden: "posicion", q: "jo" })).toMatchObject({ screen: "home", kit: "away", orden: "posicion", q: "jo" });
    expect(addrOf("/plantilla/album", { ver: "faltan" })).toMatchObject({ screen: "album", ver: "faltan" });
    expect(addrOf("/plantilla/cara-a-cara", { a: "x", b: "y" })).toMatchObject({ screen: "cara", a: "x", b: "y" });
    expect(addrOf("/jugadores/abc/juego", { season: "all" })).toMatchObject({ screen: "player", focus: "abc", sec: "juego", all: true });
    expect(addrOf("/jugadores/abc/", {})).toMatchObject({ screen: "player", focus: "abc", sec: "ficha" });
  });
  it("writes the address back, round trip", () => {
    for (const [path, search] of [
      ["/plantilla", { kit: "2", q: "jo" }],
      ["/plantilla/album", { ver: "tengo" }],
      ["/plantilla/cara-a-cara", { a: "x", b: "y" }],
      ["/jugadores/abc/cromo", { season: "all" }],
      ["/jugadores/abc", {}],
    ] as const) {
      const h = hrefOf(addrOf(path, search));
      expect(h.to).toBe(path);
      expect(h.search).toEqual(search);
    }
  });
});

const P = (id: string, number: number, extra: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, shirtName: id.toUpperCase(), number, seasons: ["t1"], ...extra });
type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row =>
  ({ minutes, started: minutes > 0, benched: false, notCalled: minutes === 0, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: minutes ? [{ from: 0, to: minutes }] : [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra }) as Row;
const J1: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  rival: "Orduña fc",
  home: true,
  date: Date.UTC(2026, 9, 18, 17),
  duration: 50,
  status: "finished",
  goalsFor: 1,
  goalsAgainst: 8,
  starters: ["evans", "jordi"],
  events: [{ id: "e1", type: "goal", minute: 43, playerId: "alcides" } as never],
  ledger: { evans: row(50), jordi: row(40), alcides: row(43, { goals: 1 }), kevin: row(0) },
};
const PLAYERS = [P("evans", 1, { birthDate: "1991-03-14", height: 186, weight: 84 }), P("alcides", 7, { birthDate: "1998-11-03" }), P("jordi", 28, { birthDate: "2004-12-28", height: 178, weight: 80 }), P("kevin", 11)];
const NOW = Date.UTC(2026, 9, 22, 10);
const SEASONS = [{ id: "t1", name: "Temporada 1" }];

function squad(): Squad {
  const cur = periodCtx(PLAYERS, [J1], "t1", SEASONS, new Map(), NOW, []);
  const roster = PLAYERS.map((p) => toPlayer(p, "t1", SEASONS)).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  return { ids: roster.map((p) => p.id), by: new Map(roster.map((p) => [p.id, p])), seasonId: "t1", seasonName: "Temporada 1", now: NOW, captain: null, matches: [J1], seasons: SEASONS, cur, jornadaOf: (id) => cur.jornada.get(id), seasonCtx: () => cur };
}
const ST: ViewState = { screen: "home", focus: null, sec: "ficha", period: "cur", duelA: "evans", duelB: "jordi", pick: null, alFilter: "todos", kit: "home", orden: "dorsal", q: "", bdayOpen: false, numOpen: false, anCat: "pases", anNotes: false, adnSel: null, radarVs: "media", turned: false, flip: false, run: 0, flyHome: null, said: "" };
const FAN: Who = { quien: "fan", member: false, admin: false, me: null };
const DAY: DayInput = { stage: null, match: null, minute: null, score: null, live: new Map(), rsvp: null, mesa: [], mvp: [], last: J1, next: null };

describe("the ficha", () => {
  const p = toPlayer(PLAYERS[2], "t1", SEASONS);
  it("reads his birthday, age, sign and height as the boards", () => {
    expect(p.name).toBe("Jordi");
    expect(p.shirt).toBe("JORDI");
    expect(age(p, NOW)).toBe(21);
    expect(birthday(p, NOW)).toMatchObject({ label: "28 dic", turns: 22 });
    expect(sign(p)).toBe("Capricornio");
    expect(heightText(p.h)).toBe("1,78 m");
    expect(missing(toPlayer(PLAYERS[1], "t1", SEASONS))).toEqual(["altura", "peso"]);
  });
});

describe("the season", () => {
  const S = squad();
  it("sums each one's acta", () => {
    expect(stats("alcides", S.cur)).toMatchObject({ pj: 1, g: 1, min: 43, goalMin: [0, 0, 0, 0, 1] });
    // (an acta that knows the minutes: 0′ for whoever did not play, never «—»)
    expect(stats("kevin", S.cur)).toMatchObject({ pj: 0, min: 0, nc: 1 });
    expect(adn("jordi", S.cur)[0]).toMatchObject({ j: 1, res: "P", sc: "1–8", on: true, min: 40 });
  });
  it("hangs the last match's words on the percha", () => {
    const lines = matchLines(S, DAY);
    expect(lines.get("alcides")).toMatchObject({ status: "Jugó 43′", tone: "is-on", tags: [{ cls: "vd-tag--gol", text: "Gol 43′" }] });
    expect(lines.get("kevin")).toMatchObject({ status: "No convocado", tone: "is-off" });
    const rv = railView(S, ST, FAN, lines, null);
    expect(rv.rail.map((h) => h.id)).toEqual(["evans", "alcides", "kevin", "jordi"]);
    expect(rv.percha.hint).toBe("4 camisetas · toca una para abrir su ficha");
  });
  it("says the debut in the lede and the podium", () => {
    expect(ledeView(S, DAY, false, false).l).toBe("Los 4 de la Temporada 1. Tres jugaron el debut contra Orduña fc (1–8).");
    const h = homeView(S, ST, FAN, DAY, matchLines(S, DAY));
    expect(h.pi.title).toBe("Alcides, Pichichi: 1 gol.");
    expect(h.eq.sum[3]).toEqual({ v: "2", t: "fichas por completar" });
  });
  it("compares two players row by row", () => {
    const d = duelView(S, ST);
    expect(d.rows.find((r) => r.t === "Altura")).toMatchObject({ av: "1,86 m", bv: "1,78 m", aw: "is-win" });
    expect(d.verdict).toContain("Evans le saca 8 cm a Jordi.");
  });
});
