// CAJA · /admin/caja and /admin/caja/coste/<id> in the real sala (mountAdmin): the board's regions with the sums the
// caja always made (derived/caja), every write behind «Deshacer» but «Anular», a failed write in the error tone
// (B-CLUB-12), the reason of a rejected notice (M-20), the notices answered («Resueltos», H-CLUB-16).
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CajaMov, CajaSettings, NewCajaMov } from "../../../../lib/derived/caja";
import type { CajaClaim } from "../../../../lib/derived/cajaClaims";
import { adminFixture, mountAdmin, setAdminData } from "../../../../test/adminKit";
import { CajaScreen } from "./Caja";

// (mountAdmin turns the caja's two screens on with this key)
const Caja = { caja: CajaScreen };

vi.setConfig({ testTimeout: 20_000 });

// (Intl puts a no-break space before «€»; the DOM matchers read it as a plain space)
const NB = " ";
const mov = (o: Partial<CajaMov> & Pick<CajaMov, "id">): CajaMov => ({ seasonId: "t1", kind: "cargo", playerId: "erik", amount: 1000, concept: "x", date: "2026-10-27", matchId: null, by: "a1", createdAt: 1, void: false, ...o });
const h = vi.hoisted(() => ({
  caja: { settings: null as unknown as CajaSettings, movs: [] as CajaMov[], loading: false, error: false },
  writes: {
    addMovs: vi.fn((seasonId: string, movs: readonly NewCajaMov[], ids?: readonly string[]) => Promise.resolve(void [seasonId, movs, ids])),
    voidMov: vi.fn((id: string) => Promise.resolve(void id)),
    saveSettings: vi.fn((seasonId: string, s: unknown) => Promise.resolve(void [seasonId, s])),
    resolveClaim: vi.fn((claim: unknown, status: string, opts?: unknown) => Promise.resolve(void [claim, status, opts])),
  },
  claims: { data: [] as CajaClaim[], loading: false, error: false },
  ids: 0,
  mark: vi.fn((claimId: string) => void claimId),
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", async () => ({ useAuth: (await import("../../../../test/adminMocks")).fakeAuth }));
vi.mock("../../data/useCaja", () => ({
  useCaja: () => h.caja,
  useCajaClaims: () => h.claims,
  useCajaWrites: () => h.writes,
  newCajaMovId: () => `new${++h.ids}`,
}));
vi.mock("./claimNotice", () => ({ useMarkClaimNoticeRead: () => h.mark }));
vi.mock("../../../../components/jersey3d/usePageKitStills", () => ({ usePageKitStills: () => () => undefined }));

const MOVS: CajaMov[] = [
  mov({ id: "c1", kind: "cargo", playerId: "erik", amount: 1250, concept: "Campo y árbitro · J1 vs Emirates", matchId: "m6", date: "2026-10-27", createdAt: 1 }),
  mov({ id: "p1", kind: "pago", playerId: "evans", amount: 2000, concept: "Bizum", date: "2026-10-28", createdAt: 2 }),
  mov({ id: "g1", kind: "gasto", playerId: null, amount: 4500, concept: "Campo J1", date: "2026-10-27", createdAt: 3 }),
  mov({ id: "v1", kind: "cargo", playerId: "kevin", amount: 900, concept: "Error", date: "2026-10-29", createdAt: 4, void: true, voidedBy: "a2" }),
];
const CLAIM: CajaClaim = { id: "cl1", uid: "u-erik", playerId: "erik", seasonId: "t1", concept: "Cuota octubre", amount: 2500, at: Date.UTC(2026, 10, 2, 6), status: "pendiente" };
const book = () => screen.getByRole("list", { name: "Movimientos" });
const movItems = () => within(book()).getAllByRole("listitem");
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live"))!;
const alertLine = () => screen.getAllByRole("alert").find((s) => s.classList.contains("sc-status__live"))!;
const wait5 = () =>
  act(async () => {
    vi.advanceTimersByTime(5300);
  });
const setup = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
};

describe("Caja (r12)", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.values(h.writes).forEach((f) => f.mockClear());
    h.writes.resolveClaim.mockImplementation((claim: unknown, status: string, opts?: unknown) => Promise.resolve(void [claim, status, opts]));
    h.mark.mockClear();
    h.ids = 0;
    h.claims.data = [];
    h.caja.settings = { cuota: 3000, cuotaPeriod: "temporada", howToPay: "Bizum al 600 000 000", updatedAt: 0 };
    h.caja.movs = MOVS;
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("el bote, what is owed and the cuota; the saldos by dorsal in words; the book newest first with its signs", async () => {
    mountAdmin("/admin/caja", Caja);
    expect(await screen.findByRole("heading", { level: 1, name: "Caja" })).toBeInTheDocument();
    const bote = screen.getByRole("region", { name: "El bote · Temporada 1" });
    expect(within(bote).getByLabelText(/^En el bote: .25.€$/)).toBeInTheDocument();
    expect(bote).toHaveTextContent(`Os deben 12,50${NB}€ · 1 jugador`);
    expect(bote).toHaveTextContent(`Más: ERIK 12,50${NB}€`);
    expect(bote).toHaveTextContent(`30${NB}€ por temporada`);
    expect(bote).toHaveTextContent("Cómo pagar: Bizum al 600 000 000");
    const rows = within(screen.getByRole("list", { name: "Saldos" })).getAllByRole("listitem");
    expect(rows).toHaveLength(12);
    expect(rows[0]).toHaveTextContent(`EVANS`);
    expect(rows[0]).toHaveTextContent(`A favor 20${NB}€`);
    expect(rows.find((r) => r.textContent?.includes("ERIK"))).toHaveTextContent(`Debe 12,50${NB}€`);
    expect(rows[1]).toHaveTextContent("Al día");
    const items = movItems();
    expect(items.map((li) => li.querySelector("b")?.textContent)).toEqual(["Error", "Bizum", "Campo J1", "Campo y árbitro · J1 vs Emirates"]);
    expect(items[0]).toHaveTextContent("Anulado por erik9");
    expect(within(items[0]).queryByRole("button")).toBeNull();
    expect(items[1]).toHaveTextContent("mié 28 oct");
    expect(items[1]).toHaveTextContent(`Pago · EVANS`);
    expect(items[1]).toHaveTextContent(`+20${NB}€`);
    expect(items[2]).toHaveTextContent(`Gasto · El bote`);
    expect(items[2]).toHaveTextContent(`−45${NB}€`);
    expect(items[3]).toHaveTextContent(`Cargo · ERIK`);
    expect(items[3]).toHaveTextContent(`−12,50${NB}€`);
    // (the desktop has no tabs: the three regions side by side)
    expect(screen.queryByRole("tablist", { name: "Partes de la caja" })).toBeNull();
  });

  it("the phone and the tablet: one part at a time under the tabs, «Avisos N» counts what waits", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    h.claims.data = [CLAIM];
    const user = userEvent.setup();
    mountAdmin("/admin/caja", Caja);
    const tabs = await screen.findByRole("tablist", { name: "Partes de la caja" });
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Saldos", "Movimientos", "Avisos 1"]);
    expect(within(tabs).getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Resumen" })).toHaveClass("is-tab");
    await user.click(within(tabs).getByRole("tab", { name: "Avisos 1" }));
    expect(screen.getByRole("tabpanel", { name: "Avisos 1" })).toHaveClass("is-tab");
    expect(screen.getByRole("tabpanel", { name: "Resumen", hidden: true })).not.toHaveClass("is-tab");
  });

  it("«Cobrar cuota» shows the cargos at once behind «Deshacer», then writes one per squad player", async () => {
    const user = setup();
    mountAdmin("/admin/caja", Caja);
    await user.click((await screen.findAllByRole("button", { name: "Cobrar cuota" }))[0]);
    const sheet = screen.getByRole("dialog", { name: "Cobrar la cuota" });
    expect(sheet).toHaveTextContent(`12 cargos de 30${NB}€ · 360${NB}€ en total`);
    expect(sheet).toHaveTextContent("Concepto: «Cuota Temporada 1»");
    await user.click(within(sheet).getByRole("button", { name: "Cobrar a 12 jugadores" }));
    expect(screen.queryByRole("dialog", { name: "Cobrar la cuota" })).toBeNull();
    expect(caption()).toHaveTextContent(`Cuota Temporada 1 cobrada · 12 cargos de 30${NB}€`);
    expect(within(caption()).getByRole("button", { name: /Deshacer/ })).toBeInTheDocument();
    // (on screen already: twelve more rows, and nothing written yet)
    expect(movItems()).toHaveLength(16);
    expect(h.writes.addMovs).not.toHaveBeenCalled();
    await wait5();
    expect(h.writes.addMovs).toHaveBeenCalledTimes(1);
    const [season, movs, ids] = h.writes.addMovs.mock.calls[0];
    expect(season).toBe("t1");
    expect(movs).toHaveLength(12);
    expect(movs[0]).toEqual({ kind: "cargo", playerId: "evans", amount: 3000, concept: "Cuota Temporada 1", date: "2026-11-02", matchId: null });
    expect(new Set(movs.map((m) => m.playerId)).size).toBe(12);
    expect(ids).toHaveLength(12);
  });

  it("«Deshacer» writes nothing and takes the cargos back off the screen", async () => {
    const user = setup();
    mountAdmin("/admin/caja", Caja);
    await user.click((await screen.findAllByRole("button", { name: "Cobrar cuota" }))[0]);
    await user.click(within(screen.getByRole("dialog", { name: "Cobrar la cuota" })).getByRole("button", { name: "Cobrar a 12 jugadores" }));
    expect(movItems()).toHaveLength(16);
    await user.click(within(caption()).getByRole("button", { name: /Deshacer/ }));
    expect(movItems()).toHaveLength(4);
    await wait5();
    expect(h.writes.addMovs).not.toHaveBeenCalled();
  });

  it("refuses a cuota already charged (anular first)", async () => {
    const user = userEvent.setup();
    h.caja.movs = [...MOVS, mov({ id: "q1", concept: "Cuota Temporada 1", amount: 3000 })];
    mountAdmin("/admin/caja", Caja);
    await user.click((await screen.findAllByRole("button", { name: "Cobrar cuota" }))[0]);
    const sheet = screen.getByRole("dialog", { name: "Cobrar la cuota" });
    expect(within(sheet).getByRole("alert")).toHaveTextContent("«Cuota Temporada 1» ya está cobrada (1 cargo)");
    const go = within(sheet).getByRole("button", { name: "Cobrar a 12 jugadores" });
    expect(go).toHaveAttribute("aria-disabled", "true");
    await user.click(go);
    expect(screen.getByRole("dialog", { name: "Cobrar la cuota" })).toBeInTheDocument();
    expect(h.writes.addMovs).not.toHaveBeenCalled();
  });

  it("filters the book by kind, by player and «El bote»; «Quitar los filtros»", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", Caja);
    await screen.findByRole("heading", { level: 1, name: "Caja" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "cargo");
    expect(movItems()).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Movimientos" })).toHaveTextContent("2 de 4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Jugador" }), "erik");
    expect(movItems()).toHaveLength(1);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "");
    await user.selectOptions(screen.getByRole("combobox", { name: "Jugador" }), "bote");
    expect(movItems().map((li) => li.querySelector("b")?.textContent)).toEqual(["Campo J1"]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "pago");
    expect(screen.getByText(/Ningún movimiento con estos filtros/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar los filtros" }));
    expect(movItems()).toHaveLength(4);
  });

  it("a saldo's «+» opens the pago with his debt; it is written after «Deshacer»", async () => {
    const user = setup();
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: "Apuntar un pago de ERIK" }));
    const sheet = screen.getByRole("dialog", { name: "Apuntar un pago" });
    expect(within(sheet).getByRole("combobox", { name: "Jugador" })).toHaveValue("erik");
    expect(sheet).toHaveTextContent(`Su saldo ahora: debe 12,50${NB}€`);
    expect(within(sheet).getByLabelText("Importe")).toHaveValue("12,50");
    expect(within(sheet).getByLabelText("Concepto")).toHaveValue("Bizum");
    await user.click(within(sheet).getByRole("button", { name: "Apuntar el pago" }));
    expect(caption()).toHaveTextContent(`Pago de ERIK · 12,50${NB}€`);
    await wait5();
    expect(h.writes.addMovs).toHaveBeenCalledWith("t1", [{ kind: "pago", playerId: "erik", amount: 1250, concept: "Bizum", date: "2026-11-02", matchId: null }], ["new1"]);
  });

  it("«Apuntar gasto» needs an amount and a concept, and has no player", async () => {
    const user = setup();
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: "Apuntar gasto" }));
    const sheet = screen.getByRole("dialog", { name: "Apuntar un gasto" });
    expect(within(sheet).queryByRole("combobox", { name: "Jugador" })).toBeNull();
    await user.type(within(sheet).getByLabelText("Importe"), "abc");
    expect(sheet).toHaveTextContent("Escribe el importe en euros, como «12,50».");
    expect(within(sheet).getByRole("button", { name: "Apuntar el gasto" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(within(sheet).getByLabelText("Importe"));
    await user.type(within(sheet).getByLabelText("Importe"), "30");
    await user.type(within(sheet).getByLabelText("Concepto"), "Balones");
    await user.click(within(sheet).getByRole("button", { name: "Apuntar el gasto" }));
    await wait5();
    expect(h.writes.addMovs).toHaveBeenCalledWith("t1", [{ kind: "gasto", playerId: null, amount: 3000, concept: "Balones", date: "2026-11-02", matchId: null }], ["new1"]);
  });

  it("«Anular» asks first (no «Deshacer»), then only voids the movement", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: /^Anular Campo J1, gasto de El bote, 45.€$/ }));
    const ask = screen.getByRole("alertdialog", { name: "¿Anular «Campo J1»?" });
    expect(ask).toHaveTextContent("Deja de contar en el bote");
    expect(ask).toHaveTextContent("Se queda en el libro, tachado como anulado");
    expect(ask).toHaveTextContent("No se puede deshacer");
    expect(h.writes.voidMov).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole("button", { name: "Anular" }));
    expect(h.writes.voidMov).toHaveBeenCalledWith("g1");
    expect(h.writes.addMovs).not.toHaveBeenCalled();
    expect(caption()).toHaveTextContent("«Campo J1» tachado en el libro · deja de contar");
    expect(within(caption()).queryByRole("button", { name: /Deshacer/ })).toBeNull();
  });

  it("B-CLUB-12: «Anular» that fails says so in the error tone, with «Reintentar»", async () => {
    const user = userEvent.setup();
    h.writes.voidMov.mockImplementationOnce(() => Promise.reject(new Error("Sin permiso")));
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: /^Anular Bizum, pago de EVANS, 20.€$/ }));
    await user.click(within(screen.getByRole("alertdialog", { name: "¿Anular «Bizum»?" })).getByRole("button", { name: "Anular" }));
    await waitFor(() => expect(alertLine()).toHaveTextContent("No se ha podido anular «Bizum»: Sin permiso"));
    await user.click(within(alertLine()).getByRole("button", { name: /Reintentar/ }));
    expect(h.writes.voidMov).toHaveBeenCalledTimes(2);
  });

  it("«Ajustes» saves the cuota, its period and «Cómo pagar» (behind «Deshacer»)", async () => {
    const user = setup();
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: "Ajustes" }));
    const sheet = screen.getByRole("dialog", { name: "Ajustes de la caja · Temporada 1" });
    const cuota = within(sheet).getByLabelText("Cuota por jugador");
    expect(cuota).toHaveValue("30");
    await user.clear(cuota);
    await user.type(cuota, "12,5");
    await user.click(within(sheet).getByRole("button", { name: "Mensual" }));
    const how = within(sheet).getByLabelText("Cómo pagar");
    await user.clear(how);
    await user.type(how, "Bizum a Erik");
    await user.click(within(sheet).getByRole("button", { name: "Guardar los ajustes" }));
    // (the new cuota at once)
    expect(screen.getByRole("region", { name: "El bote · Temporada 1" })).toHaveTextContent(`12,50${NB}€ al mes`);
    await wait5();
    expect(h.writes.saveSettings).toHaveBeenCalledWith("t1", { cuota: 1250, cuotaPeriod: "mensual", howToPay: "Bizum a Erik" });
  });

  it("a payment notice confirmed: gone from the queue at once, its pago in the book, written with that id after «Deshacer»; its notice read", async () => {
    const user = setup();
    h.claims.data = [CLAIM];
    mountAdmin("/admin/caja", Caja);
    const queue = await screen.findByRole("list", { name: "Pagos avisados por confirmar" });
    const item = within(queue).getAllByRole("listitem")[0];
    expect(item).toHaveTextContent(`ERIK · 25${NB}€`);
    expect(item).toHaveTextContent("Cuota octubre · dice que lo ha pagado");
    await user.click(within(item).getByRole("button", { name: /^Confirmar: ERIK, Cuota octubre, 25.€$/ }));
    expect(screen.queryByRole("list", { name: "Pagos avisados por confirmar" })).toBeNull();
    expect(screen.getByRole("list", { name: "Pagos avisados resueltos" })).toHaveTextContent("Confirmado por adrian_tc");
    expect(movItems().some((li) => li.textContent?.includes("Pago · ERIK"))).toBe(true);
    expect(caption()).toHaveTextContent(`Pago de ERIK confirmado · 25${NB}€ en su saldo`);
    expect(h.writes.resolveClaim).not.toHaveBeenCalled();
    await wait5();
    expect(h.writes.resolveClaim).toHaveBeenCalledWith(CLAIM, "confirmado", { movId: "new1" });
    await waitFor(() => expect(h.mark).toHaveBeenCalledWith("cl1"));
  });

  it("B-CLUB-12: confirming a notice that fails says so in the error tone and puts it back in the queue", async () => {
    const user = setup();
    h.claims.data = [CLAIM];
    h.writes.resolveClaim.mockImplementation(() => Promise.reject(new Error("Sin conexión con el servidor")));
    mountAdmin("/admin/caja", Caja);
    const queue = await screen.findByRole("list", { name: "Pagos avisados por confirmar" });
    await user.click(within(queue).getByRole("button", { name: /^Confirmar: ERIK/ }));
    await wait5();
    await waitFor(() => expect(alertLine()).toHaveTextContent("No se ha podido confirmar el pago de ERIK: Sin conexión con el servidor"));
    expect(within(alertLine()).getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Pagos avisados por confirmar" })).toHaveTextContent("ERIK");
    expect(h.mark).not.toHaveBeenCalled();
  });

  it("M-20: a notice rejected with its reason (≤ 130), which the member gets with the push", async () => {
    const user = setup();
    h.claims.data = [CLAIM];
    mountAdmin("/admin/caja", Caja);
    const queue = await screen.findByRole("list", { name: "Pagos avisados por confirmar" });
    await user.click(within(queue).getByRole("button", { name: /^Rechazar: ERIK/ }));
    const ask = screen.getByRole("alertdialog", { name: "¿Rechazar el pago avisado de ERIK?" });
    expect(ask).toHaveTextContent("No se apunta nada en la caja");
    expect(ask).toHaveTextContent("«Tu aviso de pago no se ha confirmado», con el motivo si lo escribes");
    const why = within(ask).getByLabelText("Motivo · opcional");
    await user.type(why, "x".repeat(131));
    expect(within(ask).getByRole("button", { name: "Rechazar el aviso" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(why);
    await user.type(why, "No me ha llegado el Bizum");
    await user.click(within(ask).getByRole("button", { name: "Rechazar el aviso" }));
    expect(screen.getByRole("list", { name: "Pagos avisados resueltos" })).toHaveTextContent("Rechazado por adrian_tc · ahora · «No me ha llegado el Bizum»");
    await wait5();
    expect(h.writes.resolveClaim).toHaveBeenCalledWith(CLAIM, "rechazado", { reason: "No me ha llegado el Bizum" });
    expect(h.writes.addMovs).not.toHaveBeenCalled();
  });

  it("H-CLUB-16: «Resueltos» says who answered, when and why; nobody waiting, the queue says so", async () => {
    h.claims.data = [
      { ...CLAIM, id: "r1", status: "rechazado", resolvedBy: "a2", resolvedAt: Date.UTC(2026, 10, 1, 18), reason: "Era de la J1" },
      { ...CLAIM, id: "r2", status: "confirmado", resolvedBy: "a1", resolvedAt: Date.UTC(2026, 10, 2, 8, 30), movId: "p9" },
    ];
    mountAdmin("/admin/caja", Caja);
    const done = await screen.findByRole("list", { name: "Pagos avisados resueltos" });
    const items = within(done).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(`ERIK · Cuota octubre · 25${NB}€`);
    expect(items[0]).toHaveTextContent("Confirmado por adrian_tc · hace 30 min");
    expect(items[1]).toHaveTextContent("Rechazado por erik9 · ayer · «Era de la J1»");
    expect(screen.getByRole("region", { name: "Pagos avisados por confirmar" })).toHaveTextContent("Nadie ha avisado de un pago.");
  });

  it("offline, the line says the write stays on this device and goes up by itself", async () => {
    const user = setup();
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    mountAdmin("/admin/caja", Caja);
    await user.click(await screen.findByRole("button", { name: "Apuntar ingreso" }));
    const sheet = screen.getByRole("dialog", { name: "Apuntar un ingreso" });
    await user.type(within(sheet).getByLabelText("Importe"), "50");
    await user.type(within(sheet).getByLabelText("Concepto"), "Rifa");
    await user.click(within(sheet).getByRole("button", { name: "Apuntar el ingreso" }));
    expect(caption()).toHaveTextContent(`En este dispositivo`);
    expect(caption()).toHaveTextContent(`Ingreso apuntado · 50${NB}€ al bote · se sube solo al volver la red`);
    online.mockRestore();
  });

  it("«Coste del partido» goes to the latest played match not charged yet", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/caja", Caja);
    const btn = await screen.findByRole("button", { name: /Coste del partido J2 · FUSION 7/ });
    await user.click(btn);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/caja/coste/m7"));
  });

  it("the cost of a match (and the old ?coste= that leads to it) splits campo y árbitro to the cent among who played", async () => {
    const user = setup();
    const router = mountAdmin("/admin/caja?coste=m7", Caja);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/caja/coste/m7"));
    expect(await screen.findByRole("heading", { level: 1, name: "Coste del partido" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "J2 · FUSION 7" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Partido" })).toHaveValue("m7");
    const total = screen.getByLabelText("Campo y árbitro (total)");
    // (it starts with what the last charged match cost)
    expect(total).toHaveValue("12,50");
    await user.clear(total);
    await user.type(total, "45");
    expect(screen.getByText(`45${NB}€ entre 7 · de 6,42${NB}€ a 6,43${NB}€`)).toBeInTheDocument();
    expect(screen.getByText("Del acta: los 7 que jugaron (titulares y los cambios que entraron).")).toBeInTheDocument();
    expect(screen.getByText("Concepto: «Campo y árbitro · J2 vs FUSION 7»")).toBeInTheDocument();
    const rep = within(screen.getByRole("list", { name: "El reparto" })).getAllByRole("listitem");
    expect(rep).toHaveLength(7);
    expect(rep[0]).toHaveTextContent(`EVANS+1 céntimo6,43${NB}€`);
    expect(rep[6]).toHaveTextContent(`TELLO6,42${NB}€`);
    await user.click(screen.getAllByRole("button", { name: "Cargar a 7 jugadores" })[0]);
    expect(caption()).toHaveTextContent(`45${NB}€ cargados a 7 jugadores`);
    await wait5();
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
  });

  it("a match already charged says so (anular first) and leads to its cargos in the book", async () => {
    const user = userEvent.setup();
    const router = mountAdmin("/admin/caja/coste/m6", Caja);
    const status = await screen.findByText(/Ya está cargado: 1 cargo · 12,50.€ el mar 27 oct/);
    expect(status).toHaveTextContent("Para repetirlo, anula antes esos cargos en Movimientos.");
    expect(screen.queryByRole("button", { name: /^Cargar a/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ver los cargos en Movimientos" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/caja"));
    expect(await screen.findByRole("combobox", { name: "Tipo" })).toHaveValue("cargo");
  });

  it("without a total or anyone to charge, «Cargar» stays off and says why", async () => {
    h.caja.movs = [];
    mountAdmin("/admin/caja/coste/m7", Caja);
    const go = (await screen.findAllByRole("button", { name: "Cargar a 7 jugadores" }))[0];
    expect(go).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Campo y árbitro (total)")).toHaveValue("");
    cleanup();
  });

  it("an unknown match and a sala without season say what happened", async () => {
    mountAdmin("/admin/caja/coste/nope", Caja);
    expect(await screen.findByText(/No hay ningún partido con esa dirección/)).toBeInTheDocument();
    cleanup();
    setAdminData(adminFixture({ seasons: [], season: null, autoSeason: null }));
    mountAdmin("/admin/caja", Caja);
    expect(await screen.findByText("Aún no hay temporada: crea una en Temporadas y vuelve.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Temporadas" })).toHaveAttribute("href", "/admin/club/temporadas");
  });

  it("B-CLUB-08: a caja that cannot be read says «No se ha podido cargar la caja»", async () => {
    h.caja.error = true;
    mountAdmin("/admin/caja", Caja);
    expect(await screen.findByRole("heading", { name: "No se ha podido cargar la caja" })).toBeInTheDocument();
    h.caja.error = false;
  });

  it("is the sala's «Caja» place (g a)", async () => {
    mountAdmin("/admin/caja", Caja);
    await screen.findByRole("heading", { level: 1, name: "Caja" });
    const link = screen.getAllByRole("link", { name: /^Caja/ })[0];
    expect(link).toHaveAttribute("href", "/admin/caja");
    expect(link).toHaveAttribute("aria-keyshortcuts", "g a");
  });
});
