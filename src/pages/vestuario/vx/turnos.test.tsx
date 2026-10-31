import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Rota, Turn } from "../../../lib/derived/rota";
import type { VxCtx } from "./ctx";

// The room «Turnos» with real models: the states, his job big with «Te toca», «La rueda» and «Marcar como hecho».
const state = vi.hoisted(() => ({
  rota: null as unknown,
  markTurnDone: vi.fn(async (..._a: unknown[]) => true),
}));
vi.mock("../../../lib/useRotaTurns", () => ({ useRota: () => ({ data: state.rota, loading: false, error: false }) }));
vi.mock("../live", () => ({
  useSeasonRotaTurns: () => ({ data: [], loading: false, error: false }),
  useAbsences: () => ({ data: [], loading: false, error: false }),
}));
vi.mock("../writes", () => ({ markTurnDone: state.markTurnDone }));
vi.mock("../../../lib/clubApi", () => ({ apiError: () => "Necesitas tu ficha de jugador para marcar un turno." }));
vi.mock("../../club/cb/ui", () => ({ Go: ({ href, children, className }: { href: string; children: unknown; className?: string }) => <a href={href} className={className}>{children as never}</a> }));

const { TurnosBlock } = await import("./Turnos");

const NOW = Date.UTC(2026, 9, 29, 10);
const ROTA: Rota = {
  jobs: [
    { id: "agua", name: "El agua", icon: "bottle", awayOnly: false, order: ["kevin", "jordi"] },
    { id: "coche", name: "Coche", icon: "car", awayOnly: true, order: ["kevin", "jordi"] },
  ],
};
const t = (job: Rota["jobs"][number], playerId: string | null, p: Partial<Turn> = {}): Turn => ({ job, playerId, computed: playerId, pinned: false, swappedFrom: null, skipped: [], frozen: false, ...p });
const match = (extra: Record<string, unknown> = {}) => ({ id: "m3", seasonId: "s1", status: "scheduled", date: Date.UTC(2026, 10, 1, 15), home: true, rival: "Red Demons", ...extra });
const say = vi.fn();
const go = vi.fn();
const ctx = (over: Partial<VxCtx> & { turns?: Turn[] } = {}) => {
  const next = ("next" in over ? over.next : match()) as VxCtx["next"];
  const turns = over.turns ?? [t(ROTA.jobs[0], "kevin")];
  return {
    me: { uid: "u1", name: "kevin", playerId: "kevin" },
    uid: "u1",
    playerId: "kevin",
    admin: false,
    seasonId: "s1",
    matches: next ? [next, match({ id: "m4", date: Date.UTC(2026, 10, 8, 15), home: false, rival: "Pitutis" })] : [],
    squad: [
      { id: "kevin", name: "Kevin", num: "9" },
      { id: "jordi", name: "Jordi", num: "4" },
    ],
    nameOf: (id: string) => (id === "kevin" ? "Kevin" : "Jordi"),
    now: NOW,
    summary: { turns, myTurn: turns.find((x) => x.playerId === "kevin") ?? null },
    say,
    go,
    ...over,
    next,
  } as unknown as VxCtx;
};

beforeEach(() => {
  state.rota = ROTA;
  state.markTurnDone.mockClear();
  say.mockClear();
});

it("his job big, «Tú, Kevin», the car off at home, and the wheel", () => {
  render(<TurnosBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Te toca: el agua");
  expect(screen.getByText("Te toca")).toBeTruthy();
  expect(screen.getByText("Tú, Kevin")).toBeTruthy();
  expect(screen.getByText("Nadie esta vez")).toBeTruthy();
  expect(screen.getByText("Solo fuera · este partido no")).toBeTruthy();
  // (the wheel: the next match as the page has it, then J2 away over it: Jordi carries the water, Kevin the car)
  expect(screen.getByRole("list", { name: "El agua: J1: te toca a ti, J2: Jordi" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "Coche: J1: en casa, no hay, J2: te toca a ti" })).toBeTruthy();
  expect(screen.getByText("Los turnos los reparten los capitanes. ¿No puedes? Cámbialo con alguien y díselo al capitán.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Marcar como hecho/ })).toBeNull();
});

it("a captain's swap, and nobody available", () => {
  render(<TurnosBlock c={ctx({ turns: [t(ROTA.jobs[0], "jordi", { pinned: true, swappedFrom: "kevin" })] })} />);
  expect(screen.getByText("cambio del capitán (le tocaba a Kevin)")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Turnos de la J1: 1 trabajo");
});

it("played: «Marcar como hecho» toggles through markTurnDone", async () => {
  render(<TurnosBlock c={ctx({ next: match({ status: "finished", date: Date.UTC(2026, 9, 25, 15) }) as VxCtx["next"] })} />);
  const btn = screen.getByRole("button", { name: /Marcar como hecho/ });
  expect(btn.getAttribute("aria-pressed")).toBe("false");
  await act(async () => fireEvent.click(btn));
  expect(state.markTurnDone).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), "m3", true);
  expect(say).toHaveBeenCalledWith("Turno hecho.");
  expect(screen.getByRole("button", { name: /Hecho/ }).getAttribute("aria-pressed")).toBe("true");
});

it("the states: no match, postponed, no rota (captain), no turns", () => {
  const { unmount } = render(<TurnosBlock c={ctx({ next: undefined })} />);
  expect(screen.getByRole("heading", { level: 2, name: "Sin partido a la vista" })).toBeTruthy();
  unmount();
  const r2 = render(<TurnosBlock c={ctx({ next: match({ status: "postponed" }) as VxCtx["next"] })} />);
  expect(screen.getByText("Sin turnos ni caja hasta que se juegue")).toBeTruthy();
  r2.unmount();
  state.rota = null;
  const r3 = render(<TurnosBlock c={ctx({ admin: true })} />);
  expect(screen.getByText("Aún no hay turnos esta temporada")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Crear los turnos/ }).getAttribute("href")).toBe("/admin/club/turnos");
  r3.unmount();
  state.rota = { jobs: [ROTA.jobs[1]] };
  render(<TurnosBlock c={ctx({ turns: [] })} />);
  expect(screen.getByText("Este partido no tiene turnos")).toBeTruthy();
});
