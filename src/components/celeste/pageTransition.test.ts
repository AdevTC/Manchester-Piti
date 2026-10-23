import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetTapsForTesting, tapsSkipTransitions } from "./pageTransition";

type FakeTransition = { finished: Promise<void>; skipTransition: ReturnType<typeof vi.fn>; end: () => void };
function fakeDocument() {
  const doc = document.implementation.createHTMLDocument("t");
  const started: FakeTransition[] = [];
  (doc as unknown as { startViewTransition: () => FakeTransition }).startViewTransition = () => {
    let end = () => {};
    const finished = new Promise<void>((resolve) => (end = resolve));
    const t = { finished, skipTransition: vi.fn(), end };
    started.push(t);
    return t;
  };
  const start = () => (doc as unknown as { startViewTransition: () => FakeTransition }).startViewTransition();
  const tap = () => doc.dispatchEvent(new Event("pointerdown"));
  return { doc, start, tap, started };
}

afterEach(() => _resetTapsForTesting());

describe("a tap during a View Transition", () => {
  it("finishes the running transition at once", () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const t = start();
    tap();
    expect(t.skipTransition).toHaveBeenCalledTimes(1);
  });

  it("does nothing once the transition is over", async () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const t = start();
    t.end();
    await t.finished;
    tap();
    expect(t.skipTransition).not.toHaveBeenCalled();
  });

  it("follows the latest transition only", () => {
    const { doc, start, tap } = fakeDocument();
    tapsSkipTransitions(doc);
    const first = start();
    const second = start();
    tap();
    expect(first.skipTransition).not.toHaveBeenCalled();
    expect(second.skipTransition).toHaveBeenCalledTimes(1);
  });
});
