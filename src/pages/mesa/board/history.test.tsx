import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MesaView } from "../types";
import { makeView } from "../screens/testkit";
import { BoardScreens } from "./Board";
import { travelOf } from "./useBoard";
import { useSheetUrl, type SheetAddress, type SheetHistory } from "./useSheetUrl";

// La mesa's sheets in the address (Atrás closes them, Adelante opens them again, closing never leaves la mesa) and
// the boards' slide between screens (View Transitions through vidrio/transitions).

const swapped: string[] = [];
vi.mock("../../../components/vidrio/transitions", () => ({
  swap: (dir: string, update: () => void) => {
    swapped.push(dir);
    update();
    return { finished: Promise.resolve(), animated: true };
  },
}));
vi.mock("../useLlegada", () => ({
  useLlegada: () => ({ squad: new Map(), conv: null, loading: false, present: [], toggle: vi.fn(), save: "idle", error: "", retry: vi.fn() }),
}));

/** A browser history of la mesa's addresses: a stack and where we are in it. */
function fakeHistory(start: SheetAddress = { hoja: "", j: null }) {
  const h = { stack: [start], at: 0, calls: [] as string[] };
  const listeners = new Set<() => void>();
  const ping = () => listeners.forEach((f) => f());
  const api: SheetHistory & { forward(): void; current(): SheetAddress; on(f: () => void): () => void } = {
    push: (hoja, j) => {
      h.calls.push(`push ${hoja}`);
      h.stack = [...h.stack.slice(0, h.at + 1), { hoja, j }];
      h.at++;
      ping();
    },
    replace: (hoja, j) => {
      h.calls.push(`replace ${hoja ?? "-"}`);
      h.stack[h.at] = { hoja: hoja ?? "", j };
      ping();
    },
    back: () => {
      h.calls.push("back");
      if (h.at > 0) h.at--;
      ping();
    },
    forward: () => {
      if (h.at < h.stack.length - 1) h.at++;
      ping();
    },
    current: () => h.stack[h.at],
    on: (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
  return { h, api };
}

function useFake(fake: ReturnType<typeof fakeHistory>) {
  // (the address as state, as the router hands it over)
  const [at, setAt] = useState(() => fake.api.current());
  useEffect(() => fake.api.on(() => setAt({ ...fake.api.current() })), [fake]);
  return useSheetUrl(at, fake.api);
}

describe("la hoja en la dirección", () => {
  it("abrir empuja una entrada; cerrarla desde la página vuelve atrás sobre ella", () => {
    const fake = fakeHistory();
    const { result } = renderHook(() => useFake(fake));
    act(() => result.current.open("reloj"));
    expect(fake.h.calls).toEqual(["push reloj"]);
    expect(result.current.hoja).toBe("reloj");
    act(() => result.current.close());
    expect(fake.h.calls).toEqual(["push reloj", "back"]);
    expect(result.current.hoja).toBe("");
    expect(fake.h.stack).toHaveLength(2);
  });
  it("una hoja que llega con la dirección se cierra reemplazando: nunca se sale de la mesa", () => {
    const fake = fakeHistory({ hoja: "reloj", j: null });
    const { result } = renderHook(() => useFake(fake));
    act(() => result.current.close());
    expect(fake.h.calls).toEqual(["replace -"]);
    expect(fake.h.at).toBe(0);
  });
  it("Atrás la cierra y Adelante la vuelve a abrir; cerrarla entonces vuelve atrás", () => {
    const fake = fakeHistory();
    const { result } = renderHook(() => useFake(fake));
    act(() => result.current.open("jugador", "mario"));
    act(() => fake.api.back());
    expect(result.current.hoja).toBe("");
    act(() => fake.api.forward());
    expect(result.current).toMatchObject({ hoja: "jugador", j: "mario" });
    act(() => result.current.close());
    expect(fake.h.calls.at(-1)).toBe("back");
  });
  it("abrir otra hoja con una abierta la reemplaza (sin rastro de entradas)", () => {
    const fake = fakeHistory();
    const { result } = renderHook(() => useFake(fake));
    act(() => result.current.open("mas"));
    act(() => result.current.open("rival"));
    expect(fake.h.calls).toEqual(["push mas", "replace rival"]);
    act(() => result.current.close());
    expect(fake.h.at).toBe(0);
  });
});

function Page({ view, fake }: { view: MesaView; fake: ReturnType<typeof fakeHistory> }) {
  const sheet = useFake(fake);
  return <BoardScreens view={view} sheet={sheet} />;
}
const playing = () => makeView({ clock: { phase: "first", playing: true, minute: 12, elapsedSeconds: 690, periodSeconds: 690, text: "11:30" } });

describe("en la mesa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    swapped.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it("Atrás del móvil cierra la hoja del jugador; Adelante la abre otra vez", () => {
    const fake = fakeHistory();
    render(<Page view={playing()} fake={fake} />);
    fireEvent.click(screen.getByRole("button", { name: /^Sergio,.*abrir sus acciones/ }));
    expect(fake.api.current()).toEqual({ hoja: "jugador", j: "sergio" });
    expect(screen.getByRole("dialog", { name: "SERGIO" })).toBeInTheDocument();
    act(() => fake.api.back());
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => fake.api.forward());
    expect(screen.getByRole("dialog", { name: "SERGIO" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fake.h.at).toBe(0);
  });
  it("el gol no toca el historial; apuntar desde la hoja la cierra volviendo atrás", () => {
    const fake = fakeHistory();
    render(<Page view={playing()} fake={fake} />);
    fireEvent.click(screen.getByRole("button", { name: /^Gol del Piti/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lo apunto luego" }));
    expect(fake.h.calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /^Mario,.*abrir sus acciones/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ocasión" }));
    expect(fake.h.calls).toEqual(["push jugador", "back"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("una hoja de una jugada que ya no está se cierra sola", () => {
    const fake = fakeHistory({ hoja: "editar", j: "no-existe" });
    render(<Page view={playing()} fake={fake} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fake.h.calls).toEqual(["replace -"]);
  });
});

describe("el paso entre fases, como los tableros", () => {
  beforeEach(() => {
    swapped.length = 0;
  });
  it("del pitido al juego y a las vistas de la mesa se desliza; el descanso, el final y el acta cambian en su sitio", () => {
    expect(travelOf("antes", "juego")).toBe("right");
    expect(travelOf("antes", "lista")).toBe("right");
    expect(travelOf("juego", "cronica")).toBe("right");
    expect(travelOf("cronica", "juego")).toBe("left");
    expect(travelOf("juego", "descanso")).toBeNull();
    expect(travelOf("descanso", "juego")).toBeNull();
    expect(travelOf("juego", "final")).toBeNull();
    expect(travelOf("final", "publicado")).toBeNull();
  });
  it("pitar el inicio pasa a la mesa en juego con la transición; el descanso, sin ella", () => {
    const v = makeView();
    const { rerender } = render(<BoardScreens view={v} />);
    rerender(<BoardScreens view={{ ...v, match: { ...v.match, clock: { ...v.match.clock, phase: "first", playing: true } } }} />);
    expect(swapped).toEqual(["right"]);
    expect(screen.getByRole("button", { name: /^Gol del Piti/ })).toBeInTheDocument();
    rerender(<BoardScreens view={{ ...v, match: { ...v.match, clock: { ...v.match.clock, phase: "halftime", elapsedSeconds: 1500 } } }} />);
    expect(swapped).toEqual(["right"]);
    expect(screen.getByRole("heading", { name: /^Descanso/ })).toBeInTheDocument();
  });
});

describe("el descanso, en el orden del tablero", () => {
  it("lista a los convocados en el orden de la convocatoria (los titulares, luego el banquillo)", () => {
    const v = makeView({ clock: { phase: "halftime", elapsedSeconds: 1500 }, order: ["pablo", "alex", "hugo", "mario", "sergio", "dani", "marcos", "david", "ruben", "ivan"] });
    render(<BoardScreens view={v} />);
    const names = screen.getAllByRole("button", { name: /juega la 2ª: toca/ }).map((b) => b.getAttribute("aria-label")?.split(",")[0]);
    expect(names.slice(0, 4)).toEqual(["Pablo", "Álex", "Hugo", "Mario"]);
  });
});
