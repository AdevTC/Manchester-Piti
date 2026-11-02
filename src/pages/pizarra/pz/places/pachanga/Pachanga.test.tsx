// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithPz, fakePlayer, fakeWorld, ME_CAPTAIN } from "../../store/testkit";

const src = vi.hoisted(() => ({
  value: {
    training: { id: "t-pz", slots: [{ id: "s1", at: Date.UTC(2026, 10, 12, 19, 30), place: "Pista de Entrevías" }], note: "", proposedBy: "u-jordi", proposedByName: "Jordi", lastSlotAt: 0, confirmed: { slotId: "s1", at: Date.UTC(2026, 10, 12, 19, 30), place: "Pista de Entrevías", byName: "Jordi" } },
    comes: { present: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides", "kevin"], guests: ["Rafa"], slotId: "s1" },
    attendance: null as null | { present: string[]; guests: string[]; at: number; by: string; slotId: string; trainingId: string },
    loading: false,
  },
  save: vi.fn(async () => undefined),
}));
vi.mock("../../../data/attendance", () => ({ usePachangaSource: () => src.value, saveAttendance: src.save }));

import "./register";
import { Pachanga } from "./Pachanga";
import { pgSlice } from "./pgStore";

const world = () => fakeWorld({ squad: [...fakeWorld().squad, fakePlayer("illescas", "ILLESCAS", 4, "DFC", 63)], absences: [{ pid: "illescas", from: "2026-11-10", to: "2026-11-14", note: "De viaje" }] });

beforeEach(() => {
  localStorage.clear();
  src.save.mockClear();
});

describe("Pachanga", () => {
  it("parte de los que dijeron «voy» al entreno y hace dos equipos con petos (palabra y dibujo)", async () => {
    const { P, flush } = renderWithPz(<Pachanga region="lead" layout="desktop" />, { place: "pachanga", world: world(), me: ME_CAPTAIN });
    await flush();
    const st = pgSlice(P).get();
    expect(st.comes).toHaveLength(9);
    expect(st.src).toBe("entreno");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/parejos|Descompensados/);
    expect(screen.getByRole("heading", { name: "Con petos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sin petos" })).toBeTruthy();
    expect(screen.getByText(/Pista de Entrevías/)).toBeTruthy();
    // the pitch: tokens with their bib pattern, the halves labelled once
    const stage = P.state.stage;
    expect(stage.tokens?.filter((t) => t.kind === "petos").every((t) => t.pat === "rayas")).toBe(true);
    expect(stage.labels?.map((l) => l.t.split(" · ")[0])).toEqual(["Con petos", "Sin petos"]);
    expect(P.sel.placeSub("pachanga")).toMatch(/^\d contra \d$/);
  });

  it("tocar a uno y luego a otro del otro equipo los cambia (con Deshacer)", async () => {
    const { P, flush } = renderWithPz(<Pachanga region="lead" layout="desktop" />, { place: "pachanga", world: world(), me: ME_CAPTAIN });
    await flush();
    const st = pgSlice(P).get();
    const a = st.teams[0][1];
    const b = st.teams[1][1];
    act(() => P.emit("token:tap", { id: "pg-" + a, pid: a }));
    await flush();
    expect(screen.getByRole("group", { name: /en la mano/ })).toBeTruthy();
    act(() => P.emit("token:tap", { id: "pg-" + b, pid: b }));
    await flush();
    expect(pgSlice(P).get().teams[0]).toContain(b);
    act(() => P.act.undo());
    await flush();
    expect(pgSlice(P).get().teams[0]).toContain(a);
  });

  it("Mezclar respeta al fijo y suena solo si los sonidos están encendidos", async () => {
    const { P, flush } = renderWithPz(<Pachanga region="panel" layout="phone" />, { place: "pachanga", world: world(), me: ME_CAPTAIN });
    await flush();
    const id = pgSlice(P).get().teams[1][0];
    act(() => P.emit("token:tap", { id: "pg-" + id, pid: id }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Fijar a/ }));
    await flush();
    for (let k = 0; k < 3; k++) {
      fireEvent.click(screen.getByRole("button", { name: "Mezclar" }));
      await flush();
      expect(pgSlice(P).get().teams[1]).toContain(id);
    }
  });

  it("«¿Quién ha venido?»: ausente con fecha, marcar a uno, alguien de fuera, guardar como asistencia", async () => {
    const { P, flush } = renderWithPz(<Pachanga region="side" layout="desktop" />, { place: "pachanga", world: world(), me: ME_CAPTAIN });
    const { seedFromTraining } = await import("./pgStore");
    const { srcSlice } = await import("./pgSource");
    act(() => {
      srcSlice(P).set({ loading: false, trainingId: "t-pz", slotId: "s1", at: Date.UTC(2026, 10, 12, 19, 30), place: "Pista de Entrevías", proposedBy: "u-jordi", present: src.value.comes.present, guests: ["Rafa"], saved: null }, { undoable: false, toast: false });
      seedFromTraining(P, { trainingId: "t-pz", present: src.value.comes.present, guests: ["Rafa"], saved: false });
    });
    await flush();
    expect(screen.getByRole("button", { name: /ILLESCAS\. Ausente · hasta el 14 nov \(De viaje\)\. No ha venido/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^ILLESCAS\./ }));
    await flush();
    expect(pgSlice(P).get().comes).toContain("illescas");
    fireEvent.change(screen.getByPlaceholderText("Alguien de fuera"), { target: { value: "Pepe" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    await flush();
    expect(pgSlice(P).get().comes).toContain("g:pepe");
    fireEvent.click(screen.getByRole("button", { name: "Guardar quién vino" }));
    await flush();
    expect(src.save).toHaveBeenCalledWith("t-pz", expect.objectContaining({ slotId: "s1", uid: "u-jordi", guests: expect.arrayContaining(["RAFA", "PEPE"]) }));
    const call = src.save.mock.calls[0] as unknown as [string, { present: string[] }];
    expect(call[1].present).toContain("illescas");
    expect(call[1].present).not.toContain("g:pepe");
  });
});
