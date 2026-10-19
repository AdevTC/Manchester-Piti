import { describe, expect, it, vi } from "vitest";
vi.mock("firebase/functions", () => ({ httpsCallable: () => vi.fn() }));
vi.mock("../firebase", () => ({ functions: {}, auth: { currentUser: null }, FUNCTIONS_REGION: "europe-southwest1" }));
import { presetAllows, presetOf, presetTopics, PUBLIC_TOPICS } from "../../functions/src/pushPresets";
import { TOPICS } from "../../functions/src/pushLogic";
import { TOPIC_LABELS } from "./push";

describe("Avisos a medida (presets)", () => {
  it("each preset's topics, keeping the door's", () => {
    expect(presetTopics("goles", ["start", "door"], true)).toEqual(["goals", "door"]);
    expect(presetTopics("todo", [], false)).toEqual([...PUBLIC_TOPICS]);
    expect(presetTopics("todo", ["access"], true)).toEqual([...PUBLIC_TOPICS, "convocatoria", "access"]);
    expect(presetTopics("nada", ["goals", "door"], true)).toEqual(["door"]);
  });
  it("reads the choice back from the topics («A medida» otherwise)", () => {
    expect(presetOf([])).toBe("nada");
    expect(presetOf(["door"])).toBe("nada");
    expect(presetOf(["goals"])).toBe("goles");
    expect(presetOf(["goals", "access"])).toBe("goles");
    expect(presetOf([...PUBLIC_TOPICS])).toBe("todo");
    expect(presetOf([...PUBLIC_TOPICS, "convocatoria"])).toBe("todo");
    expect(presetOf(["goals", "final"])).toBe("custom");
    // the old «everything» without the new cards topic is a custom choice now
    expect(presetOf(["start", "goals", "final", "mvp", "dates", "lineup"])).toBe("custom");
  });
  it("what each choice lets through", () => {
    expect(presetAllows("goles", "goals")).toBe(true);
    expect(presetAllows("goles", "cards")).toBe(false);
    expect(presetAllows("goles", "personal")).toBe(false);
    expect(presetAllows("nada", "goals")).toBe(false);
    expect(presetAllows("nada", "door")).toBe(true);
    expect(presetAllows("todo", "personal")).toBe(true);
    expect(presetAllows("custom", "cards")).toBe(true);
    expect(presetAllows(undefined, "personal")).toBe(true);
  });
  it("the server's public topics, the presets' and the app's labels agree", () => {
    expect([...TOPICS].sort()).toEqual([...PUBLIC_TOPICS].sort());
    expect(TOPIC_LABELS.map((t) => t.id).sort()).toEqual([...PUBLIC_TOPICS].sort());
  });
});
