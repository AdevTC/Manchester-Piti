import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../clubData";
import { birthdayLine, vitrinaPieces } from "./vitrinaLive";

const KO = Date.UTC(2026, 9, 18, 17); // Sunday 18 Oct 2026, 19:00 Madrid
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });
const j1: ClubMatch = { id: "j1", seasonId: "t1", version: 2, status: "scheduled", rival: "Orduña fc", date: ts(KO), duration: 50, home: true, starters: ["a", "b"], bench: [], events: [] };
const base = { matches: [j1], seasonId: "t1", now: KO, founded: "2026", location: "Palomeras", milestones: [] };

describe("vitrinaPieces", () => {
  it("before kick-off: the foundation, tonight's slot at its time, the cup still to come", () => {
    const v = vitrinaPieces({ ...base, now: KO - 3_600_000, day: { phase: "antes", match: j1, minute: null, score: null, jornada: 1, next: null } });
    expect(v.top.map((p) => [p.title, p.sub])).toEqual([
      ["La fundación", "Palomeras, 2026"],
      ["Jornada 1", "Hoy, contra Orduña fc"],
      ["La primera copa", "Aquí irá"],
    ]);
    expect(v.top[1]).toMatchObject({ score: "19:00", live: true });
    expect(v.bottom[0]).toMatchObject({ title: "Primera victoria", sub: "Aquí irá", empty: true });
  });

  it("while it is played: the score and the minute; the first victory «Se juega ahora»; the debut comes with the acta", () => {
    const v = vitrinaPieces({ ...base, day: { phase: "directo1", match: j1, minute: 23, score: { gf: 2, ga: 1 }, jornada: 1, next: null } });
    expect(v.top[1]).toMatchObject({ score: "2–1", sub: "2–1, minuto 23" });
    expect(v.bottom[0].sub).toBe("Se juega ahora");
    expect(v.bottom[2]).toMatchObject({ title: "Logro «Debut»", sub: "Llega con el acta" });
  });

  it("after the win: the ball on the shelf", () => {
    const won: ClubMatch = { ...j1, status: "finished", goalsFor: 3, goalsAgainst: 1 };
    const v = vitrinaPieces({ ...base, matches: [won], now: KO + 7_200_000, day: { phase: "acta", match: won, minute: null, score: { gf: 3, ga: 1 }, jornada: 1, next: null } });
    expect(v.top[1].sub).toBe("Final, 3–1");
    expect(v.bottom[0]).toMatchObject({ art: "ball", sub: "3–1 a Orduña fc" });
  });
});

describe("birthdayLine", () => {
  it("the next birthday, and the match after it", () => {
    const j2: ClubMatch = { ...j1, id: "j2", date: ts(Date.UTC(2026, 9, 28, 17)) };
    expect(birthdayLine([{ name: "Huberoski", birthDate: "1995-10-27" }, { name: "Nadie" }], [j1, j2], (id) => (id === "j2" ? 2 : 1), KO)).toBe("Huberoski cumple 31 el martes 27. Tarta en el vestuario después de la J2.");
  });
  it("nothing near: no line", () => {
    expect(birthdayLine([{ name: "Huberoski", birthDate: "1995-03-01" }], [], () => null, KO)).toBeNull();
  });
});
