import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { RatingDoc, ReactionDoc } from "../../lib/derived/trasElPartido";

// Tras el partido on the match page: the reaction bar under a crónica moment and the 1–5 nota, for a member
// (who writes) and for a fan (who only reads). The writes' exact shape: writes.trasElPartido.test.ts.
const w = vi.hoisted(() => ({
  setReactions: vi.fn(async (..._a: unknown[]) => undefined),
  rateMatch: vi.fn(async (..._a: unknown[]) => undefined),
  unrateMatch: vi.fn(async (..._a: unknown[]) => undefined),
}));
vi.mock("../vestuario/writes", () => w);

const { NotaCard, NotaLine, ReactionBar } = await import("./TrasElPartido");

const ME = { uid: "u1", name: "YO", playerId: null };
const r = (uid: string, name: string, moments: ReactionDoc["moments"]): ReactionDoc => ({ uid, name, playerId: null, moments });
const DOCS = [r("u1", "YO", { g1: "fuego", g2: "uy" }), r("u2", "Mario", { g1: "fuego" }), r("u3", "Hugo", { g1: "fuego" }), r("u4", "Raúl", { g1: "fuego" }), r("u5", "Ana", { g1: "fuego" }), r("u6", "Leo", { g1: "risa" })];
const rating = (uid: string, score: number): RatingDoc => ({ uid, name: uid, playerId: null, score });
const CLOSES = Date.UTC(2026, 9, 17, 18, 30);

beforeEach(() => {
  w.setReactions.mockClear();
  w.rateMatch.mockClear();
  w.unrateMatch.mockClear();
});

it("a member: four reactions with a word for the screen reader, the count, «Tú» on mine (pressed)", () => {
  render(<ReactionBar matchId="j5" momentId="g1" label="Minuto 12, Primero, el Piti" docs={DOCS} me={ME} />);
  const bar = screen.getByRole("group", { name: "Reacciones · Minuto 12, Primero, el Piti" });
  const buttons = within(bar).getAllByRole("button");
  expect(buttons).toHaveLength(4);
  expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Golazo, 5, la tuya: Tú, Ana y 3 más",
    "Bien, 0",
    "Risas, 1: Leo",
    "Uy, 0",
  ]);
  expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
  expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
  // visible: emoji, the word (shown from 700 px), the count and «Tú» — never colour alone
  expect(buttons[0]).toHaveTextContent("🔥Golazo5Tú");
  expect(buttons[2]).not.toHaveTextContent("Tú");
});

it("hover, focus or tap shows who: «Tú, Ana y 3 más»", () => {
  render(<ReactionBar matchId="j5" momentId="g1" label="Minuto 12" docs={DOCS} me={ME} />);
  const [fuego, , risa] = screen.getAllByRole("button");
  fireEvent.mouseEnter(fuego);
  expect(screen.getByText("🔥 Tú, Ana y 3 más")).toBeInTheDocument();
  fireEvent.focus(risa);
  expect(screen.getByText("😂 Leo")).toBeInTheDocument();
});

it("a member taps: another reaction replaces his, the same one takes it back (all his moments in one write)", () => {
  render(<ReactionBar matchId="j5" momentId="g1" label="Minuto 12" docs={DOCS} me={ME} />);
  fireEvent.click(screen.getByRole("button", { name: /^Bien/ }));
  expect(w.setReactions).toHaveBeenLastCalledWith(ME, "j5", { g1: "aplauso", g2: "uy" });
  fireEvent.click(screen.getByRole("button", { name: /^Golazo/ }));
  expect(w.setReactions).toHaveBeenLastCalledWith(ME, "j5", { g2: "uy" });
});

it("a 31st moment is not sent: the member is told why", () => {
  const thirty = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`e${i}`, "fuego" as const]));
  render(<ReactionBar matchId="j5" momentId="nuevo" label="Minuto 40" docs={[r("u1", "YO", thirty)]} me={ME} />);
  fireEvent.click(screen.getByRole("button", { name: /^Uy/ }));
  expect(w.setReactions).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Ya has reaccionado a 30 momentos");
});

it("a fan: the same counts and who, nothing pressed and nothing written; an empty moment shows no bar", () => {
  const { unmount } = render(<ReactionBar matchId="j5" momentId="g1" label="Minuto 12" docs={DOCS} me={null} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0]).toHaveAttribute("aria-label", "Golazo, 5: Ana, Hugo y 3 más");
  expect(buttons[0]).not.toHaveAttribute("aria-pressed");
  fireEvent.click(buttons[0]);
  expect(w.setReactions).not.toHaveBeenCalled();
  expect(screen.getByText("🔥 Ana, Hugo y 3 más")).toBeInTheDocument();
  unmount();
  const { container } = render(<ReactionBar matchId="j5" momentId="g9" label="Minuto 44" docs={DOCS} me={null} />);
  expect(container).toBeEmptyDOMElement();
});

it("the crónica's header: «Nota del vestuario: 4,2 · 11 votos», nothing without votes", () => {
  const eleven = [5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4].map((s, i) => rating(`u${i}`, s));
  const { container, rerender } = render(<NotaLine ratings={eleven} />);
  expect(container).toHaveTextContent("Nota del vestuario: 4,2 · 11 votos");
  rerender(<NotaLine ratings={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("the nota while open: a 1–5 radio group with numbers and stars; choosing saves, «Quitar mi nota» takes it back", () => {
  render(<NotaCard matchId="j5" ratings={[rating("u1", 4), rating("u2", 5)]} me={ME} slot={{ state: "open", closesAt: CLOSES }} />);
  const group = screen.getByRole("radiogroup", { name: "¿Qué nota le pones al partido?" });
  const radios = within(group).getAllByRole("radio");
  expect(radios.map((x) => x.getAttribute("aria-label"))).toEqual(["1 de 5", "2 de 5", "3 de 5", "4 de 5", "5 de 5"]);
  expect(radios[3]).toBeChecked();
  expect(group).toHaveTextContent("★1★2★3★4☆5");
  expect(screen.getByText(/hasta el sábado, 17 de octubre a las 20:30/)).toBeInTheDocument();
  expect(screen.getByText("Nota del vestuario: 4,5 · 2 votos. Tu nota: 4.")).toBeInTheDocument();
  fireEvent.click(radios[1]);
  expect(w.rateMatch).toHaveBeenCalledWith(ME, "j5", 2);
  fireEvent.click(screen.getByRole("button", { name: "Quitar mi nota" }));
  expect(w.unrateMatch).toHaveBeenCalledWith(ME, "j5");
});

it("after 7 days the nota freezes: «La nota quedó en 4,2», no control", () => {
  const eleven = [5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4].map((s, i) => rating(i ? `u${i + 1}` : "u1", s));
  render(<NotaCard matchId="j5" ratings={eleven} me={ME} slot={{ state: "closed", closedAt: CLOSES }} />);
  expect(screen.getByRole("heading", { name: "La nota quedó en 4,2" })).toBeInTheDocument();
  expect(screen.getByText("11 votos del vestuario · tú le pusiste un 5.")).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup")).toBeNull();
});

it("before the acta: no nota at all", () => {
  const { container } = render(<NotaCard matchId="j5" ratings={[]} me={ME} slot={{ state: "none" }} />);
  expect(container).toBeEmptyDOMElement();
});
