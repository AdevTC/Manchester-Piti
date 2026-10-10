import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../lib/clubApi";
import type { ClubMatch } from "../../../lib/clubData";
import { adminFixture, fixtureAnswers, fixturePublished, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Convocar } from "./Convocar";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({
  apiError: (e: unknown) => String(e),
  setConvocatoria: vi.fn(() => Promise.resolve({ data: { at: 1, revision: 1, notice: "first" } })),
}));
vi.mock("../convocar/live", async () => {
  const kit = await import("../../../test/adminKit");
  return { useMatchAnswers: (id: string | undefined) => ({ data: id === "m8" ? kit.fixtureAnswers : [], loading: false }) };
});
const setConv = vi.mocked(api.setConvocatoria);

const WIDTH = window.innerWidth;
const SIX = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik"];
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;

beforeEach(() => {
  localStorage.clear();
  setConv.mockClear();
  setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }) }));
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Convocar", () => {
  it("the switcher, the squad by answer, el siete on the pegs, the banquillo, the one source and its readers", async () => {
    expect(fixtureAnswers).toHaveLength(11);
    mountAdmin("/admin/convocar", { convocar: Convocar });
    expect(await screen.findByRole("heading", { level: 1, name: "Convocar" })).toBeInTheDocument();
    expect(screen.getByText("dom 8 nov · 12:00 · fuera · toca un jugador para el siete o el banquillo")).toBeInTheDocument();
    const sw = screen.getByRole("group", { name: "Partido" });
    expect(within(sw).getByRole("button", { name: "J3 · MAD SKY" })).toHaveAttribute("aria-pressed", "true");
    const pool = screen.getByRole("group", { name: "Jugadores por respuesta" });
    expect(within(pool).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Vienen 8", "En duda 2", "No vienen 1", "Sin responder 1"]);
    expect(within(pool).getByRole("button", { name: "EVANS en el siete" })).toHaveAttribute("aria-pressed", "true");
    expect(within(pool).getByRole("button", { name: "KEVIN en el banquillo" })).toHaveAttribute("aria-pressed", "true");
    expect(within(pool).getByText("DEL · sin colocar")).toBeInTheDocument();
    const sv = screen.getByRole("region", { name: "El siete · J3 · MAD SKY" });
    expect(within(sv).getByText("Falta 1 para el siete")).toHaveClass("warn");
    expect(within(sv).getByText("Ganchos delanteros · 6 de 7")).toBeInTheDocument();
    expect(within(sv).getByRole("button", { name: "Hueco libre en el siete" })).toHaveTextContent("Libre");
    expect(within(sv).getByRole("button", { name: "Quitar a KEVIN del banquillo" })).toBeInTheDocument();
    expect(within(sv).getByText(/Una sola convocatoria\./)).toBeInTheDocument();
    expect(sv.querySelector(".rdrs")).toHaveTextContent("La pizarraEl siete oficial · 6 de 7El actaTitulares y suplentesLos avisosPush a los convocados al publicar");
    expect(within(sv).getByText("Falta 1 para el siete · ANDIA, ALMACHI en duda")).toHaveClass("why");
    // gold only with seven
    expect(within(sv).getByRole("button", { name: "Publicar y avisar" })).toBeDisabled();
  });

  it("each tap is written at once: «Siete» hangs him (Deshacer puts it back), «Ya hay siete», a front peg goes down, the banquillo's shirt comes off", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/convocar", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "ADRIÁN T.C. en el siete" }));
    expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: [...SIX, "adrian"], bench: ["kevin", "almachi"], notify: false });
    expect(caption()).toHaveTextContent("ADRIÁN T.C. al siete · la pizarra y el acta ya lo ven");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("J3");
    expect(screen.getByRole("button", { name: "ADRIÁN T.C. en el siete: tocar para bajarlo al banquillo" })).toHaveClass("open");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: SIX, bench: ["kevin", "almachi"], notify: false }));
    await user.click(screen.getByRole("button", { name: "ADRIÁN T.C. en el siete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publicar y avisar" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Publicar y avisar" })).toHaveClass("gold");
    setConv.mockClear();
    await user.click(screen.getByRole("button", { name: "KEVIN en el siete" }));
    expect(caption()).toHaveTextContent("Ya hay siete: baja uno al banquillo antes");
    expect(setConv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "EVANS en el siete: tocar para bajarlo al banquillo" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: ["illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"], bench: ["kevin", "almachi", "evans"], notify: false }));
    await user.click(screen.getByRole("button", { name: "Quitar a KEVIN del banquillo" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: ["illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"], bench: ["almachi", "evans"], notify: false }));
    expect(screen.getByRole("button", { name: "KEVIN en el banquillo" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Hueco libre en el siete" }));
    expect(caption()).toHaveTextContent("Toca «Siete» en un jugador de la lista para colgarlo aquí");
  });

  it("«Publicar y avisar» at seven: the caption with «Deshacer» first, the notice after it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const SEVEN = [...SIX, "adrian"];
    setAdminData(adminFixture({ published: withJ8({ starters: SEVEN, bench: ["kevin", "almachi"] }) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const btn = await screen.findByRole("button", { name: "Publicar y avisar" });
    expect(screen.getByText("Listo: avisa por push a los 9 convocados")).toBeInTheDocument();
    await user.click(btn);
    expect(screen.getByText("Convocatoria J3 publicada · avisamos a los 9 convocados")).toBeInTheDocument();
    expect(screen.getByText("Publicada")).toHaveClass("okk");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(setConv).toHaveBeenCalledWith({ matchId: "m8", starters: SEVEN, bench: ["kevin", "almachi"], notify: true });
  });

  it("an announced convocatoria reads «Publicada»; changing it asks to announce it again", async () => {
    const SEVEN = [...SIX, "adrian"];
    setAdminData(adminFixture({ published: withJ8({ starters: SEVEN, bench: ["kevin", "almachi"], convocatoriaAt: 5, convocatoriaNotifiedAt: 5 }) }));
    const user = userEvent.setup();
    mountAdmin("/admin/convocar", { convocar: Convocar });
    expect(await screen.findByText("Publicada")).toHaveClass("okk");
    expect(screen.getByText("Publicada · los 9 convocados tienen el aviso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar y avisar" })).toBeNull();
    // the writes come back stamped after the notice (5): what is shown stays the local change
    const later = () => Promise.resolve({ data: { at: 10, revision: 2, notice: null } } as Awaited<ReturnType<typeof api.setConvocatoria>>);
    setConv.mockImplementationOnce(later).mockImplementationOnce(later).mockImplementationOnce(later);
    await user.click(screen.getByRole("button", { name: "ANDIA en el banquillo" }));
    expect(await screen.findByText("Ha cambiado: vuelve a avisar a los 10 convocados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar y avisar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "TELLO en el siete: tocar para bajarlo al banquillo" }));
    await user.click(screen.getByRole("button", { name: "KEVIN en el siete" }));
    expect(caption()).toHaveTextContent("KEVIN al siete · la pizarra y el acta ya lo ven · falta avisar");
  });

  it("«Copiar la convocatoria de la J2», undoable", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: [], bench: [] }) }));
    const user = userEvent.setup();
    mountAdmin("/admin/convocar", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "Copiar la convocatoria de la J2" }));
    expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"], bench: ["kevin", "almachi", "andia", "fer", "brawan"], notify: false });
    expect(caption()).toHaveTextContent("Convocatoria de la J2 copiada · la pizarra y el acta ya lo ven");
    expect(screen.queryByRole("button", { name: "Copiar la convocatoria de la J2" })).toBeNull();
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: [], bench: [], notify: false }));
  });

  it("a match only in the drafts can be set but not announced yet", async () => {
    const SEVEN = [...SIX, "adrian"];
    const base = adminFixture({ published: fixturePublished.filter((m) => m.id !== "m8") });
    const draft8 = { ...fixturePublished[0], starters: SEVEN, bench: [], draft: true, published: false, jornada: 3 };
    setAdminData({ ...base, matches: [...base.matches, draft8] });
    mountAdmin("/admin/convocar", { convocar: Convocar });
    expect(await screen.findByText("El partido aún no está en el calendario: publícalo en Partidos para avisar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar y avisar" })).toBeDisabled();
  });

  it("nothing to play: the empty shirt and «Nuevo partido»", async () => {
    setAdminData(adminFixture({ published: fixturePublished.filter((m) => m.id !== "m8") }));
    mountAdmin("/admin/convocar", { convocar: Convocar });
    expect(await screen.findByText("Sin partidos por jugar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo partido" })).toHaveClass("gold");
  });

  it("phones: the switcher, el siete on the small rail, the pool and the sticky «Publicar y avisar»", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const s7 = await screen.findByRole("region", { name: "El siete de la J3" });
    expect(s7.querySelector(".ch3")).toHaveTextContent("El siete · 6 de 7 Falta 1 para el siete");
    expect(within(s7).getByRole("button", { name: "EGUZQUIZA en el siete: tocar para bajarlo al banquillo" })).toHaveTextContent("EGUZQ.");
    expect(s7.querySelector(".hint")).toHaveTextContent("Banquillo: 11 KEVIN21 ALMACHI");
    expect(document.querySelector(".msticky")).toHaveTextContent("Falta 1 para el siete · ANDIA, ALMACHI en duda");
    expect(within(document.querySelector(".msticky") as HTMLElement).getByRole("button", { name: "Publicar y avisar" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Jugadores por respuesta" })).toBeInTheDocument();
  });
});
