import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import { fichaOf, formBars, formGames } from "./ficha";
import { Ficha } from "./Overlays";
import { chem } from "./quimica";
import { demoSquad, lineupOf } from "./testkit";

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

  it("the back shows it all, the bars with their words for screen readers", () => {
    render(<Ficha f={fichaOf(args("tello"))!} rm onFlip={vi.fn()} onClose={vi.fn()} />);
    const dlg = screen.getByRole("dialog", { name: "Ficha de TELLO" });
    expect(within(dlg).getByRole("img", { name: "Últimos partidos: J4: 50′, J5: no jugó, J6: 25′ y 2 goles o asistencias" })).toBeInTheDocument();
    expect(within(dlg).getByText("280′ · 82 % del equipo")).toBeInTheDocument();
    expect(within(dlg).getByText("Convocado · duda")).toBeInTheDocument();
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
