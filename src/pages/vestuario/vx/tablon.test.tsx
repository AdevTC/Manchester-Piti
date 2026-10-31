import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { BoardMessage } from "../live";
import type { VxCtx } from "./ctx";
import type { VxSummary } from "./summary";

const live = vi.hoisted(() => ({ msgs: [] as BoardMessage[], loading: false }));
vi.mock("../live", () => ({ useBoard: () => ({ data: live.msgs, loading: live.loading }) }));
const writes = vi.hoisted(() => ({ postBoardMessage: vi.fn(async () => undefined), deleteBoardMessage: vi.fn(async () => undefined) }));
vi.mock("../writes", () => writes);
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));

const { TablonBlock } = await import("./Tablon");
const { ago, dayGroup, tablonHead } = await import("./tablonModel");

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
  nameOf: (id) => (id === "hub" ? "Huberoski" : id),
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
const msg = (id: string, uid: string, name: string, text: string, minsAgo: number): BoardMessage => ({ id, uid, name, text, playerId: null, at: NOW - minsAgo * 60_000 });

beforeEach(() => {
  live.msgs = [];
  live.loading = false;
  vi.clearAllMocks();
});

it("ago: minutes, hours, yesterday, days", () => {
  expect(ago(NOW, NOW)).toBe("ahora");
  expect(ago(NOW - 12 * 60_000, NOW)).toBe("hace 12 min");
  expect(ago(NOW - 3 * 3_600_000, NOW)).toBe("hace 3 h");
  expect(ago(NOW - 26 * 3_600_000, NOW)).toBe("ayer");
  expect(ago(NOW - 4 * 86_400_000, NOW)).toBe("hace 4 días");
});

it("day groups: today, yesterday, this week, before (Madrid days)", () => {
  expect(dayGroup(NOW - 60_000, NOW)).toBe("Hoy");
  expect(dayGroup(NOW - 24 * 3_600_000, NOW)).toBe("Ayer");
  expect(dayGroup(NOW - 3 * 86_400_000, NOW)).toBe("Esta semana");
  expect(dayGroup(NOW - 9 * 86_400_000, NOW)).toBe("Antes");
});

it("the title: who wrote last and when; empty; «Felicita a …»", () => {
  const base = { week: 2, admin: false, felicitar: null, loading: false, now: NOW };
  expect(tablonHead({ ...base, lead: { name: "Huberoski", at: NOW - 12 * 60_000, mine: false } })).toEqual({
    title: "Huberoski escribió hace 12 min",
    sub: "2 mensajes esta semana. Saluda, avisa o pregunta: lo lee todo el equipo. Lo tuyo lo puedes borrar.",
  });
  expect(tablonHead({ ...base, admin: true, lead: { name: "YO", at: NOW, mine: true } }).title).toBe("Escribiste ahora");
  expect(tablonHead({ ...base, admin: true, lead: { name: "YO", at: NOW, mine: true } }).sub).toMatch(/Como capitán, puedes borrar cualquier mensaje\.$/);
  expect(tablonHead({ ...base, week: 0, lead: null }).title).toBe("Nadie ha escrito todavía");
  expect(tablonHead({ ...base, lead: null, felicitar: "Huberoski" }).title).toBe("Felicita a Huberoski");
});

it("the messages: who, when and what, by day; «Borrar» on mine only (a captain on all), asked first", () => {
  live.msgs = [msg("m1", "u1", "YO", "Llevo petos", 2), msg("m2", "u2", "Huberoski", "Yo llevo los balones el domingo.", 120), msg("m3", "u2", "Huberoski", "Buenas", 26 * 60)];
  const { rerender } = render(<TablonBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Escribiste hace 2 min");
  const items = within(screen.getByRole("list", { name: "Mensajes del tablón" })).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("HoyTúhace 2 minBorrarLlevo petos");
  expect(items[1]).toHaveTextContent("Huberoskihace 2 hYo llevo los balones el domingo.");
  expect(items[2]).toHaveTextContent("AyerHuberoskiayerBuenas");
  expect(screen.getAllByRole("button", { name: /^Borrar/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Borrar tu mensaje" }));
  expect(writes.deleteBoardMessage).not.toHaveBeenCalled();
  const ask = screen.getByRole("group", { name: "Borrar tu mensaje" });
  expect(ask).toHaveTextContent("¿Borrar tu mensaje? Se borra para todo el equipo.");
  fireEvent.click(within(ask).getByRole("button", { name: "Sí, borrarlo" }));
  expect(writes.deleteBoardMessage).toHaveBeenCalledWith("m1");
  rerender(<TablonBlock c={ctx({ admin: true })} />);
  expect(screen.getAllByRole("button", { name: "Borrar el mensaje de Huberoski" })).toHaveLength(2);
});

it("nobody wrote yet: the three quick greetings post straight away", () => {
  render(<TablonBlock c={ctx()} />);
  expect(screen.getByText("Nadie ha escrito todavía. Preséntate con un toque:")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nadie ha escrito todavía");
  fireEvent.click(screen.getByRole("button", { name: "¿Pachanga el sábado?" }));
  expect(writes.postBoardMessage).toHaveBeenCalledWith(ME, "¿Pachanga el sábado?");
});

it("«Publicar» posts the draft (280 at most); an empty one asks for something first", () => {
  const c = ctx();
  render(<TablonBlock c={c} />);
  const input = screen.getByRole("textbox", { name: "Escribe al vestuario" });
  expect(input).toHaveAttribute("maxLength", "280");
  fireEvent.change(input, { target: { value: "Hola" } });
  expect(screen.getByText("4/280")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
  expect(c.say).toHaveBeenCalledWith("Escribe algo antes de publicar.");
  expect(writes.postBoardMessage).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "  A por Pitutis  " } });
  fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
  expect(writes.postBoardMessage).toHaveBeenCalledWith(ME, "A por Pitutis");
  expect(input).toHaveValue("");
});

it("a refused post gives the text back and shows the app's words", async () => {
  writes.postBoardMessage.mockRejectedValueOnce(new Error("Espera un momento antes de volver a escribir."));
  render(<TablonBlock c={ctx()} />);
  const input = screen.getByRole("textbox", { name: "Escribe al vestuario" });
  fireEvent.change(input, { target: { value: "Otra vez" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Espera un momento antes de volver a escribir.");
  expect(input).toHaveValue("Otra vez");
});

it("«Felicitarle en el tablón» leaves the draft ready", () => {
  render(<TablonBlock c={ctx({ felicitar: "hub" })} />);
  expect(screen.getByRole("textbox", { name: "Escribe al vestuario" })).toHaveValue("¡Felicidades, Huberoski!");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Felicita a Huberoski");
  expect(screen.getByText(/Desde El club: felicita a Huberoski\./)).toBeInTheDocument();
});
