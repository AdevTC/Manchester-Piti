import { describe, expect, it } from "vitest";
import { correctNarrationEvent, narrationContext, previewNarration, resolveNarrationQuestion } from "./narration";
import { defaultSheet, toPayload } from "../pages/admin/acta/sheetModel";
import { reviewMatch } from "../pages/admin/acta/review";
import type { MatchEvent } from "../../functions/src/matchEngine";
const original: MatchEvent = { id: "p", type: "pass", playerId: "a", receiverId: "b", minute: 2, outcome: "complete", source: "live" };
const sheet = defaultSheet("s", { rival: "Rival", date: 1, starters: ["a", "b", "c", "d", "e", "f", "g"], bench: [], status: "finished", events: [original] });
const bundle = (extra = {}) => JSON.stringify({ format: "piti-actions/v1", matchId: "m", baseRevision: 0, events: [original], ...extra });
describe("visual narration review", () => {
  it("allows an incomplete substitution sequence only in the draft and preserves its goals", () => {
    const current = { ...sheet, bench: ["h"] };
    const events: MatchEvent[] = [{ id: "sub", type: "substitution", minute: 1, playerId: "a", inPlayerId: "h" }, { id: "goal", type: "goal", minute: 3, playerId: "a", assistReviewed: true }];
    const preview = previewNarration(bundle({ events }), "m", current);
    expect(preview.canImportWithIncidents).toBe(true);
    expect(preview.validationErrors).toEqual(expect.arrayContaining([expect.stringMatching(/no está disponible en el campo/)]));
    expect(preview.sheet.events).toEqual(expect.arrayContaining(events.map(event => expect.objectContaining(event))));
    expect(preview.sheet.goalsFor).toBe(1);
    const draft = toPayload(preview.sheet, true, id => id ?? "");
    expect(draft).toMatchObject({ ok: true, sheet: { goalsFor: 1 } });
    expect(reviewMatch(preview.sheet, [...current.starters, ...current.bench], Date.now(), false, id => id ?? "").cuadra).toBe(false);
    expect(sheet.events).toEqual([original]);
  });
  it.each([
    { ...original, playerId: "outsider" },
    { ...original, receiverId: "outsider" },
    { id: "sub", type: "substitution", minute: 1, playerId: "a", inPlayerId: "outsider" },
    { id: "sub", type: "substitution", minute: 1, playerId: "a", inPlayerId: "a" },
    { id: "goal", type: "goal", minute: 1, playerId: "a", assistPlayerId: "outsider" },
    { id: "goal", type: "goal", minute: 1, playerId: "a", assistPlayerId: "a" },
    { ...original, minute: 100 },
  ])("does not allow draft exceptions for identities, self-references or invalid match times: %j", event => {
    expect(previewNarration(bundle({ events: [event] }), "m", sheet).canImportWithIncidents).toBe(false);
  });
  it("does not waive unresolved identity questions or stale revisions for an incomplete sequence", () => {
    const current = { ...sheet, bench: ["h"] };
    const events = [{ id: "sub", type: "substitution", minute: 1, playerId: "h", inPlayerId: "a" }];
    expect(previewNarration(bundle({ events, unresolved: ["¿Quién entra?"] }), "m", current).canImportWithIncidents).toBe(false);
    expect(() => previewNarration(bundle({ events, baseRevision: 1 }), "m", current)).toThrow(/ha cambiado/);
    expect(() => previewNarration(bundle({ events, matchId: "other" }), "m", current)).toThrow(/otro partido/);
    expect(() => previewNarration(bundle({ events: [{ ...events[0], minute: -1 }] }), "m", current)).toThrow();
    expect(previewNarration(bundle({ events: [{ ...original, playerId: "h" }] }), "m", { ...sheet, notCalled: ["h"] }).canImportWithIncidents).toBe(false);
  });
  it("does not count an unreviewed duplicate goal when preserving the draft score", () => {
    const goal: MatchEvent = { id: "g", type: "goal", minute: 3, playerId: "a", assistReviewed: true };
    const preview = previewNarration(bundle({ events: [goal, { ...goal, id: "duplicate", dupOf: "g" }] }), "m", sheet);
    expect(preview.sheet.goalsFor).toBe(1);
    expect(toPayload(preview.sheet, true, id => id ?? "")).toMatchObject({ ok: true, sheet: { goalsFor: 1 } });
  });
  it("distinguishes changes from reimports and retains prior source when it was omitted", () => {
    const same = previewNarration(bundle({ events: [{ ...original, source: undefined }] }), "m", sheet);
    expect(same).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    const next = previewNarration(bundle({ events: [{ ...original, receiverId: "c", sourceRef: "a la pasa a c" }, { id: "n", type: "shot", outcome: "off_target", minute: 3, playerId: "c" }] }), "m", sheet);
    expect(next).toMatchObject({ added: 1, updated: 1, unchanged: 0 });
    expect(next.changes[0].fields).toContainEqual({ key: "receiverId", before: "b", after: "c" });
    expect(next.changes[0].after.sourceRef).toBe("a la pasa a c");
    expect(sheet.events).toEqual([original]);
  });
  it("also exposes removed values and edits the proposal without touching the acta", () => {
    const corrected = correctNarrationEvent(bundle(), { ...original, receiverId: undefined, outcome: "incomplete" });
    const next = previewNarration(corrected, "m", sheet);
    expect(next.changes[0].fields).toContainEqual({ key: "receiverId", before: "b", after: undefined });
    expect(next.changes[0].fields).toContainEqual({ key: "outcome", before: "complete", after: "incomplete" });
    expect(sheet.events[0]).toEqual(original);
  });
  it("keeps legacy questions, supports player/action-linked doubts and never infers an answer", () => {
    const text = bundle({ unresolved: ["¿Fue largo?", { question: "¿Quién recibe?", playerIds: ["b", "c"], eventIds: ["p"], sourceRef: "se la pasa al otro" }] });
    const before = previewNarration(text, "m", sheet);
    expect(before.errors).toHaveLength(2);
    expect(before.questions[1]).toMatchObject({ playerIds: ["b", "c"], eventIds: ["p"] });
    expect(() => resolveNarrationQuestion(text, 1, " ")).toThrow(/Explica/);
    const resolved = resolveNarrationQuestion(text, 1, "Fue b, la acción ya es correcta.");
    const after = previewNarration(resolved, "m", sheet);
    expect(after.errors).toEqual(["¿Fue largo?"]);
    expect(after.sheet.events).toEqual(before.sheet.events);
  });
  it("context requests evidence and preserves validation gates after a correction", () => {
    expect(JSON.parse(narrationContext("m", sheet, [])).instructions).toMatch(/fragmento literal/);
    const bad = correctNarrationEvent(bundle(), { ...original, playerId: "not-in-squad" });
    expect(previewNarration(bad, "m", sheet).validationErrors.length).toBeGreaterThan(0);
  });
});
