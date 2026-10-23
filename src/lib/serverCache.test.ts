import { describe, expect, it, vi } from "vitest";
import { inlineBundle } from "./inlineBundle";
import { PURGE_GAP_MS, purgeDue, purgeRequest } from "../../functions/src/htmlCacheLogic";
import { takeInlineBundle } from "./bundle";

vi.mock("../firebase", () => ({ db: {} }));

const enc = new TextEncoder();
/** A length-prefixed bundle from its elements (lengths in UTF-8 bytes, as Firestore writes them). */
const bundleOf = (...elements: unknown[]) => enc.encode(elements.map((e) => { const json = JSON.stringify(e); return enc.encode(json).length + json; }).join(""));
/** The elements of a bundle, read the way Firestore's reader does (lengths in bytes). */
function elementsOf(text: string): unknown[] {
  const bytes = enc.encode(text);
  const dec = new TextDecoder();
  const out: unknown[] = [];
  let i = 0;
  while (i < bytes.length) {
    let j = i;
    while (bytes[j] >= 48 && bytes[j] <= 57) j++;
    const len = Number(dec.decode(bytes.subarray(i, j)));
    out.push(JSON.parse(dec.decode(bytes.subarray(j, j + len))));
    i = j + len;
  }
  return out;
}

describe("the bundle inside the page", () => {
  const elements = [
    { metadata: { id: "club", totalDocuments: 1 } },
    { document: { name: "players/a", fields: { nick: { stringValue: "</script><script>alert(1)</script> «Piti» ⚽" } } } },
    { document: { name: "matches/b", fields: { note: { stringValue: "<!-- 1 < 2 -->" } } } },
  ];

  it("has no «<» left, so nothing in the data can end the script element", () => {
    expect(inlineBundle(bundleOf(...elements))).not.toContain("<");
  });

  it("is still a valid bundle with the same data (each length recounted in bytes)", () => {
    expect(elementsOf(inlineBundle(bundleOf(...elements)))).toEqual(elements);
  });

  it("refuses something that is not a bundle", () => {
    expect(() => inlineBundle(enc.encode("<!doctype html>"))).toThrow();
  });

  it("is read once and taken out of the page, with the instant the page was painted at", () => {
    document.body.innerHTML = '<script type="application/json" id="club-bundle" data-at="1790000000000">12{"a":"\\u003c"}</script>';
    expect(takeInlineBundle()).toEqual({ text: '12{"a":"\\u003c"}', at: 1790000000000 });
    expect(document.getElementById("club-bundle")).toBeNull();
    expect(takeInlineBundle()).toBeNull();
  });
});

describe("deleting the cached pages when the data changes", () => {
  it("asks Vercel to delete the «club-html» pages of production", () => {
    const { url, init } = purgeRequest("manchester-piti", "team_1", "tok");
    expect(url).toBe("https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=manchester-piti&teamId=team_1");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ authorization: "Bearer tok", "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ tags: ["club-html"], target: "production" });
  });

  it("leaves the team out when there is none", () => {
    expect(purgeRequest("p", "", "t").url).not.toContain("teamId");
  });

  it("deletes at most once per gap, the first write always", () => {
    expect(purgeDue(1_000, 0)).toBe(true);
    expect(purgeDue(1_000 + PURGE_GAP_MS - 1, 1_000)).toBe(false);
    expect(purgeDue(1_000 + PURGE_GAP_MS, 1_000)).toBe(true);
  });
});
