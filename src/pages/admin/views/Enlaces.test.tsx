import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { resetWhistledForTests } from "../data/whistleStore";
import { Convocar } from "./Convocar";
import { EnJuego } from "./EnJuego";
import { Partidos } from "./Partidos";

// The Sala de control's ways out to the rest of the app for the same match or player: «Ver en la web»
// (the match workspace, En juego, ⌘K), Convocar's «La pizarra» reader → the match's official board, and
// ⌘K's «Abrir la pizarra (J… · rival)». Real AdminLayout on a memory router; data from the fixture.

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
// (Convocar's Turnos panel has its own reads: none here)
vi.mock("../../../lib/useRotaTurns", () => ({ useMatchTurns: () => ({ turns: [], rota: null, pins: {}, loading: false, error: false }) }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  saveMatchSheet: vi.fn(() => Promise.resolve({ data: { id: "x" } })),
  deleteMatch: vi.fn(() => Promise.resolve({ data: { ok: true } })),
  liveEvent: vi.fn(() => Promise.resolve({ data: { events: 1 } })),
  setConvocatoria: vi.fn(() => Promise.resolve({ data: { at: 1, revision: 1, notice: "first" } })),
}));
vi.mock("../../../lib/matchPoster", () => ({ downloadMatchPoster: vi.fn(() => Promise.resolve()) }));
vi.mock("../partidos/live", () => ({
  useMatchNote: () => ({ data: "", loading: false }),
  useMatchRsvp: () => ({ data: [], loading: false }),
  useMatchMvp: () => undefined,
}));
vi.mock("../convocar/live", () => ({ useMatchAnswers: () => ({ data: [], loading: false }), useTeamAbsences: () => [] }));
vi.mock("../convocar/reminders", () => ({ useReminders: () => ({ auto: true, loading: false, set: () => Promise.resolve() }) }));

const WIDTH = window.innerWidth;
const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h - 1, m); // Madrid = UTC+1
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));
const palette = async (user: ReturnType<typeof userEvent.setup>, query: string) => {
  await user.keyboard("{Control>}k{/Control}");
  const dialog = screen.getByRole("dialog", { name: "Buscar" });
  await user.type(within(dialog).getByRole("combobox"), query);
  return within(dialog).getByRole("listbox", { name: "Resultados" });
};

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
});
afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("the match workspace · «Ver en la web»", () => {
  it("a match in the calendar links to its public page", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    const det = await screen.findByRole("region", { name: "Partido J1" });
    expect(within(det).getByRole("link", { name: /Ver en la web/ })).toHaveAttribute("href", "/matches/m6");
  });

  it("a draft not in the calendar yet has no public page: no link", async () => {
    // (the J2 only as a draft: out of the published matches)
    setAdminData(adminFixture({ published: fixturePublished.filter((m) => m.id !== "m7") }));
    mountAdmin("/admin/partidos/m7", { partidos: Partidos });
    const det = await screen.findByRole("region", { name: /^Partido / });
    expect(within(det).queryByRole("link", { name: /Ver en la web/ })).toBeNull();
  });

  it("⌘K: «Ver en la web» opens the match's public page", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    await screen.findByRole("region", { name: "Partido J1" });
    const list = await palette(user, "ver en la web");
    await user.click(within(list).getByRole("option", { name: /Ver en la web/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/matches/m6"));
  });
});

describe("En juego · «Ver en la web»", () => {
  const playing = () => adminFixture({ now: at(8, 12, 31), published: withJ8({ starters: SEVEN, bench: ["kevin"], events: [] }) });

  it("desktop: a button in the header, to the match's page (its directo)", async () => {
    setAdminData(playing());
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    await screen.findByRole("heading", { level: 1, name: "En juego" });
    expect(screen.getByRole("link", { name: /Ver en la web/ })).toHaveAttribute("href", "/matches/m8");
  });

  it("phones: an icon beside ← in the dark top row", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    setAdminData(playing());
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    const link = await screen.findByRole("link", { name: "Ver en la web" });
    expect(link).toHaveAttribute("href", "/matches/m8");
    expect(link).toHaveClass("bk");
  });

  it("before kick-off too (the previa)", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    await screen.findByText("Todavía no ha empezado");
    expect(screen.getByRole("link", { name: /Ver en la web/ })).toHaveAttribute("href", "/matches/m8");
  });
});

describe("Convocar · «La pizarra» opens the match's board", () => {
  it("with an official board: that board, in the match's season", async () => {
    setAdminData(adminFixture({ officialLocks: { t1__m8: "b8", t1__temporada: "s1" } }));
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await screen.findByRole("heading", { level: 1, name: "Convocar" });
    const link = screen.getByRole("link", { name: /La pizarra/ });
    expect(link).toHaveAttribute("href", "/pizarra?tablero=b8&season=t1");
    expect(link).toHaveTextContent(/El siete oficial · \d de 7/);
  });

  it("still to be played with only the season's official: that board", async () => {
    setAdminData(adminFixture({ officialLocks: { t1__temporada: "s1" } }));
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await screen.findByRole("heading", { level: 1, name: "Convocar" });
    expect(screen.getByRole("link", { name: /La pizarra/ })).toHaveAttribute("href", "/pizarra?tablero=s1&season=t1");
  });

  it("with none yet: the pizarra itself (to make and publish it)", async () => {
    setAdminData(adminFixture());
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await screen.findByRole("heading", { level: 1, name: "Convocar" });
    expect(screen.getByRole("link", { name: /La pizarra/ })).toHaveAttribute("href", "/pizarra?season=t1");
  });
});

describe("⌘K · «Abrir la pizarra (J… · rival)»", () => {
  it("from any section: Hoy's match on its official board", async () => {
    const hero = adminFixture().hero!.match;
    setAdminData(adminFixture({ officialLocks: { ["t1__" + hero.id]: "bh" } }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/temporadas");
    await screen.findByRole("banner");
    const list = await palette(user, "pizarra");
    const name = `Abrir la pizarra (J${hero.jornada} · ${hero.rival})`;
    const options = within(list).getAllByRole("option", { name: new RegExp(name.replace(/[()]/g, "\\$&")) });
    expect(options).toHaveLength(1);
    await user.click(options[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe("/pizarra"));
    expect(router.state.location.search).toMatchObject({ tablero: "bh", season: "t1" });
  });

  it("the match on screen too, once (none when it has no official board)", async () => {
    setAdminData(adminFixture({ officialLocks: { t1__m6: "b6", t1__temporada: "s1" } }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    await screen.findByRole("region", { name: "Partido J1" });
    const list = await palette(user, "pizarra");
    const options = within(list).getAllByRole("option", { name: /Abrir la pizarra/ });
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining("Abrir la pizarra (J1 · Emirates)")]);
    await user.click(options[0]);
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tablero: "b6", season: "t1" }));
  });

  it("a played match with only the season's official: no command for it", async () => {
    setAdminData(adminFixture({ officialLocks: { t1__temporada: "s1" } }));
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    await screen.findByRole("region", { name: "Partido J1" });
    await palette(user, "pizarra");
    expect(screen.queryByRole("option", { name: /Abrir la pizarra \(J1 · Emirates\)/ })).toBeNull();
  });

  it("no official board anywhere: no pizarra command", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m6", { partidos: Partidos });
    await screen.findByRole("region", { name: "Partido J1" });
    await palette(user, "pizarra");
    expect(screen.queryByRole("option", { name: /Abrir la pizarra/ })).toBeNull();
  });
});

describe("⌘K · a player's «Ver en la web»", () => {
  it("with his ficha open in Plantilla: his public page", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    const router = mountAdmin("/admin/plantilla?jugador=erik");
    await screen.findByRole("banner");
    const list = await palette(user, "ver en la web");
    const option = within(list).getByRole("option", { name: /Ver en la web/ });
    expect(option).toHaveTextContent("ERIK");
    await user.click(option);
    await waitFor(() => expect(router.state.location.pathname).toBe("/jugadores/erik"));
  });

  it("no ficha open: no such command", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/plantilla");
    await screen.findByRole("banner");
    await palette(user, "ver en la web");
    expect(screen.queryByRole("option", { name: /Ver en la web/ })).toBeNull();
  });
});
