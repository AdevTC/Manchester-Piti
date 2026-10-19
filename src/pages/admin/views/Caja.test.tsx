import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CajaMov, CajaSettings, NewCajaMov } from "../../../lib/derived/caja";
import type { CajaClaim } from "../../../lib/derived/cajaClaims";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { Caja } from "./Caja";

vi.setConfig({ testTimeout: 15_000 });

// (fmtEuros puts a no-break space before «€»; the DOM matchers read it as a plain space)
const NB = " ";
const mov = (o: Partial<CajaMov> & Pick<CajaMov, "id">): CajaMov => ({ seasonId: "t1", kind: "cargo", playerId: "erik", amount: 1000, concept: "x", date: "2026-10-27", matchId: null, by: "a1", createdAt: 1, void: false, ...o });
const h = vi.hoisted(() => ({
  caja: { settings: null as unknown as CajaSettings, movs: [] as CajaMov[], loading: false, error: false },
  writes: {
    addMovs: vi.fn((seasonId: string, movs: readonly NewCajaMov[]) => Promise.resolve(void [seasonId, movs])),
    voidMov: vi.fn((id: string) => Promise.resolve(void id)),
    saveSettings: vi.fn((seasonId: string, s: unknown) => Promise.resolve(void [seasonId, s])),
    resolveClaim: vi.fn((claim: unknown, status: string) => Promise.resolve(void [claim, status])),
  },
  claims: { data: [] as CajaClaim[], loading: false, error: false },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../data/useCaja", () => ({ useCaja: () => h.caja, useCajaClaims: () => h.claims, useCajaWrites: () => h.writes }));

const MOVS: CajaMov[] = [
  mov({ id: "c1", kind: "cargo", playerId: "erik", amount: 1250, concept: "Campo y árbitro · J1 vs Emirates", matchId: "m6", date: "2026-10-27", createdAt: 1 }),
  mov({ id: "p1", kind: "pago", playerId: "evans", amount: 2000, concept: "Bizum", date: "2026-10-28", createdAt: 2 }),
  mov({ id: "g1", kind: "gasto", playerId: null, amount: 4500, concept: "Campo J1", date: "2026-10-27", createdAt: 3 }),
  mov({ id: "v1", kind: "cargo", playerId: "kevin", amount: 900, concept: "Error", date: "2026-10-29", createdAt: 4, void: true }),
];
const movItems = () => within(screen.getByRole("list", { name: "Movimientos" })).getAllByRole("listitem");

describe("Caja (admin)", () => {
  beforeEach(() => {
    localStorage.clear();
    h.writes.addMovs.mockClear();
    h.writes.voidMov.mockClear();
    h.writes.saveSettings.mockClear();
    h.writes.resolveClaim.mockClear();
    h.claims.data = [];
    h.caja.settings = { cuota: 3000, cuotaPeriod: "temporada", howToPay: "Bizum al 600 000 000", updatedAt: 0 };
    h.caja.movs = MOVS;
    setAdminData(adminFixture());
  });

  it("shows the jar, what is owed and the cuota; balances in words (who owes first) and the full log", async () => {
    mountAdmin("/admin/caja", { caja: Caja });
    expect(await screen.findByRole("heading", { level: 1, name: "Caja" })).toBeInTheDocument();
    const sum = screen.getByRole("region", { name: "La caja de la Temporada 1" });
    expect(sum).toHaveTextContent(`En el bote-25,00${NB}€`);
    expect(sum).toHaveTextContent(`Os deben12,50${NB}€1 jugador debe dinero`);
    expect(sum).toHaveTextContent(`Cuota30,00${NB}€Por temporada · Cómo pagar: Bizum al 600 000 000`);
    const rows = within(screen.getByRole("list", { name: /^Saldos/ })).getAllByRole("listitem");
    expect(rows).toHaveLength(12);
    expect(rows[0]).toHaveTextContent(`ERIK`);
    expect(rows[0]).toHaveTextContent(`Debe 12,50${NB}€`);
    expect(rows[1]).toHaveTextContent(`EVANS`);
    expect(rows[1]).toHaveTextContent(`A favor 20,00${NB}€`);
    expect(rows[2]).toHaveTextContent("Al día");
    const items = movItems();
    expect(items.map((li) => li.querySelector("b")?.textContent)).toEqual(["Error", "Bizum", "Campo J1", "Campo y árbitro · J1 vs Emirates"]);
    expect(items[0]).toHaveTextContent("Anulado");
    expect(within(items[0]).queryByRole("button")).toBeNull();
    expect(items[1]).toHaveTextContent(`Pago · EVANS`);
    expect(items[1]).toHaveTextContent(`+20,00${NB}€`);
    expect(items[2]).toHaveTextContent(`Gasto · El bote`);
    expect(items[2]).toHaveTextContent(`−45,00${NB}€`);
  });

  it("«Pagos avisados»: a member’s «Ya la he pagado» is confirmed (as a pago) or rejected; none, no card", async () => {
    const user = userEvent.setup();
    const claim: CajaClaim = { id: "cl1", uid: "u-erik", playerId: "erik", seasonId: "t1", concept: "Cuota octubre", amount: 2500, at: Date.UTC(2026, 9, 28, 10), status: "pendiente" };
    h.claims.data = [claim, { ...claim, id: "cl2", status: "confirmado" }];
    mountAdmin("/admin/caja", { caja: Caja });
    const list = await screen.findByRole("list", { name: /^Pagos avisados/ });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("ERIK");
    expect(items[0]).toHaveTextContent(`Cuota octubre · dice que lo ha pagado25,00${NB}€`);
    await user.click(within(items[0]).getByRole("button", { name: /^Confirmar el pago de ERIK · 25,00.€$/ }));
    expect(h.writes.resolveClaim).toHaveBeenCalledWith(claim, "confirmado");
    await user.click(within(items[0]).getByRole("button", { name: /^Rechazar el pago de ERIK · 25,00.€$/ }));
    expect(h.writes.resolveClaim).toHaveBeenLastCalledWith(claim, "rechazado");
    cleanup();
    h.claims.data = [];
    mountAdmin("/admin/caja", { caja: Caja });
    await screen.findByRole("heading", { level: 1, name: "Caja" });
    expect(screen.queryByRole("list", { name: /^Pagos avisados/ })).toBeNull();
  });

  it("filters the log by kind and by player", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await screen.findByRole("heading", { level: 1, name: "Caja" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por tipo" }), "cargo");
    expect(movItems()).toHaveLength(2);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por jugador" }), "erik");
    expect(movItems()).toHaveLength(1);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por tipo" }), "pago");
    expect(screen.getByText("Ningún movimiento con estos filtros.")).toBeInTheDocument();
  });

  it("«Cobrar cuota» writes one cargo of the cuota per squad player, named after the season", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Cobrar cuota" }));
    const dialog = screen.getByRole("dialog", { name: "Cobrar cuota" });
    expect(dialog).toHaveTextContent(`12 cargos de 30,00${NB}€ · 360,00${NB}€ en total`);
    expect(dialog).toHaveTextContent("Concepto: «Cuota Temporada 1»");
    await user.click(within(dialog).getByRole("button", { name: "Cobrar a 12 jugadores" }));
    expect(h.writes.addMovs).toHaveBeenCalledTimes(1);
    const [season, movs] = h.writes.addMovs.mock.calls[0];
    expect(season).toBe("t1");
    expect(movs).toHaveLength(12);
    expect(movs[0]).toEqual({ kind: "cargo", playerId: "evans", amount: 3000, concept: "Cuota Temporada 1", date: "2026-11-02", matchId: null });
    expect(new Set(movs.map((m) => m.playerId)).size).toBe(12);
    expect(await screen.findByText(`Cuota Temporada 1 cobrada · 12 cargos de 30,00${NB}€`)).toBeInTheDocument();
  });

  it("refuses a cuota already charged (anular first)", async () => {
    const user = userEvent.setup();
    h.caja.movs = [...MOVS, mov({ id: "q1", concept: "Cuota Temporada 1", amount: 3000 })];
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Cobrar cuota" }));
    const dialog = screen.getByRole("dialog", { name: "Cobrar cuota" });
    expect(dialog).toHaveTextContent("«Cuota Temporada 1» ya está cobrada (1 cargo)");
    await user.click(within(dialog).getByRole("button", { name: "Cobrar a 12 jugadores" }));
    expect(h.writes.addMovs).not.toHaveBeenCalled();
  });

  it("«Coste del partido» from the workspace's shortcut splits campo y árbitro to the cent among who played", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja?coste=m7", { caja: Caja });
    const dialog = await screen.findByRole("dialog", { name: "Coste del partido" });
    expect(within(dialog).getByRole("combobox", { name: "Partido" })).toHaveValue("m7");
    await user.type(within(dialog).getByLabelText("Campo y árbitro (total)"), "45");
    expect(dialog).toHaveTextContent("Del acta: los titulares y los cambios que entraron.");
    expect(dialog).toHaveTextContent(`6 jugadores ponen 6,43${NB}€ y 1 jugador 6,42${NB}€`);
    expect(dialog).toHaveTextContent("Concepto: «Campo y árbitro · J2 vs FUSION 7»");
    await user.click(within(dialog).getByRole("button", { name: "Cargar a 7 jugadores" }));
    const [season, movs] = h.writes.addMovs.mock.calls[0];
    expect(season).toBe("t1");
    expect(movs.map((m) => [m.playerId, m.amount])).toEqual([
      ["evans", 643],
      ["illescas", 643],
      ["eguzquiza", 643],
      ["erik", 643],
      ["adrian", 643],
      ["huberoski", 643],
      ["tello", 642],
    ]);
    expect(movs.reduce((s, m) => s + m.amount, 0)).toBe(4500);
    expect(movs.every((m) => m.kind === "cargo" && m.matchId === "m7" && m.date === "2026-11-01" && m.concept === "Campo y árbitro · J2 vs FUSION 7")).toBe(true);
    expect(screen.queryByRole("dialog", { name: "Coste del partido" })).toBeNull();
  });

  it("refuses to charge the same match twice", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Coste del partido" }));
    const dialog = screen.getByRole("dialog", { name: "Coste del partido" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Partido" }), "m6");
    await user.type(within(dialog).getByLabelText("Campo y árbitro (total)"), "10");
    expect(dialog).toHaveTextContent("Este partido ya está cargado (1 cargo)");
  });

  it("«Apuntar pago» writes a pago for the player, with his balance in sight", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Apuntar pago" }));
    const dialog = screen.getByRole("dialog", { name: "Apuntar pago" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Jugador" }), "erik");
    expect(dialog).toHaveTextContent(`Ahora: Debe 12,50${NB}€`);
    await user.type(within(dialog).getByLabelText("Importe"), "12,50");
    await user.click(within(dialog).getByRole("button", { name: "Apuntar pago" }));
    expect(h.writes.addMovs).toHaveBeenCalledWith("t1", [{ kind: "pago", playerId: "erik", amount: 1250, concept: "Pago", date: "2026-11-02", matchId: null }]);
  });

  it("«Apuntar gasto» needs an amount and a concept, and has no player", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Apuntar gasto" }));
    const dialog = screen.getByRole("dialog", { name: "Apuntar gasto" });
    expect(within(dialog).queryByRole("combobox", { name: "Jugador" })).toBeNull();
    await user.type(within(dialog).getByLabelText("Importe"), "abc");
    expect(dialog).toHaveTextContent("Escribe un importe en euros, por ejemplo 12,50");
    await user.click(within(dialog).getByRole("button", { name: "Apuntar gasto" }));
    expect(h.writes.addMovs).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Importe"));
    await user.type(within(dialog).getByLabelText("Importe"), "30");
    await user.type(within(dialog).getByLabelText("Concepto"), "Balones");
    await user.click(within(dialog).getByRole("button", { name: "Apuntar gasto" }));
    expect(h.writes.addMovs).toHaveBeenCalledWith("t1", [{ kind: "gasto", playerId: null, amount: 3000, concept: "Balones", date: "2026-11-02", matchId: null }]);
  });

  it("«Anular» asks first, then only voids the movement", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: /^Anular «Bizum» · EVANS · 20,00\s€$/ }));
    const ask = screen.getByRole("alertdialog", { name: "¿Anular «Bizum»?" });
    expect(ask).toHaveTextContent("Deja de contar en su saldo y en el bote");
    expect(ask).toHaveTextContent("Se queda en el registro, tachado como anulado");
    expect(h.writes.voidMov).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole("button", { name: "Anular" }));
    expect(h.writes.voidMov).toHaveBeenCalledWith("p1");
    expect(h.writes.addMovs).not.toHaveBeenCalled();
  });

  it("«Ajustes» saves the cuota, its period and «Cómo pagar»", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", { caja: Caja });
    await user.click(await screen.findByRole("button", { name: "Ajustes" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes de la caja · Temporada 1" });
    const cuota = within(dialog).getByLabelText("Cuota por jugador");
    expect(cuota).toHaveValue("30");
    await user.clear(cuota);
    await user.type(cuota, "12,5");
    await user.click(within(dialog).getByRole("button", { name: "Cada mes" }));
    const how = within(dialog).getByLabelText("Cómo pagar");
    await user.clear(how);
    await user.type(how, "Bizum a Erik");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(h.writes.saveSettings).toHaveBeenCalledWith("t1", { cuota: 1250, cuotaPeriod: "mensual", howToPay: "Bizum a Erik" });
  });

  it("is in the Sala de control's «Club» group", async () => {
    mountAdmin("/admin/caja", { caja: Caja });
    await screen.findByRole("heading", { level: 1, name: "Caja" });
    const link = screen.getAllByRole("link", { name: "Caja" })[0];
    expect(link).toHaveAttribute("href", "/admin/caja");
    expect(link).toHaveAttribute("aria-keyshortcuts", "g a");
  });
});
