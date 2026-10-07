import { describe, expect, it } from "vitest";
import { mapReaction } from "../../lib/firestoreMappers";
import { canReact, nextReaction, tallyReactions } from "./reactions";

describe("tallyReactions", () => {
  it("counts each value and finds mine", () => {
    const t = tallyReactions(
      [
        { id: "a", value: "ok" },
        { id: "b", value: "ok" },
        { id: "me", value: "dudas" },
      ],
      "me",
    );
    expect(t).toEqual({ ok: 2, dudas: 1, total: 3, mine: "dudas" });
  });
  it("has no «mine» signed out or without a reaction", () => {
    expect(tallyReactions([{ id: "a", value: "ok" }], null).mine).toBeNull();
    expect(tallyReactions([], "me")).toEqual({ ok: 0, dudas: 0, total: 0, mine: null });
  });
});

describe("canReact", () => {
  it("only members, only on an official board", () => {
    expect(canReact({ isOfficial: true }, true, "u")).toBe(true);
    expect(canReact({ isOfficial: false }, true, "u")).toBe(false);
    expect(canReact({ isOfficial: true }, false, "u")).toBe(false);
    expect(canReact({ isOfficial: true }, true, null)).toBe(false);
    expect(canReact(null, true, "u")).toBe(false);
  });
});

describe("nextReaction", () => {
  it("toggles off when tapping the same value, switches otherwise", () => {
    expect(nextReaction(null, "ok")).toBe("ok");
    expect(nextReaction("ok", "ok")).toBeNull();
    expect(nextReaction("ok", "dudas")).toBe("dudas");
  });
});

describe("mapReaction", () => {
  it("accepts ok/dudas (with a pending server time) and drops anything else", () => {
    expect(mapReaction("u", { value: "ok", at: null })).toEqual({ id: "u", value: "ok" });
    expect(mapReaction("u", { value: "dudas", at: { toMillis: () => 1 } })?.value).toBe("dudas");
    expect(mapReaction("u", { value: "fatal" })).toBeNull();
    expect(mapReaction("u", {})).toBeNull();
  });
});
