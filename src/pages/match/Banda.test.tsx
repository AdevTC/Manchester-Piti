import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { LIVE_ACTIONS, withGuestNames } from "../../lib/liveActions";
import { Banda } from "./Banda";

// Characterisation of the Mesa de partido: what each tap sends to the liveEvent callable. These payloads
// were captured from Banda before it read the shared catalogue (src/lib/liveActions.ts); they pin the wire.
const api = vi.hoisted(() => ({ live: vi.fn<(payload: unknown) => Promise<{ data: { events: number } }>>(async () => ({ data: { events: 1 } })) }));
vi.mock("../../lib/clubApi", () => ({ liveEvent: api.live, apiError: (e: Error) => e.message }));
vi.mock("../../components/celeste/MatchClockControl", () => ({ MatchClockControl: () => null }));
// Banda mounts quick entry before switching to the detailed editor. Give that entry a
// signed-in scorer and an isolated, current snapshot without starting Firebase listeners.
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "banda-scorer" } }) }));
vi.mock("../../lib/syncStatus", () => ({ useSyncStatus: () => ({ online: true, fresh: true }) }));
const T0 = Date.UTC(2026, 9, 14, 10, 0);
const NOW = { t: T0 + 31 * 60_000 + 10_000 };
vi.mock("../../hooks/useClock", () => ({ useClock: () => NOW.t }));

const MATCH = { id: "m1", rival: "MAD SKY", status: "scheduled", clock: { phase: "first", revision: 3, firstStartedAt: T0 }, starters: ["evans", "tello", "erik", "adrian"], bench: ["kevin", "almachi"], events: [] } as unknown as ClubMatch;
const nameOf = (id: string) => id.toUpperCase();
const envelope = (event: Record<string, unknown>, manualTime = false) => ({ action: "add", matchId: "m1", requestId: "req-1", clockRevision: 3, manualTime, event });

/** Taps in order: a button's name, or [name, index among the buttons with that name] (-1 = the last). */
type Tap = string | [string, number];
function tapAll(taps: Tap[]) {
  for (const t of taps) {
    const [name, i] = typeof t === "string" ? [t, 0] : t;
    const all = screen.getAllByRole("button", { name });
    fireEvent.click(all.at(i) as HTMLElement);
  }
  fireEvent.click(screen.getByRole("button", { name: /Apuntar/ }));
}

beforeEach(() => {
  api.live.mockClear();
  localStorage.clear();
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("req-1" as `${string}-${string}-${string}-${string}-${string}`);
});
afterEach(() => vi.restoreAllMocks());

describe("Mesa de partido · the payload of every action", () => {
  const cases: [string, Tap[], Record<string, unknown>][] = [
    ["goal with an assist", ["Gol del Piti", "ERIK", ["ADRIAN", -1]], { type: "goal", minute: 31, assistReviewed: true, playerId: "erik", assistPlayerId: "adrian" }],
    ["goal without an assist", ["Gol del Piti", "ERIK"], { type: "goal", minute: 31, assistReviewed: true, playerId: "erik" }],
    ["opponent goal", ["Gol rival"], { type: "opponent_goal", minute: 31 }],
    ["yellow card (bench too)", ["Amarilla", "KEVIN"], { type: "yellow_card", minute: 31, playerId: "kevin" }],
    ["second yellow", ["Segunda amarilla", "TELLO"], { type: "double_yellow", minute: 31, playerId: "tello" }],
    ["red card", ["Roja", "EVANS"], { type: "red_card", minute: 31, playerId: "evans" }],
    ["substitution", ["Cambio", "TELLO", "KEVIN"], { type: "substitution", minute: 31, playerId: "tello", inPlayerId: "kevin" }],
    ["penalty saved", ["Penalti parado", "EVANS"], { type: "penalty_saved", minute: 31, playerId: "evans" }],
    ["woodwork", ["Al palo", "ERIK"], { type: "woodwork", minute: 31, playerId: "erik" }],
    ["penalty missed", ["Penalti fallado", "ADRIAN"], { type: "penalty_missed", minute: 31, playerId: "adrian" }],
    ["chance of a player", ["Ocasión del Piti", "ERIK"], { type: "chance", minute: 31, playerId: "erik" }],
    ["opponent chance", ["Ocasión rival"], { type: "opponent_chance", minute: 31 }],
    ["corner of a player", ["Córner del Piti", "TELLO"], { type: "corner", minute: 31, playerId: "tello" }],
    ["opponent corner", ["Córner rival"], { type: "opponent_corner", minute: 31 }],
  ];
  it.each(cases)("%s", (_, taps, event) => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll(taps);
    expect(api.live).toHaveBeenCalledTimes(1);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope(event));
  });

  // The one deliberate difference: before the catalogue this sent `playerId: undefined`, which the Firebase
  // SDK encodes as `"playerId": null` and the callable's zod schema (idSchema.optional()) refuses. Now the key
  // is left out, as the admin's «Apuntar al equipo, sin jugador» always sent it.
  it.each([["Ocasión del Piti", "chance"], ["Córner del Piti", "corner"]])("%s for the team, without a player", (label, type) => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll([label]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type, minute: 31 }));
  });

  it("a minute set by hand travels as manualTime", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    fireEvent.click(screen.getByRole("button", { name: "Un minuto menos" }));
    tapAll(["Gol rival"]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "opponent_goal", minute: 30 }, true));
  });
});

describe("Mesa de partido · what the admin's En juego had and the banda lacked", () => {
  it("parity: the buttons are the catalogue, in its order", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    const group = screen.getByRole("group", { name: "Qué ha pasado" });
    expect([...group.querySelectorAll("button")].map((b) => b.textContent)).toEqual(LIVE_ACTIONS.map((x) => x.label));
  });
  it("autogol del rival: one tap, no player", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll(["Autogol del rival"]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "opponent_own_goal", minute: 31 }));
  });
  it("a goal without its scorer only after «Lo completo luego», and it says what is missing", async () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    fireEvent.click(screen.getByRole("button", { name: "Gol del Piti" }));
    expect(screen.getByRole("button", { name: /Apuntar/ })).toBeDisabled();
    expect(screen.queryByText("¿Quién le dio el pase? (opcional)")).toBeNull();
    tapAll(["Lo completo luego · sin goleador"]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "goal", minute: 31, assistReviewed: false }));
    expect(await screen.findByText("Gol del Piti apuntado en el 32′. Falta el goleador: complétalo en el acta.")).toBeInTheDocument();
  });
  it("the minute is announced only when the scorer moves it, never on each tick of the clock", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    const out = screen.getByRole("status", { name: "Minuto 32" });
    expect(out).toHaveAttribute("aria-live", "off");
    fireEvent.click(screen.getByRole("button", { name: "Un minuto menos" }));
    expect(screen.getByRole("status", { name: "Minuto 31" })).toHaveAttribute("aria-live", "polite");
  });
  it("a write that fails is an alert, in words", async () => {
    api.live.mockRejectedValueOnce(new Error("Sin conexión con el servidor."));
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll(["Gol rival"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión con el servidor.");
  });
  it("with the clock stopped it says why nothing can be written", () => {
    const stopped = { ...MATCH, clock: undefined } as unknown as ClubMatch;
    render(<Banda match={stopped} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    expect(screen.getByText("Pon en marcha el reloj del partido para apuntar jugadas.")).toBeInTheDocument();
  });
  it("the scorer picked from the assist chips' player clears that assist (never his own assist)", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    fireEvent.click(screen.getByRole("button", { name: "Gol del Piti" }));
    fireEvent.click(screen.getByRole("button", { name: "ERIK" }));
    expect(screen.getByText("¿Quién le dio el pase? (opcional)")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "ADRIAN" }).at(-1) as HTMLElement); // assist: ADRIAN
    tapAll([["ADRIAN", 0]]); // then ADRIAN as the scorer
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "goal", minute: 31, assistReviewed: true, playerId: "adrian" }));
  });
  it("asks the catalogue's questions", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    const asked = (label: string) => (fireEvent.click(screen.getByRole("button", { name: label })), screen.getAllByText(/^¿/)[0].textContent);
    expect([asked("Amarilla"), asked("Cambio"), asked("Penalti parado"), asked("Al palo"), asked("Ocasión del Piti")]).toEqual(["¿A quién?", "¿Quién sale?", "¿Quién lo paró?", "¿Quién lo tiró?", "¿Qué jugador?"]);
    fireEvent.click(screen.getByRole("button", { name: "Cambio" }));
    expect(screen.getByText("¿Quién entra?")).toBeInTheDocument();
  });
  it("choosing a scorer after «Lo completo luego» writes him", () => {
    render(<Banda match={MATCH} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll(["Gol del Piti", "Lo completo luego · sin goleador", "ERIK"]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "goal", minute: 31, assistReviewed: true, playerId: "erik" }));
  });
  it("at the break only cards and changes can be written", () => {
    const halftime = { ...MATCH, clock: { phase: "halftime", revision: 3, firstStartedAt: T0, firstEndedAt: T0 + 25 * 60_000 } } as unknown as ClubMatch;
    render(<Banda match={halftime} nameOf={nameOf} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    for (const name of ["Gol del Piti", "Gol rival", "Autogol del rival", "Al palo", "Ocasión del Piti"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    for (const name of ["Amarilla", "Segunda amarilla", "Roja", "Cambio"]) expect(screen.getByRole("button", { name })).toBeEnabled();
  });
});

describe("Mesa de partido · invitados", () => {
  const GUEST = { ...MATCH, guests: [{ id: "g1", name: "Rafa" }], starters: ["evans", "guest:g1", "tello"], bench: ["guest:g2", "kevin"] } as unknown as ClubMatch;
  const named = withGuestNames(GUEST, nameOf);

  it("lists the guests after the members, with their words", () => {
    render(<Banda match={GUEST} nameOf={named} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    fireEvent.click(screen.getByRole("button", { name: /Amarilla$/ }));
    const names = Array.from(document.querySelectorAll(".fc-pick button")).map((b) => b.textContent);
    expect(names).toEqual(["EVANS", "TELLO", "KEVIN", "Rafa (invitado)", "Invitado"]);
    expect(screen.getByRole("button", { name: "Rafa (invitado)" })).toHaveClass("guest");
  });

  it("a guest's goal travels with his guest: reference", () => {
    render(<Banda match={GUEST} nameOf={named} />);
    fireEvent.click(screen.getByRole("button", { name: "Con detalle" }));
    tapAll(["Gol del Piti", "Rafa (invitado)", ["EVANS", -1]]);
    expect(api.live.mock.calls[0][0]).toStrictEqual(envelope({ type: "goal", minute: 31, assistReviewed: true, playerId: "guest:g1", assistPlayerId: "evans" }));
  });
});
