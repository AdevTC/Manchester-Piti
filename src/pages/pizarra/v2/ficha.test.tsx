import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import { fichaOf, formBars, formGames } from "./ficha";
import { Ficha } from "./Overlays";
import { chem } from "./quimica";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import { lineOf, type PosCode } from "../../../lib/positions";

// The ficha's back, filled with real data: the form over the last matches, his minutes against the
// team's, where he plays, his galones and whether he goes to the board's match.

const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const base = demoSquad();
const sq = (() => {
  const byId = new Map(base.byId);
  // the seven played everything (350′ each), tello a bit less; kevin is new
  SEVEN.forEach((id) => byId.set(id, { ...base.byId.get(id)!, stats: { played: 7, goals: 1, assists: 0, minutes: id === "tello" ? 280 : 350, starts: 7, mvps: 0 } }));
  byId.set("tello", {
    ...byId.get("tello")!,
    cv: "duda",
    form: [
      { j: 4, played: true, min: 50, ga: 0 },
      { j: 5, played: false, min: 0, ga: 0 },
      { j: 6, played: true, min: 25, ga: 2 },
    ],
  });
  return { ...base, list: base.list.map((c) => byId.get(c.id)!), byId };
})();
const L = { ...lineupOf(SEVEN, "2-3-1", sq), roles: { captainId: "tello", cornersId: "tello" }, playerPositions: { tello: "MED" as const } };
const args = (id: string, o: Partial<Parameters<typeof fichaOf>[0]> = {}) => ({ id, L, sq, ch: chem(L, sq), match: { short: "J8 · MAD SKY", date: "dom 8 nov", j: "J8", called: [...SEVEN, "kevin"] }, ox: "0px", oy: "0px", side: "back" as const, ...o });

describe("la ficha", () => {
  it("the form: a bar per match, as tall as his minutes, the missed one flat — and said in words", () => {
    expect(formBars(sq.byId.get("tello")!.form)).toEqual([
      { j: "J4", h: 100, played: true, t: "J4: 50′" },
      { j: "J5", h: 0, played: false, t: "J5: no jugó" },
      { j: "J6", h: 50, played: true, t: "J6: 25′ y 2 goles o asistencias" },
    ]);
    expect(formBars(undefined)).toEqual([]);
  });

  it("minutes against the team's, «Jugar de» and his natural line, his galones and the match", () => {
    const f = fichaOf(args("tello"))!;
    expect(f.form?.k).toBe("FORMA · J4–J6");
    // the team played 340′ (everyone's minutes over seven): tello 280 of them
    expect(f.facts).toEqual([
      { k: "Minutos", v: "280′ · 82 % del equipo" },
      { k: "Posición", v: "Juega de MED · natural DEF" },
      { k: "Galones", v: "Capitán · Córners" },
      { k: "J8", v: "Convocado · duda" },
    ]);
    // the old back stays: the season line and his química in this seven
    expect(f.st.map((s) => s.k)).toEqual(["PARTIDOS", "GOLES", "ASIST.", "MINUTOS", "TITULAR", "MVP"]);
    expect(f.ln.length).toBeGreaterThan(0);
  });

  it("a newcomer off the convocatoria: no minutes yet, no galones, not called; no match, no match row", () => {
    const f = fichaOf(args("kevin", { match: { short: "J8 · MAD SKY", date: "", j: "J8", called: SEVEN } }))!;
    expect(f.form).toBeUndefined();
    expect(f.facts).toEqual([
      { k: "Minutos", v: "Aún sin minutos" },
      { k: "Posición", v: "DEL natural" },
      { k: "Galones", v: "Ninguno" },
      { k: "J8", v: "No convocado · sin responder" },
    ]);
    expect(fichaOf(args("kevin", { match: null }))!.facts?.map((x) => x.k)).toEqual(["Minutos", "Posición", "Galones"]);
    expect(fichaOf(args("nadie"))).toBeNull();
  });

  it("a «Jugar de» by code is said with its code and name", () => {
    const f = fichaOf(args("tello", { L: { ...L, playerPositions: { tello: "MCD" } } }))!;
    expect(f.facts?.find((x) => x.k === "Posición")?.v).toBe("Juega de pivote (MCD) · natural DEF");
  });

  it("a sanctioned player off the pitch: how many matches are left and why", () => {
    const sqS = { ...sq, byId: new Map(sq.byId) };
    sqS.byId.set("kevin", { ...sq.byId.get("kevin")!, baja: "Sancionado", sancion: { left: 2, reason: "Federación" } });
    sqS.byId.set("fer", { ...sq.byId.get("fer")!, baja: "Lesionado" });
    expect(fichaOf(args("kevin", { sq: sqS }))!.ln).toEqual([{ k: "Sancionado 2 partidos más (Federación): no disponible", v: "" }]);
    expect(fichaOf(args("fer", { sq: sqS }))!.ln).toEqual([{ k: "Lesionado: no disponible", v: "" }]);
  });

  it("the chip reads «—» before his first match; the why of his form and his links in minutes together", () => {
    const sqU = { ...sq, byId: new Map(sq.byId) };
    sqU.byId.set("kevin", { ...sq.byId.get("kevin")!, unrated: true, why: "Sin partidos esta temporada" });
    sqU.byId.set("tello", { ...sq.byId.get("tello")!, why: "2 goles en sus 2 últimos" });
    expect(fichaOf(args("kevin", { sq: sqU }))!.rt).toBe("—");
    const t = fichaOf(args("tello", { sq: sqU }))!;
    expect(t.rt).toBe(String(sq.byId.get("tello")!.rt));
    expect(t.sub).toMatch(/ · 2 goles en sus 2 últimos$/);
    t.ln.forEach((l) => expect(l.k).toMatch(/^con .+ · (\d+′ juntos|sin minutos juntos)$/));
  });

  it("the back shows it all, the bars with their words for screen readers", () => {
    render(<Ficha f={fichaOf(args("tello"))!} rm onFlip={vi.fn()} onClose={vi.fn()} />);
    const dlg = screen.getByRole("dialog", { name: "Ficha de TELLO" });
    expect(within(dlg).getByRole("img", { name: "Últimos partidos: J4: 50′, J5: no jugó, J6: 25′ y 2 goles o asistencias" })).toBeInTheDocument();
    expect(within(dlg).getByText("280′ · 82 % del equipo")).toBeInTheDocument();
    expect(within(dlg).getByText("Convocado · duda")).toBeInTheDocument();
  });

  it("free mode: a player known by his line is said where he plays by the slot's exact code, not its line", () => {
    const F = { ...L, freeMode: true, slots: L.slots.map((s, i) => (i === 3 ? { ...s, x: 50, y: 50 } : s)) };
    // huberoski (MED) stands in the middle of a free board: MC, not «MED»
    expect(fichaOf(args("huberoski", { L: F }))!.sub).toMatch(/^MED natural · juega de MC/);
    expect(fichaOf(args("huberoski"))!.sub).toMatch(/^MED natural · juega de MI/);
  });

  it("formGames: his last matches from the season's, minutes from the acta (or the match's length)", () => {
    const m = (id: string, row: Record<string, unknown> | null, duration?: number): ClubMatch => ({ id, status: "finished", ledger: row ? { tello: row } : { otro: { played: true } }, ...(duration ? { duration } : {}) }) as unknown as ClubMatch;
    const games = [m("a", { played: true, minutes: 50 }), m("b", { played: true, minutes: 30, goals: 1, assists: 1 }), m("c", null, 60), m("d", { played: true }, 60)];
    const out = formGames("tello", games, new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]), 3);
    expect(out).toEqual([
      { j: 2, played: true, min: 30, ga: 2 },
      { j: 3, played: false, min: 0, ga: 0 },
      // no minutes in the acta: the match's length
      { j: 4, played: true, min: 60, ga: 0 },
    ]);
  });
});

describe("la ficha con posiciones exactas", () => {
  // 2-3-1: POR · DFC DFC · MI MC MD · DC
  const x = (id: string, num: number, main: PosCode | null, also: PosCode[] = []) => cromo(id, num, main ? lineOf(main) : lineOf(also[0]), { ps: { main, also, line: main ? lineOf(main) : lineOf(also[0]) } });
  const xs = squadOf([x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "DFC"), x("piv", 4, "MCD", ["MC"]), x("mc", 5, "MC"), x("md", 6, "MD"), x("dc", 9, "DC"), x("tam", 8, null, ["MC", "MCO"])]);
  const XL = lineupOf(["gk", "d1", "d2", "piv", "mc", "md", "dc"], "2-3-1", xs);
  const xa = (id: string, o: Partial<Parameters<typeof fichaOf>[0]> = {}) => ({ id, L: XL, sq: xs, ch: chem(XL, xs), match: null, ox: "0px", oy: "0px", side: "back" as const, ...o });
  const pos = (f: ReturnType<typeof fichaOf>) => f?.facts?.find((k) => k.k === "Posición")?.v;

  it("the position line names his preferida with its code and his también; the front chip wears the code", () => {
    const f = fichaOf(xa("piv"))!;
    expect(pos(f)).toBe("Pivote (MCD) · también MC");
    expect(f.pos).toBe("MCD");
    expect(f.gk).toBe(false);
    // without a preferida: his también, the first with its name
    expect(pos(fichaOf(xa("tam")))).toBe("También mediocentro (MC), MCO");
    expect(fichaOf(xa("tam"))!.pos).toBe("MC");
  });

  it("where he plays in this seven, by the slot's name and how well he fits it", () => {
    // the pivote at MI: his line → adaptado
    expect(fichaOf(xa("piv"))!.sub).toBe("Pivote · juega de interior izquierdo · adaptado");
    // at MC: his también → en su sitio
    const atMc = lineupOf(["gk", "d1", "d2", "mc", "piv", "md", "dc"], "2-3-1", xs);
    expect(fichaOf(xa("piv", { L: atMc, ch: chem(atMc, xs) }))!.sub).toBe("Pivote · juega de mediocentro · en su sitio");
    // at DC: fuera
    const atDc = lineupOf(["gk", "d1", "d2", "mc", "dc", "md", "piv"], "2-3-1", xs);
    expect(fichaOf(xa("piv", { L: atDc, ch: chem(atDc, xs) }))!.sub).toBe("Pivote · juega de punta · fuera de su sitio");
    // on the bench: only who he is
    expect(fichaOf(xa("tam"))!.sub).toBe("También MC, MCO");
  });

  it("a «Jugar de» on this board is said first, his preferida after it", () => {
    const J = { ...XL, playerPositions: { piv: "MI" as const } };
    const f = fichaOf(xa("piv", { L: J, ch: chem(J, xs) }))!;
    expect(pos(f)).toBe("Juega de interior izquierdo (MI) · preferida pivote (MCD)");
    expect(f.sub).toBe("Pivote · juega de interior izquierdo · en su sitio");
    // his preferida as «Jugar de» is no override to speak of
    expect(pos(fichaOf(xa("piv", { L: { ...XL, playerPositions: { piv: "MCD" as const } } })))).toBe("Pivote (MCD) · también MC");
  });

  it("a keeper known only as POR keeps the old words", () => {
    const f = fichaOf(xa("gk"))!;
    expect(pos(f)).toBe("POR natural");
    expect(f.sub).toBe("POR natural · juega de POR");
    expect(f.pos).toBe("POR");
  });
});
