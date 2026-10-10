import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import * as api from "../../../lib/clubApi";
import type { ClubMatch } from "../../../lib/clubData";
import { adminFixture, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { resetWhistledForTests } from "../data/whistleStore";
import { EnJuego } from "./EnJuego";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  liveEvent: vi.fn(() => Promise.resolve({ data: { events: 4 } })),
}));
const live = vi.mocked(api.liveEvent);

const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h - 1, m); // Madrid = UTC+1
const WIDTH = window.innerWidth;
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const EVENTS: MatchEvent[] = [
  { id: "live-1", type: "goal", minute: 12, playerId: "erik", assistPlayerId: "adrian" },
  { id: "live-2", type: "opponent_goal", minute: 24 },
];
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));
const playing = withJ8({ starters: SEVEN, bench: ["kevin", "almachi"], events: EVENTS });
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts")) as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  resetWhistledForTests();
  live.mockClear();
});
afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("En juego", () => {
  it("desktop: the LED, the log with «Deshacer lo último», the pads and the picker as a dialog", async () => {
    setAdminData(adminFixture({ now: at(8, 12, 31), published: playing }));
    const user = userEvent.setup();
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    expect(await screen.findByRole("heading", { level: 1, name: "En juego" })).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: "El marcador de la J3 en juego" });
    expect(within(hero).getByLabelText("PITI 1, MAD SKY 1")).toHaveTextContent("1-1");
    expect(within(hero).getByRole("list", { name: "Lo que va pasando" }).children).toHaveLength(2);
    await user.click(within(hero).getByRole("button", { name: "Deshacer lo último" }));
    expect(live).toHaveBeenLastCalledWith({ action: "undo", matchId: "m8" });
    expect(await screen.findByText("Deshecho lo último apuntado")).toBeInTheDocument();
    await user.click(within(hero).getByRole("button", { name: "GOL" }));
    const pick = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(pick).toHaveClass("lpk");
    await user.click(within(pick).getByRole("button", { name: "Marcó ERIK" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Quién le dio el pase?" })).getByRole("button", { name: "Sin asistencia" }));
    expect(live).toHaveBeenLastCalledWith({ action: "add", matchId: "m8", event: { type: "goal", minute: 32, playerId: "erik" } });
  });

  it("«Pitar el final» whistles it on this device and opens the acta («Deshacer» takes it back)", async () => {
    setAdminData(adminFixture({ now: at(8, 12, 31), published: playing }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    await user.click(await screen.findByRole("button", { name: "Pitar el final y repasar el acta" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
    expect(router.state.location.search).toMatchObject({ tab: "acta" });
    expect(caption()).toHaveTextContent("Final pitado · 1–1 · repasa el acta y publícala");
    expect(JSON.parse(localStorage.getItem("mp.admin.whistled.v1") ?? "{}")).toHaveProperty("m8");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(JSON.parse(localStorage.getItem("mp.admin.whistled.v1") ?? "{}")).not.toHaveProperty("m8");
  });

  it("phones: the tally, the LED, «Deshacer lo último» over the log, the pads; the picker is a sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    setAdminData(adminFixture({ now: at(8, 12, 31), published: playing }));
    const user = userEvent.setup();
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    expect(await screen.findByText("EN JUEGO")).toHaveClass("tally");
    expect(screen.getByText("J3 · LIGA · FUERA")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sala de control" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Deshacer lo último" }));
    expect(live).toHaveBeenLastCalledWith({ action: "undo", matchId: "m8" });
    await user.click(screen.getByRole("button", { name: "Tarjeta" }));
    const sheet = screen.getByRole("dialog", { name: "¿Qué tarjeta?" });
    expect(sheet).toHaveClass("sheet");
  });

  it("before kick-off and after the whistle it says so", async () => {
    setAdminData(adminFixture({ now: at(7, 22), published: playing }));
    mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    expect(await screen.findByRole("heading", { name: "Todavía no ha empezado" })).toBeInTheDocument();
    expect(screen.getByText("J3 · MAD SKY · dom 8 nov 12:00: el marcador se enciende al empezar.")).toBeInTheDocument();
  });

  it("after the end: «Repasar el acta»", async () => {
    setAdminData(adminFixture({ now: at(8, 14), published: playing }));
    const user = userEvent.setup();
    const router = mountAdmin("/admin/en-juego/m8", { enjuego: EnJuego });
    expect(await screen.findByRole("heading", { name: "Pitado el final" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Repasar el acta" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/partidos/m8"));
  });
});
