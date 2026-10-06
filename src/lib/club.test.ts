import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { classifieds, extraTrophies, historyTrain, mapsUrl, squadNumbers, sponsorWall } from "./club";

const match = (id: string, day: number, status = "finished"): ClubMatch => ({ id, rival: "Accept", date: Date.UTC(2026, 8, day), status: status as ClubMatch["status"], goalsFor: 3, goalsAgainst: 2, events: [] });

describe("El tren de la historia", () => {
  it("keeps the admin's order and adds the first match of the archive last", () => {
    const stops = historyTrain(
      [
        { year: "2024", title: "Fundación", text: "" },
        { year: "2019", title: "Primer balón", text: "x" },
      ],
      [match("b", 20), match("a", 10), match("c", 30, "scheduled")],
    );
    expect(stops.map((s) => s.title)).toEqual(["Fundación", "Primer balón", "El primer partido de nuestro archivo"]);
    expect(stops[2]).toMatchObject({ year: "2026", match: { id: "a" } });
  });
  it("empty milestones and no matches → nothing to show", () => {
    expect(historyTrain([], [])).toEqual([]);
    expect(historyTrain([{ year: "", title: "", text: "" }], [])).toEqual([]);
  });
});

describe("La plantilla en números", () => {
  it("counts lines, keeps unknown positions apart and averages known ages", () => {
    const n = squadNumbers(
      [
        { id: "1", naturalPosition: "POR", birthDate: "2000-01-01" },
        { id: "2", naturalPosition: "del", birthDate: "1990-06-15" },
        { id: "3", naturalPosition: "DEL" },
        { id: "4" },
      ],
      new Date("2026-10-06T12:00:00Z"),
    );
    expect(n).toMatchObject({ size: 4, byZone: { POR: 1, DEF: 0, MED: 0, DEL: 2 }, other: 1, averageAge: 31, agesKnown: 2 });
  });
});

describe("Clasificados, mecenas y campo", () => {
  it("each ad mails with its own subject, only with a valid email", () => {
    const ads = classifieds("club@piti.es");
    expect(ads.map((a) => a.wanted)).toEqual(["SE BUSCA RIVAL", "SE BUSCA JUGADOR", "SE BUSCAN MECENAS"]);
    expect(ads[1].href).toBe("mailto:club@piti.es?subject=Un%20lugar%20en%20el%20equipo");
    expect(classifieds("").every((a) => !a.href)).toBe(true);
    expect(classifieds("no-es-un-correo").every((a) => !a.href)).toBe(true);
  });
  it("sponsors without a name are dropped and only https links survive", () => {
    expect(
      sponsorWall([
        { name: "Bar Paco", url: "https://bar.example", logo: "http://x/logo.png" },
        { name: "", url: "https://y", logo: "" },
      ]),
    ).toEqual([{ name: "Bar Paco", url: "https://bar.example", logo: undefined }]);
  });
  it("maps link searches the venue", () => {
    expect(mapsUrl("Campo de La Elipa, Madrid")).toBe("https://www.google.com/maps/search/?api=1&query=Campo%20de%20La%20Elipa%2C%20Madrid");
  });
});

describe("Sala de trofeos: piezas extra", () => {
  it("first hat-trick and first clean sheet, in date order", () => {
    const g = (id: string, ga: number, scorers: string[]): ClubMatch => ({ id, rival: "R" + id, goalsFor: scorers.length, goalsAgainst: ga, status: "finished", events: scorers.map((p, i) => ({ id: id + i, type: "goal", minute: i + 1, playerId: p })) });
    const t = extraTrophies([g("1", 2, ["a", "b"]), g("2", 0, ["a", "a", "a"]), g("3", 0, ["b", "b", "b"])], (id) => id.toUpperCase());
    expect(t.map((x) => [x.kicker, x.title, x.detail, x.earned])).toEqual([
      ["Hat-trick", "A", "ante R2", true],
      ["Portería a cero", "3–0", "ante R2", true],
    ]);
    expect(extraTrophies([], (id) => id).every((x) => !x.earned)).toBe(true);
  });
});
