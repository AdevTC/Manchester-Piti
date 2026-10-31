import { describe, expect, it } from "vitest";
import type { Poll } from "../../../lib/derived/polls";
import {
  allKnown,
  composerLine,
  emptyHead,
  encuestasGroups,
  encuestasHead,
  encuestasOrder,
  encuestasVotersLine,
  openGroupMeta,
  optionAria,
  optionTag,
  pendingPolls,
  pollStatus,
  resultText,
  sendHint,
} from "./encuestasView";

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

describe("encuestasGroups", () => {
  const a = poll({ id: "a", createdAt: NOW - 2 * H });
  const b = poll({ id: "b", createdAt: NOW - H });
  const shut = poll({ id: "shut", closedAt: NOW - H });
  it("«Abiertas» newest first, «Cerradas esta semana» after", () => {
    const g = encuestasGroups([a, shut, b], NOW, null);
    expect(g.focus).toBeNull();
    expect(g.open.map((p) => p.id)).toEqual(["b", "a"]);
    expect(g.closed.map((p) => p.id)).toEqual(["shut"]);
    expect(g.allOpen.map((p) => p.id)).toEqual(["b", "a"]);
  });
  it("the named one apart, still counted when open", () => {
    const g = encuestasGroups([a, shut, b], NOW, "a");
    expect(g.focus?.id).toBe("a");
    expect(g.open.map((p) => p.id)).toEqual(["b"]);
    expect(g.allOpen.map((p) => p.id)).toEqual(["a", "b"]);
    const s = encuestasGroups([a, shut], NOW, "shut");
    expect(s.focus?.id).toBe("shut");
    expect(s.closed).toEqual([]);
    expect(s.allOpen.map((p) => p.id)).toEqual(["a"]);
  });
  it("what's left to vote", () => {
    expect(pendingPolls([a, b], { a: true, b: false }).map((p) => p.id)).toEqual(["b"]);
    expect(pendingPolls([a, b], { a: true })).toEqual([]);
    expect(allKnown([a, b], { a: true })).toBe(false);
    expect(allKnown([a, b], { a: true, b: true })).toBe(true);
  });
});

describe("encuestasHead", () => {
  const p = poll({ question: "¿Cena el viernes?" });
  it("loading and failed", () => {
    expect(encuestasHead({ loading: true, failed: false, open: [], pending: [], known: true })).toEqual({ title: "Mirando las encuestas…", sub: "Un momento." });
    expect(encuestasHead({ loading: false, failed: true, open: [], pending: [], known: true }).title).toBe("Las encuestas no cargan");
  });
  it("the count, and what you still have to vote", () => {
    expect(encuestasHead({ loading: false, failed: false, open: [], pending: [], known: true })).toEqual({ title: "Ninguna abierta", sub: "Pregunta algo al equipo y vota. Todos ven quién votó qué." });
    expect(encuestasHead({ loading: false, failed: false, open: [p], pending: [p], known: true })).toEqual({
      title: "1 encuesta abierta",
      sub: "Te falta votar «¿Cena el viernes?». Toca una opción y ya cuenta; todos ven quién votó qué.",
    });
    expect(encuestasHead({ loading: false, failed: false, open: [p, p], pending: [], known: true })).toEqual({
      title: "2 encuestas abiertas",
      sub: "Has votado en todas. ¿Quieres preguntar algo? Todos ven quién votó qué.",
    });
    expect(encuestasHead({ loading: false, failed: false, open: [p], pending: [], known: false }).sub).toBe("Pregunta algo al equipo y vota. Todos ven quién votó qué.");
    expect(encuestasHead({ loading: false, failed: false, open: [p], pending: [{ ...p, multi: true }], known: true }).sub).toContain("Marca las que te vengan y pulsa Votar");
  });
  it("«Abiertas»'s meta", () => {
    expect(openGroupMeta(1, true)).toBe("Te falta votar una · la más nueva arriba");
    expect(openGroupMeta(2, true)).toBe("Te falta votar 2 · la más nueva arriba");
    expect(openGroupMeta(0, true)).toBe("Has votado en todas · la más nueva arriba");
    expect(openGroupMeta(0, false)).toBe("La más nueva arriba");
  });
});

it("the card's words", () => {
  expect(pollStatus(poll(), NOW)).toEqual({ text: "Cierra en 3 días", cls: "is-ok", open: true });
  expect(pollStatus(poll({ closesAt: NOW + 5 * H }), NOW)).toEqual({ text: "Cierra en 5 horas", cls: "is-warn", open: true });
  expect(pollStatus(poll({ closedAt: NOW - H }), NOW)).toEqual({ text: "Cerrada", cls: "is-off", open: false });
  expect(resultText(poll(), { kind: "winner", ids: ["o1"] })).toBe("Gana Sí");
  expect(resultText(poll(), { kind: "tie", ids: ["o1", "o2"] })).toBe("Empate entre Sí y No");
  expect(resultText(poll(), { kind: "none" })).toBe("Nadie votó.");
  expect(optionTag("o1", { kind: "winner", ids: ["o1"] })).toBe(" · gana");
  expect(optionTag("o2", { kind: "winner", ids: ["o1"] })).toBe("");
  expect(optionTag("o2", { kind: "tie", ids: ["o1", "o2"] })).toBe(" · empate");
  expect(optionTag("o1", { kind: "none" })).toBe("");
  expect(optionAria("No", " · gana", 3, 60, true)).toBe("No · gana, 3 votos, 60 por ciento, tu voto");
  expect(optionAria("Sí", "", 1, 20, false)).toBe("Sí, 1 voto, 20 por ciento");
  expect(sendHint(true, 2, 0)).toBe("Marcadas: 2. Pulsa para guardarlo.");
  expect(sendHint(true, 0, 1)).toBe("Sin marcar nada quitas tu voto.");
  expect(sendHint(false, 1, 1)).toBe("Tu voto está guardado. Marca otras para cambiarlo.");
  expect(sendHint(false, 0, 0)).toBe("Marca las que te vengan y pulsa Votar.");
  expect(encuestasVotersLine(8, true, true)).toBe("Votaron: 8 personas, tú también.");
  expect(encuestasVotersLine(1, false, true)).toBe("Votaron: 1 persona.");
  expect(encuestasVotersLine(0, false, true)).toBe("Aún no ha votado nadie.");
  expect(encuestasVotersLine(0, false, false)).toBe("Nadie votó.");
  expect(composerLine(0, 3)).toBe("Le llega un aviso a todo el equipo.");
  expect(composerLine(2, 3)).toBe("Tienes 2 de 3 abiertas. Le llega un aviso a todo el equipo.");
  expect(emptyHead(false)).toBe("No hay encuestas ahora mismo. ¿Preguntas tú?");
  expect(emptyHead(true)).toBe("No hay encuestas abiertas. ¿Preguntas tú?");
});
