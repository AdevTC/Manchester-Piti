import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Poll, PollVote } from "../../../lib/derived/polls";
import type { VxCtx } from "./ctx";

// The board's «Encuestas» body with real data: a tap votes (one answer), the named poll comes first and takes
// the focus, a deleted one says so, the author's «Borrar» asks first, and the form publishes.
const state = vi.hoisted(() => ({
  polls: [] as unknown[],
  votes: {} as Record<string, unknown[]>,
  loading: false,
  votePoll: vi.fn(async (..._a: unknown[]) => undefined),
  createPoll: vi.fn(async (..._a: unknown[]) => ({ id: "new" })),
  closePoll: vi.fn(async (_id: string) => undefined),
  deletePoll: vi.fn(async (_id: string) => undefined),
}));
vi.mock("../live", () => ({
  usePolls: () => ({ data: state.polls, loading: state.loading, error: false }),
  usePollVotes: (id?: string) => ({ data: (id && state.votes[id]) || [], loading: false, error: false }),
}));
vi.mock("../writes", () => ({ votePoll: state.votePoll, createPoll: state.createPoll, closePoll: state.closePoll, deletePoll: state.deletePoll }));
vi.mock("../../club/cb/ui", () => ({ I: () => null }));
vi.mock("../../../lib/clubApi", () => ({ apiError: () => "No se pudo guardar." }));
vi.mock("../../../lib/serverTime", () => ({ serverNow: () => NOW }));

const { EncuestasBlock } = await import("./Encuestas");

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 23, 10);
const poll = (o: Partial<Poll> = {}): Poll => ({
  id: "p1",
  question: "¿Cena el viernes?",
  options: [
    { id: "o1", label: "Sí" },
    { id: "o2", label: "No" },
  ],
  multi: false,
  authorUid: "u2",
  authorName: "adri",
  createdAt: NOW - H,
  closesAt: NOW + 48 * H,
  closedAt: null,
  ...o,
});
const vote = (uid: string, optionIds: string[]): PollVote => ({ uid, optionIds, name: uid, playerId: null });
const say = vi.fn();
const ctx = (o: Partial<VxCtx> = {}) => ({ me: { uid: "u1", name: "erik", playerId: "erik" }, uid: "u1", admin: false, now: NOW, say, go: vi.fn(), pollId: null, ...o }) as unknown as VxCtx;

beforeEach(() => {
  state.polls = [];
  state.votes = {};
  state.loading = false;
  for (const f of [state.votePoll, state.createPoll, state.closePoll, state.deletePoll, say]) f.mockClear();
});

it("a tap on a radio is the vote, and the toast says it", async () => {
  state.polls = [poll()];
  state.votes = { p1: [vote("u2", ["o1"])] };
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("radiogroup", { name: "Tu voto" })).toBeTruthy();
  expect(screen.getByText("Votaron: 1 persona.")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /No/ }));
  await waitFor(() => expect(state.votePoll).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), expect.objectContaining({ id: "p1" }), ["o2"]));
  await waitFor(() => expect(say).toHaveBeenCalledWith("Voto guardado: «No»."));
});

it("several answers: checkboxes, then «Votar»", async () => {
  state.polls = [poll({ multi: true })];
  render(<EncuestasBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Sí/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /No/ }));
  expect(state.votePoll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Votar" }));
  await waitFor(() => expect(state.votePoll).toHaveBeenCalledWith(expect.anything(), expect.anything(), ["o1", "o2"]));
});

it("the named poll first and focused; a deleted one says so", () => {
  state.polls = [poll(), poll({ id: "p2", question: "¿Camiseta nueva?", closedAt: NOW - H })];
  state.votes = { p2: [vote("u3", ["o1"])] };
  const { unmount } = render(<EncuestasBlock c={ctx({ pollId: "p2" })} />);
  const groups = document.querySelectorAll(".cb-poll");
  expect(groups[0].id).toBe("cb-poll-p2");
  expect(document.activeElement).toBe(groups[0]);
  expect(screen.getByText("Gana Sí")).toBeTruthy();
  unmount();
  render(<EncuestasBlock c={ctx({ pollId: "gone" })} />);
  expect(screen.getByText("Esa encuesta ya no está: la borraron.")).toBeTruthy();
});

it("the author's «Borrar» asks first", async () => {
  state.polls = [poll({ authorUid: "u1" })];
  render(<EncuestasBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
  expect(screen.getByText("¿Borrar la encuesta? Se va para todo el equipo, con sus votos.")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, borrarla" })));
  expect(state.deletePoll).toHaveBeenCalledWith("p1");
  expect(say).toHaveBeenCalledWith("Encuesta borrada.");
});

it("empty, then «Nueva encuesta» publishes", async () => {
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByText("No hay encuestas ahora mismo. ¿Preguntas tú?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Nueva encuesta" }));
  fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" }));
  expect(screen.getByText("Escribe la pregunta.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Pregunta/), { target: { value: "¿Cena?" } });
  fireEvent.change(screen.getByLabelText("Opción 1"), { target: { value: "Sí" } });
  fireEvent.change(screen.getByLabelText("Opción 2"), { target: { value: "No" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" })));
  expect(state.createPoll).toHaveBeenCalled();
  expect(say).toHaveBeenCalledWith("Publicada. Le llega un aviso a todo el equipo.");
});

it("three open polls of mine: no new one", () => {
  state.polls = [poll({ id: "a", authorUid: "u1" }), poll({ id: "b", authorUid: "u1" }), poll({ id: "c", authorUid: "u1" })];
  render(<EncuestasBlock c={ctx()} />);
  expect((screen.getByRole("button", { name: "Nueva encuesta" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Ya tienes 3 encuestas abiertas. Cierra una para abrir otra.")).toBeTruthy();
});
