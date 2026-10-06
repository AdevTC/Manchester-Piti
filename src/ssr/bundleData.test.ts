import { Timestamp } from "firebase/firestore";
import { decodeValue, inQueryOrder, parseBundle } from "./bundleData";

const ROOT = "projects/p/databases/(default)/documents";

/** A bundle as functions/src/bundle.ts serves it: `<byte length><JSON>` elements. */
function bundleOf(elements: object[]): Uint8Array {
  const enc = new TextEncoder();
  const parts = elements.map((e) => {
    const json = enc.encode(JSON.stringify(e));
    return [...enc.encode(String(json.length)), ...json];
  });
  return new Uint8Array(parts.flat());
}

const doc = (path: string, fields: object, queries: string[] = []) => [
  { documentMetadata: { name: `${ROOT}/${path}`, exists: true, queries } },
  { document: { name: `${ROOT}/${path}`, fields } },
];
const ts = (seconds: number) => ({ timestampValue: { seconds: String(seconds), nanos: 0 } });

describe("decodeValue", () => {
  it("turns Firestore's typed JSON into what snapshot.data() returns", () => {
    expect(decodeValue({ integerValue: "5" })).toBe(5);
    expect(decodeValue({ doubleValue: 1.5 })).toBe(1.5);
    expect(decodeValue({ stringValue: "Piti" })).toBe("Piti");
    expect(decodeValue({ booleanValue: true })).toBe(true);
    expect(decodeValue({ nullValue: null })).toBeNull();
    expect(decodeValue({ arrayValue: {} })).toEqual([]);
    expect(
      decodeValue({
        mapValue: { fields: { goals: { arrayValue: { values: [{ mapValue: { fields: { min: { integerValue: "12" } } } }] } } } },
      }),
    ).toEqual({ goals: [{ min: 12 }] });
  });

  it("gives real Timestamps, from either encoding", () => {
    const fromObject = decodeValue({ timestampValue: { seconds: "1778414400", nanos: 5 } });
    expect(fromObject).toBeInstanceOf(Timestamp);
    expect(fromObject).toEqual(new Timestamp(1778414400, 5));
    const fromString = decodeValue({ timestampValue: "2026-05-10T12:00:00Z" }) as Timestamp;
    expect(fromString.toMillis()).toBe(Date.parse("2026-05-10T12:00:00Z"));
  });
});

describe("parseBundle + inQueryOrder", () => {
  const bytes = bundleOf([
    { metadata: { id: "club-publico" } },
    { namedQuery: { name: "matches" } },
    ...doc("matches/a", { date: ts(100), rival: { stringValue: "Atlético Ñandú" } }, ["matches"]),
    ...doc("matches/c", { date: ts(300) }, ["matches"]),
    ...doc("matches/b", { date: ts(300) }, ["matches"]),
    ...doc("players/z", { firstName: { stringValue: "Zoe" } }, ["players"]),
    ...doc("players/m", { firstName: { stringValue: "Mar" } }, ["players"]),
    ...doc("seasons/s2", { name: { stringValue: "Temporada 2" } }, ["seasons"]),
    ...doc("seasons/s1", { name: { stringValue: "Temporada 1" } }, ["seasons"]),
    ...doc("clubContent/main", { intro: { stringValue: "Hola" } }),
  ]);

  it("groups the documents by the query they answer and keeps the extra ones by path", () => {
    const bundle = parseBundle(bytes);
    expect(bundle.queries.matches.map((d) => d.id)).toEqual(["a", "c", "b"]);
    expect(bundle.docs.get("clubContent/main")?.data).toEqual({ intro: "Hola" });
    // Byte lengths, not characters: accented text doesn't shift the next element.
    expect(bundle.queries.matches[0].data.rival).toBe("Atlético Ñandú");
  });

  it("orders like Firestore: orderBy field, then document id in the same direction", () => {
    const data = inQueryOrder(parseBundle(bytes));
    expect(data.matches.map((d) => d.id)).toEqual(["c", "b", "a"]);
    expect(data.players.map((d) => d.id)).toEqual(["m", "z"]);
    expect(data.seasons.map((d) => d.data.name)).toEqual(["Temporada 1", "Temporada 2"]);
    expect(data.content?.data.intro).toBe("Hola");
  });
});
