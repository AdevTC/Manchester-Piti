import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Poll, PollVote } from "../../../lib/derived/polls";
import type { VxCtx } from "./ctx";

// The «Encuestas» room with real data: the head says what's open and what's left to vote, a tap votes (one answer),
// several answers tick then «Votar» (or take the vote back), the named poll comes first and takes the focus, a deleted
// one says so, «Quién votó qué» unfolds, the author's «Borrar» asks first, the empty room's questions fill the form,
// and the form publishes.
const state = vi.hoisted(() => ({
  polls: [] as unknown[],
  votes: {} as Record<string, unknown[]>,
  loading: false,
  error: false,
  votePoll: vi.fn(async (..._a: unknown[]) => undefined),
  unvotePoll: vi.fn(async (..._a: unknown[]) => undefined),
  createPoll: vi.fn(async (..._a: unknown[]) => ({ id: "new" })),
  closePoll: vi.fn(async (_id: string) => undefined),
  deletePoll: vi.fn(async (_id: string) => undefined),
}));
vi.mock("../live", () => ({
  usePolls: () => ({ data: state.polls, loading: state.loading, error: state.error }),
  usePollVotes: (id?: string) => ({ data: (id && state.votes[id]) || [], loading: false, error: false }),
}));
vi.mock("../writes", () => ({ votePoll: state.votePoll, unvotePoll: state.unvotePoll, createPoll: state.createPoll, closePoll: state.closePoll, deletePoll: state.deletePoll }));
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
const vote = (uid: string, optionIds: string[], playerId: string | null = null): PollVote => ({ uid, optionIds, name: uid, playerId });
const say = vi.fn();
const squad = [
  { id: "adri", name: "Adri", num: "9" },
  { id: "erik", name: "Erik", num: "4" },
];
const ctx = (o: Partial<VxCtx> = {}) =>
  ({ me: { uid: "u1", name: "erik", playerId: "erik" }, uid: "u1", playerId: "erik", admin: false, now: NOW, squad, say, go: vi.fn(), pollId: null, ...o }) as unknown as VxCtx;

beforeEach(() => {
  state.polls = [];
  state.votes = {};
  state.loading = false;
  state.error = false;
  for (const f of [state.votePoll, state.unvotePoll, state.createPoll, state.closePoll, state.deletePoll, say]) f.mockClear();
});

it("the head counts the open ones and says what's left to vote; a tap on a radio is the vote", async () => {
  state.polls = [poll()];
  state.votes = { p1: [vote("u2", ["o1"], "adri")] };
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1, name: "1 encuesta abierta" })).toBeTruthy();
  expect(screen.getByText(/Te falta votar «¿Cena el viernes\?»/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Abiertas" })).toBeTruthy();
  expect(screen.getByText("Te falta votar una · la más nueva arriba")).toBeTruthy();
  expect(screen.getByRole("radiogroup", { name: "¿Cena el viernes?" })).toBeTruthy();
  expect(screen.getByText("Votaron: 1 persona.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Sí · gana, 1 voto, 100 por ciento" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: /^No/ }));
  await waitFor(() => expect(state.votePoll).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), expect.objectContaining({ id: "p1" }), ["o2"]));
  await waitFor(() => expect(say).toHaveBeenCalledWith("Voto guardado: «No»."));
});

it("arrows move between the radios without voting", () => {
  state.polls = [poll()];
  render(<EncuestasBlock c={ctx()} />);
  const [si, no] = screen.getAllByRole("radio");
  si.focus();
  fireEvent.keyDown(si, { key: "ArrowDown" });
  expect(document.activeElement).toBe(no);
  fireEvent.keyDown(no, { key: "Home" });
  expect(document.activeElement).toBe(si);
  expect(state.votePoll).not.toHaveBeenCalled();
});

it("several answers: checkboxes, then «Votar»; nothing ticked takes the vote back", async () => {
  state.polls = [poll({ multi: true })];
  const { unmount } = render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByText("Marca las que te vengan y pulsa Votar.")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /^Sí/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /^No/ }));
  expect(state.votePoll).not.toHaveBeenCalled();
  expect(screen.getByText("Marcadas: 2. Pulsa para guardarlo.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Votar" }));
  await waitFor(() => expect(state.votePoll).toHaveBeenCalledWith(expect.anything(), expect.anything(), ["o1", "o2"]));
  unmount();

  state.votes = { p1: [vote("u1", ["o1"], "erik")] };
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1, name: "1 encuesta abierta" })).toBeTruthy();
  expect(screen.getByText("Has votado en todas · la más nueva arriba")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /^Sí/ }));
  expect(screen.getByText("Sin marcar nada quitas tu voto.")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cambiar mi voto" })));
  expect(state.unvotePoll).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), "p1");
  expect(say).toHaveBeenCalledWith("Voto quitado.");
});

it("the named poll first and focused; a closed one says who won; a deleted one says so", () => {
  state.polls = [poll(), poll({ id: "p2", question: "¿Camiseta nueva?", closedAt: NOW - H })];
  state.votes = { p2: [vote("u3", ["o1"])] };
  const { unmount } = render(<EncuestasBlock c={ctx({ pollId: "p2" })} />);
  const cards = document.querySelectorAll(".ven-poll");
  expect(cards[0].id).toBe("ven-p-p2");
  expect(document.activeElement).toBe(cards[0]);
  expect(screen.getByRole("heading", { name: "La del enlace" })).toBeTruthy();
  expect(screen.getByText("La encuesta del enlace que abriste")).toBeTruthy();
  expect(screen.getByText("Gana Sí")).toBeTruthy();
  expect(within(cards[0] as HTMLElement).getByText("Cerrada")).toBeTruthy();
  unmount();
  render(<EncuestasBlock c={ctx({ pollId: "gone" })} />);
  expect(screen.getByText("Esa encuesta ya no está: la borraron.")).toBeTruthy();
});

it("«Quién votó qué» unfolds: five, then «Ver los N»", () => {
  state.polls = [poll()];
  state.votes = { p1: ["a", "b", "c", "d", "e", "f"].map((u) => vote(u, ["o1"])) };
  render(<EncuestasBlock c={ctx()} />);
  const who = screen.getByRole("button", { name: "Quién votó qué" });
  expect(who.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(who);
  const list = screen.getByRole("list", { name: "Quién votó qué en «¿Cena el viernes?»" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Ver los 6" }));
  expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  expect(screen.getByRole("button", { name: "Ver menos" })).toBeTruthy();
});

it("the author's «Cerrar ya», and «Borrar» asks first (Esc cancels)", async () => {
  state.polls = [poll({ authorUid: "u1" })];
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("group", { name: "Tu encuesta" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cerrar ya" })));
  expect(state.closePoll).toHaveBeenCalledWith("p1");
  expect(say).toHaveBeenCalledWith("Encuesta cerrada.");
  fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
  const ask = screen.getByRole("alertdialog", { name: "Borrar la encuesta" });
  expect(within(ask).getByText("¿Borrar la encuesta? Se va para todo el equipo, con sus votos.")).toBeTruthy();
  fireEvent.keyDown(ask, { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sí, borrarla" })));
  expect(state.deletePoll).toHaveBeenCalledWith("p1");
  expect(say).toHaveBeenCalledWith("Encuesta borrada.");
});

it("a captain manages someone else's poll", () => {
  state.polls = [poll()];
  render(<EncuestasBlock c={ctx({ admin: true })} />);
  expect(screen.getByRole("group", { name: "Capitán" })).toBeTruthy();
});

it("empty: a question to start fills the form", () => {
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Ninguna abierta" })).toBeTruthy();
  expect(screen.getByText("No hay encuestas ahora mismo. ¿Preguntas tú?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "¿Hora del entreno?" }));
  expect((screen.getByRole("textbox", { name: /^Pregunta/ }) as HTMLInputElement).value).toBe("¿Hora del entreno?");
  expect((screen.getByLabelText("Opción 3") as HTMLInputElement).value).toBe("21:00");
  expect(screen.getByRole("radio", { name: "1 día" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("button", { name: /Varias respuestas/ }).getAttribute("aria-pressed")).toBe("true");
});

it("«Nueva encuesta» validates and publishes", async () => {
  render(<EncuestasBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("button", { name: "Escribir mi pregunta" }));
  fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" }));
  expect(screen.getByRole("alert").textContent).toBe("Escribe la pregunta.");
  fireEvent.change(screen.getByRole("textbox", { name: /^Pregunta/ }), { target: { value: "¿Cena?" } });
  expect(screen.queryByText("Escribe la pregunta.")).toBeNull();
  fireEvent.change(screen.getByLabelText("Opción 1"), { target: { value: "Sí" } });
  fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" }));
  expect(screen.getByText("Pon al menos 2 opciones.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Opción 2"), { target: { value: "sí" } });
  fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" }));
  expect(screen.getByText("Hay dos opciones iguales.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Opción 2"), { target: { value: "No" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir opción" }));
  expect(screen.getByLabelText("Opción 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Quitar la opción 3" }));
  fireEvent.click(screen.getByRole("radio", { name: "1 semana" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Publicar encuesta" })));
  expect(state.createPoll).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), { question: "¿Cena?", options: ["Sí", "No"], multi: false, duration: "1w" }, NOW);
  expect(say).toHaveBeenCalledWith("Publicada. Le llega un aviso a todo el equipo.");
  expect(screen.getByText("Publicada. Le llega un aviso a todo el equipo.")).toBeTruthy();
});

it("three open polls of mine: no new one", () => {
  state.polls = [poll({ id: "a", authorUid: "u1" }), poll({ id: "b", authorUid: "u1" }), poll({ id: "c", authorUid: "u1" })];
  render(<EncuestasBlock c={ctx()} />);
  expect((screen.getByRole("button", { name: "Nueva encuesta" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Ya tienes 3 encuestas abiertas. Cierra una para abrir otra.")).toBeTruthy();
  expect(screen.getByText("Tienes 3 de 3 abiertas. Le llega un aviso a todo el equipo.")).toBeTruthy();
});

it("loading and a failed read", () => {
  state.loading = true;
  const { unmount } = render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Mirando las encuestas…" })).toBeTruthy();
  unmount();
  state.loading = false;
  state.error = true;
  render(<EncuestasBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Las encuestas no cargan" })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("No se pudieron leer las encuestas");
});
