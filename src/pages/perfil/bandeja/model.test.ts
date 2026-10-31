// Avisos' pure model (TU boards' component.js renderVals in the app's terms).
import { describe, expect, it } from "vitest";
import type { Notice } from "../../../lib/derived/notices";
import {
  actsOf,
  blockedText,
  closesAt,
  deviceKindOf,
  deviceWords,
  feedOf,
  filterOf,
  calendarBatch,
  collapseFixtures,
  filterRows,
  isNewFixture,
  stackLine,
  tocaTitle,
  iconOf,
  kindOf,
  mvpBody,
  nextLine,
  noticesFor,
  pauseLine,
  pendTitle,
  presetLine,
  resOf,
  rivalIni,
  rsvpBody,
  shownBy,
  stackSummary,
  stacksOf,
  tocaMore,
  topicsFor,
  unreadText,
  verOf,
  viewerOf,
  whenLine,
} from "./model";

const n = (id: string, extra: Partial<Notice> = {}): Notice => ({ id, topic: "lineup", title: `Aviso ${id}`, body: "…", url: "/vestuario", at: 0, audience: "team", ...extra });
const J1 = "3c1c616b";
// Friday 23 Oct 2026, 12:00 in Madrid
const NOW = Date.UTC(2026, 9, 23, 10);

describe("who looks", () => {
  const real = { member: true, admin: true, playerId: "jordi" };
  it("from the session", () => {
    expect(viewerOf(real, null)).toEqual({ who: "jugador", captain: true });
    expect(viewerOf({ member: true, admin: false, playerId: null }, null)).toEqual({ who: "socio", captain: false });
    expect(viewerOf({ member: true, admin: false, playerId: null, pendingClaim: true }, null)).toEqual({ who: "nuevo", captain: false });
    expect(viewerOf({ member: false, admin: false, playerId: null }, null)).toEqual({ who: "fan", captain: false });
  });
  it("from the DEV maqueta", () => {
    expect(viewerOf(real, "fan").who).toBe("fan");
    expect(viewerOf(real, "socio")).toEqual({ who: "socio", captain: false });
    expect(viewerOf(real, "pendiente").who).toBe("nuevo");
    expect(viewerOf(real, "jugador")).toEqual({ who: "jugador", captain: false });
    expect(viewerOf(real, "capitan")).toEqual({ who: "jugador", captain: true });
  });
  it("the captains' notices only for a captain; none for a fan", () => {
    const list = [n("a"), n("b", { audience: "captains" }), n("c", { audience: "personal" })];
    expect(noticesFor(list, { who: "jugador", captain: true }).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(noticesFor(list, { who: "socio", captain: false }).map((x) => x.id)).toEqual(["a", "c"]);
    expect(noticesFor(list, { who: "fan", captain: false })).toEqual([]);
  });
  it("A medida's topics: the convocatoria for members, the door for captains", () => {
    expect(topicsFor({ who: "fan", captain: false }).map((t) => t.id)).not.toContain("convocatoria");
    expect(topicsFor({ who: "socio", captain: false }).map((t) => t.id)).toContain("convocatoria");
    expect(topicsFor({ who: "socio", captain: false }).map((t) => t.id)).not.toContain("door");
    expect(topicsFor({ who: "jugador", captain: true }).map((t) => t.id)).toContain("door");
    expect(topicsFor({ who: "fan", captain: false }).map((t) => t.id)).toContain("tabla");
  });
});

describe("each notice", () => {
  it("its kind, its glyph and its actions", () => {
    expect(kindOf(n("a", { audience: "personal" }))).toBe("tuyo");
    expect(kindOf(n("a", { topic: "final" }))).toBe("partido");
    expect(kindOf(n("a", { title: "Nueva encuesta" }))).toBe("vestuario");
    expect(kindOf(n("a", { topic: "door", audience: "captains" }))).toBe("vestuario");
    expect(iconOf(n("a", { title: "Nueva encuesta" }))).toBe("poll");
    expect(iconOf(n("a", { topic: "personal", title: "Te toca lavar la equipación" }))).toBe("wash");
    expect(iconOf(n("a", { topic: "dates" }))).toBe("cal");
    expect(iconOf(n("a", { topic: "rara" }))).toBe("bell");
    expect(actsOf(n("a", { topic: "goals" })).map((x) => x.k)).toEqual(["open", "goles"]);
    expect(actsOf(n("a", { topic: "final" }))).toEqual([{ k: "acta", t: "Leer la crónica" }]);
    expect(actsOf(n("a", { topic: "dates" }))).toEqual([{ k: "cal", t: "Al calendario" }]);
    expect(actsOf(n("a", { topic: "mvp", title: "Vota al MVP" }))).toEqual([]);
    expect(actsOf(n("a", { topic: "mvp", title: "MVP de la J1: Alcides" }))).toEqual([{ k: "acta", t: "Ver el acta" }]);
    expect(actsOf(n("a", { topic: "personal", audience: "personal", url: "/perfil" }))).toEqual([{ k: "carta", t: "Ver tu carta" }]);
  });
});

describe("the bandeja's filters", () => {
  it("?ver= both ways", () => {
    for (const f of ["toca", "sinleer", "partidos", "vestuario", "tuyos", `m:${J1}`] as const) expect(filterOf(verOf(f))).toBe(f);
    expect(verOf("todos")).toBeUndefined();
    expect(filterOf(undefined)).toBe("todos");
    expect(filterOf("partido")).toBe("partidos");
    expect(filterOf("cosas")).toBe("todos");
    expect(verOf(`m:${J1}`)).toBe(`partido-${J1}`);
  });
  it("the rail's counts", () => {
    const loose = [n("b", { audience: "personal" }), n("c", { title: "Nueva encuesta" })];
    expect(filterRows({ toca: 2, unread: 1, partidos: 4, loose, batch: true }).map((r) => [r.f, r.t, r.n])).toEqual([
      ["toca", "Te toca", 2],
      ["sinleer", "Sin leer", 1],
      ["todos", "Todos", 9],
      ["partidos", "Partidos", 4],
      ["vestuario", "Del vestuario", 2],
    ]);
    expect(filterRows({ toca: 0, unread: 0, partidos: 0, loose: [], batch: false }).map((r) => r.n)).toEqual([0, 0, 0, 0, 0]);
  });
  it("what each filter shows", () => {
    expect(shownBy("todos")).toEqual({ pend: true, stacks: "all", loose: "all", unread: false });
    expect(shownBy("toca")).toMatchObject({ pend: true, stacks: "none", loose: "none" });
    expect(shownBy(`m:${J1}`)).toMatchObject({ stacks: "one", pend: false });
    expect(shownBy("sinleer").unread).toBe(true);
  });
  it("the feed leaves out what «Te toca» holds, and stacks by match", () => {
    const list = [n("a", { url: `/partidos/${J1}/vestuario` }), n("b"), n("c", { url: "/matches/j2?tab=vestuario" }), n("d", { url: `/partidos/${J1}` }), n("e", { url: "/partidos/tabla" })];
    const feed = feedOf(list, new Set(["a"]));
    expect(feed.map((x) => x.id)).toEqual(["b", "c", "d", "e"]);
    const s = stacksOf(feed);
    expect(s.stacks.map((x) => [x.matchId, x.rows.map((r) => r.id)])).toEqual([
      ["j2", ["c"]],
      [J1, ["d"]],
    ]);
    expect(s.loose.map((x) => x.id)).toEqual(["b", "e"]);
  });
  it("the words", () => {
    expect(unreadText(0)).toBe("Al día");
    expect(unreadText(6)).toBe("6 sin leer");
    expect(pendTitle(5)).toBe("Te toca · 5");
    expect(pendTitle(0)).toBe("Te toca · todo hecho");
    expect(tocaMore(5)).toBe("4 cosas más te tocan");
    expect(tocaMore(2)).toBe("1 cosa más te toca");
    expect(tocaMore(1)).toBe("");
  });
});

describe("a match's stack", () => {
  it("its result, its summary and its disc", () => {
    expect(resOf(true, 1, 8)).toBe("P");
    expect(resOf(true, 2, 2)).toBe("E");
    expect(resOf(false, 0, 0)).toBe("");
    const marks = [
      ...Array.from({ length: 8 }, (_, i) => ({ m: i, k: "them" as const, left: i })),
      { m: 43, k: "us" as const, left: 86 },
      { m: 28, k: "card-us" as const, left: 56 },
      { m: 42, k: "card-us" as const, left: 84 },
    ];
    expect(stackSummary("P", "Orduña fc", marks, [])).toBe("8 goles de Orduña fc · 1 nuestro · 2 tarjetas");
    expect(stackSummary("", "Pitutis", [], ["Cambio de última hora: Andia", "Nuevo partido: Pitutis", "otro"])).toBe("Cambio de última hora: Andia · Nuevo partido: Pitutis");
    expect(rivalIni("Orduña fc")).toBe("OR");
    expect(rivalIni("Inter de Usera")).toBe("IU");
    expect(rivalIni("Pitutis", "PI")).toBe("PI");
    expect(whenLine(Date.UTC(2026, 9, 18, 17), true)).toBe("domingo 18 oct · 19:00 · en casa");
  });
});

describe("«Te toca»", () => {
  it("the convocatoria's line", () => {
    expect(rsvpBody(2, Date.UTC(2026, 9, 25, 13), false, 6, 16)).toBe("J2 · 14:00 · fuera · contestan 6 de 16");
  });
  it("the MVP's line and when it closes", () => {
    const close = Date.UTC(2026, 9, 23, 21, 54);
    expect(mvpBody(5, 7, close, NOW)).toBe("5 de 7 ya han votado · se cierra hoy a las 23:54");
    expect(closesAt(close, Date.UTC(2026, 9, 21, 10))).toBe("el viernes a las 23:54");
    expect(closesAt(close, Date.UTC(2026, 9, 22, 10))).toBe("mañana a las 23:54");
  });
  it("what comes next", () => {
    expect(nextLine({ j: 2, at: Date.UTC(2026, 9, 25, 13), home: false, rival: "Pitutis" })).toBe("Lo próximo: J2, domingo 25 a las 14:00, en casa de Pitutis.");
    expect(nextLine(null)).toBe("Aún no hay próximo partido en el calendario.");
  });
});

describe("this device", () => {
  it("its state, the maqueta's first", () => {
    expect(deviceKindOf("ready", null)).toBe("listo");
    expect(deviceKindOf("denied", null)).toBe("bloqueado");
    expect(deviceKindOf("ios-install", null)).toBe("iphone");
    expect(deviceKindOf("unsupported", null)).toBe("nosoporta");
    expect(deviceKindOf("ready", "bloqueado")).toBe("bloqueado");
  });
  it("its words", () => {
    expect(deviceWords("listo", { name: "Chrome en Windows", receiving: true, unblock: [] })).toMatchObject({ tone: "ok", chip: "Listo", title: "Este móvil recibe avisos", dev: "Chrome en Windows · avisos permitidos" });
    expect(deviceWords("bloqueado", { name: "", receiving: false, unblock: ["a", "b", "c"] })).toMatchObject({ tone: "bad", steps: ["a", "b", "c"], btn: "Ya los he permitido" });
    expect(deviceWords("iphone", { name: "", receiving: false, unblock: [] }).steps).toHaveLength(3);
    expect(blockedText("iphone")).toMatch(/iPhone/);
  });
  it("the preset's line and the pause", () => {
    expect(presetLine("todo", false)).toBe("Todo");
    expect(presetLine("custom", false)).toBe("A medida");
    expect(presetLine("todo", true)).toBe("En pausa");
    expect(pauseLine("1h")).toBe("Avisos en pausa en este móvil durante una hora.");
    expect(pauseLine("manana")).toBe("Avisos en pausa en este móvil hasta mañana a las 9:00.");
  });
});

describe("the fixture's «Nuevo partido» notices", () => {
  // production-shaped: the season's fixture made 20 notices at once (J3–J22), each its own match; J2 played
  const fixture = Array.from({ length: 20 }, (_, i) => n(`date-m${i + 3}`, { topic: "dates", title: `Nuevo partido: Rival ${i + 3}`, url: `/partidos/m${i + 3}`, at: NOW - 8 * 86_400_000 }));
  const final = n("final-m2", { topic: "final", title: "Final: Manchester Piti 3–8 Pitutis", url: "/partidos/m2", at: NOW });
  const stacks = stacksOf([final, ...fixture]).stacks;
  it("only the fixture's", () => {
    expect(isNewFixture(fixture[0])).toBe(true);
    expect(isNewFixture(n("x", { topic: "dates", title: "Cambio de hora: Pitutis" }))).toBe(false);
    expect(isNewFixture(n("y", { topic: "final", title: "Nuevo partido: X" }))).toBe(false);
  });
  it("collapse into one batch; the played match keeps its stack", () => {
    expect(stacks).toHaveLength(21);
    const c = collapseFixtures(stacks);
    expect(c.batch).toHaveLength(20);
    expect(c.stacks.map((s) => s.matchId)).toEqual(["m2"]);
    // a stack with a fixture notice and others keeps the others
    const mixed = stacksOf([n("g", { topic: "goals", url: "/partidos/m3" }), ...fixture.slice(0, 2)]).stacks;
    expect(collapseFixtures(mixed).stacks.map((s) => [s.matchId, s.rows.map((r) => r.id)])).toEqual([["m3", ["g"]]]);
  });
  it("one alone stays where it was", () => {
    const one = stacksOf([final, fixture[0]]).stacks;
    expect(collapseFixtures(one)).toEqual({ stacks: one, batch: [] });
  });
  it("one item: «Calendario: 20 jornadas nuevas», from the first to the last, each jornada in order", () => {
    const { batch } = collapseFixtures(stacks);
    // J3 on Sunday 8 Nov 2026 at 18:00, then one a week
    const info = (id: string) => {
      const j = Number(id.slice(1));
      return { j, at: Date.UTC(2026, 10, 8, 17) + (j - 3) * 7 * 86_400_000, rival: `Rival ${j}` };
    };
    const c = calendarBatch([...batch].reverse(), info);
    expect(c.title).toBe("Calendario: 20 jornadas nuevas");
    expect(c.body).toBe("De la J3 (8 nov) a la J22 (21 mar).");
    expect(c.rows).toHaveLength(20);
    expect(c.rows[0]).toEqual({ key: "m3", t: "J3 · 8 nov · Rival 3" });
    expect(c.rows.at(-1)?.t).toBe("J22 · 21 mar · Rival 22");
    expect(c.ids).toHaveLength(20);
    expect(c.at).toBe(NOW - 8 * 86_400_000);
  });
  it("a match gone: its rival from the notice, no range", () => {
    const c = calendarBatch(fixture.slice(0, 2), () => null);
    expect(c.title).toBe("Calendario: 2 jornadas nuevas");
    expect(c.body).toBe("Ya están en Partidos y en tu calendario.");
    expect(c.rows.map((r) => r.t)).toEqual(["Rival 3", "Rival 4"]);
  });
});

describe("the bandeja's head and stacks", () => {
  it("what waits on him", () => {
    expect(tocaTitle(0)).toBe("Al día");
    expect(tocaTitle(1)).toBe("Una cosa te toca");
    expect(tocaTitle(5)).toBe("5 cosas te tocan");
  });
  it("our score first", () => {
    const at = Date.UTC(2026, 9, 25, 13);
    expect(stackLine(resOf(true, 3, 8), 3, 8, at, false)).toBe("Perdimos 3–8 · fuera · 25 oct");
    expect(stackLine(resOf(true, 2, 2), 2, 2, at, true)).toBe("Empatamos 2–2 · en casa · 25 oct");
    expect(stackLine("", 0, 0, at, null)).toBe("Por jugar · 25 oct");
  });
});
