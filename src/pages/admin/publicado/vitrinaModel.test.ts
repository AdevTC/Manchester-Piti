import { describe, expect, it, vi } from "vitest";
import { adminFixture, fixturePlayers, NOW } from "../../../test/adminKit";
import type { AdminMatch } from "../data/adminLogic";
import { shelfLabelOf, stickersOf, vitrinaOf } from "./vitrinaModel";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));

const data = adminFixture();
const m = (id: string) => data.matches.find((x) => x.id === id) as AdminMatch;
const byId = new Map(fixturePlayers.map((p) => [p.id, p]));
const nameOf = (id: string) => byId.get(id)?.shirtName ?? id;
const numberOf = (id: string) => String(byId.get(id)?.number ?? "");
const base = { matches: data.matches, seasonName: "Temporada 1", now: NOW, whistled: new Set<string>(), nameOf, numberOf };

describe("the publish peak's vitrina", () => {
  it("the plaque, the seven with their stickers, the scorers for the cartel and the open MVP", () => {
    const j2: AdminMatch = { ...m("m7"), events: [...(m("m7").events ?? []), { id: "y", type: "yellow_card", minute: 22, playerId: "eguzquiza" }, { id: "r", type: "red_card", minute: 40, playerId: "tello" }] };
    const v = vitrinaOf({ ...base, match: j2 });
    expect(v).toMatchObject({ j: "J2", rival: "FUSION 7", gf: 3, ga: 1, r: "V", date: "1 nov", where: "en casa", shelfLabel: "Vitrina T1", scorers: "ADRIÁN T.C." });
    expect(v.seven.map((p) => [p.num, p.name, p.stickers])).toEqual([
      ["1", "EVANS", []],
      ["4", "ILLESCAS", []],
      ["20", "TELLO", ["red"]],
      ["8", "EGUZQUIZA", ["yellow"]],
      ["14", "HUBEROSKI", []],
      ["9", "ERIK", []],
      ["10", "ADRIÁN T.C.", ["goal", "goal"]],
    ]);
    expect(v.mvp).toEqual({ title: "MVP abierto · 48 h", detail: "Votan los socios hasta el miércoles, 10:00" });
  });

  it("the shelf: published actas as V/E/D, this one popping in, the season only and up to this match", () => {
    const v = vitrinaOf({ ...base, match: m("m7") });
    expect(v.shelf).toEqual([
      { id: "m6", r: "V", fresh: false, aria: "J1 victoria" },
      { id: "m7", r: "V", fresh: true, aria: "J2 victoria" },
    ]);
    // a later acta still unpublished stays as a gap when correcting an earlier one… and is left out before it
    const later: AdminMatch = { ...m("m8"), date: NOW - 3600_000, status: "finished", goalsFor: 1, goalsAgainst: 1 };
    const withLater = [...data.matches.filter((x) => x.id !== "m8"), later];
    expect(vitrinaOf({ ...base, matches: withLater, match: later }).shelf.map((x) => [x.id, x.r])).toEqual([
      ["m6", "V"],
      ["m7", null],
      ["m8", "E"],
    ]);
    expect(vitrinaOf({ ...base, matches: withLater, match: m("m6") }).shelf.map((x) => x.id)).toEqual(["m6"]);
  });

  it("a closed vote says so", () => {
    const v = vitrinaOf({ ...base, match: m("m6"), closedMvp: "Votación cerrada · ganó ERIK con 6 votos." });
    expect(v.mvp).toEqual({ title: "MVP cerrado", detail: "Votación cerrada · ganó ERIK con 6 votos." });
  });

  it("stickers and the shelf's label", () => {
    expect(stickersOf("a", [{ id: "1", type: "goal_penalty", minute: 3, playerId: "a" }, { id: "2", type: "double_yellow", minute: 9, playerId: "a" }, { id: "3", type: "goal", minute: 9, playerId: "b" }])).toEqual(["goal", "red"]);
    expect(shelfLabelOf("Temporada 2")).toBe("Vitrina T2");
    expect(shelfLabelOf("Liga de invierno")).toBe("Vitrina Liga de invierno");
  });
});
