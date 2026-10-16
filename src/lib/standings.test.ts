import { describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { StandingRow } from "./standings";

vi.mock("./docTelemetry", () => ({ reportDroppedDoc: vi.fn() }));
const { mapStandings, movesOf, moveText, parseLeagueTable, pasteJornada, standingsErrors, standingsFields, standingsHints, stripText, updatedText } = await import("./standings");

const row = (team: string, n: Partial<StandingRow> = {}): StandingRow => ({ team, pj: 8, g: 5, e: 2, p: 1, gf: 20, gc: 9, pts: 17, isUs: false, ...n });

describe("parseLeagueTable", () => {
  it("a tab-separated paste with a header, positions in the first column and «Pts» at the end", () => {
    const text = ["Pos\tEquipo\tPJ\tG\tE\tP\tGF\tGC\tPts", "1\tRayo Norte\t8\t6\t1\t1\t25\t8\t19", "2\tManchester Piti\t8\t5\t3\t0\t20\t9\t18", "3\tLos Rojos\t8\t2\t2\t4\t10\t15\t8"].join("\n");
    const t = parseLeagueTable(text);
    expect(t.rows).toEqual([
      { team: "Rayo Norte", pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8, pts: 19, isUs: false },
      { team: "Manchester Piti", pj: 8, g: 5, e: 3, p: 0, gf: 20, gc: 9, pts: 18, isUs: true },
      { team: "Los Rojos", pj: 8, g: 2, e: 2, p: 4, gf: 10, gc: 15, pts: 8, isUs: false },
    ]);
    // (the header was read: it is not a line left unread)
    expect(t.skipped).toEqual([]);
  });

  it("several spaces between cells, names with single spaces, «1.º» positions, a DG column and junk lines", () => {
    const text = `Clasificación · Liga F7 Otoño
Jornada 8

1.º   Rayo Norte CF     8   6   1   1   25   8   +17   19
2.º   MANCHESTER PITI   8   5   3   0   20   9   +11   18
Publicidad
3.º   Los Rojos         8   2   2   4   10   15  -5    8
Última actualización: hoy`;
    const t = parseLeagueTable(text);
    expect(t.rows.map((r) => [r.team, r.pj, r.pts, r.isUs])).toEqual([
      ["Rayo Norte CF", 8, 19, false],
      ["MANCHESTER PITI", 8, 18, true],
      ["Los Rojos", 8, 8, false],
    ]);
    expect(t.jornada).toBe(8);
    expect(t.skipped).toEqual(["Clasificación · Liga F7 Otoño", "Publicidad", "Última actualización: hoy"]);
  });

  it("«Pts» first (the federation's order) is told apart by its arithmetic, and a header can say it too", () => {
    const noHeader = parseLeagueTable("Rayo Norte\t19\t8\t6\t1\t1\t25\t8\nOtro\t4\t8\t1\t1\t6\t5\t20");
    expect(noHeader.rows[0]).toMatchObject({ team: "Rayo Norte", pts: 19, pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8 });
    const withHeader = parseLeagueTable("Equipo  PTS  J  PG  PE  PP  F  C\nRayo  19  8  6  1  1  25  8\nPiti  0  0  0  0  0  0  0");
    expect(withHeader.rows[0]).toMatchObject({ team: "Rayo", pts: 19, pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8 });
    expect(withHeader.rows[1].isUs).toBe(true);
  });

  it("a position glued to the name, numbers split by single spaces, a row too short to be a team's, and the last save's name for «nosotros»", () => {
    const t = parseLeagueTable("1. Rayo  8 6 1 1 25 8 19\n2. El Equipo B  8  5  3  0  20  9  18\n3. Rojos  8  2\n4. Azules  8  2  2  4  10  15  8", "El Equipo B");
    expect(t.rows.map((r) => r.team)).toEqual(["Rayo", "El Equipo B", "Azules"]);
    expect(t.rows[0]).toMatchObject({ pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8, pts: 19 });
    expect(t.rows[1].isUs).toBe(true);
    expect(t.skipped).toEqual(["3. Rojos  8  2"]);
  });

  it("fixed width with a single space before PJ, or everything split by single spaces: the numbers are peeled off the name", () => {
    const t = parseLeagueTable(["1   Rayo Norte 8   6   1   1   25   8   19", "2 Atlético 2010 8 5 3 0 20 9 18", "3 Manchester Piti 8 2 2 4 10 15 8"].join("\n"));
    expect(t.rows.map((r) => [r.team, r.pj, r.g, r.e, r.p, r.gf, r.gc, r.pts, r.isUs])).toEqual([
      ["Rayo Norte", 8, 6, 1, 1, 25, 8, 19, false],
      ["Atlético 2010", 8, 5, 3, 0, 20, 9, 18, false],
      ["Manchester Piti", 8, 2, 2, 4, 10, 15, 8, true],
    ]);
    expect(t.skipped).toEqual([]);
  });

  it("an extra «San» column after Pts: by the header when there is one, by the arithmetic when not", () => {
    const withHeader = parseLeagueTable("Pos\tEquipo\tPJ\tG\tE\tP\tGF\tGC\tPts\tSan\n1\tRayo Norte\t8\t6\t1\t1\t25\t8\t19\t2\n2\tManchester Piti\t8\t5\t3\t0\t20\t9\t18\t0");
    expect(withHeader.rows.map((r) => [r.team, r.pj, r.gc, r.pts])).toEqual([
      ["Rayo Norte", 8, 8, 19],
      ["Manchester Piti", 8, 9, 18],
    ]);
    expect(withHeader.skipped).toEqual([]);
    const noHeader = parseLeagueTable("1\tRayo Norte\t8\t6\t1\t1\t25\t8\t19\t2");
    expect(noHeader.rows[0]).toMatchObject({ team: "Rayo Norte", pj: 8, g: 6, e: 1, p: 1, gf: 25, gc: 8, pts: 19 });
  });

  it("a semicolon CSV (quotes around the cells too)", () => {
    const t = parseLeagueTable('Pos;Equipo;PJ;G;E;P;GF;GC;Pts\n1;"Rayo Norte";8;6;1;1;25;8;19\n2;Manchester Piti;8;5;3;0;20;9;18');
    expect(t.rows.map((r) => [r.team, r.pj, r.gf, r.pts, r.isUs])).toEqual([
      ["Rayo Norte", 8, 25, 19, false],
      ["Manchester Piti", 8, 20, 18, true],
    ]);
    expect(t.skipped).toEqual([]);
  });

  it("the jornada: the paste's «Jornada N» line, else the most matches played", () => {
    expect(pasteJornada(parseLeagueTable("Jornada 9\nRayo\t8\t6\t1\t1\t25\t8\t19"))).toBe(9);
    expect(pasteJornada(parseLeagueTable("Rayo\t8\t6\t1\t1\t25\t8\t19\nPiti\t7\t5\t2\t0\t20\t9\t17"))).toBe(8);
    expect(pasteJornada(parseLeagueTable("Rayo\t0\t0\t0\t0\t0\t0\t0"))).toBeNull();
    expect(pasteJornada({ rows: [], jornada: null })).toBeNull();
  });

  it("nothing usable: no rows, everything skipped", () => {
    const t = parseLeagueTable("hola\n\nesto no es una tabla");
    expect(t.rows).toEqual([]);
    expect(t.skipped).toHaveLength(2);
  });
});

describe("standingsHints (never block) and standingsErrors (block)", () => {
  it("G + E + P ≠ PJ and Pts ≠ 3·G + E, per row", () => {
    const hints = standingsHints([row("A", { pj: 9 }), row("B", { pts: 20 }), row("C", { isUs: true })]);
    expect(hints).toEqual([
      { row: 0, text: "A: G + E + P (8) ≠ PJ (9)" },
      { row: 1, text: "B: Pts (20) ≠ 3·G + E (17) · algunas ligas puntúan distinto" },
    ]);
  });

  it("our row against the web's own results", () => {
    const rows = [row("A"), row("Piti", { isUs: true })];
    expect(standingsHints(rows, { pj: 8, g: 5, e: 2, p: 1, gf: 20, gc: 9 })).toEqual([]);
    expect(standingsHints(rows, { pj: 7, g: 4, e: 2, p: 1, gf: 20, gc: 9 })).toEqual([{ row: 1, text: "Nuestra fila no cuadra con los resultados de la web: PJ 8 aquí, 7 en la web · G 5 aquí, 4 en la web" }]);
  });

  it("the errors are what the rules refuse: 2–24 rows, exactly one «nosotros», names, whole numbers", () => {
    expect(standingsErrors([row("A"), row("B", { isUs: true })])).toEqual([]);
    expect(standingsErrors([row("A", { isUs: true })])).toEqual(["Hacen falta al menos 2 equipos."]);
    expect(standingsErrors([row("A"), row("B")])).toEqual(["Marca cuál somos nosotros («Somos nosotros»)."]);
    expect(standingsErrors([row("A", { isUs: true }), row("B", { isUs: true })])).toEqual(["Solo un equipo puede ser «nosotros»."]);
    expect(standingsErrors([row(" ", { isUs: true }), row("B", { pts: -1 })])).toEqual(["Cada equipo necesita un nombre.", "Los números son enteros, de 0 en adelante."]);
    expect(standingsErrors(Array.from({ length: 25 }, (_, i) => row(`T${i}`, { isUs: i === 0 })))).toEqual(["Caben 24 equipos como mucho."]);
  });
});

describe("standingsFields (the save)", () => {
  const input = { competition: " Liga F7 ", jornada: 9, rows: [row(" A "), row("Piti", { isUs: true })] };
  it("first save: no rowsPrev; a new jornada shifts the saved rows into rowsPrev", () => {
    expect(standingsFields(input, "u1")).toEqual({ competition: "Liga F7", jornada: 9, updatedBy: "u1", rows: [row("A"), row("Piti", { isUs: true })] });
    const prev = { jornada: 8, rows: [row("Piti", { isUs: true }), row("A")] };
    expect(standingsFields(input, "u1", prev).rowsPrev).toEqual(prev.rows);
  });
  it("a correction within the same jornada keeps the arrows it had", () => {
    const older = [row("A"), row("Piti", { isUs: true })];
    expect(standingsFields(input, "u1", { jornada: 9, rows: [row("X")], rowsPrev: older }).rowsPrev).toEqual(older);
    expect(standingsFields(input, "u1", { jornada: 9, rows: [row("X")] })).not.toHaveProperty("rowsPrev");
  });
});

describe("the public words", () => {
  it("«Vamos 3.º de 12 · 18 pts · J8»", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`T${i}`, { isUs: i === 2, pts: 30 - i * 2 - (i === 2 ? 8 : 0) }));
    expect(stripText({ rows, jornada: 8 })).toBe("Vamos 3.º de 12 · 18 pts · J8");
    expect(stripText({ rows, jornada: null })).toBe("Vamos 3.º de 12 · 18 pts");
    expect(stripText({ rows: [row("A"), row("B")], jornada: 1 })).toBeNull();
  });
  it("«Actualizada el 12 oct» (Madrid's day)", () => {
    expect(updatedText(Date.UTC(2026, 9, 12, 10))).toBe("Actualizada el 12 oct");
    expect(updatedText(Date.UTC(2026, 9, 12, 22, 30))).toBe("Actualizada el 13 oct");
    expect(updatedText(0)).toBeNull();
  });
  it("the moves since the previous save, by team", () => {
    const now = [row("A"), row("B"), row("C"), row("D")];
    const before = [row("B"), row("C"), row("a")];
    expect(movesOf(now, before)).toEqual([{ dir: "up", by: 2 }, { dir: "down", by: 1 }, { dir: "down", by: 1 }, { dir: "new" }]);
    expect(movesOf(now)).toEqual([null, null, null, null]);
    expect(moveText({ dir: "up", by: 2 })).toBe("Sube 2 puestos");
    expect(moveText({ dir: "down", by: 1 })).toBe("Baja 1 puesto");
  });
});

describe("mapStandings", () => {
  it("reads a valid doc (Timestamp → ms) and drops one without exactly one «nosotros»", () => {
    const rows = [row("A"), row("Piti", { isUs: true })];
    expect(mapStandings("t1", { competition: "Liga", jornada: 8, updatedAt: Timestamp.fromMillis(1000), updatedBy: "u", rows })).toEqual({ id: "t1", competition: "Liga", jornada: 8, updatedAt: 1000, updatedBy: "u", rows });
    expect(mapStandings("t1", { competition: "Liga", jornada: null, updatedAt: null, updatedBy: "u", rows, rowsPrev: rows })?.rowsPrev).toEqual(rows);
    expect(mapStandings("t1", { competition: "Liga", jornada: 8, rows: [row("A"), row("B")] })).toBeNull();
    expect(mapStandings("t1", { rows: [row("A", { isUs: true })] })).toBeNull();
  });
});
