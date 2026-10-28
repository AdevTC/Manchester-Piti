import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../../../lib/clubData";
import { accountWords, birthdayOf, gapLine, gapWords, guestLine, guestRows, lineWords, nobodyCites, seasonNums, shirtFromName } from "./model";

const NOW = Date.UTC(2026, 10, 2, 9, 0); // Monday 2 Nov 2026, Madrid

describe("plantilla · the words of the board", () => {
  it("what a ficha lacks, in the row and in the ficha", () => {
    expect(gapWords([])).toBe("ficha completa");
    expect(gapWords(["foto"])).toBe("falta la foto");
    expect(gapWords(["foto", "alt", "peso"])).toBe("faltan foto, altura y peso");
    expect(gapLine(["foto", "alt", "peso"])).toBe("Le faltan foto, altura y peso");
    expect(gapLine([])).toBe("Ficha completa");
  });
  it("a row's line and account", () => {
    expect(lineWords({ position: "DEF", pref: "LD" })).toBe("Defensa · LD");
    expect(lineWords({ position: "", pref: null })).toBe("Sin posición");
    expect(accountWords({ account: "vinculada", who: "erik9" })).toBe("@erik9");
    expect(accountWords({ account: "pide", who: "x" })).toBe("Pide su ficha");
    expect(accountWords({ account: "fuera", who: "viejo" })).toBe("@viejo · fuera");
    expect(accountWords({ account: "sin", who: "" })).toBe("Sin cuenta");
  });
  it("birthdays in Madrid days", () => {
    expect(birthdayOf("2004-11-02", NOW)).toEqual({ days: 0, age: 22, when: "hoy" });
    expect(birthdayOf("2004-11-03", NOW)).toMatchObject({ days: 1, when: "mañana" });
    expect(birthdayOf("2004-11-06", NOW)).toMatchObject({ days: 4, age: 22, when: "el vie 6 nov" });
    expect(birthdayOf("2004-11-01", NOW)?.days).toBe(364);
    expect(birthdayOf(undefined, NOW)).toBeNull();
  });
  it("his cards of the season's published actas", () => {
    const m = (id: string, seasonId: string, events: ClubMatch["events"]): ClubMatch => ({ id, seasonId, status: "finished", events });
    const games = [m("a", "t1", [{ id: "1", type: "yellow_card", playerId: "p" }, { id: "2", type: "double_yellow", playerId: "p" }]), m("b", "t0", [{ id: "3", type: "red_card", playerId: "p" }])];
    expect(seasonNums("p", games, "t1").cards).toBe(3);
  });
  it("B-CLUB-05: a ficha can be deleted only when nobody cites it", () => {
    const ms: ClubMatch[] = [{ id: "a", starters: ["x"], bench: ["y"], events: [{ id: "e", type: "goal", playerId: "z", assistPlayerId: "w" }] }];
    for (const id of ["x", "y", "z", "w"]) expect(nobodyCites({ id }, ms, "sin")).toBe(false);
    expect(nobodyCites({ id: "nadie" }, ms, "sin")).toBe(true);
    expect(nobodyCites({ id: "nadie" }, ms, "vinculada")).toBe(false);
  });
  it("M-41: the guests, one per name, with their matches", () => {
    const ms = [
      { id: "m1", date: 1, jornada: 1, guests: [{ id: "g1", name: "Rafa" }] },
      { id: "m2", date: 2, jornada: 3, guests: [{ id: "g2", name: "RAFA " }, { id: "g1", name: "Óscar" }] },
    ] as unknown as (ClubMatch & { jornada: number })[];
    const g = guestRows(ms);
    expect(g.map((x) => [x.name, x.matches.map((m) => `${m.matchId}:${m.guestId}`)])).toEqual([
      ["Rafa", ["m1:g1", "m2:g2"]],
      ["Óscar", ["m2:g1"]],
    ]);
    expect(guestLine(g[0])).toBe("Vino de invitado 2 veces · J1, J3");
    expect(shirtFromName("Rafael Martínez Ruiz")).toBe("RAFAEL MARTÍ");
  });
});
