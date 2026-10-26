import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { buildEntries, initials, nextScope, prefixOf, rivalSlug, searchView, searchViewer, seasonData, type SrGame, type SrInput, type SrPlayer, type SrState, type SrViewer } from "./searchModel";

const PLAYERS: SrPlayer[] = [
  { id: "alcides", name: "Alcides", num: "9", pos: "Punta", full: "Alcides Ramos", shirt: "ALCIDES", line: "48′ en la J1, en 3 tramos · gol en el 43′." },
  { id: "kevin", name: "Kevin", num: "11", pos: "Extremo derecho", full: "Kevin Pérez", shirt: "KEVIN", line: "30′ en la J1, en 2 tramos." },
];
const GAMES: SrGame[] = [
  { id: "m1", j: 1, rival: "Orduña fc", res: "P", score: "1–8", live: false, home: true, when: "domingo 18 oct, 19:00", scorers: "Alcides (43′)", goals: 1, changes: 23, marks: [{ m: 43, k: "us", left: 86 }] },
  { id: "m2", j: 2, rival: "Pitutis", res: null, score: "0–0", live: false, home: false, when: "domingo 25 oct, 14:00", scorers: "", goals: 0, changes: 0, marks: [] },
];
const input = (viewer: SrViewer, extra: Partial<SrInput> = {}): SrInput => ({ viewer, dia: false, players: PLAYERS, games: GAMES, next: { j: 2 }, vote: null, ...extra });
const titles = (v: SrViewer, kind: string, extra?: Partial<SrInput>) =>
  buildEntries(input(v, extra))
    .filter((e) => e.kind === kind)
    .map((e) => e.title);
const S = (q: string, scope: SrState["scope"] = "todo"): SrState => ({ q, scope, more: {} });
const JUGADOR: SrViewer = { kind: "jugador", captain: false };

describe("what each viewer finds (Main board, «Quién ve qué»)", () => {
  it("a fan: the public entries and «Entrar al vestuario»; of Tú only «Avisos a medida»", () => {
    const fan: SrViewer = { kind: "fan", captain: false };
    expect(titles(fan, "accion")).toEqual(["Entrar al vestuario", "Silenciar los avisos de este móvil", "Al calendario", "Cambiar a tema claro", "Ponte la del Piti"]);
    expect(titles(fan, "tu")).toEqual(["Avisos a medida"]);
    expect(titles(fan, "seccion")).not.toContain("Pizarra");
  });
  it("a socio: his page (his carné), his notices, the porra and the MVP", () => {
    const socio: SrViewer = { kind: "socio", captain: false };
    const vote = { matchId: "m1", j: 1, rival: "Orduña fc", closes: "viernes" };
    expect(titles(socio, "accion", { vote })).toEqual(["Votar al MVP de la J1", "Hacer la porra", "Silenciar los avisos de este móvil", "Al calendario", "Cambiar a tema claro", "Ponte la del Piti"]);
    expect(titles(socio, "tu")).toEqual(["Tu carné", "Tu nombre y tu apodo", "Avisos", "Avisos a medida", "Ajustes", "Tu cuenta"]);
    expect(titles(socio, "seccion")).toContain("La caja");
  });
  it("a new account: «Pedir mi ficha»", () => {
    expect(titles({ kind: "nuevo", captain: false }, "accion")).toContain("Pedir mi ficha");
    expect(titles({ kind: "socio", captain: false }, "accion")).not.toContain("Pedir mi ficha");
  });
  it("a player: the convocatoria, his card, his back, an absence and his turn; his season and positions", () => {
    expect(titles(JUGADOR, "accion").slice(0, 5)).toEqual(["Responder a la convocatoria de la J2", "Compartir mi carta", "Cambiar el nombre de mi espalda", "Avisar de una ausencia", "Cambiar mi turno"]);
    expect(titles(JUGADOR, "tu")).toEqual(expect.arrayContaining(["Tu carta", "Tu temporada", "Tus posiciones"]));
    expect(titles(JUGADOR, "tu")).not.toContain("Capitanía");
  });
  it("a captain: Capitanía and Admin", () => {
    expect(titles({ kind: "jugador", captain: true }, "tu")).toEqual(expect.arrayContaining(["Capitanía", "Admin"]));
    expect(titles({ kind: "socio", captain: false }, "tu")).not.toContain("Admin");
  });
  it("who looks, from the published viewer, his request and the DEV maqueta", () => {
    expect(searchViewer({ member: false, admin: false, playerId: null }, null)).toEqual({ kind: "fan", captain: false });
    expect(searchViewer({ member: true, admin: false, playerId: null }, null)).toEqual({ kind: "socio", captain: false });
    expect(searchViewer({ member: true, admin: false, playerId: null }, "pending")).toEqual({ kind: "nuevo", captain: false });
    expect(searchViewer({ member: true, admin: true, playerId: "jordi" }, null)).toEqual({ kind: "jugador", captain: true });
    expect(searchViewer({ member: true, admin: true, playerId: "jordi" }, null, "fan")).toEqual({ kind: "fan", captain: false });
    expect(searchViewer({ member: true, admin: false, playerId: "jordi" }, null, "capitan")).toEqual({ kind: "jugador", captain: true });
  });
  it("where things lead: rivals to Números › Rivales, «Al calendario» to the calendar block, the shirt to the club", () => {
    const all = buildEntries(input(JUGADOR));
    expect(all.find((e) => e.id === "r:Orduña fc")?.go).toEqual({ to: "href", href: "/numeros/rivales?rival=orduna-fc" });
    expect(all.find((e) => e.id === "a:calendario")?.go).toEqual({ to: "href", href: "/avisos/a-medida", anchor: "tu-cal" });
    expect(all.find((e) => e.id === "a:camiseta")?.go).toEqual({ to: "href", href: "/club/equipo/camiseta" });
    expect(all.find((e) => e.id === "f:amedida")?.go).toEqual({ to: "href", href: "/avisos/a-medida" });
    expect(all.find((e) => e.id === "a:rsvp")?.go.to).toBe("account");
  });
  it("matches say G · E · P and the rival its record", () => {
    const all = buildEntries(input(JUGADOR));
    const j1 = all.find((e) => e.id === "p:m1");
    expect(j1).toMatchObject({ title: "J1 · Orduña fc", detail: "Perdimos 1–8 · en casa", res: "P" });
    expect(j1?.pv).toMatchObject({ score: "1–8", word: "Perdimos", line: "Gol: Alcides (43′). 23 cambios, rotaciones continuas." });
    expect(all.find((e) => e.id === "p:m2")).toMatchObject({ detail: "Por jugar · domingo 25 oct, 14:00 · fuera", pv: { score: "J2", line: "Fuera. Previa, el siete y cómo llegar." } });
    expect(all.find((e) => e.id === "r:Orduña fc")).toMatchObject({ detail: "Rival · 1 derrota", ini: "O", pv: { list: "J1 1–8" } });
  });
});

describe("the search (component.js searchModel)", () => {
  const all = buildEntries(input(JUGADOR));

  it("«or»: the rival as «Mejor resultado», then its match; the loose hits go", () => {
    const v = searchView(all, S("or"), "jugador");
    expect(v.groups.map((g) => [g.title, g.items.map((e) => e.title)])).toEqual([
      ["Mejor resultado", ["Orduña fc"]],
      ["Partidos", ["J1 · Orduña fc"]],
    ]);
    expect(v.total).toBe(2);
    // (the chips count everything that holds the letters)
    expect(v.counts.partido).toBe(2);
  });
  it("a dorsal and a jornada are found exactly, first", () => {
    expect(searchView(all, S("11"), "jugador").flat[0].title).toBe("Kevin");
    expect(searchView(all, S("j2"), "jugador").flat[0].title).toBe("J2 · Pitutis");
    // (# keeps to the matches; J1 by its number first, then J2 by its «14:00»: the board's word-start rule)
    expect(searchView(all, S("#1"), "jugador").flat.map((e) => e.title)).toEqual(["J1 · Orduña fc", "J2 · Pitutis"]);
  });
  it("the prefixes set the scope: @ players, # jornadas, > things to do", () => {
    expect(prefixOf("@ke")).toEqual({ scope: "jugador", q0: "ke" });
    const v = searchView(all, S("@"), "jugador");
    expect(v.scope).toBe("jugador");
    expect(v.chip).toBe("Jugadores");
    expect(v.flat.map((e) => e.title)).toEqual(["Alcides", "Kevin"]);
    expect(searchView(all, S(">tema"), "jugador").flat.map((e) => e.title)).toEqual(["Cambiar a tema claro"]);
  });
  it("three per group with «N más» in Todo; a scope shows them all", () => {
    const v = searchView(all, S("a"), "jugador");
    const acc = v.groups.find((g) => g.key === "accion");
    expect(acc?.items).toHaveLength(3);
    expect(acc?.more).toBeGreaterThan(0);
    const open = searchView(all, { q: "a", scope: "todo", more: { accion: true } }, "jugador");
    expect(open.groups.find((g) => g.key === "accion")?.more).toBe(0);
    expect(searchView(all, S("a", "accion"), "jugador").groups.find((g) => g.key === "accion")?.more).toBe(0);
  });
  it("empty: «Lo próximo» and four «Acciones» with «N más»", () => {
    const v = searchView(all, S(""), "jugador");
    expect(v.groups.map((g) => g.title)).toEqual(["Lo próximo", "Acciones"]);
    expect(v.groups[0].items[0].title).toBe("J2 · Pitutis");
    expect(v.groups[1].items).toHaveLength(4);
    expect(v.groups[1].more).toBe(all.filter((e) => e.kind === "accion").length - 4);
  });
  it("nothing found: the words, a scope's «en …», and «¿Querías decir…?»", () => {
    const v = searchView(all, S("kez"), "jugador");
    expect(v.none).toBe(true);
    expect(v.noneText).toBe("Nada con «kez».");
    expect(v.sugg).toBe("Kevin");
    expect(searchView(all, S("zz", "rival"), "jugador").noneText).toBe("Nada con «zz» en rivales.");
  });
  it("the field's hint by who looks and where", () => {
    expect(searchView(all, S(""), "fan").hint).toBe("Un jugador, una jornada, un rival o algo que hacer");
    expect(searchView(all, S(""), "jugador").hint).toBe("Un jugador, una jornada o algo tuyo");
    expect(searchView(all, S("", "tu"), "jugador").hint).toBe("Busca en tu página y tus avisos");
  });
  it("Tab cycles the scopes both ways", () => {
    expect(nextScope("todo")).toBe("jugador");
    expect(nextScope("accion")).toBe("todo");
    expect(nextScope("todo", true)).toBe("accion");
  });
  it("initials in coral and the rival's address", () => {
    expect(initials("Orduña fc")).toBe("O");
    expect(initials("Entrepibas F.C.")).toBe("E");
    expect(initials("Sporting de Brugal")).toBe("SB");
    expect(initials("Red Demons")).toBe("RD");
    expect(rivalSlug("Entrepibas F.C.")).toBe("entrepibas-f-c");
  });
});

describe("the season in the search's words", () => {
  const T0 = Date.UTC(2026, 9, 18, 17, 0);
  const matches = [
    { id: "m1", seasonId: "t1", rival: "Orduña fc", home: true, status: "finished", goalsFor: 1, goalsAgainst: 8, date: T0, starters: ["alcides", "kevin"], bench: [], duration: 50, events: [{ id: "e1", type: "goal", minute: 43, playerId: "alcides" }] },
    { id: "m2", seasonId: "t1", rival: "Pitutis", home: false, status: "scheduled", date: T0 + 7 * 86_400_000 },
  ] as unknown as ClubMatch[];
  const players = [
    { id: "alcides", shirtName: "ALCIDES", firstName: "Alcides", lastName: "Ramos", number: 9, seasons: ["t1"], positions: { main: "DC", also: [] } },
    { id: "kevin", shirtName: "KEVIN", firstName: "Kevin", number: 11, seasons: ["t1"] },
    { id: "old", shirtName: "OLD", number: 4, seasons: ["t0"] },
  ];
  const d = seasonData({ matches, players, seasonId: "t1", now: T0 + 86_400_000 });

  it("the season's squad by dorsal, with their position and full name", () => {
    expect(d.players.map((p) => [p.name, p.num, p.pos, p.full])).toEqual([
      ["Alcides", "9", "Punta", "Alcides Ramos"],
      ["Kevin", "11", "", "Kevin"],
    ]);
  });
  it("the matches: jornada, result, scorers and marks; the next one", () => {
    expect(d.games[0]).toMatchObject({ j: 1, res: "P", home: true, scorers: "Alcides (43′)", goals: 1 });
    expect(d.games[0].marks.map((m) => m.k)).toEqual(["us"]);
    expect(d.games[1]).toMatchObject({ j: 2, res: null, home: false });
    expect(d.next).toEqual({ j: 2 });
  });
  it("after one match, a player's line is his match", () => {
    expect(d.players[0].line).toMatch(/^50′ en la J1, en 1 tramo · gol en el 43′\.$/);
  });
  it("before the first match, his debut", () => {
    const pre = seasonData({ matches, players, seasonId: "t1", now: T0 - 86_400_000 }).players[0].line;
    // (m1 is finished in the data, so a season with nothing played needs no finished match)
    expect(pre).toMatch(/en la J1/);
    const fresh = seasonData({ matches: [matches[1]], players, seasonId: "t1", now: T0 }).players[0].line;
    expect(fresh).toMatch(/^Se estrena el domingo 25 contra Pitutis\.$/);
  });
});
