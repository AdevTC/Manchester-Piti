import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { classifieds, extraTrophies, historyTrain, noPositionText, posCountText, posKey, squadByPosition, squadNumbers, sponsorWall } from "./club";

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
});

describe("Sala de trofeos: piezas extra", () => {
  it("a keeper's many goal kicks do not earn a hat-trick or hide the first real one", () => {
    const restarts: ClubMatch = { ...match("restarts", 1), events: Array.from({ length: 150 }, (_, index) => ({ id: `kick-${index}`, type: "goal_kick", playerId: "keeper", minute: index % 50 + 1 })) };
    expect(extraTrophies([restarts], id => id)[0]).toMatchObject({ title: "Por firmar", earned: false });
    const goals: ClubMatch = { ...match("real", 2), rival: "Rival real", events: (["goal", "goal_penalty", "goal_freekick"] as const).map((type, index) => ({ id: `goal-${index}`, type, playerId: "scorer", minute: index + 1 })) };
    expect(extraTrophies([restarts, goals], id => id)[0]).toMatchObject({ title: "scorer", detail: "ante Rival real", earned: true });
  });
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

describe("squadNumbers reads positions through the resolver", () => {
  it("counts words and the new field by line, the unknown apart", () => {
    const n = squadNumbers([{ id: "a", naturalPosition: "Portero" }, { id: "b", positions: { main: "LD", also: [] } }, { id: "c", naturalPosition: "Mediocentro" }, { id: "d" }], new Date("2026-10-13"));
    expect(n.byZone).toMatchObject({ POR: 1, DEF: 1, MED: 1, DEL: 0 });
    expect(n.other).toBe(1);
  });
});

describe("La plantilla por posiciones", () => {
  it("cuenta, por posición, cuántos la tienen de preferida y cuántos más en «también»", () => {
    const s = squadByPosition([
      { id: "a", positions: { main: "MC", also: ["MCD"] } },
      { id: "b", positions: { main: "MC", also: [] } },
      { id: "c", positions: { main: "MC", also: ["MI"] } },
      { id: "d", positions: { main: "MCD", also: ["MC", "MI"] } },
      { id: "e", positions: { main: null, also: ["MC"] } },
      { id: "f", naturalPosition: "Portero" },
      { id: "g" },
      { id: "h", positions: { main: null, also: [] } },
    ]);
    expect(s.byCode.MC).toEqual({ main: 3, also: 2 });
    expect(s.byCode.MCD).toEqual({ main: 1, also: 1 });
    expect(s.byCode.MI).toEqual({ main: 0, also: 2 });
    expect(s.byCode.POR).toEqual({ main: 1, also: 0 });
    expect(s.byCode.DC).toEqual({ main: 0, also: 0 });
    expect(s.none).toBe(2);
    expect(s.lineOnly).toEqual([]);
    expect(s.total).toBe(8);
  });
  it("«MC 3 · +2»: la preferida siempre; los de «también» solo si hay", () => {
    expect(posCountText("MC", { main: 3, also: 2 })).toBe("MC 3 · +2");
    expect(posCountText("MI", { main: 0, also: 2 })).toBe("MI 0 · +2");
    expect(posCountText("POR", { main: 1, also: 0 })).toBe("POR 1");
    expect(posCountText("DC", { main: 0, also: 0 })).toBe("DC 0");
  });
});

describe("La plantilla por posiciones · la clave", () => {
  const counts = (over: Parameters<typeof squadByPosition>[0]) => squadByPosition(over).byCode;
  it("usa la posición con más jugadores (preferida + también), con sus números de verdad, en plural", () => {
    const k = posKey(counts([
      { id: "a", positions: { main: "MC", also: [] } },
      { id: "b", positions: { main: "MC", also: [] } },
      { id: "c", positions: { main: "MC", also: [] } },
      { id: "d", positions: { main: "DC", also: ["MC"] } },
      { id: "e", positions: { main: "DC", also: ["MC"] } },
    ]));
    expect(k).toMatchObject({ chip: "MC 3 · +2", text: "3 la tienen de preferida y 2 más la marcan en «también»." });
  });
  it("en singular", () => {
    const k = posKey(counts([{ id: "a", positions: { main: "MC", also: [] } }, { id: "b", positions: { main: "MCD", also: ["MC"] } }]));
    expect(k).toMatchObject({ chip: "MC 1 · +1", text: "1 la tiene de preferida y 1 más la marca en «también»." });
  });
  it("empates en el orden del catálogo; sin «también» o sin preferida, la frase lo dice", () => {
    expect(posKey(counts([{ id: "a", positions: { main: "DC", also: [] } }, { id: "b", positions: { main: "POR", also: [] } }]))).toMatchObject({ chip: "POR 1", text: "1 la tiene de preferida." });
    expect(posKey(counts([{ id: "a", positions: { main: null, also: ["MI"] } }, { id: "b", positions: { main: null, also: ["MI"] } }]))).toMatchObject({ chip: "MI 0 · +2", text: "Nadie la tiene de preferida; 2 la marcan en «también».", pref: false });
  });
  it("nadie con posición: una clave neutra, simbólica", () => {
    expect(posKey(counts([{ id: "a" }]))).toMatchObject({ chip: "POS n · +m", text: "n la tienen de preferida y m más la marcan en «también»." });
  });
});

describe("La plantilla por posiciones · sin posición exacta", () => {
  it("una ficha antigua con solo su línea cuenta sin posición exacta, con su línea aparte", () => {
    const s = squadByPosition([{ id: "a", naturalPosition: "Defensa" }, { id: "b", naturalPosition: "Medio" }, { id: "c", naturalPosition: "Defensa" }, { id: "d" }, { id: "e", positions: { main: "MC", also: [] } }]);
    expect(s.none).toBe(4);
    expect(s.lineOnly).toEqual(["DEF", "MED", "DEF"]);
  });
  it("sin nadie fuera: «Todos con posición»", () => {
    expect(noPositionText(0, [])).toEqual({ title: "Todos con posición", text: "Todos tienen su sitio en el campo." });
  });
  it("sin nada en la ficha: singular y plural", () => {
    expect(noPositionText(1, [])).toEqual({ title: "Sin posición exacta: 1", text: "Su ficha aún no dice dónde juega." });
    expect(noPositionText(2, [])).toEqual({ title: "Sin posición exacta: 2", text: "Sus fichas aún no dicen dónde juegan." });
  });
  it("con solo su línea: nunca «no dice dónde juega» para ellos", () => {
    const all = noPositionText(3, ["DEF", "MED", "DEF"]);
    expect(all).toEqual({ title: "Sin posición exacta: 3", text: "(3 con solo su línea: defensa, medio)" });
    expect(noPositionText(1, ["DEL"]).text).toBe("(1 con solo su línea: delantero)");
    const mixed = noPositionText(3, ["POR"]);
    expect(mixed.text).toBe("(1 con solo su línea: portero) · 2 aún sin posición en su ficha.");
    expect(noPositionText(2, ["DEF"]).text).toBe("(1 con solo su línea: defensa) · 1 aún sin posición en su ficha.");
  });
});
