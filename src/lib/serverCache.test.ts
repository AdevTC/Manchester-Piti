// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { inlineBundle } from "./inlineBundle";
import { identityTokenUrl, inBatches, PURGE_GAP_MS, PURGE_URL, purgeRequest, purgeScheduler, purgeWait, SITE, WARM_BUNDLE_ENCODINGS, WARM_PAGES, warmPlan } from "../../functions/src/htmlCacheLogic";
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
  it("asks the site's own endpoint, signed with the functions' identity token for that same address", () => {
    const { url, init } = purgeRequest("id-token");
    expect(url).toBe(PURGE_URL);
    expect(url).toBe("https://manchester-piti.vercel.app/api/purge");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ authorization: "Bearer id-token" });
    expect(identityTokenUrl(PURGE_URL)).toBe(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=https%3A%2F%2Fmanchester-piti.vercel.app%2Fapi%2Fpurge&format=full",
    );
  });

  it("deletes at once when the last deletion is a gap old, the first write always", () => {
    expect(purgeWait(1_000, 0)).toBe(0);
    expect(purgeWait(1_000 + PURGE_GAP_MS, 1_000)).toBe(0);
    expect(purgeWait(1_000 + PURGE_GAP_MS - 1, 1_000)).toBe(1);
    expect(purgeWait(1_000 + 5_000, 1_000)).toBe(PURGE_GAP_MS - 5_000);
  });

  /** A scheduler on a fake clock: `sleep` moves the clock; each deletion is logged with its instant. */
  function fake() {
    let t = 1_000;
    const runs: number[] = [];
    const sleeps: (() => void)[] = [];
    const purge = purgeScheduler(
      async () => void runs.push(t),
      () => t,
      (ms) => new Promise<void>((r) => sleeps.push(() => ((t += ms), r()))),
    );
    const settle = () => new Promise((r) => setTimeout(r, 0));
    return { purge, runs, at: (ms: number) => (t = ms), wake: async () => (sleeps.shift()?.(), settle()), settle };
  }

  it("never drops a write inside the gap: it is deleted when the gap ends, together with the others there", async () => {
    const f = fake();
    await f.purge();
    expect(f.runs).toEqual([1_000]);
    f.at(4_000);
    const second = f.purge();
    f.at(9_000);
    const third = f.purge();
    expect(third).toBe(second);
    await f.settle();
    expect(f.runs).toEqual([1_000]);
    await f.wake();
    await second;
    // (one deletion for both writes, after them, a gap after the first deletion)
    expect(f.runs.length).toBe(2);
    expect(f.runs[1]).toBeGreaterThanOrEqual(1_000 + PURGE_GAP_MS);
  });

  it("a write while a deletion is on its way gets one of its own after it", async () => {
    let t = 1_000;
    const runs: number[] = [];
    let release = () => {};
    const purge = purgeScheduler(
      () => new Promise<void>((r) => { runs.push(t); release = r; }),
      () => t,
      async (ms) => void (t += ms),
    );
    const first = purge();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toEqual([1_000]);
    t = 2_000;
    const second = purge();
    expect(second).not.toBe(first);
    release();
    await first;
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toEqual([1_000, 1_000 + PURGE_GAP_MS]);
    release();
    await second;
  });

  it("tells the deletion whether a later write is already waiting (then it doesn't warm: that one will)", async () => {
    let t = 1_000;
    const seen: boolean[] = [];
    let wake = () => {};
    let endGap = () => {};
    const purge = purgeScheduler(
      async (waiting) => {
        await new Promise<void>((r) => (wake = r));
        seen.push(waiting());
      },
      () => t,
      (ms) => new Promise<void>((r) => (endGap = () => ((t += ms), r()))),
    );
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const first = purge();
    await tick();
    t = 3_000;
    const second = purge();
    wake();
    await first;
    expect(seen).toEqual([true]);
    endGap();
    await tick();
    wake();
    await second;
    expect(seen).toEqual([true, false]);
  });
});

describe("warming the pages again after a deletion", () => {
  it("asks for the bundle as Chrome and Safari do, then one page, then the rest and the matches just written", () => {
    const plan = warmPlan(["a1", "bad/id", "b2", "c3", "d4"]);
    expect(plan.bundle.map((b) => b.url)).toEqual([`${SITE}/datos/club.bundle`, `${SITE}/datos/club.bundle`]);
    expect(plan.bundle.map((b) => (b.init.headers as Record<string, string>)["accept-encoding"])).toEqual(WARM_BUNDLE_ENCODINGS);
    expect(SITE).toBe("https://manchester-piti.vercel.app");
    expect(plan.first).toBe(`${SITE}/`);
    expect(plan.pages).toEqual([...WARM_PAGES.slice(1), "/partidos/b2", "/partidos/c3", "/partidos/d4"].map((p) => SITE + p));
  });

  it("runs a few at a time, all of them", async () => {
    let running = 0;
    let most = 0;
    const done: number[] = [];
    await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 1));
      done.push(n);
      running--;
    });
    expect(most).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
