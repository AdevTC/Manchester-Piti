import { describe, expect, it } from "vitest";
import type { Lineup } from "../formations";
import { dataToLineupDoc, extractLineup, lineupToData } from "../lineupDoc";
import { lineupAt } from "./cambios";
import { galonesOf } from "./model";
import { normalize, place, toBench, toggleRole } from "./ops";
import { effectiveTaker, migrateTakers, orderTxt, rolesFor, setTaker, takerPlaces, takersOf, toggleFirst } from "./takers";
import { demoSquad, lineupOf } from "./testkit";

// Los lanzadores en orden: the first of each list on the pitch takes it (at the board's seven, after a
// tanda, live), the old single galones read as one-item lists, the 1º · 2º · 3º pickers.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const META = { ownerUid: "u", ownerNickname: "yo", seasonId: "t1", name: "Uno", isOfficial: false, matchId: null };
const nm = (id: string) => sq.byId.get(id)?.name ?? id;

describe("the effective taker", () => {
  it("is the first of the list on the pitch", () => {
    expect(effectiveTaker(["kevin", "adrian", "tello"], new Set(SEVEN))).toBe("adrian");
    expect(effectiveTaker(["kevin"], new Set(SEVEN))).toBeUndefined();
  });

  it("follows the tandas: at minute t, the first of the list then on the pitch", () => {
    const L = setTaker(setTaker(L7(), "penalties", "adrian", 0), "penalties", "kevin", 1);
    const subs = [{ id: "a", min: 30, out: "adrian", in: "kevin" }];
    expect(lineupAt(L, subs, 29).roles.penaltiesId).toBe("adrian");
    expect(lineupAt(L, subs, 30).roles.penaltiesId).toBe("kevin");
    expect(galonesOf(lineupAt(L, subs, 30), "kevin").map((g) => g.letter)).toEqual(["P"]);
  });

  it("on the board: benching the 1º passes the galón to the 2º, and he gets it back on his return", () => {
    let L = setTaker(setTaker(L7(), "corners", "adrian", 0), "corners", "almachi", 1);
    expect(L.roles.cornersId).toBe("adrian");
    L = toBench(L, "adrian");
    expect(L.roles.cornersId).toBe("almachi");
    expect(L.takers?.corners).toEqual(["adrian", "almachi"]);
    L = place(L, "adrian", 6);
    expect(L.roles.cornersId).toBe("adrian");
  });
});

describe("the 1º · 2º · 3º pickers", () => {
  it("puts a player at a place, moves him, takes him off by choosing his place again; three at most", () => {
    let L = setTaker(L7(), "freekicks", "tello", 0);
    L = setTaker(L, "freekicks", "adrian", 1);
    L = setTaker(L, "freekicks", "almachi", 2);
    expect(takersOf(L).freekicks).toEqual(["tello", "adrian", "almachi"]);
    L = setTaker(L, "freekicks", "almachi", 0);
    expect(takersOf(L).freekicks).toEqual(["almachi", "tello", "adrian"]);
    expect(L.roles.freekicksId).toBe("almachi");
    L = setTaker(L, "freekicks", "kevin", 1);
    expect(takersOf(L).freekicks).toEqual(["almachi", "kevin", "tello"]);
    L = setTaker(L, "freekicks", "kevin", 1);
    expect(takersOf(L).freekicks).toEqual(["almachi", "tello"]);
    expect(orderTxt(takersOf(L).freekicks, nm)).toBe("ALMACHI › TELLO");
    expect(takerPlaces(takersOf(L), "tello")).toEqual([{ kind: "freekicks", pos: 1 }]);
  });

  it("the galón tap makes him 1º (or takes him off the list); the brazalete and the vice never go together", () => {
    let L = toggleFirst(L7(), "penalties", "tello");
    expect(L.roles.penaltiesId).toBe("tello");
    L = toggleRole(L, "penaltiesId", "tello");
    expect(L.roles.penaltiesId).toBeUndefined();
    L = toggleRole(toggleRole(L, "captainId", "tello"), "viceId", "illescas");
    expect(L.roles).toMatchObject({ captainId: "tello", viceId: "illescas" });
    L = toggleRole(L, "captainId", "illescas");
    expect(L.roles.captainId).toBe("illescas");
    expect(L.roles.viceId).toBeUndefined();
  });

  it("the vice-capitán wears the brazalete only when the captain is off (a seven during the match)", () => {
    const L = { ...L7(), roles: { captainId: "kevin", viceId: "tello" } };
    expect(rolesFor(L).captainId).toBeUndefined();
    expect(rolesFor(L, true).captainId).toBe("tello");
  });
});

describe("migration", () => {
  it("an old board's single ids read as one-item lists; it is written in the new shape (and the old ids, for older apps)", () => {
    const old = { ...lineupToData(L7(), META), roles: { captainId: "tello", penaltiesId: "adrian", cornersId: "kevin" } };
    delete (old as Record<string, unknown>).takers;
    const d = dataToLineupDoc("x", old);
    expect(d.takers).toEqual({ penalties: ["adrian"], freekicks: [], corners: ["kevin"] });
    expect(d.subs).toEqual([]);
    expect(migrateTakers(null, { freekicksId: "erik" })).toEqual({ penalties: [], freekicks: ["erik"], corners: [] });
    const L = normalize(extractLineup(d), sq.list.map((c) => c.id));
    // KEVIN isn't in the seven: he keeps his place on the list, nobody takes the córners for now
    expect(L.roles).toEqual({ captainId: "tello", penaltiesId: "adrian" });
    const back = lineupToData(L, META);
    expect(back.takers).toEqual({ penalties: ["adrian"], freekicks: [], corners: ["kevin"] });
    expect(back.roles).toEqual({ captainId: "tello", penaltiesId: "adrian" });
  });

  it("the lists and the cambios go through the store and back", () => {
    let L = setTaker(setTaker(L7(), "penalties", "adrian", 0), "penalties", "kevin", 1);
    L = { ...L, roles: { ...L.roles, viceId: "illescas" }, subs: [{ id: "s1", min: 25, out: "adrian", in: "kevin" }] };
    const d = dataToLineupDoc("x", lineupToData(L, META));
    expect(d.takers?.penalties).toEqual(["adrian", "kevin"]);
    expect(d.subs).toEqual([{ id: "s1", min: 25, out: "adrian", in: "kevin" }]);
    expect(d.roles.viceId).toBe("illescas");
  });

  it("an invalid cambio or list is dropped, the board still opens", () => {
    const raw = { ...lineupToData(L7(), META), subs: [{ id: "ok", min: 20, out: "a", in: "b" }, { id: "bad", min: 0, out: "a", in: "b" }, { id: "same", min: 9, out: "a", in: "a" }], takers: { penalties: ["a", "a"] } };
    const d = dataToLineupDoc("x", raw);
    expect((d.subs ?? []).map((s) => s.id)).toEqual(["ok"]);
    expect(d.takers).toEqual({ penalties: [], freekicks: [], corners: [] });
  });
});
