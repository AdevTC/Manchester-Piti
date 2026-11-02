// r14 «La pizarra» · Tableros: the regions over a fake store (the gallery's groups and filters, the inspector's
// rename with its errors and delete with 12 s, Comparar's rows, the phone peek).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../../campo/PiCampo", () => ({ PiCampo: () => <div data-testid="campo" /> }));
vi.mock("../../../data/history", async (orig) => ({ ...(await orig<typeof import("../../../data/history")>()), useBoardHistory: () => ({ snaps: [], loading: false, error: false }) }));
vi.mock("../../../../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../../../../../lib/useSetSeason", () => ({ useSetSeason: () => () => undefined }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, className }: { children: unknown; className?: string }) => <a className={className}>{children as never}</a> }));
const fake = vi.hoisted(() => ({
  ops: {
    doc: () => undefined,
    isMesa: (id: string) => id === "m1",
    mesaCopies: () => ["m1"],
    create: vi.fn(async () => null),
    duplicate: vi.fn(async () => null),
    rename: vi.fn(async (_id: string, raw: string) => (raw.trim() ? "" : "Ponle un nombre al tablero")),
    link: vi.fn(async () => undefined),
    quitarOficial: vi.fn(),
    restore: vi.fn(),
    cleanMesa: vi.fn(),
  },
}));
vi.mock("./ops", async (orig) => ({ ...(await orig<typeof import("./ops")>()), useTablerosOps: () => fake.ops }));

import { fakeBoard, fakeWorld, ME_CAPTAIN, ME_PLAYER, renderWithPz } from "../../store/testkit";
import { Tableros } from "./Tableros";
import { pb } from "./pb";

const world = fakeWorld({
  boards: [
    fakeBoard({ id: "off", name: "J3 · Red Demons", isOfficial: true, ids: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"], updatedAt: 3 }),
    fakeBoard({ id: "b1", name: "Probando el 2-2-2", updatedAt: 2, matchId: null }),
    fakeBoard({ id: "e1", name: "Mi siete", ownerUid: "u-erik", ownerNick: "erik", updatedAt: 1 }),
    fakeBoard({ id: "m1", name: "Siete del campo · J3", ownerUid: "u-fer", ownerNick: "fer", updatedAt: 0 }),
  ],
  official: { boardId: "off", matchId: "j3" },
});

beforeEach(() => {
  pb.reset();
  Object.values(fake.ops).forEach((f) => (typeof f === "function" && "mockClear" in f ? (f as { mockClear: () => void }).mockClear() : undefined));
});

describe("the gallery", () => {
  it("features the official with its reactions in words, then yours and the team's (la mesa's copy marked)", async () => {
    const { r, attach, flush } = renderWithPz(<Tableros region="stage" layout="desktop" />, { world, boardId: "b1", place: "tableros" });
    attach({ reactions: { ok: 9, dudas: 2, mine: null } });
    await flush();
    const groups = r.container.querySelectorAll(".pb-grp");
    expect([...groups].map((g) => g.querySelector("h2")?.textContent)).toEqual(["El oficial", "Tuyos", "Del equipo"]);
    expect(r.container.querySelector(".pb-feat")?.textContent).toContain("9 de acuerdo · 2 con dudas");
    expect(within(groups[2] as HTMLElement).getByText("De la mesa")).toBeTruthy();
    expect(within(groups[1] as HTMLElement).getByText("Abierto")).toBeTruthy();
  });
  it("filters, searches and counts", async () => {
    const { r, flush } = renderWithPz(<Tableros region="stage" layout="desktop" />, { world, boardId: "b1", place: "tableros" });
    fireEvent.click(screen.getByRole("button", { name: /Del equipo/ }));
    await flush();
    expect([...r.container.querySelectorAll(".pb-grp h2")].map((h) => h.textContent)).toEqual(["Del equipo"]);
    expect(screen.getByRole("status").textContent).toBe("2 de 4 tableros");
    act(() => pb.set({ filtro: "todos", q: "zzz" }));
    expect(screen.getByText("Ningún tablero coincide")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(r.container.querySelectorAll(".pb-grp")).toHaveLength(3);
  });
  it("a player reads the team's boards: «Duplicar» on someone else's card", async () => {
    const { flush } = renderWithPz(<Tableros region="stage" layout="desktop" />, { world, me: ME_PLAYER, boardId: "e1", place: "tableros" });
    act(() => pb.set({ sel: "b1" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Duplicar «Probando el 2-2-2» para editarlo" }));
    expect(fake.ops.duplicate).toHaveBeenCalledWith("b1");
  });
});

describe("the inspector", () => {
  it("renames in place: Intro saves, an error stays under the field", async () => {
    const { flush } = renderWithPz(<Tableros region="side" layout="desktop" />, { world, me: ME_CAPTAIN, boardId: "b1", place: "tableros" });
    fireEvent.click(screen.getByRole("button", { name: "Renombrar «Probando el 2-2-2»" }));
    const input = screen.getByRole("textbox", { name: "Nombre del tablero" });
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();
    expect(fake.ops.rename).toHaveBeenCalledWith("b1", "  ");
    expect(screen.getByText("Ponle un nombre al tablero")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Contra Red Demons" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();
    expect(pb.get().editing).toBeNull();
  });
  it("deletes with 12 s to undo: the card goes, «Deshacer» in the gallery brings it back", async () => {
    const { P, host, flush, r } = renderWithPz(
      <>
        <Tableros region="side" layout="desktop" />
        <Tableros region="stage" layout="desktop" />
      </>,
      { world, boardId: "b1", place: "tableros" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Borrar «Probando el 2-2-2»" }));
    await flush();
    expect(host.remove).toHaveBeenCalledWith("b1");
    expect(pb.get().pend).toMatchObject({ kind: "board", ids: ["b1"] });
    expect(r.container.querySelector(".pb-pend")?.textContent).toContain("«Probando el 2-2-2» borrado");
    expect(P.state.toast?.long).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await flush();
    expect(pb.get().pend).toBeNull();
    expect(pb.get().hidden.b1).toBeUndefined();
  });
  it("someone else's board asks first (a captain)", async () => {
    renderWithPz(<Tableros region="side" layout="desktop" />, { world, boardId: "e1", place: "tableros" });
    fireEvent.click(screen.getByRole("button", { name: "Borrar «Mi siete»" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("«Mi siete» es de @erik: ¿lo borras?");
  });
  it("tags: suggestions add one, an error is said", async () => {
    const { host, flush } = renderWithPz(<Tableros region="side" layout="desktop" />, { world, boardId: "b1", place: "tableros" });
    fireEvent.click(screen.getByRole("button", { name: "Poner la etiqueta «Liga»" }));
    await flush();
    expect(host.commit).toHaveBeenCalledWith(expect.objectContaining({ tags: ["Liga"] }));
  });
  it("a captain on la mesa's copy can clean them all; on the official, take it off", async () => {
    const { P, flush } = renderWithPz(<Tableros region="side" layout="desktop" />, { world, boardId: "m1", place: "tableros" });
    fireEvent.click(screen.getByRole("button", { name: "Borrar las copias de la mesa de partidos jugados" }));
    expect(fake.ops.cleanMesa).toHaveBeenCalled();
    act(() => pb.set({ sel: "off" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Quitar «J3 · Red Demons» como oficial" }));
    expect(P.state.sheet?.name).toBe("pb-quitar");
  });
});

describe("Comparar", () => {
  it("the official against the board on screen: what changes, puesto by puesto", async () => {
    const { r } = renderWithPz(
      <>
        <Tableros region="lead" layout="desktop" />
        <Tableros region="side" layout="desktop" />
      </>,
      { world, boardId: "b1", place: "tableros", sub: "comparar" },
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Falta uno en B");
    expect(r.container.querySelector(".pb-chg")?.textContent).toContain("ALCIDES → nadie");
    fireEvent.click(screen.getByRole("button", { name: /Cambiar de lado/ }));
    expect(pb.get().cmpA).toBe("b:b1:titular");
  });
});

describe("the phone", () => {
  it("the peek: the count, the primary action, the strip; a tap previews a board on the pitch", async () => {
    const { P, flush } = renderWithPz(<Tableros region="peek" layout="phone" />, { world, boardId: "b1", place: "tableros", layout: "phone" });
    await flush();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("4 tableros");
    fireEvent.click(screen.getByRole("button", { name: /^Mi siete, 3-2-1/ }));
    await flush();
    expect(P.sel.stage()).toMatchObject({ source: "siete", boardId: "e1", camera: "grada" });
  });
});
