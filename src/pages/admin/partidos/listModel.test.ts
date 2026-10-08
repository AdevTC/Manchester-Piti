import { describe, expect, it, vi } from "vitest";
import { adminFixture, NOW } from "../../../test/adminKit";
import type { AdminMatch } from "../data/adminLogic";
import { buildMatchList, matchesQuery, returnOf, upcomingMatches } from "./listModel";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));

const data = adminFixture();
const ctx = { stateOf: data.stateOf, reviewOf: data.reviewOf, rosterIds: () => data.roster.map((p) => p.id) };
const m = (id: string) => data.matches.find((x) => x.id === id) as AdminMatch;

describe("the match list", () => {
  it("groups Por hacer / Publicados / Por jugar with counts and words", () => {
    const list = buildMatchList(data.matches, ctx, "todo", "");
    expect(list.counts).toEqual({ todo: 3, hacer: 2, publicados: 1, jugar: 0 });
    expect(list.groups.map((g) => [g.title, g.rows.map((r) => r.id)])).toEqual([
      ["Por hacer", ["m7", "m8"]],
      ["Publicados", ["m6"]],
    ]);
    const [j7, j8] = list.groups[0].rows;
    expect(j7).toMatchObject({ j: "J2", day: "1 nov", rival: "FUSION 7", score: "3–1", dim: false, where: "En casa", chip: { tone: "warn", text: "Borrador · falta 1 goleador" } });
    expect(j8).toMatchObject({ j: "J3", day: "8 nov", score: "12:00", dim: true, where: "Fuera", chip: { tone: "sky", icon: "clock", text: "Próximo · 3 sin convocar" } });
    expect(list.groups[1].rows[0]).toMatchObject({ j: "J1", score: "4–1", chip: { tone: "ok", text: "Publicada" } });
    expect(j7.aria).toBe("Jornada 2, FUSION 7, Borrador · falta 1 goleador, 3–1");
  });
  it("filters and searches by rival or jornada", () => {
    expect(buildMatchList(data.matches, ctx, "publicados", "").groups.map((g) => g.title)).toEqual(["Publicados"]);
    expect(buildMatchList(data.matches, ctx, "jugar", "").groups).toEqual([]);
    expect(matchesQuery(m("m7"), "fusi")).toBe(true);
    expect(matchesQuery(m("m7"), "J2")).toBe(true);
    expect(matchesQuery(m("m7"), "j 2")).toBe(true);
    expect(matchesQuery(m("m7"), "2")).toBe(true);
    expect(matchesQuery(m("m7"), "J3")).toBe(false);
    expect(matchesQuery(m("m6"), "emirates")).toBe(true);
    expect(buildMatchList(data.matches, ctx, "todo", "zzz").groups).toEqual([]);
  });
  it("a draft that squares, an acta to do, cancelled and postponed matches", () => {
    const done: AdminMatch = { ...m("m7"), events: [...(m("m7").events ?? []), { id: "g3", type: "goal", minute: 46, playerId: "huberoski" }] };
    expect(buildMatchList([done], ctx, "todo", "").groups[0].rows[0].chip.text).toBe("Borrador · cuadra");
    const acta: AdminMatch = { ...m("m6"), id: "x", status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, date: NOW - 30 * 60_000, draft: false };
    const row = buildMatchList([acta], { ...ctx, stateOf: () => "acta" }, "todo", "").groups[0];
    expect(row.title).toBe("Por hacer");
    expect(row.rows[0].chip).toMatchObject({ tone: "warn", text: "Acta por hacer" });
    expect(buildMatchList([m("m6")], { ...ctx, stateOf: () => "cancelled" }, "todo", "").groups[0]).toMatchObject({ title: "Publicados", rows: [{ chip: { text: "Cancelado", icon: "x" } }] });
    expect(buildMatchList([m("m8")], { ...ctx, stateOf: () => "postponed" }, "todo", "").groups[0]).toMatchObject({ title: "Por jugar", rows: [{ chip: { text: "Aplazado" } }] });
  });
  it("knows the return match", () => {
    expect(returnOf(data.matches, "t1", "  emirates ", NOW)).toMatchObject({ match: { id: "m6" }, played: true });
    expect(returnOf(data.matches, "t1", "Mad Sky", NOW)).toMatchObject({ match: { id: "m8" }, played: false });
    expect(returnOf(data.matches, "t1", "Nuevo", NOW)).toBeNull();
    expect(returnOf(data.matches, "t0", "Emirates", NOW)).toBeNull();
  });
  it("Convocatorias offers the next matches to play (and the one asked for)", () => {
    expect(upcomingMatches(data.matches, NOW).map((x) => x.id)).toEqual(["m8"]);
    expect(upcomingMatches(data.matches, NOW, "m7").map((x) => x.id)).toEqual(["m7", "m8"]);
  });
});
