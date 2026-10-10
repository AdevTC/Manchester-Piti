import { describe, expect, it, vi } from "vitest";
import { adminFixture, NOW } from "../../../test/adminKit";
import type { AdminMatch } from "../data/adminLogic";
import { buildMatchList, defaultMatch, matchesQuery, returnOf, type ListContext } from "./listModel";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));

const data = adminFixture();
const ctx: ListContext = { now: NOW, whistled: new Set(), nextId: data.next?.match.id, reviewOf: data.reviewOf };
const m = (id: string) => data.matches.find((x) => x.id === id) as AdminMatch;
const HOUR = 3600_000;

describe("the match list", () => {
  it("groups Por hacer / Por jugar / Publicados, in that order, with only the exceptions under the rival", () => {
    const list = buildMatchList(data.matches, ctx, "todo", "");
    expect(list.counts).toEqual({ todo: 3, hacer: 1, jugar: 1, publicados: 1 });
    expect(list.groups.map((g) => [g.title, g.rows.map((r) => r.id)])).toEqual([
      ["Por hacer", ["m7"]],
      ["Por jugar", ["m8"]],
      ["Publicados", ["m6"]],
    ]);
    const [[j7], [j8], [j6]] = list.groups.map((g) => g.rows);
    expect(j7).toMatchObject({ j: "J2", day: "1 nov", rival: "FUSION 7", sub: "Falta 1 goleador", warn: true, score: { gf: 3, ga: 1, r: "V" } });
    expect(j8).toMatchObject({ j: "J3", day: "8 nov", rival: "MAD SKY", sub: "Convocatoria 6 de 7", warn: true, score: null, time: "12:00" });
    expect(j6).toMatchObject({ j: "J1", sub: "en casa", warn: false, score: { gf: 4, ga: 1, r: "V" } });
    expect(j7.aria).toBe("J2, FUSION 7, Falta 1 goleador, Victoria 3–1");
    expect(j8.aria).toBe("J3, MAD SKY, Convocatoria 6 de 7, 12:00");
  });

  it("an acta that squares says «Sin publicar»; a live match «En juego»; a draft-only match to play «Sin publicar»", () => {
    const done: AdminMatch = { ...m("m7"), events: [...(m("m7").events ?? []), { id: "g3", type: "goal", minute: 46, playerId: "huberoski" }] };
    expect(buildMatchList([done], ctx, "todo", "").groups[0].rows[0]).toMatchObject({ sub: "Sin publicar", warn: true });
    const live: AdminMatch = { ...m("m8"), date: NOW - 20 * 60_000, events: [{ id: "e1", type: "opponent_goal", minute: 4 }] };
    const g = buildMatchList([live], ctx, "todo", "").groups[0];
    expect(g.title).toBe("Por hacer");
    expect(g.rows[0]).toMatchObject({ sub: "En juego", warn: true, score: { gf: 0, ga: 1, r: "D" } });
    // whistled on this device: the acta is to do
    expect(buildMatchList([live], { ...ctx, whistled: new Set(["m8"]) }, "todo", "").groups[0].rows[0].sub).toBe("Sin publicar");
    const draftOnly: AdminMatch = { ...m("m8"), id: "n1", published: false, draft: true };
    expect(buildMatchList([draftOnly], ctx, "todo", "").groups[0].rows[0]).toMatchObject({ sub: "Sin publicar", warn: true });
    // the convocatoria counts for the next match only
    expect(buildMatchList([m("m8")], { ...ctx, nextId: null }, "todo", "").groups[0].rows[0]).toMatchObject({ sub: "fuera", warn: false });
  });

  it("cancelled → Publicados, postponed → Por jugar, both without amber", () => {
    expect(buildMatchList([{ ...m("m8"), status: "cancelled" }], ctx, "todo", "").groups[0]).toMatchObject({ title: "Publicados", rows: [{ sub: "Cancelado", warn: false, score: null }] });
    expect(buildMatchList([{ ...m("m6"), status: "postponed", goalsFor: undefined, goalsAgainst: undefined }], ctx, "todo", "").groups[0]).toMatchObject({ title: "Por jugar", rows: [{ sub: "Aplazado", warn: false }] });
  });

  it("filters and searches by rival or jornada", () => {
    expect(buildMatchList(data.matches, ctx, "publicados", "").groups.map((g) => g.title)).toEqual(["Publicados"]);
    expect(buildMatchList(data.matches, ctx, "jugar", "").groups.map((g) => g.title)).toEqual(["Por jugar"]);
    expect(matchesQuery(m("m7"), "fusi")).toBe(true);
    expect(matchesQuery(m("m7"), "J2")).toBe(true);
    expect(matchesQuery(m("m7"), "j 2")).toBe(true);
    expect(matchesQuery(m("m7"), "2")).toBe(true);
    expect(matchesQuery(m("m7"), "J3")).toBe(false);
    expect(matchesQuery(m("m6"), "emirates")).toBe(true);
    expect(buildMatchList(data.matches, ctx, "todo", "zzz").groups).toEqual([]);
  });

  it("the desktop opens the first match to do, else the next one", () => {
    expect(defaultMatch(data.matches, ctx)?.id).toBe("m7");
    expect(defaultMatch(data.matches.filter((x) => x.id !== "m7"), ctx)?.id).toBe("m8");
    expect(defaultMatch([m("m6")], ctx)?.id).toBe("m6");
    expect(defaultMatch([], ctx)).toBeNull();
    expect(defaultMatch([m("m8")], { ...ctx, now: NOW + 7 * 24 * HOUR })?.id).toBe("m8");
  });

  it("knows the return match", () => {
    expect(returnOf(data.matches, "t1", "  emirates ", NOW)).toMatchObject({ match: { id: "m6" }, played: true });
    expect(returnOf(data.matches, "t1", "Mad Sky", NOW)).toMatchObject({ match: { id: "m8" }, played: false });
    expect(returnOf(data.matches, "t1", "Nuevo", NOW)).toBeNull();
    expect(returnOf(data.matches, "t0", "Emirates", NOW)).toBeNull();
  });

});
