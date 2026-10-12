import { afterEach, describe, expect, it, vi } from "vitest";
import { NUEVO_DESDE, NUEVO_DIAS, noteToolOpened, nuevoOn, RAIL } from "./rail";

// The «nuevo» badges expire: once the tool has been opened twice on this device, and for everyone 30
// days after they went up. A storage that throws never breaks the rail.

const DAY = 86_400_000;
const soon = NUEVO_DESDE + DAY;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the «nuevo» badges", () => {
  it("go after the tool has been opened twice", () => {
    expect(nuevoOn("jugadas", soon)).toBe(true);
    noteToolOpened("jugadas");
    expect(nuevoOn("jugadas", soon)).toBe(true);
    noteToolOpened("jugadas");
    expect(nuevoOn("jugadas", soon)).toBe(false);
    noteToolOpened("jugadas");
    expect(JSON.parse(localStorage.getItem("mp_pizarra_nuevo") ?? "{}")).toEqual({ jugadas: 2 });
    // the other tools keep theirs
    expect(nuevoOn("dibujar", soon)).toBe(true);
  });

  it("go for everyone 30 days after they went up", () => {
    expect(nuevoOn("dibujar", NUEVO_DESDE + NUEVO_DIAS * DAY - 1)).toBe(true);
    expect(nuevoOn("dibujar", NUEVO_DESDE + NUEVO_DIAS * DAY)).toBe(false);
  });

  it("the rail reads them live (Jugadas, Dibujar and Pachanga wear one)", () => {
    vi.spyOn(Date, "now").mockReturnValue(soon);
    const items = RAIL.flatMap((g) => g.items);
    expect(items.filter((x) => x.nv).map((x) => x.m)).toEqual(["jugadas", "dibujar", "pachanga"]);
    noteToolOpened("dibujar");
    noteToolOpened("dibujar");
    expect(items.filter((x) => x.nv).map((x) => x.m)).toEqual(["jugadas", "pachanga"]);
  });

  it("a storage that throws: the badges stay, nothing breaks", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => noteToolOpened("jugadas")).not.toThrow();
    expect(nuevoOn("jugadas", soon)).toBe(true);
  });
});
