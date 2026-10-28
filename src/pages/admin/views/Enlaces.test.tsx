import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { resetWhistledForTests } from "../data/whistleStore";
import { Convocar } from "./Convocar";
import { Partidos } from "./Partidos";

// The Sala de control's ways out to the rest of the app for the same match or player: «Ver en la web»
// (the match head, ⌘K), Convocar's «La pizarra» reader → the match's official board, and
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
    mountAdmin("/admin/partidos/m6/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
    // (r12: the match's head says it, over every station)
    const head = document.querySelector(".sc-mhead") as HTMLElement;
    expect(within(head).getByRole("link", { name: /Ver en la web/ })).toHaveAttribute("href", "/partidos/m6");
  });

  it("a draft not in the calendar yet has no public page: no link", async () => {
    // (the J2 only as a draft: out of the published matches)
    setAdminData(adminFixture({ published: fixturePublished.filter((m) => m.id !== "m7") }));
    mountAdmin("/admin/partidos/m7/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
    expect(within(document.querySelector(".sc-mhead") as HTMLElement).queryByRole("link", { name: /Ver en la web/ })).toBeNull();
  });

  it("⌘K: «Ver en la web» opens the match's public page", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    const router = mountAdmin("/admin/partidos/m6/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
    const list = await palette(user, "ver en la web");
    await user.click(within(list).getByRole("option", { name: /Ver en la web/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/partidos/m6"));
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
    const router = mountAdmin("/admin/partidos/m6/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
    const list = await palette(user, "pizarra");
    const options = within(list).getAllByRole("option", { name: /Abrir la pizarra/ });
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining("Abrir la pizarra (J1 · Emirates)")]);
    await user.click(options[0]);
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tablero: "b6", season: "t1" }));
  });

  it("a played match with only the season's official: no command for it", async () => {
    setAdminData(adminFixture({ officialLocks: { t1__temporada: "s1" } }));
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m6/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
    await palette(user, "pizarra");
    expect(screen.queryByRole("option", { name: /Abrir la pizarra \(J1 · Emirates\)/ })).toBeNull();
  });

  it("no official board anywhere: no pizarra command", async () => {
    setAdminData(adminFixture());
    const user = userEvent.setup();
    mountAdmin("/admin/partidos/m6/acta", { partidos: Partidos });
    await screen.findByRole("region", { name: "El acta del partido" });
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
