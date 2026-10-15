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
// (the team's absences, for the «Ausente · hasta …» badges)
const { absences } = vi.hoisted(() => ({ absences: { list: [] as unknown[], days: [] as string[] } }));
vi.mock("../convocar/live", async () => {
  const kit = await import("../../../test/adminKit");
  return {
    useMatchAnswers: (id: string | undefined) => ({ data: id === "m8" ? kit.fixtureAnswers : [], loading: false }),
    useTeamAbsences: (today: string) => (absences.days.push(today), absences.list),
  };
});
const { setReminders } = vi.hoisted(() => ({ setReminders: vi.fn((_on: boolean) => Promise.resolve()) }));
vi.mock("../convocar/reminders", () => ({ useReminders: () => ({ auto: true, loading: false, set: setReminders }) }));
// (the official board's seven, by board id: no Firestore in tests)
const { boardSevens } = vi.hoisted(() => ({ boardSevens: new Map<string, string[]>() }));
vi.mock("../../pizarra/useMatchBoard", () => ({ useBoardSeven: (id: string | null) => (id ? (boardSevens.get(id) ?? null) : null) }));
const setConv = vi.mocked(api.setConvocatoria);

const WIDTH = window.innerWidth;
const SIX = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik"];
const withJ8 = (j8: Partial<ClubMatch>): ClubMatch[] => fixturePublished.map((m) => (m.id === "m8" ? { ...m, ...j8 } : m));
const caption = () => screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;

beforeEach(() => {
  absences.list = [];
  absences.days = [];
  localStorage.clear();
  setConv.mockClear();
  setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }) }));
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
});

describe("Convocar", () => {
  it("«Ausente · hasta 12 nov» on a «No puedo» an absence covers that day (words and an icon); nobody else", async () => {
    absences.list = [{ id: "a1", uid: "u-brawan", playerId: "brawan", name: "brawan", from: "2026-11-06", to: "2026-11-12", note: "", createdAt: 1 }];
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const pool = await screen.findByRole("group", { name: "Jugadores por respuesta" });
    const rowOf = (name: string) => within(pool).getByText(name, { selector: "b" }).closest(".pr") as HTMLElement;
    const badge = within(rowOf("BRAWAN")).getByText("Ausente · hasta 12 nov");
    expect(badge).toHaveClass("aus-badge");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(within(pool).getAllByText(/^Ausente/)).toHaveLength(1);
    // (the reader asks for the absences still to end, from the admin's «today»)
    expect(absences.days.at(-1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("an absence that doesn't cover the match's day: no badge", async () => {
    absences.list = [{ id: "a1", uid: "u-brawan", playerId: "brawan", name: "brawan", from: "2026-11-09", to: "2026-11-12", note: "", createdAt: 1 }];
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const pool = await screen.findByRole("group", { name: "Jugadores por respuesta" });
    expect(within(pool).queryByText(/^Ausente/)).toBeNull();
  });

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
    // the exact position (long name for screen readers), or the line when that is all he has
    const rowOf = (name: string) => within(pool).getByText(name, { selector: "b" }).closest(".pr") as HTMLElement;
    expect(rowOf("EVANS")).toHaveTextContent("POR (Portero) · en el siete");
    expect(rowOf("ILLESCAS")).toHaveTextContent("DEF (Defensa) · en el siete");
    expect(rowOf("ADRIÁN T.C.")).toHaveTextContent("DEL (Delantero) · sin colocar");
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

  it("the exact preferida prints as «DFC · en el siete» in the squad and as the code under the shirt on el siete's pegs", async () => {
    const base = adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }) });
    const exact: Record<string, { main: "DFC" | "MCD" | "DC"; also: [] }> = { illescas: { main: "DFC", also: [] }, eguzquiza: { main: "MCD", also: [] }, kevin: { main: "DC", also: [] } };
    setAdminData({ ...base, roster: base.roster.map((p) => (exact[p.id] ? { ...p, doc: { ...p.doc, positions: exact[p.id] } } : p)) });
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const pool = await screen.findByRole("group", { name: "Jugadores por respuesta" });
    const rowOf = (name: string) => within(pool).getByText(name, { selector: "b" }).closest(".pr") as HTMLElement;
    expect(rowOf("ILLESCAS")).toHaveTextContent("DFC (Central) · en el siete");
    expect(rowOf("KEVIN")).toHaveTextContent("DC (Punta) · en el banquillo");
    expect(within(rowOf("ILLESCAS")).getByText("(Central)", { exact: false })).toHaveClass("sr");
    const sv = screen.getByRole("region", { name: "El siete · J3 · MAD SKY" });
    const peg = within(sv).getByRole("button", { name: "ILLESCAS en el siete: tocar para bajarlo al banquillo · Central" });
    expect(peg.querySelector(".pc")).toHaveTextContent("DFC");
    expect(within(sv).getByRole("button", { name: /^EGUZQUIZA en el siete/ }).querySelector(".pc")).toHaveTextContent("MCD");
    // a player with only his line shows the line under the shirt
    expect(within(sv).getByRole("button", { name: /^TELLO en el siete/ }).querySelector(".pc")).toHaveTextContent("DEF");
  });

  it("a confirmed peg reads «Viene» (RSVP_LABEL.si); a duda or an unanswered one keeps its own label", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: ["evans", "illescas", "tello", "eguzquiza", "almachi", "fer", "erik"], bench: [] }) }));
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const sv = await screen.findByRole("region", { name: "El siete · J3 · MAD SKY" });
    const sub = (re: RegExp) => within(sv).getByRole("button", { name: re }).querySelector(".rv");
    expect(sub(/^EVANS en el siete/)).toHaveTextContent(/^Viene$/);
    expect(sub(/^ERIK en el siete/)).toHaveTextContent(/^Viene$/);
    expect(sub(/^ALMACHI en el siete/)).toHaveTextContent(/^Duda$/);
    expect(sub(/^ALMACHI en el siete/)).toHaveClass("duda");
    expect(sub(/^FER en el siete/)).toHaveTextContent(/^Sin responder$/);
  });

  it("each tap is written at once: «Siete» hangs him (Deshacer puts it back), «Ya hay siete», a front peg goes down, the banquillo's shirt comes off", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/convocar", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "ADRIÁN T.C. en el siete" }));
    expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: [...SIX, "adrian"], bench: ["kevin", "almachi"], notify: false });
    expect(caption()).toHaveTextContent("ADRIÁN T.C. al siete · la pizarra y el acta ya lo ven");
    expect(caption().querySelector(".lt .k")).toHaveTextContent("J3");
    expect(screen.getByRole("button", { name: "ADRIÁN T.C. en el siete: tocar para bajarlo al banquillo · Delantero" })).toHaveClass("open");
    await user.click(within(caption()).getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: SIX, bench: ["kevin", "almachi"], notify: false }));
    await user.click(screen.getByRole("button", { name: "ADRIÁN T.C. en el siete" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publicar y avisar" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Publicar y avisar" })).toHaveClass("gold");
    setConv.mockClear();
    await user.click(screen.getByRole("button", { name: "KEVIN en el siete" }));
    expect(caption()).toHaveTextContent("Ya hay siete: baja uno al banquillo antes");
    expect(setConv).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "EVANS en el siete: tocar para bajarlo al banquillo · Portero" }));
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

  it("«Publicar y avisar» right after «Ya está el siete» of this seven: announced, without a second notice (one «siete»)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const SEVEN = [...SIX, "adrian"];
    setAdminData(adminFixture({ published: withJ8({ starters: SEVEN, bench: ["kevin", "almachi"] }) }));
    setConv.mockImplementationOnce(() => Promise.resolve({ data: { at: 2, revision: 2, notice: null, covered: true } } as Awaited<ReturnType<typeof api.setConvocatoria>>));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/convocar", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "Publicar y avisar" }));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    await waitFor(() => expect(caption()).toHaveTextContent("Convocatoria al día · el equipo ya tiene «Ya está el siete» con este siete: sin segundo aviso"));
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
    await user.click(screen.getByRole("button", { name: "TELLO en el siete: tocar para bajarlo al banquillo · Defensa" }));
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
    expect(within(s7).getByRole("button", { name: "EGUZQUIZA en el siete: tocar para bajarlo al banquillo · Centrocampista" })).toHaveTextContent("EGUZQ.");
    expect(s7.querySelector(".hint")).toHaveTextContent("Banquillo: 11 KEVIN21 ALMACHI");
    expect(document.querySelector(".msticky")).toHaveTextContent("Falta 1 para el siete · ANDIA, ALMACHI en duda");
    expect(within(document.querySelector(".msticky") as HTMLElement).getByRole("button", { name: "Publicar y avisar" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Jugadores por respuesta" })).toBeInTheDocument();
  });

  it("«Recordatorios automáticos»: on by default, says who it chases, and the captain turns them off for this match", async () => {
    setReminders.mockClear();
    mountAdmin("/admin/convocar", { convocar: Convocar });
    const sw = await screen.findByRole("switch", { name: "Recordatorios automáticos de este partido" });
    expect(sw).toBeChecked();
    expect(screen.getByText(/48 h y 24 h antes del partido, un aviso a cada convocado que no ha contestado/)).toBeInTheDocument();
    await userEvent.click(sw);
    expect(setReminders).toHaveBeenCalledWith(false);
  });
});

// One «siete» (M6): whether the pizarra's official for the match has the convocatoria's seven, and
// «Copiar el de la pizarra» (asked first) through setConvocatoria.
describe("Convocar · «La pizarra coincide» / «tiene otro siete»", () => {
  afterEach(() => {
    boardSevens.clear();
  });

  it("no official board: nothing said", async () => {
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await screen.findByRole("heading", { level: 1, name: "Convocar" });
    expect(screen.queryByText(/La pizarra (coincide|tiene otro siete)/)).toBeNull();
  });

  it("the same seven (any order): «La pizarra coincide», nothing to copy", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }), officialLocks: { t1__m8: "b8" } }));
    boardSevens.set("b8", [...SIX].reverse());
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    expect(await screen.findByText("La pizarra coincide")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copiar el de la pizarra/ })).toBeNull();
  });

  it("another seven: says who, and «Copiar el de la pizarra» asks, then writes it (who leaves, to the banquillo)", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: ["kevin", "almachi"] }), officialLocks: { t1__m8: "b8" } }));
    const board = [...SIX.slice(0, 5), "kevin", "adrian"];
    boardSevens.set("b8", board);
    const user = userEvent.setup();
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    expect(await screen.findByText("La pizarra tiene otro siete")).toBeInTheDocument();
    expect(screen.getByText("En la pizarra juegan KEVIN y ADRIÁN T.C. en lugar de ERIK.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar el de la pizarra" }));
    const ask = screen.getByRole("dialog", { name: "¿Copiar el siete de la pizarra?" });
    expect(ask).toHaveTextContent("Banquillo: ALMACHI y ERIK");
    expect(setConv).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole("button", { name: "Copiar el siete" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: board, bench: ["almachi", "erik"], notify: false }));
    expect(caption()).toHaveTextContent("El siete de la pizarra, en la convocatoria");
  });

  it("no convocatoria yet: the banquillo is the pizarra's (off the seven, no baja: lesionado, sancionado, inactivo)", async () => {
    const base = adminFixture({ published: withJ8({ starters: [], bench: [] }), officialLocks: { t1__m8: "b8" } });
    // brawan is injured in the fixture; andia inactive; kevin serving a sanction set by hand
    const players = base.players.map((p) => (p.id === "andia" ? { ...p, active: false } : p.id === "kevin" ? { ...p, sanction: { games: 2, from: base.now } } : p));
    setAdminData({ ...base, players, roster: base.roster.map((r) => ({ ...r, doc: players.find((p) => p.id === r.id) ?? r.doc })) });
    const board = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
    boardSevens.set("b8", board);
    const user = userEvent.setup();
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "Copiar el de la pizarra" }));
    const ask = screen.getByRole("dialog", { name: "¿Copiar el siete de la pizarra?" });
    expect(ask).toHaveTextContent("Banquillo: FER y ALMACHI");
    await user.click(within(ask).getByRole("button", { name: "Copiar el siete" }));
    await waitFor(() => expect(setConv).toHaveBeenLastCalledWith({ matchId: "m8", starters: board, bench: ["fer", "almachi"], notify: false }));
  });

  it("asked, then cancelled: nothing written", async () => {
    setAdminData(adminFixture({ published: withJ8({ starters: SIX, bench: [] }), officialLocks: { t1__m8: "b8" } }));
    boardSevens.set("b8", [...SIX.slice(0, 5), "kevin"]);
    const user = userEvent.setup();
    mountAdmin("/admin/convocar?j=m8", { convocar: Convocar });
    await user.click(await screen.findByRole("button", { name: "Copiar el de la pizarra" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Copiar el siete de la pizarra?" })).getByRole("button", { name: "Cancelar" }));
    expect(setConv).not.toHaveBeenCalled();
  });
});
