import { describe, expect, it } from "vitest";
import type { Poll } from "../../../lib/derived/polls";
import { encuestasMeta, encuestasOrder, encuestasVotersLine } from "./encuestasView";

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 23, 10);
const poll = (o: Partial<Poll> = {}): Poll => ({
  id: "p1",
  question: "¿Cena?",
  options: [
    { id: "o1", label: "Sí" },
    { id: "o2", label: "No" },
  ],
  multi: false,
  authorUid: "u2",
  authorName: "Huberoski",
  createdAt: NOW - H,
  closesAt: NOW + 3 * D,
  closedAt: null,
  ...o,
});

describe("encuestasOrder", () => {
  const open = poll({ id: "open" });
  const shut = poll({ id: "shut", closedAt: NOW - H });
  const old = poll({ id: "old", closesAt: NOW - 30 * D, createdAt: NOW - 40 * D });
  it("open first, the old ones out", () => {
    expect(encuestasOrder([shut, old, open], NOW, null)).toEqual({ list: [open, shut], missing: false });
  });
  it("the named poll first, even an old one", () => {
    expect(encuestasOrder([shut, old, open], NOW, "shut").list.map((p) => p.id)).toEqual(["shut", "open"]);
    expect(encuestasOrder([shut, old, open], NOW, "old").list.map((p) => p.id)).toEqual(["old", "open", "shut"]);
  });
  it("a deleted one is missing", () => {
    expect(encuestasOrder([open], NOW, "gone")).toEqual({ list: [open], missing: true });
  });
});

it("the board's lines", () => {
  expect(encuestasMeta(poll(), NOW)).toBe("De Huberoski · Cierra en 3 días · Todos ven quién votó qué.");
  expect(encuestasMeta(poll({ multi: true, closedAt: NOW - H }), NOW)).toBe("De Huberoski · Cerrada · Varias respuestas · Todos ven quién votó qué.");
  expect(encuestasVotersLine(8, true, true)).toBe("Votaron: 8 personas, tú también.");
  expect(encuestasVotersLine(1, false, true)).toBe("Votaron: 1 persona.");
  expect(encuestasVotersLine(0, false, true)).toBe("Aún no ha votado nadie.");
  expect(encuestasVotersLine(0, false, false)).toBe("Nadie votó.");
});
