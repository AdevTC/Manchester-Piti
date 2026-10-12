import { afterEach, describe, expect, it } from "vitest";
import { addTag, cleanTag, parseTags, removeTag, tagError, tagsInUse, tagSuggestions, TAG_MAX, TAGS_MAX } from "./tags";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupMeta } from "../lineupDoc";
import { seedLineup } from "../lineupOps";
import { getDroppedDocStats, resetDroppedDocStats } from "../../../lib/docTelemetry";

// Las etiquetas de un tablero: ≤ 3, ≤ 20 letras, una vez cada una; leídas con indulgencia (una mala se
// cae sola y se avisa) y guardadas solo cuando el tablero tuvo alguna vez etiquetas.

const meta: LineupMeta = { ownerUid: "u", ownerNickname: "piti", seasonId: "s", name: "Mi siete", isOfficial: false, matchId: null };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

afterEach(() => resetDroppedDocStats());

describe("tags: reading", () => {
  it("keeps the valid ones, once each (case and accents aside), at most three", () => {
    expect(parseTags(["Liga", "liga", " Copa ", "Entreno", "Amistoso"], "x")).toEqual(["Liga", "Copa", "Entreno"]);
    expect(parseTags(["Pretemporada", "pretemporáda"], "x")).toEqual(["Pretemporada"]);
  });

  it("drops (and reports) what is not a short text; a non-list is none", () => {
    expect(parseTags(["Liga", 3, "", "x".repeat(TAG_MAX + 1), null], "x")).toEqual(["Liga"]);
    expect(parseTags("Liga", "y")).toEqual([]);
    expect(parseTags(undefined, "z")).toEqual([]);
    expect(getDroppedDocStats()["lineups.tags"]).toBeGreaterThanOrEqual(4);
  });
});

describe("tags: editing", () => {
  it("adds a cleaned tag; refuses empty, repeated or a fourth", () => {
    expect(cleanTag("  Copa   del  Rey ")).toBe("Copa del Rey");
    expect(addTag([], "  Liga ")).toEqual(["Liga"]);
    expect(tagError("", [])).toBe("Escribe la etiqueta.");
    expect(tagError("LIGA", ["Liga"])).toBe("Ya lleva «LIGA».");
    expect(tagError("Final", ["Liga", "Copa", "Entreno"])).toBe("Como mucho " + TAGS_MAX + " etiquetas por tablero.");
    expect(addTag(["Liga", "Copa", "Entreno"], "Final")).toEqual(["Liga", "Copa", "Entreno"]);
    expect(addTag([], "x".repeat(30))).toEqual(["x".repeat(TAG_MAX)]);
    expect(removeTag(["Liga", "Copa"], "Liga")).toEqual(["Copa"]);
  });

  it("the tags in use, most used first; the suggestions leave out the board's own", () => {
    const rows = [{ tags: ["Liga", "Copa"] }, { tags: ["liga"] }, {}, { tags: ["Entreno"] }];
    expect(tagsInUse(rows)).toEqual(["Liga", "Copa", "Entreno"]);
    expect(tagSuggestions(["Liga"], ["Liga", "Amistoso"])).toEqual(["Copa", "Entreno", "Amistoso"]);
  });
});

describe("tags in the lineup document", () => {
  it("round-trips them; a board that never had tags writes no field", () => {
    const L = seedLineup("2-3-1", ["a"]);
    expect("tags" in lineupToData(L, meta)).toBe(false);
    expect("tags" in extractLineup(dataToLineupDoc("x", json(lineupToData(L, meta))))).toBe(false);
    const tagged = { ...L, tags: ["Liga", "Copa"] };
    const data = lineupToData(tagged, meta);
    expect(data.tags).toEqual(["Liga", "Copa"]);
    expect(extractLineup(dataToLineupDoc("x", json(data))).tags).toEqual(["Liga", "Copa"]);
    // cleared: an empty list is written (so the store clears them too)
    expect(lineupToData({ ...L, tags: [] }, meta).tags).toEqual([]);
  });

  it("a corrupt tags field never breaks the board", () => {
    const data = json(lineupToData(seedLineup("2-3-1", ["a"]), meta));
    data.tags = { a: "Liga" };
    const d = dataToLineupDoc("x", data);
    expect(d.tags).toEqual([]);
    expect(d.slots).toHaveLength(7);
  });
});
