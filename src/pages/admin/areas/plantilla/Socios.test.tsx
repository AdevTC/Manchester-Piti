// Socios (/admin/plantilla/socios): la puerta dentro de la sala — who knocks, who asks for his ficha, who is inside
// (and who is out), the invitations and the percha, inside the real frame (mountAdmin). Every write waits behind
// «Deshacer» in the franja; M-13 (quitar el acceso frees the ficha and the brazalete) and M-40 (another captain's
// access is the capitán general's) as the server of r12 does them; an old removal without a seal can free its ficha.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, adminFixture, mountAdmin, setAdminData } from "../../../../test/adminKit";
import type { ClaimLogRow } from "../../club/clubLive";
import type { DoorRequestRow, InviteRow, MemberRow, PersonRow } from "../../../vestuario/live";
import { SociosScreen } from "./Socios";

const DAY = 86_400_000;
const h = vi.hoisted(() => ({
  auth: { uid: "a1", role: "superadmin", nickname: "adrian_tc", email: "capitan.adrian.tc@gmail.com" },
  log: [] as ClaimLogRow[],
  requests: [] as DoorRequestRow[],
  invites: [] as InviteRow[],
  members: [] as MemberRow[],
  writes: { resolveClaim: vi.fn((uid: string, approve: boolean) => Promise.resolve(void [uid, approve])) },
  api: {
    resolveAccess: vi.fn((d: unknown) => Promise.resolve({ data: { ok: true, d } })),
    revokeMember: vi.fn((d: unknown) => Promise.resolve({ data: { ok: true, freed: null, wasCaptain: false, d } })),
    revokeInvite: vi.fn((d: unknown) => Promise.resolve({ data: { ok: true, d } })),
    createInvite: vi.fn((d: unknown) => Promise.resolve({ data: { code: "PITI-K4ZR", expiresAt: 0, d } })),
  },
}));
vi.mock("../../data/useAdminData", async () => ({ useAdminData: (await import("../../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: h.auth.uid }, profile: { nickname: h.auth.nickname, role: h.auth.role, email: h.auth.email, createdAt: new Date(0) }, loading: false, logout: async () => undefined }),
}));
vi.mock("../../../../lib/clubApi", () => ({
  apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  resolveAccess: (d: unknown) => h.api.resolveAccess(d),
  revokeMember: (d: unknown) => h.api.revokeMember(d),
  revokeInvite: (d: unknown) => h.api.revokeInvite(d),
  createInvite: (d: unknown) => h.api.createInvite(d),
}));
vi.mock("../../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../../club/clubLive", async (orig) => ({
  ...(await orig<typeof import("../../club/clubLive")>()),
  useClaimsLog: () => ({ data: h.log, loading: false, error: false }),
  useMembersVia: () => ({
    data: [
      { uid: "a1", via: "clave", by: "" },
      { uid: "a2", via: "invite", by: "a1" },
      { uid: "a3", via: "request", by: "a2" },
      { uid: "u1", via: "invite", by: "a2" },
      { uid: "u2", via: "request", by: "a1" },
    ],
    loading: false,
    error: false,
  }),
}));
vi.mock("../../../vestuario/live", async (orig) => ({
  ...(await orig<typeof import("../../../vestuario/live")>()),
  useDoorRequests: () => ({ data: h.requests, loading: false, error: false }),
  useInvites: () => ({ data: h.invites, loading: false, error: false }),
  useTeamMembers: () => ({ data: h.members, loading: false, error: false }),
}));
vi.mock("../../data/useCaja", () => ({ useCajaClaims: () => ({ data: [], loading: false, error: false }) }));
vi.mock("../../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));

const claim = (over: Partial<ClaimLogRow> & { uid: string }): ClaimLogRow => ({ playerId: "", playerName: "", nickname: "", email: "", status: "pending", at: 0, resolvedAt: 0, resolvedBy: "", ...over });
const person = (over: Partial<PersonRow> & { uid: string }): PersonRow => ({ nickname: over.uid, displayName: "", email: `${over.uid}@piti.test`, role: "user", playerId: null, removed: false, ...over });
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("sc-status__live"))!;
const section = (name: string) => screen.getByRole("heading", { level: 2, name }).closest("section")!;
const rowOf = (list: HTMLElement, text: string) => within(list).getAllByRole("listitem").find((li) => li.textContent?.includes(text))!;
const fake = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
};
const wait5 = () =>
  act(async () => {
    vi.advanceTimersByTime(5300);
  });
const mount = async (path = "/admin/plantilla/socios") => {
  mountAdmin(path, { fichas: SociosScreen });
  await screen.findByRole("heading", { level: 1, name: "Socios" });
};

describe("Socios", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(h.auth, { uid: "a1", role: "superadmin", nickname: "adrian_tc", email: "capitan.adrian.tc@gmail.com" });
    h.writes.resolveClaim.mockReset();
    Object.values(h.api).forEach((f) => f.mockReset());
    h.log = [
      claim({ uid: "u1", playerId: "kevin", nickname: "nuevo.socio", email: "nuevo.socio@gmail.com", at: NOW - 2 * 3_600_000 }),
      claim({ uid: "u2", playerId: "fer", nickname: "fer.portero12", email: "fernando.portero.doce.piti@gmail.com", at: Date.UTC(2026, 10, 1, 20, 40) }),
      claim({ uid: "u3", playerId: "andia", nickname: "andia19", status: "approved", at: Date.UTC(2026, 9, 27), resolvedAt: Date.UTC(2026, 9, 28, 12), resolvedBy: "a2" }),
      claim({ uid: "a2", playerId: "erik", nickname: "erik9", status: "approved", resolvedAt: Date.UTC(2026, 9, 20, 12), resolvedBy: "a2" }),
    ];
    h.requests = [{ uid: "r1", status: "pending", googleName: "Luis Gómez", email: "luis.g@gmail.com", photo: "", playerId: null, playerName: null, name: null, at: NOW - 40 * 60_000 }];
    h.invites = [
      { code: "PITI-M8TD", byName: "erik9", expiresAt: NOW + 5 * DAY, maxUses: 1, uses: 0, revoked: false, playerId: null, playerName: null },
      { code: "PITI-Q2WX", byName: "adrian_tc", expiresAt: NOW + 2 * DAY, maxUses: 1, uses: 1, revoked: false, playerId: "evans", playerName: "EVANS" },
    ];
    h.members = [
      { uid: "a1", joinedAt: Date.UTC(2026, 8, 1, 10), via: "clave" },
      { uid: "a2", joinedAt: Date.UTC(2026, 8, 3, 10), via: "invite" },
      { uid: "a3", joinedAt: Date.UTC(2026, 9, 2, 10), via: "request" },
    ];
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("draws the four sections and the percha with the board's words", async () => {
    const user = userEvent.setup();
    await mount();
    expect(await screen.findByRole("heading", { level: 1, name: "Socios" })).toBeInTheDocument();
    expect(screen.getByText("Quién llama, quién pide su ficha, quién está dentro y las invitaciones: todo aquí, sin salir al vestuario.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Socios · 4 cosas por hacer/ })).toHaveAttribute("aria-current", "page");

    // Llaman a la puerta
    const door = section("Llaman a la puerta");
    expect(within(door).getByText("Luis Gómez")).toBeInTheDocument();
    expect(door).toHaveTextContent("luis.g@gmail.com");
    expect(door).toHaveTextContent("hace 40 min");
    expect(within(door).getByRole("button", { name: "Abrir la puerta a Luis Gómez" })).toHaveAttribute("aria-expanded", "false");
    expect(within(door).getByRole("button", { name: "No abrir a Luis Gómez" })).toBeInTheDocument();

    // Piden su ficha
    const fichas = section("Piden su ficha");
    const kevin = within(fichas).getByRole("listitem", { name: "@nuevo.socio pide la ficha de KEVIN" });
    expect(kevin).toHaveTextContent("@nuevo.socio quiere el 11 · KEVIN");
    expect(kevin).toHaveTextContent("hace 2 h · entró con la invitación de erik9");
    expect(kevin).toHaveTextContent("nuevo.socio@gmail.com");
    expect(within(fichas).getByRole("listitem", { name: "@fer.portero12 pide la ficha de FER" })).toHaveTextContent("ayer, 21:40 · llamó a la puerta y le abrió adrian_tc");
    const fold = within(fichas).getByRole("button", { name: "2 resueltas" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    await user.click(fold);
    const res = within(screen.getByRole("list", { name: "Fichas resueltas" })).getAllByRole("listitem");
    expect(res[0]).toHaveTextContent("@andia19 → ANDIAAprobada por erik9 · 28 oct");
    expect(within(res[0]).queryByRole("button")).toBeNull();
    expect(res[1]).toHaveTextContent("@erik9 → ERIKSe aprobó sola (es administrador) · 20 oct");
    expect(within(res[1]).getByRole("button", { name: "Desvincular a @erik9 de ERIK" })).toBeInTheDocument();

    // Dentro: the general first, then the captains and the socios; locks in words
    const dentro = within(section("Dentro")).getAllByRole("list")[0];
    const [adrian, erik, kevin11] = within(dentro).getAllByRole("listitem").filter((li) => li.classList.contains("pl-person"));
    expect(adrian).toHaveTextContent("@adrian_tc · tú Capitán general");
    expect(adrian).toHaveTextContent("ADRIÁN T.C. · 10");
    expect(adrian).toHaveTextContent("Entró con la clave del vestuario · desde el 1 sept");
    expect(adrian).toHaveTextContent("Eres tú · protegido");
    expect(within(adrian).queryByRole("button")).toBeNull();
    expect(erik).toHaveTextContent("@erik9 Capitán");
    expect(erik).toHaveTextContent("Entró con la invitación de adrian_tc · desde el 3 sept");
    expect(within(erik).getByRole("button", { name: "Quitar el acceso a @erik9" })).toHaveAttribute("aria-expanded", "false");
    expect(kevin11).toHaveTextContent("@kevin11 Socio");
    expect(kevin11).toHaveTextContent("Sin ficha");
    expect(kevin11.querySelector(".pl-ini")).toHaveTextContent("K");
    expect(kevin11).toHaveTextContent("Llamó a la puerta y le abrió erik9 · desde el 2 oct");
    expect(screen.queryByText(/sin acceso$/)).toBeNull();

    // Invitaciones: the live one with its buttons, the used one «Ya no abre»
    const inv = section("Invitaciones");
    expect(within(inv).getByText("1")).toBeInTheDocument();
    const live = rowOf(inv, "PITI-M8TD");
    expect(live).toHaveTextContent("Abierta · para cualquiera");
    expect(live).toHaveTextContent("1 uso · sin usar · Caduca el 7 nov · la creó erik9");
    expect(within(live).getByRole("button", { name: "Copiar el enlace de PITI-M8TD" })).toBeInTheDocument();
    const used = rowOf(inv, "PITI-Q2WX");
    expect(used).toHaveTextContent("Para la ficha de EVANS");
    expect(used).toHaveTextContent("Usada · Caduca el 4 nov");
    expect(within(used).getByText("Ya no abre")).toBeInTheDocument();
    expect(within(used).queryByRole("button")).toBeNull();
    // the form: Para (open, or a ficha without account), Usos, Caduca en
    const para = within(inv).getByRole("combobox", { name: "Para" });
    expect([...para.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Abierta · para cualquiera", ...["EVANS · 1", "ILLESCAS · 4", "EGUZQUIZA · 8", "HUBEROSKI · 14", "ANDIA · 19", "TELLO · 20", "ALMACHI · 21", "BRAWAN · 33"].map((s) => `La ficha de ${s}`)]);
    expect(within(inv).getByRole("button", { name: "1 uso" })).toHaveAttribute("aria-pressed", "true");
    expect(within(inv).getByRole("combobox", { name: "Caduca en" })).toHaveValue("7");

    // La percha de las cuentas
    const percha = section("La percha de las cuentas");
    expect(percha).toHaveTextContent("2 de 12 camisetas ya tienen su socio");
    const sub = (name: string) => within(percha).getByRole("img", { name: `Camiseta de ${name}` }).closest("li")?.querySelector("small")?.textContent;
    expect(sub("KEVIN")).toBe("pedida");
    expect(sub("EVANS")).toBe("sin socio");
    expect(sub("ERIK")).toBe("@erik9");
  });

  it("says each empty section in its words", async () => {
    h.requests = [];
    h.invites = [];
    h.log = [];
    setAdminData(adminFixture({ claimsCount: 0 }));
    await mount();
    expect(await screen.findByText("Nadie llamando. Quien pide entrar desde el vestuario aparece aquí y en Hoy.")).toBeInTheDocument();
    expect(screen.getByText("Cuentas al día. Cuando alguien entre y pida su camiseta, aparece aquí para aprobarla.")).toBeInTheDocument();
    expect(screen.getByText("Ninguna invitación todavía. Crea una para una ficha (la cuenta queda unida a esa camiseta) o abierta.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resueltas?$/ })).toBeNull();
  });

  it("approves a claim behind «Deshacer» (undone: no call) and rejects another after 5 s", async () => {
    const user = fake();
    await mount();
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    expect(screen.queryByRole("listitem", { name: "@nuevo.socio pide la ficha de KEVIN" })).toBeNull();
    expect(caption()).toHaveTextContent("@nuevo.socio ya es KEVIN · su carta y su voto, activos");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("Ficha");
    expect(section("La percha de las cuentas")).toHaveTextContent("3 de 12 camisetas ya tienen su socio");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Piden su ficha" }));
    await user.click(screen.getByRole("button", { name: "3 resueltas" }));
    expect(within(screen.getByRole("list", { name: "Fichas resueltas" })).getAllByRole("listitem")[0]).toHaveTextContent("@nuevo.socio → KEVINAprobada por adrian_tc · ahora mismo");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByRole("listitem", { name: "@nuevo.socio pide la ficha de KEVIN" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.resolveClaim).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Rechazar la petición de @fer.portero12" }));
    expect(caption()).toHaveTextContent("Petición de @fer.portero12 rechazada · lo verá en su vestuario");
    await wait5();
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("u2", false);
  });

  it("puts the claim back and says so when the write fails", async () => {
    const user = fake();
    h.writes.resolveClaim.mockImplementationOnce(() => Promise.reject(new Error("sin red")));
    await mount();
    await user.click(await screen.findByRole("button", { name: "Aprobar: @nuevo.socio es KEVIN" }));
    await wait5();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido aprobar la ficha: sin red"));
    expect(screen.getByRole("listitem", { name: "@nuevo.socio pide la ficha de KEVIN" })).toBeInTheDocument();
  });

  it("«Desvincular» an approved one, behind «Deshacer»", async () => {
    const user = fake();
    await mount();
    await user.click(await screen.findByRole("button", { name: "2 resueltas" }));
    await user.click(screen.getByRole("button", { name: "Desvincular a @erik9 de ERIK" }));
    expect(caption()).toHaveTextContent("@erik9 ya no es ERIK · su cuenta sigue en el vestuario");
    expect(screen.queryByRole("button", { name: "Desvincular a @erik9 de ERIK" })).toBeNull();
    expect(section("La percha de las cuentas")).toHaveTextContent("1 de 12 camisetas ya tienen su socio");
    await wait5();
    expect(h.writes.resolveClaim).toHaveBeenCalledWith("a2", false);
  });

  it("opens the door with a ficha (asked in place) and closes it to another", async () => {
    const user = fake();
    h.requests = [...h.requests, { uid: "r2", status: "pending", googleName: "Pepe", email: "pepe@gmail.com", photo: "", playerId: "tello", playerName: "TELLO", name: "Pepito", at: NOW - 3 * 3_600_000 }];
    await mount();
    const door = section("Llaman a la puerta");
    // the one who said who he is: «Dice que es TELLO · 20», and that ficha comes chosen
    expect(rowOf(door, "Pepito")).toHaveTextContent("Dice que es TELLO · 20");
    const abrir = within(door).getByRole("button", { name: "Abrir la puerta a Luis Gómez" });
    await user.click(abrir);
    expect(abrir).toHaveAttribute("aria-expanded", "true");
    const ask = within(door).getByRole("group", { name: "Abrir la puerta a Luis Gómez" });
    expect(ask).toHaveTextContent("Entra como socio (sin brazalete). Si le das una ficha, queda unida a su cuenta.");
    const pick = within(ask).getByRole("combobox", { name: "¿Con una ficha? · opcional" });
    expect(pick).toHaveValue("");
    expect(within(pick).getByRole("option", { name: "Sin ficha · entra como socio" })).toBeInTheDocument();
    await user.selectOptions(pick, "illescas");
    await user.click(within(ask).getByRole("button", { name: "Abrir la puerta" }));
    expect(within(door).queryByText("Luis Gómez")).toBeNull();
    expect(caption()).toHaveTextContent("Luis Gómez ya está dentro como ILLESCAS · se le avisa «¡Ya estás dentro!»");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("Puerta");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Llaman a la puerta" }));
    await wait5();
    expect(h.api.resolveAccess).toHaveBeenCalledWith({ uid: "r1", approve: true, playerId: "illescas" });

    await user.click(within(door).getByRole("button", { name: "Abrir la puerta a Pepito" }));
    expect(within(door).getByRole("combobox", { name: "¿Con una ficha? · opcional" })).toHaveValue("tello");
    await user.click(within(door).getByRole("button", { name: "Cancelar" }));
    expect(document.activeElement).toBe(within(door).getByRole("button", { name: "Abrir la puerta a Pepito" }));
    await user.click(within(door).getByRole("button", { name: "No abrir a Pepito" }));
    expect(caption()).toHaveTextContent("Pepito no entra · lo verá si vuelve a llamar");
    await wait5();
    expect(h.api.resolveAccess).toHaveBeenLastCalledWith({ uid: "r2", approve: false });
  });

  it("«Quitar el acceso» asks in place with its consequences, then the row goes to «sin acceso» and revokeMember runs after 5 s", async () => {
    const user = fake();
    await mount();
    const dentro = section("Dentro");
    const toggle = within(dentro).getByRole("button", { name: "Quitar el acceso a @erik9" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const ask = within(dentro).getByRole("group", { name: "Quitar el acceso a @erik9" });
    expect(ask).toHaveTextContent("¿Quitar el acceso a @erik9?");
    const items = within(ask).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Deja de entrar al vestuario y a la sala en cuanto se guarde.", "Su ficha (ERIK) queda libre: otro socio puede pedirla.", "Pierde también el brazalete: si vuelve a llamar, entra como socio."]);
    await user.click(within(ask).getByRole("button", { name: "Quitar el acceso" }));
    expect(caption()).toHaveTextContent("@erik9 ya no entra · ERIK queda libre · sin brazalete");
    expect(caption().querySelector(".sc-status__tag")).toHaveTextContent("Acceso");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Dentro" }));
    const out = screen.getByRole("list", { name: "1 sin acceso" });
    expect(out).toHaveTextContent("@erik9Le quitó el acceso adrian_tc ahora mismo · ERIK quedó libre · perdió el brazalete");
    expect(section("La percha de las cuentas")).toHaveTextContent("1 de 12 camisetas ya tienen su socio");
    expect(h.api.revokeMember).not.toHaveBeenCalled();
    await wait5();
    expect(h.api.revokeMember).toHaveBeenCalledWith({ uid: "a2" });
  });

  it("«Deshacer» puts the member back inside and nothing is called", async () => {
    const user = fake();
    await mount();
    await user.click(await screen.findByRole("button", { name: "Quitar el acceso a @kevin11" }));
    const ask = screen.getByRole("group", { name: "Quitar el acceso a @kevin11" });
    expect(ask).toHaveTextContent("No tenía ficha: nada que liberar.");
    expect(ask).toHaveTextContent("Si vuelve a llamar a la puerta, entra como socio.");
    await user.click(within(ask).getByRole("button", { name: "Quitar el acceso" }));
    expect(caption()).toHaveTextContent("@kevin11 ya no entra");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(screen.getByRole("button", { name: "Quitar el acceso a @kevin11" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "1 sin acceso" })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.api.revokeMember).not.toHaveBeenCalled();
  });

  it("M-40: a captain who is not the general cannot take another captain's access (nor free his ficha); the general can", async () => {
    Object.assign(h.auth, { uid: "a2", role: "admin", nickname: "erik9", email: "segundo.capitan@gmail.com" });
    const base = adminFixture();
    setAdminData({
      ...base,
      people: [...base.people, person({ uid: "a4", nickname: "jorge30", role: "admin" }), person({ uid: "x2", nickname: "viejo.capi", role: "admin", removed: true, removedAt: NOW - 9 * DAY, playerId: "tello" })],
    });
    await mount();
    const dentro = section("Dentro");
    expect(rowOf(dentro, "@adrian_tc")).toHaveTextContent("Protegido · capitán general");
    expect(rowOf(dentro, "@erik9")).toHaveTextContent("Eres tú");
    const jorge = rowOf(dentro, "@jorge30");
    expect(jorge).toHaveTextContent("Solo el capitán general");
    expect(within(jorge).queryByRole("button")).toBeNull();
    expect(within(rowOf(dentro, "@kevin11")).getByRole("button", { name: "Quitar el acceso a @kevin11" })).toBeInTheDocument();
    const old = rowOf(screen.getByRole("list", { name: "1 sin acceso" }), "@viejo.capi");
    expect(old).toHaveTextContent("se quedó con TELLO");
    expect(old).toHaveTextContent("Solo el capitán general");
    expect(within(old).queryByRole("button")).toBeNull();
  });

  it("the general sees «Quitar el acceso» on another captain", async () => {
    const base = adminFixture();
    setAdminData({ ...base, people: [...base.people, person({ uid: "a4", nickname: "jorge30", role: "admin" })] });
    await mount();
    expect(await screen.findByRole("button", { name: "Quitar el acceso a @jorge30" })).toBeInTheDocument();
  });

  it("an old removal without a seal still holds his ficha: «Liberar la ficha» calls revokeMember again", async () => {
    const user = fake();
    const base = adminFixture();
    setAdminData({
      ...base,
      people: [
        ...base.people,
        person({ uid: "x1", nickname: "pellete", removed: true, removedAt: NOW - 3 * DAY, playerId: "tello" }),
        person({ uid: "x3", nickname: "se.fue", removed: true, removedAt: NOW - 2 * DAY, removedBy: "x3", playerId: "almachi" }),
        person({ uid: "x4", nickname: "echado", removed: true, removedAt: NOW - 30 * 60_000, removedBy: "a2" }),
      ],
    });
    await mount();
    const out = await screen.findByRole("list", { name: "3 sin acceso" });
    const [echado, sefue, pellete] = within(out).getAllByRole("listitem");
    expect(echado).toHaveTextContent("@echadoLe quitó el acceso erik9 hace 30 min · sin brazalete");
    expect(within(echado).queryByRole("button")).toBeNull();
    expect(sefue).toHaveTextContent("Se fue por su cuenta 31 oct");
    expect(sefue).toHaveTextContent("se quedó con ALMACHI");
    expect(pellete).toHaveTextContent("Sin acceso · 30 oct");
    expect(pellete).toHaveTextContent("se quedó con TELLO");
    // the percha says who keeps it
    expect(within(section("La percha de las cuentas")).getByRole("img", { name: "Camiseta de TELLO" }).closest("li")).toHaveTextContent("la guarda @pellete");
    await user.click(within(pellete).getByRole("button", { name: "Liberar la ficha de TELLO" }));
    expect(caption()).toHaveTextContent("TELLO queda libre · @pellete sigue sin acceso");
    expect(within(pellete).queryByRole("button")).toBeNull();
    expect(within(section("La percha de las cuentas")).getByRole("img", { name: "Camiseta de TELLO" }).closest("li")).toHaveTextContent("sin socio");
    await wait5();
    expect(h.api.revokeMember).toHaveBeenCalledWith({ uid: "x1" });
  });

  it("creates an invitation for a ficha (link copied, «Deshacer» revokes it), copies and revokes another", async () => {
    const user = fake();
    h.api.createInvite.mockImplementationOnce((d: unknown) => Promise.resolve({ data: { code: "PITI-K4ZR", expiresAt: NOW + 14 * DAY, d } }));
    await mount();
    const inv = section("Invitaciones");
    await user.selectOptions(within(inv).getByRole("combobox", { name: "Para" }), "evans");
    await user.click(within(inv).getByRole("button", { name: "Ilimitada" }));
    expect(within(inv).getByRole("button", { name: "Ilimitada" })).toHaveAttribute("aria-pressed", "true");
    await user.selectOptions(within(inv).getByRole("combobox", { name: "Caduca en" }), "14");
    await user.click(within(inv).getByRole("button", { name: "Crear la invitación" }));
    expect(h.api.createInvite).toHaveBeenCalledWith({ playerId: "evans", maxUses: 0, days: 14 });
    await waitFor(() => expect(caption()).toHaveTextContent("PITI-K4ZR creada para EVANS · caduca en 14 días · enlace copiado"));
    expect(await navigator.clipboard.readText()).toMatch(/\/invitacion\/PITI-K4ZR$/);
    const made = rowOf(inv, "PITI-K4ZR");
    expect(made).toHaveTextContent("Para la ficha de EVANS");
    expect(made).toHaveTextContent("Ilimitada · 0 usos · Caduca el 16 nov · la creó adrian_tc");
    expect(within(inv).getByRole("combobox", { name: "Para" })).toHaveValue("");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    expect(h.api.revokeInvite).toHaveBeenCalledWith({ code: "PITI-K4ZR" });
    expect(within(rowOf(inv, "PITI-K4ZR")).getByText("Ya no abre")).toBeInTheDocument();

    await user.click(within(inv).getByRole("button", { name: "Copiar el enlace de PITI-M8TD" }));
    await waitFor(() => expect(caption()).toHaveTextContent(/Enlace copiado · .*\/invitacion\/PITI-M8TD/));
    await user.click(within(inv).getByRole("button", { name: "Revocar PITI-M8TD" }));
    expect(caption()).toHaveTextContent("PITI-M8TD revocada · el enlace ya no abre");
    expect(within(rowOf(inv, "PITI-M8TD")).getByText("Ya no abre")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Invitaciones" }));
    await wait5();
    expect(h.api.revokeInvite).toHaveBeenLastCalledWith({ code: "PITI-M8TD" });
  });

  it("says why when an invitation cannot be created", async () => {
    const user = userEvent.setup();
    h.api.createInvite.mockImplementationOnce(() => Promise.reject(new Error("Solo los administradores pueden publicar.")));
    await mount();
    await user.click(await screen.findByRole("button", { name: "Crear la invitación" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido crear la invitación: Solo los administradores pueden publicar."));
  });

  it("on the phone the ?ver= chips pick one section", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      await mount("/admin/plantilla/socios?ver=dentro");
      const tabs = await screen.findByRole("navigation", { name: "Secciones de socios" });
      const chips = within(tabs).getAllByRole("link");
      expect(chips.map((c) => c.textContent)).toEqual(["La puerta1", "Fichas2", "Dentro", "Invitaciones"]);
      expect(within(tabs).getByRole("link", { name: "Dentro" })).toHaveAttribute("aria-current", "page");
      expect(within(tabs).getByRole("link", { name: "Fichas · 2 por hacer" })).toHaveAttribute("href", "/admin/plantilla/socios?ver=fichas");
      expect(within(tabs).getByRole("link", { name: "La puerta · 1 por hacer" })).toHaveAttribute("href", "/admin/plantilla/socios");
      expect(section("Dentro")).toHaveClass("is-on");
      expect(section("Llaman a la puerta")).not.toHaveClass("is-on");
      expect(section("Invitaciones")).not.toHaveClass("is-on");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    }
  });

  it("says its loading and its error", async () => {
    setAdminData(adminFixture({ loading: true }));
    mountAdmin("/admin/plantilla/socios", { fichas: SociosScreen });
    expect(await screen.findByRole("status", { name: "Cargando los socios" })).toBeInTheDocument();
    act(() => setAdminData(adminFixture({ error: true })));
    expect(await screen.findByRole("heading", { level: 2, name: "No se ha podido cargar los socios" })).toBeInTheDocument();
  });
});
