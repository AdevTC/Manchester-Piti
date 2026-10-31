import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Training, TrainingVote } from "../live";
import type { VxCtx } from "./ctx";
import type { VxSummary } from "./summary";

const live = vi.hoisted(() => ({ trainings: [] as Training[], votes: [] as TrainingVote[], loading: false }));
vi.mock("../live", () => ({
  useOpenTrainings: () => ({ data: live.trainings, loading: live.loading }),
  useTrainingVotes: () => ({ data: live.votes, loading: false }),
}));
const writes = vi.hoisted(() => ({ voteTraining: vi.fn(async () => undefined) }));
vi.mock("../writes", () => ({ voteTraining: writes.voteTraining }));
const api = vi.hoisted(() => ({ confirmTraining: vi.fn(async () => ({ data: null })), deleteTraining: vi.fn(async () => ({ data: null })), proposeTraining: vi.fn(async (): Promise<unknown> => ({ data: null })) }));
vi.mock("../../../lib/clubApi", () => ({ ...api, apiError: (e: unknown) => String(e) }));

const { EntrenosBlock } = await import("./Entrenos");
const { barOf, formErrors, ghostRange, ghosts, headOf, matchParts, proposal, rangeProblem, sevenLine, trainRows } = await import("./entrenosModel");

// Saturday 24 Oct 2026, 10:00 in Madrid (CEST)
const SAT = Date.UTC(2026, 9, 24, 8);
const THU = Date.UTC(2026, 9, 22, 18);
const NOW = Date.UTC(2026, 9, 20, 12);
const ME = { uid: "u1", name: "YO", playerId: "p1" };
const NAMES: Record<string, string> = { p1: "Jordi", p2: "Kevin" };
const ctx = (extra: Partial<VxCtx> = {}): VxCtx => ({
  me: ME,
  uid: "u1",
  playerId: "p1",
  admin: false,
  seasonId: "t1",
  seasonName: "Temporada 1",
  matches: [],
  players: [],
  squad: [
    { id: "p1", name: "Jordi", num: "7" },
    { id: "p2", name: "Kevin", num: "10" },
  ],
  nameOf: (id) => NAMES[id] ?? id,
  next: undefined,
  nextLine: "Sin partido a la vista",
  now: NOW,
  summary: {} as VxSummary,
  say: vi.fn(),
  go: vi.fn(),
  pollId: null,
  felicitar: null,
  ...extra,
});
const training = (extra: Partial<Training> = {}): Training => ({
  id: "t1",
  slots: [
    { id: "a", at: SAT, end: SAT + 90 * 60_000, place: "Campo de siempre" },
    { id: "b", at: THU, end: THU + 90 * 60_000, place: "" },
  ],
  note: "",
  proposedBy: "u9",
  proposedByName: "Josito",
  lastSlotAt: SAT,
  ...extra,
});
const CONF = { slotId: "a", at: SAT, end: SAT + 90 * 60_000, place: "Campo de siempre", byName: "Josito", by: "u9" };

beforeEach(() => {
  live.trainings = [];
  live.votes = [];
  live.loading = false;
  vi.clearAllMocks();
});

// ---------- the model
it("rows: the day, hours · place, the votes, «Más votado» among the slots to come, «Ya pasó», «Ya hay equipo»", () => {
  const rows = trainRows(training().slots, [{ slotIds: ["a"], playerId: "p2" }, { slotIds: ["a", "b"] }], ["b"], NOW);
  expect(rows.map((r) => [r.day, r.when, r.nT, r.tag, r.on, r.voters])).toEqual([
    ["Sábado 24 oct", "10:00–11:30 · Campo de siempre", "2 votos", "Más votado", false, ["p2", null]],
    ["Jueves 22 oct", "20:00–21:30", "1 voto", "", true, [null]],
  ]);
  expect(rows[0].leaf).toEqual({ dow: "Sáb", dnum: "24", mon: "oct" });
  // Thursday has passed: it says so and the most voted is the slot still to come
  const later = trainRows(training().slots, [{ slotIds: ["b"] }, { slotIds: ["b"] }, { slotIds: ["a"] }], [], THU + 1);
  expect(later.map((r) => r.tag)).toEqual(["Más votado", "Ya pasó"]);
  const seven = Array.from({ length: 7 }, () => ({ slotIds: ["a"] }));
  expect(trainRows(training().slots, seven, [], NOW)[0].tag).toBe("Ya hay equipo");
});

it("the head says the room's status in words", () => {
  expect(headOf({ kind: "empty" }).title).toBe("Nadie ha propuesto huecos");
  expect(headOf({ kind: "vote", byMe: false, byName: "Kevin" })).toEqual({ title: "¿Cuándo entrenamos?", sub: "Propuesto por Kevin. Vota los huecos que te vienen bien." });
  expect(headOf({ kind: "vote", byMe: true, byName: "YO" }).sub).toBe("Propuesto por ti. Vota los huecos que te vienen bien.");
  expect(headOf({ kind: "conf", at: SAT, byMe: false, byName: "Josito", going: 4, answered: false })).toEqual({
    title: "Entreno el sábado 24 oct, a las 10:00",
    sub: "Lo fijó Josito. Van 4: con 7 hay equipo. Dinos si vas.",
  });
  expect(headOf({ kind: "conf", at: SAT, byMe: true, byName: "YO", going: 7, answered: true }).sub).toBe("Lo fijaste tú. Van 7: hay equipo.");
  expect(headOf({ kind: "conf", at: SAT, byMe: false, byName: "", going: 0, answered: true }).sub).toBe("Aún no va nadie: con 7 hay equipo.");
});

it("the seven, the bar and the next match's line", () => {
  expect(sevenLine(0)).toBe("Todavía no se ha apuntado nadie.");
  expect(sevenLine(1)).toBe("1 va. Con 7 hay equipo.");
  expect(sevenLine(8)).toBe("8 van. Hay equipo.");
  expect(barOf(4, 16)).toEqual({ pw: "25%", s7: "43.75%", aria: "4 de 16 votos; con 7 hay equipo", n: 16 });
  expect(matchParts("J2 · Pitutis, en casa · domingo 25, 14:00")).toEqual({ t: "J2 · Pitutis, en casa", s: "Domingo 25, 14:00" });
  expect(matchParts("Sin partido a la vista")).toEqual({ t: "Sin partido a la vista", s: "" });
});

it("the ghost slots: Saturday, Sunday (with the match that day) and another day, prefilled 10:00–11:30", () => {
  const sat = Date.UTC(2026, 9, 24, 8),
    sun = Date.UTC(2026, 9, 25, 9);
  const g = ghosts(sat, sun, { at: Date.UTC(2026, 9, 25, 17), j: "J3" });
  expect(g.map((x) => [x.t, x.s, x.aria, x.big])).toEqual([
    ["Sábado", "Propón hora", "Proponer: sábado", "24"],
    ["Domingo", "Propón hora · la J3 es a las 18:00", "Proponer: domingo", "25"],
    ["Otro día", "Elige el día", "Proponer: otro día", "?"],
  ]);
  expect(ghosts(sat, sun, { at: Date.UTC(2026, 10, 1, 17), j: "J3" })[1].s).toBe("Propón hora");
  expect(ghostRange(null)).toEqual({ day: "", from: "10:00", to: "11:30" });
});

it("the propose form: the first slot is required, a started one must be complete and end after it starts", () => {
  expect(rangeProblem({ day: "2026-10-24", from: "", to: "" })).toBe("Completa día, desde y hasta.");
  expect(rangeProblem({ day: "2026-10-24", from: "11:00", to: "10:00" })).toBe("La hora de fin debe ser posterior a la de inicio.");
  expect(rangeProblem({ day: "", from: "", to: "" })).toBe("");
  const empty = { day: "", from: "", to: "" };
  expect(formErrors([empty, empty, { day: "2026-10-24", from: "11:00", to: "10:00" }])).toEqual(["Completa día, desde y hasta.", "", "La hora de fin debe ser posterior a la de inicio."]);
  const ok = { day: "2026-10-24", from: "10:00", to: "11:30" };
  expect(proposal([ok, empty], " Campo ")).toEqual([{ at: new Date("2026-10-24T10:00").getTime(), end: new Date("2026-10-24T11:30").getTime(), place: "Campo" }]);
  expect(proposal([ok, { day: "2026-10-25", from: "", to: "" }], "")).toBeNull();
});

// ---------- the room
it("voting: the head, each slot with its votes and «Me viene»; a vote writes my slots and says so", async () => {
  live.trainings = [training({ note: "Para probar el 2-3-1." })];
  live.votes = [{ uid: "u2", slotIds: ["a"], name: "Kevin", playerId: "p2" }];
  const c = ctx();
  render(<EntrenosBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Cuándo entrenamos?");
  expect(screen.getByText("Propuesto por Josito. Vota los huecos que te vienen bien.")).toBeInTheDocument();
  expect(screen.getByText("«Para probar el 2-3-1.»")).toBeInTheDocument();
  const rows = within(screen.getByRole("list", { name: "Huecos propuestos" })).getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("Sábado 24 oct");
  expect(rows[0]).toHaveTextContent("1 voto");
  expect(rows[0]).toHaveTextContent("Más votado");
  expect(within(rows[0]).getByRole("img", { name: "1 de 7 votos; con 7 hay equipo" })).toBeInTheDocument();
  const btn = within(rows[0]).getByRole("button", { name: "Me viene el sábado 24 oct, 10:00–11:30" });
  expect(btn).toHaveTextContent("Me viene");
  expect(btn).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(btn);
  expect(writes.voteTraining).toHaveBeenCalledWith(ME, "t1", ["a"]);
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Apuntado: te viene bien el sábado 24 oct.", undefined));
  // not the proposer nor a captain: no confirm, no withdraw, who fixes it
  expect(screen.queryByRole("group", { name: "Confirmar el entreno" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Retirar propuesta" })).toBeNull();
  expect(screen.getByText("Josito o un capitán fijan el hueco definitivo. Lo verás aquí y en el tablón.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Proponer otros huecos" })).toBeInTheDocument();
});

it("a past slot is disabled", () => {
  live.trainings = [training()];
  render(<EntrenosBlock c={ctx({ now: THU + 1 })} />);
  expect(screen.getByRole("button", { name: "Me viene el jueves 22 oct, 20:00–21:30. Ya pasó" })).toBeDisabled();
});

it("my slot reads «Me viene bien»; the proposer confirms (most voted first) and withdraws after asking", async () => {
  live.trainings = [training({ proposedBy: "u1", proposedByName: "YO" })];
  live.votes = [{ uid: "u1", slotIds: ["b"], name: "YO", playerId: "p1" }];
  const c = ctx();
  render(<EntrenosBlock c={c} />);
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("Me viene bien");
  expect(screen.getByText("Tu propuesta")).toBeInTheDocument();
  const group = screen.getByRole("group", { name: "Confirmar el entreno" });
  const [first] = within(group).getAllByRole("button");
  expect(first).toHaveAccessibleName("Jueves 22 oct · 20:00–21:30, 1 voto");
  expect(first).toHaveClass("nx-btn--pri");
  fireEvent.click(first);
  expect(api.confirmTraining).toHaveBeenCalledWith({ trainingId: "t1", slotId: "b" });
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Entreno confirmado: jueves 22 oct, 20:00–21:30."));
  fireEvent.click(screen.getByRole("button", { name: "Retirar propuesta" }));
  const ask = screen.getByRole("alertdialog", { name: "Retirar la propuesta" });
  expect(ask).toHaveTextContent("¿Retirar la propuesta? Se borran los huecos y sus votos.");
  fireEvent.click(within(ask).getByRole("button", { name: "Sí, retirarla" }));
  expect(api.deleteTraining).toHaveBeenCalledWith({ trainingId: "t1" });
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Propuesta retirada."));
});

it("a refused confirm shows the error as an alert", async () => {
  api.confirmTraining.mockRejectedValueOnce("Ese hueco ya ha pasado.");
  live.trainings = [training()];
  render(<EntrenosBlock c={ctx({ admin: true })} />);
  expect(screen.getByText("Capitán")).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("group", { name: "Confirmar el entreno" })).getAllByRole("button")[0]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Ese hueco ya ha pasado.");
});

it("confirmed: the ticket, «¿Vas al entreno?», how many go, who goes, and a captain reopens or cancels after asking", async () => {
  live.trainings = [training({ confirmed: CONF })];
  live.votes = [{ uid: "u2", slotIds: ["a"], name: "Kevin", playerId: "p2" }];
  const c = ctx({ admin: true });
  render(<EntrenosBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Entreno el sábado 24 oct, a las 10:00");
  expect(screen.getByText("Lo fijó Josito. Va 1: con 7 hay equipo. Dinos si vas.")).toBeInTheDocument();
  expect(screen.getByText("Lo fijó Josito · votación cerrada")).toBeInTheDocument();
  expect(screen.getByText("Campo de siempre")).toBeInTheDocument();
  expect(screen.getByText("1 va. Con 7 hay equipo.")).toBeInTheDocument();
  expect(screen.getByText("Van: Kevin")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Quién va al entreno" })).getAllByRole("listitem")[0]).toHaveTextContent("KevinVa");
  expect(screen.getByText("Aún no has respondido.")).toBeInTheDocument();
  const go = within(screen.getByRole("radiogroup", { name: "¿Vas al entreno?" }));
  expect(go.getByRole("radio", { name: "Voy" })).toHaveAttribute("aria-checked", "false");
  fireEvent.click(go.getByRole("radio", { name: "Voy" }));
  expect(writes.voteTraining).toHaveBeenCalledWith(ME, "t1", ["a"]);
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Apuntado: vas al entreno.", expect.any(Function)));
  expect(screen.getByRole("button", { name: "Añadir al calendario" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reabrir votación" }));
  expect(api.confirmTraining).toHaveBeenCalledWith({ trainingId: "t1", slotId: null });
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Votación reabierta: el equipo puede volver a votar."));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar entreno" }));
  const ask = screen.getByRole("alertdialog", { name: "Cancelar el entreno" });
  fireEvent.click(within(ask).getByRole("button", { name: "Sí, cancelarlo" }));
  expect(api.deleteTraining).toHaveBeenCalledWith({ trainingId: "t1" });
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Entreno cancelado."));
});

it("confirmed and going: «Van: tú», «No puedo» takes me out with «Deshacer»; a member doesn't manage it", async () => {
  live.trainings = [training({ confirmed: { ...CONF, by: "u1", byName: "YO" } })];
  live.votes = [{ uid: "u1", slotIds: ["a"], name: "YO", playerId: "p1" }];
  const c = ctx();
  render(<EntrenosBlock c={c} />);
  expect(screen.getByText("Lo fijó YO (tú) · votación cerrada")).toBeInTheDocument();
  expect(screen.getByText("Van: tú")).toBeInTheDocument();
  expect(screen.getByText("Vas. Puedes cambiarlo.")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Voy" })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("radio", { name: "No puedo" }));
  expect(writes.voteTraining).toHaveBeenCalledWith(ME, "t1", []);
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Apuntado: no puedes ir al entreno.", expect.any(Function)));
  const undo = vi.mocked(c.say).mock.calls[0][1]!;
  undo();
  expect(writes.voteTraining).toHaveBeenLastCalledWith(ME, "t1", ["a"]);
  expect(screen.queryByRole("button", { name: "Reabrir votación" })).toBeNull();
});

it("an empty week: three ghost slots; «Proponer» opens the form prefilled, which checks on submit and proposes", async () => {
  const c = ctx();
  render(<EntrenosBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nadie ha propuesto huecos");
  expect(screen.getByText("Nadie ha propuesto huecos esta semana · sé el primero")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Huecos para proponer" })).getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("heading", { name: "Cómo se fija un entreno" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Proponer: otro día" }));
  const form = screen.getByRole("form", { name: "Proponer entreno" });
  expect(screen.queryByRole("list", { name: "Huecos para proponer" })).toBeNull();
  expect(screen.getByLabelText("Hueco 1 · desde")).toHaveValue("10:00");
  expect(screen.getByLabelText("Hueco 1 · hasta")).toHaveValue("11:30");
  fireEvent.click(within(form).getByRole("button", { name: "Proponer entreno" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Completa día, desde y hasta.");
  expect(api.proposeTraining).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Hueco 1 · día"), { target: { value: "2026-10-24" } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.change(screen.getByLabelText("Lugar (opcional)"), { target: { value: "Campo" } });
  expect(screen.getByText("5/80")).toBeInTheDocument();
  fireEvent.click(within(form).getByRole("button", { name: "Proponer entreno" }));
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Entreno propuesto: el equipo ya puede votar."));
  expect(api.proposeTraining).toHaveBeenCalledWith({ slots: [{ at: new Date("2026-10-24T10:00").getTime(), end: new Date("2026-10-24T11:30").getTime(), place: "Campo" }], note: "" });
});

it("a refused proposal shows the backend's words as an alert", async () => {
  api.proposeTraining.mockRejectedValueOnce("Propón fechas de los próximos dos meses.");
  render(<EntrenosBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("button", { name: "Proponer: sábado" }));
  fireEvent.click(screen.getByRole("button", { name: "Proponer entreno" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Propón fechas de los próximos dos meses.");
});
