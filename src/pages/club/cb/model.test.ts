import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import { seasonStrip } from "../../../lib/derived/vidrio/strip";
import { birthdaysOf, bdayWhen, defaultPiece, doorLineOf, historiaLive, lensOf, lineOf, nextLine, piecesOf, rsvpLine, seasonFrom, vasLine } from "./model";
import { clubScreenOf } from "./nav";

// Production's Temporada 1 as the CL- boards draw it («Real»): J1 lost 1–8 at home to Orduña fc, the goal of
// Alcides in the 43′, then J2 away at Pitutis on Sunday 25 at 14:00 and J3 at home to Red Demons.
const SEASON = "t1";
const at = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 });
const NOW = Date.parse("2026-10-22T10:00:00Z");
const j1: ClubMatch = {
  id: "j1",
  seasonId: SEASON,
  rival: "Orduña fc",
  home: true,
  venue: "CDM PALOMERAS",
  status: "finished",
  date: at("2026-10-18T17:00:00Z"),
  goalsFor: 1,
  goalsAgainst: 8,
  events: [
    { id: "e1", type: "opponent_goal", minute: 2, period: 1, team: "opponent" },
    { id: "e2", type: "goal", minute: 43, period: 2, team: "us", playerId: "alcides" },
  ],
  ledger: {
    alcides: { minutes: 50, played: true, started: true },
    evans: { minutes: 50, played: true, started: true },
    kevin: { minutes: 0, played: false, started: false },
  },
} as unknown as ClubMatch;
const j2 = { id: "j2", seasonId: SEASON, rival: "Pitutis", home: false, status: "scheduled", date: at("2026-10-25T13:00:00Z") } as unknown as ClubMatch;
const j3 = { id: "j3", seasonId: SEASON, rival: "Red Demons", home: true, status: "scheduled", date: at("2026-11-08T17:00:00Z") } as unknown as ClubMatch;
const S = seasonFrom("Temporada 1", seasonStrip([j1, j2, j3], SEASON, NOW).segments, null);
const NAMES: Record<string, string> = { alcides: "Alcides", evans: "Evans", kevin: "Kevin" };
const pieces = piecesOf({ season: S, nameOf: (id) => NAMES[id] ?? id, squad: new Set(Object.keys(NAMES)) });

describe("the season as jornadas", () => {
  it("numbers the jornadas, scores the played one and counts it", () => {
    expect(S.jornadas.map((x) => [x.j, x.code, x.date, x.time])).toEqual([
      [1, "ORD", "Dom 18 oct", "19:00"],
      [2, "PIT", "Dom 25 oct", "14:00"],
      [3, "RED", "Dom 8 nov", "18:00"],
    ]);
    expect(S.played).toBe(1);
    expect([S.jornadas[0].gf, S.jornadas[0].ga]).toEqual([1, 8]);
  });
  it("tells the next match in the boards' words", () => {
    expect(nextLine(S.jornadas[1], NOW)).toBe("J2 · En casa de Pitutis, domingo 25 a las 14:00");
    expect(rsvpLine(S.jornadas[1], NOW)).toBe("J2 · En casa de Pitutis · domingo 25, 14:00");
    expect(vasLine(S.jornadas[1], NOW)).toBe("¿Vas a Pitutis el domingo?");
    expect(nextLine(S.jornadas[2], NOW)).toBe("J3 · Red Demons, en casa, domingo 8 de noviembre a las 18:00");
    expect(historiaLive(S)).toBe("J1 · P 1–8 · sin tabla todavía");
  });
});

describe("the vitrina's pieces", () => {
  it("the crest first, then what the J1 won (its goal first), then what is still to win, the cup last", () => {
    expect(pieces.map((p) => p.id)).toEqual(["escudo", "primer-gol", "primer-partido", "debut", "pichichi", "record", "primera-victoria", "asistencias", "porteria-a-cero", "hat-trick", "primera-copa"]);
    const gol = pieces[1];
    expect([gol.title, gol.detail, gol.date, gol.match, gol.note]).toEqual(["Alcides", "ante Orduña fc, en el 43′", "Domingo 18 de octubre", "J1", "El gol de la honra en una tarde dura: el primero del archivo."]);
    expect(pieces.find((p) => p.id === "debut")?.title).toBe("Los 2");
    expect(pieces.find((p) => p.id === "record")?.title).toBe("1 gol");
    expect(pieces.find((p) => p.id === "primera-victoria")?.at).toBeNull();
    expect(defaultPiece(pieces)).toBe("primer-gol");
  });
  it("before the first match only the crest is in the case", () => {
    const pre = seasonFrom("Temporada 1", seasonStrip([{ ...j1, status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, events: [] } as ClubMatch], SEASON, Date.parse("2026-10-15T10:00:00Z")).segments, null);
    const ps = piecesOf({ season: pre, nameOf: (id) => id, squad: new Set() });
    expect(ps.filter((p) => p.at !== null).map((p) => p.id)).toEqual(["escudo"]);
    expect(defaultPiece(ps)).toBe("escudo");
  });
});

describe("la línea del club", () => {
  it("a bead per jornada with its letter, the pieces above the J1 and the head on today", () => {
    const line = lineOf(S, pieces, 1, false);
    expect(line.beads.map((b) => b.cls)).toEqual(["is-p is-at", "is-next", "is-next"]);
    expect(line.beads[0].letter).toBe("P");
    expect(line.marks).toHaveLength(1);
    expect(line.marks[0].label).toBe("J1: 6 piezas para la vitrina");
    expect(line.tip).toBe("J1 · P 1–8 · ORD");
    expect(lensOf(S, pieces, 0).counts.map((c) => c.v)).toEqual([0, 0, 0, 1]);
    expect(lensOf(S, pieces, 1).counts.map((c) => c.v)).toEqual([1, 0, 1, 6]);
  });
  it("La historia's door shows the jornadas played and to come", () => {
    expect(doorLineOf(S).jj.map((x) => `${x.t} ${x.s}`)).toEqual(["J1 P 1–8", "J2 25 oct", "J3 8 nov"]);
  });
});

describe("birthdays (30 days, Inicio's rule)", () => {
  it("soonest first, with the age they turn and the day in words", () => {
    const b = birthdaysOf(
      [
        { id: "h", name: "Huberoski", full: "Hubert Kurdziel", num: "14", birthDate: "2004-10-27" },
        { id: "e", name: "Eguzquiza", full: "Miguel Eguzquiza Fernández", num: "22", birthDate: "2004-11-06" },
        { id: "k", name: "Kevin", full: "Kevin Jumbo Merino", num: "11", birthDate: "2004-01-15" },
        { id: "x", name: "Sin fecha", full: "", num: "" },
      ],
      NOW,
    );
    expect(b.map((x) => [x.id, x.days, x.age])).toEqual([
      ["h", 5, 22],
      ["e", 15, 22],
      ["k", 85, 22],
    ]);
    expect(bdayWhen(b[0], NOW)).toBe("el martes 27");
    expect(bdayWhen(b[1], NOW)).toBe("el viernes 6 de noviembre");
  });
});

describe("the club's addresses", () => {
  it("each screen, a piece in focus, and the vestuario as the fourth room", () => {
    expect(clubScreenOf("/club")).toEqual({ sala: "hub", pieza: null });
    expect(clubScreenOf("/club/vitrina")).toEqual({ sala: "hub", pieza: null });
    expect(clubScreenOf("/club/vitrina/escudo")).toEqual({ sala: "hub", pieza: "escudo" });
    expect(clubScreenOf("/club/vitrina/nada")).toEqual({ sala: "hub", pieza: null });
    expect(clubScreenOf("/club/historia/")).toEqual({ sala: "historia", pieza: null });
    expect(clubScreenOf("/club/equipo/camiseta")).toEqual({ sala: "camiseta", pieza: null });
    expect(clubScreenOf("/club/gente")).toEqual({ sala: "gente", pieza: null });
    expect(clubScreenOf("/vestuario/caja")).toEqual({ sala: "vestuario", pieza: null });
  });
});
