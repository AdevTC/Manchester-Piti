import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Poll, PollVote } from "../../lib/derived/polls";

// «Encuestas»: members only, the vote's call, the result in words, the author's and the captains' controls,
// and the form's limits. The readers and the writes are stubbed (their shape: writes.polls.test.ts).
const state = vi.hoisted(() => ({
  polls: [] as unknown[],
  votes: {} as Record<string, unknown[]>,
  votesLoading: false,
  votesError: false,
  pollsError: false,
  pollCalls: [] as (boolean | undefined)[],
  voteCalls: [] as (string | undefined)[],
  votePoll: vi.fn(async (..._a: unknown[]) => undefined),
  createPoll: vi.fn(async (..._a: unknown[]) => ({ id: "new" })),
  closePoll: vi.fn(async (_id: string) => undefined),
  deletePoll: vi.fn(async (_id: string) => undefined),
}));
vi.mock("./live", () => ({
  usePolls: (enabled?: boolean) => {
    state.pollCalls.push(enabled);
    return { data: state.polls, loading: false, error: state.pollsError };
  },
  usePollVotes: (id?: string) => {
    state.voteCalls.push(id);
    return { data: (id && state.votes[id]) || [], loading: state.votesLoading, error: state.votesError };
  },
}));
vi.mock("./writes", () => ({
  useMe: () => ({ uid: "u1", name: "erik", playerId: "erik" }),
  votePoll: state.votePoll,
  createPoll: state.createPoll,
  closePoll: state.closePoll,
  deletePoll: state.deletePoll,
}));
vi.mock("../../lib/clubApi", () => ({ apiError: () => "No se pudo guardar." }));
vi.mock("../../lib/serverTime", () => ({ serverNow: () => NOW }));

const { Encuestas } = await import("./Encuestas");

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 16, 10);
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
  closesAt: NOW + 2 * D,
  closedAt: null,
  ...o,
});
const vote = (uid: string, optionIds: string[]): PollVote => ({ uid, optionIds, name: uid, playerId: null });
const renderIt = (o: { member?: boolean; admin?: boolean } = {}) => render(<Encuestas member={o.member ?? true} admin={o.admin ?? false} now={NOW} />);
const card = (question = "¿Cena el viernes?") => screen.getByRole("listitem", { name: question });

beforeEach(() => {
  state.polls = [];
  state.votes = {};
  state.votesLoading = false;
  state.votesError = false;
  state.pollsError = false;
  state.pollCalls = [];
  state.voteCalls = [];
  state.votePoll.mockClear();
  state.createPoll.mockClear();
  state.closePoll.mockClear();
  state.deletePoll.mockClear();
});

it("members only: a fan renders nothing and never opens the readers", () => {
  state.polls = [poll()];
  const { container } = renderIt({ member: false });
  expect(container).toBeEmptyDOMElement();
  expect(state.pollCalls).toEqual([]);
  expect(state.voteCalls).toEqual([]);
  renderIt();
  expect(screen.getByRole("heading", { name: "Encuestas" })).toBeInTheDocument();
  expect(document.getElementById("encuestas")).not.toBeNull();
  expect(state.pollCalls.at(-1)).toBe(true);
});

it("nothing to vote: says so", () => {
  renderIt();
  expect(screen.getByText("No hay encuestas ahora mismo. ¿Preguntas tú?")).toBeInTheDocument();
});

it("an open poll: question, author, time left, live counts, and «Votar» writes the pick", async () => {
  state.polls = [poll()];
  state.votes = { p1: [vote("ana", ["o1"]), vote("bea", ["o1"]), vote("carla", ["o2"])] };
  renderIt();
  const c = card();
  expect(c).toHaveTextContent("De adri");
  expect(c).toHaveTextContent("Cierra en 2 días");
  expect(c).toHaveTextContent("2 votos · 67%");
  expect(c).toHaveTextContent("1 voto · 33%");
  expect(c).toHaveTextContent("Aún no has votado.");
  expect(c).toHaveTextContent("Votaron: 3 personas");
  const btn = within(c).getByRole("button", { name: "Votar" });
  expect(btn).toBeDisabled();
  // one answer: radios
  fireEvent.click(within(c).getByRole("radio", { name: /No/ }));
  expect(btn).toBeEnabled();
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(state.votePoll).toHaveBeenCalledWith({ uid: "u1", name: "erik", playerId: "erik" }, state.polls[0], ["o2"]);
});

it("your vote: «Tú: X» and «Cambiar mi voto»; several answers are checkboxes", async () => {
  state.polls = [poll({ multi: true })];
  state.votes = { p1: [vote("u1", ["o1"])] };
  renderIt();
  const c = card();
  expect(c).toHaveTextContent("Tú: Sí");
  expect(within(c).getByRole("checkbox", { name: /Sí/ })).toBeChecked();
  const btn = within(c).getByRole("button", { name: "Cambiar mi voto" });
  expect(btn).toBeDisabled();
  fireEvent.click(within(c).getByRole("checkbox", { name: /No/ }));
  await act(async () => {
    fireEvent.click(btn);
  });
  expect(state.votePoll.mock.calls[0][2]).toEqual(["o1", "o2"]);
});

it("who voted what, folded after 5", () => {
  state.polls = [poll()];
  state.votes = { p1: ["a", "b", "c", "d", "e", "f", "g"].map((n) => vote(n, ["o1"])) };
  renderIt();
  const c = card();
  expect(within(c).getAllByText("Sí", { selector: "li" })).toHaveLength(5);
  const more = within(c).getByRole("button", { name: "Ver los 7" });
  expect(more).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(more);
  expect(within(c).getAllByText("Sí", { selector: "li" })).toHaveLength(7);
  expect(within(c).getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
});

it("closed: «Cerrada», the winner in words and no vote; a tie says so", () => {
  state.polls = [poll({ closedAt: NOW - H }), poll({ id: "p2", question: "¿Equipación?", closesAt: NOW - D, options: [{ id: "o1", label: "Azul" }, { id: "o2", label: "Blanca" }] })];
  state.votes = { p1: [vote("ana", ["o1"]), vote("bea", ["o1"]), vote("carla", ["o2"])], p2: [vote("ana", ["o1"]), vote("bea", ["o2"])] };
  renderIt();
  const c = card();
  expect(c).toHaveTextContent("Cerrada");
  expect(c).toHaveTextContent("Gana Sí");
  expect(c).toHaveTextContent("Sí · gana");
  expect(within(c).queryByRole("radio")).toBeNull();
  expect(within(c).queryByRole("button", { name: /Votar|Cambiar/ })).toBeNull();
  expect(card("¿Equipación?")).toHaveTextContent("Empate entre Azul y Blanca");
});

it("«Cerrar ya» and «Borrar»: the author's and a captain's, nobody else's; «Borrar» asks first", async () => {
  state.polls = [poll()];
  const { unmount } = renderIt();
  expect(within(card()).queryByRole("button", { name: /Cerrar ya/ })).toBeNull();
  expect(within(card()).queryByRole("button", { name: /Borrar/ })).toBeNull();
  unmount();

  // a captain
  const cap = renderIt({ admin: true });
  expect(within(card()).getByRole("button", { name: /Cerrar ya/ })).toBeInTheDocument();
  cap.unmount();

  // the author
  state.polls = [poll({ authorUid: "u1" })];
  renderIt();
  const c = card();
  await act(async () => {
    fireEvent.click(within(c).getByRole("button", { name: /Cerrar ya/ }));
  });
  expect(state.closePoll).toHaveBeenCalledWith("p1");
  fireEvent.click(within(c).getByRole("button", { name: /Borrar/ }));
  const ask = within(c).getByRole("group", { name: "Borrar la encuesta «¿Cena el viernes?»" });
  expect(within(ask).getByRole("button", { name: "Sí, borrarla" })).toHaveFocus();
  fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
  expect(state.deletePoll).not.toHaveBeenCalled();
  fireEvent.click(within(c).getByRole("button", { name: /Borrar/ }));
  await act(async () => {
    fireEvent.click(within(c).getByRole("button", { name: "Sí, borrarla" }));
  });
  expect(state.deletePoll).toHaveBeenCalledWith("p1");
});

it("focus after the author's controls: «Borrar» after «Cerrar ya», the title after «Borrar», Escape cancels", async () => {
  state.polls = [poll({ authorUid: "u1" })];
  renderIt();
  const c = card();
  await act(async () => {
    fireEvent.click(within(c).getByRole("button", { name: /Cerrar ya/ }));
  });
  await waitFor(() => expect(within(c).getByRole("button", { name: /Borrar/ })).toHaveFocus());
  fireEvent.click(within(c).getByRole("button", { name: /Borrar/ }));
  fireEvent.keyDown(within(c).getByRole("button", { name: "Sí, borrarla" }), { key: "Escape" });
  expect(within(c).queryByRole("group", { name: /Borrar la encuesta/ })).toBeNull();
  expect(within(c).getByRole("button", { name: /Borrar/ })).toHaveFocus();
  fireEvent.click(within(c).getByRole("button", { name: /Borrar/ }));
  await act(async () => {
    fireEvent.click(within(c).getByRole("button", { name: "Sí, borrarla" }));
  });
  expect(screen.getByRole("heading", { name: "Encuestas", level: 2 })).toHaveFocus();
});

it("the votes: «Contando los votos…» while they arrive, an error (never «Aún no has votado») when they fail", () => {
  state.polls = [poll()];
  state.votesLoading = true;
  const { unmount } = renderIt();
  expect(card()).toHaveTextContent("Contando los votos…");
  expect(card()).not.toHaveTextContent("Aún no has votado.");
  unmount();
  state.votesLoading = false;
  state.votesError = true;
  renderIt();
  expect(card()).toHaveTextContent("No se pudieron leer los votos.");
  expect(card()).not.toHaveTextContent("Aún no has votado.");
});

it("a failed read of the polls is an error, never «No hay encuestas»", () => {
  state.pollsError = true;
  renderIt();
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron leer las encuestas.");
  expect(screen.queryByText(/No hay encuestas/)).toBeNull();
});

it("a closed poll of yours: «Borrar», but no «Cerrar ya»", () => {
  state.polls = [poll({ authorUid: "u1", closesAt: NOW - H })];
  renderIt();
  expect(within(card()).queryByRole("button", { name: /Cerrar ya/ })).toBeNull();
  expect(within(card()).getByRole("button", { name: /Borrar/ })).toBeInTheDocument();
});

it("the form: says what is wrong, 2 to 6 options, then publishes", async () => {
  renderIt();
  fireEvent.click(screen.getByRole("button", { name: /Nueva encuesta/ }));
  const form = screen.getByRole("form", { name: "Nueva encuesta" });
  // 3 días by default
  expect(within(form).getByRole("radio", { name: "3 días" })).toBeChecked();
  fireEvent.click(within(form).getByRole("button", { name: "Publicar encuesta" }));
  // the error is tied to its field, which takes the focus (no alert: it changes as the member types)
  const question = within(form).getByLabelText("Pregunta");
  expect(question).toHaveFocus();
  expect(question).toHaveAttribute("aria-invalid", "true");
  expect(question).toHaveAccessibleDescription(/Escribe la pregunta\./);
  expect(within(form).queryByRole("alert")).toBeNull();
  fireEvent.change(question, { target: { value: "¿Torneo?" } });
  expect(question).toHaveAttribute("aria-invalid", "false");
  expect(within(form).getByLabelText("Opción 1")).toHaveAccessibleDescription("Pon al menos 2 opciones.");
  fireEvent.click(within(form).getByRole("button", { name: "Publicar encuesta" }));
  expect(within(form).getByLabelText("Opción 1")).toHaveFocus();
  // two options: none to remove
  expect(within(form).queryByRole("button", { name: /Quitar la opción/ })).toBeNull();
  for (let i = 0; i < 4; i++) fireEvent.click(within(form).getByRole("button", { name: /Añadir opción/ }));
  expect(within(form).getAllByRole("textbox", { name: /Opción/ })).toHaveLength(6);
  // six: no more
  expect(within(form).queryByRole("button", { name: /Añadir opción/ })).toBeNull();
  fireEvent.click(within(form).getByRole("button", { name: "Quitar la opción 6" }));
  expect(within(form).getAllByRole("textbox", { name: /Opción/ })).toHaveLength(5);
  fireEvent.change(within(form).getByLabelText("Opción 1"), { target: { value: "Voy" } });
  fireEvent.change(within(form).getByLabelText("Opción 2"), { target: { value: "voy " } });
  expect(within(form).getByLabelText("Opción 2")).toHaveAccessibleDescription("Hay dos opciones iguales.");
  fireEvent.change(within(form).getByLabelText("Opción 2"), { target: { value: "No voy" } });
  expect(within(form).queryByText("Hay dos opciones iguales.")).toBeNull();
  expect(within(form).getByLabelText("Opción 2")).not.toHaveAttribute("aria-describedby");
  fireEvent.click(within(form).getByRole("radio", { name: "1 semana" }));
  fireEvent.click(within(form).getByRole("switch", { name: /Varias respuestas/ }));
  expect(state.createPoll).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(within(form).getByRole("button", { name: "Publicar encuesta" }));
  });
  expect(state.createPoll).toHaveBeenCalledWith(
    { uid: "u1", name: "erik", playerId: "erik" },
    { question: "¿Torneo?", options: ["Voy", "No voy", "", "", ""], multi: true, duration: "1w" },
    NOW,
  );
  expect(screen.queryByRole("form", { name: "Nueva encuesta" })).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Publicada.");
});

it("3 open polls of yours: no new one", () => {
  state.polls = [poll({ id: "a", authorUid: "u1" }), poll({ id: "b", authorUid: "u1", question: "¿B?" }), poll({ id: "c", authorUid: "u1", question: "¿C?" })];
  renderIt();
  expect(screen.getByRole("button", { name: /Nueva encuesta/ })).toBeDisabled();
  expect(screen.getByText("Ya tienes 3 encuestas abiertas. Cierra una para abrir otra.")).toBeInTheDocument();
});
