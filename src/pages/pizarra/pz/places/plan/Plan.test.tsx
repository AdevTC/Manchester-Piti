import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { fakeBoard, fakeLineup, fakeWorld, makeTestStore, ME_CAPTAIN, ME_PLAYER, renderWithPz } from "../../store/testkit";
import type { PzBoard } from "../../store/types";
import { Plan } from "./Plan";
import { partsStatus, planStage, PLAN_UI0, stageHas } from "./planPlace";
import { libraryPlays } from "../../../playLibrary";
import { partSubs } from "./planWords";

vi.mock("../../../data/seasonPlays", () => ({ useSeasonPlays: () => ({ plays: [], team: [], mine: () => [], loading: false, error: false }), boardSeasonPlays: () => ({ plays: [], missing: [] }) }));
vi.mock("../../../../../lib/useStandings", () => ({ useStandings: () => ({ standings: null, loading: false }) }));

function board(o: Partial<PzBoard> = {}): PzBoard {
  const L = fakeLineup("3-2-1", ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"]);
  L.takers = { penalties: ["alcides"], freekicks: ["adrian"], corners: ["eguzquiza"] };
  L.plan = { claves: ["Presión alta los diez primeros minutos"], viz: [], notes: "", parado: null };
  L.rival = { formation: "2-3-1", players: [{}, {}, {}, { num: 7, note: "El mejor" }, {}, {}, {}] };
  L.condPlan = [{ id: "r1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva" }];
  return fakeBoard({ lineup: L, ...o });
}

describe("Plan · status", () => {
  it("counts the five parts (notas is optional)", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }), place: "plan" });
    const s = partsStatus(P);
    expect(s.st).toMatchObject({ rival: true, claves: true, juego: false, parado: false, sipasa: true, notas: false });
    expect(s.done).toBe(3);
    expect(s.miss).toEqual(["juego", "parado"]);
  });
});

describe("Plan · the pitch", () => {
  it("set pieces: no two shirts within a shirt's width of each other", () => {
    const b = board();
    b.lineup.plan = { claves: [], viz: [], notes: "", parado: { corners: { playId: null, box: ["erik", "alcides", "adrian", "fer"] }, freekicks: { playId: null, box: ["erik", "alcides", "adrian", "fer"] }, penalties: { rechace: ["erik", "adrian"] } } };
    const { P } = makeTestStore({ world: fakeWorld({ boards: [b] }), place: "plan", sub: "parado" });
    for (const kind of ["corners", "freekicks", "penalties"] as const) {
      const s = planStage(P, { part: "parado", ui: { ...PLAN_UI0, kind }, layout: "desktop", plays: [], rivalName: "Red Demons", lineHandle: null });
      const t = s.tokens ?? [];
      expect(t).toHaveLength(7);
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) expect([kind, t[i].label, t[j].label, Math.abs(t[i].x - t[j].x) >= 18 || Math.abs(t[i].y - t[j].y) >= 11]).toEqual([kind, t[i].label, t[j].label, true]);
    }
  });
  it("a linked corner replays as a `jugada` with the seven by slot", () => {
    const b = board();
    b.lineup.plan = { claves: [], viz: [], notes: "", parado: { corners: { playId: "lib-corner", box: [] }, freekicks: { playId: null, box: [] }, penalties: { rechace: [] } } };
    const { P } = makeTestStore({ world: fakeWorld({ boards: [b] }), place: "plan" });
    const s = planStage(P, { part: "parado", ui: { ...PLAN_UI0, showPlay: true, step: 1 }, layout: "desktop", plays: libraryPlays(b.lineup), rivalName: "", lineHandle: null });
    expect(s.source).toBe("jugada");
    expect(s.play?.steps[0].p).toHaveLength(7);
    expect(s.step).toBe(1);
  });
  it("the defensive line's handle sits at the touchline, never over the middle shirts", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }), place: "plan" });
    const h = { axis: "y" as const, min: 60, max: 80, label: "Línea", onMove: () => undefined };
    const s = planStage(P, { part: "juego", ui: PLAN_UI0, layout: "desktop", plays: [], rivalName: "", lineHandle: h });
    const grip = s.overlay?.paths.find((p) => p.handle);
    const xs = (grip?.pts ?? []).map((q) => q[0]);
    expect(Math.min(...xs)).toBeGreaterThan(88);
  });
  it("stageHas ignores callbacks and compares what the place sets", () => {
    expect(stageHas({ source: "tokens", caption: "a", glideMs: 3 }, { source: "tokens", caption: "a" })).toBe(true);
    expect(stageHas({ source: "siete" }, { source: "tokens" })).toBe(false);
  });
});

describe("Plan · the place", () => {
  it("lead: the headline, the ring and the six parts; a part opens its address", async () => {
    const { host, flush } = renderWithPz(<Plan region="lead" layout="desktop" />, { world: fakeWorld({ boards: [board()] }), me: ME_CAPTAIN, place: "plan", sub: "rival" });
    await flush();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Al plan le faltan 2 partes");
    expect(screen.getByRole("img", { name: "3 de 5 partes listas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Nuestras claves/ }));
    expect(host.navigate).toHaveBeenCalled();
    expect(String(host.navigate.mock.calls.at(-1)?.[0] ?? "")).toContain("/pizarra/plan/claves");
  });
  it("claves: adding an idea writes the plan (undoable, with its viz)", async () => {
    const { P, host, flush } = renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [board()] }), me: ME_CAPTAIN, place: "plan", sub: "claves" });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Juntos atrás cuando la pierdan" }));
    await flush();
    expect(host.commit).toHaveBeenCalled();
    const plan = P.sel.board()?.lineup.plan;
    expect(plan?.claves).toEqual(["Presión alta los diez primeros minutos", "Juntos atrás cuando la pierdan"]);
    expect(plan?.viz).toEqual([
      { icon: "spark", zona: "arriba" },
      { icon: "users", zona: "atras" },
    ]);
    P.act.undo();
    expect(P.sel.board()?.lineup.plan?.claves).toHaveLength(1);
  });
  it("si pasa: a chip changes the rule («empatando» stores by 0)", async () => {
    const { P, flush } = renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [board()] }), me: ME_CAPTAIN, place: "plan", sub: "sipasa" });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Si vamos: perdiendo. Cambiar" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "empatando" }));
    await flush();
    expect(P.sel.board()?.lineup.condPlan?.[0]).toMatchObject({ when: "empate", by: 0 });
  });
  it("a player reading someone else's board sees no editors, and the text instead", async () => {
    const b = board({ ownerUid: "u-jordi", isOfficial: true });
    renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [b], official: { boardId: "b1", matchId: "j3" } }), me: ME_PLAYER, place: "plan", sub: "sipasa" });
    expect(screen.queryByRole("button", { name: /Cambiar$/ })).toBeNull();
    expect(screen.getByText("perdiendo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Añadir/ })).toBeNull();
  });
  it("notas: saved on blur, trimmed", async () => {
    const { P, flush } = renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [board()] }), me: ME_CAPTAIN, place: "plan", sub: "notas" });
    await flush();
    const ta = screen.getByRole("textbox", { name: "Notas para la charla" });
    fireEvent.change(ta, { target: { value: "  A por ellos  " } });
    fireEvent.blur(ta);
    await flush();
    expect(P.sel.board()?.lineup.plan?.notes).toBe("A por ellos");
  });
});

describe("Plan · bugs of the old pizarra (BUGS.md)", () => {
  it("B-PZ-15: «1 nota», never «1 notas»", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }), place: "plan" });
    expect(partSubs(P).rival).toBe("2-3-1 · 1 nota · cuidado con su 7");
  });
  it("B-PZ-14: in «Si pasa…» the one coming in can't be the one going off", async () => {
    const b = board();
    b.lineup.condPlan = [{ id: "r1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", sub: { out: "alcides", in: "kevin" } }];
    const { P, flush } = renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [b] }), me: ME_CAPTAIN, place: "plan", sub: "sipasa" });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^El cambio: entra KEVIN por ALCIDES/ }));
    await flush();
    // «Sale KEVIN»… he isn't on the pitch, so he can't be picked to go off; picking ALCIDES keeps KEVIN coming in
    fireEvent.click(screen.getAllByRole("button", { name: "ALCIDES" })[0]);
    await flush();
    const r = P.sel.board()?.lineup.condPlan?.[0];
    expect(r?.sub).toEqual({ out: "alcides", in: "kevin" });
    expect(r?.sub?.in).not.toBe(r?.sub?.out);
  });
  it("B-PZ-01: undoing a plan edit gives back only the plan (the seven and the rival stay)", () => {
    const { P } = makeTestStore({ world: fakeWorld({ boards: [board()] }), place: "plan" });
    P.act.place("kevin", 6);
    P.act.saveBoard({ plan: { claves: ["Otra"], viz: [], notes: "", parado: null } }, "Clave");
    P.act.undo();
    expect(P.sel.board()?.lineup.plan?.claves).toEqual(["Presión alta los diez primeros minutos"]);
    expect(P.sel.board()?.lineup.slots[6].playerId).toBe("kevin");
    expect(P.sel.board()?.lineup.rival?.players[3].num).toBe(7);
  });
  it("A-JUG-27: a read-only board can still preview the styles on the pitch", async () => {
    const b = board({ isOfficial: true });
    const { P, flush } = renderWithPz(<Plan region="side" layout="desktop" />, { world: fakeWorld({ boards: [b], official: { boardId: "b1", matchId: "j3" } }), me: ME_PLAYER, place: "plan", sub: "juego" });
    await flush();
    const st = screen.getByRole("button", { name: /^Bloque bajo y contra/ });
    expect(st).not.toBeDisabled();
    fireEvent.click(st);
    await flush();
    expect(P.state.slices.planUi).toMatchObject({ preview: "bloque" });
    expect(screen.getByText("Solo es una vista previa: el estilo lo cambia el capitán.")).toBeInTheDocument();
  });
});
