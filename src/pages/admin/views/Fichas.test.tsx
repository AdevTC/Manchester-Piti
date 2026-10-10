import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import type { ClaimLogRow } from "../club/clubLive";
import { Fichas } from "./Fichas";

const h = vi.hoisted(() => ({
  log: [] as ClaimLogRow[],
  writes: { resolveClaim: vi.fn((uid: string, approve: boolean) => Promise.resolve(void [uid, approve])) },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../club/clubLive", () => ({
  useClaimsLog: () => ({ data: h.log, loading: false, error: false }),
  useMembersVia: () => ({ data: [{ uid: "u1", via: "invite", by: "a2" }, { uid: "u2", via: "request", by: "a1" }], loading: false, error: false }),
}));

const row = (over: Partial<ClaimLogRow> & { uid: string }): ClaimLogRow => ({ playerId: "", playerName: "", nickname: "", email: "", status: "pending", at: 0, resolvedAt: 0, resolvedBy: "", ...over });
const cards = () => screen.queryAllByRole("article");
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;

describe("Fichas", () => {
  beforeEach(() => {
    localStorage.clear();
    h.writes.resolveClaim.mockClear();
    h.log = [
      row({ uid: "u1", playerId: "kevin", nickname: "nuevo.socio", email: "nuevo.socio@gmail.com", at: NOW - 2 * 3_600_000 }),
      row({ uid: "u2", playerId: "fer", nickname: "fer.portero12", email: "fernando.portero.doce.piti@gmail.com", at: Date.UTC(2026, 10, 1, 20, 40) }),
      row({ uid: "u3", playerId: "andia", nickname: "andia19", status: "approved", at: Date.UTC(2026, 9, 27), resolvedAt: Date.UTC(2026, 9, 28, 12), resolvedBy: "a2" }),
      row({ uid: "a2", playerId: "erik", nickname: "erik9", status: "approved", resolvedAt: Date.UTC(2026, 9, 20, 12), resolvedBy: "a2" }),
    ];
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("a claim card per request (who, which shirt, when, how they came in, e-mail); resolved folded; the shirts' percha; three notes", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByRole("heading", { level: 1, name: "Fichas" })).toBeInTheDocument();
    expect(screen.getByText("Socios que piden su camiseta · al aprobar, su cuenta queda unida a esa ficha")).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
    const kevin = screen.getByRole("article", { name: "@nuevo.socio pide la ficha de KEVIN" });
    expect(within(kevin).getByRole("heading", { level: 3 })).toHaveTextContent("quiere el 11 · KEVIN");
    expect(kevin.querySelector(".who")).toHaveTextContent("@nuevo.socio");
    expect(kevin.querySelector(".meta")).toHaveTextContent("hace 2 h · entró con la invitación de erik9nuevo.socio@gmail.com");
    expect(kevin.querySelector(".hang .sh b")).toHaveTextContent("11");
    expect(cards()[1].querySelector(".meta")).toHaveTextContent("ayer, 21:40 · llamó a la puerta y le abrió adrian_tc");
    // resolved, folded
    const fold = screen.getByRole("button", { name: "2 resueltas" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Fichas resueltas" })).toBeNull();
    await user.click(fold);
    const res = within(screen.getByRole("list", { name: "Fichas resueltas" })).getAllByRole("listitem");
    expect(res[0]).toHaveTextContent("@andia19 → ANDIA · Aprobada por erik9 · 28 oct");
    expect(within(res[0]).queryByRole("button")).toBeNull();
    expect(res[1]).toHaveTextContent("@erik9 → ERIK · Se aprobó sola (es administrador) · 20 oct");
    expect(within(res[1]).getByRole("button", { name: "Desvincular a @erik9 de ERIK" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Volver a pendiente/ })).toBeNull();
    // the percha: exceptions only
    const owners = screen.getByRole("region", { name: "Camisetas y socios" });
    expect(within(owners).getByText("La percha de las fichas · 2 de 12 camisetas ya tienen su socio")).toBeInTheDocument();
    const sub = (name: string) => [...owners.querySelectorAll(".peg")].find((p) => p.querySelector(".nm")?.textContent === name)?.querySelector(".rv")?.textContent ?? "";
    expect(sub("KEVIN")).toBe("pedida");
    expect(sub("FER")).toBe("pedida");
    expect(sub("EVANS")).toBe("sin socio");
    expect(sub("ERIK")).toBe("");
    expect(document.querySelector(".expl")).toHaveTextContent("Qué pasa al aprobar");
  });

  it("approves behind the «FICHA» lower third: Deshacer means the call never happens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    expect(cards()).toHaveLength(1);
    expect(caption()).toHaveTextContent("@nuevo.socio ya es KEVIN · su carta y su voto, activos");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("FICHA");
    expect(screen.getByText("La percha de las fichas · 3 de 12 camisetas ya tienen su socio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 resueltas" }));
    expect(within(screen.getByRole("list", { name: "Fichas resueltas" })).getAllByRole("listitem")[0]).toHaveTextContent("@nuevo.socio → KEVIN · Aprobada por adrian_tc · ahora mismo");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(cards()).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.resolveClaim).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rechazar la ficha de @fer.portero12" }));
    expect(caption()).toHaveTextContent("Ficha de @fer.portero12 rechazada · no se le avisa");
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("u2", false);
  });

  it("puts the card back and says so when the write fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.writes.resolveClaim.mockImplementationOnce(() => Promise.reject(new Error("sin red")));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido aprobar la ficha"));
    expect(cards()).toHaveLength(2);
  });

  it("«Desvincular» an approved one, behind «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/fichas", { fichas: Fichas });
    await user.click(await screen.findByRole("button", { name: "2 resueltas" }));
    await user.click(screen.getByRole("button", { name: "Desvincular a @erik9 de ERIK" }));
    expect(caption()).toHaveTextContent("@erik9 ya no es ERIK · su cuenta sigue en el vestuario");
    expect(screen.queryByRole("button", { name: "Desvincular a @erik9 de ERIK" })).toBeNull();
    expect(screen.getByText("La percha de las fichas · 1 de 12 camisetas ya tienen su socio")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("a2", false);
  });

  it("nothing pending: the dashed shirt «Fichas al día» and the way to invite", async () => {
    setAdminData(adminFixture({ claimsCount: 0 }));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByRole("heading", { level: 3, name: "Fichas al día" })).toBeInTheDocument();
    expect(document.querySelector(".void .sh")).toHaveClass("empty");
    expect(screen.getByRole("link", { name: "Invitar desde La puerta" })).toHaveAttribute("href", "/vestuario#puerta");
    expect(cards()).toHaveLength(0);
  });

  it("shows the loading state", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/fichas", { fichas: Fichas });
    expect(await screen.findByRole("status", { name: "Cargando las fichas" })).toBeInTheDocument();
  });
});
