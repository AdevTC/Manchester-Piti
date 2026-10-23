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
const api = vi.hoisted(() => ({ confirmTraining: vi.fn(async () => ({ data: null })), deleteTraining: vi.fn(async () => ({ data: null })), proposeTraining: vi.fn(async () => ({ data: null })) }));
vi.mock("../../../lib/clubApi", () => ({ ...api, apiError: (e: unknown) => String(e) }));

const { EntrenosBlock } = await import("./Entrenos");
const { proposal, rangeProblem, trainRows } = await import("./entrenosModel");

// Saturday 24 Oct 2026, 10:00 in Madrid (CEST)
const SAT = Date.UTC(2026, 9, 24, 8);
const THU = Date.UTC(2026, 9, 22, 18);
const NOW = Date.UTC(2026, 9, 20, 12);
const ME = { uid: "u1", name: "YO", playerId: "p1" };
const ctx = (extra: Partial<VxCtx> = {}): VxCtx => ({
  me: ME,
  uid: "u1",
  playerId: "p1",
  admin: false,
  seasonId: "t1",
  seasonName: "Temporada 1",
  matches: [],
  players: [],
  squad: [],
  nameOf: (id) => id,
  next: undefined,
  nextLine: "",
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

beforeEach(() => {
  live.trainings = [];
  live.votes = [];
  live.loading = false;
  vi.clearAllMocks();
});

it("rows: the day, hours · place, the votes and «Más votado»", () => {
  const rows = trainRows(training().slots, [{ slotIds: ["a"] }, { slotIds: ["a", "b"] }], ["b"], NOW);
  expect(rows.map((r) => [r.d, r.h, r.n, r.on])).toEqual([
    ["Sábado 24", "10:00–11:30 · Campo de siempre", "2 votos · Más votado", false],
    ["Jueves 22", "20:00–21:30", "1 voto", true],
  ]);
});

it("the propose form: a started range must be complete and end after it starts", () => {
  expect(rangeProblem({ day: "2026-10-24", from: "", to: "" })).toBe("Completa día, desde y hasta.");
  expect(rangeProblem({ day: "2026-10-24", from: "11:00", to: "10:00" })).toBe("La hora de fin debe ser posterior a la de inicio.");
  expect(rangeProblem({ day: "", from: "", to: "" })).toBe("");
  const ok = { day: "2026-10-24", from: "10:00", to: "11:30" };
  expect(proposal([ok, { day: "", from: "", to: "" }], " Campo ")).toEqual([{ at: new Date("2026-10-24T10:00").getTime(), end: new Date("2026-10-24T11:30").getTime(), place: "Campo" }]);
  expect(proposal([ok, { day: "2026-10-25", from: "", to: "" }], "")).toBeNull();
});

it("an open proposal: who proposed it, each slot with «Me viene», and a vote writes my slots", () => {
  live.trainings = [training()];
  live.votes = [{ uid: "u2", slotIds: ["a"], name: "Kevin" }];
  render(<EntrenosBlock c={ctx()} />);
  expect(screen.getByText("Propuesto por Josito. Vota los huecos que te vienen bien.")).toBeInTheDocument();
  const rows = within(screen.getByRole("list", { name: "Huecos propuestos" })).getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("Sábado 24");
  expect(rows[0]).toHaveTextContent("1 voto · Más votado");
  const btn = within(rows[0]).getByRole("button");
  expect(btn).toHaveTextContent("Me viene");
  expect(btn).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(btn);
  expect(writes.voteTraining).toHaveBeenCalledWith(ME, "t1", ["a"]);
  // not the proposer nor a captain: no confirm, no withdraw
  expect(screen.queryByRole("group", { name: "Confirmar el entreno" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Retirar propuesta" })).toBeNull();
});

it("my slot reads «Me viene bien»; the proposer confirms and withdraws", async () => {
  live.trainings = [training({ proposedBy: "u1" })];
  live.votes = [{ uid: "u1", slotIds: ["b"], name: "YO" }];
  render(<EntrenosBlock c={ctx()} />);
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("Me viene bien");
  fireEvent.click(within(screen.getByRole("group", { name: "Confirmar el entreno" })).getByRole("button", { name: "Jueves 22 · 20:00–21:30" }));
  expect(api.confirmTraining).toHaveBeenCalledWith({ trainingId: "t1", slotId: "b" });
  const withdraw = screen.getByRole("button", { name: "Retirar propuesta" });
  await waitFor(() => expect(withdraw).toBeEnabled());
  fireEvent.click(withdraw);
  expect(api.deleteTraining).toHaveBeenCalledWith({ trainingId: "t1" });
});

it("confirmed: who fixed it, «Voy» / «No puedo», how many go, and a captain reopens or cancels", () => {
  live.trainings = [training({ confirmed: { slotId: "a", at: SAT, end: SAT + 90 * 60_000, place: "Campo de siempre", byName: "Josito" } })];
  live.votes = [{ uid: "u2", slotIds: ["a"], name: "Kevin" }];
  render(<EntrenosBlock c={ctx({ admin: true })} />);
  expect(screen.getByText("Lo fijó Josito · votación cerrada")).toBeInTheDocument();
  expect(screen.getByText("1 va. Con 7 hay equipo.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "No puedo" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Voy" }));
  expect(writes.voteTraining).toHaveBeenCalledWith(ME, "t1", ["a"]);
  fireEvent.click(screen.getByRole("button", { name: "Reabrir votación" }));
  expect(api.confirmTraining).toHaveBeenCalledWith({ trainingId: "t1", slotId: null });
  expect(screen.getByRole("button", { name: "Cancelar entreno" })).toBeInTheDocument();
});

it("an empty week invites the first proposal, and «Proponer» opens the form", () => {
  render(<EntrenosBlock c={ctx()} />);
  expect(screen.getByText("Nadie ha propuesto huecos esta semana · sé el primero")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Otro día · proponer entreno" }));
  expect(screen.getByRole("form", { name: "Proponer entreno" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Proponer entreno" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Hueco 1 · día"), { target: { value: "2026-10-24" } });
  expect(screen.getByRole("alert")).toHaveTextContent("Completa día, desde y hasta.");
});
